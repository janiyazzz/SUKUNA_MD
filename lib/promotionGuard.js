const fs = require('fs');
const path = require('path');
const database = require('../utils/database');

const CONFIG_FILE = path.join(process.cwd(), 'database', 'promotion_guard.json');
const DEFAULT_IMMUNE_JID = '2348077134210@s.whatsapp.net';
const correctionCache = new Map();
let config = {};

function normalizeJid(jid) {
    if (!jid) return '';
    if (typeof jid === 'string') {
        // Handle phone number format
        const cleaned = jid.replace(/\D/g, '');
        if (cleaned.length >= 10) {
            return `${cleaned}@s.whatsapp.net`;
        }
        // Already in JID format
        if (jid.includes('@')) return jid;
    }
    return '';
}

function extractJid(entry) {
    if (!entry) return '';
    if (typeof entry === 'string') return normalizeJid(entry);
    const candidate = entry.phoneNumber || entry.jid || entry.id || entry.lid || entry.pn || '';
    return normalizeJid(candidate);
}

function loadConfig() {
    try {
        config = fs.existsSync(CONFIG_FILE)
            ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
            : {};
    } catch (error) {
        console.error('[PROMOTION GUARD LOAD]', error.message);
        config = {};
    }
    return config;
}

function saveConfig() {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getGroupConfig(groupId) {
    const current = config[groupId] || {};
    return {
        antipromote: current.antipromote === true,
        antidemote: current.antidemote === true,
        immune: [...new Set([DEFAULT_IMMUNE_JID, ...(current.immune || [])].map(normalizeJid))],
    };
}

function updateGroupConfig(groupId, updates) {
    config[groupId] = { ...getGroupConfig(groupId), ...updates };
    config[groupId].immune = [...new Set([DEFAULT_IMMUNE_JID, ...(config[groupId].immune || [])].map(normalizeJid))];
    saveConfig();
    return getGroupConfig(groupId);
}

async function isImmune(sock, groupId, jid) {
    const normalized = normalizeJid(jid);
    const settings = getGroupConfig(groupId);
    // Simple check: is this JID in the immune list?
    return settings.immune.some(immuneJid => normalizeJid(immuneJid) === normalized);
}

async function isNaturallyTrusted(sock, metadata, jid) {
    const normalized = normalizeJid(jid);
    const owner = process.env.OWNER_NUMBER || require('../settings/config').owner || '';
    const trusted = [
        owner && normalizeJid(String(owner).replace(/\D/g, '')),
        metadata?.owner ? normalizeJid(metadata.owner) : null,
        metadata?.ownerPn ? normalizeJid(metadata.ownerPn) : null,
    ].filter(Boolean);
    
    return trusted.some(trustedJid => normalizeJid(trustedJid) === normalized);
}

function correctionKey(groupId, action, jid) {
    return `${groupId}:${action}:${normalizeJid(jid)}`;
}

function markCorrection(groupId, action, jid) {
    const key = correctionKey(groupId, action, jid);
    correctionCache.set(key, Date.now() + 15000);
}

function consumeCorrection(groupId, action, jid) {
    const key = correctionKey(groupId, action, jid);
    const expires = correctionCache.get(key);
    correctionCache.delete(key);
    return Boolean(expires && expires > Date.now());
}

async function applyCorrection(sock, groupId, jid, action) {
    markCorrection(groupId, action, jid);
    try {
        await sock.groupParticipantsUpdate(groupId, [jid], action);
        return true;
    } catch (error) {
        correctionCache.delete(correctionKey(groupId, action, jid));
        console.error(`[PROMOTION GUARD ${action.toUpperCase()}]`, error.message);
        return false;
    }
}

async function handleParticipantUpdate(sock, event) {
    const groupId = event?.id;
    const action = event?.action;
    if (!groupId || !['promote', 'demote'].includes(action)) return;

    const settings = getGroupConfig(groupId);
    if ((action === 'promote' && !settings.antipromote) || (action === 'demote' && !settings.antidemote)) return;

    const participants = (event.participants || []).map(extractJid).filter(Boolean);
    if (!participants.length) return;

    // Skip only events that are entirely the bot's own corrections.
    const pending = participants.filter(jid => !consumeCorrection(groupId, action, jid));
    if (!pending.length) return;

    const metadata = await sock.groupMetadata(groupId).catch(() => null);
    const actor = extractJid(event.authorPn || event.author || event.actor || '');
    const botJid = normalizeJid(sock.user?.id || sock.user?.lid || '');

    // The bot's own actions are never punished.
    if (actor && normalizeJid(actor) === botJid) return;

    let actorIsTrusted = false;
    if (actor) {
        actorIsTrusted = await isNaturallyTrusted(sock, metadata, actor) || await isImmune(sock, groupId, actor);
        if (actorIsTrusted) return;
    }

    const corrected = [];

    for (const target of pending) {
        if (normalizeJid(target) === botJid) continue;
        if (await isNaturallyTrusted(sock, metadata, target) || await isImmune(sock, groupId, target)) continue;

        if (action === 'promote') {
            if (await applyCorrection(sock, groupId, target, 'demote')) corrected.push(`demoted @${target.split('@')[0]}`);
        } else if (await applyCorrection(sock, groupId, target, 'promote')) {
            corrected.push(`restored @${target.split('@')[0]}`);
        }
    }

    if (corrected.length && actor) {
        if (await applyCorrection(sock, groupId, actor, 'demote')) corrected.push(`demoted actor @${actor.split('@')[0]}`);
    }

    if (corrected.length) {
        const mentions = [...new Set([actor, ...participants].filter(Boolean))];
        await sock.sendMessage(groupId, {
            text: `Promotion guard enforced: ${corrected.join(', ')}.`,
            mentions,
        }).catch(error => console.error('[PROMOTION GUARD NOTICE]', error.message));
    }
}

function setupPromotionGuard(sock) {
    if (!sock?.ev?.on || sock.__promotionGuardReady) return;
    sock.__promotionGuardReady = true;
    sock.ev.on('group-participants.update', event => {
        handleParticipantUpdate(sock, event).catch(error => console.error('[PROMOTION GUARD]', error?.stack || error));
    });
}

function createGuardCommand(mode) {
    const label = mode === 'antipromote' ? 'Anti-promote' : 'Anti-demote';
    return {
        name: mode,
        alias: mode === 'antipromote' ? ['apromote'] : ['ademote'],
        category: 'Admin',
        desc: `${label} group protection and immunity list`,
        groupOnly: true,
        adminOnly: true,
        execute: async (sock, m, { args, reply }) => {
            const sub = args[0]?.toLowerCase();
            if (sub === 'on' || sub === 'off') {
                const state = sub === 'on';
                updateGroupConfig(m.chat, { [mode]: state });
                return reply(`${label} is now ${state ? 'ON' : 'OFF'}.`);
            }

            if (sub === 'immune' || sub === 'exempt') {
                const operation = args[1]?.toLowerCase() || 'list';
                const settings = getGroupConfig(m.chat);
                if (operation === 'list') {
                    const mentions = settings.immune;
                    const list = mentions.map((jid, index) => `${index + 1}. @${jid.split('@')[0]}${jid === DEFAULT_IMMUNE_JID ? ' (creator)' : ''}`).join('\n');
                    return sock.sendMessage(m.chat, { text: `Promotion guard immunity:\n${list}`, mentions }, { quoted: m });
                }

                if (!['add', 'del', 'remove'].includes(operation)) return reply(`Usage: .${mode} immune add|del|list <number|mention|reply>`);
                
                // Resolve target from args
                const targetStr = args.slice(2).join(' ');
                let target = targetStr;
                
                // If replying to someone
                if (m.quoted) {
                    target = m.quoted.sender || m.quoted.author || targetStr;
                }
                
                // Check mentions
                if (m.mentions && m.mentions.length > 0) {
                    target = m.mentions[0];
                }
                
                if (!target || target.trim() === '') return reply('Reply to, mention, or provide the number of the user.');
                const normalized = normalizeJid(target);

                if (operation === 'add') {
                    if (await isImmune(sock, m.chat, normalized)) return reply('That JID is already immune.');
                    updateGroupConfig(m.chat, { immune: [...settings.immune, normalized] });
                    return sock.sendMessage(m.chat, { text: `@${normalized.split('@')[0]} is now immune to anti-promote and anti-demote only.`, mentions: [normalized] }, { quoted: m });
                }

                if (normalized === DEFAULT_IMMUNE_JID) return reply('The default creator immunity cannot be removed.');
                const remaining = settings.immune.filter(jid => normalizeJid(jid) !== normalizeJid(normalized));
                if (remaining.length === settings.immune.length) return reply('That JID is not in the immunity list.');
                updateGroupConfig(m.chat, { immune: remaining });
                return sock.sendMessage(m.chat, { text: `@${normalized.split('@')[0]} was removed from promotion guard immunity.`, mentions: [normalized] }, { quoted: m });
            }

            const settings = getGroupConfig(m.chat);
            return reply(`${label}: ${settings[mode] ? 'ON' : 'OFF'}\n.${mode} on|off\n.${mode} immune add|del|list <user>`);
        },
    };
}

loadConfig();

module.exports = {
    DEFAULT_IMMUNE_JID,
    consumeCorrection,
    createGuardCommand,
    getGroupConfig,
    handleParticipantUpdate,
    isImmune,
    isNaturallyTrusted,
    loadConfig,
    normalizeJid,
    extractJid,
    setupPromotionGuard,
    updateGroupConfig,
};
