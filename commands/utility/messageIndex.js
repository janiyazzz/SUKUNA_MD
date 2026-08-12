'use strict';

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES = 5000;

const _store = new Map();

function add(phoneNumber, id, entry) {
    if (!phoneNumber || !id || !entry) return;
    if (!_store.has(phoneNumber)) _store.set(phoneNumber, new Map());
    const map = _store.get(phoneNumber);
    map.set(id, { ...entry, seenAt: Date.now() });
    if (map.size > MAX_ENTRIES) {
        const oldestKey = map.keys().next().value;
        map.delete(oldestKey);
    }
}

function get(phoneNumber, id) {
    const map = _store.get(phoneNumber);
    if (!map) return null;
    const entry = map.get(id);
    if (!entry) return null;
    if (Date.now() - entry.seenAt > TTL_MS) {
        map.delete(id);
        return null;
    }
    return entry;
}

function _purgeExpired() {
    const now = Date.now();
    for (const map of _store.values()) {
        for (const [id, entry] of map) {
            if (now - entry.seenAt > TTL_MS) map.delete(id);
        }
    }
}

setInterval(_purgeExpired, 20 * 60 * 1000).unref();

module.exports = { add, get };
