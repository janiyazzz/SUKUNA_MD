/**
 * YouTube Command — Search OR download YouTube videos
 * Usage:
 *   .yt <search query>     → search results
 *   .yt <youtube url>      → download video
 */

'use strict';
const axios = require('axios');
const https = require('https');

const YT_URL_RE = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i;

function pickVideoUrl(d) {
    if (!d) return null;
    const cands = [
        d.video, d.videoUrl, d.video_url, d.url, d.download_url, d.downloadUrl,
        d.mp4, d.hd, d.sd, d.link,
        d.result?.video, d.result?.url, d.result?.download_url, d.result?.mp4,
        d.data?.video, d.data?.url, d.data?.download_url, d.data?.mp4,
        d.data?.videoUrl,
    ];
    for (const c of cands) {
        if (typeof c === 'string' && /^https?:\/\//.test(c)) return c;
        if (Array.isArray(c) && c.length && typeof c[0] === 'string' && /^https?:\/\//.test(c[0])) return c[0];
    }
    // formats array
    const fmts = d.formats || d.result?.formats || d.data?.formats;
    if (Array.isArray(fmts)) {
        const v = fmts.find(f => (f.type === 'video' || /mp4/i.test(f.format || f.mimetype || ''))) || fmts[0];
        if (v && typeof v.url === 'string') return v.url;
    }
    return null;
}

async function downloadYt(url) {
    const ep = `https://apis.prexzyvilla.site/download/youtube-video?url=${encodeURIComponent(url)}`;
    const r = await axios.get(ep, { timeout: 60000 });
    const root = r.data?.data || r.data?.result || r.data || {};
    return {
        video: pickVideoUrl(r.data),
        title: root.title || root.name || 'YouTube Video',
        author: root.author || root.channel || root.uploader || '',
        duration: root.duration || root.length || '',
        thumbnail: root.thumbnail || root.image || root.thumb || '',
    };
}

function searchYouTube(query) {
    return new Promise((resolve, reject) => {
        const url = `https://vid.puffyan.us/api/v1/search?q=${encodeURIComponent(query)}`;
        https.get(url, { timeout: 10000 }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data).slice(0, 5)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

module.exports = {
    name: 'youtube',
    aliases: ['yt', 'ytv', 'ytmp4', 'ytdl'],
    description: 'Search or download YouTube videos',
    category: 'media',
    async execute({ sock, msg, from, reply, args }) {
        if (!args.length) {
            return reply(
                `📺 *YouTube*\n\n` +
                `Usage:\n` +
                `  .yt <youtube url>   → download video\n` +
                `  .yt <search query>  → search`
            );
        }

        const input = args.join(' ').trim();

        if (YT_URL_RE.test(input)) {
            try {
                await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });
                const r = await downloadYt(input);
                if (!r.video) {
                    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                    return reply('❌ Could not extract video. Try another URL.');
                }
                await sock.sendMessage(from, {
                    video: { url: r.video },
                    mimetype: 'video/mp4',
                    caption: `📺 *${r.title}*${r.author ? `\n👤 ${r.author}` : ''}${r.duration ? `\n⏱️ ${r.duration}` : ''}\n\n> SUKUNA MD`,
                }, { quoted: msg });
                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
            } catch (err) {
                console.error('[yt] download error:', err.message);
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                reply('❌ Download failed. Please try again.');
            }
            return;
        }

        try {
            await reply(`🔍 Searching YouTube for: *${input}*...`);
            const results = await searchYouTube(input);
            if (!results?.length) return reply('❌ No results found.');

            let response = `📺 *YouTube Results*\n\n`;
            results.forEach((video, i) => {
                const title = video.title || 'Unknown';
                const author = video.author || 'Unknown';
                const views = video.viewCount ? `👁️ ${(video.viewCount / 1000).toFixed(1)}K` : '';
                const dur = video.lengthSeconds ? `⏱️ ${Math.floor(video.lengthSeconds / 60)}:${(video.lengthSeconds % 60).toString().padStart(2,'0')}` : '';
                response += `${i+1}. *${title}*\n   👤 ${author} ${views} ${dur}\n   🔗 https://youtube.com/watch?v=${video.videoId}\n\n`;
            });
            reply(response);
        } catch (err) {
            reply('❌ Failed to search YouTube. Please try again.');
        }
    }
};
