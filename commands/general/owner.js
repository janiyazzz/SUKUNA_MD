/**
 * Owner Command — Sleek verified owner card with photo
 * Usage: .owner
 *
 * Overrides commands/admin/owner.js (loader picks the last loaded by name —
 * the `owner` category loads after `admin`).
 *
 * Reads dynamic overrides from database (set via .setname / .setbio).
 */
'use strict';

const fs        = require('fs');
const path      = require('path');
const config    = require('../../config');
const database  = require('../../utils/database');

module.exports = {
    name: 'owner',
    aliases: ['contact', 'creator', 'dev', 'ownerinfo'],
    description: 'Show bot owner / creator info card',
    category: 'owner',

    async execute({ sock, msg, from, reply }) {
        const ov       = database.getOwnerInfo ? database.getOwnerInfo() : {};
        const name     = ov.name    || config.owner?.name     || 'Pasqua';
        const age      = ov.age     || '18';
        const country  = ov.country || 'Nigeria 🇳🇬';
        const contact  = ov.contact || (config.owner?.telegram || '@Pasquaking');
        const bio      = ov.bio     || 'Builder of Sukuna MD · King of Curses 👹';
        const role     = ov.role    || 'Founder & Lead Developer';

        const caption =
`╔════════════════
║      👑  *OWNER INFO*  👑
╚════════════════
▸ *Name*    : ${name}
▸ *Age*     : ${age}
▸ *Country* : ${country}
▸ *Contact* : ${contact}
▸ *Role*    : ${role}
▸ *Bot*     : ${config.botName}
▸ *Bio*     : ${bio}
━━━━━━━━━━━━━━━━━━
⚡ *VERIFIED OWNER PROFILE* ⚡
━━━━━━━━━━━━━━━━━━
✦ Verified  : ✅ Yes
✦ Channel   : ${config.owner?.channel || '—'}
✦ GitHub    : ${config.owner?.github  || '—'}

> _Tap the contact to reach the creator._`;

        const imgPath = path.join(__dirname, '..', '..', 'assets', 'owner.jpg');

        try {
            if (fs.existsSync(imgPath)) {
                const buf = fs.readFileSync(imgPath);
                await sock.sendMessage(from, {
                    image:   buf,
                    caption,
                }, { quoted: msg });
                return;
            }
        } catch (e) {
            console.error('[owner] image send failed:', e.message);
        }

        // Fallback: plain text if image missing
        await reply(caption);
    }
};
