/**
 * .animeinfo <name | MAL id> — anime details via Jikan (MyAnimeList)
 *
 * Works standalone: pass an anime name (e.g. ".animeinfo jujutsu kaisen")
 * or a MyAnimeList numeric id (e.g. ".animeinfo 40748"). Jikan is a free,
 * reliable public API — no key required.
 */
'use strict';
const axios = require('axios');

const JIKAN = 'https://api.jikan.moe/v4';

function trim(s, n) {
    if (!s) return '';
    s = String(s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// Jikan occasionally returns transient 5xx / 429 — retry a few times.
async function jget(url, params) {
    let last = null;
    for (let i = 0; i < 4; i++) {
        try {
            const r = await axios.get(url, { params, timeout: 20000, validateStatus: () => true });
            if (r.status === 200) return r.data;
            last = `HTTP ${r.status}`;
        } catch (e) {
            last = e.message;
        }
        await new Promise(res => setTimeout(res, 1200));
    }
    throw new Error(last || 'request failed');
}

async function resolveAnime(query) {
    // Numeric → treat as a MAL id.
    if (/^\d+$/.test(query)) {
        const d = await jget(`${JIKAN}/anime/${query}/full`);
        return d?.data || null;
    }
    // Otherwise search by name and take the best match.
    const d = await jget(`${JIKAN}/anime`, { q: query, limit: 1, sfw: true });
    return d?.data?.[0] || null;
}

module.exports = {
    name: 'animeinfo',
    aliases: ['animedetail', 'ainfo'],
    description: 'Get anime details by name or MyAnimeList id',
    category: 'media',
    usage: '.animeinfo <name | MAL id>',

    async execute({ sock, msg, from, reply, args }) {
        const query = (args || []).join(' ').trim();
        if (!query) {
            return reply(
                `🎌 *Anime Info*\n\n` +
                `Usage: .animeinfo <name | MAL id>\n` +
                `Example: .animeinfo jujutsu kaisen\n` +
                `Example: .animeinfo 40748`
            );
        }

        try {
            await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } }).catch(() => {});

            const a = await resolveAnime(query);
            if (!a) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply(`❌ No anime found for *${query}*.`);
            }

            const title    = a.title_english || a.title || a.title_japanese || 'Unknown';
            const genres   = (a.genres || []).map(g => g.name).join(', ');
            const studios  = (a.studios || []).map(s => s.name).join(', ');
            const aired    = a.aired?.string || (a.year ? String(a.year) : '');
            const synopsis = a.synopsis || '';

            let out = `🎌 *${title}*\n`;
            if (a.title_japanese) out += `🇯🇵 ${a.title_japanese}\n`;
            out += `\n`;
            if (a.type)      out += `🎭 Type: ${a.type}\n`;
            if (a.status)    out += `📡 Status: ${a.status}\n`;
            if (a.episodes)  out += `🎞️ Episodes: ${a.episodes}\n`;
            if (a.duration)  out += `⏱️ Duration: ${a.duration}\n`;
            if (a.score)     out += `⭐ Score: ${a.score}${a.scored_by ? ` (${a.scored_by.toLocaleString()} votes)` : ''}\n`;
            if (a.rank)      out += `🏆 Rank: #${a.rank}\n`;
            if (aired)       out += `📅 Aired: ${aired}\n`;
            if (studios)     out += `🏢 Studio: ${studios}\n`;
            if (genres)      out += `🏷️ Genres: ${genres}\n`;
            if (synopsis)    out += `\n📖 ${trim(synopsis, 800)}\n`;
            if (a.url)       out += `\n🔗 ${a.url}`;

            const thumb = a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || a.images?.webp?.image_url;
            if (thumb) {
                try {
                    await sock.sendMessage(from, { image: { url: thumb }, caption: out }, { quoted: msg });
                    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
                    return;
                } catch (_) { /* fall through */ }
            }
            await reply(out);
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
        } catch (err) {
            console.error('[animeinfo] error:', err.message);
            try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch {}
            reply('❌ Anime info fetch failed. Try again later.');
        }
    },
};
