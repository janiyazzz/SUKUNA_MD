/**
 * Owner Command — Sends owner info as a WhatsApp vCard contact
 * Usage: .owner
 */

const config = require('../../config');

module.exports = {
    name: 'owner',
    aliases: ['contact', 'creator', 'dev'],
    description: 'Send bot owner contact as a saveable vCard',
    category: 'admin',

    async execute({ sock, msg, from, reply }) {
        const ownerName   = config.owner?.name    || 'PASQUA';
        const ownerNumber = '2349127814853';
        const telegram    = config.owner?.telegram || 't.me/Pasquaking';
        const botName     = config.botName         || 'SUKUNA MD';

        const vcard = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `FN:${ownerName}`,
            `N:${ownerName};;;`,
            `ORG:${botName}`,
            `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}`,
            `URL:https://t.me/Pasquaking`,
            `NOTE:${botName} Owner`,
            'END:VCARD'
        ].join('\n');

        try {
            await sock.sendMessage(from, {
                contacts: {
                    displayName: ownerName,
                    contacts: [{ vcard }],
                },
            }, { quoted: msg });

            await sock.sendMessage(from, {
                text:
                    `👑 *${botName} Owner*\n\n` +
                    `👤 *Name:* ${ownerName}\n` +
                    `📱 *Number:* +${ownerNumber}\n` +
                    `✈️ *Telegram:* https://t.me/Pasquaking\n\n` +
                    `_Tap the contact above to save or chat with the owner._`,
            }, { quoted: msg });

        } catch (e) {
            console.error('[OWNER CMD]', e.message);
            await reply(
                `👑 *${botName} Owner*\n\n` +
                `👤 *Name:* ${ownerName}\n` +
                `📱 *Number:* +${ownerNumber}\n` +
                `✈️ *Telegram:* https://t.me/Pasquaking`
            );
        }
    }
};
