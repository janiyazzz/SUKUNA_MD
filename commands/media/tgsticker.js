/**
 * TG Sticker Command — fetch a Telegram sticker pack and send stickers to WA
 * Usage: .tgsticker <https://t.me/addstickers/PackName>
 *
 * REQUIREMENTS (all already in package.json):
 *   - sharp ^0.33.5
 *   - ffmpeg-static ^5.2.0
 *   - node-webpmux ^3.1.6
 *
 * For animated .tgs Lottie stickers (optional — .webm video stickers work without this):
 *   pip install rlottie-python Pillow --break-system-packages
 *   OR: pip install rlottie-python Pillow  (inside your venv)
 *
 * Pipeline:
 *   static .webp/.png  → sharp resize 512x512 → webp ✅
 *   video  .webm       → ffmpeg-static → gif (all frames) → sharp(animated) → webp ✅
 *   animated .tgs      → gunzip → json → rlottie renders png frames → sharp(animated) → webp ✅
 *                        (skipped gracefully if rlottie-python not installed)
 */
'use strict';

const axios   = require('axios');
const sharp   = require('sharp');
const fs      = require('fs');
const os      = require('os');
const path    = require('path');
const crypto  = require('crypto');
const zlib    = require('zlib');
const { execSync, exec } = require('child_process');

// Use bundled ffmpeg-static — no system ffmpeg dependency
let FFMPEG_PATH;
try {
    FFMPEG_PATH = require('ffmpeg-static');
} catch {
    FFMPEG_PATH = 'ffmpeg'; // fallback to system ffmpeg
}

const TG_TOKEN = process.env.TG_BOT_TOKEN || '8761223803:AAHyYWvC6hiyWRzkWriPmi07H9bXUkTjbpY';
const TG_API   = `https://api.telegram.org/bot${TG_TOKEN}`;
const TG_FILE  = `https://api.telegram.org/file/bot${TG_TOKEN}`;
const MAX_SEND = 30;    // max stickers per command
const DELAY_MS = 2000;  // ms between sends to avoid WA flood

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
        try {
            if (!p) continue;
            const stat = fs.statSync(p);
            if (stat.isDirectory()) fs.rmSync(p, { recursive: true, force: true });
            else fs.unlinkSync(p);
        } catch { /* already gone */ }
    }
}

/** Download URL → raw Buffer */
async function dl(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 40000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return Buffer.from(res.data);
}

/**
 * Static sticker: resize to 512x512, output WebP.
 * Works on any static .webp or .png input.
 */
async function staticToWebp(buf) {
    return sharp(buf)
        .resize(512, 512, {
            fit:        'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 90, lossless: false, effort: 4 })
        .toBuffer();
}

/**
 * Video sticker (.webm) → animated WebP.
 *
 * Pipeline:
 *   .webm → ffmpeg → 512x512 GIF (all frames, transparency-safe) → sharp animated → WebP
 *
 * Uses ffmpeg-static (already in package.json) + sharp (already in package.json).
 * No extra installs needed.
 *
 * Returns null on failure.
 */
async function webmToAnimatedWebp(buf) {
    const inPath  = tmpFile('.webm');
    const gifPath = tmpFile('.gif');

    try {
        fs.writeFileSync(inPath, buf);

        // Step 1: webm → gif with all frames at 512x512
        // Using split/palettegen for better gif quality and transparency
        await new Promise((res, rej) => {
            exec(
                `"${FFMPEG_PATH}" -y -i "${inPath}" ` +
                `-vf "fps=15,scale=512:512:force_original_aspect_ratio=decrease,` +
                `pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0" ` +
                `-loop 0 "${gifPath}"`,
                { timeout: 60000 },
                (err, _, stderr) => {
                    if (err) return rej(new Error(stderr?.slice(-300) || err.message));
                    res();
                }
            );
        });

        if (!fs.existsSync(gifPath)) return null;
        const gifSize = fs.statSync(gifPath).size;
        if (gifSize < 512) return null;

        // Step 2: animated gif → animated WebP via sharp
        const webpBuf = await sharp(gifPath, { animated: true })
            .resize(512, 512, {
                fit:        'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .webp({ quality: 90, lossless: false, effort: 4 })
            .toBuffer();

        if (!webpBuf || webpBuf.length < 1024) return null;
        return webpBuf;

    } catch (err) {
        console.error('[tgsticker] webmToAnimatedWebp error:', err.message);
        return null;
    } finally {
        cleanUp(inPath, gifPath);
    }
}

/**
 * Animated Lottie sticker (.tgs) → animated WebP.
 *
 * Requires: pip install rlottie-python Pillow --break-system-packages
 *
 * Pipeline:
 *   .tgs (gzipped JSON) → gunzip → JSON → rlottie renders PNG frames
 *   → ffmpeg assembles GIF → sharp animated → WebP
 *
 * Returns null if rlottie-python is not installed (graceful skip).
 */
async function tgsToAnimatedWebp(buf) {
    const tgsPath    = tmpFile('.tgs');
    const jsonPath   = tmpFile('.json');
    const framesDir  = tmpDir();
    const gifPath    = tmpFile('.gif');

    try {
        fs.writeFileSync(tgsPath, buf);

        // Gunzip .tgs → lottie JSON
        const jsonBuf = zlib.gunzipSync(buf);
        fs.writeFileSync(jsonPath, jsonBuf);

        // Parse fps from lottie JSON for accurate output framerate
        let fps = 30;
        try {
            const lottie = JSON.parse(jsonBuf.toString('utf8'));
            fps = Math.min(lottie.fr || 30, 30); // cap at 30fps
        } catch { /* use default */ }

        // Render frames with rlottie-python
        const pyScript = `
import sys, os
try:
    import rlottie_python as rl
    from PIL import Image

    anim   = rl.LottieAnimation.from_file(sys.argv[1])
    total  = anim.lottie_animation_get_totalframe()
    frames_dir = sys.argv[2]
    os.makedirs(frames_dir, exist_ok=True)

    for i in range(total):
        raw = anim.lottie_animation_render(i, (512, 512))
        img = Image.frombytes('RGBA', (512, 512), bytes(raw))
        img.save(os.path.join(frames_dir, f'frame_{i:04d}.png'))

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
        } catch (pyErr) {
            const stderr = pyErr.stderr?.toString() || '';
            if (stderr.includes('MISSING_RLOTTIE')) {
                // rlottie not installed — silent skip
                return null;
            }
            console.error('[tgsticker] tgs render error:', stderr.slice(-200));
            return null;
        } finally {
            cleanUp(pyPath);
        }

        if (frameCount === 0) return null;

        // PNG frames → GIF → animated WebP (same pipeline as .webm)
        await new Promise((res, rej) => {
            exec(
                `"${FFMPEG_PATH}" -y -framerate ${fps} ` +
                `-i "${framesDir}/frame_%04d.png" ` +
                `-loop 0 "${gifPath}"`,
                { timeout: 60000 },
                (err, _, stderr) => {
                    if (err) return rej(new Error(stderr?.slice(-300) || err.message));
                    res();
                }
            );
        });

        if (!fs.existsSync(gifPath)) return null;

        const webpBuf = await sharp(gifPath, { animated: true })
            .resize(512, 512, {
                fit:        'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .webp({ quality: 90, lossless: false, effort: 4 })
            .toBuffer();

        if (!webpBuf || webpBuf.length < 1024) return null;
        return webpBuf;

    } catch (err) {
        console.error('[tgsticker] tgsToAnimatedWebp error:', err.message);
        return null;
    } finally {
        cleanUp(tgsPath, jsonPath, framesDir, gifPath);
    }
}

// ─── Main Command ───────────────────────────────────────────────────────────

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

            // Determine pack type for info message
            const hasVideo    = toSend.some(s => s.is_video);
            const hasAnimated = toSend.some(s => s.is_animated);
            const packType    = hasVideo ? '🎬 Video' : hasAnimated ? '✨ Animated' : '🖼️ Static';

            await reply(
                `📦 *${data.result.title || packName}*\n` +
                `Type: ${packType}\n` +
                `Total: ${total} sticker${total !== 1 ? 's' : ''}\n` +
                `Sending: ${toSend.length}${capped ? ` (max ${MAX_SEND})` : ''}\n\n` +
                `_Converting… please wait (2s delay per sticker)_`
            );

            let sent = 0, failed = 0, skipped = 0;

            for (const sticker of toSend) {
                try {
                    // Resolve file path from Telegram
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
                        // ── Video sticker: full animated WebP ─────────────────
                        webpBuf = await webmToAnimatedWebp(rawBuf);
                        if (!webpBuf) { failed++; continue; }

                    } else if (sticker.is_animated || filePath.endsWith('.tgs')) {
                        // ── Animated Lottie: full animated WebP ───────────────
                        webpBuf = await tgsToAnimatedWebp(rawBuf);
                        if (!webpBuf) {
                            // rlottie not installed — skip quietly
                            skipped++;
                            continue;
                        }

                    } else {
                        // ── Static sticker ────────────────────────────────────
                        webpBuf = await staticToWebp(rawBuf);
                    }

                    if (!webpBuf || webpBuf.length < 1024) { failed++; continue; }

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

            let summary = `✅ *${data.result.title || packName}*\n`;
            summary    += `Sent: ${sent}/${toSend.length}`;
            if (failed)  summary += `\n❌ Failed: ${failed}`;
            if (skipped) summary += `\n⚠️ Skipped ${skipped} animated (.tgs) — run: \`pip install rlottie-python Pillow\``;
            if (capped)  summary += `\n\n_Pack has ${total} total — only first ${MAX_SEND} sent_`;
            await reply(summary);

        } catch (err) {
            console.error('[tgsticker] fatal error:', err.message);
            try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch {}
            reply('❌ Error fetching sticker pack. Try again later.');
        }
    },
};
