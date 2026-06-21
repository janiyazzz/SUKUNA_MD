/**
 * .lyrics <song> by <artist> — find a song and show a short snippet
 *
 * Example: .lyrics lovely by Billie Eilish
 *
 * Uses lyrics.ovh (free, no API key) to confirm the song exists and pull
 * a short snippet for identification. Does NOT return full lyrics —
 * song lyrics are copyrighted, and reproducing the complete text (even
 * via a third-party API) isn't something this bot can do. Instead this
 * gives the song/artist confirmation, a short opening snippet, and a
 * direct link to a legitimate lyrics site for the rest.
 */
'use strict';
const axios = require('axios');

const MAX_SNIPPET_LINES = 4;
const MAX_SNIPPET_CHARS = 220;

function parseQuery(raw) {
    // Accept "<song> by <artist>" or just "<song>"
    const byMatch = raw.match(/^(.+?)\s+by\s+(.+)$/i);
    if (byMatch) {
        return { title: byMatch[1].trim(), artist: byMatch[2].trim() };
    }
    return { title: raw.trim(), artist: '' };
}

function buildSnippet(fullLyrics) {
    const lines = fullLyrics
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);
    const snippetLines = lines.slice(0, MAX_SNIPPET_LINES);
    let snippet = snippetLines.join('\n');
    if (snippet.length > MAX_SNIPPET_CHARS) {
        snippet = snippet.slice(0, MAX_SNIPPET_CHARS).trim() + '…';
    } else if (lines.length > MAX_SNIPPET_LINES) {
        snippet += '…';
    }
    return snippet;
}

module.exports = {
    name: 'lyrics',
    aliases: ['lyric', 'findlyrics'],
    description: 'Find a song and get a short snippet + link to full lyrics',
    category: 'media',
    usage: '.lyrics <song> by <artist>',

    async execute({ sock, msg, from, reply, args }) {
        const raw = (args || []).join(' ').trim();
        if (!raw) {
            return reply(
                `🎵 *Lyrics Finder*\n\n` +
                `Usage: .lyrics <song> by <artist>\n` +
                `Example: .lyrics lovely by Billie Eilish\n\n` +
                `_Note: shows a short snippet + a link for the full lyrics (copyright)._`
            );
        }

        const { title, artist } = parseQuery(raw);
        if (!artist) {
            return reply(
                `❌ Please include the artist.\n\n` +
                `Usage: .lyrics <song> by <artist>\n` +
                `Example: .lyrics lovely by Billie Eilish`
            );
        }

        try {
            await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } }).catch(() => {});

            const data = await fetchLyrics(artist, title);

            if (!data || !data.lyrics) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply(
                    `❌ Couldn't find *${title}*${artist ? ` by ${artist}` : ''}.\n\n` +
                    `Try the format: .lyrics <song> by <artist>`
                );
            }

            const snippet = buildSnippet(data.lyrics);
            const searchQuery = encodeURIComponent(`${title} ${artist} lyrics`.trim());
            const geniusLink = `https://genius.com/search?q=${searchQuery}`;

            const out =
                `🎵 *${title}*${artist ? `\n👤 ${artist}` : ''}\n\n` +
                `_${snippet}_\n\n` +
                `📖 Full lyrics: ${geniusLink}\n\n` +
                `> Lyrics are copyrighted — showing a short snippet only.`;

            await reply(out);
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
        } catch (err) {
            console.error('[lyrics] error:', err.message);
            try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch {}
            reply('❌ Lyrics search failed. Try again later.');
        }
    },
};

async function fetchLyrics(artist, title) {
    try {
        const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
        const res = await axios.get(url, { timeout: 20000, validateStatus: () => true });
        if (res.status !== 200 || !res.data?.lyrics) return null;
        return res.data;
    } catch (e) {
        console.error('[lyrics] fetch failed:', e.message);
        return null;
    }
}
