/**
 * ATTP — Animated Text To Picture (sticker)
 * Usage: .attp <text>
 *
 * Generates animated stickers using reliable external APIs.
 */
'use strict';

const axios = require('axios');

const ATTP_APIS = [
    (text) => `https://api.botcahx.biz.id/api/attp?text=${encodeURIComponent(text)}`,
    (text) => `https://api.zacros.my.id/api/attp?text=${encodeURIComponent(text)}`,
];

async function generateAttp(text) {
    for (let i = 0; i < ATTP_APIS.length; i++) {
        try {
            const url = ATTP_APIS[i](text);
            const response = await axios.get(url, {
                timeout: 10000,
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            
            if (response.data && response.data.length > 500) {
                return response.data;
            }
        } catch (e) {
            if (i === ATTP_APIS.length - 1) throw e;
        }
    }
    throw new Error('All ATTP APIs failed');
}

module.exports = {
    name: 'attp',
    aliases: ['animatedttp', 'text2gif', 'sticker'],
    description: 'Create an animated text sticker',
    category: 'media',

    async execute({ sock, msg, from, reply, args }) {
        try {
            const text = (args || []).join(' ').trim();
            
            if (!text) {
                return reply('✨ *ATTP Sticker Maker*\nUsage: .attp <text>\nExample: .attp SUKUNA MD');
            }

            if (text.length > 100) {
                return reply('❌ Text too long (max 100 characters)');
            }

            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } }).catch(() => {});
            
            const sticker = await generateAttp(text);
            await sock.sendMessage(from, { sticker }, { quoted: msg });
            
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
        } catch (err) {
            console.error('[attp]', err.message);
            reply(`❌ Error: ${err.message}`);
        }
    }
};
