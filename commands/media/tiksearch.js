/**
 * TikSearch Command — Search TikTok and send the video
 * Usage: .tiksearch <query>
 *
 * Uses https://apis.prexzyvilla.site/search/tiktoksearch?q= (confirmed
 * working live — returns { status, data: [ {..., play, title, author,
 * duration, play_count, digg_count}, ... ] }).
 *
 * The `.play` URL it returns points at tikwm.com, which 400s on a bare
 * request with no User-Agent (confirmed live). Baileys' `{ video: { url } }`
 * shorthand lets Baileys fetch the URL itself with no custom headers, which
 * hits that same 400 — this is what was causing "Failed to download video."
 *
 * Fix: download the video as a Buffer ourselves with browser-like headers
 * (the same axios + arraybuffer + User-Agent pattern already used and
 * working in commands/media/play.js), then hand Baileys the Buffer instead
 * of the URL. This also means WhatsApp gets a fully-loaded file with a
 * known size up front, which avoids playback/buffering issues on the
 * recipient's end compared to streaming a URL Baileys has to fetch itself.
 */
'use strict';
const axios = require('axios');

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Referer': 'https://www.tiktok.com/',
};

function pickVideo(item) {
    if (!item) return null;
    const url = item.play || item.hdplay || item.wmplay;
    if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return null;
    return {
        url,
        title: (item.title || 'TikTok Video').slice(0, 100),
        author: item.author?.nickname || item.author?.unique_id || 'Unknown',
        duration: item.duration || 0,
        plays: item.play_count || 0,
        likes: item.digg_count || 0,
    };
}

async function searchTikTok(query) {
    const res = await axios.get('https://apis.prexzyvilla.site/search/tiktoksearch', {
        params: { q: query },
        timeout: 30000,
        validateStatus: () => true,
    });

    if (res.status >= 400 || !res.data?.data?.length) return null;

    // Walk results until we find one with a usable video URL.
    for (const item of res.data.data) {
        const v = pickVideo(item);
        if (v) return v;
    }
    return null;
}

async function downloadVideoBuffer(url) {
    // tikwm.com (where .play points) rejects bare requests with a 400 —
    // confirmed live — so we always send browser-like headers.
    const candidates = [url, url.replace('https://tikwm.com', 'https://www.tikwm.com')];

    for (const candidateUrl of candidates) {
        try {
            const res = await axios.get(candidateUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: 64 * 1024 * 1024,
                headers: BROWSER_HEADERS,
                validateStatus: () => true,
            });
            if (res.status === 200 && res.data?.length) {
                return Buffer.from(res.data);
            }
        } catch (_) {
            // try next candidate
        }
    }
    return null;
}

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

        const query = args.join(' ');

        try {
            await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } }).catch(() => {});

            const result = await searchTikTok(query);
            if (!result) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply(`❌ No TikTok videos found for "${query}". Try different keywords.`);
            }

            await sock.sendMessage(from, { react: { text: '⬇️', key: msg.key } }).catch(() => {});

            const buffer = await downloadVideoBuffer(result.url);
            if (!buffer) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply(`❌ Found the video but couldn't download it. Try again, or try a different search.`);
            }

            await sock.sendMessage(from, {
                video: buffer,
                mimetype: 'video/mp4',
                caption: (
                    `🎬 *${result.title}*\n\n` +
                    `👤 ${result.author}\n` +
                    `⏱️ ${result.duration}s   👁️ ${result.plays.toLocaleString()}   ❤️ ${result.likes.toLocaleString()}\n\n` +
                    `> SUKUNA-MD 🔥`
                ),
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
        } catch (err) {
            console.error('[tiksearch] error:', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
            reply('❌ Something went wrong searching or sending the video. Try again later.');
        }
    },
};
