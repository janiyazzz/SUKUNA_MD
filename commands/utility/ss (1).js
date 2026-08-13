/**
 * .ss — Secure Service Label Toggle
 * When ON: Every outgoing message includes secureMetaServiceLabel + ai flag
 * This shows the "AI" / Secure Service label on WhatsApp
 *
 * Usage:
 *   .ss on    — Activate
 *   .ss off   — Deactivate
 */
module.exports = {
    name: 'ss',
    aliases: ['secureservice', 'securelabel', 'ailabel'],
    description: 'Toggle Secure Service Label (AI indicator) on/off',
    usage: '.ss on | .ss off',
    category: 'utility',
    async execute({ reply, args, isOwner }) {
        if (!isOwner) {
            return reply('❌ *Owner only!*');
        }

        const sub = (args[0] || '').toLowerCase();

        if (sub === 'on' || sub === 'activate' || sub === 'true') {
            global.__sukunaSS = true;
            return reply(
                `╔══════════════════════════╗\n` +
                `║  🔐 *SECURE SERVICE*      ║\n` +
                `║       *ACTIVATED*         ║\n` +
                `╚══════════════════════════╝\n\n` +
                `All messages will now show the *Secure Service Label*.\n\n` +
                `Use *.ss off* to stop.`
            );
        }

        if (sub === 'off' || sub === 'deactivate' || sub === 'false') {
            global.__sukunaSS = false;
            return reply(
                `╔══════════════════════════╗\n` +
                `║  🔐 *SECURE SERVICE*      ║\n` +
                `║      *DEACTIVATED*        ║\n` +
                `╚══════════════════════════╝\n\n` +
                `Messages are back to normal.`
            );
        }

        // Show status
        const status = global.__sukunaSS ? '🟢 ACTIVE' : '🔴 INACTIVE';
        return reply(
            `╔══════════════════════════╗\n` +
            `║  🔐 *SECURE SERVICE*      ║\n` +
            `║    *STATUS:* ${status}    ║\n` +
            `╚══════════════════════════╝\n\n` +
            `*Usage:*\n` +
            `▸ .ss on  — Activate\n` +
            `▸ .ss off — Deactivate`
        );
    }
};
