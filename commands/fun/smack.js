module.exports = {
    name: 'smack',
    description: 'Smack someone',
    category: 'fun',
    async execute({ args, reply, msg }) {
        const target = (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
            || msg.message?.extendedTextMessage?.contextInfo?.participant
            || args.join(' ').trim()
            || 'them').split('@')[0];
        const lines = ["{target} got smacked into next week.", "A clean slap for {target}.", "{target} took a clean five-finger discount."];
        const line = lines[Math.floor(Math.random()*lines.length)];
        return reply('✋ ' + line.replace('{target}', '@' + target));
    }
};
