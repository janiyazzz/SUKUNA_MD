module.exports = {
    name: 'groupinfo',
    aliases: ['ginfo', 'groupdesc'],
    description: 'Get group information',
    category: 'admin',
    async execute({ sock, reply, from, isGroup }) {
        if (!isGroup) return reply('👥 This command can only be used in groups!');
        try {
            const meta = await sock.groupMetadata(from);
            const admins = meta.participants.filter(p => p.admin).map(p => `+${p.id.split('@')[0]}`).join(', ');
            reply(`📋 *Group Info*\n\n👥 Name: ${meta.subject}\n📝 Desc: ${meta.desc || 'None'}\n👤 Members: ${meta.participants.length}\n🛡️ Admins: ${admins || 'None'}\n🆔 ID: \`${from}\``);
        } catch (err) {
            reply(`❌ Failed: ${err.message}`);
        }
    }
};
