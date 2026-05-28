const database = require('../../utils/database');

module.exports = {
    name: 'ban',
    aliases: ['blockuser'],
    description: 'Ban a user from using bot commands',
    category: 'admin',
    async execute({ reply, args }) {
        if (!args[0]) return reply('❌ Usage: `.ban 2348012345678`');
        const target = args[0].replace(/[^0-9]/g, '');
        database.setBanned(target, true);
        reply(`🚫 *+${target}* has been banned from using bot commands!`);
    }
};
