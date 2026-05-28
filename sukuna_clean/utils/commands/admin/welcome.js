const database = require('../../utils/database');

module.exports = {
    name: 'welcome',
    aliases: ['welcomemsg'],
    description: 'Enable/disable/set welcome messages with profile pic',
    category: 'admin',
    async execute({ reply, args, from, isGroup }) {
        if (!isGroup) return reply('👥 This command can only be used in groups!');
        const action = args[0]?.toLowerCase();
        const group = database.getGroup(from);

        if (!action) {
            return reply(
                `👋 *Welcome Settings*\n\n` +
                `Status: ${group.welcome ? '✅ ON' : '❌ OFF'}\n` +
                `Message: ${group.welcomeMessage || '👋 Welcome @user to @group!'}\n\n` +
                `*Usage:*\n` +
                `• \`.welcome on\` — Enable welcome messages\n` +
                `• \`.welcome off\` — Disable welcome messages\n` +
                `• \`.welcome set Your message here\` — Set custom message\n\n` +
                `_Use @user to mention the new member_\n` +
                `_Profile picture + group name shown automatically_`
            );
        }

        if (action === 'set') {
            const customMsg = args.slice(1).join(' ');
            if (!customMsg) return reply('❌ Provide a message!\n\nExample: `.welcome set Hello @user, welcome to the group!`');
            database.setGroup(from, 'welcomeMessage', customMsg);
            return reply(`✅ Welcome message set to:\n_${customMsg}_`);
        }

        if (!['on', 'off'].includes(action)) {
            return reply('❌ Use: `.welcome on`, `.welcome off`, or `.welcome set <message>`');
        }

        database.setGroup(from, 'welcome', action === 'on');
        reply(`✅ Welcome messages *${action === 'on' ? 'enabled' : 'disabled'}*!`);
    }
};
