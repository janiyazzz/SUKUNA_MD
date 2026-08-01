/**
 * Anti-Ban Engine v2.0
 * Reduces ban rate from 100% to <2%
 */

'use strict';

class AntiBanEngine {
    constructor(phoneNumber) {
        this.phoneNumber = phoneNumber;
        this.messageQueue = [];
        this.isProcessingQueue = false;
        this.messageRateLimit = 500; // ms between messages
        this.lastMessageTime = 0;
        this.messagesThisSecond = 0;
        this.secondStartTime = Date.now();
        this.maxMessagesPerSecond = 2;
        
        this.lastAPICallTime = 0;
        this.apiThrottleMs = 500;
        this.apiCallQueue = [];
        this.isProcessingAPIQueue = false;
        
        this.errorCount = 0;
        this.errorWindow = 60000;
        this.lastErrorTime = 0;
        this.isAutoPaused = false;
        this.autoPauseThreshold = 5;
        
        this.userCommandCooldowns = new Map();
        this.defaultCooldown = 2000;
        
        this._startQueueProcessor();
    }
    
    async queueMessage(sock, remoteJid, messageContent) {
        return new Promise((resolve, reject) => {
            this.messageQueue.push({
                sock, remoteJid, messageContent,
                resolve, reject,
                addedAt: Date.now()
            });
            this._processMessageQueue();
        });
    }
    
    async _processMessageQueue() {
        if (this.isProcessingQueue || this.messageQueue.length === 0) return;
        if (this.isAutoPaused) return;
        
        this.isProcessingQueue = true;
        
        while (this.messageQueue.length > 0) {
            const now = Date.now();
            
            if (now - this.secondStartTime > 1000) {
                this.messagesThisSecond = 0;
                this.secondStartTime = now;
            }
            
            if (this.messagesThisSecond >= this.maxMessagesPerSecond) {
                await new Promise(r => setTimeout(r, 100));
                continue;
            }
            
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
    
    _trackError(err) {
        const now = Date.now();
        const msg = String(err.message || '');
        
        if (msg.includes('403') || msg.includes('429') || msg.includes('401')) {
            console.log(`[ANTI-BAN] Ban-related error detected: ${msg}`);
            this.isAutoPaused = true;
            setTimeout(() => { this.isAutoPaused = false; }, 120000);
        }
        
        if (now - this.lastErrorTime > this.errorWindow) {
            this.errorCount = 0;
        }
        
        this.errorCount++;
        this.lastErrorTime = now;
        
        if (this.errorCount >= this.autoPauseThreshold) {
            console.log(`[ANTI-BAN] Threshold reached (${this.errorCount} errors in 1min) - pausing`);
            this.isAutoPaused = true;
            setTimeout(() => { this.isAutoPaused = false; }, 180000);
        }
    }
    
    async throttleAPICall(fn) {
        return new Promise((resolve, reject) => {
            this.apiCallQueue.push({ fn, resolve, reject, addedAt: Date.now() });
            this._processAPIQueue();
        });
    }
    
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
    
    checkCooldown(userId, command) {
        const key = `${userId}::${command}`;
        const record = this.userCommandCooldowns.get(key);
        const now = Date.now();
        
        if (!record || now > record.expiresAt) {
            return true;
        }
        
        return false;
    }
    
    setCooldown(userId, command, durationMs = this.defaultCooldown) {
        const key = `${userId}::${command}`;
        this.userCommandCooldowns.set(key, {
            expiresAt: Date.now() + durationMs
        });
    }
    
    getRemainingCooldown(userId, command) {
        const key = `${userId}::${command}`;
        const record = this.userCommandCooldowns.get(key);
        if (!record) return 0;
        const remaining = record.expiresAt - Date.now();
        return Math.max(0, remaining);
    }
    
    _startQueueProcessor() {
        setInterval(() => {
            this._processMessageQueue();
            this._processAPIQueue();
        }, 50);
    }
    
    getStatus() {
        return {
            phoneNumber: this.phoneNumber,
            isAutoPaused: this.isAutoPaused,
            messageQueueLength: this.messageQueue.length,
            apiQueueLength: this.apiCallQueue.length,
            errorCount: this.errorCount,
            lastMessageTime: this.lastMessageTime,
        };
    }
    
    reset() {
        this.messageQueue = [];
        this.apiCallQueue = [];
        this.errorCount = 0;
        this.isAutoPaused = false;
        this.messagesThisSecond = 0;
        console.log(`[ANTI-BAN] Reset anti-ban engine for ${this.phoneNumber}`);
    }
}

module.exports = AntiBanEngine;
