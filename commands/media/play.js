'use strict';

const axios = require('axios');

module.exports = {
    name: 'play',
    aliases: ['song', 'music', 'audio'],
    description: 'Search and download a song as audio',
    usage: '.play <song name or URL>',
    category: 'media',

    async execute({ sock, msg, from, args, reply, t }) {
        const tr = t || ((key, vars) => {
            const fallbacks = {
                'play.noQuery': '🎵 *Usage:* .play <song name>\n*Example:* .play Essence Wizkid',
                'play.searching': '🔍 Searching: *' + (vars?.query || '') + '*...',
                'play.downloading': '⬇️ Downloading: *' + (vars?.title || '') + '*...',
                'play.notFound': '❌ Could not find: *' + (vars?.query || '') + '*',
                'play.downloadFail': '❌ Download failed.',
                'play.success': '✅ *' + (vars?.title || '') + '*\n🎵 Enjoy!',
                'play.thumbCaption': '🎵 *' + (vars?.title || '') + '*',
            };
            return fallbacks[key] || key;
        });

        const query = args.join(' ').trim();
        if (!query) {
            return reply(tr('play.noQuery'));
        }

        await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } });
        await reply(tr('play.searching', { query }));

        const strategies = [
            // Strategy 1: Primary API provided by user
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
            // Strategy 3: Another free API (agatz.xyz)
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
                if (res?.url) {
                    // Send thumbnail first
                    if (res.thumbnail) {
                        await sock.sendMessage(from, {
                            image: { url: res.thumbnail },
                            caption: tr('play.thumbCaption', { title: res.title })
                        }, { quoted: msg });
                    }

                    // Send audio
                    await sock.sendMessage(from, {
                        audio: { url: res.url },
                        mimetype: 'audio/mpeg',
                        fileName: `${res.title}.mp3`
                    }, { quoted: msg });

                    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
                    return;
                }
            } catch (e) {
                console.error('Strategy failed:', e.message);
                continue;
            }
        }

        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
        return reply(tr('play.notFound', { query }));
    }
};
