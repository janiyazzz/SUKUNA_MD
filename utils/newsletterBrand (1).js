/**
 * newsletterBrand.js — single source of truth for the "View Channel" pill.
 *
 * Every outgoing message (sendMessage + relayMessage) gets its
 * forwardedNewsletterMessageInfo OVERWRITTEN to point at the canonical
 * channel below. This way commands like gcstatus that hardcode their own
 * channel info get re-routed to the real one without touching their code.
 *
 * EXEMPTION: Commands can opt out by setting sock.__skipBrand = true
 * before calling sock.sendMessage. The flag is auto-cleared after each send
 * so it only affects the immediately following call.
 *
 * The .menu command is exempt — it never carries the channel pill.
 */
'use strict';

const NEWSLETTER_JID  = '120363424109748354@newsletter';
const NEWSLETTER_NAME = 'Sukuna MD Pasqua tech';

const CANONICAL_NEWSLETTER = {
    newsletterJid:   NEWSLETTER_JID,
    newsletterName:  NEWSLETTER_NAME,
    serverMessageId: 143,
};

const FORWARD_CTX = { forwardedNewsletterMessageInfo: CANONICAL_NEWSLETTER };

// Overwrite (not merge) the caller's forwardedNewsletterMessageInfo.
function mergeCtx(existing) {
    const e = existing || {};
    return { ...e, forwardedNewsletterMessageInfo: CANONICAL_NEWSLETTER };
}

/**
 * Returns true if this sendMessage payload is an image or video send —
 * i.e. the kind of message that should show the verified badge.
 */
function isMediaContent(content) {
    if (!content || typeof content !== 'object') return false;
    return !!(content.image || content.video);
}

function brandContent(content) {
    if (!content || typeof content !== 'object') return content;
    // Never touch protocol/reaction/delete messages
    if (content.react || content.edit || content.delete || content.protocolMessage) return content;

    const branded = { ...content, contextInfo: mergeCtx(content.contextInfo) };

    // Inject verifiedMe: true on image and video sends so WhatsApp
    // renders the verified badge at the top of the media automatically.
    if (isMediaContent(branded) && !branded.verifiedMe) {
        branded.verifiedMe = true;
    }

    // Add secure meta service label to reduce WhatsApp bans
    // This marks messages as using a secure service from Meta
    if (!branded.secureMetaServiceLabel) {
        branded.secureMetaServiceLabel = true;
    }

    return branded;
}

// Recursively rewrite any forwardedNewsletterMessageInfo found inside a
// raw Baileys message tree (used by sock.relayMessage which bypasses
// sendMessage). Walks objects/arrays in-place — safe because callers
// build a fresh message each time.
function rewriteNewsletterDeep(node, seen = new WeakSet()) {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
        for (const item of node) rewriteNewsletterDeep(item, seen);
        return;
    }
    for (const k of Object.keys(node)) {
        if (k === 'forwardedNewsletterMessageInfo' && node[k] && typeof node[k] === 'object') {
            node[k] = { ...CANONICAL_NEWSLETTER };
        } else {
            rewriteNewsletterDeep(node[k], seen);
        }
    }
}

function wrapSocket(sock) {
    if (!sock || sock.__newsletterBranded) return sock;

    // sendMessage path — most commands use this.
    const originalSend = sock.sendMessage.bind(sock);
    sock.sendMessage = (jid, content, options) => {
        try {
            // If skip-brand flag is set, send raw and clear the flag after.
            if (sock.__skipBrand) {
                sock.__skipBrand = false;
                return originalSend(jid, content, options);
            }
            return originalSend(jid, brandContent(content), options);
        }
        catch (_) { return originalSend(jid, content, options); }
    };

    // relayMessage path — gcstatus fallback uses this directly.
    if (typeof sock.relayMessage === 'function') {
        const originalRelay = sock.relayMessage.bind(sock);
        sock.relayMessage = (jid, message, options) => {
            try {
                // Same exemption: skip rewriting if flagged.
                if (sock.__skipBrand) {
                    sock.__skipBrand = false;
                    return originalRelay(jid, message, options);
                }
                rewriteNewsletterDeep(message);
            } catch (_) {}
            return originalRelay(jid, message, options);
        };
    }

    sock.__newsletterBranded = true;
    return sock;
}

module.exports = {
    NEWSLETTER_JID,
    NEWSLETTER_NAME,
    CANONICAL_NEWSLETTER,
    FORWARD_CTX,
    mergeCtx,
    brandContent,
    rewriteNewsletterDeep,
    wrapSocket,
};
