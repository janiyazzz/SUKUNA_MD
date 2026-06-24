/**
 * TikSearch Command — Search and Download TikTok Videos
 * Usage: .tiksearch <query>
 * 
 * Works with multiple fallback APIs for reliability
 */

'use strict';
const axios = require('axios');

function pickVideoUrl(video) {
    if (!video) return null;
    // Try play URL first (no watermark)
    const urls = [video.play, video.hdplay, video.wmplay];
    for (const url of urls) {
        if (typeof url === 'string' && url.startsWith('http')) {
            return url;
        }
    }
    return null;
}

async function searchTikTok(query) {
    const endpoints = [
        // Primary
        `https://apis.prexzyvilla.site/search/tiktoksearch?q=${encodeURIComponent(query)}`,
        // Fallback
        `https://tikwm.com/api/search?search=${encodeURIComponent(query)}&type=video`,
    ];

    for (const endpoint of endpoints) {
        try {
            const res = await axios.get(endpoint, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                validateStatus: () => true
            });

            if (res.status >= 400) continue;
            if (!res.data) continue;

            // Try prexzyvilla format
            if (res.data.data && Array.isArray(res.data.data) && res.data.data[0]) {
                const video = res.data.data[0];
                const videoUrl = pickVideoUrl(video);
                if (videoUrl) {
                    return {
                        url: videoUrl,
                        title: video.title?.substring(0, 100) || 'TikTok Video',
                        author: video.author?.nickname || 'Unknown',
                        duration: video.duration || 0,
                        plays: video.play_count || 0,
                        likes: video.digg_count || 0,
                    };
                }
            }

            // Try tikwm format
            if (res.data.data && res.data.data[0]) {
                const video = res.data.data[0];
                if (video.play) {
                    return {
                        url: video.play,
                        title: video.title?.substring(0, 100) || 'TikTok Video',
                        author: video.author?.nickname || 'Unknown',
                        duration: video.duration || 0,
                        plays: video.play_count || 0,
                        likes: video.digg_count || 0,
                    };
                }
            }
        } catch (err) {
            // Continue to next endpoint
            continue;
        }
    }

    return null;
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

            reply(`🔍 *Searching TikTok for:* "${query}"\n⏳ Please wait...`);

            const result = await searchTikTok(query);

            if (!result?.url) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply(`❌ No TikTok videos found for "${query}". Try different keywords.`);
            }

            // Send video
            await sock.sendMessage(from, {
                video: { url: result.url },
                mimetype: 'video/mp4',
                caption: (
                    `🎬 *${result.title}*\n\n` +
                    `👤 Author: ${result.author}\n` +
                    `⏱️ Duration: ${result.duration}s\n` +
                    `👁️ Views: ${result.plays.toLocaleString()}\n` +
                    `❤️ Likes: ${result.likes.toLocaleString()}\n\n` +
                    `> Downloaded via SUKUNA-MD 🔥`
                ),
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
        } catch (err) {
            console.error('[tiksearch] error:', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
            reply(`❌ Failed to search or download video. Try again.`);
        }
    }
};
