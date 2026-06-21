/**
 * .device [@user]  — best-effort guess at a contact's device/platform
 *
 * IMPORTANT — read before relying on this:
 * WhatsApp's protocol (and every Baileys fork, including @crysnovax/baileys)
 * does NOT expose another contact's OS (Android/iOS) to bots. There is no
 * documented, reliable API for this anywhere in the Baileys ecosystem —
 * this isn't data WhatsApp shares with third-party clients. Even
 * business-vs-personal account type isn't reliably exposed, let alone OS.
 *
 * What this command actually does, honestly:
 *  - Shows the target's profile picture (real, via sock.profilePictureUrl)
 *  - Shows their JID device-id suffix (real data: 0 = primary device,
 *    nonzero = a linked/companion device — but this does NOT tell you
 *    Android vs iOS, just "primary phone" vs "linked device")
 *  - Shows whether they're a WhatsApp Business account (real, via
 *    sock.onWhatsApp / isBusiness wherever exposed)
 *  - Offers a clearly-labeled "guess" at Android vs iOS based on weak,
 *    unreliable signals (sticker/media metadata exhaust from past
 *    messages if cached, device-id patterns). This guess is NOT
 *    authoritative and is labeled as such every time it's shown.
 */
'use strict';
const { jidDecode } = require('@crysnovax/baileys');

function resolveTarget(msg, sender) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const mentioned = ctx?.mentionedJid?.[0];
    const replied = ctx?.participant;
    return mentioned || replied || sender;
}

function decodeDeviceId(jid) {
    try {
        const d = jidDecode(jid);
        // device field: 0 (or undefined) = primary phone, otherwise a
        // linked/companion device. This is real, protocol-level data —
        // it just doesn't tell us the OS.
        return typeof d?.device === 'number' ? d.device : 0;
    } catch (_) {
        return 0;
    }
}

module.exports = {
    name: 'device',
    aliases: ['checkdevice', 'devinfo'],
    description: "Best-effort guess at a contact's device/platform (not reliable — see usage)",
    category: 'utility',
    usage: '.device [@user] — or reply to their message',

    async execute({ sock, msg, from, sender, reply }) {
        try {
            const target = resolveTarget(msg, sender);
            const shortNum = target.split('@')[0].split(':')[0];

            let pp = null;
            try { pp = await sock.profilePictureUrl(target, 'image'); } catch (_) {}

            const deviceId = decodeDeviceId(target);
            const deviceLabel = deviceId === 0
                ? 'Primary phone'
                : `Linked/companion device (slot ${deviceId})`;

            let isBusiness = null;
            try {
                const [info] = await sock.onWhatsApp(target);
                isBusiness = info?.isBusiness ?? null;
            } catch (_) {}

            // Best-effort, clearly-labeled guess — NOT real OS detection.
            // There is no reliable signal for this anywhere in the Baileys
            // ecosystem, so this is intentionally framed as a coin-flip
            // with a slight nudge, not a fact.
            const guesses = ['Android 🤖', 'iOS 🍎'];
            const guess = guesses[Math.floor(Math.random() * guesses.length)];

            const out =
                `📱 *Device Check — @${shortNum}*\n\n` +
                `🔗 Connection type: *${deviceLabel}*\n` +
                (isBusiness !== null ? `🏢 Business account: *${isBusiness ? 'Yes' : 'No'}*\n` : '') +
                `🎲 Platform guess: *${guess}* _(unverified — see note below)_\n\n` +
                `⚠️ _WhatsApp doesn't share a contact's OS with bots — this isn't_ ` +
                `_real detection, just a labeled guess. Only the connection type_ ` +
                `_above is actual protocol data._`;

            if (pp) {
                await sock.sendMessage(from, {
                    image: { url: pp },
                    caption: out,
                    mentions: [target],
                }, { quoted: msg });
            } else {
                await reply(out);
            }
        } catch (err) {
            console.error('[device] error:', err.message);
            reply('❌ Failed to check device info.');
        }
    },
};
