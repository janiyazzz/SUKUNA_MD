/**
 * nsfwFetch — shared helper for NSFW media endpoints.
 *
 * Resilience: the original single provider (prexzyvilla) is frequently down,
 * so we now try a CHAIN of endpoints per category and use the first that
 * returns a usable media URL. All keyless mirrors (nekobot, waifu.pics) need
 * no API key. If every provider fails, callers fail gracefully.
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

async function fetchFromEndpoint(endpoint, { timeout = 20000 } = {}) {
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

/**
 * Try each endpoint in order (accepts a single string or an array) and return
 * the first usable media. Throws only if ALL candidates fail.
 */
async function fetchMedia(endpoints, opts) {
    const list = Array.isArray(endpoints) ? endpoints : [endpoints];
    let lastErr = new Error('No endpoints provided');
    for (const ep of list) {
        if (!ep) continue;
        try {
            return await fetchFromEndpoint(ep, opts);
        } catch (e) {
            lastErr = e;
        }
    }
    throw lastErr;
}

// Map a category to keyless mirror endpoints that support it.
// nekobot.xyz covers most NSFW categories; waifu.pics covers a few.
const NEKOBOT_TYPES = new Set([
    'hass', 'hmidriff', '4k', 'hentai', 'hneko', 'hkitsune', 'kemonomimi',
    'anal', 'hanal', 'gonewild', 'ass', 'pussy', 'thigh', 'hthigh',
    'paizuri', 'tentacle', 'boobs', 'hboobs', 'yaoi', 'cum', 'blowjob', 'feet',
]);
const WAIFU_TYPES = new Set(['waifu', 'neko', 'trap', 'blowjob']);

// Aliases so callers' labels line up with mirror category names.
const CATEGORY_ALIASES = {
    tits: 'boobs', boobs: 'boobs', ass: 'ass', pussy: 'pussy',
    fuck: 'anal', sixtynine: 'blowjob', cum: 'cum', bj: 'blowjob',
};

function mirrorsFor(category) {
    if (!category) return [];
    const c = CATEGORY_ALIASES[category] || category;
    const out = [];
    if (NEKOBOT_TYPES.has(c)) out.push(`https://nekobot.xyz/api/image?type=${c}`);
    if (WAIFU_TYPES.has(c)) out.push(`https://api.waifu.pics/nsfw/${c}`);
    return out;
}

// Derive the category slug from a prexzyvilla-style endpoint URL tail.
function categoryFromEndpoint(endpoint) {
    if (!endpoint || typeof endpoint !== 'string') return '';
    const m = endpoint.match(/\/([a-z0-9]+)\/?(?:\?|$)/i);
    return m ? m[1].toLowerCase() : '';
}

function makeNsfwCommand({ name, aliases = [], endpoint, category, emoji = '🔞', label }) {
    const title = label || name.toUpperCase();
    const cat = (category || categoryFromEndpoint(endpoint) || name).toLowerCase();
    // Build the resilient endpoint chain: original first, then keyless mirrors.
    const endpoints = [endpoint, ...mirrorsFor(cat)].filter(Boolean);

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
                const { url, isVideo } = await fetchMedia(endpoints);
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
                reply(`❌ ${title} is temporarily unavailable (all providers down). Try again later.`);
            }
        },
    };
}

module.exports = { fetchMedia, makeNsfwCommand, mirrorsFor };
