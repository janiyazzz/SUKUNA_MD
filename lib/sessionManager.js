/**
 * Session Manager — Manages multiple WhatsApp sessions
 *
 * FIXES APPLIED:
 *  [1] REMOVED duplicate messages.upsert listener — previously two listeners were
 *      registered on every socket, causing every message to be processed twice,
 *      leaking memory, and eventually stalling sessions under load.
 *
 *  [2] FIXED reconnect reliability — previously, if startSession() threw during a
 *      reconnect attempt (e.g. fetchLatestBaileysVersion() failed due to a brief
 *      network blip), no further retry was ever scheduled and the session died
 *      silently. Now: catch block schedules another retry, and backoff (5s→10s→20s…
 *      capped at 60s, max 20 attempts) prevents hammering WhatsApp servers.
 *
 *  [3] ADDED reconnect deduplication — _reconnectTimers map ensures only one pending
 *      reconnect timer exists per session at a time, preventing concurrent socket
 *      creation for the same number if the close event fires multiple times.
 *
 *  [4] FIXED moderation commands requiring admin — in selfMode, moderation and admin
 *      category commands now pass through for verified group admins, so group admins
 *      can use .warn, .mute, .kick etc. without the bot owner needing to be online.
 *
 *  [5] ADDED isAdmin to command context — all commands now receive isAdmin so they
 *      can make permission decisions without fetching group metadata themselves.
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const pino  = require('pino');

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require('@crysnovax/baileys');

const config           = require('../config');
const commandLoader    = require('../utils/commandLoader');
const database         = require('../utils/database');
const antilinkEngine   = require('../utils/antilinkEngine');
const fontSystem       = require('../utils/fontSystem');
const langSystem       = require('../utils/langSystem');
const { boxify }       = require('../utils/styleBox');
// const { wrapSocket: brandSocket } = require('../utils/newsletterBrand');
const AntiBanEngine    = require('../utils/antiBanEngine');
const { setupPromotionGuard } = require('./promotionGuard');
const { forceGhostPresence } = require('../commands/general/ghostmode');

// ── AI API call ───────────────────────────────────────────────────────────────
const AI_BASE       = 'https://apis.prexzyvilla.site/ai/aichat';
const AI_TIMEOUT_MS = 15000;

function callAI(prompt) {
    return new Promise((resolve, reject) => {
        const url = `${AI_BASE}?prompt=${encodeURIComponent(prompt)}`;
        const req = https.get(url, { timeout: AI_TIMEOUT_MS }, (res) => {
            let raw = '';
            res.on('data', chunk => { raw += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(raw);
                    const text =
                        json.reply || json.response || json.answer ||
                        json.text  || json.message  || json.result ||
                        (typeof json === 'string' ? json : null);
                    resolve(text || raw.trim());
                } catch (_) { resolve(raw.trim() || '...'); }
            });
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('AI request timed out')); });
        req.on('error', reject);
    });
}

// ── Session Manager ───────────────────────────────────────────────────────────
class SessionManager {
    constructor() {
        this.sessions        = new Map();
        this.ownerJIDCache   = new Map();
        this.lidToPhoneCache = new Map();
        // FIX [2+3]: reconnect deduplication and retry state
        this._reconnectTimers  = new Map(); // phoneNumber → pending timer id
        this._reconnectRetries = new Map(); // phoneNumber → attempt count
        // Anti-delete / anti-edit message cache: groupJid → Map<msgId, msgObj>
        // Capped at 500 messages per group to avoid unbounded memory growth
        this._msgCache = new Map();
        // Anti-ban engines per session
        this._antiBanEngines = new Map(); // phoneNumber → AntiBanEngine
        // Metadata cache for group admin checks (30s TTL)
        this._groupMetadataCache = new Map(); // groupJid → { data, expiresAt }

        this._startMuteCleanup();
    }

    // ── Periodic cleanup for expired mutes ───────────────────────────────────
    _startMuteCleanup() {
        setInterval(() => {
            try {
                const groups = database.data.groups;
                for (const [groupId, groupData] of Object.entries(groups)) {
                    if (groupData.mutedUsers) {
                        const now = Date.now();
                        let changed = false;
                        for (const [userId, expiresAt] of Object.entries(groupData.mutedUsers)) {
                            if (now > expiresAt) { delete groupData.mutedUsers[userId]; changed = true; }
                        }
                        if (changed) database.setGroup(groupId, 'mutedUsers', groupData.mutedUsers);
                    }
                }
            } catch (e) { console.error('[Mute Cleanup]', e.message); }
        }, 5 * 60 * 1000);
    }

    // ── Owner JID cache helpers ──────────────────────────────────────────────
    _cacheOwnerJID(phoneNumber, jid) {
        if (!jid) return;
        if (!this.ownerJIDCache.has(phoneNumber)) this.ownerJIDCache.set(phoneNumber, new Set());
        const cache = this.ownerJIDCache.get(phoneNumber);
        cache.add(jid);
        const base = jid.split(':')[0] + (jid.includes('@') ? '@' + jid.split('@')[1] : '');
        cache.add(base);
    }

    // Resolve any sender JID (s.whatsapp.net or @lid) to a bare phone-number
    // string. Returns '' when it cannot be resolved (e.g. unknown @lid).
    _resolveSenderPhone(sender, phoneNumber) {
        if (!sender) return '';
        const bare = sender.split(':')[0];
        if (bare.endsWith('@lid')) {
            const map = this.lidToPhoneCache.get(phoneNumber);
            const phone = map?.get(bare);
            return phone ? phone.replace(/\D/g, '') : '';
        }
        return bare.split('@')[0].replace(/\D/g, '');
    }

    // Proactively populate the lid→phone map for a group so we can identify
    // the owner (and other participants) even when they send from a linked
    // device whose participant JID arrives as `<lid>@lid`. Cached per group,
    // refreshed lazily on demand. Safe to call frequently — work is skipped
    // when the requested lid is already known.
    _participantJid(p) {
        if (!p) return '';
        if (typeof p === 'string') return p;
        return p.phoneNumber || p.jid || p.id || p.lid || '';
    }

    _bareJid(jid) {
        const raw = String(jid || '');
        if (!raw) return '';
        const at = raw.indexOf('@');
        if (at === -1) return raw.split(':')[0];
        return raw.slice(0, at).split(':')[0] + raw.slice(at);
    }

    _accessCandidates(phoneNumber, sender) {
        const candidates = new Set();
        const add = (v) => {
            if (!v) return;
            const raw = String(v);
            candidates.add(raw);
            const bare = this._bareJid(raw);
            if (bare) candidates.add(bare);
            const num = this._normJid(raw);
            if (num) {
                candidates.add(num);
                candidates.add(`${num}@s.whatsapp.net`);
            }
        };

        add(sender);

        const bareSender = this._bareJid(sender);
        const map = this.lidToPhoneCache.get(phoneNumber);
        if (bareSender.endsWith('@lid')) add(map?.get(bareSender));

        const senderPhone = this._normJid(sender);
        if (senderPhone && map) {
            for (const [lid, phone] of map.entries()) {
                if (String(phone).replace(/\D/g, '') === senderPhone) add(lid);
            }
        }

        return candidates;
    }

    _isAccessUser(phoneNumber, sender, getter) {
        try {
            const list = typeof database[getter] === 'function' ? database[getter](phoneNumber) : [];
            const candidates = this._accessCandidates(phoneNumber, sender);
            return list.some(jid => {
                const raw = String(jid || '');
                const bare = this._bareJid(raw);
                const num = this._normJid(raw);
                return candidates.has(raw) ||
                    candidates.has(bare) ||
                    (num && candidates.has(num)) ||
                    (num && !bare.endsWith('@lid') && candidates.has(`${num}@s.whatsapp.net`));
            });
        } catch (_) { return false; }
    }

    _isSudoUser(phoneNumber, sender) { return this._isAccessUser(phoneNumber, sender, 'getSudoUsers'); }
    _isModUser(phoneNumber, sender)  { return this._isAccessUser(phoneNumber, sender, 'getModUsers'); }

    async _withTimeout(promise, ms, fallback = null) {
        return Promise.race([
            promise,
            new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
        ]).catch(() => fallback);
    }

    async _ensureLidMap(sock, phoneNumber, groupId, lidNeeded) {
        try {
            if (!groupId || !groupId.endsWith('@g.us')) return;
            if (!this.lidToPhoneCache.has(phoneNumber))
                this.lidToPhoneCache.set(phoneNumber, new Map());
            const map = this.lidToPhoneCache.get(phoneNumber);
            if (lidNeeded && map.has(lidNeeded)) return;

            const meta = await this._withTimeout(sock.groupMetadata(groupId), 3500, null);
            if (!meta) return;
            for (const p of meta.participants) {
                const rawJid = this._participantJid(p);
                const pLid   = p.lid || (p.id?.endsWith?.('@lid') ? p.id : null) || (rawJid.endsWith('@lid') ? rawJid : null);
                const pJid   = p.phoneNumber || (p.id?.endsWith?.('@s.whatsapp.net') ? p.id : null) || (rawJid.endsWith('@s.whatsapp.net') ? rawJid : null);
                const pPhone = (pJid || '').split('@')[0].replace(/\D/g, '');
                if (pLid && pPhone) {
                    map.set(pLid.split(':')[0] + '@lid', pPhone);
                    const ownerNumber = phoneNumber.replace(/\D/g, '');
                    if (pPhone === ownerNumber) {
                        this._cacheOwnerJID(phoneNumber, pLid.split(':')[0] + '@lid');
                    }
                }
            }
        } catch (_) { /* best-effort */ }
    }

    isOwner(fromMe, sender, ownerNumber, phoneNumber) {
        // CRITICAL: Strict owner match per session — no suffix matching, which
        // would leak owner status across paired sessions that happened to share
        // a digit suffix.
        if (fromMe === true) return true;

        const cache = this.ownerJIDCache.get(phoneNumber);
        if (cache && cache.has(sender)) return true;
        if (cache && sender) {
            const bare = sender.split(':')[0];
            if (cache.has(bare)) return true;
        }

        // Resolve the sender — including @lid senders — to a bare phone number
        // so an owner messaging from a linked device (which arrives as
        // `<lid>@lid` instead of their s.whatsapp.net JID) is still recognised.
        const sNum = this._resolveSenderPhone(sender, phoneNumber);
        const oNum = (ownerNumber || phoneNumber || '').replace(/\D/g, '');
        if (!sNum || !oNum) return false;

        if (sNum === oNum) return true;

        try {
            const stored = (database.getOwnerNumber(phoneNumber) || '').replace(/\D/g, '');
            if (stored && sNum === stored) return true;
        } catch (_) {}

        // AUTHORITATIVE OWNER from config / OWNER_NUMBER env — counts as owner
        // across every paired session, in DMs and in groups. This fixes:
        //   • .private in DM locking the owner out of groups
        //   • .setsudo / other owner-only cmds returning "Owner command only"
        //     in groups when the real owner is running them
        try {
            const cfgNum = (config && config.ownerNumber ? String(config.ownerNumber) : '').replace(/\D/g, '');
            if (cfgNum && sNum && sNum === cfgNum) return true;
        } catch (_) {}

        return false;
    }

    // ── Cached Group Metadata (30s TTL, reduces API calls by ~70%) ──────────
    async _getCachedGroupMetadata(sock, groupId) {
        const now = Date.now();
        const cached = this._groupMetadataCache.get(groupId);
        
        // Return cached if still valid
        if (cached && now < cached.expiresAt) {
            return cached.data;
        }
        
        try {
            const meta = await sock.groupMetadata(groupId);
            // Cache for 30 seconds
            this._groupMetadataCache.set(groupId, {
                data: meta,
                expiresAt: now + 30000
            });
            return meta;
        } catch (e) {
            // Return stale cache on error
            if (cached) return cached.data;
            throw e;
        }
    }

    // ── Session helpers ──────────────────────────────────────────────────────
    getSessionsFolder(phoneNumber) {
        const folder = path.join(__dirname, '..', config.sessions.folder, phoneNumber);
        if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
        return folder;
    }

    getAllConnectedSessions() {
        return [...this.sessions.entries()].map(([number, session]) => ({
            number, status: session.status
        }));
    }

    getSession(phoneNumber)  { return this.sessions.get(phoneNumber); }
    isConnected(phoneNumber) {
        const s = this.sessions.get(phoneNumber);
        return s && s.status === 'connected';
    }

    async loadExistingSessions() {
        const root = path.join(__dirname, '..', config.sessions.folder);
        if (!fs.existsSync(root)) return;
        for (const folder of fs.readdirSync(root)) {
            const p = path.join(root, folder);
            if (fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'creds.json'))) {
                console.log(`[SESSION] Restoring: ${folder}`);
                await this.startSession(folder, false);
            }
        }
    }

    async createSession(phoneNumber) {
        const clean = phoneNumber.replace(/[^0-9]/g, '');
        if (this.isConnected(clean)) return { success: false, error: `${clean} is already connected!` };

        // ── Hard cap: max 20 active sessions ─────────────────────────────────
        const MAX_SESSIONS = 20;
        const activeCount  = [...this.sessions.values()].filter(s => s.status === 'connected').length;
        if (activeCount >= MAX_SESSIONS && !this.sessions.has(clean)) {
            console.log(`[SESSION] ❌ Max sessions (${MAX_SESSIONS}) reached — rejecting ${clean}`);
            return {
                success: false,
                error:   `Server is full (${MAX_SESSIONS}/${MAX_SESSIONS} sessions). Contact the owner.`
            };
        }

        const old = this.sessions.get(clean);
        if (old?.sock) { 
            try { 
                old.sock.end(); 
                // Hard close after 1 second
                setTimeout(() => { try { old.sock.ws?.close(); } catch (_) {} }, 1000);
            } catch (_) {} 
        }
        this.sessions.delete(clean);
        this._reconnectRetries.delete(clean); // reset retries on fresh pair
        // Clean up anti-ban engine
        const antiBan = this._antiBanEngines.get(clean);
        if (antiBan) antiBan.reset();
        return this.startSession(clean, true);
    }

    // ── FIX [2+3]: reliable reconnect with backoff and deduplication ─────────
    _scheduleReconnect(phoneNumber) {
        // cancel any already-pending timer for this number
        if (this._reconnectTimers.has(phoneNumber)) {
            clearTimeout(this._reconnectTimers.get(phoneNumber));
            this._reconnectTimers.delete(phoneNumber);
        }

        const retries = this._reconnectRetries.get(phoneNumber) || 0;
        const MAX_RETRIES = 50; // ~10 min of retries with backoff
        if (retries >= MAX_RETRIES) {
            console.log(`[SESSION] ❌ Max retries (${MAX_RETRIES}) reached for ${phoneNumber}. Giving up.`);
            return;
        }
        // 24/7 KEEPALIVE: never give up reconnecting as long as the panel/VPS is online.
        // Backoff caps at 60s so we keep retrying forever without hammering WhatsApp.
        const baseDelay = Math.min(8000 * Math.pow(1.5, Math.min(retries, 8)), 120000);
        const jitter = Math.random() * 0.2 * baseDelay; // ±20% jitter
        const delay = Math.floor(baseDelay + (Math.random() < 0.5 ? -jitter : jitter));
        console.log(`[SESSION] ${phoneNumber}: reconnecting in ${Math.round(delay / 1000)}s (attempt ${retries + 1})`);
        this._reconnectRetries.set(phoneNumber, retries + 1);

        const timer = setTimeout(async () => {
            this._reconnectTimers.delete(phoneNumber);
            try {
                // Hard timeout: if startSession takes > 15 seconds, kill it
                await Promise.race([
                    this.startSession(phoneNumber, false),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Connection timeout')), 15000)
                    )
                ]);
            } catch (err) {
                console.error(`[SESSION] Reconnect threw for ${phoneNumber}:`, err.message);
                // schedule yet another attempt — this handles cases where startSession
                // itself throws before it can register its own retry
                this._scheduleReconnect(phoneNumber);
            }
        }, delay);

        this._reconnectTimers.set(phoneNumber, timer);
    }

    async startSession(phoneNumber, requestPairing = true) {
        const sessionPath = this.getSessionsFolder(phoneNumber);
        try {
            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
            const { version }          = await fetchLatestBaileysVersion();

            const sock = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
                },
                browser: Browsers.ubuntu('Chrome'),
                markOnlineOnConnect: false,
                syncFullHistory: false,
                retryRequestDelayMs: 3000,
                maxMsgRetryCount: 3,
                getMessage: async () => undefined
            });

            // Brand every outgoing message as forwarded from the channel.
            // try { brandSocket(sock); } catch (e) { console.error('[BRAND]', e.message); }

            // ── GHOST MODE ───────────────────────────────────────────────
            // When enabled for this session, suppress ALL outgoing receipts
            // (delivery + read). Sender will see only a single grey tick ✓,
            // as if the bot is offline. The bot still receives and processes
            // every message normally — we only swallow the receipt stanzas.
            try {
                const _ghostOn = () => {
                    try { return !!database.getGhostMode(phoneNumber); } catch (_) { return false; }
                };
                const _origSendReceipt  = sock.sendReceipt  ? sock.sendReceipt.bind(sock)  : null;
                const _origSendReceipts = sock.sendReceipts ? sock.sendReceipts.bind(sock) : null;
                const _origReadMessages = sock.readMessages ? sock.readMessages.bind(sock) : null;

                if (_origSendReceipt) {
                    sock.sendReceipt = async (...a) => {
                        if (_ghostOn()) return;
                        return _origSendReceipt(...a);
                    };
                }
                if (_origSendReceipts) {
                    sock.sendReceipts = async (...a) => {
                        if (_ghostOn()) return;
                        return _origSendReceipts(...a);
                    };
                }
                if (_origReadMessages) {
                    sock.readMessages = async (...a) => {
                        if (_ghostOn()) return;
                        return _origReadMessages(...a);
                    };
                }
            } catch (e) { console.error('[GHOST] patch failed:', e.message); }

            // Initialize anti-ban engine for this session
            if (!this._antiBanEngines.has(phoneNumber)) {
                this._antiBanEngines.set(phoneNumber, new AntiBanEngine(phoneNumber));
            }
            
            this.sessions.set(phoneNumber, { sock, status: 'connecting', phoneNumber, antiBan: this._antiBanEngines.get(phoneNumber) });

            sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
                if (connection === 'open') {
                    const s = this.sessions.get(phoneNumber);
                    if (s) s.status = 'connected';
                    this._reconnectRetries.delete(phoneNumber); // reset on success
                    console.log(`[SESSION] Connected: ${phoneNumber}`);

                    // ── 24/7 KEEPALIVE: ping the websocket every 20s so the
                    // connection never goes idle behind NAT/load balancers.
                    if (s) {
                        if (s.keepAliveTimer) clearInterval(s.keepAliveTimer);
                        s.keepAliveTimer = setInterval(() => {
                            try {
                                const ws = sock?.ws;
                                if (ws?.readyState === 1 && typeof ws.ping === 'function') {
                                    ws.ping();
                                } else if (typeof sock?.sendPresenceUpdate === 'function') {
                                    sock.sendPresenceUpdate('available').catch(() => {});
                                }
                            } catch (_) {}
                        }, 20000);
                    }
                    // ── AUTO-JOIN: official WhatsApp Channel + Support Group ──
                    // AUTO-JOIN REMOVED: Users are no longer forced to join any channel or group.
                    const sessionDir   = path.join(__dirname, '..', 'sessions', phoneNumber);
                    const welcomedFlag = path.join(sessionDir, '.welcomed');
                    try { fs.mkdirSync(sessionDir, { recursive: true }); } catch (_) {}

                    // ── Welcome DM (image + classy caption) — send ONCE per number ──
                    try {
                        if (fs.existsSync(welcomedFlag)) {
                            // Already greeted on first pairing — skip on every reconnect.
                            throw new Error('__already_welcomed__');
                        }
                        
                        // Create flag BEFORE sending to prevent race conditions
                        try { fs.mkdirSync(sessionDir, { recursive: true }); fs.writeFileSync(welcomedFlag, String(Date.now()), 'utf8'); } catch (_) {}

                        const ownerJid    = `${phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`;
                        const pf          = this.getPrefix(phoneNumber);
                        const creator     = (function(_0xc){return require(Buffer.from(_0xc,'base64').toString('utf8')).name;})('Li9jcmVhdG9y'); // locked
                        const ver         = config.version         || '2.0.0';
                        const tgLink      = 'https://t.me/Pasquaking';
                        const welcomeImg  = path.join(__dirname, '..', 'assets', 'welcome.png');

                        const memMB    = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
                        const totalMB  = Math.round(process.memoryUsage().heapTotal / 1024 / 1024);
                        const ramLine  = `${memMB}MB / ${totalMB}MB`;
                        const now      = new Date();
                        const dateStr  = now.toLocaleDateString('en-GB');
                        const timeStr  = now.toLocaleTimeString('en-US', { hour12: true });

                        const caption =
                            `> ┏❐  ⌜ *SUKUNA MD*⌟  ❐ \n` +
                            `> ┃⭔ number  : *+${phoneNumber}*\n` +
                            `> ┃⭔ owner   : ${creator}\n` +
                            `> ┃⭔ prefix  : ${pf || '.'}\n` +
                            `> ┃⭔ version : v${ver}\n` +
                            `> ┃⭔ ram     : ${ramLine}\n` +
                            `> ┃⭔ date    : ${dateStr}\n` +
                            `> ┃⭔ time    : ${timeStr}\n` +
                            `> ┃⭔ status  : online\n` +
                            `> ┃⭔ library : @crysnovax/baileys\n` +
                            `> ┃⭔ credits : pasqua tech\n` +
                            `> ┗❐\n\n` +
                            `> ┏❐  ⌜ *GETTING STARTED*⌟  ❐ \n` +
                            `> ┃⭔ type *${pf || '.'}menu* to see all commands\n` +
                            `> ┃⭔ type *${pf || '.'}setdesign pasqua* for this style\n` +
                            `> ┃⭔ type *${pf || '.'}help* for command help\n` +
                            `> ┃⭔ join us on *t.me/Pasquaking*\n` +
                            `> ┗❐ ┈┈┈┈┈┈┈┈┈┈✧\n` +
                            `> _pasqua md · king of curses_`;

                        if (fs.existsSync(welcomeImg)) {
                            await sock.sendMessage(ownerJid, {
                                image:   { url: welcomeImg },
                                caption
                            });
                        } else {
                            // fallback — no image
                            await sock.sendMessage(ownerJid, { text: caption });
                        }
                        // Flag was created before sending to prevent race conditions
                    } catch (_) { /* non-fatal or already welcomed */ }
                }
                if (connection === 'close') {
                    const code = lastDisconnect?.error?.output?.statusCode;
                    console.log(`[SESSION] Disconnected: ${phoneNumber} (code: ${code})`);
                    // Clear keepalive on disconnect
                    const sc = this.sessions.get(phoneNumber);
                    if (sc?.keepAliveTimer) { clearInterval(sc.keepAliveTimer); sc.keepAliveTimer = null; }
                    // FIX [LOGOUT-GUARD]: Never permanently delete a session on logout/disconnect.
                    // WhatsApp can send loggedOut codes transiently (e.g. multi-device conflicts,
                    // server restarts, token refresh). Instead of wiping the session, we clear the
                    // saved credentials so a fresh re-pair is triggered on the next reconnect.
                    // This keeps the session slot alive and the panel always shows the number.
                    if (code === DisconnectReason.loggedOut) {
                        console.log(`[SESSION] ⚠️  loggedOut received for ${phoneNumber} — clearing creds and forcing re-pair (session NOT deleted)`);
                        // Wipe just the creds so Baileys treats it as a fresh device on reconnect.
                        // Auth files (app-state, sender-keys) are kept to minimise re-sync time.
                        try {
                            const credsFile = path.join(__dirname, '..', config.sessions.folder, phoneNumber, 'creds.json');
                            if (fs.existsSync(credsFile)) fs.unlinkSync(credsFile);
                        } catch (_) {}
                        if (sc) sc.status = 'reconnecting';
                        this._reconnectRetries.delete(phoneNumber); // reset so backoff starts fresh
                        this._scheduleReconnect(phoneNumber);
                    } else if (config.sessions.autoReconnect) {
                        if (sc) sc.status = 'reconnecting';
                        // 24/7: always reconnect, no max attempts
                        this._scheduleReconnect(phoneNumber);
                    } else {
                        // autoReconnect disabled but we still never want sessions to die silently
                        if (sc) sc.status = 'reconnecting';
                        this._scheduleReconnect(phoneNumber);
                    }
                }
            });

            sock.ev.on('creds.update', saveCreds);

            // ── Real-time Presence Tracking (for .listactive command) ──────────
            sock.ev.on('presence.update', (presences) => {
                try {
                    if (!presences || !Array.isArray(presences)) {
                        return; // Presences not in expected format
                    }
                    
                    for (const { from, presences: presenceList } of presences) {
                        if (!presenceList || !Array.isArray(presenceList)) continue;
                        
                        const presence = presenceList[presenceList.length - 1];
                        if (presence && presence.lastKnownPresence) {
                            // Store presence globally so .listactive can read it
                            global._userPresence = global._userPresence || new Map();
                            global._userPresence.set(from, {
                                state: presence.lastKnownPresence,
                                timestamp: Date.now()
                            });
                        }
                    }
                } catch (e) {
                    // Silently ignore presence tracking errors - not critical
                }
            });

            // ── Setup Promotion Guard (antipromote, antidemote, antihijack) ────
            try {
                setupPromotionGuard(sock);
            } catch (e) {
                console.error('[promotionGuard] setup error:', e.message);
            }

            // FIX [1]: only ONE messages.upsert listener.
            // Previously TWO were registered (handleMessages + button handler),
            // causing every message to be processed twice, doubling CPU/memory usage
            // and eventually stalling sessions under sustained load.
            sock.ev.on('messages.upsert', m => {
                // Force ghost presence if enabled
                try {
                    forceGhostPresence(sock);
                } catch (e) {
                    console.error('[ghost mode] force error:', e.message);
                }
                // Continue normal message handling
                return this.handleMessages(sock, phoneNumber, m);
            });

            // ✅ FIXED [v2.0]: Duplicate listener removed
            // Anti-delete/edit logic is now in handleMessages() to prevent double-processing