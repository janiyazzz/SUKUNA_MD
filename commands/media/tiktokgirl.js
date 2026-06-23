/**
 * Random TikTok Girl Video Command
 * Usage: .tiktokgirl
 * API: https://apis.prexzyvilla.site/random/tiktokgirl
 */
'use strict';

const axios = require('axios');

const ENDPOINT = 'https://apis.prexzyvilla.site/random/tiktokgirl';

/**
 * Walk the JSON response and extract the best video/image URL.
 * Handles all common shapes this API might return:
 *   { url }  |  { video }  |  { result: { url } }  |  { data: { url } }
 *   { videoUrl }  |  { video_url }  |  { link }  |  { media }
 */
function extractMedia(data) {
    if (!data || typeof data !== 'object') return null;

    // Priority order — most likely keys first
    const VIDEO_KEYS = ['video', 'videoUrl', 'video_url', 'videourl', 'mp4', 'playAddr', 'play'];
    const ANY_KEYS   = ['url', 'link', 'media', 'result', 'file', 'content', 'download'];

    // Flatten one level of nesting (data.result, data.data, data.response)
    const targets = [data];
    for (const k of ['result', 'data', 'response', 'item', 'video']) {
        if (data[k] && typeof data[k] === 'object' && !Array.isArray(data[k])) {
            targets.push(data[k]);
        }
    }

    for (const obj of targets) {
        // Check video-specific keys first
        for (const k of VIDEO_KEYS) {
            const v = obj[k];
            if (typeof v === 'string' && v.startsWith('http')) {
                return { url: v, isVideo: true };
            }
        }
        // Then generic URL keys
        for (const k of ANY_KEYS) {
            const v = obj[k];
            if (typeof v === 'string' && v.startsWith('http')) {
                // Guess type from URL or key name
                const isVideo = /\.(mp4|webm|mov|m4v)\b/i.test(v) || /video|vid|mp4/i.test(k);
                return { url: v, isVideo };
            }
        }
    }

    // Last resort: grab first http string anywhere in the object
    const str = JSON.stringify(data);
    const match = str.match(/https?:\/\/[^"]+/);
    if (match) {
        const url = match[0];
        return { url, isVideo: /\.(mp4|webm|mov)\b/i.test(url) };
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

            const res = await axios.get(ENDPOINT, {
                timeout: 30000,
                headers: { 'User-Agent': 'Mozilla/5.0 (SUKUNA-MD)' },
                validateStatus: () => true,
            });

            if (res.status >= 400) {
                throw new Error(`API returned ${res.status}`);
            }

            const media = extractMedia(res.data);
            if (!media) throw new Error('No media URL found in API response');

            const caption = `🎵 *Random TikTok Girl*\n\n> _SUKUNA MD_`;

            if (media.isVideo) {
                await sock.sendMessage(from, {
                    video:    { url: media.url },
                    mimetype: 'video/mp4',
                    caption,
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, {
                    image:   { url: media.url },
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
