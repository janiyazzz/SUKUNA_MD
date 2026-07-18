const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const axios = require('axios');
const yts = require('yt-search');
const { downloadContentFromMessage } = require('@crysnovax/baileys');

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

// Search for song using multiple APIs
async function searchSongInfo(query) {
    try {
        // Try Genius API first (free, no auth required for basic search)
        const geniusResult = await axios.get('https://api.genius.com/search', {
            params: { q: query },
            timeout: 5000
        }).catch(() => null);

        if (geniusResult?.data?.response?.hits?.length > 0) {
            const hit = geniusResult.data.response.hits[0].result;
            return {
                title: hit.title,
                artist: hit.primary_artist?.name || 'Unknown',
                album: hit.album?.name || 'N/A',
                url: hit.url,
                thumbnail: hit.song_art_image_thumbnail_url,
                genius: hit.url
            };
        }

        // Fallback to YouTube search
        const ytResult = await yts(query);
        if (ytResult?.videos?.length > 0) {
            const video = ytResult.videos[0];
            return {
                title: video.title,
                artist: video.author?.name || 'Unknown',
                album: 'YouTube',
                url: video.url,
                thumbnail: video.thumbnail,
                youtube: video.url
            };
        }

        return null;
    } catch (err) {
        console.error('[search song]', err.message);
        return null;
    }
}

// Try to identify song using Shazam-like service
async function identifySong(audioFile) {
    try {
        // Use audd.io free API (no auth required for basic use)
        const form = new (require('form-data'))();
        form.append('file', fs.createReadStream(audioFile));

        const result = await axios.post('https://api.audd.io/', form, {
            headers: form.getHeaders(),
            timeout: 10000
        }).catch(() => null);

        if (result?.data?.result) {
            const r = result.data.result;
            return {
                title: r.title || 'Unknown',
                artist: r.artist || 'Unknown',
                album: r.album || 'N/A',
                release_date: r.release_date || 'N/A',
                duration: r.duration ? Math.floor(r.duration) + 's' : 'N/A',
                url: r.url || null,
                spotify: r.spotify_id ? 'spotify.com/track/' + r.spotify_id : null
            };
        }

        return null;
    } catch (err) {
        console.error('[audd identification]', err.message);
        return null;
    }
}

// Download audio from YouTube
async function downloadAudio(ytUrl) {
    for (const api of FALLBACK_AUDIO_APIS(ytUrl)) {
        try {
            const { data } = await axios.get(api, { 
                timeout: 10000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            
            const downloadUrl = data?.result?.downloadUrl || 
                               data?.data?.downloadUrl ||
                               data?.download ||
                               data?.url ||
                               data?.link;

            if (downloadUrl) {
                const audio = await axios.get(downloadUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                return Buffer.from(audio.data);
            }
        } catch (err) {
            console.error('[download audio]', err.message);
        }
    }
    return null;
}

// Download video from YouTube
async function downloadVideo(ytUrl) {
    for (const api of FALLBACK_VIDEO_APIS(ytUrl)) {
        try {
            const { data } = await axios.get(api, { 
                timeout: 10000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            
            const downloadUrl = data?.result?.downloadUrl || 
                               data?.data?.downloadUrl ||
                               data?.download ||
                               data?.url ||
                               data?.link;

            if (downloadUrl) {
                return downloadUrl;
            }
        } catch (err) {
            console.error('[download video]', err.message);
        }
    }
    return null;
}

// Handle download reply
async function handleShazamReply(sock, msg, reply) {
    const sessionKey = msg.from + ':' + msg.sender;
    const session = activeShazamSessions.get(sessionKey);

    if (!session) return false;

    const choice = msg.body?.trim().toLowerCase();
    
    if (!['1', '2', 'audio', 'video'].includes(choice)) {
        return false;
    }

    activeShazamSessions.delete(sessionKey);

    const isAudio = choice === '1' || choice === 'audio';

    try {
        if (!session.ytUrl) {
            return await reply('No download link available');
        }

        if (isAudio) {
            await sock.sendMessage(msg.from, { react: { text: '⬇️', key: msg.key } }).catch(() => {});
            const audio = await downloadAudio(session.ytUrl);
            
            if (audio) {
                await sock.sendMessage(msg.from, {
                    audio: audio,
                    mimetype: 'audio/mpeg',
                    fileName: session.title + '.mp3',
                    ptt: false
                }, { quoted: msg });
            } else {
                await reply('Failed to download audio');
            }
        } else {
            await sock.sendMessage(msg.from, { react: { text: '⬇️', key: msg.key } }).catch(() => {});
            const videoUrl = await downloadVideo(session.ytUrl);
            
            if (videoUrl) {
                await sock.sendMessage(msg.from, {
                    video: { url: videoUrl },
                    caption: 'Video: ' + session.title
                }, { quoted: msg });
            } else {
                await reply('Failed to download video');
            }
        }

        await sock.sendMessage(msg.from, { react: { text: '✨', key: msg.key } }).catch(() => {});
        return true;
    } catch (err) {
        console.error('[shazam reply]', err.message);
        await reply('Error downloading media: ' + err.message);
        return true;
    }
}

// Cleanup files
function cleanupFiles(files) {
    files.forEach(file => {
        try {
            if (file && fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        } catch (err) {
            console.error('[cleanup]', err.message);
        }
    });
}

module.exports = {
    name: 'shazam',
    alias: ['whatmusic', 'identify', 'findaudio'],
    desc: 'Identify music and auto-download audio',
    category: 'Media',
    usage: '.shazam',

    execute: async (context) => {
        const { sock, msg, from, reply } = context;

        // Extract contextInfo from the current message
        const ctx =
            msg.message?.extendedTextMessage?.contextInfo ||
            msg.message?.imageMessage?.contextInfo ||
            msg.message?.videoMessage?.contextInfo ||
            msg.message?.audioMessage?.contextInfo ||
            msg.message?.documentMessage?.contextInfo || null;

        const quotedMessage = ctx?.quotedMessage;

        if (!quotedMessage) {
            return reply('Reply to audio or video with .shazam\n\nAliases: .whatmusic, .identify, .findaudio');
        }

        // Check if audio or video
        const hasAudio = quotedMessage.audioMessage;
        const hasVideo = quotedMessage.videoMessage;

        if (!hasAudio && !hasVideo) {
            return reply('Reply to audio or video with .shazam');
        }

        const tempDir = ensureTempDir();
        let inputFile = null;
        let sampleFile = null;

        try {
            // React with searching emoji
            await sock.sendMessage(from, {
                react: { text: '🔍', key: msg.key }
            }).catch(() => {});

            // Download media
            let media = null;
            if (hasAudio) {
                const stream = await downloadContentFromMessage(quotedMessage.audioMessage, 'audio');
                const chunks = [];
                for await (const chunk of stream) chunks.push(chunk);
                media = Buffer.concat(chunks);
            } else if (hasVideo) {
                const stream = await downloadContentFromMessage(quotedMessage.videoMessage, 'video');
                const chunks = [];
                for await (const chunk of stream) chunks.push(chunk);
                media = Buffer.concat(chunks);
            }

            if (!media || media.length === 0) {
                return reply('Failed to download media');
            }

            const ext = hasVideo ? 'mp4' : 'mp3';
            inputFile = path.join(tempDir, 'shazam_' + Date.now() + '.' + ext);
            fs.writeFileSync(inputFile, media);

            // Extract audio sample for identification
            sampleFile = inputFile.replace(/\.[^.]+$/, '_sample.mp3');
            await execAsync(`ffmpeg -y -i "${inputFile}" -ss 0 -t 15 -acodec libmp3lame -ar 44100 -ac 1 -b:a 128k "${sampleFile}"`);

            if (!fs.existsSync(sampleFile)) {
                return reply('Failed to process audio');
            }

            // Try to identify the song
            const songInfo = await identifySong(sampleFile);

            if (!songInfo) {
                return reply('Could not identify song. Try clearer audio');
            }

            // Search for YouTube link
            const searchQuery = songInfo.title + ' ' + songInfo.artist;
            const ytInfo = await searchSongInfo(searchQuery);

            const title = songInfo.title || 'Unknown Song';
            const artist = songInfo.artist || 'Unknown Artist';
            const album = songInfo.album || 'N/A';
            const releaseDate = songInfo.release_date || 'N/A';
            const duration = songInfo.duration || 'N/A';
            const ytUrl = ytInfo?.youtube || ytInfo?.url || null;
            const thumbnail = ytInfo?.thumbnail || 'https://files.catbox.moe/5uli5p.jpeg';

            // Build info text
            let infoText = `╭─❍ 𝙎𝙊𝙉𝙂 𝙄𝘿𝙀𝙉𝙏𝙄𝙁𝙄𝘌𝘿\n`;
            infoText += `│\n`;
            infoText += `│ 🎵 Title: ${title}\n`;
            infoText += `│ 🎤 Artist: ${artist}\n`;
            infoText += `│ 💿 Album: ${album}\n`;
            infoText += `│ 📅 Released: ${releaseDate}\n`;
            infoText += `│ ⏱️  Duration: ${duration}\n`;
            infoText += `│\n`;
            if (ytUrl) {
                infoText += `│ 🔗 Watch/Listen:\n`;
                infoText += `│ ${ytUrl}\n`;
            }
            infoText += `╰────────────────────`;

            // Send result with thumbnail
            await sock.sendMessage(from, {
                image: { url: thumbnail },
                caption: infoText
            }, { quoted: msg });

            // React with downloading emoji
            await sock.sendMessage(from, {
                react: { text: '⬇️', key: msg.key }
            }).catch(() => {});

            // Automatically download and send audio
            if (ytUrl) {
                try {
                    const audioUrl = await downloadAudio(ytUrl);
                    
                    if (audioUrl) {
                        await sock.sendMessage(from, {
                            audio: { url: audioUrl },
                            mimetype: 'audio/mpeg',
                            fileName: title + '.mp3',
                            ptt: false
                        }, { quoted: msg });
                    } else {
                        await reply('Could not download audio from the source');
                    }
                } catch (downloadErr) {
                    console.error('[audio download]', downloadErr.message);
                    await reply('Failed to download audio automatically');
                }
            }

            // React with success
            await sock.sendMessage(from, {
                react: { text: '✨', key: msg.key }
            }).catch(() => {});

        } catch (err) {
            console.error('[shazam]', err.message);
            await reply('Error: ' + err.message);
        } finally {
            cleanupFiles([inputFile, sampleFile]);
        }
    }
};
