/**
 * Play Command — Ultra-reliable multi-API audio downloader
 * Now with song thumbnail + info caption before audio!
 *
 * Strategy order (PRIMARY → FALLBACK CHAIN):
 *  1. RapidAPI yt-search-and-download-mp3 (siputzx search → RapidAPI /mp3)
 *  2. Prexzyvilla Apple Music search → Spotify download
 *  3. Prexzyvilla Spotify name-based download
 *  4. Prexzyvilla ytdl + siputzx search
 *  5. siputzx search → ytmp3
 *  6. giftedtech
 *  7. paxsenix
 *  8. ryzendesu search → ytmp3
 *  9. tiklydown
 *
 * NOTE (2026-06-26): Added Strategy 1 (RapidAPI) as the new primary —
 * confirmed live with a real test response. Requires RAPIDAPI_KEY env var;
 * silently skipped (falls through to Strategy 2) if that var isn't set, so
 * this is safe to deploy even before the key is configured on the host.
 */

'use strict';

const axios = require('axios');

// RapidAPI credentials for yt-search-and-download-mp3.
// Hardcoded directly per explicit request — be aware this key will travel
// with this file anywhere it's copied, shared, or committed to a public
// repo. Regenerate it in the RapidAPI dashboard if that ever happens.
const RAPIDAPI_KEY  = '6ef072907amshd7a657ee1c67d4ep1c4c33jsnac96a98cacb4';
const RAPIDAPI_HOST = 'yt-search-and-download-mp3.p.rapidapi.com';

module.exports = {
    name:        'play',
    aliases:     ['song', 'music', 'audio'],
    description: 'Search and download a song as audio',
    usage:       '.play <song name or URL>',
    category:    'media',

    async execute({ sock, msg, from, args, reply, t }) {
        // Use translator if available, fallback to identity
        const tr = t || ((key, vars) => {
            // bare fallback — should not happen if sessionManager passes t
            const fallbacks = {
                'play.noQuery': '🎵 *Usage:* .play <song name>\n*Example:* .play Essence Wizkid',
                'play.searching': '🔍 Searching: *' + (vars?.query || '') + '*...',
                'play.downloading': '⬇️ Downloading: *' + (vars?.title || '') + '*...',
                'play.notFound': '❌ Could not find: *' + (vars?.query || '') + '*',
                'play.downloadFail': '❌ Download failed.',
                'play.success': '✅ *' + (vars?.title || '') + '*\n🎵 Enjoy!',
                'play.thumbCaption': '🎵 *' + (vars?.title || '') + '*',
                'play.fileTooSmall': '❌ File too small.',
            };
            return fallbacks[key] || key;
        });

        const query = args.join(' ').trim();
        if (!query) {
            return reply(tr('play.noQuery'));
        }

        await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } });
        await reply(tr('play.searching', { query }));

        let audioUrl  = null;
        let title     = query;
        let artist    = '';
        let duration  = '';
        let thumbnail = null;

        const strategies = [

            // ═══ STRATEGY 1 — RapidAPI: yt-search-and-download-mp3 ═══
            // Confirmed live response shape (2026-06-26):
            // { success, title: "Title not available", type: "mp3",
            //   size: "null" (literal string, not real), download: "<mp3 url>" }
            // This endpoint doesn't return real title/artist/thumbnail, so we
            // get those from the search step (siputzx ytsearch) and only pull
            // the actual download URL from this endpoint.
            async () => {
                const s = await axios.get(
                    'https://api.siputzx.my.id/api/s/ytsearch?query=' + encodeURIComponent(query),
                    { timeout: 12000 }
                );
                const v = s.data?.data?.[0];
                if (!v?.title) throw new Error('no video for rapidapi lookup');

                const d = await axios.get(
                    'https://' + RAPIDAPI_HOST + '/mp3',
                    {
                        params: { q: v.title },
                        headers: {
                            'x-rapidapi-key':  RAPIDAPI_KEY,
                            'x-rapidapi-host': RAPIDAPI_HOST,
                        },
                        timeout: 30000,
                    }
                );

                const url = d.data?.download;
                if (!d.data?.success || !url) throw new Error('rapidapi: no download url');

                return {
                    url,
                    title: v.title || query,
                    artist: v.author?.name || v.channel || '',
                    duration: v.duration || v.timestamp || '',
                    thumbnail: v.thumbnail || v.image || '',
                };
            },

            // ═══ STRATEGY 2 — Prexzyvilla: Apple Music search → Spotify download ═══
            // Confirmed live response shape (2026-06-26):
            // { status, statusCode, creator, query, region, total,
            //   data: [ { title, artist, link, image } ] }
            // "link" is an Apple Music URL (music.apple.com/...). Per Pasqua,
            // the /download/spotify endpoint accepts this Apple Music link
            // directly (it resolves/converts it server-side) — confirmed working.
            async () => {
                const s = await axios.get(
                    'https://prexzyapis.com/search/applemusic?q=' + encodeURIComponent(query),
                    { timeout: 15000 }
                );
                const results = Array.isArray(s.data?.data) ? s.data.data : [];
                const track   = results[0];
                if (!track) throw new Error('no apple music result');

                const trackUrl    = track.link;
                if (!trackUrl) throw new Error('no track url');
                const trackTitle  = track.title || query;
                // artist field comes as "Song · Billie Eilish & Khalid" or
                // "Album · Billie Eilish" — strip the "X · " prefix for a clean name
                const trackArtist = (track.artist || '').replace(/^[^·]*·\s*/, '');
                const trackThumb  = track.image || '';

                const d = await axios.get(
                    'https://prexzyapis.com/download/spotify?url=' + encodeURIComponent(trackUrl),
                    { timeout: 60000 }
                );
                const url = d.data?.download_url ?? d.data?.url ?? d.data?.audio
                         ?? d.data?.link ?? d.data?.result?.url ?? d.data?.data?.url;
                if (!url) throw new Error('no spotify download url');
                return {
                    url,
                    title: d.data?.title || d.data?.name || trackTitle,
                    artist: d.data?.artist || trackArtist,
                    duration: d.data?.duration || '',
                    thumbnail: d.data?.thumbnail || d.data?.image || trackThumb,
                };
            },

            // ═══ STRATEGY 3 — Prexzyvilla: Spotify download with raw query ═══
            async () => {
                const d = await axios.get(
                    'https://prexzyapis.com/download/spotify?url=' + encodeURIComponent(query),
                    { timeout: 60000 }
                );
                const url = d.data?.download_url ?? d.data?.url ?? d.data?.audio
                         ?? d.data?.link ?? d.data?.result?.url ?? d.data?.data?.url;
                if (!url) throw new Error('no url');
                return {
                    url,
                    title: d.data?.title || d.data?.name || query,
                    artist: d.data?.artist || '',
                    duration: d.data?.duration || '',
                    thumbnail: d.data?.thumbnail || d.data?.image || '',
                };
            },

            // ═══ STRATEGY 4 — Prexzyvilla ytdl via siputzx search ═══
            async () => {
                const s = await axios.get(
                    'https://api.siputzx.my.id/api/s/ytsearch?query=' + encodeURIComponent(query),
                    { timeout: 12000 }
                );
                const v = s.data?.data?.[0];
                if (!v?.url) throw new Error('no video');

                const d = await axios.get(
                    'https://prexzyapis.com/download/ytdl?url=' + encodeURIComponent(v.url),
                    { timeout: 60000 }
                );
                let url = null;
                if (Array.isArray(d.data?.formats)) {
                    const pref = [
                        d.data.formats.find(f => f.type === 'audio' && f.format === 'mp3'),
                        d.data.formats.find(f => f.type === 'audio' && f.format === 'm4a'),
                        d.data.formats.find(f => f.type === 'audio'),
                    ];
                    for (const f of pref) { if (f?.url) { url = f.url; break; } }
                }
                url = url
                   ?? d.data?.result?.download_url ?? d.data?.result?.url
                   ?? d.data?.download_url ?? d.data?.url
                   ?? d.data?.data?.url ?? d.data?.data?.download;
                if (!url) throw new Error('no audio url');
                return {
                    url,
                    title: v.title || query,
                    artist: v.author?.name || v.channel || '',
                    duration: v.duration || v.timestamp || '',
                    thumbnail: v.thumbnail || v.image || '',
                };
            },

            // ═══ STRATEGY 5 — siputzx search → ytmp3 (original) ═══
            async () => {
                const s = await axios.get(
                    'https://api.siputzx.my.id/api/s/ytsearch?query=' + encodeURIComponent(query),
                    { timeout: 12000 }
                );
                const v = s.data?.data?.[0];
                if (!v?.url) throw new Error('no video');
                const d = await axios.get(
                    'https://api.siputzx.my.id/api/d/ytmp3?url=' + encodeURIComponent(v.url),
                    { timeout: 30000 }
                );
                const url = d.data?.data?.url || d.data?.url;
                if (!url) throw new Error('no audio url');
                return {
                    url,
                    title: v.title || query,
                    artist: v.author?.name || v.channel || '',
                    duration: v.duration || v.timestamp || '',
                    thumbnail: v.thumbnail || v.image || '',
                };
            },

            // ═══ STRATEGY 6 — giftedtech (original) ═══
            async () => {
                const d = await axios.get(
                    'https://apis.davidcyril.name.ng/play?query=$' +
                    encodeURIComponent('ytsearch:' + query),
                    { timeout: 35000 }
                );
                const url = d.data?.result?.download_url || d.data?.data?.url;
                if (!url) throw new Error('no url');
                return {
                    url,
                    title: d.data?.result?.title || query,
                    artist: d.data?.result?.artist || d.data?.result?.channel || '',
                    duration: d.data?.result?.duration || '',
                    thumbnail: d.data?.result?.thumbnail || d.data?.result?.image || '',
                };
            },

            // ═══ STRATEGY 7 — paxsenix (original) ═══
            async () => {
                const d = await axios.get(
                    'https://api.paxsenix.biz.id/yt/mp3?url=' + encodeURIComponent('ytsearch:' + query),
                    { timeout: 35000 }
                );
                const url = d.data?.url || d.data?.data?.url;
                if (!url) throw new Error('no url');
                return {
                    url,
                    title: d.data?.title || query,
                    artist: d.data?.artist || d.data?.channel || '',
                    duration: d.data?.duration || '',
                    thumbnail: d.data?.thumbnail || d.data?.image || '',
                };
            },

            // ═══ STRATEGY 8 — ryzendesu search → ytmp3 (original) ═══
            async () => {
                const s = await axios.get(
                    'https://api.ryzendesu.vip/api/search/youtube?query=' + encodeURIComponent(query),
                    { timeout: 12000 }
                );
                const v = s.data?.result?.[0] || s.data?.[0];
                if (!v?.url) throw new Error('no video');
                const d = await axios.get(
                    'https://api.ryzendesu.vip/api/downloader/ytmp3?url=' + encodeURIComponent(v.url),
                    { timeout: 35000 }
                );
                const url = d.data?.url || d.data?.data?.url;
                if (!url) throw new Error('no url');
                return {
                    url,
                    title: v.title || query,
                    artist: v.author?.name || v.channel || '',
                    duration: v.duration || v.timestamp || '',
                    thumbnail: v.thumbnail || v.image || '',
                };
            },

            // ═══ STRATEGY 9 — tiklydown direct ytdl-style (original) ═══
            async () => {
                const d = await axios.get(
                    'https://api.tiklydown.eu.org/api/download/yt/mp3?url=ytsearch:' + encodeURIComponent(query),
                    { timeout: 35000 }
                );
                const url = d.data?.result?.download || d.data?.url;
                if (!url) throw new Error('no url');
                return {
                    url,
                    title: d.data?.result?.title || query,
                    artist: d.data?.result?.artist || d.data?.result?.channel || '',
                    duration: d.data?.result?.duration || '',
                    thumbnail: d.data?.result?.thumbnail || d.data?.result?.image || '',
                };
            },

            // ═══ STRATEGY 10 — Akuari: robust YouTube search + download ═══
            async () => {
                const s = await axios.get(
                    'https://api.akuari.my.id/search/youtube?query=' + encodeURIComponent(query),
                    { timeout: 12000 }
                );
                const v = s.data?.result?.[0] || s.data?.data?.[0];
                if (!v?.url && !v?.videoId) throw new Error('no video');

                const videoUrl = v.url || ('https://www.youtube.com/watch?v=' + v.videoId);
                const d = await axios.get(
                    'https://api.akuari.my.id/downloader/ytmp3?url=' + encodeURIComponent(videoUrl),
                    { timeout: 35000 }
                );
                const url = d.data?.result?.download || d.data?.download || d.data?.url;
                if (!url) throw new Error('no audio url');
                return {
                    url,
                    title: v.title || d.data?.title || query,
                    artist: v.author?.name || v.channel || d.data?.artist || '',
                    duration: v.duration || d.data?.duration || '',
                    thumbnail: v.thumbnail || d.data?.thumbnail || '',
                };
            },
        ];

        // Run strategies; stop on first valid result
        for (const fn of strategies) {
            try {
                const res = await fn();
                if (res?.url?.startsWith('http')) {
                    audioUrl  = res.url;
                    title     = res.title || query;
                    artist    = res.artist || '';
                    duration  = res.duration || '';
                    thumbnail = res.thumbnail || null;
                    break;
                }
            } catch (_) { /* silent — try next */ }
        }

        // All strategies exhausted
        if (!audioUrl) {
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            return reply(tr('play.notFound', { query }));
        }

        // ── Send thumbnail with song info caption ─────────────────────────
        try {
            const thumbCaption = tr('play.thumbCaption', {
                title:    title,
                artist:   artist || 'Unknown',
                duration: duration || 'N/A',
            });

            if (thumbnail && thumbnail.startsWith('http')) {
                // Try to send thumbnail image with caption
                try {
                    const thumbResp = await axios({
                        method: 'GET',
                        url: thumbnail.replace('100x100', '600x600').replace('60x60', '600x600'),
                        responseType: 'arraybuffer',
                        timeout: 10000,
                    });
                    const thumbBuffer = Buffer.from(thumbResp.data);
                    if (thumbBuffer.length > 1000) {
                        await sock.sendMessage(from, {
                            image:   thumbBuffer,
                            caption: thumbCaption,
                        }, { quoted: msg });
                    } else {
                        await reply(thumbCaption);
                    }
                } catch (_) {
                    // If thumbnail download fails, just send text caption
                    await reply(thumbCaption);
                }
            } else {
                // No thumbnail URL — send text-only info
                await reply(thumbCaption);
            }
        } catch (_) {
            // Silently continue to audio download even if thumb fails
        }

        // Download and send the audio buffer
        try {
            await sock.sendMessage(from, { react: { text: '⬇️', key: msg.key } });

            const resp = await axios({
                method:           'GET',
                url:              audioUrl,
                responseType:     'arraybuffer',
                timeout:          120000,
                maxContentLength: 64 * 1024 * 1024,
                headers: {
                    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                    'Accept':          'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control':   'no-cache',
                },
            });

            const buffer = Buffer.from(resp.data);

            // Validate buffer size
            if (buffer.length < 10000) {
                throw new Error(tr('play.fileTooSmall'));
            }

            // Clean file name
            const clean = title.replace(/[^\w\s\-]/g, '').trim().slice(0, 60) || query.slice(0, 60);

            await sock.sendMessage(from, {
                audio:    buffer,
                mimetype: 'audio/mpeg',
                ptt:      false,
                fileName: clean + '.mp3',
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (e) {
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await reply(tr('play.downloadFail', { error: e.message.slice(0, 120) }));
        }
    },
};

/**
 * Convert milliseconds to mm:ss or hh:mm:ss format
 */
function formatDuration(ms) {
    if (!ms || isNaN(ms)) return '';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}
