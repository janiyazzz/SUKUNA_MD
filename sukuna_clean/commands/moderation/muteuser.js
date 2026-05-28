const database = require('../../utils/database');
function parseTime(t){if(!t)return null;const m=t.match(/^(\d+)([smhd])$/i);if(!m)return null;const v=parseInt(m[1]),u=m[2].toLowerCase(),x={'s':1000,'m':60000,'h':3600000,'d':86400000};return v*x[u];}
function formatTime(ms){const s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60),d=Math.floor(h/24);if(d>0)return`${d}d ${h%24}h`;if(h>0)return`${h}h ${m%60}m`;if(m>0)return`${m}m ${s%60}s`;return`${s}s`;}
module.exports={name:'muteuser',aliases:['mute','usermute'],description:'Mute a specific user in the group',category:'moderation',
async execute({ sock,msg,from,reply,args,isGroup, isAdmin }){
if(!isGroup)return reply('👥 This command can only be used in groups!');
        // ── Admin Gate — only group admins can use this command ──
        if (!isAdmin) {
            return reply('🛡️ *Admin Only!*\n\n❌ You must be a group admin to use this command.');
        }

try{
const mentioned=msg.message?.extendedTextMessage?.contextInfo?.mentionedJid||[];
const quotedParticipant=msg.message?.extendedTextMessage?.contextInfo?.participant;
let targetUser=mentioned[0]||quotedParticipant;
let timeArg=args[0];
if(!targetUser&&args.length>=2){const input=args[0].replace(/[^0-9]/g,'');if(input){targetUser=input+'@s.whatsapp.net';timeArg=args[1];}}
if(!targetUser)return reply('🔇 *Mute User*\n\nReply to a user or mention them.\n\n*Usage:*\n• .muteuser 10m (reply)\n• .muteuser @user 1h\n\n*Time:* 10s · 5m · 2h · 1d');
if(!timeArg)return reply('❌ Please specify a duration! Example: .muteuser 10m');
const duration=parseTime(timeArg);
if(!duration)return reply('❌ Invalid time format! Use: 10s, 5m, 2h, or 1d');
if(duration>7*86400000)return reply('❌ Maximum mute duration is 7 days!');
const expiresAt=Date.now()+duration;
database.setMutedUser(from,targetUser,expiresAt);
const num=targetUser.split('@')[0];
reply(`🔇 *User Muted*\n\n👤 User: @${num}\n⏱️ Duration: ${formatTime(duration)}\n🔓 Expires: ${new Date(expiresAt).toLocaleString()}\n\nTheir messages will be auto-deleted until mute expires.`,{mentions:[targetUser]});
}catch(err){console.error('[MuteUser]',err);reply('❌ An error occurred while muting the user.');}
}};
