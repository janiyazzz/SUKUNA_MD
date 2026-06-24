/**
 * TikSearch Command — Search and Download TikTok Videos
 * Usage: .tiksearch <query>
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

function searchTikTok(query) {
    return new Promise((resolve, reject) => {
        const url = `https://apis.prexzyvilla.site/search/tiktoksearch?q=${encodeURIComponent(query)}`;
        https.get(url, { timeout: 30000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    
                    // Defensive parsing: ensure we have valid response structure
                    if (json && typeof json === 'object') {
                        // Check for status and data array
                        if (json.status === true && json.data && Array.isArray(json.data)) {
                            if (json.data.length > 0) {
                                resolve(json.data);
                                return;
                            }
                        }
                    }
                    
                    reject(new Error('No videos found or invalid response format'));
                } catch (e) {
                    reject(new Error(`Failed to parse TikTok search response: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

function downloadVideo(videoUrl) {
    return new Promise((resolve, reject) => {
        https.get(videoUrl, { timeout: 60000 }, (res) => {
            // Check for redirect or error status
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Follow redirect
                return downloadVideo(res.headers.location).then(resolve).catch(reject);
            }
            
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download video: HTTP ${res.statusCode}`));
                return;
            }
            
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
        }).on('error', reject);
    });
}

module.exports = {
    name: 'tiksearch',
    aliases: ['tiktoksearch', 'tik', 'tikdownload'],
    description: 'Search and download TikTok videos',
    category: 'media',
    async execute({ reply, args, client, m }) {
        if (!args.length) {
            return reply(
                `🎬 *TikTok Video Search & Download*\n\n` +
                `Usage: .tiksearch <search query>\n` +
                `Example: .tiksearch Sukuna edit\n\n` +
                `I'll find and send you the first matching TikTok video!`
            );
        }

        const query = args.join(' ');
        
        try {
            await reply(`🔍 *Searching TikTok for:* "${query}"\n⏳ Please wait...`);
            
            // Search for videos
            const videos = await searchTikTok(query);
            
            if (!videos || videos.length === 0) {
                return reply(`❌ No TikTok videos found for "${query}". Try a different search term.`);
            }
            
            // Get the first video (highest engagement)
            const video = videos[0];
            
            // Validate video object has required fields
            if (!video.play || !video.title || !video.cover) {
                return reply(`❌ Video data incomplete. Please try again.`);
            }
            
            await reply(
                `📥 *Downloading video...*\n` +
                `Title: ${video.title}\n` +
                `Duration: ${video.duration}s\n⏳ Processing...`
            );
            
            // Download the video
            const videoBuffer = await downloadVideo(video.play);
            
            if (!videoBuffer || videoBuffer.length === 0) {
                return reply(`❌ Failed to download video. Video may be unavailable or region-restricted.`);
            }
            
            // Prepare metadata
            const videoInfo = {
                title: video.title.substring(0, 50), // Limit title length
                duration: video.duration,
                author: video.author?.nickname || 'Unknown',
                plays: video.play_count || 0,
                likes: video.digg_count || 0
            };
            
            // Send the video
            await client.sendMessage(m.chat, {
                video: videoBuffer,
                caption: (
                    `🎬 *${videoInfo.title}*\n\n` +
                    `👤 Author: ${videoInfo.author}\n` +
                    `⏱️ Duration: ${videoInfo.duration}s\n` +
                    `👁️ Views: ${videoInfo.plays.toLocaleString()}\n` +
                    `❤️ Likes: ${videoInfo.likes.toLocaleString()}\n\n` +
                    `Downloaded via SUKUNA-MD TikTok Search 🔥`
                ),
                mimetype: 'video/mp4'
            });
            
            // Success confirmation
            await reply(`✅ *Video sent successfully!* 🎉`);
            
        } catch (err) {
            // Detailed error handling
            let errorMsg = '❌ Error: ';
            
            if (err.message.includes('No videos found')) {
                errorMsg += `No videos found for "${query}". Try different keywords.`;
            } else if (err.message.includes('region-restricted')) {
                errorMsg += 'Video is region-restricted and cannot be downloaded.';
            } else if (err.message.includes('timeout')) {
                errorMsg += 'Request timed out. Please try again.';
            } else if (err.message.includes('HTTP')) {
                errorMsg += 'Failed to download video. It may be unavailable.';
            } else {
                errorMsg += err.message || 'Unknown error occurred. Please try again later.';
            }
            
            reply(errorMsg);
        }
    }
};
