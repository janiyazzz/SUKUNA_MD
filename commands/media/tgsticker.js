/**
 * TG Sticker Command — fetch a Telegram sticker pack and re-send every
 * sticker in it as a WhatsApp sticker (i.e. "migrate" a TG pack to WA).
 *
 * Usage: .tgsticker <https://t.me/addstickers/PackName>
 * Alias: .tgstickers
 *
 * Requires TG_BOT_TOKEN in your .env — get one free from @BotFather on
 * Telegram (just /newbot, no special permissions needed). Add it to
 * .env as:
 *   TG_BOT_TOKEN=123456:ABC-your-token-here
 *
 * Notes on conversion:
 *  - Static stickers (.webp / .png) convert reliably via `sharp`.
 *  - Animated stickers (.tgs) are Telegram's gzipped Lottie-animation
 *    format — ffmpeg/sharp cannot read them directly. This command shells
 *    out to a `lottie-web-to-webp` binary (as in the original snippet) if
 *    one is on PATH. If that binary isn't installed, animated stickers in
 *    the pack are skipped (not crashed) and counted separately in the
 *    final summary, exactly like the optional-ffmpeg fallback already
 *    used in commands/general/sticker.js.
 *  - Pack name / author are embedded via the standard WebP EXIF trick
 *    (node-webpmux) so the stickers show up as a named pack on WhatsApp.
 *    Run `npm install` after adding this file — node-webpmux has been
 *    added to package.json.
 */
'use strict';

const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const sharp = require('sharp');

let WebpMux = null;
try {
    WebpMux = require('node-webpmux');
} catch (_) {
    // Not installed yet — stickers will still send, just without custom
    // pack-name/author metadata. Run `npm install node-webpmux` to enable it.
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tmpFile(ext) {
    return path.join(os.tmpdir(), `tgsticker-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
}

async function getBuffer(url) {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    return Buffer.from(res.data);
}

function run(cmd, ms = 30000) {
    return new Promise((resolve, reject) => {
        exec(cmd, { timeout: ms }, (err, _stdout, stderr) =>
            err ? reject(new Error(stderr || err.message)) : resolve()
        );
    });
}

/** Embeds sticker-pack name/author into a webp buffer's EXIF chunk. */
async function addPackMetadata(webpBuffer, packname, author) {
    if (!WebpMux) return webpBuffer;
    try {
        const img = new WebpMux.Image();
        await img.load(webpBuffer);
        const json = {
            'sticker-pack-id': 'sukunamd-tg-' + Date.now(),
            'sticker-pack-name': packname,
            'sticker-pack-publisher': author,
            emojis: ['🤖'],
        };
        const exifAttr = Buffer.from([
            0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
            0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
        ]);
        const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf-8');
        const exif = Buffer.concat([exifAttr, jsonBuffer]);
        exif.writeUIntLE(jsonBuffer.length, 14, 4);
        img.exif = exif;
        return await img.save(null);
    } catch (err) {
        console.error('[tgsticker] EXIF write failed:', err.message);
        return webpBuffer;
    }
}

/** Static sticker (.webp/.png) -> 512x512 WhatsApp-ready webp buffer. */
async function staticToWebp(buffer) {
    return sharp(buffer)
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 80 })
        .toBuffer();
}

/** Animated sticker (.tgs) -> animated webp buffer via external binary. */
async function tgsToWebp(tgsBuffer) {
    const tgsPath = tmpFile('.tgs');
    const webpPath = tmpFile('.webp');
    try {
        fs.writeFileSync(tgsPath, tgsBuffer);
        await run(`lottie-web-to-webp "${tgsPath}" "${webpPath}"`);
        return fs.readFileSync(webpPath);
    } finally {
        for (const f of [tgsPath, webpPath]) {
            try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
        }
    }
}

module.exports = {
    name: 'tgsticker',
    aliases: ['tgstickers', 'tgs2wa'],
    description: 'Fetch a Telegram sticker pack and re-send it as WhatsApp stickers',
    usage: '.tgsticker <https://t.me/addstickers/PackName>',
    category: 'media',

    async execute({ sock, msg, from, reply, args }) {
        const text = (args || []).join(' ').trim();
        if (!text) {
            return reply(`❌ Example: .tgsticker https://t.me/addstickers/AnimePack`);
        }

        const TG_TOKEN = process.env.TG_BOT_TOKEN || '8761223803:AAHyYWvC6hiyWRzkWriPmi07H9bXUkTjbpY';
        if (!TG_TOKEN) {
            return reply(
                '❌ TG_BOT_TOKEN is not set.\n\n' +
                'Get a free token from @BotFather on Telegram and add it to your .env:\n' +
                'TG_BOT_TOKEN=123456:ABC-your-token-here'
            );
        }

        const packUrl = text;
        if (!packUrl.includes('t.me/addstickers/')) {
            return reply('❌ Invalid Telegram sticker pack link.');
        }
        const packName = packUrl.split('/addstickers/')[1].split(/[/?]/)[0];

        try {
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            const api = `https://api.telegram.org/bot${TG_TOKEN}/getStickerSet?name=${packName}`;
            const { data } = await axios.get(api, { timeout: 30000 });

            if (!data.ok) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return reply('❌ Failed to fetch Telegram sticker pack. Check the link and your TG_BOT_TOKEN.');
            }

            const stickers = data.result.stickers;
            if (!stickers || stickers.length === 0) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return reply('❌ No stickers found in this pack.');
            }

            await reply(`✅ Found ${stickers.length} stickers. Sending now...`);

            let sent = 0;
            let skippedAnimated = 0;
            let failed = 0;

            for (const sticker of stickers) {
                try {
                    const filePathRes = await axios.get(
                        `https://api.telegram.org/bot${TG_TOKEN}/getFile?file_id=${sticker.file_id}`,
                        { timeout: 30000 }
                    );
                    const filePath = filePathRes.data?.result?.file_path;
                    if (!filePath) { failed++; continue; }

                    const fileUrl = `https://api.telegram.org/file/bot${TG_TOKEN}/${filePath}`;
                    let webpBuffer;

                    if (fileUrl.endsWith('.tgs')) {
                        try {
                            const tgsBuffer = await getBuffer(fileUrl);
                            webpBuffer = await tgsToWebp(tgsBuffer);
                        } catch (err) {
                            // lottie-web-to-webp not installed, or conversion failed —
                            // skip this animated sticker rather than crash the batch.
                            console.error('[tgsticker] animated convert skipped:', err.message);
                            skippedAnimated++;
                            continue;
                        }
                    } else {
                        const rawBuffer = await getBuffer(fileUrl);
                        webpBuffer = await staticToWebp(rawBuffer);
                    }

                    webpBuffer = await addPackMetadata(webpBuffer, data.result.title || packName, 'TG ➝ WA · SUKUNA MD');

                    await sock.sendMessage(from, { sticker: webpBuffer }, { quoted: msg });
                    sent++;
                    await sleep(1200);
                } catch (err) {
                    failed++;
                    console.error('[tgsticker] sticker error:', err.message);
                }
            }

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

            let summary = `✅ Done! Sent ${sent}/${stickers.length} stickers from *${data.result.title || packName}*.`;
            if (skippedAnimated) summary += `\n⚠️ ${skippedAnimated} animated sticker(s) skipped (needs \`lottie-web-to-webp\` on PATH).`;
            if (failed) summary += `\n❌ ${failed} sticker(s) failed.`;
            await reply(summary);
        } catch (err) {
            console.error('[tgsticker] error:', err.message);
            try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch {}
            reply('❌ Error while fetching TG stickers.');
        }
    },
};
