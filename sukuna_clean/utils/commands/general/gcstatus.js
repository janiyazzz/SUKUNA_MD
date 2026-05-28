/**
 * gcstatus — Post text, link, image, video or audio to WhatsApp *Group* Status
 *
 * ✅ No admin required — bot works as a regular group member
 * ✅ Uses the official groupStatusMessageV2 API (Baileys)
 *
 * Usage:
 *   .gcstatus Hello world!            → text group status
 *   .gcstatus https://example.com     → link as text group status
 *   Reply to a photo  + .gcstatus     → image group status
 *   Reply to a video  + .gcstatus     → video group status
 *   Reply to an audio + .gcstatus     → audio/voice group status
 *
 *   All media types accept an optional caption:
 *   Reply to photo + .gcstatus My caption
 */

const crypto = require('crypto');
const {
    generateWAMessageContent,
    generateWAMessageFromContent,
    downloadContentFromMessage,
} = require('@whiskeysockets/baileys');
const { PassThrough } = require('stream');

// Default background colour for plain-text statuses
const TEXT_BG_COLOR = '#9C27B0'; // purple
const TIMEOUT_MS   = 30_000;

// ─── helpers ──────────────────────────────────────────────────────────────────

async function downloadMedia(mediaMsg, type) {
    return new Promise(async (resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error('Media download timed out')),
            TIMEOUT_MS
        );
        try {
            const stream = await downloadContentFromMessage(mediaMsg, type);
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            clearTimeout(timer);
            resolve(Buffer.concat(chunks));
        } catch (err) {
            clearTimeout(timer);
            reject(err);
        }
    });
}

/**
 * Post any content to the group status feed.
 * content = { text, backgroundColor } | { image, caption } |
 *           { video, caption }        | { audio, mimetype, ptt }
 */
async function postGroupStatus(sock, groupJid, content) {
    const { backgroundColor } = content;
    const payload = { ...content };
    delete payload.backgroundColor;

    const inner = await generateWAMessageContent(payload, {
        upload: sock.waUploadToServer,
        backgroundColor: backgroundColor || TEXT_BG_COLOR,
    });

    const secret = crypto.randomBytes(32);

    const msg = generateWAMessageFromContent(
        groupJid,
        {
            messageContextInfo: { messageSecret: secret },
            groupStatusMessageV2: {
                message: {
                    ...inner,
                    messageContextInfo: { messageSecret: secret },
                },
            },
        },
        {}
    );

    await sock.relayMessage(groupJid, msg.message, { messageId: msg.key.id });
    return msg;
}

/** Try to re-encode audio as Opus/OGG for best voice-note compatibility. */
async function encodeOpus(buffer) {
    let ffmpeg;
    try { ffmpeg = require('fluent-ffmpeg'); } catch { return buffer; }

    return new Promise((resolve) => {
        const input  = new PassThrough();
        const output = new PassThrough();
        const chunks = [];

        input.end(buffer);

        ffmpeg(input)
            .noVideo()
            .audioCodec('libopus')
            .format('ogg')
            .audioChannels(1)
            .audioFrequency(48000)
            .on('error', () => resolve(buffer))   // fall back to raw buffer
            .on('end',   () => resolve(Buffer.concat(chunks)))
            .pipe(output);

        output.on('data', (c) => chunks.push(c));
    });
}

function getQuotedCtx(msg) {
    const m = msg.message;
    return (
        m?.extendedTextMessage?.contextInfo ||
        m?.imageMessage?.contextInfo        ||
        m?.videoMessage?.contextInfo        ||
        m?.audioMessage?.contextInfo        ||
        m?.stickerMessage?.contextInfo      ||
        null
    );
}

// Borrowed from pappy-groupstatus: pulls the inner extendedTextMessage (with
// externalAdReply / link-preview thumbnail) out of a quoted message so we can
// re-broadcast it intact and the preview survives.
function extractRelaySourceMessage(quotedMsg) {
    if (!quotedMsg || typeof quotedMsg !== 'object') return null;
    if (quotedMsg.ephemeralMessage?.message) return extractRelaySourceMessage(quotedMsg.ephemeralMessage.message);
    if (quotedMsg.viewOnceMessage?.message)  return extractRelaySourceMessage(quotedMsg.viewOnceMessage.message);
    if (quotedMsg.extendedTextMessage) return { extendedTextMessage: quotedMsg.extendedTextMessage };
    if (quotedMsg.groupInviteMessage)  return { groupInviteMessage: quotedMsg.groupInviteMessage };
    if (quotedMsg.conversation)        return { conversation: quotedMsg.conversation };
    return null;
}

function extractRelaySourceContextInfo(msg) {
    const ctx = msg?.message?.extendedTextMessage?.contextInfo || null;
    if (!ctx) return null;
    const qm = ctx.quotedMessage || {};
    return (
        qm?.extendedTextMessage?.contextInfo ||
        qm?.imageMessage?.contextInfo ||
        qm?.videoMessage?.contextInfo ||
        null
    );
}

/** Relay a pre-formed inner message (preserving link-preview / externalAdReply)
 *  into the group status feed. */
async function postRelayGroupStatus(sock, groupJid, innerMessage, extraContextInfo) {
    const secret = crypto.randomBytes(32);
    const inner = { ...innerMessage };

    if (extraContextInfo?.externalAdReply && inner.extendedTextMessage) {
        inner.extendedTextMessage = {
            ...inner.extendedTextMessage,
            contextInfo: {
                ...(inner.extendedTextMessage.contextInfo || {}),
                externalAdReply: extraContextInfo.externalAdReply,
            },
        };
    }

    const msg = generateWAMessageFromContent(
        groupJid,
        {
            messageContextInfo: { messageSecret: secret },
            groupStatusMessageV2: {
                message: { ...inner, messageContextInfo: { messageSecret: secret } },
            },
        },
        {}
    );

    await sock.relayMessage(groupJid, msg.message, { messageId: msg.key.id });
    return msg;
}

// ─── command ─────────────────────────────────────────────────────────────────

module.exports = {
    name:        'gcstatus',
    aliases:     ['groupstatus', 'gstatus', 'poststatus'],
    description: 'Post text, link, image, video or audio to the group status feed',
    usage:       '.gcstatus <text|link>  OR  reply to media + .gcstatus [caption]',
    category:    'general',

    // ✅ No adminOnly / botAdminNeeded — any regular member can use this
    async execute({ sock, msg, from, args, reply, isGroup }) {
        if (!isGroup) {
            return reply('👥 This command only works inside a group.');
        }

        const caption = args.join(' ').trim();
        const ctx     = getQuotedCtx(msg);
        const quoted  = ctx?.quotedMessage || null;

        // ── IMAGE (or sticker treated as image) ──────────────────────────────
        const imgMsg = quoted?.imageMessage || quoted?.stickerMessage;
        if (imgMsg) {
            await reply('📸 _Uploading image to group status…_');
            try {
                const type = quoted.imageMessage ? 'image' : 'sticker';
                const buf  = await downloadMedia(imgMsg, type);
                await postGroupStatus(sock, from, {
                    image:   buf,
                    caption: caption || '',
                });
                return reply('✅ *Image posted to group status!*');
            } catch (err) {
                return reply(`❌ Failed to post image: ${err.message}`);
            }
        }

        // ── VIDEO ────────────────────────────────────────────────────────────
        if (quoted?.videoMessage) {
            await reply('🎥 _Uploading video to group status…_');
            try {
                const buf = await downloadMedia(quoted.videoMessage, 'video');
                await postGroupStatus(sock, from, {
                    video:   buf,
                    caption: caption || '',
                });
                return reply('✅ *Video posted to group status!*');
            } catch (err) {
                return reply(`❌ Failed to post video: ${err.message}`);
            }
        }

        // ── AUDIO ────────────────────────────────────────────────────────────
        if (quoted?.audioMessage) {
            await reply('🎵 _Uploading audio to group status…_');
            try {
                const raw = await downloadMedia(quoted.audioMessage, 'audio');
                const buf = await encodeOpus(raw);
                await postGroupStatus(sock, from, {
                    audio:    buf,
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt:      true,
                });
                return reply('✅ *Audio posted to group status!*');
            } catch (err) {
                return reply(`❌ Failed to post audio: ${err.message}`);
            }
        }

        // ── LINK PREVIEW RELAY ──────────────────────────────────────────────
        // If the current message has a loaded link preview, OR the user is
        // replying to a message that contains a link preview, relay that
        // inner message intact so the preview thumbnail survives.
        const currentExt = msg.message?.extendedTextMessage;
        const currentCtx = currentExt?.contextInfo;
        const hasCurrentPreview = !!(currentCtx?.externalAdReply || currentExt?.matchedText);

        let relaySourceMessage = null;
        let relaySourceContextInfo = null;

        if (hasCurrentPreview && !caption) {
            relaySourceMessage = { extendedTextMessage: currentExt };
            relaySourceContextInfo = currentCtx;
        } else if (quoted) {
            const extracted = extractRelaySourceMessage(quoted);
            if (extracted?.extendedTextMessage?.contextInfo?.externalAdReply) {
                relaySourceMessage = extracted;
                relaySourceContextInfo = extractRelaySourceContextInfo(msg);
            }
        }

        if (relaySourceMessage) {
            try {
                await reply('🔗 _Posting link preview to group status…_');
                await postRelayGroupStatus(sock, from, relaySourceMessage, relaySourceContextInfo);
                return reply('✅ *Link preview posted to group status!*');
            } catch (err) {
                return reply(`❌ Failed to post link: ${err.message}`);
            }
        }

        // ── TEXT / LINK ──────────────────────────────────────────────────────
        if (!caption) {
            return reply(
                `📊 *GCStatus — Post to Group Status*\n\n` +
                `*No admin needed — bot posts as a regular member* ✅\n\n` +
                `*Usage:*\n` +
                `• \`.gcstatus Hello world!\` — text status\n` +
                `• \`.gcstatus https://link.com\` — link status (preview kept)\n` +
                `• Reply to a link msg + \`.gcstatus\` — relays preview\n` +
                `• Reply to 📷 / 🎥 / 🎵 + \`.gcstatus [caption]\``
            );
        }

        try {
            await reply('📝 _Posting text to group status…_');
            await postGroupStatus(sock, from, {
                text:            caption,
                backgroundColor: TEXT_BG_COLOR,
            });
            return reply(
                `✅ *Text posted to group status!*\n\n` +
                `_"${caption.slice(0, 80)}${caption.length > 80 ? '…' : ''}"_`
            );
        } catch (err) {
            return reply(`❌ Failed to post text: ${err.message}`);
        }
    },
};
