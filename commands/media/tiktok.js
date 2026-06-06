/**
 * TikTok Command — Download TikTok videos (no watermark)
 * Usage: .tt <url>  |  .tiktok <url>
 */

'use strict';
const axios = require('axios');

function pickVideoUrl(d) {
    if (!d) return null;
    const candidates = [
        d.video, d.videoUrl, d.video_url, d.url, d.download_url, d.downloadUrl,
        d.no_watermark, d.nowm, d.play, d.hdplay,
        d.result?.video, d.result?.url, d.result?.no_watermark, d.result?.play,
        d.data?.video, d.data?.url, d.data?.play, d.data?.hdplay, d.data?.nowm,
        d.data?.no_watermark, d.data?.download_url, d.data?.videoUrl,
    ];
    for (const c of candidates) {
        if (typeof c === 'string' && /^https?:\/\//.test(c)) return c;
        if (Array.isArray(c) && c.length && typeof c[0] === 'string') return c[0];
    }
    return null;
}

function pickMeta(d) {
    const root = d?.data || d?.result || d || {};
    return {
        title: root.title || root.desc || root.description || 'TikTok Video',
        author: root.author?.nickname || root.author?.name || root.author || root.username || 'Unknown',
    };
}

async function tryApi(url) {
    const endpoints = [
        `https://apis.prexzyvilla.site/download/tiktokvideo?url=${encodeURIComponent(url)}`,
        `https://apis.prexzyvilla.site/download/tiktok?url=${encodeURIComponent(url)}`,
    ];
    for (const ep of endpoints) {
        try {
            const r = await axios.get(ep, { timeout: 30000 });
            const v = pickVideoUrl(r.data);
            if (v) return { video: v, meta: pickMeta(r.data) };
        } catch (_) { /* try next */ }
    }
    return null;
}

module.exports = {
    name: 'tiktok',
    aliases: ['tt', 'ttdl'],
    description: 'Download TikTok videos without watermark',
    category: 'media',
    async execute({ sock, msg, from, reply, args }) {
        if (!args.length) {
            return reply(
                `🎵 *TikTok Downloader*\n\n` +
                `Usage: .tt <tiktok url>\n` +
                `Example: .tt https://vm.tiktok.com/xxxxx`
            );
        }

        const url = args[0];
        if (!/tiktok\.com|vm\.tiktok|vt\.tiktok/i.test(url)) {
            return reply('❌ Please provide a valid TikTok URL.');
        }

        try {
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            const result = await tryApi(url);
            if (!result?.video) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return reply('❌ Failed to download. Video may be private or URL invalid.');
            }

            await sock.sendMessage(from, {
                video: { url: result.video },
                mimetype: 'video/mp4',
                caption: `🎵 *${result.meta.title}*\n👤 ${result.meta.author}\n\n> SUKUNA MD`,
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.error('[tiktok] error:', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            reply('❌ An error occurred while downloading.');
        }
    }
};
