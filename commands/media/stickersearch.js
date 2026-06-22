/**
 * .stickersearch <query> — searches KLIPY's sticker library and sends up
 * to 5 real, query-matched stickers as WhatsApp stickers.
 *
 * Example: .stickersearch homelander
 * Example: .stickersearch laughing
 * Aliases: .stickersearch, .ssearch, .stickers, .findsticker
 *
 * Provider: KLIPY Sticker API — https://docs.klipy.com/stickers-api/stickers-search-api
 * Auth: the API key is part of the URL path (not a query param):
 *   GET https://api.klipy.com/api/v1/{API_KEY}/stickers/search
 *       ?q=<query>&customer_id=<id>&page=<n>&per_page=<n>
 * The key lives in config.js → apiKeys.klipy (override with the
 * KLIPY_API_KEY env var, same convention as the imgbb key already used
 * by editimage.js).
 *
 * KLIPY's exact response field names for media renditions aren't fixed
 * in their public docs examples, so results are parsed defensively (same
 * approach as lib/mediaFetch.js / utils/prexzyShape.js elsewhere in this
 * project): walk the whole result object and grab the first .webp url,
 * falling back to .gif, then .mp4. Anything that isn't already .webp is
 * transcoded with ffmpeg (ffmpeg-static, already a project dependency)
 * into a proper animated WebP sticker.
 *
 * If KLIPY ever returns nothing for a query (typo, very obscure term, or
 * a transient API issue), the command tries KLIPY's GIF search as a
 * second pass before giving up — so "no stickers found" only happens if
 * the term genuinely has no matches in either library.
 *
 * Every sticker sent shows "Sukuna MD" as the pack name and "Pasqua" as
 * the author/publisher (embedded via node-webpmux EXIF, same technique
 * already used by commands/media/tgsticker.js — already a dependency).
 */
'use strict';
const axios = require('axios');
const { spawn } = require('child_process');
const config = require('../../config');

let WebpMux = null;
try { WebpMux = require('node-webpmux'); } catch (_) { WebpMux = null; }

const PACK_NAME = 'Sukuna MD';
const PACK_AUTHOR = 'Pasqua';

/** Embeds sticker-pack name/author into a webp buffer's EXIF chunk
 *  (same technique already used by commands/media/tgsticker.js). */
async function addPackMetadata(webpBuffer) {
    if (!WebpMux || !webpBuffer) return webpBuffer;
    try {
        const img = new WebpMux.Image();
        await img.load(webpBuffer);
        const json = {
            'sticker-pack-id': 'sukunamd-' + Date.now(),
            'sticker-pack-name': PACK_NAME,
            'sticker-pack-publisher': PACK_AUTHOR,
            emojis: ['🔍'],
        };
        const exifAttr = Buffer.from([
            0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
            0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
        ]);
        const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf-8');
        const exif = Buffer.concat([exifAttr, jsonBuffer]);
        exif.writeUIntLE(jsonBuffer.length, 14, 4);
        img.exif = exif;
        return await img.save(null);
    } catch (err) {
        console.error('[stickersearch] EXIF pack-name write failed:', err.message);
        return webpBuffer; // still send the sticker, just without the pack name
    }
}

const KLIPY_KEY = (config.apiKeys && config.apiKeys.klipy) || '';
const KLIPY_BASE = KLIPY_KEY ? `https://api.klipy.com/api/v1/${KLIPY_KEY}` : null;

const WANTED = 5;
const PER_PAGE = 25;

let ffmpegPath = null;
try { ffmpegPath = require('ffmpeg-static'); } catch (_) { ffmpegPath = null; }

const UA = { 'User-Agent': 'Mozilla/5.0 (SUKUNA-MD)' };

// ── Generic recursive url-collector (schema-agnostic, same idea as the
// project's own lib/mediaFetch.js) ──────────────────────────────────────
function collectUrls(node, out) {
    if (!node) return;
    if (typeof node === 'string') {
        if (/^https?:\/\//i.test(node)) out.push(node);
        return;
    }
    if (Array.isArray(node)) { for (const v of node) collectUrls(v, out); return; }
    if (typeof node === 'object') {
        for (const v of Object.values(node)) collectUrls(v, out);
    }
}

function pickBestUrl(item) {
    const urls = [];
    collectUrls(item, urls);
    if (!urls.length) return null;

    const webp = urls.find(u => /\.webp(\?|$)/i.test(u));
    if (webp) return { url: webp, kind: 'webp' };
    const gif = urls.find(u => /\.gif(\?|$)/i.test(u));
    if (gif) return { url: gif, kind: 'gif' };
    const mp4 = urls.find(u => /\.mp4(\?|$)/i.test(u));
    if (mp4) return { url: mp4, kind: 'mp4' };
    return null;
}

// Pull the results array out of KLIPY's response no matter how it's wrapped
// (seen as both { data: { data: [...] } } and { data: [...] } in the wild).
function extractItems(payload) {
    if (!payload) return [];
    const d = payload.data;
    if (Array.isArray(d)) return d;
    if (d && Array.isArray(d.data)) return d.data;
    if (Array.isArray(payload)) return payload;
    return [];
}

async function searchKlipy(query, page, type) {
    if (!KLIPY_BASE) {
        console.error('[stickersearch] no KLIPY API key configured');
        return [];
    }
    try {
        const { data, status } = await axios.get(`${KLIPY_BASE}/${type}/search`, {
            params: {
                q: query,
                customer_id: 'sukuna-md-bot',
                page: page || 1,
                per_page: PER_PAGE,
            },
            timeout: 20000,
            headers: UA,
            validateStatus: () => true,
        });

        if (status !== 200) {
            console.error(`[stickersearch] klipy ${type} HTTP ${status}:`, JSON.stringify(data).slice(0, 300));
            return [];
        }

        const items = extractItems(data);
        if (!items.length) {
            console.log(`[stickersearch] klipy ${type} returned 0 results for "${query}" (page ${page})`);
        }
        return items;
    } catch (e) {
        console.error(`[stickersearch] klipy ${type} request failed:`, e.message);
        return [];
    }
}

async function downloadBuffer(url) {
    try {
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: UA,
            validateStatus: s => s === 200,
        });
        const buf = Buffer.from(res.data);
        if (!buf || buf.length < 256) return null;
        return buf;
    } catch (e) {
        return null;
    }
}

// Transcode a GIF/MP4 buffer into an animated WebP sticker via ffmpeg.
function transcodeToWebp(buffer) {
    return new Promise((resolve) => {
        if (!ffmpegPath) return resolve(null);
        const args = [
            '-hide_banner', '-loglevel', 'error',
            '-i', 'pipe:0',
            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15',
            '-vcodec', 'libwebp',
            '-lossless', '0',
            '-compression_level', '6',
            '-q:v', '60',
            '-loop', '0',
            '-preset', 'default',
            '-an', '-vsync', '0',
            '-f', 'webp',
            'pipe:1',
        ];
        let settled = false;
        const finish = (val) => { if (!settled) { settled = true; resolve(val); } };

        const ff = spawn(ffmpegPath, args);
        const chunks = [];
        const timer = setTimeout(() => { try { ff.kill('SIGKILL'); } catch (_) {} finish(null); }, 20000);

        ff.stdout.on('data', c => chunks.push(c));
        ff.on('error', () => { clearTimeout(timer); finish(null); });
        ff.on('close', (code) => {
            clearTimeout(timer);
            if (code !== 0 || !chunks.length) return finish(null);
            finish(Buffer.concat(chunks));
        });
        ff.stdin.on('error', () => {});
        ff.stdin.end(buffer);
    });
}

async function resolveSticker(item) {
    const picked = pickBestUrl(item);
    if (!picked) return null;

    const raw = await downloadBuffer(picked.url);
    if (!raw) return null;

    if (picked.kind === 'webp') return raw; // already a valid sticker
    return await transcodeToWebp(raw); // gif/mp4 → webp
}

async function gatherStickers(query, wanted) {
    const buffers = [];

    // Pass 1: real sticker search, page 1 then page 2 if still short.
    // Pass 2: KLIPY's GIF search as a fallback if stickers come up empty.
    const attempts = [
        { type: 'stickers', page: 1 },
        { type: 'stickers', page: 2 },
        { type: 'gifs', page: 1 },
    ];

    for (const { type, page } of attempts) {
        if (buffers.length >= wanted) break;
        const results = await searchKlipy(query, page, type);
        for (const item of results) {
            if (buffers.length >= wanted) break;
            const buf = await resolveSticker(item);
            if (buf) buffers.push(buf);
        }
    }

    return buffers;
}

module.exports = {
    name: 'stickersearch',
    aliases: ['ssearch', 'stickers', 'findsticker', 'searchsticker'],
    description: 'Search for stickers by name/keyword and send up to 5 matches',
    category: 'media',
    usage: '.stickersearch <name/keyword>',

    async execute({ sock, msg, from, reply, args }) {
        const query = (args || []).join(' ').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

        if (!query) {
            return reply(
                `🔍 *Sticker Search*\n\n` +
                `Usage: .stickersearch <name/keyword>\n` +
                `Example: .stickersearch homelander\n` +
                `Example: .stickersearch laughing\n` +
                `Example: .stickersearch slap`
            );
        }

        if (!KLIPY_BASE) {
            return reply('❌ Sticker search isn\'t configured — missing KLIPY API key.');
        }

        try {
            await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } }).catch(() => {});

            const buffers = await gatherStickers(query, WANTED);

            if (!buffers.length) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply(`❌ No stickers found for *${query}*. Try a different keyword.`);
            }

            for (const buf of buffers) {
                const stamped = await addPackMetadata(buf);
                await sock.sendMessage(from, { sticker: stamped }, { quoted: msg }).catch(() => {});
            }

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
        } catch (err) {
            console.error('[stickersearch] error:', err.message);
            try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            reply('❌ Sticker search failed. Please try again later.');
        }
    },
};
