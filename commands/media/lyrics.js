/**
 * .lyrics <song> by <artist> — find a song and show a short snippet
 *
 * Example: .lyrics lovely by Billie Eilish
 *
 * Uses https://apis.prexzyvilla.site/search/lyrics?title= (as given) to
 * find the song. The exact response shape couldn't be confirmed live
 * (the test request 400'd with no visible body from this environment),
 * so the result is parsed defensively — checking several plausible field
 * names for the lyrics text/title/artist rather than assuming one exact
 * shape, the same approach used for the other prexzyvilla-backed commands.
 *
 * Does NOT return full lyrics — song lyrics are copyrighted, and
 * reproducing the complete text (even via a third-party API) isn't
 * something this bot can do. Instead this gives song/artist confirmation,
 * a short opening snippet, and a direct link to a legitimate lyrics site
 * for the rest.
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

// Defensive extraction — real field names for the prexzyvilla response
// were never confirmed, so this checks a wide list of plausible names
// (including one level of nesting under data/result) before giving up.
function extractSongInfo(payload) {
    const root = payload?.data ?? payload?.result ?? payload ?? {};
    const candidate = Array.isArray(root) ? (root[0] || {}) : root;

    const lyrics = candidate.lyrics || candidate.lyric || candidate.text ||
        candidate.content || candidate.result?.lyrics || null;

    const title = candidate.title || candidate.song || candidate.name || null;
    const artist = candidate.artist || candidate.artists || candidate.singer || null;

    if (!lyrics || typeof lyrics !== 'string') return null;
    return {
        lyrics,
        title: typeof title === 'string' ? title : null,
        artist: typeof artist === 'string' ? artist : (Array.isArray(artist) ? artist.join(', ') : null),
    };
}

module.exports = {
    name: 'lyrics',
    aliases: ['lyric', 'findlyrics'],
    description: 'Find a song and get a short snippet + link to full lyrics',
    category: 'media',
    usage: '.lyrics <song> [by <artist>]',

    async execute({ sock, msg, from, reply, args }) {
        const raw = (args || []).join(' ').trim();
        if (!raw) {
            return reply(
                `🎵 *Lyrics Finder*\n\n` +
                `Usage: .lyrics <song> [by <artist>]\n` +
                `Example: .lyrics lovely by Billie Eilish\n\n` +
                `_Note: shows a short snippet + a link for the full lyrics (copyright)._`
            );
        }

        const { title, artist } = parseQuery(raw);
        // The prexzyvilla endpoint only takes a single "title" query param,
        // so we search using the whole query exactly as typed — this lets
        // it match on song+artist together if its backend supports that.
        const searchTitle = raw;

        try {
            await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } }).catch(() => {});

            const info = await fetchLyrics(searchTitle);

            if (!info) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply(
                    `❌ Couldn't find *${title}*${artist ? ` by ${artist}` : ''}.\n\n` +
                    `Try the format: .lyrics <song> by <artist>`
                );
            }

            const displayTitle = info.title || title;
            const displayArtist = info.artist || artist;

            const snippet = buildSnippet(info.lyrics);
            const searchQuery = encodeURIComponent(`${displayTitle} ${displayArtist || ''} lyrics`.trim());
            const geniusLink = `https://genius.com/search?q=${searchQuery}`;

            const out =
                `🎵 *${displayTitle}*${displayArtist ? `\n👤 ${displayArtist}` : ''}\n\n` +
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

async function fetchLyrics(title) {
    try {
        const url = 'https://apis.prexzyvilla.site/search/lyrics';
        const res = await axios.get(url, {
            params: { title },
            timeout: 25000,
            validateStatus: () => true,
        });
        if (res.status >= 400 || !res.data) return null;
        return extractSongInfo(res.data);
    } catch (e) {
        console.error('[lyrics] fetch failed:', e.message);
        return null;
    }
}
