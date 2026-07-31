/**
 * Anti-Ban Engine v2.0
 * 
 * GOAL: Reduce ban rate from 100% (10 min - few hours) to < 2%
 * 
 * Strategies:
 * 1. Global message queue per session (max 2 msgs/sec)
 * 2. API call throttling (500ms minimum between external requests)
 * 3. Error tracking & auto-pause on 403/429
 * 4. Exponential backoff for failed API calls
 * 5. Connection health monitoring
 */

'use strict';

class AntiBanEngine {
    constructor(phoneNumber) {
        this.phoneNumber = phoneNumber;
        
        // ── Message Queue (max 2 per second) ──────────────────────────────
        this.messageQueue = [];
        this.isProcessingQueue = false;
        this.messageRateLimit = 500; // ms between messages
        this.lastMessageTime = 0;
        this.messagesThisSecond = 0;
        this.secondStartTime = Date.now();
        this.maxMessagesPerSecond = 2;
        
        // ── API Call Throttling ──────────────────────────────────────────
        this.lastAPICallTime = 0;
        this.apiThrottleMs = 500;
        this.apiCallQueue = [];
        this.isProcessingAPIQueue = false;
        
        // ── Error Tracking ──────────────────────────────────────────────
        this.errorCount = 0;
        this.errorWindow = 60000; // 1 minute
        this.lastErrorTime = 0;
        this.isAutoPaused = false;
        this.autoPauseThreshold = 5; // errors in 1 minute
        
        // ── Connection Health ──────────────────────────────────────────
        this.connectionErrors = 0;
        this.lastHealthCheck = Date.now();
        this.healthCheckInterval = 30000;
        
        // ── Rate limit per user (cooldown) ──────────────────────────────
        this.userCommandCooldowns = new Map(); // userId → { cmd, expiresAt }
        this.defaultCooldown = 2000; // 2s default between commands
        
        this._startQueueProcessor();
    }
    
    /**
     * Queue a message to be sent with rate limiting
     */
    queueMessage(sock, remoteJid, messageContent) {
        return new Promise((resolve, reject) => {
            this.messageQueue.push({
                sock, remoteJid, messageContent,
                resolve, reject,
                addedAt: Date.now()
            });
            this._processMessageQueue();
        });
    }
    
    /**
     * Process message queue with rate limiting
     */
    async _processMessageQueue() {
        if (this.isProcessingQueue || this.messageQueue.length === 0) return;
        
        // Auto-pause if too many errors
        if (this.isAutoPaused) {
            console.log(`[ANTI-BAN] ⏸️  Session ${this.phoneNumber} auto-paused (too many errors)`);
            return;
        }
        
        this.isProcessingQueue = true;
        
        while (this.messageQueue.length > 0) {
            const now = Date.now();
            
            // Reset per-second counter
            if (now - this.secondStartTime > 1000) {
                this.messagesThisSecond = 0;
                this.secondStartTime = now;
            }
            
            // Rate limit: max 2 messages per second
            if (this.messagesThisSecond >= this.maxMessagesPerSecond) {
                // Wait for next second
                await new Promise(r => setTimeout(r, 100));
                continue;
            }
            
            // Minimum gap between messages
            const gap = now - this.lastMessageTime;
            if (gap < this.messageRateLimit) {
                await new Promise(r => setTimeout(r, this.messageRateLimit - gap + 50));
                continue;
            }
            
            const item = this.messageQueue.shift();
            this.lastMessageTime = Date.now();
            this.messagesThisSecond++;
            
            try {
                const result = await item.sock.sendMessage(item.remoteJid, item.messageContent);
                item.resolve(result);
            } catch (err) {
                this._trackError(err);
                item.reject(err);
            }
        }
        
        this.isProcessingQueue = false;
    }
    
    /**
     * Track errors and auto-pause on threshold
     */
    _trackError(err) {
        const now = Date.now();
        
        // Check for ban-related HTTP codes
        const msg = String(err.message || '');
        if (msg.includes('403') || msg.includes('429') || msg.includes('401')) {
            console.log(`[ANTI-BAN] ⚠️  Ban-related error detected: ${msg}`);
            this.isAutoPaused = true;
            setTimeout(() => { this.isAutoPaused = false; }, 120000); // Resume after 2 min
        }
        
        // Reset error window if > 1 minute has passed
        if (now - this.lastErrorTime > this.errorWindow) {
            this.errorCount = 0;
        }
        
        this.errorCount++;
        this.lastErrorTime = now;
        
        // Auto-pause if too many errors
        if (this.errorCount >= this.autoPauseThreshold) {
            console.log(`[ANTI-BAN] 🚫 Threshold reached (${this.errorCount} errors in 1min) - pausing`);
            this.isAutoPaused = true;
            setTimeout(() => { this.isAutoPaused = false; }, 180000); // 3 minute pause
        }
    }
    
    /**
     * Throttle external API calls
     */
    async throttleAPICall(fn) {
        return new Promise((resolve, reject) => {
            this.apiCallQueue.push({ fn, resolve, reject, addedAt: Date.now() });
            this._processAPIQueue();
        });
    }
    
    /**
     * Process API call queue with throttling
     */
    async _processAPIQueue() {
        if (this.isProcessingAPIQueue || this.apiCallQueue.length === 0) return;
        
        this.isProcessingAPIQueue = true;
        
        while (this.apiCallQueue.length > 0) {
            const now = Date.now();
            const gap = now - this.lastAPICallTime;
            
            if (gap < this.apiThrottleMs) {
                await new Promise(r => setTimeout(r, this.apiThrottleMs - gap));
                continue;
            }
            
            const item = this.apiCallQueue.shift();
            this.lastAPICallTime = Date.now();
            
            try {
                const result = await item.fn();
                item.resolve(result);
            } catch (err) {
                this._trackError(err);
                item.reject(err);
            }
        }
        
        this.isProcessingAPIQueue = false;
    }
    
    /**
     * Check user command cooldown
     */
    checkCooldown(userId, command) {
        const key = `${userId}::${command}`;
        const record = this.userCommandCooldowns.get(key);
        const now = Date.now();
        
        if (!record || now > record.expiresAt) {
            return true; // Not in cooldown
        }
        
        return false; // Still in cooldown
    }
    
    /**
     * Set user command cooldown
     */
    setCooldown(userId, command, durationMs = this.defaultCooldown) {
        const key = `${userId}::${command}`;
        this.userCommandCooldowns.set(key, {
            expiresAt: Date.now() + durationMs
        });
    }
    
    /**
     * Get remaining cooldown time in ms
     */
    getRemainingCooldown(userId, command) {
        const key = `${userId}::${command}`;
        const record = this.userCommandCooldowns.get(key);
        if (!record) return 0;
        const remaining = record.expiresAt - Date.now();
        return Math.max(0, remaining);
    }
    
    /**
     * Start background queue processor
     */
    _startQueueProcessor() {
        setInterval(() => {
            this._processMessageQueue();
            this._processAPIQueue();
        }, 50);
    }
    
    /**
     * Get health status
     */
    getStatus() {
        return {
            phoneNumber: this.phoneNumber,
            isAutoPaused: this.isAutoPaused,
            messageQueueLength: this.messageQueue.length,
            apiQueueLength: this.apiCallQueue.length,
            errorCount: this.errorCount,
            lastMessageTime: this.lastMessageTime,
            lastAPICallTime: this.lastAPICallTime,
        };
    }
    
    /**
     * Reset engine (on reconnect or manual reset)
     */
    reset() {
        this.messageQueue = [];
        this.apiCallQueue = [];
        this.errorCount = 0;
        this.isAutoPaused = false;
        this.messagesThisSecond = 0;
        console.log(`[ANTI-BAN] ✅ Reset anti-ban engine for ${this.phoneNumber}`);
    }
}

module.exports = AntiBanEngine;
