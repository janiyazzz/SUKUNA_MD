/**
 * Owner Command — Sends owner info as a WhatsApp vCard contact
 * Usage: .owner
 *
 * Renders as a native "Contact" bubble the user can tap to save.
 */

const config = require('../../config');

module.exports = {
    name: 'owner',
    aliases: ['contact', 'creator', 'dev'],
    description: 'Send bot owner contact as a saveable vCard',
    category: 'admin',

    async execute({ sock, msg, from, reply }) {
        const ownerName   = config.owner?.name    || 'PASQUA';
        const ownerNumber = '2349127814853';   // owner WhatsApp number
        const telegram    = config.owner?.telegram || 't.me/Pasquaking';
        const botName     = config.botName         || 'SUKUNA MD';

        // ── vCard string (WhatsApp renders this as a native contact bubble) ──
        const vcard =
            `BEGIN:VCARD\n` +
            `VERSION:3.0\n` +
            `FN:${ownerName} | ${botName}\n` +
            `ORG:${botName};\n` +
            `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}\n` +
            `URL:https://${telegram.replace(/^https?:\/\//, '')}\n` +
            `NOTE:Bot Owner — tap to chat or save contact.\n` +
            `END:VCARD`;

        try {
            // Send as a WhatsApp contact card
            await sock.sendMessage(from, {
                contacts: {
                    displayName: ownerName,
                    contacts: [{ vcard }],
                },
            }, { quoted: msg });

            // Follow-up caption so the user knows what it is
            await sock.sendMessage(from, {
                text:
                    `👑 *${botName} Owner*\n\n` +
                    `👤 *Name:* ${ownerName}\n` +
                    `📱 *Number:* +${ownerNumber}\n` +
                    `✈️ *Telegram:* https://${telegram.replace(/^https?:\/\//, '')}\n\n` +
                    `_Tap the contact above to save or message the owner._`,
            }, { quoted: msg });

        } catch (e) {
            // Plain-text fallback
            await reply(
                `👑 *${botName} Owner*\n\n` +
                `👤 *Name:* ${ownerName}\n` +
                `📱 *Number:* +${ownerNumber}\n` +
                `✈️ *Telegram:* https://${telegram.replace(/^https?:\/\//, '')}`
            );
        }
    }
};
