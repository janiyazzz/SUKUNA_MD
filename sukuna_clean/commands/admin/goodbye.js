const database = require('../../utils/database');

module.exports = {
    name: 'goodbye',
    aliases: ['byemsg', 'bye'],
    description: 'Enable/disable/set goodbye messages with profile pic',
    category: 'admin',
    async execute({ reply, args, from, isGroup }) {
        if (!isGroup) return reply('👥 This command can only be used in groups!');
        const action = args[0]?.toLowerCase();
        const group = database.getGroup(from);

        if (!action) {
            return reply(
                `👋 *Goodbye Settings*\n\n` +
                `Status: ${group.goodbye ? '✅ ON' : '❌ OFF'}\n` +
                `Message: ${group.goodbyeMessage || '👋 Goodbye @user, we will miss you!'}\n\n` +
                `*Usage:*\n` +
                `• \`.goodbye on\` — Enable goodbye messages\n` +
                `• \`.goodbye off\` — Disable goodbye messages\n` +
                `• \`.goodbye set Your message here\` — Set custom message\n\n` +
                `_Use @user to mention the leaving member_\n` +
                `_Profile picture + group name shown automatically_`
            );
        }

        if (action === 'set') {
            const customMsg = args.slice(1).join(' ');
            if (!customMsg) return reply('❌ Provide a message!\n\nExample: `.goodbye set Goodbye @user, we will miss you!`');
            database.setGroup(from, 'goodbyeMessage', customMsg);
            return reply(`✅ Goodbye message set to:\n_${customMsg}_`);
        }

        if (!['on', 'off'].includes(action)) {
            return reply('❌ Use: `.goodbye on`, `.goodbye off`, or `.goodbye set <message>`');
        }

        database.setGroup(from, 'goodbye', action === 'on');
        reply(`✅ Goodbye messages *${action === 'on' ? 'enabled' : 'disabled'}*!`);
    }
};
