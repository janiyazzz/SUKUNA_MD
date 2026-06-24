/**
 * .lyrics <song> [by <artist>] — find song lyrics via Genius API
 *
 * Example: .lyrics lovely by Billie Eilish
 *
 * Genius's documented auth is `Authorization: Bearer <client_access_token>`
 * against https://api.genius.com/search?q=... — confirmed against Genius's
 * own docs/examples. If this still fails, the error block below now logs
 * the actual HTTP status + response body instead of swallowing it, so the
 * real cause (bad token, wrong token type, rate limit, etc.) shows up in
 * your bot's console logs instead of just "search failed".
 */
'use strict';
const axios = require('axios');

const GENIUS_TOKEN = 'oPSxDH9MWnORz8IYQuNhyvGoLxVCJ-ribPXtUuUkPH9qNVryxEhgpiN1L_LPp_jJOWpl9VrFDUBsQBa9jMWi3g';

const MAX_SNIPPET_CHARS = 250;

function parseQuery(raw) {
    const byMatch = raw.match(/^(.+?)\s+by\s+(.+)$/i);
    if (byMatch) return { title: byMatch[1].trim(), artist: byMatch[2].trim() };
    return { title: raw.trim(), artist: '' };
}

function buildSnippet(text) {
    if (!text || typeof text !== 'string') return '';
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    return clean.length > MAX_SNIPPET_CHARS ? clean.slice(0, MAX_SNIPPET_CHARS).trim() + '…' : clean;
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
                `Example: .lyrics lovely by Billie Eilish`
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
                    `Check the bot console for [lyrics] logs — it now prints the exact ` +
                    `API status/error so we can see what's actually happening.`
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
            console.error('[lyrics] unexpected error:', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
            reply('❌ Lyrics search failed. Try again later.');
        }
    },
};

async function fetchLyricsGenius(query) {
    try {
        const res = await axios.get('https://api.genius.com/search', {
            params: { q: query },
            headers: { Authorization: `Bearer ${GENIUS_TOKEN}` },
            timeout: 15000,
            validateStatus: () => true, // so we can inspect non-2xx ourselves below
        });

        // Surface the real cause instead of a generic failure.
        if (res.status !== 200) {
            console.error(
                `[lyrics] Genius returned HTTP ${res.status}:`,
                JSON.stringify(res.data).slice(0, 300)
            );
            return null;
        }

        const hits = res.data?.response?.hits;
        if (!hits?.length) {
            console.error('[lyrics] Genius 200 but no hits for query:', query);
            return null;
        }

        const hit = hits[0]?.result;
        if (!hit) return null;

        return {
            title: hit.title || 'Unknown',
            artist: hit.primary_artist?.name || 'Unknown Artist',
            url: hit.url,
            preview: hit.description?.plain || '',
        };
    } catch (err) {
        // Network-level failure (DNS, timeout, TLS, etc.) vs. an HTTP error.
        console.error('[lyrics] Genius request failed:', err.code || err.message);
        return null;
    }
}
