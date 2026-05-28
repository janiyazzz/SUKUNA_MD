/**
 * newsletterBrand.js — attach a tappable "View Channel" pill to the BOTTOM
 * of every outgoing bot message using forwardedNewsletterMessageInfo alone.
 *
 * Key detail: forwardedNewsletterMessageInfo WITHOUT isForwarded/forwardingScore
 * renders as the bottom channel pill (same position externalAdReply used).
 * Adding isForwarded moves it to a top forwarded-header instead — so we
 * deliberately omit those fields here.
 *
 * No externalAdReply anywhere.
 */
'use strict';

const NEWSLETTER_JID  = '120363424109748354@newsletter';
const NEWSLETTER_NAME = '꧁ Malevolent Kings ꧂';

const FORWARD_CTX = {
    forwardedNewsletterMessageInfo: {
        newsletterJid:   NEWSLETTER_JID,
        newsletterName:  NEWSLETTER_NAME,
        serverMessageId: 100,
    },
};

// Merge caller's contextInfo without clobbering fields like mentions/quoted.
function mergeCtx(existing) {
    const e = existing || {};
    return {
        ...e,
        forwardedNewsletterMessageInfo: FORWARD_CTX.forwardedNewsletterMessageInfo,
    };
}

// Inject contextInfo into any message-content shape Baileys accepts.
function brandContent(content) {
    if (!content || typeof content !== 'object') return content;
    // React/edit/delete payloads — skip, they have no contextInfo
    if (content.react || content.edit || content.delete || content.protocolMessage) {
        return content;
    }
    return { ...content, contextInfo: mergeCtx(content.contextInfo) };
}

/**
 * Wrap a Baileys socket so every sock.sendMessage call carries the
 * View Channel pill. Idempotent — calling twice is a no-op.
 */
function wrapSocket(sock) {
    if (!sock || sock.__newsletterBranded) return sock;
    const original = sock.sendMessage.bind(sock);
    sock.sendMessage = (jid, content, options) => {
        try {
            return original(jid, brandContent(content), options);
        } catch (e) {
            // Never block a send because of branding — fall back raw.
            return original(jid, content, options);
        }
    };
    sock.__newsletterBranded = true;
    return sock;
}

module.exports = {
    NEWSLETTER_JID,
    NEWSLETTER_NAME,
    FORWARD_CTX,
    mergeCtx,
    brandContent,
    wrapSocket,
};
