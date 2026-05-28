/**
 * PinMsg Command — Simulate pinning a message by re-posting it prominently
 * Usage: Reply to a message + .pin
 */
module.exports = {
    name: 'pin',
    aliases: ['pinmsg', 'pinned'],
    description: 'Pin a message prominently in the group',
    category: 'group',
    async execute({ sock, from, reply, msg, isGroup }) {
        if (!isGroup) return reply('👥 This command can only be used in groups!');
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const text = quoted?.conversation || quoted?.extendedTextMessage?.text;
        if (!text) return reply('📌 Reply to a message with .pin to pin it!');
        reply(
            `📌 *PINNED MESSAGE*\n` +
            `${'─'.repeat(20)}\n\n` +
            `${text}\n\n` +
            `${'─'.repeat(20)}\n` +
            `_Pinned by admin_`
        );
    }
};
