/**
 * Repo Command — classy canvas card showing the bot network + WhatsApp channel
 * Usage: .repo
 */

'use strict';

const config = require('../../config');
const { renderRepoCard } = require('../../utils/canvasRender');

const SERVERS = [
    { emoji: '🤖', label: 'Pasquamini Bot', url: 'https://t.me/Pasquamini_bot' },
    { emoji: '⚡', label: 'Nelsonmd Bot',   url: 'https://t.me/Nelsonmd_bot' },
    { emoji: '🔥', label: 'Gojokw Bot',     url: 'https://t.me/Gojokw_bot' },
];

const CHANNEL_URL  = 'https://whatsapp.com/channel/0029VbCJho147XeEEuR1LA3s';
const CHANNEL_JID  = '120363424109748354@newsletter';
const CHANNEL_NAME = 'Sukuna MD Pasqua tech';

function newsletterCtx() {
    return {
        isForwarded: true,
        forwardingScore: 999,
        forwardedNewsletterMessageInfo: {
            newsletterJid:   CHANNEL_JID,
            newsletterName:  CHANNEL_NAME,
            serverMessageId: 143,
        },
    };
}

function caption(botName) {
    const lines = SERVERS.map(s => `${s.emoji} *${s.label}*\n› ${s.url}`).join('\n\n');
    return (
        `╭━━━〔 *⚔️  ${botName.toUpperCase()}  ⚔️* 〕━━━╮\n` +
        `│  𝙼𝙰𝙻𝙴𝚅𝙾𝙻𝙴𝙽𝚃 𝙽𝙴𝚃𝚆𝙾𝚁𝙺 · 𝙳𝙸𝚁𝙴𝙲𝚃𝙾𝚁𝚈\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
        `${lines}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📣 *Official WhatsApp Channel*\n› ${CHANNEL_URL}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> 🔥 _Powered by ${botName}_`
    );
}

module.exports = {
    name:        'repo',
    aliases:     ['servers', 'bots', 'botservers', 'network'],
    description: 'Show the official bot network + WhatsApp channel',
    category:    'admin',

    async execute({ sock, msg, from, reply }) {
        const botName = config.botName || 'SUKUNA MD';

        try {
            const buf = await renderRepoCard({
                botName,
                tagline: 'King of Curses · Malevolent Network',
                servers: SERVERS,
                channelLabel: 'WhatsApp Channel',
                channelUrl:   CHANNEL_URL,
            });

            await sock.sendMessage(from, {
                image: buf,
                caption: caption(botName),
                contextInfo: newsletterCtx(),
            }, { quoted: msg });
        } catch (e) {
            console.error('[repo]', e.message);
            // Plain-text fallback
            try {
                await sock.sendMessage(from, {
                    text: caption(botName),
                    contextInfo: newsletterCtx(),
                }, { quoted: msg });
            } catch {
                await reply(caption(botName));
            }
        }
    },
};
