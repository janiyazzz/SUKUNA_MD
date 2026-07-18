/**
 * Sticker Command — Converts images or videos into WhatsApp stickers
 * 
 * Supports:
 *   - Image → sticker
 *   - Video → animated sticker with smart compression
 *
 * Uses node-webpmux for metadata (no native sharp dependency)
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { addExif } = require('../../library/exif');

module.exports = {
    name: 'sticker',
    alias: ['s', 'stick'],
    category: 'Media',

    execute: async (context) => {
        const { sock, msg, from, reply } = context;
        
        const quoted = msg.quoted || msg;
        const mime = quoted.mimetype || '';

        if (!/image|video/.test(mime)) {
            return reply('Reply to an image or video');
        }

        try {
            const media = await quoted.download();

            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const input = path.join(tempDir, `stk_${Date.now()}`);
            const output = input + '.webp';

            fs.writeFileSync(input, media);

            // ================= VIDEO STICKER =================
            if (/video/.test(mime)) {
                const duration = (quoted.msg || quoted).seconds || 0;
                const durationSec = Math.min(duration || 5, 10);

                // Helper to run ffmpeg with given settings
                const compressVideo = async (fps, quality, dur) => {
                    const cmd = `ffmpeg -y -i "${input}" -t ${dur} -vf "fps=${fps},scale=512:512:force_original_aspect_ratio=increase,crop=512:512:(iw-ow)/2:(ih-oh)/2,format=yuva420p" -c:v libwebp -lossless 0 -q:v ${quality} -loop 0 -an -preset default -compression_level 6 "${output}"`;
                    
                    await new Promise((resolve, reject) => {
                        exec(cmd, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });

                    const sizeKB = fs.statSync(output).size / 1024;
                    return sizeKB;
                };

                let sizeKB = await compressVideo(12, 70, durationSec);

                // If too large, try lower fps and quality
                if (sizeKB > 500) {
                    sizeKB = await compressVideo(8, 40, durationSec);
                }

                // If still too large, try even lower
                if (sizeKB > 500) {
                    sizeKB = await compressVideo(6, 30, durationSec);
                }

                // Final check – if still too large, abort
                if (sizeKB > 500) {
                    fs.unlinkSync(input);
                    fs.unlinkSync(output);
                    return reply('Video too complex to fit WhatsApp sticker limit. Try a shorter/simpler clip.');
                }
            }
            // ================= IMAGE STICKER =================
            else {
                const imageCmd = `ffmpeg -y -i "${input}" -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512:(iw-ow)/2:(ih-oh)/2,format=yuva420p" -c:v libwebp -lossless 0 -q:v 80 -an "${output}"`;
                await new Promise((resolve, reject) => {
                    exec(imageCmd, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            // Read the generated WebP
            let buffer = fs.readFileSync(output);

            // Add sticker metadata (pack/author)
            buffer = await addExif(buffer, 'SUKUNA MD', 'crysnovax', ['🔥']);

            // Send the sticker
            await sock.sendMessage(from, { sticker: buffer }, { quoted: msg });

            // Cleanup temporary files
            fs.unlinkSync(input);
            if (fs.existsSync(output)) fs.unlinkSync(output);

        } catch (e) {
            console.error('[sticker]', e);
            reply('Failed to create sticker');
        }
    }
};
