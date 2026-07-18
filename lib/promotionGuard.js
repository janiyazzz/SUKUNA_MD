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
        execute: async (context) => {
            try {
                const { sock, msg: m, args, reply } = context;
                const sub = args[0]?.toLowerCase();
                
                if (sub === 'on' || sub === 'off') {
                    const state = sub === 'on';
                    updateGroupConfig(m.chat, { [mode]: state });
                    return reply(`✓ ${label} is now ${state ? 'ON' : 'OFF'}.`);
                }

                if (sub === 'immune' || sub === 'exempt') {
                    const operation = args[1]?.toLowerCase() || 'list';
                    const settings = getGroupConfig(m.chat);
                    
                    if (operation === 'list') {
                        const mentions = settings.immune || [];
                        const list = mentions.map((jid, index) => `${index + 1}. @${jid.split('@')[0]}${jid === DEFAULT_IMMUNE_JID ? ' (creator)' : ''}`).join('\n');
                        return sock.sendMessage(m.chat, { text: `Immunity list:\n${list || 'Empty'}`, mentions }, { quoted: m });
                    }

                    if (!['add', 'del', 'remove'].includes(operation)) return reply(`Usage: .${mode} immune add|del|list`);
                    
                    const targetStr = args.slice(2).join(' ');
                    let target = targetStr;
                    
                    if (m.quoted?.sender) {
                        target = m.quoted.sender;
                    } else if (m.mentions?.[0]) {
                        target = m.mentions[0];
                    }
                    
                    if (!target || target.trim() === '') return reply('Reply to or mention a user');
                    const normalized = normalizeJid(target);

                    if (operation === 'add') {
                        const exists = settings.immune?.includes(normalized);
                        if (exists) return reply('Already immune');
                        updateGroupConfig(m.chat, { immune: [...(settings.immune || []), normalized] });
                        return reply(`✓ Immunity added for @${normalized.split('@')[0]}`);
                    }

                    if (normalized === DEFAULT_IMMUNE_JID) return reply('Cannot remove default immunity');
                    const remaining = (settings.immune || []).filter(jid => normalizeJid(jid) !== normalized);
                    if (remaining.length === (settings.immune || []).length) return reply('Not in immunity list');
                    updateGroupConfig(m.chat, { immune: remaining });
                    return reply(`✓ Immunity removed for @${normalized.split('@')[0]}`);
                }

                const settings = getGroupConfig(m.chat);
                return reply(`${label}: ${settings[mode] ? 'ON' : 'OFF'}\n\n.${mode} on|off\n.${mode} immune list|add|del`);
            } catch (err) {
                console.error(`[${mode}]`, err.message);
                return context.reply(`Error: ${err.message}`);
            }
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
