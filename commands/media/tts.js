/**
 * .tts <text> — text-to-speech via prexzyvilla
 */
'use strict';
const axios = require('axios');

const AUDIO_RE = /\.(mp3|ogg|m4a|wav|aac|opus)(\?|$)/i;
const URL_RE = /^https?:\/\//i;

function walkAudio(node, out) {
    if (!node) return;
    if (typeof node === 'string') {
        if (URL_RE.test(node) && AUDIO_RE.test(node)) out.push(node);
        return;
    }
    if (Array.isArray(node)) { for (const v of node) walkAudio(v, out); return; }
    if (typeof node === 'object') { for (const v of Object.values(node)) walkAudio(v, out); }
}

module.exports = {
    name: 'tts',
    aliases: ['say', 'voice'],
    description: 'Convert text to speech (English)',
    category: 'media',
    async execute({ sock, msg, from, reply, args }) {
        if (!args.length) {
            return reply(
                `🗣️ *Text to Speech*\n\n` +
                `Usage: .tts <text>\n` +
                `Example: .tts hello world`
            );
        }
        const text = args.join(' ').trim().slice(0, 500);
        if (!text) return reply('❌ Please provide some text.');

        try {
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });
            const url = `https://apis.prexzyvilla.site/tts/tts-en?text=${encodeURIComponent(text)}`;
            const r = await axios.get(url, {
                timeout: 30000,
                headers: { 'User-Agent': 'Mozilla/5.0 (SUKUNA-MD)' },
                validateStatus: () => true,
            });
            if (r.status >= 400) throw new Error(`API ${r.status}`);

            const urls = [];
            walkAudio(r.data, urls);
            const audioUrl = urls[0];
            if (!audioUrl) throw new Error('No audio URL in response');

            try {
                await sock.sendMessage(from, {
                    audio: { url: audioUrl },
                    mimetype: 'audio/mpeg',
                    ptt: false,
                }, { quoted: msg });
            } catch (e) {
                console.error('[tts] audio send failed:', e.message);
                await reply(`🗣️ *TTS*\n\n${text}\n\n🔗 ${audioUrl}`);
            }
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.error('[tts] error:', err.message);
            try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch {}
            reply('❌ TTS failed. Try again later.');
        }
    },
};
