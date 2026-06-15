/**
 * MentionReact Command — Owner Only
 * When anyone tags the bot owner in a group, the bot automatically
 * reacts to their message with the emoji the owner chose.
 *
 * Usage:
 *   .mentionreact set 🔥    — set reaction emoji
 *   .mentionreact off       — disable
 *   .mentionreact status    — show current setting
 */

const database = require('../../utils/database');

module.exports = {
    name: 'mentionreact',
    aliases: ['mreact', 'mentionreaction'],
    description: 'Auto-react when someone mentions the owner in a group',
    category: 'owner',

    async execute({ reply, args, phoneNumber }) {
        const action = (args[0] || '').toLowerCase();

        const current = database.getMentionReact(phoneNumber);

        if (!action || action === 'status') {
            return reply(
                `╔══════════════════════════╗\n` +
                `║   ⚡ *MENTION REACT*      ║\n` +
                `╚══════════════════════════╝\n\n` +
                `Status: ${current?.enabled ? `✅ ON  —  ${current.emoji}` : '❌ OFF'}\n\n` +
                `*Usage:*\n` +
                `▸ .mentionreact set 🔥  — set emoji & enable\n` +
                `▸ .mentionreact off     — disable\n` +
                `▸ .mentionreact status  — show setting\n\n` +
                `_Whenever someone tags you in a group, the bot reacts with your chosen emoji._`
            );
        }

        if (action === 'off' || action === 'disable') {
            database.setMentionReact(phoneNumber, { enabled: false, emoji: current?.emoji || '👀' });
            return reply('❌ *Mention React DISABLED*\n\nThe bot will no longer react when you are tagged.');
        }

        if (action === 'set' || action === 'on') {
            const emoji = args[1]?.trim();
            if (!emoji) {
                return reply(
                    '❌ Please provide an emoji!\n\n' +
                    'Example: `.mentionreact set 🔥`'
                );
            }
            database.setMentionReact(phoneNumber, { enabled: true, emoji });
            return reply(
                `✅ *Mention React ENABLED*\n\n` +
                `Emoji: ${emoji}\n\n` +
                `_Whenever someone tags you in a group, the bot will react with ${emoji}_`
            );
        }

        // If no subcommand matched, treat the first arg as an emoji shortcut
        // e.g. ".mentionreact 🔥"
        const emoji = args[0]?.trim();
        if (emoji) {
            database.setMentionReact(phoneNumber, { enabled: true, emoji });
            return reply(
                `✅ *Mention React set to ${emoji}*\n\n` +
                `_Bot will react with ${emoji} whenever someone tags you._`
            );
        }

        return reply('❓ Usage: `.mentionreact set <emoji>` | `.mentionreact off` | `.mentionreact status`');
    },
};
