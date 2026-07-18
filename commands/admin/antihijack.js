/**
 * AntiHijack Command — Sukuna MD admin protection
 * Usage: .antihijack on | off | status
 *
 * Robust + fast: cached group metadata, parallel reversals, retry with backoff,
 * loop guard, owner/sudo allowlist. The actual reversal logic lives in
 * lib/promotionGuard.js → handleParticipantUpdate().
 */

const { updateGroupConfig, getGroupConfig, setupPromotionGuard } = require('../../lib/promotionGuard');
const database = require('../../utils/database');

function boldItalic(str) {
    const upperBase = 0x1D63C, lowerBase = 0x1D656;
    let out = '';
    for (const ch of str) {
        const c = ch.codePointAt(0);
        if (c >= 0x41 && c <= 0x5A) out += String.fromCodePoint(upperBase + (c - 0x41));
        else if (c >= 0x61 && c <= 0x7A) out += String.fromCodePoint(lowerBase + (c - 0x61));
        else out += ch;
    }
    return out;
}

module.exports = {
    name: 'antihijack',
    aliases: ['adminguard'],
    description: 'Protect admin hierarchy — auto-reverse unauthorized promote/demote',
    category: 'admin',

    async execute(sock, m, { reply, args }) {
        const groupId = m.chat;
        if (!groupId.endsWith('@g.us')) return reply('⛧ ' + boldItalic('Group only') + ' ⛧');

        const action = (args[0] || '').toLowerCase();
        const settings = getGroupConfig(groupId);
        const on = settings.antipromote || settings.antidemote;

        const card = (title, body) =>
            `╭─❒ ◈ ${boldItalic('SUKUNA · AntiHijack')} ❒\n` +
            `│ ⛧ ${title}\n` +
            `├──────────────⛧\n` +
            body.split('\n').map(l => `│ ${l}`).join('\n') + `\n` +
            `╰────────────⛧`;

        if (!['on','off','status'].includes(action)) {
            return reply(card(
                boldItalic('Usage'),
                `Status   : ${on ? 'ON ✅' : 'OFF ❌'}\n` +
                `Toggle   : .antihijack on | off\n` +
                `Inspect  : .antihijack status\n\n` +
                `Reverses any unauthorized\n` +
                `promote / demote in <1s and\n` +
                `demotes the offender.\n` +
                `Bot must be admin.`
            ));
        }

        if (action === 'status') {
            return reply(card(
                boldItalic('Status'),
                on
                    ? `Active ✅\nHierarchy is locked.\nUnauthorized promotes/demotes\nget reversed instantly.`
                    : `Inactive ❌\nEnable with .antihijack on`
            ));
        }

        if (action === 'on') {
            updateGroupConfig(groupId, { antipromote: true, antidemote: true });
            setupPromotionGuard(sock);
            return reply(card(
                boldItalic('Activated'),
                `Protection : ON ✅\nReaction   : <1s\nRetries    : 3 × 400ms\nLoop guard : enabled\n\nBot must be admin.`
            ));
        }

        // off
        updateGroupConfig(groupId, { antipromote: false, antidemote: false });
        return reply(card(
            boldItalic('Deactivated'),
            `Protection : OFF ❌\nHierarchy is no longer\nguarded by Sukuna.`
        ));
    }
};
