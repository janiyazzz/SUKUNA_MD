const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const FormData = require('form-data');
const fetch = require('node-fetch');
const axios = require('axios');
const yts = require('yt-search');

// ACR Cloud credentials (add to config or env)
const ACR_CLOUD = {
    host: process.env.ACR_HOST || 'identify-us-west-2.acrcloud.com',
    endpoint: '/v1/identify',
    access_key: process.env.ACR_KEY || '',
    access_secret: process.env.ACR_SECRET || '',
    data_type: 'audio',
    signature_version: '1'
};

// Track active shazam sessions for download replies
const activeShazamSessions = new Map();

// Fallback audio download APIs
const FALLBACK_AUDIO_APIS = (url) => [
    'https://apiskeith.top/download/audio?url=' + encodeURIComponent(url),
    'https://api.siputzx.my.id/api/d/ytmp3?url=' + encodeURIComponent(url),
    'https://api.davidcyriltech.my.id/download/ytmp3?url=' + encodeURIComponent(url),
];

// Fallback video download APIs
const FALLBACK_VIDEO_APIS = (url) => [
    'https://apiskeith.top/download/video?url=' + encodeURIComponent(url),
    'https://api.siputzx.my.id/api/d/ytmp4?url=' + encodeURIComponent(url),
    'https://api.davidcyriltech.my.id/download/ytmp4?url=' + encodeURIComponent(url),
];

// Ensure temp directory exists
function ensureTempDir() {
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    return tempDir;
}

// Extract 15 seconds of audio for fingerprinting
async function extractAudioSample(inputFile, outputFile) {
    const cmd = `ffmpeg -y -i "${inputFile}" -ss 0 -t 15 -acodec libmp3lame -ar 44100 -ac 1 -b:a 128k "${outputFile}"`;
    await execAsync(cmd);
    if (!fs.existsSync(outputFile)) throw new Error('FFmpeg failed to create output file');
    return fs.readFileSync(outputFile);
}

// Sign request for ACR Cloud
function sign(stringToSign, secret) {
    const crypto = require('crypto');
    return crypto.createHmac('sha1', secret)
        .update(Buffer.from(stringToSign, 'utf8'))
        .digest()
        .toString('base64');
}

// Build string to sign for ACR Cloud
function buildStringToSign(method, endpoint, access_key, data_type, signature_version, timestamp) {
    return [method, endpoint, access_key, data_type, signature_version, timestamp].join('\n');
}

// Search YouTube for song
async function searchYouTube(query) {
    try {
        const results = await yts(query);
        return results.videos[0] || null;
    } catch (err) {
        console.error('[shazam] YouTube search failed:', err.message);
        return null;
    }
}

// Download audio from fallback APIs
async function downloadAudio(url) {
    for (const api of FALLBACK_AUDIO_APIS(url)) {
        try {
            const { data } = await axios.get(api, {
                timeout: 20000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const downloadUrl = data?.result?.downloadUrl || data?.result?.url || data?.download;
            if (!downloadUrl) continue;
            
            const buffer = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            console.log('[shazam] Downloaded audio from:', api);
            return Buffer.from(buffer.data);
        } catch (err) {
            console.error('[shazam] Audio download failed:', err.message);
        }
    }
    return null;
}

// Download video from fallback APIs
async function downloadVideo(url) {
    for (const api of FALLBACK_VIDEO_APIS(url)) {
        try {
            const { data } = await axios.get(api, {
                timeout: 20000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const videoUrl = data?.result?.downloadUrl || data?.result?.url || data?.download;
            if (!videoUrl) continue;
            console.log('[shazam] Video URL found:', api);
            return videoUrl;
        } catch (err) {
            console.error('[shazam] Video download failed:', err.message);
        }
    }
    return null;
}

// Cleanup temporary files
function cleanupFiles(files) {
    files.forEach(file => {
        try {
            if (file && fs.existsSync(file)) fs.unlinkSync(file);
        } catch {}
    });
}

// Handle download replies
async function handleShazamReply(sock, msg, reply) {
    const sessionKey = msg.chat + ':' + msg.sender;
    const session = activeShazamSessions.get(sessionKey);
    
    if (!session) return false;
    
    const messageId = msg.quoted?.key?.id || msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
    if (messageId !== session.messageId) return false;
    
    activeShazamSessions.delete(sessionKey);
    
    const choice = msg.body?.toLowerCase?.().trim();
    if (!['1', '2', 'audio', 'video'].includes(choice)) {
        await reply('Reply with 1 for audio or 2 for video');
        return true;
    }
    
    const downloadAudio = choice === '1' || choice === 'audio';
    
    try {
        if (!session.ytUrl) return reply('No YouTube link available');
        
        if (downloadAudio) {
            await reply('Downloading audio...');
            const audioBuffer = await downloadAudio(session.ytUrl);
            if (!audioBuffer) return reply('Failed to download audio');
            
            await sock.sendMessage(msg.chat, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: session.title + '.mp3',
                ptt: false
            }, { quoted: msg });
        } else {
            await reply('Downloading video...');
            const videoUrl = await downloadVideo(session.ytUrl);
            if (!videoUrl) return reply('Failed to download video');
            
            await sock.sendMessage(msg.chat, {
                video: { url: videoUrl },
                caption: '_𓄄 ' + session.title + '_'
            }, { quoted: msg });
        }
        
        await sock.sendMessage(msg.chat, {
            react: { text: '✨', key: msg.key }
        }).catch(() => {});
    } catch (err) {
        await reply('Download failed: ' + err.message);
    }
    
    return true;
}

module.exports = {
    name: 'shazam',
    alias: ['whatmusic', 'identify', 'findaudio'],
    desc: 'Identify music from audio/video and download it',
    category: 'Media',
    
    handleShazamReply,
    
    execute: async (sock, msg, { reply }) => {
        const quoted = msg.quoted || msg;
        const mime = quoted.mimetype || '';
        
        // Check if audio or video
        if (!/audio|video/.test(mime)) {
            return reply('Reply to audio or video with .shazam\n\nAliases: .whatmusic, .identify, .findaudio');
        }
        
        if (!ACR_CLOUD.access_key || !ACR_CLOUD.access_secret) {
            return reply('ACR Cloud not configured. Set ACR_KEY and ACR_SECRET env vars');
        }
        
        const tempDir = ensureTempDir();
        let inputFile = null;
        let sampleFile = null;
        
        try {
            // Download media
            await sock.sendMessage(msg.chat, {
                react: { text: '🔍', key: msg.key }
            }).catch(() => {});
            
            const media = await quoted.download();
            if (!media || media.length === 0) {
                return reply('Failed to download media');
            }
            
            const ext = /video/.test(mime) ? 'mp4' : 'mp3';
            inputFile = path.join(tempDir, 'shazam_' + Date.now() + '.' + ext);
            fs.writeFileSync(inputFile, media);
            
            // Extract audio sample
            sampleFile = path.join(tempDir, 'sample_' + Date.now() + '.mp3');
            const sampleBuffer = await extractAudioSample(inputFile, sampleFile);
            
            // Sign ACR Cloud request
            const timestamp = Math.floor(Date.now() / 1000);
            const stringToSign = buildStringToSign(
                'POST',
                ACR_CLOUD.endpoint,
                ACR_CLOUD.access_key,
                ACR_CLOUD.data_type,
                ACR_CLOUD.signature_version,
                timestamp
            );
            const signature = sign(stringToSign, ACR_CLOUD.access_secret);
            
            // Send to ACR Cloud
            const form = new FormData();
            form.append('sample', sampleBuffer, { filename: 'sample.mp3', contentType: 'audio/mpeg' });
            form.append('sample_bytes', sampleBuffer.length);
            form.append('access_key', ACR_CLOUD.access_key);
            form.append('data_type', ACR_CLOUD.data_type);
            form.append('signature_version', ACR_CLOUD.signature_version);
            form.append('signature', signature);
            form.append('timestamp', timestamp);
            
            const apiUrl = 'http://' + ACR_CLOUD.host + ACR_CLOUD.endpoint;
            const response = await fetch(apiUrl, {
                method: 'POST',
                body: form,
                timeout: 30000
            });
            
            const result = await response.json();
            
            if (result.status?.code !== 0) {
                return reply('Song not identified: ' + (result.status?.msg || 'Unknown error'));
            }
            
            if (!result.metadata?.music?.length) {
                return reply('No match found');
            }
            
            // Extract song info
            const song = result.metadata.music[0];
            const artists = song.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
            const title = song.title || 'Unknown Title';
            const album = song.album?.name || 'Unknown Album';
            const releaseDate = song.release_date || 'N/A';
            const duration = song.duration_ms ? Math.floor(song.duration_ms / 1000) + 's' : 'N/A';
            
            // Search YouTube
            const ytResult = await searchYouTube(title + ' ' + artists);
            const ytUrl = ytResult?.url || null;
            const thumbnail = ytResult?.thumbnail || song.album?.cover || 'https://files.catbox.moe/5uli5p.jpeg';
            
            // Build response message
            let infoText = '╭─❍ *𓄄 SONG IDENTIFIED*\n│\n';
            infoText += '│ 📝 *Title:* ' + title + '\n';
            infoText += '│ 🎤 *Artist:* ' + artists + '\n';
            infoText += '│ 💿 *Album:* ' + album + '\n';
            infoText += '│ 📅 *Released:* ' + releaseDate + '\n';
            infoText += '│ ☬ *Duration:* ' + duration + '\n';
            infoText += '│\n│ *➫ Listen On:*\n';
            
            if (song.external_metadata?.spotify?.track?.id) {
                infoText += '│   🎵 spotify.com/track/' + song.external_metadata.spotify.track.id + '\n';
            }
            if (song.external_metadata?.youtube?.vid) {
                infoText += '│    𓊈𝑽꯭𝑰꯭𝑷ࠡࠡࠡࠡࠢ𓊉 youtube.com/watch?v=' + song.external_metadata.youtube.vid + '\n';
            }
            if (ytUrl) {
                infoText += '│   ▶️ ' + ytUrl + '\n';
            }
            
            infoText += '│\n│ ⚉ *Reply with:*\n';
            infoText += '│   1 → download audio\n';
            infoText += '│   2 → download video\n';
            infoText += '╰──────────────────';
            
            // Send with thumbnail
            const sentMsg = await sock.sendMessage(msg.chat, {
                image: { url: thumbnail },
                caption: infoText
            }, { quoted: msg });
            
            // Store session for download
            const sessionKey = msg.chat + ':' + msg.sender;
            activeShazamSessions.set(sessionKey, {
                messageId: sentMsg.key.id,
                ytUrl,
                title,
                timestamp: Date.now()
            });
            
            // Cleanup session after 5 minutes
            setTimeout(() => activeShazamSessions.delete(sessionKey), 5 * 60 * 1000);
            
            // React
            await sock.sendMessage(msg.chat, {
                react: { text: '🎶', key: msg.key }
            }).catch(() => {});
            
        } catch (err) {
            console.error('[shazam]', err);
            let errorMsg = err.message;
            if (err.message.includes('ENOENT')) errorMsg = 'FFmpeg not installed';
            if (err.message.includes('ECONNREFUSED')) errorMsg = 'Network error';
            if (err.message.includes('timeout')) errorMsg = 'Try clearer audio';
            
            return reply('Error: ' + errorMsg);
        } finally {
            cleanupFiles([inputFile, sampleFile]);
        }
    }
};
