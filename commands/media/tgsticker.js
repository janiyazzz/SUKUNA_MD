/**
 * TG Sticker Command — fetch a Telegram sticker pack and send stickers to WA
 * Usage: .tgsticker <https://t.me/addstickers/PackName>
 *
 * Fixes:
 *  - Sends max 30 stickers with 2s delay between each (anti-spam)
 *  - Animated .tgs (Lottie) → animated WebP via ffmpeg (full motion preserved)
 *  - Video .webm stickers → animated WebP via ffmpeg (full motion preserved)
 *  - Static .webp/.png → proper 512x512 WebP
 *  - Validates buffer size before sending to avoid empty sticker sends
 */
'use strict';

const axios  = require('axios');
const sharp  = require('sharp');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const crypto = require('crypto');
const { exec, execSync } = require('child_process');
const zlib   = require('zlib');

const TG_TOKEN  = process.env.TG_BOT_TOKEN || '8761223803:AAHyYWvC6hiyWRzkWriPmi07H9bXUkTjbpY';
const TG_API    = `https://api.telegram.org/bot${TG_TOKEN}`;
const TG_FILE   = `https://api.telegram.org/file/bot${TG_TOKEN}`;
const MAX_SEND  = 30;   // max stickers to send per command
const DELAY_MS  = 2000; // delay between stickers to avoid WA flood

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
 * Convert any static image buffer → 512x512 WebP buffer WhatsApp accepts.
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
 * Convert .tgs (gzipped Lottie JSON) → animated WebP via ffmpeg.
 *
 * Pipeline:
 *  1. Gunzip the .tgs → raw Lottie JSON
 *  2. Use ffmpeg with lottie input (via pipe through python-lottie if available,
 *     otherwise use rlottie-python to render frames, or fall back to
 *     ffmpeg lavfi lottie demuxer)
 *  3. Export as animated WebP with full motion preserved
 *
 * Returns null if conversion fails entirely.
 */
async function tgsToAnimatedWebp(buf) {
    const tgsPath   = tmpFile('.tgs');
    const jsonPath  = tmpFile('.json');
    const framesDir = tmpFile('_frames');
    const outPath   = tmpFile('.webp');

    try {
        fs.writeFileSync(tgsPath, buf);
        fs.mkdirSync(framesDir, { recursive: true });

        // Step 1: gunzip .tgs → lottie json
        const jsonBuf = zlib.gunzipSync(fs.readFileSync(tgsPath));
        fs.writeFileSync(jsonPath, jsonBuf);

        // Step 2: parse fps and frame count from lottie json
        let fps = 30, totalFrames = 60;
        try {
            const lottie = JSON.parse(jsonBuf.toString('utf8'));
            fps         = lottie.fr  || 30;
            totalFrames = lottie.op  || 60; // out point (last frame)
        } catch { /* use defaults */ }

        // Step 3: try rlottie-python to render frames
        const pyScript = `
import sys, os
try:
    import rlottie_python as rl
    anim = rl.LottieAnimation.from_file(sys.argv[1])
    total = anim.lottie_animation_get_totalframe()
    w, h = 512, 512
    os.makedirs(sys.argv[2], exist_ok=True)
    for i in range(total):
        buf = anim.lottie_animation_render(i, (w, h))
        from PIL import Image
        img = Image.frombytes('RGBA', (w, h), bytes(buf))
        img.save(os.path.join(sys.argv[2], f'frame_{i:04d}.png'))
    print(total)
except Exception as e:
    print(f'ERR:{e}', file=sys.stderr)
    sys.exit(1)
`;
        const pyPath = tmpFile('.py');
        fs.writeFileSync(pyPath, pyScript);

        let renderOk = false;
        try {
            execSync(`python3 "${pyPath}" "${jsonPath}" "${framesDir}"`, { timeout: 60000 });
            renderOk = true;
        } catch { /* rlottie not available */ }
        try { fs.unlinkSync(pyPath); } catch {}

        if (renderOk) {
            // Frames rendered — now assemble into animated WebP
            await new Promise((res, rej) => {
                exec(
                    `ffmpeg -y -framerate ${fps} -i "${framesDir}/frame_%04d.png" ` +
                    `-vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" ` +
                    `-loop 0 -compression_level 6 -quality 90 "${outPath}"`,
                    { timeout: 60000 },
                    (err, _, stderr) => err ? rej(new Error(stderr || err.message)) : res()
                );
            });
        } else {
            // Fallback: ffmpeg lottie demuxer (available in some builds)
            await new Promise((res, rej) => {
                exec(
                    `ffmpeg -y -i "${jsonPath}" ` +
                    `-vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" ` +
                    `-loop 0 -compression_level 6 -quality 90 "${outPath}"`,
                    { timeout: 60000 },
                    (err, _, stderr) => err ? rej(new Error(stderr || err.message)) : res()
                );
            });
        }

        if (!fs.existsSync(outPath)) return null;
        const result = fs.readFileSync(outPath);
        if (result.length < 512) return null;
        return result;

    } catch (err) {
        console.error('[tgsticker] tgsToAnimatedWebp error:', err.message);
        return null;
    } finally {
        for (const f of [tgsPath, jsonPath, outPath]) {
            try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
        }
        try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch {}
    }
}

/**
 * Convert .webm (Telegram video sticker) → animated WebP via ffmpeg.
 * Full motion preserved — no single-frame extraction.
 *
 * Returns null if ffmpeg isn't installed or conversion fails.
 */
async function webmToAnimatedWebp(buf) {
    const inp = tmpFile('.webm');
    const out = tmpFile('.webp');
    try {
        fs.writeFileSync(inp, buf);

        await new Promise((res, rej) => {
            exec(
                `ffmpeg -y -i "${inp}" ` +
                `-vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba" ` +
                `-loop 0 -compression_level 6 -quality 90 "${out}"`,
                { timeout: 60000 },
                (err, _, stderr) => err ? rej(new Error(stderr || err.message)) : res()
            );
        });

        if (!fs.existsSync(out)) return null;
        const result = fs.readFileSync(out);
        if (result.length < 512) return null;
        return result;

    } catch (err) {
        console.error('[tgsticker] webmToAnimatedWebp error:', err.message);
        return null;
    } finally {
        for (const f of [inp, out]) try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
}

module.exports = {
    name:        'tgsticker',
    aliases:     ['tgstickers', 'tgs2wa'],
    description: 'Fetch up to 30 stickers from a Telegram sticker pack (motion preserved)',
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
                `Sending: ${toSend.length}${capped ? ` (capped at ${MAX_SEND})` : ''}\n\n` +
                `_Converting and sending… (2s delay between stickers)_`
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
                        // Animated Lottie sticker → animated WebP (full motion)
                        webpBuf = await tgsToAnimatedWebp(rawBuf);
                        if (!webpBuf) {
                            // Last resort: try static frame as fallback
                            console.warn('[tgsticker] animated fallback to static for', filePath);
                            failed++;
                            continue;
                        }
                    } else if (sticker.is_video || filePath.endsWith('.webm')) {
                        // Video sticker → animated WebP (full motion)
                        webpBuf = await webmToAnimatedWebp(rawBuf);
                        if (!webpBuf) {
                            // Last resort: try sending raw webm buffer
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
            if (capped)  summary += `\n\n_Pack has ${total} total — only first ${MAX_SEND} sent_`;
            await reply(summary);

        } catch (err) {
            console.error('[tgsticker] error:', err.message);
            try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch {}
            reply('❌ Error fetching sticker pack. Try again later.');
        }
    },
};
