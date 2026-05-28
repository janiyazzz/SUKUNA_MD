/**
 * Ping Command — Sukuna MD short bold-italic latency bar
 * One line, bold-italic brand + 5-block bar + ms.
 */

const { boldItalic } = require('../../utils/styleBox');

module.exports = {
    name: 'ping',
    aliases: ['speed', 'latency'],
    description: 'Check bot response speed',
    usage: '.ping',
    category: 'admin',

    async execute({ sock, msg, from, reply }) {
        const start = Date.now();
        let placeholder = null;
        try {
            placeholder = await sock.sendMessage(from, { text: '⛧ ' + boldItalic('pinging') + ' ⛧' }, { quoted: msg });
        } catch (_) {}

        const ms = Date.now() - start;
        const filled = ms < 100 ? 5 : ms < 300 ? 4 : ms < 600 ? 3 : ms < 1000 ? 2 : 1;
        const bar = '▰'.repeat(filled) + '▱'.repeat(5 - filled);
        const result = `⛧ ${boldItalic('SUKUNA')} ⛧  ${bar}  ${ms}ms`;

        if (placeholder?.key) {
            try {
                await sock.sendMessage(from, { text: result, edit: placeholder.key });
                return;
            } catch (_) {}
        }
        // pass raw so the auto-boxer in sessionManager doesn't wrap our one-liner
        await reply(result, { raw: true });
    }
};
