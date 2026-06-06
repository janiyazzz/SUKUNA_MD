/**
 * .animeinfo <anime_id> — anime detail via animekill
 */
'use strict';
const axios = require('axios');

function pickThumb(o) {
    for (const k of ['image', 'poster', 'thumbnail', 'thumb', 'cover', 'img', 'banner']) {
        const v = o?.[k];
        if (typeof v === 'string' && /^https?:\/\//.test(v)) return v;
    }
    return null;
}

function trim(s, n) {
    if (!s) return '';
    s = String(s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

module.exports = {
    name: 'animeinfo',
    aliases: ['animedetail', 'ainfo'],
    description: 'Get anime details by anime_id',
    category: 'media',
    async execute({ sock, msg, from, reply, args }) {
        if (!args.length) {
            return reply(
                `🎌 *Anime Info*\n\n` +
                `Usage: .animeinfo <anime_id>\n` +
                `_Get an id from:_ .anime <query>`
            );
        }
        const id = args[0].trim();
        try {
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });
            const ep = `https://apis.prexzyvilla.site/anime/animekill-detail?anime_id=${encodeURIComponent(id)}`;
            const r = await axios.get(ep, { timeout: 30000, validateStatus: () => true });
            if (r.status >= 400) throw new Error(`API ${r.status}`);
            const a = r.data?.data ?? r.data?.result ?? r.data ?? {};
            if (!a || (typeof a === 'object' && !Object.keys(a).length)) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return reply(`❌ No info for id *${id}*.`);
            }

            const title = a.title || a.name || 'Unknown';
            const type = a.type || a.format || '';
            const status = a.status || '';
            const eps = a.episodes || a.totalEpisodes || (Array.isArray(a.episodeList) ? a.episodeList.length : '');
            const released = a.released || a.year || a.aired || '';
            const genres = Array.isArray(a.genres) ? a.genres.join(', ')
                         : Array.isArray(a.genre) ? a.genre.join(', ')
                         : (a.genres || a.genre || '');
            const synopsis = a.synopsis || a.description || a.plot || a.summary || '';

            let out = `🎌 *${title}*\n\n`;
            if (type)     out += `🎭 Type: ${type}\n`;
            if (status)   out += `📡 Status: ${status}\n`;
            if (eps)      out += `🎞️ Episodes: ${eps}\n`;
            if (released) out += `📅 Released: ${released}\n`;
            if (genres)   out += `🏷️ Genres: ${genres}\n`;
            if (synopsis) out += `\n📖 ${trim(synopsis, 700)}\n`;

            const episodeList = Array.isArray(a.episodeList) ? a.episodeList
                              : Array.isArray(a.episodes_list) ? a.episodes_list
                              : Array.isArray(a.episodes) && a.episodes.length && typeof a.episodes[0] === 'object' ? a.episodes
                              : null;
            if (episodeList && episodeList.length) {
                const show = episodeList.slice(0, 12);
                out += `\n*Episodes (showing ${show.length}/${episodeList.length}):*\n`;
                show.forEach((e, i) => {
                    const num = e.number || e.ep || e.episode || i + 1;
                    const link = e.url || e.link || e.id || '';
                    out += `• Ep ${num}${link ? ` — ${link}` : ''}\n`;
                });
            }

            const thumb = pickThumb(a);
            if (thumb) {
                try {
                    await sock.sendMessage(from, { image: { url: thumb }, caption: out }, { quoted: msg });
                    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
                    return;
                } catch {}
            }
            await reply(out);
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.error('[animeinfo] error:', err.message);
            try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch {}
            reply('❌ Anime info fetch failed. Try again later.');
        }
    },
};
