/**
 * Slap Command — Slap someone with a GIF
 * Usage: .slap @user
 */

module.exports = {
    name: 'slap',
    aliases: ['hit', 'smack'],
    description: 'Slap someone virtually',
    category: 'fun',
    async execute({ sock, msg, from, reply, args }) {
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
        
        let targetUser = mentioned[0] || quotedParticipant;
        
        if (!targetUser && args.length > 0) {
            const input = args[0].replace(/[^0-9]/g, '');
            if (input) targetUser = input + '@s.whatsapp.net';
        }

        const slapGifs = [
            'https://media.giphy.com/media/Zau0yrl17uzdK/giphy.gif',
            'https://media.giphy.com/media/xT0BKiwiVJq5B0XhHG/giphy.gif',
            'https://media.giphy.com/media/lX03hULhgCYQ8/giphy.gif'
        ];

        const gif = slapGifs[Math.floor(Math.random() * slapGifs.length)];
        const sender = msg.key.participant || msg.key.remoteJid;

        try {
            await sock.sendMessage(from, {
                video: { url: gif },
                gifPlayback: true,
                caption: targetUser 
                    ? `👋 *SLAP!*\n\n@${sender.split('@')[0]} slapped @${targetUser.split('@')[0]}!`
                    : `👋 *SLAP!*\n\n@${sender.split('@')[0]} slapped themselves!`,
                mentions: targetUser ? [sender, targetUser] : [sender]
            }, { quoted: msg });
        } catch (err) {
            reply(targetUser 
                ? `👋 *SLAP!*\n\n@${sender.split('@')[0]} slapped @${targetUser.split('@')[0]}!`
                : `👋 *SLAP!*\n\n@${sender.split('@')[0]} slapped themselves!`,
                { mentions: targetUser ? [sender, targetUser] : [sender] }
            );
        }
    }
};
