/**
 * MentionReact — Owner & Mod command
 * Owner: .mentionreact set 🔥  → reacts when OWNER is tagged
 * Mod:   .mentionreact set 💻  → reacts when THAT MOD is tagged
 *
 * Usage:
 *   .mentionreact set <emoji>  — enable with emoji
 *   .mentionreact off          — disable
 *   .mentionreact status       — show setting
 */

const database = require('../../utils/database');

module.exports = {
    name: 'mentionreact',
    aliases: ['mreact', 'mentionreaction'],
    description: 'Auto-react when someone mentions you in a group',
    category: 'owner',

    async execute({ reply, args, phoneNumber, sender, isOwner, isMod }) {
        if (!isOwner && !isMod) return reply('❌ Owner or Mod only!');

        // userPhone = the actual phone number of whoever is running this command
        const userPhone = sender.split('@')[0].split(':')[0].replace(/\D/g, '');
        const action = (args[0] || '').toLowerCase();
        const current = database.getMentionReact(phoneNumber, userPhone);

        if (!action || action === 'status') {
            return reply(
                `╔══════════════════════════╗\n` +
                `║   ⚡ *MENTION REACT*      ║\n` +
                `╚══════════════════════════╝\n\n` +
                `Status: ${current?.enabled ? `✅ ON  —  ${current.emoji}` : '❌ OFF'}\n\n` +
                `*Usage:*\n` +
                `▸ .mentionreact set 🔥\n` +
                `▸ .mentionreact off\n` +
                `▸ .mentionreact status\n\n` +
                `_Whenever someone tags you in a group, the bot reacts with your chosen emoji._`
            );
        }

        if (action === 'off' || action === 'disable') {
            database.setMentionReact(phoneNumber, { enabled: false, emoji: current?.emoji || '👀' }, userPhone);
            return reply('❌ *Mention React DISABLED*');
        }

        if (action === 'set' || action === 'on') {
            const emoji = args[1]?.trim();
            if (!emoji) return reply('❌ Provide an emoji!\n\nExample: `.mentionreact set 🔥`');
            database.setMentionReact(phoneNumber, { enabled: true, emoji }, userPhone);
            return reply(`✅ *Mention React set to ${emoji}*\n\n_Bot will react with ${emoji} whenever someone tags you._`);
        }

        // Shortcut: .mentionreact 🔥
        const emoji = args[0]?.trim();
        if (emoji) {
            database.setMentionReact(phoneNumber, { enabled: true, emoji }, userPhone);
            return reply(`✅ *Mention React set to ${emoji}*`);
        }

        return reply('❓ Usage: `.mentionreact set <emoji>` | `.mentionreact off`');
    },
};
