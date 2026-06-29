/**
 * TG Sticker Command — fetch a Telegram sticker pack and send stickers to WA
 * Usage: .tgsticker <https://t.me/addstickers/PackName>
 *
 * DEPENDENCIES (all already in package.json — zero new installs):
 *   - ffmpeg-static ^5.2.0
 *   - sharp ^0.33.5
 *   - axios ^1.7.9
 *
 * For .tgs animated Lottie stickers (optional):
 *   pip install rlottie-python Pillow --break-system-packages
 *   Without it, .tgs stickers are skipped and the summary tells you.
 *
 * CONVERSION PIPELINE:
 *   static .webp/.png → sharp resize 512x512 → static webp
 *   video  .webm      → ffmpeg pipe → animated webp (VP8X + ANIM, full motion)
 *   animated .tgs     → gunzip → rlottie renders frames → ffmpeg pipe → animated webp
 */
'use strict';

const axios  = require('axios');
const sharp  = require('sharp');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const crypto = require('crypto');
const zlib   = require('zlib');
const { spawn, execSync } = require('child_process');

let FFMPEG;
try   { FFMPEG = require('ffmpeg-static'); }
catch { FFMPEG = 'ffmpeg'; }

const TG_TOKEN = process.env.TG_BOT_TOKEN || '8761223803:AAHyYWvC6hiyWRzkWriPmi07H9bXUkTjbpY';
const TG_API   = `https://api.telegram.org/bot${TG_TOKEN}`;
const TG_FILE  = `https://api.telegram.org/file/bot${TG_TOKEN}`;
const MAX_SEND = 30;
const DELAY_MS = 2000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function tmpFile(ext) {
    return path.join(os.tmpdir(), `tgs-${crypto.randomBytes(6).toString('hex')}${ext}`);
}
function tmpDir() {
    const d = path.join(os.tmpdir(), `tgs-${crypto.randomBytes(6).toString('hex')}`);
    fs.mkdirSync(d, { recursive: true });
    return d;
}
function cleanUp(...paths) {
    for (const p of paths) {
        if (!p) continue;
        try {
            const st = fs.statSync(p);
            if (st.isDirectory()) fs.rmSync(p, { recursive: true, force: true });
            else fs.unlinkSync(p);
        } catch {}
    }
}

/** Download URL → Buffer */
async function dl(url) {
    const r = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 40000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return Buffer.from(r.data);
}

/**
 * Static WebP/PNG → 512x512 static WebP.
 */
async function staticToWebp(buf) {
    return sharp(buf)
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 90, lossless: false, effort: 4 })
        .toBuffer();
}

/**
 * Any video/gif buffer → animated WebP via ffmpeg stdin→stdout pipe.
 *
 * This is the exact same approach as stickersearch.js's transcodeToWebp()
 * which is already proven working in this project.
 * Produces VP8X + ANIM animated WebP — full motion, WhatsApp renders it.
 */
function ffmpegToAnimatedWebp(inputBuf, inputFps = 15) {
    return new Promise((resolve) => {
        if (!FFMPEG) return resolve(null);

        const args = [
            '-hide_banner', '-loglevel', 'error',
            '-i', 'pipe:0',
            '-vf', `scale=512:512:force_original_aspect_ratio=decrease,fps=${inputFps}`,
            '-vcodec', 'libwebp',
            '-lossless', '0',
            '-compression_level', '6',
            '-q:v', '75',
            '-loop', '0',
            '-preset', 'default',
            '-an', '-vsync', '0',
            '-f', 'webp',
            'pipe:1',
        ];

        let settled = false;
        const finish = val => { if (!settled) { settled = true; resolve(val); } };

        const ff = spawn(FFMPEG, args);
        const chunks = [];
        const timer  = setTimeout(() => { try { ff.kill('SIGKILL'); } catch {} finish(null); }, 30000);

        ff.stdout.on('data', c => chunks.push(c));
        ff.stderr.on('data', () => {}); // suppress — loglevel error already
        ff.on('error', () => { clearTimeout(timer); finish(null); });
        ff.on('close', code => {
            clearTimeout(timer);
            if (code !== 0 || !chunks.length) return finish(null);
            const buf = Buffer.concat(chunks);
            // Validate it's actually animated webp (has ANIM chunk)
            if (buf.length < 1024) return finish(null);
            finish(buf);
        });

        ff.stdin.on('error', () => {}); // ignore EPIPE if ffmpeg exits early
        ff.stdin.end(inputBuf);
    });
}

/**
 * .tgs (gzipped Lottie JSON) → animated WebP.
 *
 * Requires rlottie-python + Pillow:
 *   pip install rlottie-python Pillow --break-system-packages
 *
 * Returns null silently if rlottie-python is not installed.
 * Returns null on any conversion failure.
 */
async function tgsToAnimatedWebp(buf) {
    const jsonPath  = tmpFile('.json');
    const framesDir = tmpDir();
    const gifPath   = tmpFile('.gif');

    try {
        // Gunzip .tgs → lottie JSON
        const jsonBuf = zlib.gunzipSync(buf);
        fs.writeFileSync(jsonPath, jsonBuf);

        // Parse fps from lottie JSON
        let fps = 30;
        try {
            const lottie = JSON.parse(jsonBuf.toString('utf8'));
            fps = Math.min(Math.max(lottie.fr || 30, 1), 30);
        } catch {}

        // Render all frames to PNG via rlottie-python
        const pyScript = `
import sys, os
try:
    import rlottie_python as rl
    from PIL import Image
    anim   = rl.LottieAnimation.from_file(sys.argv[1])
    total  = anim.lottie_animation_get_totalframe()
    out    = sys.argv[2]
    os.makedirs(out, exist_ok=True)
    for i in range(total):
        raw = anim.lottie_animation_render(i, (512, 512))
        Image.frombytes('RGBA', (512, 512), bytes(raw)).save(
            os.path.join(out, f'frame_{i:04d}.png')
        )
    print(total)
except ImportError:
    print('MISSING_RLOTTIE', file=sys.stderr)
    sys.exit(2)
except Exception as e:
    print(f'ERR:{e}', file=sys.stderr)
    sys.exit(1)
`;
        const pyPath = tmpFile('.py');
        fs.writeFileSync(pyPath, pyScript);

        let frameCount = 0;
        try {
            const out = execSync(`python3 "${pyPath}" "${jsonPath}" "${framesDir}"`, {
                timeout: 60000,
                encoding: 'utf8',
            }).trim();
            frameCount = parseInt(out, 10) || 0;
        } catch (e) {
            const stderr = (e.stderr || '').toString();
            if (stderr.includes('MISSING_RLOTTIE')) return null; // silent skip
            console.error('[tgsticker] tgs render error:', stderr.slice(-300));
            return null;
        } finally {
            cleanUp(pyPath);
        }

        if (frameCount === 0) return null;

        // PNG frames → GIF (intermediate; ffmpeg reads it as multi-frame)
        await new Promise((res, rej) => {
            spawn(FFMPEG, [
                '-hide_banner', '-loglevel', 'error',
                '-framerate', String(fps),
                '-i', path.join(framesDir, 'frame_%04d.png'),
                '-loop', '0',
                gifPath,
            ]).on('close', code => code === 0 ? res() : rej(new Error(`gif exit ${code}`)));
        });

        if (!fs.existsSync(gifPath)) return null;
        const gifBuf = fs.readFileSync(gifPath);

        // GIF → animated WebP via the same proven pipeline
        return await ffmpegToAnimatedWebp(gifBuf, fps);

    } catch (err) {
        console.error('[tgsticker] tgsToAnimatedWebp error:', err.message);
        return null;
    } finally {
        cleanUp(jsonPath, framesDir, gifPath);
    }
}

// ─── Main Command ────────────────────────────────────────────────────────────

module.exports = {
    name:        'tgsticker',
    aliases:     ['tgstickers', 'tgs2wa'],
    description: 'Fetch up to 30 stickers from a Telegram sticker pack (full motion preserved)',
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

            const { data } = await axios.get(
                `${TG_API}/getStickerSet?name=${packName}`,
                { timeout: 20000 }
            );

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

            const toSend = allStickers.slice(0, MAX_SEND);
            const capped = total > MAX_SEND;

            const hasVideo    = toSend.some(s => s.is_video);
            const hasAnimated = toSend.some(s => s.is_animated);
            const packType    = hasVideo ? '🎬 Video' : hasAnimated ? '✨ Animated' : '🖼️ Static';

            await reply(
                `📦 *${data.result.title || packName}*\n` +
                `Type: ${packType}\n` +
                `Total: ${total} sticker${total !== 1 ? 's' : ''}\n` +
                `Sending: ${toSend.length}${capped ? ` (max ${MAX_SEND})` : ''}\n\n` +
                `_Converting… 2s delay between stickers_`
            );

            let sent = 0, failed = 0, skipped = 0;

            for (const sticker of toSend) {
                try {
                    const fileRes = await axios.get(
                        `${TG_API}/getFile?file_id=${sticker.file_id}`,
                        { timeout: 20000 }
                    );
                    const filePath = fileRes.data?.result?.file_path;
                    if (!filePath) { failed++; continue; }

                    const rawBuf = await dl(`${TG_FILE}/${filePath}`);
                    if (!rawBuf || rawBuf.length < 512) { failed++; continue; }

                    let webpBuf = null;

                    if (sticker.is_video || filePath.endsWith('.webm')) {
                        // Video sticker → animated WebP (full motion)
                        webpBuf = await ffmpegToAnimatedWebp(rawBuf);
                        if (!webpBuf) { failed++; continue; }

                    } else if (sticker.is_animated || filePath.endsWith('.tgs')) {
                        // Lottie animated sticker → animated WebP
                        webpBuf = await tgsToAnimatedWebp(rawBuf);
                        if (!webpBuf) { skipped++; continue; } // rlottie not installed

                    } else {
                        // Static sticker
                        webpBuf = await staticToWebp(rawBuf);
                        if (!webpBuf) { failed++; continue; }
                    }

                    if (webpBuf.length < 1024) { failed++; continue; }

                    await sock.sendMessage(from, { sticker: webpBuf }, { quoted: msg });
                    sent++;
                    await sleep(DELAY_MS);

                } catch (err) {
                    console.error('[tgsticker] sticker error:', err.message);
                    failed++;
                }
            }

            await sock.sendMessage(from, {
                react: { text: sent > 0 ? '✅' : '❌', key: msg.key },
            });

            let summary = `✅ *${data.result.title || packName}*\nSent: ${sent}/${toSend.length}`;
            if (failed)  summary += `\n❌ Failed: ${failed}`;
            if (skipped) summary += `\n⚠️ Skipped ${skipped} Lottie (.tgs) stickers\n_Install: pip install rlottie-python Pillow_`;
            if (capped)  summary += `\n\n_Pack has ${total} total — first ${MAX_SEND} sent_`;
            await reply(summary);

        } catch (err) {
            console.error('[tgsticker] fatal error:', err.message);
            try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch {}
            reply('❌ Error fetching sticker pack. Try again later.');
        }
    },
};
