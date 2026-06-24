/**
 * TikSearch Command — Search and Download TikTok Videos
 * Usage: .tiksearch <query>
 * Strategy: Uses prexzyvilla search API, then passes direct URL to WhatsApp
 * (same pattern as working .tt command)
 */

'use strict';
const axios = require('axios');

function pickVideoUrl(data) {
    if (!data) return null;
    // Try common field names for video URL from prexzyvilla
    const candidates = [
        data.play, data.hdplay, data.video_url, data.url, 
        data.wmplay, data.no_watermark,
        data.data?.play, data.data?.url, data.data?.video_url,
    ];
    for (const c of candidates) {
        if (typeof c === 'string' && /^https?:\/\//.test(c)) return c;
    }
    return null;
}

function pickMeta(d) {
    const root = d?.data || d?.result || d || {};
    const video = Array.isArray(root) ? root[0] : root;
    
    return {
        title: (video.title || video.desc || 'TikTok Video').substring(0, 100),
        author: video.author?.nickname || video.author?.name || 'Unknown',
        plays: video.play_count || 0,
        likes: video.digg_count || 0,
        duration: video.duration || 0,
    };
}

async function searchTikTok(query) {
    try {
        const url = `https://apis.prexzyvilla.site/search/tiktoksearch?q=${encodeURIComponent(query)}`;
        const res = await axios.get(url, { timeout: 30000, validateStatus: () => true });
        
        if (res.status >= 400 || !res.data?.data || !Array.isArray(res.data.data)) {
            return null;
        }
        
        // Get first video
        const firstVideo = res.data.data[0];
        if (!firstVideo) return null;
        
        const videoUrl = pickVideoUrl(firstVideo);
        if (!videoUrl) return null;
        
        return {
            url: videoUrl,
            meta: pickMeta(res.data.data),
            raw: firstVideo
        };
    } catch (err) {
        console.error('[tiksearch] search error:', err.message);
        return null;
    }
}

module.exports = {
    name: 'tiksearch',
    aliases: ['tiktoksearch', 'tik', 'tikdownload', 'tikvideo'],
    description: 'Search and download TikTok videos',
    category: 'media',
    usage: '.tiksearch <search query>',
    
    async execute({ sock, msg, from, reply, args }) {
        if (!args.length) {
            return reply(
                `🎬 *TikTok Video Search*\n\n` +
                `Usage: .tiksearch <search query>\n` +
                `Example: .tiksearch Sukuna edit\n\n` +
                `I'll find and send you the first matching TikTok video!`
            );
        }

        const query = args.join(' ');
        
        try {
            await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } }).catch(() => {});
            
            // Search for video
            const result = await searchTikTok(query);
            
            if (!result?.url) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply(`❌ No TikTok videos found for "${query}". Try different keywords.`);
            }

            // Send the video with metadata
            await sock.sendMessage(from, {
                video: { url: result.url },
                mimetype: 'video/mp4',
                caption: (
                    `🎬 *${result.meta.title}*\n\n` +
                    `👤 Author: ${result.meta.author}\n` +
                    `⏱️ Duration: ${result.meta.duration}s\n` +
                    `👁️ Views: ${result.meta.plays.toLocaleString()}\n` +
                    `❤️ Likes: ${result.meta.likes.toLocaleString()}\n\n` +
                    `> Downloaded via SUKUNA-MD 🔥`
                ),
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
        } catch (err) {
            console.error('[tiksearch] error:', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
            reply(`❌ Failed to search or download. Try again later.`);
        }
    }
};
