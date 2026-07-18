'use strict';

const DEVICE_LABELS = {
    ios: 'iPhone (iOS)',
    android: 'Android',
    web: 'WhatsApp Web',
    desktop: 'WhatsApp Desktop',
    unknown: 'Unknown device',
};

function detectDevice(messageId) {
    // Modern WhatsApp message IDs vary in length, so prefix-based rules
    // identify the platform reliably regardless of length.
    const id = String(messageId || '').trim().toUpperCase();
    if (!id) return 'unknown';
    if (id.startsWith('3EB0')) return 'web';
    if (id.startsWith('3A')) return 'ios';
    if (id.startsWith('3F') || id.startsWith('BAE5')) return 'desktop';
    if (/^[0-9A-F]{16,40}$/.test(id)) return 'android';
    return 'unknown';
}

module.exports = {
    name: 'device',
    aliases: ['checkdevice', 'dev'],
    description: 'Detect the device a message was sent from',
    category: 'utility',
    usage: '.device (reply to a message)',

    async execute(context) {
        const { sock, msg: m, reply } = context;
        try {
            const quotedId = m.quoted?.key?.id 
                || m.quoted?.id
                || m.msg?.contextInfo?.stanzaId
                || m.message?.extendedTextMessage?.contextInfo?.stanzaId;

            const targetId = quotedId || m.key?.id;
            const targetSender = quotedId
                ? (m.quoted?.sender || m.msg?.contextInfo?.participant || 'that user')
                : (m.sender || 'you');

            if (!targetId) return reply('Reply to a message with .device to detect the device');

            const device = detectDevice(targetId);
            const label = DEVICE_LABELS[device] || DEVICE_LABELS.unknown;
            const who = quotedId ? `@${String(targetSender).split('@')[0]}` : 'You';

            let pp = null;
            try {
                pp = await sock.profilePictureUrl(targetSender, 'image');
            } catch (_) {}

            const message = {
                text: `${who}: *${label}*`,
                mentions: quotedId && String(targetSender).includes('@') ? [targetSender] : [],
            };

            if (pp) {
                return sock.sendMessage(m.chat, {
                    image: { url: pp },
                    caption: message.text,
                    mentions: message.mentions,
                }, { quoted: m });
            }

            return sock.sendMessage(m.chat, message, { quoted: m });
        } catch (err) {
            console.error('[device] error:', err.message);
            reply('Failed to detect device.');
        }
    },

    detectDevice,
};
