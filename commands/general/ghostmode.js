'use strict';

const fs = require('fs');
const path = require('path');

// Storage (per-user or global toggle)
const GHOST_FILE = path.join(__dirname, '../../../database/ghost-mode.json');

let ghostEnabled = false;
let ghostChats = new Set();

try {
    if (fs.existsSync(GHOST_FILE)) {
        const data = JSON.parse(fs.readFileSync(GHOST_FILE, 'utf8'));
        ghostEnabled = data.global || false;
        if (data.chats) ghostChats = new Set(data.chats);
    }
} catch (e) {
    console.error('[GHOST MODE] Load error:', e.message);
}

function saveGhost() {
    try {
        fs.writeFileSync(GHOST_FILE, JSON.stringify({
            global: ghostEnabled,
            chats: Array.from(ghostChats)
        }, null, 2));
    } catch (e) {}
}

module.exports = {
    name: 'ghost',
    aliases: ['ghostmode', 'invisible', 'stealth'],
    desc: 'Appear offline to everyone while staying fully active',
    category: 'owner',
    usage: '.ghost on | .ghost off | .ghost status',
    ownerOnly: true,

    execute: async (context) => {
        try {
            const { sock, args, reply } = context;
            const sub = args[0]?.toLowerCase();

            if (!sub || sub === 'status') {
                const status = ghostEnabled ? 'ON' : 'OFF';
                return reply(`Ghost Mode: ${status}`);
            }

            if (sub === 'on') {
                if (ghostEnabled) return reply('Already ON');
                ghostEnabled = true;
                saveGhost();
                try {
                    await sock.sendPresenceUpdate('unavailable');
                } catch {}
                return reply('✓ Ghost mode ON');
            }

            if (sub === 'off') {
                if (!ghostEnabled) return reply('Already OFF');
                ghostEnabled = false;
                saveGhost();
                try {
                    await sock.sendPresenceUpdate('available');
                } catch {}
                return reply('✓ Ghost mode OFF');
            }

            reply('Use: .ghost on | off | status');
        } catch (err) {
            console.error('[ghostmode]', err.message);
            return context.reply('Error: ' + err.message);
        }
    }
};

// Force ghost presence in messages.upsert
module.exports.forceGhostPresence = async (sock) => {
    if (ghostEnabled) {
        try {
            await sock.sendPresenceUpdate('unavailable');
        } catch {}
    }
};
