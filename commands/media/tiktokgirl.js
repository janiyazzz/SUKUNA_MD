/**
 * Random TikTok Girl Video Command
 * Usage: .tiktokgirl
 * API: GET https://apis.prexzyvilla.site/random/tiktokgirl
 *
 * The API returns 200 with a JSON body. We download the response as a
 * buffer so Baileys streams it directly — avoids any URL-parsing guesswork.
 */
'use strict';

const axios = require('axios');

const ENDPOINT = 'https://apis.prexzyvilla.site/random/tiktokgirl';

/** Walk ANY JSON shape and return the first http URL found */
function findUrl(node, depth = 0) {
    if (depth > 5 || !node) return null;
    if (typeof node === 'string' && node.startsWith('http')) return node;
    if (Array.isArray(node)) {
        for (const v of node) { const r = findUrl(v, depth + 1); if (r) return r; }
    }
    if (typeof node === 'object') {
        // Check high-priority keys first
        const priority = ['url','video','videoUrl','video_url','mp4','link','media','result','data','file'];
        for (const k of priority) {
            if (node[k]) { const r = findUrl(node[k], depth + 1); if (r) return r; }
        }
        // Then everything else
        for (const v of Object.values(node)) {
            const r = findUrl(v, depth + 1); if (r) return r;
        }
    }
    return null;
}

module.exports = {
    name: 'tiktokgirl',
    aliases: ['tiktokgirls', 'tgirl'],
    description: 'Sends a random TikTok girl video',
    category: 'media',

    async execute({ sock, msg, from, reply }) {
        try {
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            // Step 1: get the JSON to find the media URL
            const { data: json, status } = await axios.get(ENDPOINT, {
                timeout: 30000,
                headers: { 'User-Agent': 'Mozilla/5.0 (SUKUNA-MD)' },
                validateStatus: () => true,
            });

            if (status >= 400) throw new Error(`API returned ${status}`);

            const mediaUrl = findUrl(json);
            if (!mediaUrl) throw new Error('No URL found in API response: ' + JSON.stringify(json).slice(0, 200));

            // Step 2: download the actual media as a buffer
            const mediaRes = await axios.get(mediaUrl, {
                timeout: 60000,
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0 (SUKUNA-MD)' },
            });

            const buffer   = Buffer.from(mediaRes.data);
            const mimeType = mediaRes.headers['content-type'] || '';
            const isVideo  = mimeType.includes('video') || /\.(mp4|webm|mov)\b/i.test(mediaUrl);
            const caption  = `🎵 *Random TikTok Girl*\n\n> _SUKUNA MD_`;

            if (isVideo) {
                await sock.sendMessage(from, {
                    video:    buffer,
                    mimetype: 'video/mp4',
                    caption,
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, {
                    image:   buffer,
                    caption,
                }, { quoted: msg });
            }

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('[tiktokgirl] error:', err.message);
            try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch {}
            reply('❌ Failed to fetch video. Try again later.');
        }
    },
};
