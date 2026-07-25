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

// Identify song using a more reliable public API
async function identifySong(audioFile) {
    try {
        const form = new FormData();
        form.append('file', fs.createReadStream(audioFile));
        
        // Using a more robust public endpoint or alternative identification service
        // Primary: David Cyril's Shazam API (often used in WA bots)
        const { data } = await axios.post('https://apis.davidcyril.name.ng/shazam', form, {
            headers: form.getHeaders(),
            timeout: 20000
        });

        if (data.status && data.result) {
            return data.result;
        }
        
        // Fallback to Audd.io with a slightly better handling if token is provided in env
        // But for now, we rely on the specialized WA bot API which is more stable for this use case
        return null;
    } catch (err) {
        console.error('[identification error]', err.message);
        return null;
    }
}

// Download audio using the new play API strategies
async function getAudioUrl(query) {
    const strategies = [
        async () => {
            const { data } = await axios.get(`https://apis.davidcyril.name.ng/play?query=${encodeURIComponent(query)}`, { timeout: 30000 });
            return data.status && data.result?.download_url ? data.result.download_url : null;
        },
        async () => {
            const searchRes = await axios.get(`https://apis.davidcyril.name.ng/youtube/search?query=${encodeURIComponent(query)}`, { timeout: 15000 });
            const video = searchRes.data?.results?.[0];
            if (!video?.url) return null;
            const dlRes = await axios.get(`https://apis.davidcyril.name.ng/download/ytmp3?url=${encodeURIComponent(video.url)}`, { timeout: 30000 });
            return dlRes.data.success && dlRes.data.result?.download_url ? dlRes.data.result.download_url : null;
        }
    ];

    for (const strategy of strategies) {
        try {
            const url = await strategy();
            if (url) return url;
        } catch (e) {
            continue;
        }
    }
    return null;
}

module.exports = {
    name: 'shazam',
    alias: ['whatmusic', 'identify', 'findaudio'],
    desc: 'Identify music and auto-download audio',
    category: 'media',
    usage: '.shazam',

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
        let inputFile = path.join(tempDir, `shazam_${Date.now()}.${hasVideo ? 'mp4' : 'mp3'}`);
        let sampleFile = inputFile.replace(/\.[^.]+$/, '_sample.mp3');

        try {
            const stream = await downloadContentFromMessage(hasAudio || hasVideo, hasAudio ? 'audio' : 'video');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            fs.writeFileSync(inputFile, Buffer.concat(chunks));

            // Extract a 10-second high-quality sample for better recognition
            await execAsync(`ffmpeg -y -i "${inputFile}" -ss 0 -t 10 -acodec libmp3lame -ar 44100 -ac 1 -b:a 128k "${sampleFile}"`);
            
            const songInfo = await identifySong(sampleFile);
            if (!songInfo) return reply('❌ Could not identify the song. Please ensure the audio is clear.');

            const title = songInfo.title || 'Unknown';
            const artist = songInfo.artist || 'Unknown';
            const searchQuery = `${title} ${artist}`;

            let infoText = `╭─❍ 𝙎𝙊𝙉𝙂 𝙄𝘿𝙀𝙉𝙏𝙄𝙁𝙄𝘌𝘿\n`;
            infoText += `│ 🎵 Title: ${title}\n`;
            infoText += `│ 🎤 Artist: ${artist}\n`;
            infoText += `│ 💿 Album: ${songInfo.album || 'N/A'}\n`;
            infoText += `│ 📅 Release: ${songInfo.release_date || 'N/A'}\n`;
            infoText += `╰────────────────────`;

            await reply(infoText);
            await sock.sendMessage(from, { react: { text: '⬇️', key: msg.key } });

            const audioUrl = await getAudioUrl(searchQuery);
            if (audioUrl) {
                await sock.sendMessage(from, {
                    audio: { url: audioUrl },
                    mimetype: 'audio/mpeg',
                    fileName: `${title}.mp3`
                }, { quoted: msg });
                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
            } else {
                await reply('✅ Identified! But I couldn\'t find a high-quality download link for this track.');
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
