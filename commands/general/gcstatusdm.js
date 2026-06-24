/**
 * gcstatusdm — Post to a group's status feed FROM YOUR DM with the bot.
 *
 * Re-uses the EXACT SAME posting pipeline as .gcstatus (same baileys calls,
 * same fallback logic, same channel-branding context) by importing the
 * shared helpers gcstatus.js exports. The only thing this file adds on top
 * is: (1) you call it in DM instead of inside the group, (2) you supply the
 * group's invite link as the first argument so the JID can be resolved, and
 * (3) it checks the bot is actually a member of that group before posting.
 *
 * Usage (DM only):
 *   .gcstatusdm https://chat.whatsapp.com/XXXX Hello world!
 *   .gcstatusdm https://chat.whatsapp.com/XXXX https://example.com
 *   Reply to image/video/audio + .gcstatusdm https://chat.whatsapp.com/XXXX [caption]
 */

const gcstatus = require('./gcstatus');
const {
    downloadMedia,
    postGroupStatus,
    encodeOpus,
    getQuotedCtx,
    TEXT_BG_COLOR,
    baileysSource,
} = gcstatus;

/** Extract the invite code from a WhatsApp group link. */
function parseInviteCode(input) {
    if (!input) return null;
    const m = String(input).match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9_-]{8,})/i);
    if (m) return m[1];
    // Bare code
    if (/^[A-Za-z0-9_-]{8,}$/.test(input)) return input;
    return null;
}

module.exports = {
    name:        'gcstatusdm',
    aliases:     ['gstatusdm', 'gcstatusremote'],
    description: "Post to a group's status feed from DM using its invite link — uses the same engine as .gcstatus",
    usage:       '.gcstatusdm <group-link> <text|link>  OR  reply to media + .gcstatusdm <group-link> [caption]',
    category:    'general',

    async execute({ sock, msg, from, sender, args, reply, isGroup, phoneNumber }) {
        if (isGroup) {
            return reply('💌 *.gcstatusdm* is a DM-only command. Use *.gcstatus* inside groups.');
        }

        const linkArg = args[0];
        const code    = parseInviteCode(linkArg);
        if (!code) {
            return reply(
                `╔══════════════════════════╗\n` +
                `║  📊 *GCSTATUSDM*          ║\n` +
                `╚══════════════════════════╝\n\n` +
                `*Usage:* \`.gcstatusdm <group-link> <content>\`\n\n` +
                `▸ \`.gcstatusdm https://chat.whatsapp.com/XXXX Hello!\`\n` +
                `▸ Reply to 📷 / 🎥 / 🎵 + \`.gcstatusdm <link> [caption]\`\n\n` +
                `_Bot must already be a member of that group._\n` +
                `_Same engine as .gcstatus — works identically, just from DM._`
            );
        }

        // Resolve invite → groupJid
        let groupJid;
        try {
            const info = await sock.groupGetInviteInfo(code);
            groupJid = info?.id;
            if (!groupJid) throw new Error('Could not resolve group from link');
        } catch (e) {
            return reply(`❌ Invalid or expired group link: ${e.message}`);
        }

        // Verify bot is a member of that group.
        // FIX: the old check compared sock.user?.id against p.id as raw
        // strings. That silently fails whenever either side is on the
        // `@lid` addressing scheme instead of a phone JID (e.g. the bot's
        // own JID reports as a LID, but the group's participant list shows
        // it via phoneNumber, or vice versa) — same class of bug as the
        // autoread fix. Normalizing everything down to bare phone digits,
        // and checking every JID-ish field WhatsApp might use (id, jid,
        // phoneNumber, lid), makes this match regardless of which scheme
        // either side happens to report.
        const normDigits = (jid) => String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
        let isMember = false;
        try {
            const meta = await sock.groupMetadata(groupJid);
            const botCandidates = new Set();
            // phoneNumber (the paired bot's own number) is the most reliable
            // identity we have — it's already a clean digit string.
            if (phoneNumber) botCandidates.add(normDigits(phoneNumber));
            if (sock.user?.id)  botCandidates.add(normDigits(sock.user.id));
            if (sock.user?.lid) botCandidates.add(normDigits(sock.user.lid));
            botCandidates.delete('');

            isMember = (meta?.participants || []).some(p => {
                const candidates = [p.id, p.jid, p.phoneNumber, p.lid]
                    .map(normDigits)
                    .filter(Boolean);
                return candidates.some(c => botCandidates.has(c));
            });
        } catch (_) {
            isMember = false;
        }
        if (!isMember) {
            return reply(
                `🚫 *Bot is not a member of that group.*\n\n` +
                `Join the group first (via the same link), then retry.`
            );
        }

        const caption = args.slice(1).join(' ').trim();
        const ctx     = getQuotedCtx(msg);
        const quoted  = ctx?.quotedMessage || null;

        // ── IMAGE / STICKER ── (identical to .gcstatus, via shared helpers)
        const imgMsg = quoted?.imageMessage || quoted?.stickerMessage;
        if (imgMsg) {
            await reply('📸 _Uploading image to group status…_');
            try {
                const type = quoted.imageMessage ? 'image' : 'sticker';
                const buf  = await downloadMedia(imgMsg, type);
                await postGroupStatus(sock, groupJid, { image: buf, caption: caption || '' });
                return reply('✅ *Image posted to group status!*');
            } catch (err) {
                return reply(`❌ Failed to post image: ${err.message}`);
            }
        }

        // ── VIDEO ──
        if (quoted?.videoMessage) {
            await reply('🎥 _Uploading video to group status…_');
            try {
                const buf = await downloadMedia(quoted.videoMessage, 'video');
                await postGroupStatus(sock, groupJid, { video: buf, caption: caption || '' });
                return reply('✅ *Video posted to group status!*');
            } catch (err) {
                return reply(`❌ Failed to post video: ${err.message}`);
            }
        }

        // ── AUDIO ──
        if (quoted?.audioMessage) {
            await reply('🎵 _Uploading audio to group status…_');
            try {
                const raw = await downloadMedia(quoted.audioMessage, 'audio');
                const buf = await encodeOpus(raw);
                await postGroupStatus(sock, groupJid, {
                    audio:    buf,
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt:      true,
                });
                return reply('✅ *Audio posted to group status!*');
            } catch (err) {
                return reply(`❌ Failed to post audio: ${err.message}`);
            }
        }

        // ── TEXT / LINK ──
        if (!caption) {
            return reply('❌ Provide some text after the group link, or reply to media.');
        }
        try {
            await reply('📝 _Posting text to group status…_');
            // FIX: detect URLs and skip the purple backgroundColor for them —
            // a backgroundColor on a link status suppresses the rich-preview
            // card client-side. This mirrors .gcstatus's TEXT branch, which is
            // the one already confirmed working for links like your GitHub URL.
            const isUrl = /https?:\/\//i.test(caption);
            await postGroupStatus(sock, groupJid, {
                text:            caption,
                backgroundColor: isUrl ? undefined : TEXT_BG_COLOR,
            });
            return reply(
                `✅ *${isUrl ? 'Link' : 'Text'} posted to group status!*\n\n` +
                `_"${caption.slice(0, 80)}${caption.length > 80 ? '…' : ''}"_`
            );
        } catch (err) {
            return reply(`❌ Failed to post text: ${err.message}`);
        }
    },
};
