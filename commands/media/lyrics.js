/**
 * .lyrics <song> [by <artist>] — find song lyrics via Genius API
 *
 * Example: .lyrics lovely by Billie Eilish
 *
 * Uses Genius API (https://api.genius.com) for reliable song search.
 * Shows song info + direct link to full lyrics.
 */
'use strict';
const axios = require('axios');

const GENIUS_TOKEN = 'oPSxDH9MWnORz8IYQuNhyvGoLxVCJ-ribPXtUuUkPH9qNVryxEhgpiN1L_LPp_jJOWpl9VrFDUBsQBa9jMWi3g';

const MAX_SNIPPET_LINES = 4;
const MAX_SNIPPET_CHARS = 250;

function parseQuery(raw) {
    // Accept "<song> by <artist>" or just "<song>"
    const byMatch = raw.match(/^(.+?)\s+by\s+(.+)$/i);
    if (byMatch) {
        return { title: byMatch[1].trim(), artist: byMatch[2].trim() };
    }
    return { title: raw.trim(), artist: '' };
}

function buildSnippet(text) {
    if (!text || typeof text !== 'string') return '';
    
    const lines = text.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('⚠'));
    
    const snippet = lines.slice(0, MAX_SNIPPET_LINES).join('\n');
    
    if (snippet.length > MAX_SNIPPET_CHARS) {
        return snippet.slice(0, MAX_SNIPPET_CHARS).trim() + '…';
    }
    if (lines.length > MAX_SNIPPET_LINES) {
        return snippet + '\n…';
    }
    return snippet;
}

module.exports = {
    name: 'lyrics',
    aliases: ['lyric', 'findlyrics', 'song'],
    description: 'Find song lyrics via Genius',
    category: 'media',
    usage: '.lyrics <song> [by <artist>]',

    async execute({ sock, msg, from, reply, args }) {
        const raw = (args || []).join(' ').trim();
        if (!raw) {
            return reply(
                `🎵 *Lyrics Finder (Genius)*\n\n` +
                `Usage: .lyrics <song> [by <artist>]\n` +
                `Example: .lyrics lovely by Billie Eilish\n\n` +
                `_Shows song info + link to full lyrics_`
            );
        }

        const { title, artist } = parseQuery(raw);

        try {
            await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } }).catch(() => {});

            const result = await fetchLyricsGenius(raw);

            if (!result) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply(
                    `❌ Song not found: *${title}*${artist ? ` by ${artist}` : ''}\n\n` +
                    `Try: .lyrics <song> by <artist>`
                );
            }

            const snippet = buildSnippet(result.preview);
            
            const out = `🎵 *${result.title}*\n👤 ${result.artist}\n\n` +
                (snippet ? `_${snippet}_\n\n` : '') +
                `🔗 Full lyrics: ${result.url}\n\n` +
                `> Lyrics © Genius`;

            await reply(out);
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
        } catch (err) {
            console.error('[lyrics] error:', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
            reply('❌ Lyrics search failed. Try again later.');
        }
    },
};

async function fetchLyricsGenius(query) {
    try {
        const res = await axios.get('https://api.genius.com/search', {
            params: { q: query },
            headers: {
                Authorization: `Bearer ${GENIUS_TOKEN}`,
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 15000,
            validateStatus: () => true
        });

        if (res.status >= 400) return null;
        if (!res.data?.response?.hits?.length) return null;

        const hit = res.data.response.hits[0]?.result;
        if (!hit) return null;

        return {
            title: hit.title || 'Unknown',
            artist: hit.primary_artist?.name || 'Unknown Artist',
            url: hit.url,
            preview: hit.description?.plain || '',
        };
    } catch (err) {
        console.error('[lyrics] genius fetch failed:', err.message);
        return null;
    }
}
