/**
 * AI Art Video Command
 * Usage: .aiartvideo <prompt>
 */

const axios = require('axios');

module.exports = {
    name: 'aiartvideo',
    aliases: ['artvideo', 'videogen'],
    description: 'Generate an AI art video from text',
    category: 'media',
    async execute({ sock, msg, from, reply, args }) {
        const prompt = args.join(' ');
        if (!prompt) {
            return reply('🎬 Please provide a prompt for the AI video.\nExample: .aiartvideo Image of a cat dancing');
        }

        try {
            // Let the user know we're working on it
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });
            
            const res = await axios.get(`https://prexzyapis.com/ai/aiart-video?prompt=${encodeURIComponent(prompt)}`);
            const data = res.data;
            
            // The API usually returns the video URL in a field like 'result' or 'url'
            const videoUrl = data.result || data.url || data.video || data.data?.url;

            if (!videoUrl) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return reply('❌ Failed to generate video. The API did not return a valid URL.');
            }

            await sock.sendMessage(from, {
                video: { url: videoUrl },
                mimetype: 'video/mp4',
                caption: `🎬 *AI Art Video*\n\n📝 *Prompt:* ${prompt}\n\n> Powered by Prexzy APIs`,
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.error('[aiartvideo]', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            reply('❌ AI Video generation failed. Please try again later.');
        }
    }
};
