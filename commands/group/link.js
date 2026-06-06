/**
 * Link Command — Get group invite link
 * Usage: .link  (group admins only)
 */

module.exports = {
    name: 'link',
    aliases: ['grouplink', 'invitelink'],
    description: 'Get the group invite link (admin only)',
    category: 'group',
    async execute({ sock, msg, from, reply, isGroup, isAdmin }) {
        if (!isGroup) return reply('👥 This command can only be used in groups!');
        if (!isAdmin) return reply('🛑 Only group admins can fetch the invite link.');

        try {
            const groupMetadata = await sock.groupMetadata(from);
            const inviteCode = await sock.groupInviteCode(from);
            const groupName = groupMetadata.subject;

            reply(
                `🔗 *Group Invite Link*\n\n` +
                `📌 Group: ${groupName}\n` +
                `🔗 Link: https://chat.whatsapp.com/${inviteCode}\n\n` +
                `⚠️ Share this link responsibly!`
            );
        } catch (err) {
            reply('❌ Failed to get invite link.');
        }
    }
};
