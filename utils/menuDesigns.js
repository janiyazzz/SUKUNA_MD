/**
 * Menu Design Library — Sukuna MD
 *
 * Exports:
 *   DESIGNS        : list of available design keys
 *   isValidDesign  : (key) => boolean
 *   buildCaption   : (designKey, ctx) => string
 *
 * ctx shape:
 *   { userTag, creator, mode, total, uptime, prefix, version,
 *     sortedCategories, byCategory, CATEGORY_LABELS, boldItalic }
 */

const DESIGNS = [
    'nor', 'neon', 'classy', 'cyber', 'royal', 'ghost', 'matrix', 'samurai', 'aurora', 'arcade',
    // ── 10 new peak designs ──
    'crimson', 'oracle', 'glitch', 'runic', 'obsidian',
    'vapor', 'mirage', 'eclipse', 'phantom', 'monolith',
    // ── Interactive design (renders quick-reply buttons via @crysnovax/baileys) ──
    'chroma',
    // ── Pasqua signature design ──
    'pasqua',
];

function isValidDesign(key) {
    return DESIGNS.includes(String(key || '').toLowerCase());
}

// ── Helpers ──────────────────────────────────────────────────────
function header(title, lines, openL, openR, sideL, closeL, closeR, boldItalic) {
    let out = `${openL} ◈ ${boldItalic(title)} ${openR}\n`;
    for (const l of lines) out += `${sideL} ${l}\n`;
    out += `${closeL}${closeR}\n`;
    return out;
}

function pairColumns(names, prefix = '▸') {
    const COL_W = 14;
    let out = '';
    for (let i = 0; i < names.length; i += 2) {
        const left  = `${prefix} ${names[i]}`.padEnd(COL_W, ' ');
        const right = names[i + 1] ? `${prefix} ${names[i + 1]}` : '';
        out += `${left}${right}\n`;
    }
    return out;
}

// ── Design: nor (original) ───────────────────────────────────────
function designNor(ctx) {
    const { userTag, creator, mode, total, uptime, prefix, version,
            sortedCategories, byCategory, CATEGORY_LABELS, boldItalic,
            date, time, status, platform } = ctx;
    let c = '';
    c += `╭─❒ ◈ ${boldItalic('SUKUNA MD')} ❒\n`;
    c += `│ ⛧ User    : ${userTag}\n`;
    c += `│ ⛧ Creator : ${creator}\n`;
    c += `│ ⛧ Mode    : ${mode}\n`;
    c += `│ ⛧ Plugins : ${total}\n`;
    c += `│ ⛧ Uptime  : ${uptime}\n`;
    c += `│ ⛧ Prefix  : ${prefix}\n`;
    c += `│ ⛧ Version : ${version}\n`;
    c += `│ ⛧ Date    : ${date}\n`;
    c += `│ ⛧ Time    : ${time}\n`;
    c += `│ ⛧ Status  : ${status}\n`;
    c += `│ ⛧ Platform: ${platform}\n`;
    c += `╰────────────⛧\n\n`;

    for (const cat of sortedCategories) {
        const names = byCategory[cat]; if (!names?.length) continue;
        const label = CATEGORY_LABELS[cat] || (cat[0].toUpperCase() + cat.slice(1));
        c += `╭─❒ ${boldItalic(label)} ❒\n`;
        const COL_W = 14;
        for (let i = 0; i < names.length; i += 2) {
            const L = `▸ ${names[i]}`.padEnd(COL_W, ' ');
            const R = names[i + 1] ? `▸ ${names[i + 1]}` : '';
            c += `│ ${L}${R}\n`;
        }
        c += `╰─⛧\n\n`;
    }
    c += `╭─❒ ${boldItalic('Total')} ❒\n│ ⛧ ${total} commands loaded\n╰─⛧\n`;
    c += `\n> ${boldItalic('Sukuna MD')} · King of Curses · by ${creator}`;
    return c;
}

// ── Design: neon ─────────────────────────────────────────────────
function designNeon(ctx) {
    const { userTag, creator, mode, total, uptime, prefix, version,
            sortedCategories, byCategory, CATEGORY_LABELS, boldItalic,
            date, time, status, platform } = ctx;
    let c = '';
    c += `▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰\n`;
    c += `      ✦ ${boldItalic('SUKUNA · NEON')} ✦\n`;
    c += `▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰\n`;
    c += `◈ User    » ${userTag}\n`;
    c += `◈ Creator » ${creator}\n`;
    c += `◈ Mode    » ${mode}\n`;
    c += `◈ Plugins » ${total}\n`;
    c += `◈ Uptime  » ${uptime}\n`;
    c += `◈ Prefix  » ${prefix}\n`;
    c += `◈ Version » ${version}\n`;
    c += `◈ Date    » ${date}\n`;
    c += `◈ Time    » ${time}\n`;
    c += `◈ Status  » ${status}\n`;
    c += `◈ Platform » ${platform}\n`;
    c += `▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱\n\n`;

    for (const cat of sortedCategories) {
        const names = byCategory[cat]; if (!names?.length) continue;
        const label = CATEGORY_LABELS[cat] || (cat[0].toUpperCase() + cat.slice(1));
        c += `❰ ✦ ${boldItalic(label.toUpperCase())} ✦ ❱\n`;
        c += pairColumns(names, '◇');
        c += `\n`;
    }
    c += `▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰\n`;
    c += `   ${total} neon commands online\n`;
    c += `▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰\n`;
    c += `\n> ${boldItalic('SUKUNA · NEON')} · powered by ${creator}`;
    return c;
}

// ── Design: classy ───────────────────────────────────────────────
function designClassy(ctx) {
    const { userTag, creator, mode, total, uptime, prefix, version,
            sortedCategories, byCategory, CATEGORY_LABELS, boldItalic,
            date, time, status, platform } = ctx;
    let c = '';
    c += `┏━━━━━━━━━━━━━━━━━━━━┓\n`;
    c += `   ${boldItalic('S U K U N A   M D')}\n`;
    c += `        — classy edition —\n`;
    c += `┗━━━━━━━━━━━━━━━━━━━━┛\n`;
    c += ` ❖ User     · ${userTag}\n`;
    c += ` ❖ Creator  · ${creator}\n`;
    c += ` ❖ Mode     · ${mode}\n`;
    c += ` ❖ Plugins  · ${total}\n`;
    c += ` ❖ Uptime   · ${uptime}\n`;
    c += ` ❖ Prefix   · ${prefix}\n`;
    c += ` ❖ Version  · ${version}\n`;
    c += ` ❖ Date     · ${date}\n`;
    c += ` ❖ Time     · ${time}\n`;
    c += ` ❖ Status   · ${status}\n`;
    c += ` ❖ Platform · ${platform}\n`;
    c += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (const cat of sortedCategories) {
        const names = byCategory[cat]; if (!names?.length) continue;
        const label = CATEGORY_LABELS[cat] || (cat[0].toUpperCase() + cat.slice(1));
        c += `❖ ${boldItalic(label)}\n`;
        c += `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n`;
        c += pairColumns(names, '·');
        c += `\n`;
    }
    c += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    c += `   ${total} commands · curated\n`;
    c += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    c += `\n> ${boldItalic('Sukuna MD')} — quietly powerful · by ${creator}`;
    return c;
}

// ── Design: cyber ────────────────────────────────────────────────
function designCyber(ctx) {
    const { userTag, creator, mode, total, uptime, prefix, version,
            sortedCategories, byCategory, CATEGORY_LABELS, boldItalic,
            date, time, status, platform } = ctx;
    let c = '';
    c += `╔═[ ${boldItalic('SUKUNA//CYBER')} ]═╗\n`;
    c += `║ > boot sequence ok\n`;
    c += `║ > user      :: ${userTag}\n`;
    c += `║ > creator   :: ${creator}\n`;
    c += `║ > mode      :: ${mode}\n`;
    c += `║ > plugins   :: ${total}\n`;
    c += `║ > uptime    :: ${uptime}\n`;
    c += `║ > prefix    :: ${prefix}\n`;
    c += `║ > version   :: ${version}\n`;
    c += `║ > date      :: ${date}\n`;
    c += `║ > time      :: ${time}\n`;
    c += `║ > status    :: ${status}\n`;
    c += `║ > platform  :: ${platform}\n`;
    c += `╚══════════════════════╝\n\n`;

    for (const cat of sortedCategories) {
        const names = byCategory[cat]; if (!names?.length) continue;
        const label = CATEGORY_LABELS[cat] || (cat[0].toUpperCase() + cat.slice(1));
        c += `> /${boldItalic(label.toLowerCase())}.exe\n`;
        c += `╔══════════════════════╗\n`;
        const COL_W = 14;
        for (let i = 0; i < names.length; i += 2) {
            const L = `» ${names[i]}`.padEnd(COL_W, ' ');
            const R = names[i + 1] ? `» ${names[i + 1]}` : '';
            c += `║ ${L}${R}\n`;
        }
        c += `╚══════════════════════╝\n\n`;
    }
    c += `> sys.commands = ${total}\n`;
    c += `> handshake :: complete\n`;
    c += `\n> ${boldItalic('SUKUNA//CYBER')} · root@${creator}`;
    return c;
}

// ── Design: royal ────────────────────────────────────────────────
function designRoyal(ctx) {
    const { userTag, creator, mode, total, uptime, prefix, version,
            sortedCategories, byCategory, CATEGORY_LABELS, boldItalic,
            date, time, status, platform } = ctx;
    let c = '';
    c += `『 ✦ ${boldItalic('SUKUNA · ROYAL COURT')} ✦ 』\n`;
    c += `❦ Subject  ➤ ${userTag}\n`;
    c += `❦ Sovereign ➤ ${creator}\n`;
    c += `❦ Court    ➤ ${mode}\n`;
    c += `❦ Decrees  ➤ ${total}\n`;
    c += `❦ Reign    ➤ ${uptime}\n`;
    c += `❦ Sigil    ➤ ${prefix}\n`;
    c += `❦ Era      ➤ ${version}\n`;
    c += `❦ Date     ➤ ${date}\n`;
    c += `❦ Time     ➤ ${time}\n`;
    c += `❦ Status   ➤ ${status}\n`;
    c += `❦ Platform ➤ ${platform}\n`;
    c += `『━━━━━━━━━━━━━━━━━━━━』\n\n`;

    for (const cat of sortedCategories) {
        const names = byCategory[cat]; if (!names?.length) continue;
        const label = CATEGORY_LABELS[cat] || (cat[0].toUpperCase() + cat.slice(1));
        c += `『 ❦ ${boldItalic(label)} ❦ 』\n`;
        c += pairColumns(names, '✦');
        c += `\n`;
    }
    c += `『 ❦ ${boldItalic('Crown Total')} ❦ 』\n`;
    c += `❦ ${total} royal decrees sealed\n`;
    c += `『━━━━━━━━━━━━━━━━━━━━』\n`;
    c += `\n> ${boldItalic('Sukuna MD')} · long live the king · ${creator}`;
    return c;
}

// ── Design: ghost ────────────────────────────────────────────────
function designGhost(ctx) {
    const { userTag, creator, mode, total, uptime, prefix, version,
            sortedCategories, byCategory, CATEGORY_LABELS, boldItalic,
            date, time, status, platform } = ctx;
    let c = '';
    c += `      ☽ ${boldItalic('SUKUNA · GHOST')} ☾\n`;
    c += `   ───────────────────\n`;
    c += `    ࿐ ${userTag}\n`;
    c += `    ࿐ creator · ${creator}\n`;
    c += `    ࿐ mode    · ${mode}\n`;
    c += `    ࿐ plugins · ${total}\n`;
    c += `    ࿐ uptime  · ${uptime}\n`;
    c += `    ࿐ prefix  · ${prefix}\n`;
    c += `    ࿐ version · ${version}\n`;
    c += `    ࿐ date    · ${date}\n`;
    c += `    ࿐ time    · ${time}\n`;
    c += `    ࿐ status  · ${status}\n`;
    c += `    ࿐ platform· ${platform}\n`;
    c += `   ───────────────────\n\n`;

    for (const cat of sortedCategories) {
        const names = byCategory[cat]; if (!names?.length) continue;
        const label = CATEGORY_LABELS[cat] || (cat[0].toUpperCase() + cat.slice(1));
        c += `   ☾ ${boldItalic(label)} ☽\n`;
        for (const n of names) c += `    ࿐ ${n}\n`;
        c += `\n`;
    }
    c += `   ───────────────────\n`;
    c += `   ${total} silent commands\n`;
    c += `   ───────────────────\n`;
    c += `\n> ${boldItalic('Sukuna · Ghost')} · drifts with ${creator}`;
    return c;
}

// ── Design: matrix ───────────────────────────────────────────────
// Navigation style: numbered command list with green rain divider.
function designMatrix(ctx) {
    const { userTag, creator, mode, total, uptime, prefix, version,
            sortedCategories, byCategory, CATEGORY_LABELS, boldItalic,
            date, time, status, platform } = ctx;
    const RAIN = '┃▒┃▒┃▒┃▒┃▒┃▒┃▒┃▒┃▒┃▒┃▒┃';
    let c = '';
    c += `╔══════════════════════╗\n`;
    c += `║  ${boldItalic('SUKUNA :: MATRIX')}   ║\n`;
    c += `╚══════════════════════╝\n`;
    c += `${RAIN}\n`;
    c += `01> user      :: ${userTag}\n`;
    c += `02> creator   :: ${creator}\n`;
    c += `03> mode      :: ${mode}\n`;
    c += `04> plugins   :: ${total}\n`;
    c += `05> uptime    :: ${uptime}\n`;
    c += `06> prefix    :: ${prefix}\n`;
    c += `07> version   :: ${version}\n`;
    c += `08> date      :: ${date}\n`;
    c += `09> time      :: ${time}\n`;
    c += `10> status    :: ${status}\n`;
    c += `11> platform  :: ${platform}\n`;
    c += `${RAIN}\n\n`;

    let idx = 1;
    for (const cat of sortedCategories) {
        const names = byCategory[cat]; if (!names?.length) continue;
        const label = CATEGORY_LABELS[cat] || (cat[0].toUpperCase() + cat.slice(1));
        c += `╔═[ ${boldItalic(label.toUpperCase())} ]═╗\n`;
        for (const n of names) {
            const num = String(idx++).padStart(2, '0');
            c += `║ [${num}] ${n}\n`;
        }
        c += `╚══════════════════════╝\n\n`;
    }
    c += `${RAIN}\n`;
    c += `   ${total} processes alive\n`;
    c += `${RAIN}\n`;
    c += `\n> ${boldItalic('SUKUNA :: MATRIX')} · trace @ ${creator}`;
    return c;
}

// ── Design: samurai ──────────────────────────────────────────────
// Navigation style: vertical-bar (丨) command flow with kanji rule.
function designSamurai(ctx) {
    const { userTag, creator, mode, total, uptime, prefix, version,
            sortedCategories, byCategory, CATEGORY_LABELS, boldItalic,
            date, time, status, platform } = ctx;
    const RULE = '― ― ― 道 ― ― ―';
    let c = '';
    c += `「 ✦ ${boldItalic('SUKUNA · 侍 SAMURAI')} ✦ 」\n`;
    c += `${RULE}\n`;
    c += ` 刀 user     · ${userTag}\n`;
    c += ` 刀 creator  · ${creator}\n`;
    c += ` 刀 mode     · ${mode}\n`;
    c += ` 刀 plugins  · ${total}\n`;
    c += ` 刀 uptime   · ${uptime}\n`;
    c += ` 刀 prefix   · ${prefix}\n`;
    c += ` 刀 version  · ${version}\n`;
    c += ` 刀 date     · ${date}\n`;
    c += ` 刀 time     · ${time}\n`;
    c += ` 刀 status   · ${status}\n`;
    c += ` 刀 platform · ${platform}\n`;
    c += `${RULE}\n\n`;

    for (const cat of sortedCategories) {
        const names = byCategory[cat]; if (!names?.length) continue;
        const label = CATEGORY_LABELS[cat] || (cat[0].toUpperCase() + cat.slice(1));
        c += `「 ${boldItalic(label)} 」\n`;
        // vertical-bar flow: cmd 丨 cmd 丨 cmd, wrap at 3
        let line = '';
        names.forEach((n, i) => {
            line += (line ? ' 丨 ' : ' 丨 ') + n;
            if ((i + 1) % 3 === 0 || i === names.length - 1) {
                c += `${line} 丨\n`;
                line = '';
            }
        });
        c += `${RULE}\n\n`;
    }
    c += `「 ${boldItalic('刀 Total')} 」\n`;
    c += `  ${total} blades drawn\n`;
    c += `${RULE}\n`;
    c += `\n> ${boldItalic('Sukuna · Samurai')} · 切 by ${creator}`;
    return c;
}

// ── Design: aurora ───────────────────────────────────────────────
// Navigation style: tab-bar across the top, then per-section cards.
function designAurora(ctx) {
    const { userTag, creator, mode, total, uptime, prefix, version,
            sortedCategories, byCategory, CATEGORY_LABELS, boldItalic,
            date, time, status, platform } = ctx;
    let c = '';
    c += `❀━━━━━━━━━━━━━━━━━━━❀\n`;
    c += `   ${boldItalic('SUKUNA · AURORA')}\n`;
    c += `❀━━━━━━━━━━━━━━━━━━━❀\n`;
    c += `❀ user     ⤞ ${userTag}\n`;
    c += `❀ creator  ⤞ ${creator}\n`;
    c += `❀ mode     ⤞ ${mode}\n`;
    c += `❀ plugins  ⤞ ${total}\n`;
    c += `❀ uptime   ⤞ ${uptime}\n`;
    c += `❀ prefix   ⤞ ${prefix}\n`;
    c += `❀ version  ⤞ ${version}\n`;
    c += `❀ date     ⤞ ${date}\n`;
    c += `❀ time     ⤞ ${time}\n`;
    c += `❀ status   ⤞ ${status}\n`;
    c += `❀ platform ⤞ ${platform}\n`;
    c += `❀━━━━━━━━━━━━━━━━━━━❀\n\n`;

    // Tab-bar: list every category as a tab across the top
    const tabs = sortedCategories
        .filter(cat => byCategory[cat]?.length)
        .map(cat => (CATEGORY_LABELS[cat] || cat).toLowerCase())
        .join(' ▸ ');
    c += `┃ ▸ ${tabs} ▸ ┃\n\n`;

    for (const cat of sortedCategories) {
        const names = byCategory[cat]; if (!names?.length) continue;
        const label = CATEGORY_LABELS[cat] || (cat[0].toUpperCase() + cat.slice(1));
        c += `╭❀ ${boldItalic(label)} ❀\n`;
        c += pairColumns(names, '✿').split('\n').map(l => l ? `│ ${l}` : '').join('\n');
        c += `╰❀━━━━━━━━━━━━━━━━━❀\n\n`;
    }
    c += `❀━━━━━━━━━━━━━━━━━━━❀\n`;
    c += `   ${total} blooms in season\n`;
    c += `❀━━━━━━━━━━━━━━━━━━━❀\n`;
    c += `\n> ${boldItalic('Sukuna · Aurora')} · drifts with ${creator}`;
    return c;
}

// ── Design: arcade ───────────────────────────────────────────────
// Navigation style: paginated screens with joystick-key listing.
function designArcade(ctx) {
    const { userTag, creator, mode, total, uptime, prefix, version,
            sortedCategories, byCategory, CATEGORY_LABELS, boldItalic,
            date, time, status, platform } = ctx;
    const sections = sortedCategories.filter(cat => byCategory[cat]?.length);
    const totalPages = Math.max(1, sections.length);
    let c = '';
    c += `▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n`;
    c += `▓  ${boldItalic('SUKUNA · ARCADE')}  ▓\n`;
    c += `▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n`;
    c += `『 PLAYER 1 — INSERT COIN 』\n`;
    c += ` ► P1       · ${userTag}\n`;
    c += ` ► CREATOR  · ${creator}\n`;
    c += ` ► MODE     · ${mode}\n`;
    c += ` ► PLUGINS  · ${total}\n`;
    c += ` ► UPTIME   · ${uptime}\n`;
    c += ` ► PREFIX   · ${prefix}\n`;
    c += ` ► VERSION  · ${version}\n`;
    c += ` ► DATE     · ${date}\n`;
    c += ` ► TIME     · ${time}\n`;
    c += ` ► STATUS   · ${status}\n`;
    c += ` ► PLATFORM · ${platform}\n`;
    c += `▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n\n`;

    sections.forEach((cat, pageIdx) => {
        const names = byCategory[cat];
        const label = CATEGORY_LABELS[cat] || (cat[0].toUpperCase() + cat.slice(1));
        c += `『 PAGE ${pageIdx + 1}/${totalPages} — ${boldItalic(label.toUpperCase())} 』\n`;
        c += `▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n`;
        // Joystick-key listing: A · cmd, B · cmd, X · cmd, Y · cmd, L · cmd, R · cmd, then START/SEL
        const keys = ['A', 'B', 'X', 'Y', 'L', 'R', '↑', '↓', '←', '→', 'ST', 'SE'];
        names.forEach((n, i) => {
            const k = keys[i % keys.length];
            c += ` ► ${k.padEnd(2, ' ')} · ${n}\n`;
        });
        c += `▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n`;
        c += pageIdx < sections.length - 1 ? `   [ PRESS START → ]\n\n` : `\n`;
    });

    c += `『 HI-SCORE: ${total} CMDS 』\n`;
    c += `▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n`;
    c += `\n> ${boldItalic('SUKUNA · ARCADE')} · 1cc by ${creator}`;
    return c;
}

// ═══════════════════════════════════════════════════════════════════
// 10 NEW PEAK DESIGNS
// Each follows: designX(ctx) → string. Uses ctx.{sortedCategories,
// byCategory, CATEGORY_LABELS, boldItalic, ...metadata}.
// ═══════════════════════════════════════════════════════════════════

function _meta(ctx) {
    return [
        ` • USER     · ${ctx.userTag}`,
        ` • CREATOR  · ${ctx.creator}`,
        ` • MODE     · ${ctx.mode}`,
        ` • PLUGINS  · ${ctx.total}`,
        ` • UPTIME   · ${ctx.uptime}`,
        ` • PREFIX   · ${ctx.prefix}`,
        ` • VERSION  · ${ctx.version}`,
        ` • DATE     · ${ctx.date}`,
        ` • TIME     · ${ctx.time}`,
        ` • STATUS   · ${ctx.status}`,
        ` • PLATFORM · ${ctx.platform}`,
    ].join('\n');
}

// 1. crimson — bloody scroll
function designCrimson(ctx) {
    const { sortedCategories, byCategory, CATEGORY_LABELS, boldItalic } = ctx;
    let c = '';
    c += `🩸━━━━━━━━━━━━━━━━━━━━━🩸\n`;
    c += `      ${boldItalic('SUKUNA · CRIMSON')}\n`;
    c += `🩸━━━━━━━━━━━━━━━━━━━━━🩸\n`;
    c += _meta(ctx) + '\n';
    c += `🩸━━━━━━━━━━━━━━━━━━━━━🩸\n\n`;
    sortedCategories.forEach(cat => {
        if (!byCategory[cat]?.length) return;
        const label = CATEGORY_LABELS[cat] || cat.toUpperCase();
        c += `╳ ${boldItalic(label)} ╳\n`;
        byCategory[cat].forEach(n => c += ` ⛧ ${n}\n`);
        c += `\n`;
    });
    c += `🩸 ${boldItalic('Honor in blood')} 🩸`;
    return c;
}

// 2. oracle — mystic prophecy
function designOracle(ctx) {
    const { sortedCategories, byCategory, CATEGORY_LABELS, boldItalic } = ctx;
    let c = '';
    c += `✦ ─── ${boldItalic('THE ORACLE SPEAKS')} ─── ✦\n`;
    c += _meta(ctx) + '\n';
    c += `✦ ─────────────────────── ✦\n\n`;
    sortedCategories.forEach(cat => {
        if (!byCategory[cat]?.length) return;
        const label = CATEGORY_LABELS[cat] || cat.toUpperCase();
        c += `☽ ${boldItalic(label)} ☾\n`;
        byCategory[cat].forEach(n => c += `  ✧ ${n}\n`);
        c += `\n`;
    });
    c += `✦ ${boldItalic('— the fates have spoken —')} ✦`;
    return c;
}

// 3. glitch — corrupted terminal
function designGlitch(ctx) {
    const { sortedCategories, byCategory, CATEGORY_LABELS, boldItalic } = ctx;
    let c = '';
    c += `▒▓█ ${boldItalic('S/U/K/U/N/A · GLITCH')} █▓▒\n`;
    c += `>>> SYS.LOAD :: OK\n`;
    c += _meta(ctx) + '\n';
    c += `>>> EOF -----------------\n\n`;
    sortedCategories.forEach(cat => {
        if (!byCategory[cat]?.length) return;
        const label = CATEGORY_LABELS[cat] || cat.toUpperCase();
        c += `╣ ${boldItalic('▓ ' + label + ' ▓')} ╠\n`;
        byCategory[cat].forEach(n => c += ` >_ ${n}\n`);
        c += `\n`;
    });
    c += `▒▓ ${boldItalic('END_OF_TRANSMISSION')} ▓▒`;
    return c;
}

// 4. runic — nordic stone
function designRunic(ctx) {
    const { sortedCategories, byCategory, CATEGORY_LABELS, boldItalic } = ctx;
    let c = '';
    c += `ᚱ═══════════════════════ᚱ\n`;
    c += `     ${boldItalic('SUKUNA · RUNIC')}\n`;
    c += `ᚱ═══════════════════════ᚱ\n`;
    c += _meta(ctx) + '\n';
    c += `ᚱ═══════════════════════ᚱ\n\n`;
    sortedCategories.forEach(cat => {
        if (!byCategory[cat]?.length) return;
        const label = CATEGORY_LABELS[cat] || cat.toUpperCase();
        c += `ᛟ ${boldItalic(label)} ᛟ\n`;
        byCategory[cat].forEach(n => c += ` ᚦ ${n}\n`);
        c += `\n`;
    });
    c += `ᚱ ${boldItalic('— carved in stone —')} ᚱ`;
    return c;
}

// 5. obsidian — pure black slab
function designObsidian(ctx) {
    const { sortedCategories, byCategory, CATEGORY_LABELS, boldItalic } = ctx;
    let c = '';
    c += `■ ■ ■ ${boldItalic('OBSIDIAN')} ■ ■ ■\n`;
    c += _meta(ctx) + '\n';
    c += `■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■\n\n`;
    sortedCategories.forEach(cat => {
        if (!byCategory[cat]?.length) return;
        const label = CATEGORY_LABELS[cat] || cat.toUpperCase();
        c += `▪ ${boldItalic(label)}\n`;
        byCategory[cat].forEach(n => c += `   ▫ ${n}\n`);
        c += `\n`;
    });
    c += `■ ${boldItalic('SUKUNA · OBSIDIAN')} ■`;
    return c;
}

// 6. vapor — synthwave dream
function designVapor(ctx) {
    const { sortedCategories, byCategory, CATEGORY_LABELS, boldItalic } = ctx;
    let c = '';
    c += `░▒▓█ ${boldItalic('Ｓ Ｕ Ｋ Ｕ Ｎ Ａ ' + '/ V A P O R')} █▓▒░\n`;
    c += _meta(ctx) + '\n';
    c += `░▒▓██████████████████▓▒░\n\n`;
    sortedCategories.forEach(cat => {
        if (!byCategory[cat]?.length) return;
        const label = CATEGORY_LABELS[cat] || cat.toUpperCase();
        c += `░▒ ${boldItalic(label)} ▒░\n`;
        byCategory[cat].forEach(n => c += ` ◇ ${n}\n`);
        c += `\n`;
    });
    c += `░ ${boldItalic('— 1 9 8 9 / e t e r n a l —')} ░`;
    return c;
}

// 7. mirage — desert shimmer
function designMirage(ctx) {
    const { sortedCategories, byCategory, CATEGORY_LABELS, boldItalic } = ctx;
    let c = '';
    c += `〰〰〰 ${boldItalic('SUKUNA · MIRAGE')} 〰〰〰\n`;
    c += _meta(ctx) + '\n';
    c += `〰〰〰〰〰〰〰〰〰〰〰\n\n`;
    sortedCategories.forEach(cat => {
        if (!byCategory[cat]?.length) return;
        const label = CATEGORY_LABELS[cat] || cat.toUpperCase();
        c += `❍ ${boldItalic(label)} ❍\n`;
        byCategory[cat].forEach(n => c += ` ◌ ${n}\n`);
        c += `\n`;
    });
    c += `〰 ${boldItalic('— shifting sands —')} 〰`;
    return c;
}

// 8. eclipse — solar dark
function designEclipse(ctx) {
    const { sortedCategories, byCategory, CATEGORY_LABELS, boldItalic } = ctx;
    let c = '';
    c += `☾━━━━━━ ${boldItalic('ECLIPSE')} ━━━━━━☽\n`;
    c += _meta(ctx) + '\n';
    c += `☾━━━━━━━━━━━━━━━━━━━━━━☽\n\n`;
    sortedCategories.forEach(cat => {
        if (!byCategory[cat]?.length) return;
        const label = CATEGORY_LABELS[cat] || cat.toUpperCase();
        c += `◐ ${boldItalic(label)} ◑\n`;
        byCategory[cat].forEach(n => c += ` ● ${n}\n`);
        c += `\n`;
    });
    c += `☾ ${boldItalic('— the sun is consumed —')} ☽`;
    return c;
}

// 9. phantom — ghost ink
function designPhantom(ctx) {
    const { sortedCategories, byCategory, CATEGORY_LABELS, boldItalic } = ctx;
    let c = '';
    c += `╔═❀ ${boldItalic('SUKUNA · PHANTOM')} ❀═╗\n`;
    c += _meta(ctx) + '\n';
    c += `╚══════════════════════╝\n\n`;
    sortedCategories.forEach(cat => {
        if (!byCategory[cat]?.length) return;
        const label = CATEGORY_LABELS[cat] || cat.toUpperCase();
        c += `┏━ ${boldItalic(label)}\n`;
        byCategory[cat].forEach(n => c += `┃  ⌬ ${n}\n`);
        c += `┗━━━━━━━━━━━\n\n`;
    });
    c += `❀ ${boldItalic('— unseen, unheard —')} ❀`;
    return c;
}

// 10. monolith — towering minimal
function designMonolith(ctx) {
    const { sortedCategories, byCategory, CATEGORY_LABELS, boldItalic } = ctx;
    let c = '';
    c += `█\n█  ${boldItalic('SUKUNA · MONOLITH')}\n█\n`;
    _meta(ctx).split('\n').forEach(l => c += `█${l}\n`);
    c += `█\n`;
    sortedCategories.forEach(cat => {
        if (!byCategory[cat]?.length) return;
        const label = CATEGORY_LABELS[cat] || cat.toUpperCase();
        c += `█\n█  ${boldItalic(label)}\n█\n`;
        byCategory[cat].forEach(n => c += `█   · ${n}\n`);
    });
    c += `█\n█  ${boldItalic('— immovable —')}\n█`;
    return c;
}


// ── Design: chroma (peak interactive caption) ────────────────────
function designChroma(ctx) {
    const { userTag, creator, mode, total, uptime, prefix, version,
            sortedCategories, byCategory, CATEGORY_LABELS, boldItalic,
            date, time, status, platform } = ctx;

    const bi = boldItalic;
    let out = '';
    out += '╔══════════════════════════════╗\n';
    out += `║  ⛧  ${bi('C H R O M A')}  ·  ${bi('S U K U N A   M D')}  ⛧\n`;
    out += '╚══════════════════════════════╝\n';
    out += `┃ ◆ User      › ${userTag}\n`;
    out += `┃ ◆ Creator   › ${creator}\n`;
    out += `┃ ◆ Mode      › ${mode}\n`;
    out += `┃ ◆ Prefix    › ${prefix}\n`;
    out += `┃ ◆ Commands  › ${total}\n`;
    out += `┃ ◆ Uptime    › ${uptime}\n`;
    out += `┃ ◆ Version   › ${version}\n`;
    out += `┃ ◆ Status    › ${status}\n`;
    out += `┃ ◆ Platform  › ${platform}\n`;
    out += `┃ ◆ Date      › ${date}  ·  ${time}\n`;
    out += '╰──────────────────────────────╯\n\n';

    for (const cat of sortedCategories) {
        const label = CATEGORY_LABELS[cat] || cat;
        const names = byCategory[cat] || [];
        out += `╭─〔 ✦ ${bi(label)} ✦ 〕\n`;
        out += pairColumns(names, '✧');
        out += `╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n\n`;
    }

    out += '╭━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n';
    out += `┃ ↳ Tap a button below to run a\n`;
    out += `┃   command instantly.\n`;
    out += '╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n';
    out += `       ⛧  ${bi('Powered by Pasqua Tech')}  ⛧`;
    return out;
}

// ── Design: pasqua — PASQUA TECH signature style ──────────────────
// Inspired by the ⌘ ══〔 〕══ ⌘ ZEE-style aesthetic with ⿻ separators,
// 𒆜 category headers, and ❏◦ ➫ command listings.
function designPasqua(ctx) {
    const { userTag, creator, mode, total, uptime, prefix, version,
            sortedCategories, byCategory, CATEGORY_LABELS, boldItalic,
            date, time, status, platform } = ctx;

    const bi = boldItalic;
    const SEP = '⿻ ⿻ ⿻ ⿻ ⿻ ⿻ ⿻ ⿻ ⿻ ⿻';
    let c = '';

    // ── Header ──
    c += `⌘ ══〔 ${bi('SUKUNA MD')} 〕══ ⌘\n`;
    c += `${SEP}\n`;
    c += `𒆜 ✦ ${bi('Hello,')} ${userTag}\n`;
    c += `❏◦ Prefix   ·  ⇆ [ ${prefix} ]\n`;
    c += `❏◦ Cmds     ·  ⇆ ${total} commands\n`;
    c += `❏◦ Uptime   ·  ⇆ ${uptime}\n`;
    c += `❏◦ Time     ·  ⇆ ${time}\n`;
    c += `❏◦ Date     ·  ⇆ ${date}\n`;
    c += `❏◦ Mode     ·  ⇆ ${mode}\n`;
    c += `❏◦ Version  ·  ⇆ ${version}\n`;
    c += `❏◦ Status   ·  ⇆ ${status}\n`;
    c += `❏◦ Platform ·  ⇆ ${platform}\n`;
    c += `${SEP}\n\n`;

    // ── Category sections ──
    for (const cat of sortedCategories) {
        const names = byCategory[cat]; if (!names?.length) continue;
        const label = CATEGORY_LABELS[cat] || (cat[0].toUpperCase() + cat.slice(1));
        c += `𒆜 ◈ ${bi(label.toUpperCase())} ◈\n`;
        for (const n of names) c += `❏◦ ➫ .${n}\n`;
        c += `\n`;
    }

    // ── Footer ──
    c += `${SEP}\n`;
    c += `❏◦ Total ·  ⇆ ${total} commands loaded\n`;
    c += `${SEP}\n`;
    c += `⌘ ══〔 ⛧ ${bi('PASQUA TECH')} 〕══ ⌘`;
    return c;
}

const BUILDERS = {
    nor: designNor,
    neon: designNeon,
    classy: designClassy,
    cyber: designCyber,
    royal: designRoyal,
    ghost: designGhost,
    matrix: designMatrix,
    samurai: designSamurai,
    aurora: designAurora,
    arcade: designArcade,
    // ── New peak designs ──
    crimson:  designCrimson,
    oracle:   designOracle,
    glitch:   designGlitch,
    runic:    designRunic,
    obsidian: designObsidian,
    vapor:    designVapor,
    mirage:   designMirage,
    eclipse:  designEclipse,
    phantom:  designPhantom,
    monolith: designMonolith,
    // Chroma renders interactive buttons in commands/admin/menu.js. The
    // caption text falls back to the default `nor` design.
    chroma:   designChroma,
    // ── Pasqua signature design ──
    pasqua:   designPasqua,
};

function buildCaption(designKey, ctx) {
    const key = String(designKey || 'nor').toLowerCase();
    const fn = BUILDERS[key] || BUILDERS.nor;
    return fn(ctx);
}

module.exports = { DESIGNS, isValidDesign, buildCaption };
