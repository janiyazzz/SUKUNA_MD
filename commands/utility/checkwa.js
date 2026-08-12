/**
 * checkwa — Check whether a user is on WhatsApp, and whether their account
 * is a regular/personal account or a WhatsApp Business account.
 *
 * Usage:
 *   .checkwa @user        (tag a user)
 *   .checkwa              (reply to a user's message)
 *   .checkwa              (no target -> checks yourself)
 *
 * ⚠️ IMPORTANT — about "GB WhatsApp" / WhatsApp Plus / other mods:
 *   Modded WhatsApp clients (GB WhatsApp, WA Plus, FM WhatsApp, etc.) use the
 *   exact same end-to-end encrypted protocol as official WhatsApp and do NOT
 *   send any "client type" field that other users, bots, or even WhatsApp's
 *   own servers can read. There is no official or unofficial API that can
 *   confirm someone is using a mod — anything that claims to reliably do
 *   this is guessing or faking it. This command will NOT pretend to detect
 *   GB WhatsApp specifically, since that would just be a random/false
 *   result. What it CAN tell you reliably (straight from WhatsApp's own
 *   servers) is:
 *     • Whether the number is registered on WhatsApp at all
 *     • Whether the account is set up as a WhatsApp Business account
 *       (business accounts publish a business profile that regular
 *       accounts, official or modded, don't have)
 */

'use strict';

module.exports = {
    name: 'checkwa',
    aliases: ['checkwhatsapp', 'wacheck', 'checkgb'],
    description: "Check if a tagged user is on WhatsApp and whether it's a Business or regular account",
    category: 'utility',
    usage: '.checkwa @user  |  reply to a message with .checkwa',

    async execute({ sock, msg, from, sender, reply }) {
        try {
            // Resolve target: mention > reply > sender
            const ctx       = msg.message?.extendedTextMessage?.contextInfo;
            const mentioned = ctx?.mentionedJid?.[0];
            const replied   = ctx?.participant;
            const target    = mentioned || replied || sender;

            const number = target.split('@')[0].split(':')[0];

            // ── Confirm the number exists on WhatsApp ──
            let exists = true;
            let notify = '';
            try {
                const [c] = await sock.onWhatsApp(target).catch(() => []);
                if (c) {
                    exists = !!c.exists;
                    notify = c.notify || '';
                }
            } catch (_) {}

            if (!exists) {
                return reply(`🚫 *+${number}* is not registered on WhatsApp.`);
            }

            // ── Business profile check (the only client-type signal WhatsApp actually exposes) ──
            let business = null;
            try { business = await sock.getBusinessProfile(target); } catch (_) {}

            const isBusiness = !!(
                business?.description ||
                business?.email ||
                business?.website?.length ||
                business?.category
            );

            const accountType = isBusiness
                ? '💼 *WhatsApp Business*'
                : '📱 *Regular WhatsApp* (personal account)';

            const lines = [
                `╔══════════════════════════╗`,
                `║   🔍 *WHATSAPP CHECK*      ║`,
                `╚══════════════════════════╝`,
                ``,
                `┌─────────────────────────`,
                `│ 🪪  *Name:* ${notify || 'Unknown'}`,
                `│ 📱  *Number:* +${number}`,
                `│ ✅  *On WhatsApp:* Yes`,
                `│ 🏷️  *Account Type:* ${accountType}`,
            ];

            if (isBusiness && business?.category) {
                lines.push(`│ 🗂️  *Category:* ${business.category}`);
            }

            lines.push(`└─────────────────────────`);
            lines.push('');
            lines.push(
                `_Note: mods like GB WhatsApp can't be reliably detected — ` +
                `they use the same protocol as official WhatsApp and expose no ` +
                `identifying field. "Regular WhatsApp" above means "not a ` +
                `Business account"; it may be official WhatsApp or a modified client._`
            );

            await sock.sendMessage(from, {
                text: lines.join('\n'),
                mentions: [target],
            }, { quoted: msg });
        } catch (err) {
            console.error('[checkwa]', err.message);
            reply('❌ Failed to check WhatsApp status.');
        }
    },
};
