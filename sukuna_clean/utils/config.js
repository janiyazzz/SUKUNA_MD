/**
 * SUKUNA MD - Configuration File
 * Multi-User WhatsApp Bot
 */

module.exports = {
    botName: 'SUKUNA MD',
    version: '3.0.0',
    prefix: '.',

    // ============================================
    // ASSETS
    // Drop your menuvideo.mp4 in the assets/ folder
    // ============================================
    assets: {
        menuVideo: './assets/menuvideo.mp4',
        menuThumb: './assets/menuthumb.jpg'   // optional thumbnail
    },

    // ============================================
    // BOT OWNER INFO
    // ownerNumber → the main owner/admin of the bot
    // pairNumber  → the WhatsApp number that will be paired
    //               automatically when the panel starts.
    // Put the numbers directly here (with country code, no +)
    // or override via OWNER_NUMBER / PAIR_NUMBER env vars.
    // ============================================
    ownerNumber: process.env.OWNER_NUMBER || '2349127857212',
    pairNumber:  process.env.PAIR_NUMBER  || '2349127857212',

    owner: {
        name:    'PASQUA',
        number:  process.env.OWNER_NUMBER || '2349127857212',
        github:  'https://github.com/pasquawisdom2007-beep/Sukuna-MD-V3',
        channel: 'https://whatsapp.com/channel/0029VbCJho147XeEEuR1LA3s'
    },


    // ============================================
    // SESSION SETTINGS
    // ============================================
    sessions: {
        folder: './sessions/',
        autoReconnect: true
    },

    // ============================================
    // GROUP SETTINGS DEFAULTS
    // ============================================
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

    // ============================================
    // API KEYS (optional, for extra commands)
    // ============================================
    apiKeys: {
        openai: process.env.OPENAI_API_KEY || '',
        weather: process.env.WEATHER_API_KEY || ''
    },

    // ============================================
    // BOT MESSAGES
    // ============================================
    messages: {
        wait: '⏳ Processing...',
        success: '✅ Success!',
        error: '❌ Error occurred!',
        adminOnly: '🛡️ This command is only for admins!',
        groupOnly: '👥 This command can only be used in groups!',
        botAdminNeeded: '🤖 Bot needs to be admin to execute this command!'
    }
};
