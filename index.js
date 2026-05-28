#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * ════════════════════════════════════════════════════════════════════
 *                       SUKUNA MD  v3  —  PANEL EDITION
 *                Single-file, paste-and-run deployment
 * ════════════════════════════════════════════════════════════════════
 *
 *  HOW TO DEPLOY (Pterodactyl / Heroku / VPS / any Node panel)
 *  -----------------------------------------------------------
 *   1. In your panel's file manager, create a new file named  index.js
 *   2. Paste THIS ENTIRE FILE into it.
 *   3. Edit the SETTINGS block right below this comment:
 *         SESSION_ID   = the session string from the pairing site
 *         OWNER_NUMBER = your WhatsApp number (country code, no +)
 *         PAIR_NUMBER  = number the bot will run on (usually same)
 *         PREFIX       = command prefix, e.g. "."
 *         BOT_NAME     = display name of the bot
 *   4. Save the file as index.js  and press START on the panel.
 *
 *  On first boot this file will:
 *     • download the rest of the bot from GitHub (no git needed)
 *     • install npm dependencies
 *     • restore your WhatsApp session from SESSION_ID
 *     • start the bot
 *
 *  Nothing else to copy.  No config.js, no .env, no extra commands.
 * ════════════════════════════════════════════════════════════════════
 */

// ╔══════════════════════════════════════════════════════════════════╗
// ║                          USER SETTINGS                           ║
// ║          Edit the values below.  That is all you need.           ║
// ╚══════════════════════════════════════════════════════════════════╝
const SETTINGS = {
    SESSION_ID:   "PASTE_YOUR_SESSION_ID_HERE",      // from your pairing site (e.g. SUKUNA~xxxx or a mega.nz link)
    OWNER_NUMBER: "2349127857212",                   // owner WhatsApp number, no +
    PAIR_NUMBER:  "2349127857212",                   // number the bot runs on, no +
    PREFIX:       ".",                               // command prefix
    BOT_NAME:     "SUKUNA MD",                       // shown in menus

    // Source repo the bot pulls itself from on first boot.
    // Leave as-is unless you forked the project.
    REPO:   "pasquawisdom2007-beep/SUKUNA_MD",
    BRANCH: "main"
};
// ╔══════════════════════════════════════════════════════════════════╗
// ║   Nothing below this line needs to be touched by normal users.   ║
// ╚══════════════════════════════════════════════════════════════════╝

'use strict';

const fs          = require('fs');
const path        = require('path');
const https       = require('https');
const zlib        = require('zlib');
const { spawnSync } = require('child_process');
const Module      = require('module');

const ROOT       = __dirname;
const MARKER     = path.join(ROOT, 'lib', 'sessionManager.js');     // exists ⇒ already extracted
const NODE_MOD   = path.join(ROOT, 'node_modules');

// ── tiny logger ───────────────────────────────────────────────────────────────
const log  = (tag, msg) => console.log(`[${tag}] ${msg}`);
const warn = (tag, msg) => console.warn(`[${tag}] ${msg}`);
const fail = (tag, msg) => console.error(`[${tag}] ${msg}`);

// ── 1. SELF-EXTRACT: download repo tarball from GitHub ────────────────────────
function downloadBuffer(url, redirects = 5) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'sukuna-bootstrap' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
                res.resume();
                return resolve(downloadBuffer(res.headers.location, redirects - 1));
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

// Minimal tar (ustar/posix) parser — enough for GitHub codeload tarballs.
function parseTar(buf, onEntry) {
    let off = 0;
    while (off + 512 <= buf.length) {
        const header = buf.slice(off, off + 512);
        // empty block = end
        if (header.every(b => b === 0)) break;

        const nameRaw = header.slice(0, 100).toString('utf8').replace(/\0.*$/, '');
        const prefix  = header.slice(345, 500).toString('utf8').replace(/\0.*$/, '');
        const sizeOct = header.slice(124, 136).toString('utf8').replace(/[\0 ]/g, '');
        const typeFlag = String.fromCharCode(header[156] || 0);
        const size = parseInt(sizeOct, 8) || 0;

        off += 512;
        const data = buf.slice(off, off + size);
        off += Math.ceil(size / 512) * 512;

        const fullName = prefix ? `${prefix}/${nameRaw}` : nameRaw;
        if (!fullName) continue;

        onEntry({ name: fullName, type: typeFlag, data });
    }
}

async function selfExtract() {
    if (fs.existsSync(MARKER)) return;

    const tarUrl = `https://codeload.github.com/${SETTINGS.REPO}/tar.gz/${SETTINGS.BRANCH}`;
    log('BOOT', `Downloading bot source from ${tarUrl} ...`);
    const gz = await downloadBuffer(tarUrl);
    const tar = zlib.gunzipSync(gz);
    log('BOOT', `Extracting ${(tar.length / 1024).toFixed(0)} KB ...`);

    let written = 0;
    parseTar(tar, ({ name, type, data }) => {
        // strip the leading "<repo>-<branch>/" component
        const rel = name.replace(/^[^/]+\//, '');
        if (!rel) return;

        // never overwrite the user's pasted index.js, and ignore the old config.js
        if (rel === 'index.js' || rel === 'config.js') return;

        const dest = path.join(ROOT, rel);
        if (type === '5' || rel.endsWith('/')) {
            fs.mkdirSync(dest, { recursive: true });
            return;
        }
        if (type !== '0' && type !== '' && type !== '\0') return; // regular files only

        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, data);
        written++;
    });

    log('BOOT', `Wrote ${written} files.`);
}

// ── 2. INSTALL DEPS ───────────────────────────────────────────────────────────
function installDeps() {
    if (fs.existsSync(NODE_MOD)) return;
    log('BOOT', 'Installing npm dependencies (first run only, may take a few minutes) ...');
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const r = spawnSync(npmCmd, ['install', '--omit=dev', '--no-audit', '--no-fund'], {
        cwd: ROOT,
        stdio: 'inherit',
        env: process.env
    });
    if (r.status !== 0) {
        fail('BOOT', 'npm install failed. Check the panel logs above.');
        process.exit(1);
    }
}

// ── 3. SYNTHESIZE config.js IN MEMORY ─────────────────────────────────────────
function injectConfig() {
    const cfg = {
        botName: SETTINGS.BOT_NAME,
        version: '3.0.0',
        prefix:  SETTINGS.PREFIX,

        assets: {
            menuVideo: './assets/menuvideo.mp4',
            menuThumb: './assets/menuthumb.jpg'
        },

        ownerNumber: String(SETTINGS.OWNER_NUMBER).replace(/[^0-9]/g, ''),
        pairNumber:  String(SETTINGS.PAIR_NUMBER ).replace(/[^0-9]/g, ''),

        owner: {
            name:    'PASQUA',
            number:  String(SETTINGS.OWNER_NUMBER).replace(/[^0-9]/g, ''),
            github:  'https://github.com/pasquawisdom2007-beep/Sukuna-MD-V3',
            channel: 'https://whatsapp.com/channel/0029VbCJho147XeEEuR1LA3s'
        },

        sessions: {
            folder: './sessions/',
            autoReconnect: true
        },

        groupDefaults: {
            antilink: false,
            antilinkAction: 'delete',
            antimention: false,
            antimentionMode: 'normal',
            antimentionAction: 'warn',
            antimentionMax: 5,
            welcome: false,
            welcomeMessage: '👋 Welcome @user to @group!',
            goodbye: false,
            goodbyeMessage: '👋 Goodbye @user!',
            mute: false
        },

        apiKeys: {
            openai:  process.env.OPENAI_API_KEY  || '',
            weather: process.env.WEATHER_API_KEY || ''
        },

        messages: {
            wait: '⏳ Processing...',
            success: '✅ Success!',
            error: '❌ Error occurred!',
            adminOnly: '🛡️ This command is only for admins!',
            groupOnly: '👥 This command can only be used in groups!',
            botAdminNeeded: '🤖 Bot needs to be admin to execute this command!'
        }
    };

    // Register a virtual ./config.js so every  require('../config')  in the
    // project resolves to this in-memory object — no config.js file needed.
    const virtualPath = path.join(ROOT, 'config.js');
    const m = new Module(virtualPath, module);
    m.filename = virtualPath;
    m.loaded   = true;
    m.exports  = cfg;
    require.cache[virtualPath] = m;

    return cfg;
}

// ── 4. RESTORE SESSION FROM SESSION_ID ────────────────────────────────────────
async function restoreSession(cfg) {
    const raw = String(SETTINGS.SESSION_ID || '').trim();
    if (!raw || raw === 'PASTE_YOUR_SESSION_ID_HERE') {
        warn('SESSION', 'No SESSION_ID set — will fall back to interactive pair-code flow.');
        return false;
    }

    const sessionDir = path.join(ROOT, 'sessions', cfg.pairNumber);
    const credsPath  = path.join(sessionDir, 'creds.json');
    if (fs.existsSync(credsPath)) {
        log('SESSION', `Existing creds.json found at ${credsPath} — skipping SESSION_ID restore.`);
        return true;
    }
    fs.mkdirSync(sessionDir, { recursive: true });

    // Strip a leading prefix like  "SUKUNA~"  or  "KORD~"
    const payload = raw.includes('~') ? raw.split('~').slice(1).join('~') : raw;

    // (a) mega.nz link
    if (/mega\.nz|mega\.co\.nz/i.test(payload) || /^[A-Za-z0-9_-]{6,}#[A-Za-z0-9_-]{20,}$/.test(payload)) {
        log('SESSION', 'Detected Mega session, downloading creds.json ...');
        let megajs;
        try { megajs = require('megajs'); }
        catch { fail('SESSION', 'megajs not installed — cannot download Mega session.'); return false; }

        const url = payload.startsWith('http') ? payload : `https://mega.nz/file/${payload}`;
        await new Promise((resolve, reject) => {
            const file = megajs.File.fromURL(url);
            file.download((err, data) => {
                if (err) return reject(err);
                fs.writeFileSync(credsPath, data);
                resolve();
            });
        });
        log('SESSION', `Wrote ${credsPath}`);
        return true;
    }

    // (b) base64-encoded creds.json
    try {
        const json = Buffer.from(payload, 'base64').toString('utf8');
        JSON.parse(json); // validate
        fs.writeFileSync(credsPath, json);
        log('SESSION', `Decoded base64 SESSION_ID and wrote ${credsPath}`);
        return true;
    } catch {
        fail('SESSION', 'SESSION_ID is not valid base64 or a Mega URL. Get a fresh one from your pairing site.');
        return false;
    }
}

// ── 5. LAUNCH THE BOT ─────────────────────────────────────────────────────────
async function launch(cfg) {
    let chalk;
    try { chalk = require('chalk'); }
    catch { chalk = new Proxy({}, { get: () => (s) => s }); }

    console.log(chalk.red ? chalk.red(`
╔════════════════════════════════════════════════════════════════╗
║                         ${cfg.botName.padEnd(16)}                        ║
║              Panel-Paired Multi-User WhatsApp Bot              ║
╚════════════════════════════════════════════════════════════════╝
`) : '');

    const commandLoader  = require('./utils/commandLoader');
    const sessionManager = require('./lib/sessionManager');

    log('SYSTEM', 'Loading commands ...');
    commandLoader.loadCommands();
    log('SYSTEM', 'Commands loaded.');

    log('SYSTEM', 'Restoring existing sessions ...');
    await sessionManager.loadExistingSessions();
    const active = (sessionManager.sessions && sessionManager.sessions.size) || 0;
    log('SYSTEM', `${active} session(s) restored.`);

    // If still no active session for this number, try pair-code flow
    const hasSession = sessionManager.sessions && sessionManager.sessions.has(cfg.pairNumber);
    if (!hasSession && cfg.pairNumber.length >= 8) {
        log('PAIR', `Requesting pairing code for ${cfg.pairNumber} ...`);
        const result = await sessionManager.createSession(cfg.pairNumber);
        if (result && result.code) {
            console.log(`
╔══════════════════════════════════════╗
║  PAIRING CODE: ${result.code}        
╚══════════════════════════════════════╝
Open WhatsApp → Linked Devices → Link with phone number → enter the code above.
`);
        } else if (result && !result.success) {
            fail('PAIR', result.error || 'Unknown pairing error');
        }
    }

    log('SYSTEM', `${cfg.botName} is running. Press Ctrl+C to stop.`);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
(async () => {
    try {
        await selfExtract();
        installDeps();
        const cfg = injectConfig();
        await restoreSession(cfg);
        await launch(cfg);
    } catch (err) {
        fail('FATAL', err && err.stack ? err.stack : String(err));
        process.exit(1);
    }
})();

process.on('uncaughtException',  (e) => fail('uncaughtException',  e && e.message));
process.on('unhandledRejection', (e) => fail('unhandledRejection', e && (e.message || e)));
process.on('SIGINT',  () => { log('SYSTEM', 'Shutting down...'); process.exit(0); });
process.on('SIGTERM', () => { log('SYSTEM', 'Shutting down...'); process.exit(0); });
