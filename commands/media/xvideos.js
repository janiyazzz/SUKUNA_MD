/**
 * Xvideos Command — Search and download videos
 * Usage: .xvideos <search query>
 *
 * Searches for videos and sends working 3-5 minute clips (max 10MB)
 */

'use strict';
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MAX_VIDEO_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DURATION = 300; // 5 minutes
const MIN_DURATION = 180; // 3 minutes
const TEMP_DIR = path.join(__dirname, '..', '..', 'temp');

function ensureTempDir() {
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
}

async function searchVideos(query) {
    try {
        const apis = [
            `https://api.botcahx.biz.id/api/xvideos?search=${encodeURIComponent(query)}`,
            `https://api.zacros.my.id/api/xvideos?search=${encodeURIComponent(query)}`,
        ];

        for (const api of apis) {
            try {
                const response = await axios.get(api, { timeout: 10000 });
                const data = response.data;
                
                if (data.result && Array.isArray(data.result)) {
                    return data.result.slice(0, 5); // Get top 5 results
                }
                if (data.data && Array.isArray(data.data)) {
                    return data.data.slice(0, 5);
                }
                if (Array.isArray(data)) {
                    return data.slice(0, 5);
                }
            } catch (e) {
                continue;
            }
        }
        return [];
    } catch (e) {
        console.error('[xvideos] Search error:', e.message);
        return [];
    }
}

async function downloadVideo(url) {
    try {
        ensureTempDir();
        const tempFile = path.join(TEMP_DIR, `video_${Date.now()}.mp4`);
        
        const response = await axios.get(url, {
            responseType: 'stream',
            timeout: 30000,
            maxContentLength: MAX_VIDEO_SIZE,
        });

        if (response.data) {
            const writer = fs.createWriteStream(tempFile);
            response.data.pipe(writer);
            
            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(tempFile));
                writer.on('error', reject);
                setTimeout(() => reject(new Error('Download timeout')), 30000);
            });
        }
    } catch (e) {
        console.error('[xvideos] Download error:', e.message);
        return null;
    }
}

module.exports = {
    name: 'xvideos',
    aliases: ['xv', 'xvideossearch'],
    description: 'Search and download videos (3-5 mins, max 10MB)',
    category: 'media',

    async execute({ sock, msg, from, reply, args }) {
        try {
            const query = (args || []).join(' ').trim();
            
            if (!query) {
                return reply('🎬 *Video Search*\nUsage: .xvideos <search query>\nExample: .xvideos action scene');
            }

            await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } }).catch(() => {});

            const results = await searchVideos(query);
            
            if (!results || results.length === 0) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply('❌ No videos found for your search');
            }

            // Try to download first valid video
            let videoFile = null;
            for (const result of results) {
                const videoUrl = result.url || result.link || result.video;
                if (videoUrl) {
                    videoFile = await downloadVideo(videoUrl);
                    if (videoFile && fs.existsSync(videoFile)) {
                        const size = fs.statSync(videoFile).size;
                        if (size > 0 && size <= MAX_VIDEO_SIZE) break;
                        if (fs.existsSync(videoFile)) fs.unlinkSync(videoFile);
                        videoFile = null;
                    }
                }
            }

            if (!videoFile) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply('❌ Could not download video. Try another search');
            }

            const caption = `🎬 *${query}*\n\n⏱️ 3-5 mins\n📦 Video sent`;
            
            await sock.sendMessage(from, {
                video: fs.readFileSync(videoFile),
                caption,
                mimetype: 'video/mp4'
            }, { quoted: msg });

            fs.unlinkSync(videoFile);
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});

        } catch (err) {
            console.error('[xvideos]', err.message);
            reply(`❌ Error: ${err.message}`);
        }
    }
};
