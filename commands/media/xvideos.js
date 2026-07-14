/**
 * Video Download Command
 * Usage: .xvideos <search query>
 *
 * Searches and downloads videos, sends as actual media files to WhatsApp
 */

'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const MAX_VIDEO_SIZE = 10 * 1024 * 1024; // 10MB
const TEMP_DIR = path.join(__dirname, '..', '..', 'temp');

function ensureTempDir() {
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
}

// Download video from URL using multiple service providers
async function downloadVideoFromUrl(videoUrl) {
    const providers = [
        // Provider 1: Use cobalt.tools API (extremely reliable for YouTube)
        async (url) => {
            try {
                const response = await axios.post('https://api.cobalt.tools/api/json', 
                    { url: url, vcodec: 'h264', vquality: 'medium', aformat: 'best' },
                    { timeout: 30000, responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } }
                );
                return response.data;
            } catch (e) {
                throw e;
            }
        },
        // Provider 2: Use savefrom.net approach
        async (url) => {
            try {
                const response = await axios.get(`https://savefrom.net/api/info?url=${encodeURIComponent(url)}`,
                    { timeout: 30000, responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } }
                );
                return response.data;
            } catch (e) {
                throw e;
            }
        },
        // Provider 3: Direct YouTube stream fetch
        async (url) => {
            try {
                // Get video info and stream directly
                const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
                if (!videoId) throw new Error('Invalid YouTube URL');
                
                const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`,
                    { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } }
                );
                
                // Return the video for streaming
                const streamUrl = response.data.match(/https:\/\/[^"]*\.mp4[^"]*/)?.[0];
                if (streamUrl) {
                    const stream = await axios.get(streamUrl, { responseType: 'arraybuffer', timeout: 30000 });
                    return stream.data;
                }
                throw new Error('Could not extract stream');
            } catch (e) {
                throw e;
            }
        }
    ];

    for (let i = 0; i < providers.length; i++) {
        try {
            console.log(`[xvideos] Trying download provider ${i + 1}...`);
            const data = await providers[i](videoUrl);
            
            if (data && data.length > 1000) {
                console.log(`[xvideos] Download successful with provider ${i + 1} (${(data.length / 1024 / 1024).toFixed(2)}MB)`);
                return data;
            }
        } catch (e) {
            console.log(`[xvideos] Provider ${i + 1} failed: ${e.message}`);
        }
    }

    throw new Error('All video download providers failed');
}

// Search for videos
async function searchVideos(query) {
    try {
        // Use Invidious API to search YouTube
        const response = await axios.get('https://invidious.snopyta.org/api/v1/search', {
            params: { q: query, type: 'video', sort_by: 'relevance' },
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (response.data && Array.isArray(response.data)) {
            return response.data.slice(0, 3).map(v => ({
                videoId: v.videoId,
                title: v.title,
                duration: v.lengthSeconds,
                author: v.author,
                url: `https://www.youtube.com/watch?v=${v.videoId}`
            }));
        }
        throw new Error('No results found');
    } catch (err) {
        console.error('[xvideos] Search error:', err.message);
        throw err;
    }
}

module.exports = {
    name: 'xvideos',
    aliases: ['video', 'yt', 'youtube', 'search'],
    description: 'Download and send videos from search',
    category: 'media',

    async execute({ sock, msg, from, reply, args, isGroup }) {
        if (!args.length) {
            return reply('🎬 *Video Search & Download*\n\nUsage: `.xvideos <search query>`\n\nExample: `.xvideos cute cat`');
        }

        const query = args.join(' ').trim();

        try {
            // React with loading
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            // Search for video
            console.log(`[xvideos] Searching for: ${query}`);
            const results = await searchVideos(query);

            if (!results || results.length === 0) {
                return reply('❌ No videos found. Try a different search.');
            }

            const video = results[0];
            console.log(`[xvideos] Found video: ${video.title}`);

            // Download the video
            console.log(`[xvideos] Downloading: ${video.url}`);
            const videoBuffer = await downloadVideoFromUrl(video.url);

            // Check file size
            if (videoBuffer.length > MAX_VIDEO_SIZE) {
                return reply(`❌ Video too large (${(videoBuffer.length / 1024 / 1024).toFixed(2)}MB). Max 10MB.`);
            }

            // Save temporarily and send
            ensureTempDir();
            const filename = `video_${Date.now()}.mp4`;
            const filepath = path.join(TEMP_DIR, filename);

            fs.writeFileSync(filepath, videoBuffer);

            // Send video
            await sock.sendMessage(from, {
                video: fs.readFileSync(filepath),
                mimetype: 'video/mp4',
                caption: `🎬 *${video.title}*\n⏱️ Duration: ${video.duration}s\n👤 Author: ${video.author}\n\n> SUKUNA MD`
            }, { quoted: msg });

            // Clean up
            try { fs.unlinkSync(filepath); } catch (_) {}

            // Success reaction
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('[xvideos] Error:', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            reply(`❌ Video download failed: ${err.message}`);
        }
    }
};
