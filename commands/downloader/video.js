'use strict';

const yts = require('yt-search');
const axios = require('axios');

module.exports = {
    name: 'video',
    aliases: ['ytvideo', 'ytv'],
    category: 'downloader',
    desc: 'Download YouTube video',
    
    execute: async (context) => {
        const { sock, msg, from, args, reply } = context;
        
        try {
            const query = args.join(' ').trim();
            
            if (!query) {
                return reply('Provide video name\n.video Alan Walker Lily');
            }

            // Search for video
            await sock.sendMessage(from, { react: { text: '🔎', key: msg.key } }).catch(() => {});

            let videos = [];
            try {
                const result = await yts(query);
                videos = result.videos || [];
            } catch (err) {
                console.error('[yts search]', err.message);
                return reply('Search failed');
            }

            if (!videos.length) {
                await sock.sendMessage(from, { react: { text: '😕', key: msg.key } }).catch(() => {});
                return reply('No video found');
            }

            const vid = videos[0];

            // Download indicator
            await sock.sendMessage(from, { react: { text: '⬇️', key: msg.key } }).catch(() => {});

            // Send video info
            let caption = `🎬 ${vid.title}\n\n`;
            caption += `⏱️ Duration: ${vid.timestamp}\n`;
            caption += `👁️ Views: ${vid.views}\n`;
            caption += `📢 Channel: ${vid.author.name}\n\n`;
            caption += `⏳ Downloading...`;

            await sock.sendMessage(from, {
                image: { url: vid.thumbnail },
                caption: caption
            }, { quoted: msg }).catch(() => {});

            // Get download URL from API
            let videoData = null;
            try {
                const apiUrl = `https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(vid.url)}`;
                const res = await axios.get(apiUrl, {
                    headers: { Accept: 'application/json' },
                    timeout: 30000
                });
                videoData = res.data;
            } catch (err) {
                console.error('[video download api]', err.message);
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply('Download API failed');
            }

            // Get best quality video
            let videoUrl = null;
            if (videoData?.videos) {
                videoUrl = videoData.videos['720'] || 
                           videoData.videos['480'] || 
                           videoData.videos['360'] || 
                           Object.values(videoData.videos)[0];
            }

            if (!videoUrl) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply('Cannot find video stream');
            }

            // Download video buffer
            await sock.sendMessage(from, { react: { text: '📥', key: msg.key } }).catch(() => {});

            let videoBuffer = null;
            try {
                const bufferRes = await axios.get(videoUrl, {
                    responseType: 'arraybuffer',
                    timeout: 60000,
                    maxContentLength: 100 * 1024 * 1024
                });
                videoBuffer = bufferRes.data;
            } catch (err) {
                console.error('[video buffer]', err.message);
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply('Download failed');
            }

            if (!videoBuffer || videoBuffer.length === 0) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply('Empty video file');
            }

            // Send video
            await sock.sendMessage(from, { react: { text: '📤', key: msg.key } }).catch(() => {});

            await sock.sendMessage(from, {
                video: videoBuffer,
                mimetype: 'video/mp4',
                caption: `🎬 ${vid.title}\n⏱️ ${vid.timestamp}`
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});

        } catch (err) {
            console.error('[video command]', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
            reply('Video download error');
        }
    }
};
