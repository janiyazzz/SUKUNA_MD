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
// Use @crysnovax/baileys for full group-status rendering (text, image, video,
// audio). Falls back to @crysnovax/baileys if the fork is not installed.
let _baileys;
let _baileysSource = 'unknown';
// Try the fork first, fall back to any baileys available
const BAILEYS_CANDIDATES = [
    '@crysnovax/baileys',
    '@whiskeysockets/baileys',
    'baileys',
];
for (const pkg of BAILEYS_CANDIDATES) {
    try {
        _baileys = require(pkg);
        _baileysSource = pkg;
        break;
    } catch (_) {}
}
if (!_baileys) throw new Error('No baileys package found. Install @crysnovax/baileys');
const {
    generateWAMessageContent,
    generateWAMessageFromContent,
    downloadContentFromMessage,
} = _baileys;
const { PassThrough } = require('stream');

// Default background colour for plain-text statuses
const TEXT_BG_COLOR = '#9C27B0'; // purple
const TIMEOUT_MS   = 30_000;

// ── OFFICIAL CHANNEL (View Channel pill on every status post) ─────────────
const CHANNEL_JID  = '120363424109748354@newsletter';
const CHANNEL_NAME = 'Sukuna MD Pasqua tech';
function buildChannelCtx() {
    return {
        isForwarded: true,
        forwardingScore: 999,
        forwardedNewsletterMessageInfo: {
            newsletterJid:   CHANNEL_JID,
            newsletterName:  CHANNEL_NAME,
            serverMessageId: 143,
        },
    };
}
function attachChannelCtxToInner(inner) {
    const keys = ['extendedTextMessage','imageMessage','videoMessage','audioMessage','documentMessage','stickerMessage'];
    for (const k of keys) {
        if (inner && inner[k]) {
            inner[k] = {
                ...inner[k],
                contextInfo: { ...(inner[k].contextInfo || {}), ...buildChannelCtx() },
            };
        }
    }
    return inner;
}


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
/** Fetch participant JIDs for a group so we can target the status ring at them. */
async function getGroupParticipantJids(sock, groupJid) {
    try {
        const meta = await sock.groupMetadata(groupJid);
        const list = (meta?.participants || []).map(p => p.id).filter(Boolean);
        return list;
    } catch (e) {
        console.error('[gcstatus] groupMetadata failed:', e.message);
        return [];
    }
}

async function postGroupStatus(sock, groupJid, content) {
    // Preferred path: simple `groupStatus: true` flag exposed by
    // @crysnovax/baileys ^2.5.0 — handles text / image / video / audio.
    try {
        const { backgroundColor, ...rest } = content;
        const payload = { ...rest, groupStatus: true, richPreview: true, contextInfo: { ...buildChannelCtx() } };
        if (backgroundColor && payload.text) payload.backgroundColor = backgroundColor;
        return await sock.sendMessage(groupJid, payload);
    } catch (e) {
        console.error('[gcstatus] groupStatus:true path failed, falling back to relay:', e.message);
    }

    // Fallback: manual groupStatusMessageV2 relay (legacy path).
    const { backgroundColor } = content;
    const payload = { ...content };
    delete payload.backgroundColor;

    const inner = await generateWAMessageContent(payload, {
        upload: sock.waUploadToServer,
        backgroundColor: backgroundColor || TEXT_BG_COLOR,
    });
    attachChannelCtxToInner(inner);

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

    const statusJidList = await getGroupParticipantJids(sock, groupJid);
    await sock.relayMessage(groupJid, msg.message, {
        messageId: msg.key.id,
        statusJidList,
        additionalAttributes: { messageId: msg.key.id },
    });
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
async function postRelayGroupStatus(sock, groupJid, innerMessage, extraContextInfo, quotedMsg) {
    // Preferred path: hand the raw extendedTextMessage straight to
    // @crysnovax/baileys so link previews / externalAdReply survive intact.
    try {
        const ext = innerMessage?.extendedTextMessage;
        if (ext) {
            const merged = {
                ...ext,
                contextInfo: {
                    ...(ext.contextInfo || {}),
                    ...(extraContextInfo?.externalAdReply
                        ? { externalAdReply: extraContextInfo.externalAdReply }
                        : {}),
                    ...buildChannelCtx(),
                },
            };
            return await sock.sendMessage(groupJid, {
                extendedTextMessage: merged,
                raw: true,
                groupStatus: true,
                richPreview: true,
            }, quotedMsg ? { quoted: quotedMsg } : undefined);
        }
    } catch (e) {
        console.error('[gcstatus] raw extendedTextMessage relay failed, using legacy path:', e.message);
    }

    // Fallback: legacy groupStatusMessageV2 relay.
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
    attachChannelCtxToInner(inner);

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

    const statusJidList = await getGroupParticipantJids(sock, groupJid);
    await sock.relayMessage(groupJid, msg.message, {
        messageId: msg.key.id,
        statusJidList,
        additionalAttributes: { messageId: msg.key.id },
    });
    return msg;
}

// ─── shared exports (used by gcstatusdm.js) ──────────────────────────────────
module.exports.downloadMedia        = downloadMedia;
module.exports.postGroupStatus      = postGroupStatus;
module.exports.postRelayGroupStatus = postRelayGroupStatus;
module.exports.encodeOpus           = encodeOpus;
module.exports.getQuotedCtx         = getQuotedCtx;
module.exports.TEXT_BG_COLOR        = TEXT_BG_COLOR;
module.exports.baileysSource        = _baileysSource;

// ─── command ─────────────────────────────────────────────────────────────────

module.exports = Object.assign(module.exports, {
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
                await postRelayGroupStatus(sock, from, relaySourceMessage, relaySourceContextInfo, msg);
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
});
