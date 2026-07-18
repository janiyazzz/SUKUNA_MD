/**
 * AutoViewOnce Command — Auto-send media as view-once
 * Reply to any image/video with .autovv to send it as a view-once message
 * Clean, minimal output - just the media with no text or borders
 * Usage: .autovv (reply to an image or video)
 */

const { downloadContentFromMessage } = require('@crysnovax/baileys');

/**
 * Extract the quoted / replied-to message from a message object.
 */
function getQuotedMessage(msg) {
    const msgContent = msg.message;
    if (!msgContent) return null;

    const contextInfo =
        msgContent?.extendedTextMessage?.contextInfo ||
        msgContent?.imageMessage?.contextInfo       ||
        msgContent?.videoMessage?.contextInfo       ||
        msgContent?.audioMessage?.contextInfo       ||
        msgContent?.documentMessage?.contextInfo    ||
        msgContent?.stickerMessage?.contextInfo     ||
        msgContent?.buttonsResponseMessage?.contextInfo ||
        msgContent?.listResponseMessage?.contextInfo ||
        msgContent?.templateButtonReplyMessage?.contextInfo ||
        null;

    return contextInfo?.quotedMessage || null;
}

/**
 * Find media in a message object.
 */
function findMedia(msgObj) {
    if (!msgObj) return null;
    if (msgObj.imageMessage) return { mediaType: 'image', mediaMsg: msgObj.imageMessage };
    if (msgObj.videoMessage) return { mediaType: 'video', mediaMsg: msgObj.videoMessage };
    return null;
}

/**
 * Download a media message into a Buffer with retries.
 */
async function downloadMedia(mediaMsg, mediaType, retries = 3) {
    let lastErr;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const stream = await downloadContentFromMessage(mediaMsg, mediaType);
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            const buf = Buffer.concat(chunks);
            if (buf.length === 0) throw new Error('Empty buffer received');
            return buf;
        } catch (err) {
            lastErr = err;
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }
    throw lastErr;
}

module.exports = {
    name: 'autoviewonce',
    aliases: ['autovv', 'vvme'],
    description: 'Send media as a view-once message',
    usage: '.autovv (reply to an image or video)',
    category: 'fun',

    async execute({ sock, msg, from, reply }) {
        // ── 1. Get the quoted message ─────────────────────────────────────
        const quotedMsg = getQuotedMessage(msg);

        if (!quotedMsg) {
            return reply('Reply to an image or video to send it as view-once.');
        }

        // ── 2. Find media ─────────────────────────────────────────────────
        const found = findMedia(quotedMsg);

        if (!found) {
            return reply('That message does not contain an image or video.');
        }

        const { mediaType, mediaMsg } = found;

        // ── 3. Download media ─────────────────────────────────────────────
        try {
            const buffer = await downloadMedia(mediaMsg, mediaType);

            // ── 4. Send as view-once with no text or borders ───────────────
            if (mediaType === 'image') {
                await sock.sendMessage(from, {
                    image: buffer,
                    viewOnce: true,
                }, { quoted: msg });

            } else if (mediaType === 'video') {
                await sock.sendMessage(from, {
                    video: buffer,
                    mimetype: mediaMsg.mimetype || 'video/mp4',
                    viewOnce: true,
                }, { quoted: msg });
            }

            // Send success reaction
            await sock.sendMessage(from, {
                react: { text: '👁️', key: msg.key }
            }).catch(() => {});

        } catch (err) {
            console.error('[AUTOVV] Download failed:', err.message);

            if (err.message?.includes('Not Found') || err.message?.includes('404')) {
                return reply('Message expired or already deleted.');
            }

            return reply('Failed to process media. Please try again.');
        }
    }
};
