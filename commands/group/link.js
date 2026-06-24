/**
 * Link Command — Get group invite link with rich WhatsApp invite card
 * Usage: .link  (group admins only)
 *
 * Sends the invite as a groupInviteMessage so it renders as the native
 * "Group chat invite" card with group picture, name and "Join group" button.
 *
 * Also sends a richPreview text link using the new richPreview API so the
 * invite URL itself shows a full Open-Graph card in the chat.
 */

module.exports = {
    name: 'link',
    aliases: ['grouplink', 'invitelink'],
    description: 'Get the group invite link as a rich invite card (admin only)',
    category: 'group',

    async execute({ sock, msg, from, reply, isGroup, isAdmin }) {
        if (!isGroup) return reply('👥 This command can only be used in groups!');
        if (!isAdmin) return reply('🛑 Only group admins can fetch the invite link.');

        try {
            const [groupMetadata, inviteCode] = await Promise.all([
                sock.groupMetadata(from),
                sock.groupInviteCode(from),
            ]);

            const groupName = groupMetadata.subject || 'Group';
            const inviteUrl = `https://chat.whatsapp.com/${inviteCode}`;

            // Fetch group picture for the card thumbnail
            let jpegThumbnail = null;
            try {
                const ppUrl = await sock.profilePictureUrl(from, 'image');
                if (ppUrl) {
                    const res = await fetch(ppUrl);
                    if (res.ok) {
                        jpegThumbnail = Buffer.from(await res.arrayBuffer());
                    }
                }
            } catch (_) {}

            // ── 1. Native invite card (groupInviteMessage) ──────────────────
            // Renders as the "Group chat invite" bubble with photo + Join button.
            await sock.sendMessage(from, {
                groupInviteMessage: {
                    inviteCode,
                    inviteExpiration: Math.floor(Date.now() / 1000) + 86400 * 3,
                    groupJid:  from,
                    groupName,
                    ...(jpegThumbnail ? { jpegThumbnail } : {}),
                },
            }, { quoted: msg });

            // ── 2. Rich URL preview link ─────────────────────────────────────
            // richPreview: true → WhatsApp auto-fetches OG metadata from the URL.
            // previewTitle / previewDescription / previewImage override the auto-fetch.
            await sock.sendMessage(from, {
                text:               inviteUrl,
                richPreview:        true,
                previewTitle:       groupName,
                previewDescription: `${groupMetadata.participants?.length || 0} members · Tap to join`,
                ...(jpegThumbnail ? { previewImage: jpegThumbnail } : {}),
            }, { quoted: msg });

        } catch (err) {
            console.error('[LINK CMD]', err.message);
            try {
                const inviteCode = await sock.groupInviteCode(from);
                // Fallback: plain richPreview link
                await sock.sendMessage(from, {
                    text:        `https://chat.whatsapp.com/${inviteCode}`,
                    richPreview: true,
                }, { quoted: msg }).catch(() =>
                    reply(`🔗 *Group Invite Link*\n\nhttps://chat.whatsapp.com/${inviteCode}\n\n⚠️ Share responsibly!`)
                );
            } catch (e2) {
                reply('❌ Failed to get invite link. Make sure I am a group admin.');
            }
        }
    }
};
