module.exports = {
    name: 'repeat',
    description: 'Repeat text N times. Usage: .repeat 5 hello',
    category: 'general',
    async execute({ args, reply }) {
        const n = parseInt(args[0]);
        if (isNaN(n) || n < 1 || n > 50) return reply('Usage: .repeat <1-50> <text>');
        const text = args.slice(1).join(' ');
        if (!text) return reply('Give me text to repeat.');
        return reply((text + ' ').repeat(n).trim());
    }
};
