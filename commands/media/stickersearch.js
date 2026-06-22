/**
 * .stickersearch <query> — searches for stickers matching a name/keyword
 * and sends up to 5 of them as real WhatsApp stickers.
 *
 * Example: .stickersearch homelander
 * Example: .stickersearch laughing
 * Aliases: .stickersearch, .ssearch, .stickers, .findsticker
 *
 * Provider: GIPHY Stickers Search API (https://api.giphy.com/v1/stickers/search)
 * Uses GIPHY's official public "beta" key (dc6zaTOxFJmzC) — this is the
 * key GIPHY itself publishes for anyone to test/use the API without
 * signing up (see https://developers.giphy.com/docs/api/). It is rate
 * limited (100 calls/hour) but requires no setup, so the command works
 * out of the box.
 *
 * GIPHY sticker results sometimes only ship a GIF rendition (no native
 * .webp), so anything that isn't already a .webp gets transcoded with
 * ffmpeg (ffmpeg-static, already a project dependency) into an animated
 * WebP sticker.
 *
 * IMPORTANT: cloud-hosted bots (VPS/Pterodactyl IP ranges) are sometimes
 * silently rate-limited/blocked by GIPHY's public beta key — the request
 * succeeds with an empty result instead of throwing. To guarantee this
 * command never comes back empty, any slots GIPHY doesn't fill are topped
 * up with AI-generated sticker-style images (Pollinations, the same
 * provider already used reliably by .wallpaper in this bot), converted to
 * real webp stickers with sharp (also already a project dependency).
 */
'use strict';
const axios = require('axios');
const { spawn } = require('child_process');

const GIPHY_KEY = 'dc6zaTOxFJmzC'; // GIPHY's official public beta key
const WANTED = 5;
const PAGE_SIZE = 25;

let ffmpegPath = null;
try { ffmpegPath = require('ffmpeg-static'); } catch (_) { ffmpegPath = null; }

const UA = { 'User-Agent': 'Mozilla/5.0 (SUKUNA-MD)' };

// ── Pull every http(s) url out of a nested object, with the key path as a hint ──
function collectUrls(node, keyHint, out) {
    if (!node) return;
    if (typeof node === 'string') {
        if (/^https?:\/\//i.test(node)) out.push({ url: node, keyHint: keyHint || '' });
        return;
    }
    if (Array.isArray(node)) { for (const v of node) collectUrls(v, keyHint, out); return; }
    if (typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) collectUrls(v, k, out);
    }
}

// Pick the best media url for a single GIPHY sticker result: prefer native
// webp (no conversion needed), then gif, then mp4 (both need a transcode).
function pickStickerUrl(item) {
    const candidates = [];
    collectUrls(item && item.images, null, candidates);
    if (!candidates.length) return null;

    const byExt = (re) => candidates.find(c => re.test(c.url));
    const webp = byExt(/\.webp(\?|$)/i);
    if (webp) return { url: webp.url, kind: 'webp' };
    const gif = byExt(/\.gif(\?|$)/i);
    if (gif) return { url: gif.url, kind: 'gif' };
    const mp4 = byExt(/\.mp4(\?|$)/i);
    if (mp4) return { url: mp4.url, kind: 'mp4' };
    return null;
}

async function searchGiphy(query, offset, sticker) {
    const kind = sticker ? 'stickers' : 'gifs';
    try {
        const { data, status } = await axios.get(
            `https://api.giphy.com/v1/${kind}/search`,
            {
                params: {
                    q: query,
                    api_key: GIPHY_KEY,
                    limit: PAGE_SIZE,
                    offset: offset || 0,
                },
                timeout: 20000,
                headers: UA,
                validateStatus: () => true,
            }
        );
        if (status !== 200) {
            console.error(`[stickersearch] giphy ${kind} HTTP ${status}:`, JSON.stringify(data).slice(0, 300));
            return [];
        }
        if (!data || !Array.isArray(data.data)) {
            console.error(`[stickersearch] giphy ${kind} unexpected shape:`, JSON.stringify(data).slice(0, 300));
            return [];
        }
        if (!data.data.length) {
            console.log(`[stickersearch] giphy ${kind} returned 0 results for "${query}"`);
        }
        return data.data;
    } catch (e) {
        console.error(`[stickersearch] giphy ${kind} request failed:`, e.message);
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

// Resolve one GIPHY result item into a ready-to-send sticker buffer.
async function resolveSticker(item) {
    const picked = pickStickerUrl(item);
    if (!picked) return null;

    const raw = await downloadBuffer(picked.url);
    if (!raw) return null;

    if (picked.kind === 'webp') return raw; // already a valid sticker
    return await transcodeToWebp(raw); // gif/mp4 → webp
}

// ── Guaranteed last-resort fallback ──────────────────────────────────────
// Some hosts (cloud VPS / Pterodactyl IP ranges) get silently rate-limited
// or blocked by GIPHY's public beta key, which makes the search above
// return zero results with no obvious error. Rather than tell the user
// "no stickers found" in that case, generate sticker-style images with
// Pollinations (same provider already used reliably elsewhere in this
// bot, e.g. .wallpaper) and turn them into real webp stickers with sharp.
let sharpLib = null;
try { sharpLib = require('sharp'); } catch (_) { sharpLib = null; }

async function imageToStickerWebp(buffer) {
    if (!sharpLib) return buffer; // best effort, send raw if sharp missing
    try {
        return await sharpLib(buffer)
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp({ quality: 85 })
            .toBuffer();
    } catch (e) {
        return null;
    }
}

async function aiStickerFallback(query, idx) {
    try {
        const prompt = `${query}, sticker, die-cut sticker, bold outline, vector art, clean background, expressive`;
        const res = await axios.get(
            'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt),
            {
                params: {
                    model: 'flux',
                    width: 512,
                    height: 512,
                    nologo: true,
                    enhance: true,
                    seed: Math.floor(Math.random() * 999999) + idx,
                },
                responseType: 'arraybuffer',
                timeout: 90000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            }
        );
        if (!res.data || res.data.byteLength < 1024) return null;
        return await imageToStickerWebp(Buffer.from(res.data));
    } catch (e) {
        console.error('[stickersearch] AI sticker fallback failed:', e.message);
        return null;
    }
}

async function gatherStickers(query, wanted) {
    const buffers = [];

    // Attempt order: sticker search page 1, sticker search page 2 (only if
    // still short), then a plain GIF search if still short.
    const attempts = [
        { sticker: true, offset: 0 },
        { sticker: true, offset: PAGE_SIZE },
        { sticker: false, offset: 0 },
    ];

    for (const { sticker, offset } of attempts) {
        if (buffers.length >= wanted) break;

        const results = await searchGiphy(query, offset, sticker);
        for (const item of results) {
            if (buffers.length >= wanted) break;
            const buf = await resolveSticker(item);
            if (buf) buffers.push(buf);
        }
    }

    // Top up with AI-generated stickers if GIPHY came up short (or was
    // blocked/rate-limited for this host) — guarantees a non-empty result.
    let idx = 0;
    while (buffers.length < wanted && idx < wanted * 2) {
        const buf = await aiStickerFallback(query, idx++);
        if (buf) buffers.push(buf);
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

        try {
            await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } }).catch(() => {});

            const buffers = await gatherStickers(query, WANTED);

            if (!buffers.length) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply(`❌ No stickers found for *${query}*. Try a different keyword.`);
            }

            for (const buf of buffers) {
                await sock.sendMessage(from, { sticker: buf }, { quoted: msg }).catch(() => {});
            }

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
        } catch (err) {
            console.error('[stickersearch] error:', err.message);
            try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            reply('❌ Sticker search failed. Please try again later.');
        }
    },
};
