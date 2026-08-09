/**
 * TikSearch Command — Search TikTok and send the video
 * Usage: .tiksearch <query>
 *
 * Robust pipeline:
 *   1. Search across multiple providers until one returns hits.
 *      - prexzyapis.com
 *      - tikwm.com /api/feed/search           (POST)
 *      - delirius-apiofc.vercel.app
 *   2. For up to 8 hits, try each candidate URL (hdplay > play > wmplay).
 *   3. For each URL, retry up to 2x with backoff and browser headers.
 *   4. If every direct URL fails for a hit but we have the original tiktok
 *      page URL, re-resolve via `https://tikwm.com/api/?url=...&hd=1` and
 *      retry the fresh CDN URL it returns.
 *   5. 5-minute in-memory query cache.
 */
'use strict';

const axios = require('axios');

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.tiktok.com/',
};

// Headers that mimic tikwm.com's OWN frontend calling its OWN API — this is
// the same request their website makes when a real person types a query into
// the search box at tikwm.com. Cloudflare rules on an API host are usually
// tuned to wave through same-origin AJAX calls from the site's own pages and
// hold up everything else, so matching that shape (Origin/Referer = tikwm.com
// itself, Sec-Fetch-* set the way a fetch()-from-page call sets them,
// X-Requested-With present) is the difference between "obvious bot" and
// "the site talking to itself" as far as that check is concerned. Not
// guaranteed — if tikwm is running a full JS/TLS challenge instead of a
// header check, nothing short of a real browser gets through.
const TIKWM_HEADERS = {
    'User-Agent': BROWSER_HEADERS['User-Agent'],
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://www.tikwm.com',
    'Referer': 'https://www.tikwm.com/',
    'X-Requested-With': 'XMLHttpRequest',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Ch-Ua': '"Chromium";v="120", "Not_A Brand";v="8", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
};

const MIN_VIDEO_BYTES = 10 * 1024;       // < 10 KB => junk / error page
const MAX_CANDIDATES  = 8;
const URL_RETRIES     = 2;
const CACHE_TTL_MS    = 5 * 60 * 1000;

const cache = new Map(); // query -> { ts, result }

// ─── helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function pickUrls(item) {
    return [item?.hdplay, item?.play, item?.wmplay]
        .filter(u => typeof u === 'string' && /^https?:\/\//.test(u));
}

function shapeItem(item) {
    if (!item) return null;
    const urls = pickUrls(item);
    if (!urls.length && !item?.video_id && !item?.id) return null;
    return {
        urls,
        pageUrl:  item.share_url || item.webVideoUrl || (item.id ? `https://www.tiktok.com/@${item.author?.unique_id || 'user'}/video/${item.id}` : null),
        title:    (item.title || item.desc || 'TikTok Video').slice(0, 100),
        author:   item.author?.nickname || item.author?.unique_id || item.author?.uniqueId || 'Unknown',
        duration: item.duration || 0,
        plays:    item.play_count || item.playCount || 0,
        likes:    item.digg_count || item.diggCount || 0,
    };
}

// ─── search providers ────────────────────────────────────────────────────────

function logProviderFailure(name, res, err) {
    if (err) {
        console.error(`[tiksearch] ${name} threw: ${err.code || ''} ${err.message}`);
        return;
    }
    const bodyPreview = typeof res.data === 'string'
        ? res.data.slice(0, 200)
        : JSON.stringify(res.data)?.slice(0, 200);
    console.error(`[tiksearch] ${name} returned no usable array — status ${res.status}, body: ${bodyPreview}`);
}

async function searchPrexzyvilla(query) {
    try {
        const res = await axios.get('https://prexzyapis.com/search/tiktoksearch', {
            params: { q: query }, timeout: 20000, validateStatus: () => true,
        });
        const arr = res.data?.data;
        if (!Array.isArray(arr)) { logProviderFailure('prexzyapis', res); return []; }
        return arr;
    } catch (err) { logProviderFailure('prexzyapis', null, err); return []; }
}

async function searchTikwm(query) {
    try {
        const res = await axios.post(
            'https://www.tikwm.com/api/feed/search',
            new URLSearchParams({ keywords: query, count: '12', cursor: '0', HD: '1' }).toString(),
            {
                timeout: 20000,
                validateStatus: () => true,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    ...TIKWM_HEADERS,
                },
            }
        );
        const arr = res.data?.data?.videos;
        if (!Array.isArray(arr)) { logProviderFailure('tikwm', res); return []; }
        return arr;
    } catch (err) { logProviderFailure('tikwm', null, err); return []; }
}

async function searchDelirius(query) {
    try {
        const res = await axios.get('https://delirius-apiofc.vercel.app/search/tiktoksearch', {
            params: { query }, timeout: 20000, validateStatus: () => true,
        });
        const arr = res.data?.meta || res.data?.data;
        if (!Array.isArray(arr)) { logProviderFailure('delirius', res); return []; }
        return arr;
    } catch (err) { logProviderFailure('delirius', null, err); return []; }
}

async function findCandidates(query) {
    for (const fn of [searchTikwm, searchPrexzyvilla, searchDelirius]) {
        const arr = await fn(query);
        const mapped = arr.map(shapeItem).filter(Boolean);
        if (mapped.length) return mapped.slice(0, MAX_CANDIDATES);
        if (arr.length && !mapped.length) {
            console.error(`[tiksearch] provider returned ${arr.length} raw item(s) but shapeItem() rejected all of them — response shape likely changed`);
        }
    }
    return [];
}

// ─── re-resolver (last resort per candidate) ─────────────────────────────────

async function resolveFreshUrls(pageUrl) {
    if (!pageUrl) return [];
    try {
        const res = await axios.get('https://www.tikwm.com/api/', {
            params: { url: pageUrl, hd: 1 },
            timeout: 20000,
            validateStatus: () => true,
            headers: TIKWM_HEADERS,
        });
        const d = res.data?.data;
        return pickUrls(d || {});
    } catch { return []; }
}

// ─── downloader ──────────────────────────────────────────────────────────────

async function downloadOne(url) {
    let lastErr = null;
    for (let attempt = 0; attempt <= URL_RETRIES; attempt++) {
        try {
            const res = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: 64 * 1024 * 1024,
                headers: BROWSER_HEADERS,
                validateStatus: () => true,
            });
            if (res.status === 200 && res.data && res.data.length >= MIN_VIDEO_BYTES) {
                return Buffer.from(res.data);
            }
            if (res.status >= 500) {
                lastErr = new Error(`HTTP ${res.status}`);
                await sleep(400 * (attempt + 1));
                continue;
            }
            // 4xx / tiny body => no point retrying this URL
            return null;
        } catch (e) {
            lastErr = e;
            await sleep(400 * (attempt + 1));
        }
    }
    return null;
}

async function downloadCandidate(candidate) {
    // Try every direct URL the provider gave us.
    for (const u of candidate.urls) {
        const buf = await downloadOne(u);
        if (buf) return buf;
    }
    // Last resort: re-resolve through tikwm with the page URL.
    const fresh = await resolveFreshUrls(candidate.pageUrl);
    for (const u of fresh) {
        if (candidate.urls.includes(u)) continue;
        const buf = await downloadOne(u);
        if (buf) return buf;
    }
    return null;
}

// ─── command ─────────────────────────────────────────────────────────────────

module.exports = {
    name: 'tiksearch',
    aliases: ['tiktoksearch', 'tik', 'tikdownload', 'tikvideo'],
    description: 'Search TikTok and send the first matching video',
    category: 'media',
    usage: '.tiksearch <search query>',

    async execute({ sock, msg, from, reply, args }) {
        if (!args.length) {
            return reply(
                `🎬 *TikTok Search*\n\n` +
                `Usage: .tiksearch <search query>\n` +
                `Example: .tiksearch Sukuna edit`
            );
        }

        const query = args.join(' ').trim();
        const cacheKey = query.toLowerCase();

        try {
            await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } }).catch(() => {});

            // ── cache hit ────────────────────────────────────────────────
            const cached = cache.get(cacheKey);
            if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
                await sock.sendMessage(from, {
                    video: cached.result.buffer,
                    mimetype: 'video/mp4',
                    caption: cached.result.caption,
                }, { quoted: msg });
                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
                return;
            }

            const candidates = await findCandidates(query);
            if (!candidates.length) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply(`❌ No TikTok videos found for "${query}". Try different keywords.`);
            }

            await sock.sendMessage(from, { react: { text: '⬇️', key: msg.key } }).catch(() => {});

            let chosen = null;
            let buffer = null;
            for (const cand of candidates) {
                buffer = await downloadCandidate(cand);
                if (buffer) { chosen = cand; break; }
            }

            if (!buffer || !chosen) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply(
                    `❌ Found videos for "${query}" but every download attempt failed ` +
                    `(${candidates.length} candidates tried). Try a different search.`
                );
            }

            const caption =
                `🎬 *${chosen.title}*\n\n` +
                `👤 ${chosen.author}\n` +
                `⏱️ ${chosen.duration}s   👁️ ${chosen.plays.toLocaleString()}   ❤️ ${chosen.likes.toLocaleString()}\n\n` +
                `> SUKUNA-MD 🔥`;

            await sock.sendMessage(from, {
                video: buffer,
                mimetype: 'video/mp4',
                caption,
            }, { quoted: msg });

            cache.set(cacheKey, { ts: Date.now(), result: { buffer, caption } });
            // prune cache
            if (cache.size > 50) {
                const cutoff = Date.now() - CACHE_TTL_MS;
                for (const [k, v] of cache) if (v.ts < cutoff) cache.delete(k);
            }

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
        } catch (err) {
            console.error('[tiksearch] error:', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
            reply('❌ Something went wrong searching or sending the video. Try again later.');
        }
    },
};
      
