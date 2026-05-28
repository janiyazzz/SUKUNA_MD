/**
 * SetWelcomeMsg Command — Customize the welcome message
 * Usage: .setwelcomemsg <message>
 * Variables: {name} {group} {count}
 */
const database = require('../../utils/database');
module.exports = {
    name: 'setwelcomemsg',
    aliases: ['customwelcome', 'welcomemsg'],
    description: 'Set a custom welcome message for new members',
    category: 'admin',
    async execute({ reply, args, from, isGroup }) {
        if (!isGroup) return reply('👥 This command can only be used in groups!');
        if (!args.length) return reply(
            '📝 *Set Welcome Message*\n\nUsage: .setwelcomemsg <message>\n\nVariables:\n{name} = New member name\n{group} = Group name\n{count} = Member count\n\nExample:\n.setwelcomemsg Welcome {name} to {group}! You are member #{count}!'
        );
        const msg = args.join(' ');
        database.setGroupData(from, 'customWelcome', msg);
        reply(`✅ *Welcome Message Set!*\n\nPreview:\n${msg.replace('{name}','[Member]').replace('{group}','[Group]').replace('{count}','[N]')}`);
    }
};
