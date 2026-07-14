/**
 * Xvideos Command — NSFW video search & download
 * Usage: .xv <search query>
 *
 * Searches for videos and automatically downloads and sends a working video
 * (3-5 mins, max 5 mins) with proper error handling and size limits (10MB max).
 */

'use strict';
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const XV_URL_RE = /xvideos\.com\//i;
const MAX_VIDEO_SIZE = 10 * 1024 * 1024; // 10MB max
const MAX_DURATION = 300; // 5 minutes in seconds
const MIN_DURATION = 180; // 3 minutes in seconds
const TEMP_DIR = path.join(__dirname, '..', '..', 'temp');

// Ensure temp directory exists
function ensureTempDir() {
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
}

function pickMp4(files) {
    if (!files || typeof files !== 'object') return null;
    const candidates = [files.high, files.hd, files.HD, files.low, files.sd, files.SD, files.mp4];
    for (const c of candidates) {
        if (typeof c === 'string' && c.startsWith('http') && /\.mp4(\?|$)/i.test(c)) return c;
    }
    for (const c of Object.values(files)) {
        if (typeof c === 'string' && c.startsWith('http') && !XV_URL_RE.test(c) && /\.(mp4|webm|mov)(\?|$)/i.test(c)) {
            return c;
        }
    }
    return null;
}

function extractList(d) {
    const root = d?.data ?? d?.result ?? d ?? {};
    if (Array.isArray(root)) return root;
    if (Array.isArray(root.videos)) return root.videos;
    if (Array.isArray(root.results)) return root.results;
    if (Array.isArray(root.data)) return root.data;
    if (Array.isArray(root.items)) return root.items;
    return [];
}

async function search(query) {
    try {
        const ep = `https://apis.prexzyvilla.site/nsfw/xvideos-search?query=${encodeURIComponent(query)}`;
        const r = await axios.get(ep, { timeout: 25000 });
        return extractList(r.data);
    } catch (e) {
        console.error('[xv] Search failed:', e.message);
        throw new Error('Failed to search videos');
    }
}

async function download(url) {
    try {
        const ep = `https://apis.prexzyvilla.site/nsfw/xvideos-dl?url=${encodeURIComponent(url)}`;
        const r = await axios.get(ep, { timeout: 60000 });
        const root = r.data?.data || r.data?.result || r.data || {};
        const files = root.files || {};
        
        return {
            mp4: pickMp4(files),
            title: root.title || root.name || 'Video',
            duration: root.duration || 0,
            thumbnail: typeof root.thumb === 'string' && root.thumb.startsWith('http') ? root.thumb
                      : typeof root.thumbnail === 'string' && root.thumbnail.startsWith('http') ? root.thumbnail
                      : null,
        };
    } catch (e) {
        console.error('[xv] Download failed:', e.message);
        throw new Error('Failed to download video');
    }
}

async function downloadVideoFile(videoUrl) {
    try {
        const response = await axios.get(videoUrl, {
            timeout: 120000,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        let downloadedSize = 0;
        const tempPath = path.join(TEMP_DIR, `video_${Date.now()}.mp4`);

        return new Promise((resolve, reject) => {
            const writeStream = fs.createWriteStream(tempPath);

            response.data.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (downloadedSize > MAX_VIDEO_SIZE) {
                    response.data.destroy();
                    writeStream.destroy();
                    fs.unlinkSync(tempPath);
                    reject(new Error('Video file too large (>10MB)'));
                }
            });

            response.data.pipe(writeStream);

            writeStream.on('finish', () => {
                resolve(tempPath);
            });

            writeStream.on('error', reject);
            response.data.on('error', reject);
        });
    } catch (e) {
        console.error('[xv] Video download failed:', e.message);
        throw new Error('Failed to download video file');
    }
}

async function findAndDownloadBestVideo(searchResults) {
    for (const video of searchResults) {
        try {
            if (!video.url && !video.link) continue;
            
            const videoUrl = video.url || video.link;
            if (!videoUrl.includes('xvideos')) continue;

            console.log(`[xv] Trying video: ${video.title || 'Unknown'}`);
            const info = await download(videoUrl);

            if (!info.mp4) {
                console.log('[xv] No MP4 found, skipping');
                continue;
            }

            // Parse duration
            let durationSeconds = 0;
            if (info.duration) {
                if (typeof info.duration === 'string') {
                    const parts = info.duration.split(':').map(Number);
                    if (parts.length === 2) durationSeconds = parts[0] * 60 + parts[1];
                    else if (parts.length === 3) durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                } else durationSeconds = info.duration;
            }

            // Check if video is in desired duration range
            if (durationSeconds > 0) {
                if (durationSeconds < MIN_DURATION || durationSeconds > MAX_DURATION) {
                    console.log(`[xv] Duration ${durationSeconds}s outside range, skipping`);
                    continue;
                }
            }

            console.log(`[xv] Attempting download: ${info.title}`);
            const filePath = await downloadVideoFile(info.mp4);
            const fileSize = fs.statSync(filePath).size;

            console.log(`[xv] Success! File size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
            return { filePath, title: info.title, duration: info.duration };
        } catch (e) {
            console.log(`[xv] Video failed: ${e.message}`);
            continue;
        }
    }

    throw new Error('No suitable video found in results');
}

module.exports = {
    name: 'xvideos',
    aliases: ['xv', 'xvid', 'xvsearch'],
    description: 'Search and download NSFW videos',
    category: 'media',
    nsfw: true,
    
    async execute({ sock, msg, from, reply, args }) {
        if (!args.length) {
            return reply(
                `🔞 *Xvideos Search & Download*\n\n` +
                `Usage: .xv <search query>\n\n` +
                `Example: .xv nature\n\n` +
                `Features:\n` +
                `• Auto-searches for videos\n` +
                `• Downloads 3-5 min videos\n` +
                `• Max 10MB file size\n\n` +
                `⚠️ NSFW only — use in allowed chats`
            );
        }

        const query = args.join(' ').trim();

        if (query.length > 50) {
            return reply('❌ Search query too long (max 50 characters)');
        }

        try {
            ensureTempDir();
            await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } }).catch(() => {});

            // Search for videos
            console.log(`[xv] Searching for: ${query}`);
            const results = await search(query);

            if (!results || results.length === 0) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply('❌ No videos found for your search');
            }

            console.log(`[xv] Found ${results.length} results`);
            await sock.sendMessage(from, { react: { text: '⬇️', key: msg.key } }).catch(() => {});

            // Find and download best video
            const videoInfo = await findAndDownloadBestVideo(results);

            // Send video to WhatsApp
            const videoBuffer = fs.readFileSync(videoInfo.filePath);
            const caption = `🔞 *${videoInfo.title}*${videoInfo.duration ? `\n⏱️ ${videoInfo.duration}` : ''}\n\n> SUKUNA MD`;

            await sock.sendMessage(from, {
                video: videoBuffer,
                mimetype: 'video/mp4',
                caption: caption.substring(0, 1024)
            }, { quoted: msg });

            // Cleanup
            try {
                fs.unlinkSync(videoInfo.filePath);
            } catch (_) {}

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
        } catch (err) {
            console.error('[xv] Error:', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
            reply(`❌ Failed to fetch video: ${err.message}`);
        }
    }
};
