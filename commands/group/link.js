/**
 * Link Command — Get group invite link with rich WhatsApp invite card
 * Usage: .link  (group admins only)
 *
 * Two messages are sent:
 *   1. Native groupInviteMessage card (photo + name + "Join group" button)
 *   2. Rich URL preview — uses the group photo at FULL resolution
 *
 * The blur fix: profilePictureUrl('preview') returns the full-size HD photo.
 * profilePictureUrl('image') returns a tiny low-res thumbnail — that's what
 * caused the blurry preview in Image 1. We now always request 'preview'.
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

            const groupName   = groupMetadata.subject || 'Group';
            const memberCount = groupMetadata.participants?.length || 0;
            const inviteUrl   = `https://chat.whatsapp.com/${inviteCode}`;

            // ── Fetch group photo at FULL resolution ─────────────────────────
            // 'preview' = full HD photo. 'image' = tiny blurry thumbnail.
            // We try 'preview' first; fall back to 'image' if unavailable.
            let photoBuffer = null;
            try {
                const ppUrl = await sock.profilePictureUrl(from, 'preview');
                if (ppUrl) {
                    const res = await fetch(ppUrl, {
                        headers: { 'User-Agent': 'WhatsApp/2.23.20.0 A' },
                    });
                    if (res.ok) photoBuffer = Buffer.from(await res.arrayBuffer());
                }
            } catch (_) {}

            // Fallback to low-res if preview wasn't available
            if (!photoBuffer) {
                try {
                    const ppUrl = await sock.profilePictureUrl(from, 'image');
                    if (ppUrl) {
                        const res = await fetch(ppUrl, {
                            headers: { 'User-Agent': 'WhatsApp/2.23.20.0 A' },
                        });
                        if (res.ok) photoBuffer = Buffer.from(await res.arrayBuffer());
                    }
                } catch (_) {}
            }

            // ── 1. Native invite card (groupInviteMessage) ───────────────────
            // Renders as the "Group chat invite" bubble with photo + Join button.
            await sock.sendMessage(from, {
                groupInviteMessage: {
                    inviteCode,
                    inviteExpiration: Math.floor(Date.now() / 1000) + 86400 * 3,
                    groupJid:  from,
                    groupName,
                    ...(photoBuffer ? { jpegThumbnail: photoBuffer } : {}),
                },
            }, { quoted: msg });

            // ── 2. Rich URL preview with full-res group photo ────────────────
            // previewImage: photoBuffer overrides WhatsApp's own fetch so the
            // card shows the full-resolution photo instead of a blurry thumbnail.
            await sock.sendMessage(from, {
                text:               inviteUrl,
                richPreview:        true,
                previewTitle:       groupName,
                previewDescription: `${memberCount} members · Tap to join`,
                ...(photoBuffer ? { previewImage: photoBuffer } : {}),
            }, { quoted: msg });

        } catch (err) {
            console.error('[LINK CMD]', err.message);
            try {
                const inviteCode = await sock.groupInviteCode(from);
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
