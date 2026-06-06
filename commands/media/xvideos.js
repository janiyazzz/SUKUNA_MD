/**
 * Xvideos Command — NSFW search + download
 * Usage:
 *   .xv <query>           → search results
 *   .xv <xvideos url>     → download video (mp4 preferred, HLS fallback as link)
 *
 * Robust: never sends a non-media URL as a video to WhatsApp (which is what
 * caused the "video has a problem" error). If only an HLS stream or no file
 * is available, we send the metadata + link instead.
 */

'use strict';
const axios = require('axios');

const XV_URL_RE = /xvideos\.com\//i;
const MP4_RE = /\.mp4(\?|$)/i;
const M3U8_RE = /\.m3u8(\?|$)/i;

function pickMp4(files) {
    if (!files || typeof files !== 'object') return null;
    const candidates = [files.high, files.hd, files.HD, files.low, files.sd, files.SD, files.mp4];
    for (const c of candidates) {
        if (typeof c === 'string' && c.startsWith('http') && MP4_RE.test(c)) return c;
    }
    // fallback: any http url that's not the xvideos page
    for (const c of Object.values(files)) {
        if (typeof c === 'string' && c.startsWith('http') && !XV_URL_RE.test(c) && !M3U8_RE.test(c) && /\.(mp4|webm|mov)(\?|$)/i.test(c)) {
            return c;
        }
    }
    return null;
}

function pickHls(files) {
    if (!files || typeof files !== 'object') return null;
    if (typeof files.hls === 'string' && M3U8_RE.test(files.hls)) return files.hls;
    for (const c of Object.values(files)) {
        if (typeof c === 'string' && M3U8_RE.test(c)) return c;
    }
    return null;
}

function extractList(d) {
    const root = d?.data ?? d?.result ?? d ?? {};
    if (Array.isArray(root)) return root;
    if (Array.isArray(root.videos)) return root.videos;
    if (Array.isArray(root.results)) return root.results;
    if (Array.isArray(root.data)) return root.data;
    if (Array.isArray(root.items)) return root.items;
    return [];
}

async function search(query) {
    const ep = `https://apis.prexzyvilla.site/nsfw/xvideos-search?query=${encodeURIComponent(query)}`;
    const r = await axios.get(ep, { timeout: 25000 });
    return extractList(r.data);
}

async function download(url) {
    const ep = `https://apis.prexzyvilla.site/nsfw/xvideos-dl?url=${encodeURIComponent(url)}`;
    const r = await axios.get(ep, { timeout: 60000 });
    const root = r.data?.data || r.data?.result || r.data || {};
    const files = root.files || {};
    return {
        mp4: pickMp4(files),
        hls: pickHls(files),
        title: root.title || root.name || 'Xvideos',
        duration: root.duration || '',
        thumbnail: typeof root.thumb === 'string' && root.thumb.startsWith('http') ? root.thumb
                  : typeof root.thumbnail === 'string' && root.thumbnail.startsWith('http') ? root.thumbnail
                  : null,
        tags: Array.isArray(root.tags) ? root.tags : [],
        pageUrl: url,
    };
}

module.exports = {
    name: 'xvideos',
    aliases: ['xv', 'xvid', 'xvsearch'],
    description: 'Search or download Xvideos (NSFW)',
    category: 'media',
    nsfw: true,
    async execute({ sock, msg, from, reply, args }) {
        if (!args.length) {
            return reply(
                `🔞 *Xvideos*\n\n` +
                `Usage:\n` +
                `  .xv <query>          → search\n` +
                `  .xv <xvideos url>    → download\n\n` +
                `⚠️ NSFW — use only in allowed chats.`
            );
        }

        const input = args.join(' ').trim();

        try {
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            if (XV_URL_RE.test(input)) {
                const r = await download(input);

                // Best case: real MP4 → send as video
                if (r.mp4) {
                    try {
                        await sock.sendMessage(from, {
                            video: { url: r.mp4 },
                            mimetype: 'video/mp4',
                            caption: `🔞 *${r.title}*${r.duration ? `\n⏱️ ${r.duration}` : ''}\n\n> SUKUNA MD`,
                        }, { quoted: msg });
                        await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
                        return;
                    } catch (err) {
                        console.error('[xvideos] video send failed:', err.message);
                        // fall through to info reply
                    }
                }

                // No MP4: send thumbnail + link (HLS or page URL). WA can't play HLS directly.
                const info =
                    `🔞 *${r.title}*` +
                    (r.duration ? `\n⏱️ ${r.duration} min` : '') +
                    (r.tags.length ? `\n🏷️ ${r.tags.slice(0, 8).join(', ')}` : '') +
                    `\n\n${r.mp4 ? '⚠️ Direct MP4 failed to send. ' : '⚠️ No downloadable MP4 available for this video. '}` +
                    `Open the link below to watch:\n${r.pageUrl}` +
                    (r.hls ? `\n\n_HLS stream:_ ${r.hls}` : '');

                if (r.thumbnail) {
                    try {
                        await sock.sendMessage(from, { image: { url: r.thumbnail }, caption: info }, { quoted: msg });
                        await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
                        return;
                    } catch (_) { /* fall through */ }
                }
                await reply(info);
                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
                return;
            }

            const list = await search(input);
            if (!list.length) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return reply(`❌ No results for *${input}*.`);
            }

            const top = list.slice(0, 10);
            let out = `🔞 *Xvideos Results — "${input}"*\n\n`;
            top.forEach((v, i) => {
                const title = v.title || v.name || 'Untitled';
                const dur = v.duration || v.length || '';
                const views = v.views || v.viewCount || '';
                const link = v.url || v.link || '';
                out += `${i + 1}. *${title}*\n`;
                if (dur) out += `   ⏱️ ${dur} min`;
                if (views) out += `   👁️ ${views}`;
                if (dur || views) out += `\n`;
                if (link) out += `   🔗 ${link}\n`;
                out += `\n`;
            });
            out += `_Download:_ .xv <url>`;

            const thumb = top.map(t => t.thumb || t.thumbnail || t.image).find(t => typeof t === 'string' && /^https?:\/\//.test(t) && !/lightbox-blank/.test(t));
            if (thumb) {
                try {
                    await sock.sendMessage(from, { image: { url: thumb }, caption: out }, { quoted: msg });
                    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
                    return;
                } catch (_) { /* fall through */ }
            }
            await reply(out);
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.error('[xvideos] error:', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            reply('❌ Request failed. Please try again later.');
        }
    },
};
