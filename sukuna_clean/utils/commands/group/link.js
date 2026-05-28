/**
 * Link Command — Get group invite link
 * Usage: .link
 */

module.exports = {
    name: 'link',
    aliases: ['grouplink', 'invitelink'],
    description: 'Get the group invite link',
    category: 'group',
    async execute({ sock, from, reply, isGroup }) {
        if (!isGroup) return reply('👥 This command can only be used in groups!');

        try {
            const groupMetadata = await sock.groupMetadata(from);
            const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const botParticipant = groupMetadata.participants.find(p => p.id.includes(botId.split('@')[0]));
            const isBotAdmin = botParticipant && (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin');
            
            if (!isBotAdmin) return reply('🤖 I need to be an admin to get the invite link!');

            const inviteCode = await sock.groupInviteCode(from);
            const groupName = groupMetadata.subject;
            
            reply(
                `🔗 *Group Invite Link*\n\n` +
                `📌 Group: ${groupName}\n` +
                `🔗 Link: https://chat.whatsapp.com/${inviteCode}\n\n` +
                `⚠️ Share this link responsibly!`
            );
        } catch (err) {
            reply('❌ Failed to get invite link. Make sure I am an admin!');
        }
    }
};
