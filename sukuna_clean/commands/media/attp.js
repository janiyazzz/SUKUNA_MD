/**
 * ATTP Command — Animated text to picture
 * Usage: .attp <text>
 */

module.exports = {
    name: 'attp',
    aliases: ['animatedttp', 'text2gif'],
    description: 'Create an animated sticker from text',
    category: 'media',
    async execute({ sock, msg, from, reply, args }) {
        if (!args.length) {
            return reply(
                `✨ *Animated Text to Picture*\n\n` +
                `Usage: .attp <text>\n` +
                `Example: .attp Hello World`
            );
        }

        const text = args.join(' ');
        
        try {
            const encodedText = encodeURIComponent(text);
            const gifUrl = `https://api.lolhuman.xyz/api/attp?apikey=free&text=${encodedText}`;
            
            await sock.sendMessage(from, {
                sticker: { url: gifUrl }
            }, { quoted: msg });
        } catch (err) {
            reply('❌ Failed to create animated text sticker. Please try again.');
        }
    }
};
