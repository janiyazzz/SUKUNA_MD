/**
 * MentionMessage Command — Owner Only
 * When anyone tags the bot owner in a group, the bot automatically
 * replies to them with the message the owner set.
 *
 * Usage:
 *   .mentionmessage set I'm busy, will reply later
 *   .mentionmessage off
 *   .mentionmessage status
 *   .mentionmessage clear
 */

const database = require('../../utils/database');

module.exports = {
    name: 'mentionmessage',
    aliases: ['mmessage', 'mentionmsg', 'mmsg', 'mentionreply'],
    description: 'Auto-reply when someone mentions the owner in a group',
    category: 'owner',

    async execute({ reply, args, phoneNumber }) {
        const action = (args[0] || '').toLowerCase();
        const current = database.getMentionMessage(phoneNumber);

        if (!action || action === 'status') {
            return reply(
                `╔══════════════════════════╗\n` +
                `║  💬 *MENTION MESSAGE*     ║\n` +
                `╚══════════════════════════╝\n\n` +
                `Status: ${current?.enabled ? '✅ ON' : '❌ OFF'}\n` +
                `Message: ${current?.message ? `_"${current.message}"_` : '_(not set)_'}\n\n` +
                `*Usage:*\n` +
                `▸ .mentionmessage set <text>  — set message & enable\n` +
                `▸ .mentionmessage off         — disable\n` +
                `▸ .mentionmessage clear       — clear saved message\n` +
                `▸ .mentionmessage status      — show setting\n\n` +
                `_Whenever someone tags you in a group, the bot replies with your set message._`
            );
        }

        if (action === 'off' || action === 'disable') {
            database.setMentionMessage(phoneNumber, { enabled: false, message: current?.message || '' });
            return reply('❌ *Mention Message DISABLED*\n\nThe bot will no longer auto-reply when you are tagged.');
        }

        if (action === 'clear') {
            database.setMentionMessage(phoneNumber, { enabled: false, message: '' });
            return reply('🗑️ *Mention Message CLEARED*\n\nSaved message deleted and feature disabled.');
        }

        if (action === 'set' || action === 'on') {
            const message = args.slice(1).join(' ').trim();
            if (!message) {
                return reply(
                    '❌ Please provide a message!\n\n' +
                    'Example: `.mentionmessage set I\'m busy right now, will reply later!`'
                );
            }
            database.setMentionMessage(phoneNumber, { enabled: true, message });
            return reply(
                `✅ *Mention Message ENABLED*\n\n` +
                `Message: _"${message}"_\n\n` +
                `_Whenever someone tags you in a group, the bot will reply with this message._`
            );
        }

        return reply('❓ Usage: `.mentionmessage set <your message>` | `.mentionmessage off` | `.mentionmessage status`');
    },
};
