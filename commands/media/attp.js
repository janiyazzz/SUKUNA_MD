/**
 * ATTP — Animated Text To Picture (sticker)
 * Usage: .attp <text>
 *
 * Generates animated stickers using reliable external APIs with fallback support.
 */
'use strict';

const axios = require('axios');

// Multiple API endpoints for high reliability
const ATTP_APIS = [
    (text) => `https://api.botcahx.biz.id/api/attp?text=${encodeURIComponent(text)}`,
    (text) => `https://api.zacros.my.id/api/attp?text=${encodeURIComponent(text)}`,
    (text) => `https://rest-api.prexzyvilla.site/api/attp?text=${encodeURIComponent(text)}`,
];

async function generateAttp(text) {
    for (let i = 0; i < ATTP_APIS.length; i++) {
        try {
            const url = ATTP_APIS[i](text);
            console.log(`[attp] Trying API ${i + 1}/${ATTP_APIS.length}`);
            
            const response = await axios.get(url, {
                timeout: 15000,
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.data && response.data.length > 100) {
                console.log(`[attp] Success with API ${i + 1}`);
                return response.data;
            }
        } catch (e) {
            console.log(`[attp] API ${i + 1} failed: ${e.message}`);
            if (i < ATTP_APIS.length - 1) continue;
            throw new Error(`All ATTP APIs failed. Last error: ${e.message}`);
        }
    }
}

module.exports = {
    name: 'attp',
    aliases: ['animatedttp', 'text2gif', 'sticker'],
    description: 'Create an animated sticker from text',
    category: 'media',

    async execute({ sock, msg, from, reply, args }) {
        const text = (args || []).join(' ').trim();
        
        if (!text) {
            return reply(
                `✨ *Animated Text To Picture*\n\n` +
                `Usage: .attp <text>\n` +
                `Example: .attp SUKUNA MD`
            );
        }

        if (text.length > 100) {
            return reply('❌ Text too long! Maximum 100 characters allowed.');
        }

        try {
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } }).catch(() => {});
            
            const sticker = await generateAttp(text);
            
            if (!sticker || sticker.length < 200) {
                throw new Error('Generated sticker is too small or empty');
            }

            await sock.sendMessage(from, { sticker }, { quoted: msg });
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
        } catch (err) {
            console.error('[attp] Error:', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
            reply(`❌ Failed to create sticker: ${err.message}`);
        }
    }
};
