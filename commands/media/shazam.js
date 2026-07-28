'use strict';

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const axios = require('axios');
const FormData = require('form-data');
const { downloadContentFromMessage } = require('@crysnovax/baileys');

// Ensure temp directory exists
function ensureTempDir() {
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    return tempDir;
}

// Identify a song from a short audio sample
async function identifySong(audioFile) {
    try {
        const stats = fs.statSync(audioFile);
        console.log(`[shazam] sending sample: ${audioFile} (${stats.size} bytes)`);

        const form = new FormData();
        form.append('file', fs.createReadStream(audioFile));

        const { data } = await axios.post('https://apis.davidcyril.name.ng/shazam', form, {
            headers: form.getHeaders(),
            timeout: 20000
        });

        console.log('[shazam] API response:', JSON.stringify(data));

        if (data.status && data.result) {
            return data.result;
        }
        console.log('[shazam] API returned no match. status:', data.status, 'result:', data.result, 'message:', data.message);
        return null;
    } catch (err) {
        console.error('[identification error]', err.message);
        if (err.response) {
            console.error('[identification error] status:', err.response.status);
            console.error('[identification error] body:', JSON.stringify(err.response.data));
        }
        return null;
    }
}

// Same download strategies/order as play.js, kept as its own local copy
// so this file has no dependency on play.js.
async function getAudioResult(query) {
    const strategies = [
        // Strategy 1: Primary API
        async () => {
            const { data } = await axios.get(`https://apis.davidcyril.name.ng/play?query=${encodeURIComponent(query)}`, { timeout: 30000 });
            if (data.status && data.result?.download_url) {
                return {
                    url: data.result.download_url,
                    title: data.result.title,
                    thumbnail: data.result.thumbnail,
                    duration: data.result.duration
                };
            }
            throw new Error('Primary API failed');
        },
        // Strategy 2: Fallback search + ytmp3 from same provider
        async () => {
            const searchRes = await axios.get(`https://apis.davidcyril.name.ng/youtube/search?query=${encodeURIComponent(query)}`, { timeout: 15000 });
            const video = searchRes.data?.results?.[0];
            if (!video?.url) throw new Error('Search failed');

            const dlRes = await axios.get(`https://apis.davidcyril.name.ng/download/ytmp3?url=${encodeURIComponent(video.url)}`, { timeout: 30000 });
            if (dlRes.data.success && dlRes.data.result?.download_url) {
                return {
                    url: dlRes.data.result.download_url,
                    title: video.title,
                    thumbnail: video.thumbnail,
                    duration: video.duration
                };
            }
            throw new Error('Secondary API failed');
        },
        // Strategy 3: Another free API (agatz.xyz) — was missing before
        async () => {
            const { data } = await axios.get(`https://api.agatz.xyz/api/ytmp3?url=${encodeURIComponent(query)}`, { timeout: 30000 }).catch(() => ({ data: {} }));
            if (data.status === 200 && data.data?.downloadUrl) {
                return {
                    url: data.data.downloadUrl,
                    title: data.data.title || query,
                    thumbnail: data.data.thumbnail,
                    duration: data.data.duration
                };
            }
            throw new Error('Agatz API failed');
        }
    ];

    for (const strategy of strategies) {
        try {
            const res = await strategy();
            if (res?.url) return res;
        } catch (e) {
            continue;
        }
    }
    return null;
}

module.exports = {
    name: 'shazam',
    aliases: ['whatmusic', 'identify', 'findaudio'],
    description: 'Identify music from a clip and auto-download the full audio',
    category: 'media',
    usage: '.shazam (reply to audio/video)',

    execute: async ({ sock, msg, from, reply }) => {
        const ctx = msg.message?.extendedTextMessage?.contextInfo ||
                    msg.message?.imageMessage?.contextInfo ||
                    msg.message?.videoMessage?.contextInfo ||
                    msg.message?.audioMessage?.contextInfo || null;

        const quotedMessage = ctx?.quotedMessage;
        if (!quotedMessage) return reply('Reply to audio or video with .shazam');

        const hasAudio = quotedMessage.audioMessage;
        const hasVideo = quotedMessage.videoMessage;
        if (!hasAudio && !hasVideo) return reply('Reply to audio or video with .shazam');

        await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } });

        const tempDir = ensureTempDir();
        const inputFile = path.join(tempDir, `shazam_${Date.now()}.${hasVideo ? 'mp4' : 'mp3'}`);
        const sampleFile = inputFile.replace(/\.[^.]+$/, '_sample.mp3');

        try {
            const stream = await downloadContentFromMessage(hasAudio || hasVideo, hasAudio ? 'audio' : 'video');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            fs.writeFileSync(inputFile, Buffer.concat(chunks));

            // Extract a 10-second sample for recognition
            await execAsync(`ffmpeg -y -i "${inputFile}" -ss 0 -t 10 -acodec libmp3lame -ar 44100 -ac 1 -b:a 128k "${sampleFile}"`);

            const songInfo = await identifySong(sampleFile);
            if (!songInfo) return reply('❌ Could not identify the song. Please ensure the audio is clear.');

            const title = songInfo.title || 'Unknown';
            const artist = songInfo.artist || 'Unknown';
            const searchQuery = `${title} ${artist}`.trim();

            let infoText = `╭─❍ 𝙎𝙊𝙉𝙂 𝙄𝘿𝙀𝙉𝙏𝙄𝙁𝙄𝙀𝘿\n`;
            infoText += `│ 🎵 Title: ${title}\n`;
            infoText += `│ 🎤 Artist: ${artist}\n`;
            infoText += `│ 💿 Album: ${songInfo.album || 'N/A'}\n`;
            infoText += `│ 📅 Release: ${songInfo.release_date || 'N/A'}\n`;
            infoText += `╰────────────────────`;

            await reply(infoText);
            await sock.sendMessage(from, { react: { text: '⬇️', key: msg.key } });

            const result = await getAudioResult(searchQuery);

            if (result?.url) {
                if (result.thumbnail) {
                    await sock.sendMessage(from, {
                        image: { url: result.thumbnail },
                        caption: `🎵 *${result.title || title}*`
                    }, { quoted: msg });
                }

                await sock.sendMessage(from, {
                    audio: { url: result.url },
                    mimetype: 'audio/mpeg',
                    fileName: `${result.title || title}.mp3`
                }, { quoted: msg });

                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
            } else {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                await reply('✅ Identified! But I couldn\'t find a download link for this track.');
            }

        } catch (err) {
            console.error(err);
            reply('❌ Error processing audio: ' + err.message);
        } finally {
            [inputFile, sampleFile].forEach(f => {
                if (fs.existsSync(f)) fs.unlinkSync(f);
            });
        }
    }
};
