/**
 * Random TikTok Girl Video Command
 * Usage: .tiktokgirl
 * Sends one random TikTok video.
 */
'use strict';
const { fetchOneMedia } = require('../../lib/mediaFetch');

const ENDPOINT = 'https://apis.prexzyvilla.site/random/tiktokgirl';

module.exports = {
    name: 'tiktokgirl',
    aliases: ['tiktokgirls'],
    description: 'Sends a random TikTok video',
    category: 'media',
    async execute({ sock, msg, from, reply }) {
        try {
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            const { url, isVideo } = await fetchOneMedia(ENDPOINT);
            const caption = `🎵 *Random TikTok*\n\n> SUKUNA MD`;

            if (isVideo) {
                await sock.sendMessage(from, { video: { url }, mimetype: 'video/mp4', caption }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { image: { url }, caption }, { quoted: msg });
            }

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.error('[tiktokgirl] error:', err.message);
            try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch {}
            reply('❌ Failed to fetch a video. Try again later.');
        }
    },
};
