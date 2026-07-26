/**
 * PixelArt AI Command
 * Usage: .pixelart <prompt>
 */

const axios = require('axios');

module.exports = {
    name: 'pixelart',
    description: 'Generate a pixel art image',
    category: 'media',
    async execute({ sock, msg, from, reply, args }) {
        const prompt = args.join(' ');
        if (!prompt) {
            return reply('🎨 Please provide a prompt for the pixel art.\nExample: .pixelart a cat');
        }

        try {
            const imageUrl = `https://apis.prexzyvilla.site/ai/imagine?prompt=pixel art of ${encodeURIComponent(prompt)}`;
            
            await sock.sendMessage(from, {
                image: { url: imageUrl },
                caption: `🎨 *Pixel Art:* ${prompt}`
            }, { quoted: msg });
        } catch (err) {
            console.error('[pixelart]', err.message);
            reply('❌ Failed to generate pixel art.');
        }
    }
};
