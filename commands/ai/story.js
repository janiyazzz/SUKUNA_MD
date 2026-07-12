/**
 * .story <idea> — AI writes a short story.
 */
const { ask } = require('../../utils/smartAI');

module.exports = {
    name: 'story',
    aliases: ['shortstory'],
    description: 'Write a short story from an idea',
    category: 'ai',
    async execute({ reply, args }) {
        if (!args.length) {
            return reply('📖 *Story*\n\nUsage: .story <idea>\nExample: .story a robot who learns to paint');
        }
        const idea = args.join(' ');
        await reply('📖 *Writing...*');
        const out = await ask({
            system: 'You are a creative storyteller. Write an engaging short story (under 300 words) based on the idea.',
            user: idea,
            remember: false,
        });
        if (!out) return reply('❌ AI is busy right now. Try again in a moment.');
        reply(`📖 *Story*\n\n${out}`);
    },
};
