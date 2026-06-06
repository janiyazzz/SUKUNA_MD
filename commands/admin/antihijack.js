/**
 * AntiHijack Command — Sukuna MD admin protection
 * Usage: .antihijack on | off | status
 *
 * Robust + fast: cached group metadata, parallel reversals, retry with backoff,
 * loop guard, owner/sudo allowlist. The actual reversal logic lives in
 * lib/sessionManager.js → handleGroupParticipants().
 */

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
    aliases: ['adminguard', 'antidemote'],
    description: 'Protect admin hierarchy — auto-reverse unauthorized promote/demote',
    category: 'admin',

    async execute({ msg, reply, args, from, isGroup }) {
        if (!isGroup) return reply('⛧ ' + boldItalic('Group only') + ' ⛧');

        const action = (args[0] || '').toLowerCase();
        const group  = database.getGroup(from);
        const on = !!group.antihijack;

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
                    ? `Active ✅\nHierarchy is locked.\nUnauthorized promotes get\nreversed instantly.`
                    : `Inactive ❌\nEnable with .antihijack on`
            ));
        }

        if (action === 'on') {
            database.setGroup(from, 'antihijack', true);
            return reply(card(
                boldItalic('Activated'),
                `Protection : ON ✅\nReaction   : <1s\nRetries    : 3 × 400ms\nLoop guard : enabled\n\nBot must be admin.`
            ));
        }

        // off
        database.setGroup(from, 'antihijack', false);
        return reply(card(
            boldItalic('Deactivated'),
            `Protection : OFF ❌\nHierarchy is no longer\nguarded by Sukuna.`
        ));
    }
};
