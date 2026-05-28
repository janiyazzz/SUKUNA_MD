/**
 * SetGoodbyeMsg Command — Customize the goodbye message
 * Usage: .setgoodbyemsg <message>
 */
const database = require('../../utils/database');
module.exports = {
    name: 'setgoodbyemsg',
    aliases: ['custombgoodbye', 'goodbyemsg'],
    description: 'Set a custom goodbye message for leaving members',
    category: 'admin',
    async execute({ reply, args, from, isGroup }) {
        if (!isGroup) return reply('👥 This command can only be used in groups!');
        if (!args.length) return reply('📝 Usage: .setgoodbyemsg <message>\n\nVariables: {name} {group}');
        const msg = args.join(' ');
        database.setGroupData(from, 'customGoodbye', msg);
        reply(`✅ *Goodbye Message Set!*\n\nPreview:\n${msg.replace('{name}','[Member]').replace('{group}','[Group]')}`);
    }
};
