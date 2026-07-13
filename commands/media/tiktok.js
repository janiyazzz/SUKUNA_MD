/**
 * TikTok Command — Download TikTok videos / image slideshows (no watermark)
 * Usage: .tt <url>  |  .tiktok <url>
 */

'use strict';
const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TIKTOK_RE = /https?:\/\/(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\/[^\s]+/i;

function firstUrl(s) {
    if (!s) return null;
    if (typeof s === 'string' && /^https?:\/\//.test(s)) return s;
    if (Array.isArray(s) && s.length && typeof s[0] === 'string') return s[0];
    return null;
}

/** Normalise a possibly-relative tikwm path into an absolute URL. */
function absUrl(u) {
    if (!u || typeof u !== 'string') return null;
    if (/^https?:\/\//.test(u)) return u;
    if (u.startsWith('/')) return `https://www.tikwm.com${u}`;
    return null;
}

/* ── Primary: tikwm (reliable, returns no-watermark video + slideshows) ── */
async function fromTikwm(url) {
    const r = await axios.get('https://www.tikwm.com/api/', {
        params: { url, hd: 1 },
        timeout: 30000,
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        validateStatus: () => true,
    });
    const d = r.data?.data;
    if (!d) return null;

    const meta = {
        title:  d.title || 'TikTok',
        author: d.author?.nickname || d.author?.unique_id || 'Unknown',
        music:  absUrl(d.music) || null,
    };

    // Image slideshow post
    if (Array.isArray(d.images) && d.images.length) {
        return { images: d.images.map(absUrl).filter(Boolean), meta };
    }

    const video = absUrl(d.hdplay) || absUrl(d.play) || absUrl(d.wmplay);
    if (video) return { video, meta };
    return null;
}

/* ── Fallback: prexzyvilla endpoints ── */
async function fromPrexzy(url) {
    const endpoints = [
        `https://apis.prexzyvilla.site/download/tiktokvideo?url=${encodeURIComponent(url)}`,
        `https://apis.prexzyvilla.site/download/tiktok?url=${encodeURIComponent(url)}`,
    ];
    for (const ep of endpoints) {
        try {
            const r = await axios.get(ep, {
                timeout: 30000,
                headers: { 'User-Agent': UA },
                validateStatus: () => true,
            });
            const d = r.data || {};
            const root = d.data || d.result || d;
            const video = firstUrl(root.no_watermark) || firstUrl(root.nowm) ||
                          firstUrl(root.hdplay) || firstUrl(root.play) ||
                          firstUrl(root.video) || firstUrl(root.url) ||
                          firstUrl(root.download_url) || firstUrl(root.videoUrl);
            if (video) {
                return {
                    video,
                    meta: {
                        title:  root.title || root.desc || 'TikTok',
                        author: root.author?.nickname || root.author || root.username || 'Unknown',
                    },
                };
            }
        } catch (_) { /* try next */ }
    }
    return null;
}

async function resolve(url) {
    // Try each source in order; never throw — return null on total failure.
    for (const fn of [fromTikwm, fromPrexzy]) {
        try {
            const out = await fn(url);
            if (out && (out.video || (out.images && out.images.length))) return out;
        } catch (_) { /* next source */ }
    }
    return null;
}

module.exports = {
    name: 'tiktok',
    aliases: ['tt', 'ttdl'],
    description: 'Download TikTok videos / slideshows without watermark',
    category: 'media',
    async execute({ sock, msg, from, reply, args }) {
        const input = (args || []).join(' ').trim();
        if (!input) {
            return reply(
                `🎵 *TikTok Downloader*\n\n` +
                `Usage: .tt <tiktok url>\n` +
                `Example: .tt https://vm.tiktok.com/xxxxx`
            );
        }

        const match = input.match(TIKTOK_RE);
        const url = match ? match[0] : null;
        if (!url) {
            return reply('❌ Please provide a valid TikTok URL.');
        }

        try {
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } }).catch(() => {});

            const result = await resolve(url);
            if (!result) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply('❌ Failed to download. The video may be private, removed, or the URL is invalid.');
            }

            const { meta } = result;
            const cap = `🎵 *${meta.title}*\n👤 ${meta.author}\n\n> SUKUNA MD`;

            // Image slideshow → send each image
            if (result.images && result.images.length) {
                for (let i = 0; i < result.images.length; i++) {
                    await sock.sendMessage(from, {
                        image:   { url: result.images[i] },
                        caption: i === 0 ? cap : undefined,
                    }, { quoted: msg }).catch(() => {});
                }
                if (meta.music) {
                    await sock.sendMessage(from, {
                        audio:    { url: meta.music },
                        mimetype: 'audio/mpeg',
                    }, { quoted: msg }).catch(() => {});
                }
                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
                return;
            }

            // Standard video
            await sock.sendMessage(from, {
                video:    { url: result.video },
                mimetype: 'video/mp4',
                caption:  cap,
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
        } catch (err) {
            console.error('[tiktok] error:', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
            reply('❌ An error occurred while downloading.');
        }
    }
};
