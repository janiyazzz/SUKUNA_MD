module.exports = {
    name: 'punch',
    description: 'Punch someone',
    category: 'fun',
    async execute({ args, reply, msg }) {
        const target = (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
            || msg.message?.extendedTextMessage?.contextInfo?.participant
            || args.join(' ').trim()
            || 'them').split('@')[0];
        const lines = ["One punch \u2014 {target} is down.", "Sukuna delivers a clean blow to {target}.", "{target} caught these hands."];
        const line = lines[Math.floor(Math.random()*lines.length)];
        return reply('👊 ' + line.replace('{target}', '@' + target));
    }
};
