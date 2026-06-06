/**
 * nsfwFetch — shared helper for prexzyvilla NSFW endpoints.
 * Calls the endpoint, walks the response, returns the first usable media URL.
 */
'use strict';
const axios = require('axios');

const IMG_RE = /\.(jpe?g|png|gif|webp|bmp)(\?|$)/i;
const VID_RE = /\.(mp4|webm|mov|m4v)(\?|$)/i;
const URL_RE = /^https?:\/\//i;

function walk(node, out) {
    if (!node) return;
    if (typeof node === 'string') {
        if (URL_RE.test(node) && (IMG_RE.test(node) || VID_RE.test(node))) out.push(node);
        return;
    }
    if (Array.isArray(node)) { for (const v of node) walk(v, out); return; }
    if (typeof node === 'object') { for (const v of Object.values(node)) walk(v, out); }
}

async function fetchMedia(endpoint, { timeout = 20000 } = {}) {
    const r = await axios.get(endpoint, {
        timeout,
        headers: { 'User-Agent': 'Mozilla/5.0 (SUKUNA-MD)' },
        validateStatus: () => true,
    });
    if (r.status >= 400) throw new Error(`API ${r.status}`);
    const urls = [];
    walk(r.data, urls);
    if (!urls.length) throw new Error('No media URL in response');
    const url = urls[0];
    return { url, isVideo: VID_RE.test(url) };
}

function makeNsfwCommand({ name, aliases = [], endpoint, emoji = '🔞', label }) {
    const title = label || name.toUpperCase();
    return {
        name,
        aliases,
        description: `${title} (18+) — random NSFW media`,
        category: '18plus',
        nsfw: true,
        async execute({ sock, msg, from, reply, args }) {
            if (args[0] === 'help' || args[0] === '?') {
                return reply(
                    `${emoji} *${title}* (18+)\n\n` +
                    `Usage: .${name}\n` +
                    `Sends a random ${title.toLowerCase()} NSFW media.\n\n` +
                    `⚠️ For 18+ chats only.`
                );
            }
            try {
                await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });
                const { url, isVideo } = await fetchMedia(endpoint);
                const caption = `${emoji} *${title}*\n\n> SUKUNA MD • 18+`;
                if (isVideo) {
                    await sock.sendMessage(from, { video: { url }, mimetype: 'video/mp4', caption }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { image: { url }, caption }, { quoted: msg });
                }
                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
            } catch (err) {
                console.error(`[${name}] error:`, err.message);
                try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch {}
                reply(`❌ ${title} fetch failed. Try again later.`);
            }
        },
    };
}

module.exports = { fetchMedia, makeNsfwCommand };
