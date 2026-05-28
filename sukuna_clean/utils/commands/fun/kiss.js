/**
 * Kiss Command — Kiss someone with a GIF
 * Usage: .kiss @user
 */

module.exports = {
    name: 'kiss',
    aliases: ['smooch', 'mwah'],
    description: 'Kiss someone virtually',
    category: 'fun',
    async execute({ sock, msg, from, reply, args }) {
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
        
        let targetUser = mentioned[0] || quotedParticipant;
        
        if (!targetUser && args.length > 0) {
            const input = args[0].replace(/[^0-9]/g, '');
            if (input) targetUser = input + '@s.whatsapp.net';
        }

        const kissGifs = [
            'https://media.giphy.com/media/G3va31oEEnIkM/giphy.gif',
            'https://media.giphy.com/media/FqBTvSNjNzeZG/giphy.gif',
            'https://media.giphy.com/media/zkppEMFvRX5FC/giphy.gif'
        ];

        const gif = kissGifs[Math.floor(Math.random() * kissGifs.length)];
        const sender = msg.key.participant || msg.key.remoteJid;

        try {
            await sock.sendMessage(from, {
                video: { url: gif },
                gifPlayback: true,
                caption: targetUser 
                    ? `💋 *KISS!*\n\n@${sender.split('@')[0]} kissed @${targetUser.split('@')[0]}! 💕`
                    : `💋 *KISS!*\n\n@${sender.split('@')[0]} blew a kiss! 💕`,
                mentions: targetUser ? [sender, targetUser] : [sender]
            }, { quoted: msg });
        } catch (err) {
            reply(targetUser 
                ? `💋 *KISS!*\n\n@${sender.split('@')[0]} kissed @${targetUser.split('@')[0]}! 💕`
                : `💋 *KISS!*\n\n@${sender.split('@')[0]} blew a kiss! 💕`,
                { mentions: targetUser ? [sender, targetUser] : [sender] }
            );
        }
    }
};
