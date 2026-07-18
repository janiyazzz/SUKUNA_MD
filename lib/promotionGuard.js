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
        aliases: mode === 'antipromote' ? ['apromote'] : ['ademote'],
        category: 'Admin',
        desc: `${label} group protection and immunity list`,
        groupOnly: true,
        adminOnly: true,
        execute: async (context) => {
            try {
                // Defensive destructuring with fallbacks
                const sock = context?.sock;
                const msg = context?.msg || context?.message;
                const m = msg;
                const args = context?.args || [];
                const reply = context?.reply || (() => {});

                // Validate essential properties
                if (!m || !m.chat) {
                    return reply('Error: Invalid group context');
                }

                if (!sock) {
                    return reply('Error: Socket not available');
                }

                // Validate group JID
                if (typeof m.chat !== 'string' || !m.chat.includes('@')) {
                    return reply('Error: Invalid group');
                }

                const sub = args[0]?.toLowerCase?.() || '';
                
                // Toggle on/off
                if (sub === 'on' || sub === 'off') {
                    try {
                        const state = sub === 'on';
                        updateGroupConfig(m.chat, { [mode]: state });
                        return reply(`✓ ${label} is now ${state ? 'ON' : 'OFF'}.`);
                    } catch (err) {
                        console.error(`[${mode} toggle]`, err.message);
                        return reply(`Failed to toggle: ${err.message}`);
                    }
                }

                // Handle immunity operations
                if (sub === 'immune' || sub === 'exempt') {
                    try {
                        const operation = args[1]?.toLowerCase?.() || 'list';
                        const settings = getGroupConfig(m.chat);
                        
                        if (operation === 'list') {
                            const mentions = settings?.immune || [];
                            const listItems = mentions
                                .filter(jid => jid && typeof jid === 'string')
                                .map((jid, index) => {
                                    try {
                                        const num = jid.split('@')[0] || 'Unknown';
                                        const marker = jid === DEFAULT_IMMUNE_JID ? ' (owner)' : '';
                                        return `${index + 1}. @${num}${marker}`;
                                    } catch {
                                        return `${index + 1}. [Error parsing JID]`;
                                    }
                                });
                            
                            const text = `Immunity List:\n${listItems.length > 0 ? listItems.join('\n') : 'Empty'}`;
                            return sock.sendMessage(m.chat, { text, mentions }, { quoted: m }).catch(err => {
                                console.error('[immunity list]', err.message);
                                return reply(text);
                            });
                        }

                        if (!['add', 'del', 'remove'].includes(operation)) {
                            return reply(`Usage: .${mode} immune add|del|list`);
                        }
                        
                        // Resolve target user
                        let target = null;
                        
                        // Priority: quoted user > mentions > args
                        if (m.quoted?.sender) {
                            target = m.quoted.sender;
                        } else if (m.mentions && m.mentions.length > 0) {
                            target = m.mentions[0];
                        } else {
                            const targetStr = args.slice(2).join(' ').trim();
                            if (targetStr) target = targetStr;
                        }

                        if (!target) {
                            return reply('Reply to user, mention them, or provide their number');
                        }

                        // Normalize the JID
                        const normalized = normalizeJid(target);
                        if (!normalized) {
                            return reply('Invalid user format');
                        }

                        // Add immunity
                        if (operation === 'add') {
                            const currentImmune = settings?.immune || [];
                            const exists = currentImmune.some(jid => normalizeJid(jid) === normalized);
                            
                            if (exists) {
                                return reply(`@${normalized.split('@')[0]} is already immune`);
                            }

                            const newImmune = [...currentImmune, normalized];
                            updateGroupConfig(m.chat, { immune: newImmune });
                            return reply(`✓ @${normalized.split('@')[0]} is now immune`);
                        }

                        // Remove immunity
                        if (operation === 'del' || operation === 'remove') {
                            if (normalized === DEFAULT_IMMUNE_JID) {
                                return reply('Cannot remove owner immunity');
                            }

                            const currentImmune = settings?.immune || [];
                            const found = currentImmune.some(jid => normalizeJid(jid) === normalized);
                            
                            if (!found) {
                                return reply(`@${normalized.split('@')[0]} is not in immunity list`);
                            }

                            const remaining = currentImmune.filter(jid => normalizeJid(jid) !== normalized);
                            updateGroupConfig(m.chat, { immune: remaining });
                            return reply(`✓ @${normalized.split('@')[0]} immunity removed`);
                        }

                    } catch (err) {
                        console.error(`[${mode} immunity]`, err.message);
                        return reply(`Immunity operation failed: ${err.message}`);
                    }
                }

                // Show status
                try {
                    const settings = getGroupConfig(m.chat);
                    const status = settings[mode] ? 'ON' : 'OFF';
                    return reply(`${label}: ${status}\n\n.${mode} on\n.${mode} off\n.${mode} immune list|add|del`);
                } catch (err) {
                    console.error(`[${mode} status]`, err.message);
                    return reply('Status unavailable');
                }

            } catch (err) {
                console.error(`[${mode}]`, err?.message || err);
                return context?.reply?.(`Unexpected error: ${err?.message || 'Unknown'}`);
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
