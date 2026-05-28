/**
 * Owner Command — Shows bot owner contact info with a clean styled card
 * Usage: .owner
 */

const config = require('../../config');

module.exports = {
    name: 'owner',
    aliases: ['contact', 'creator', 'dev'],
    description: 'Show bot owner contact information',
    category: 'admin',

    async execute({ sock, msg, from, reply }) {

        const caption =
`╔══════════════════════════════╗
║                              ║
║   👑  *B O T  O W N E R*    ║
║                              ║
╚══════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤  *Name*    › ${config.owner?.name || 'PASQUA'}
📢  *Channel* › wa.me/'s pinned channel
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

_For questions, support or more —_
_join the official WhatsApp channel_ 👆

> 🔥 _${config.botName}_`;

        const templateButtons = [
            {
                index: 1,
                urlButton: {
                    displayText: '📢 Join WhatsApp Channel',
                    url: 'https://whatsapp.com/channel/0029VbCJho147XeEEuR1LA3s'
                }
            }
        ];

        try {
            await sock.sendMessage(from, {
                text: caption,
                footer: '👑 PASQUA — Bot Owner',
                templateButtons,
                headerType: 1
            }, { quoted: msg });
        } catch (e) {
            await reply(caption);
        }
    }
};
