/**
 * Link Command — Get group invite link with rich WhatsApp invite card
 * Usage: .link  (group admins only)
 *
 * Sends the invite as a groupInviteMessage so it renders as the native
 * "Group chat invite" card with group picture, name and "Join group" button.
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

            // Rich invite card — renders as native "Group chat invite" bubble
            await sock.sendMessage(from, {
                groupInviteMessage: {
                    inviteCode,
                    inviteExpiration: Math.floor(Date.now() / 1000) + 86400 * 3,
                    groupJid:  from,
                    groupName,
                    ...(jpegThumbnail ? { jpegThumbnail } : {}),
                },
                richPreview: true,
            }, { quoted: msg });

        } catch (err) {
            console.error('[LINK CMD]', err.message);
            try {
                const inviteCode = await sock.groupInviteCode(from);
                reply(`🔗 *Group Invite Link*\n\nhttps://chat.whatsapp.com/${inviteCode}\n\n⚠️ Share responsibly!`);
            } catch (e2) {
                reply('❌ Failed to get invite link. Make sure I am a group admin.');
            }
        }
    }
};
