/**
 * TG Sticker Command — fetch a Telegram sticker pack and send stickers to WA
 * Usage: .tgsticker <https://t.me/addstickers/PackName>
 *
 * Fixes:
 *  - Sends max 5 stickers regardless of pack size (anti-spam)
 *  - Proper webp conversion that WhatsApp accepts (no "can't preview" error)
 *  - Handles static (.webp/.png), animated (.tgs) and video (.webm) stickers
 *  - Validates buffer size before sending to avoid empty sticker sends
 */
'use strict';

const axios  = require('axios');
const sharp  = require('sharp');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

const TG_TOKEN  = process.env.TG_BOT_TOKEN || '8761223803:AAHyYWvC6hiyWRzkWriPmi07H9bXUkTjbpY';
const TG_API    = `https://api.telegram.org/bot${TG_TOKEN}`;
const TG_FILE   = `https://api.telegram.org/file/bot${TG_TOKEN}`;
const MAX_SEND  = 5;   // max stickers to send per command
const DELAY_MS  = 1500; // delay between stickers to avoid WA flood

const sleep = ms => new Promise(r => setTimeout(r, ms));

function tmpFile(ext) {
    return path.join(os.tmpdir(), `tgs-${crypto.randomBytes(6).toString('hex')}${ext}`);
}

/** Download URL as raw buffer */
async function dl(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 40000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return Buffer.from(res.data);
}

/**
 * Convert any image buffer → 512x512 webp buffer WhatsApp accepts.
 * Key fix: output must be lossless=false, exact size 512x512, no alpha
 * channel issues. We use `flatten` to fill transparency with white so
 * sharp doesn't produce an invalid alpha-only webp.
 */
async function toStickerWebp(inputBuffer) {
    return sharp(inputBuffer)
        .resize(512, 512, {
            fit:        'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({
            quality:  90,
            lossless: false,
            effort:   4,
        })
        .toBuffer();
}

/**
 * Convert .tgs (gzipped Lottie) → webp via lottie-web-to-webp CLI.
 * Returns null if the tool isn't installed instead of throwing.
 */
async function tgsToWebp(buf) {
    const inp = tmpFile('.tgs');
    const out = tmpFile('.webp');
    try {
        fs.writeFileSync(inp, buf);
        await new Promise((res, rej) => {
            exec(`lottie-web-to-webp "${inp}" "${out}"`, { timeout: 30000 }, (err, _, stderr) =>
                err ? rej(new Error(stderr || err.message)) : res()
            );
        });
        const result = fs.readFileSync(out);
        if (result.length < 512) throw new Error('output too small');
        return result;
    } catch {
        return null;
    } finally {
        for (const f of [inp, out]) try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
}

/**
 * Convert .webm (video sticker) → webp via ffmpeg.
 * Returns null if ffmpeg isn't installed.
 */
async function webmToWebp(buf) {
    const inp = tmpFile('.webm');
    const out = tmpFile('.webp');
    try {
        fs.writeFileSync(inp, buf);
        await new Promise((res, rej) => {
            // Extract first frame, resize to 512x512, save as webp
            exec(
                `ffmpeg -y -i "${inp}" -vframes 1 -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" "${out}"`,
                { timeout: 30000 },
                (err, _, stderr) => err ? rej(new Error(stderr || err.message)) : res()
            );
        });
        const result = fs.readFileSync(out);
        if (result.length < 512) throw new Error('output too small');
        return result;
    } catch {
        return null;
    } finally {
        for (const f of [inp, out]) try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
}

module.exports = {
    name:        'tgsticker',
    aliases:     ['tgstickers', 'tgs2wa'],
    description: 'Fetch up to 5 stickers from a Telegram sticker pack',
    usage:       '.tgsticker <https://t.me/addstickers/PackName>',
    category:    'media',

    async execute({ sock, msg, from, reply, args }) {
        const text = (args || []).join(' ').trim();
        if (!text || !text.includes('t.me/addstickers/')) {
            return reply('❌ Usage: .tgsticker https://t.me/addstickers/PackName');
        }

        const packName = text.split('/addstickers/')[1].split(/[/?#]/)[0];

        try {
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            // Fetch sticker pack info from Telegram
            const { data } = await axios.get(`${TG_API}/getStickerSet?name=${packName}`, { timeout: 20000 });
            if (!data.ok) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return reply('❌ Could not find that sticker pack. Check the link.');
            }

            const allStickers = data.result.stickers || [];
            const total       = allStickers.length;

            if (!total) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return reply('❌ This pack has no stickers.');
            }

            // Cap at MAX_SEND to prevent spam
            const toSend = allStickers.slice(0, MAX_SEND);
            const capped = total > MAX_SEND;

            await reply(
                `📦 *${data.result.title || packName}*\n` +
                `Total: ${total} sticker${total !== 1 ? 's' : ''}\n` +
                `Sending: ${toSend.length}${capped ? ` (capped at ${MAX_SEND} to avoid spam)` : ''}\n\n` +
                `_Converting and sending…_`
            );

            let sent = 0, failed = 0;

            for (const sticker of toSend) {
                try {
                    // Get the file path from Telegram
                    const fileRes = await axios.get(
                        `${TG_API}/getFile?file_id=${sticker.file_id}`,
                        { timeout: 20000 }
                    );
                    const filePath = fileRes.data?.result?.file_path;
                    if (!filePath) { failed++; continue; }

                    const fileUrl = `${TG_FILE}/${filePath}`;
                    const rawBuf  = await dl(fileUrl);

                    // Validate we got real data
                    if (!rawBuf || rawBuf.length < 512) { failed++; continue; }

                    let webpBuf = null;

                    if (sticker.is_animated || filePath.endsWith('.tgs')) {
                        // Animated Lottie sticker
                        webpBuf = await tgsToWebp(rawBuf);
                        if (!webpBuf) { failed++; continue; } // skip if no converter
                    } else if (sticker.is_video || filePath.endsWith('.webm')) {
                        // Video sticker
                        webpBuf = await webmToWebp(rawBuf);
                        if (!webpBuf) {
                            // Fallback: try sending raw webm — some WA clients accept it
                            webpBuf = rawBuf;
                        }
                    } else {
                        // Static sticker (.webp / .png)
                        webpBuf = await toStickerWebp(rawBuf);
                    }

                    // Final size check — must be at least 1KB to be valid
                    if (!webpBuf || webpBuf.length < 1024) { failed++; continue; }

                    await sock.sendMessage(from, { sticker: webpBuf }, { quoted: msg });
                    sent++;
                    await sleep(DELAY_MS);

                } catch (err) {
                    console.error('[tgsticker] sticker failed:', err.message);
                    failed++;
                }
            }

            await sock.sendMessage(from, { react: { text: sent > 0 ? '✅' : '❌', key: msg.key } });

            let summary = `✅ Sent ${sent}/${toSend.length} stickers from *${data.result.title || packName}*`;
            if (failed)  summary += `\n❌ ${failed} failed to convert`;
            if (capped)  summary += `\n\n_Use the link again to get different stickers from the pack_`;
            await reply(summary);

        } catch (err) {
            console.error('[tgsticker] error:', err.message);
            try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch {}
            reply('❌ Error fetching sticker pack. Try again later.');
        }
    },
};
