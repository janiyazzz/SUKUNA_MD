/**
 * Edit Image Command (GPT Vision / image-edit endpoints)
 * Usage: .editimage <prompt>  (reply to an image or static sticker)
 *
 * Fixed:
 *  - Uses @crysnovax/baileys (the fork this bot actually installs).
 *    The previous require('@whiskeysockets/baileys') threw at load time,
 *    so the commandLoader skipped this file → the command was invisible
 *    in .menu and never responded.
 *  - Uses the project's standard destructured handler signature
 *    ({ sock, msg, args, from, reply, prefix }) instead of positional
 *    (sock, msg, args, extra) which silently broke the call.
 *
 * Drop this file at: commands/ai/editimage.js
 */

const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@crysnovax/baileys');
const sharp = require('sharp');

// Optional sticker -> png helper (only required if reply is a sticker)
let webp2png = null;
try {
  ({ webp2png } = require('../../utils/webp2mp4'));
} catch (_) {
  // utility missing — sticker conversion will fall back to sharp
}

module.exports = {
  name: 'editimage',
  aliases: ['gptimage', 'gptimg', 'aiimage', 'vision', 'gi', 'ei'],
  category: 'ai',
  description: 'Edit an image using GPT Vision with a text prompt',
  usage: '.editimage <prompt> (reply to image/sticker)',

  async execute({ sock, msg, args, from, reply, prefix }) {
    const px = prefix || '.';
    try {
      const ctxInfo = msg.message?.extendedTextMessage?.contextInfo;
      if (!ctxInfo?.quotedMessage) {
        return await reply(
          '📷 *Edit Image (GPT Vision)*\n\n' +
          'Reply to an *image* or *sticker* with a prompt to edit it.\n\n' +
          `Usage: ${px}editimage <your prompt>\n\n` +
          `Example: ${px}editimage change the background to a beach`
        );
      }

      const prompt = (args || []).join(' ').trim();
      if (!prompt) {
        return await reply(
          '❌ Please provide a prompt!\n\n' +
          `Usage: ${px}editimage <your prompt>\n\n` +
          'Example: change the background to a beach'
        );
      }

      const targetMessage = {
        key: {
          remoteJid: from,
          id: ctxInfo.stanzaId,
          participant: ctxInfo.participant,
        },
        message: ctxInfo.quotedMessage,
      };

      const quotedMsg = ctxInfo.quotedMessage;
      const isImage = !!quotedMsg.imageMessage;
      const isSticker = !!quotedMsg.stickerMessage;

      if (!isImage && !isSticker) {
        return await reply('❌ Please reply to an *image* or *sticker*!');
      }

      await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } }).catch(() => {});

      const mediaBuffer = await downloadMediaMessage(
        targetMessage,
        'buffer',
        {},
        { logger: undefined, reuploadRequest: sock.updateMediaMessage }
      );

      if (!mediaBuffer) {
        return await reply('❌ Failed to download image. Please try again.');
      }

      // Sticker -> PNG
      let imageBuffer = mediaBuffer;
      if (isSticker) {
        const stickerMessage = quotedMsg.stickerMessage;
        const isAnimated = stickerMessage.isAnimated || stickerMessage.mimetype?.includes('animated');
        if (isAnimated) {
          return await reply('❌ Animated stickers are not supported. Use a static image or sticker.');
        }
        try {
          if (webp2png) {
            imageBuffer = await webp2png(mediaBuffer);
          } else {
            imageBuffer = await sharp(mediaBuffer).png().toBuffer();
          }
        } catch (err) {
          console.error('Error converting sticker to PNG:', err);
          return await reply('❌ Failed to convert sticker. Please try a regular image.');
        }
      }

      // Normalize to JPEG
      let finalImageBuffer = imageBuffer;
      try {
        const metadata = await sharp(imageBuffer).metadata();
        if (metadata.format !== 'jpeg' && metadata.format !== 'jpg') {
          finalImageBuffer = await sharp(imageBuffer).jpeg({ quality: 90 }).toBuffer();
        }
      } catch (err) {
        console.error('sharp processing error:', err.message);
        // Continue with original buffer; the endpoint may still accept it.
      }

      const endpoints = [
        'https://api.siputzx.my.id/api/ai/gpt-image',
        'https://api.nyxs.pw/ai/gpt-image',
      ];

      let resultImageBuffer = null;
      let lastError = null;

      for (const apiUrl of endpoints) {
        try {
          const form = new FormData();
          form.append('image', finalImageBuffer, {
            filename: 'image.jpg',
            contentType: 'image/jpeg',
          });
          form.append('param', prompt);
          form.append('prompt', prompt);

          const response = await axios.post(apiUrl, form, {
            headers: {
              ...form.getHeaders(),
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            responseType: 'arraybuffer',
            timeout: 120000,
            maxContentLength: 10 * 1024 * 1024,
          });

          if (response.data && response.data.length > 0) {
            resultImageBuffer = Buffer.from(response.data);
            break;
          }
        } catch (err) {
          lastError = err;
          console.error(`editimage endpoint failed (${apiUrl}):`, err.message);
        }
      }

      if (!resultImageBuffer || resultImageBuffer.length === 0) {
        const errMsg = lastError?.message || 'No image returned from any provider';
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await reply(`❌ All image providers failed.\nReason: ${errMsg}`);
      }

      const maxImageSize = 5 * 1024 * 1024;
      if (resultImageBuffer.length > maxImageSize) {
        return await reply(
          `❌ Image too large: ${(resultImageBuffer.length / 1024 / 1024).toFixed(2)}MB (max 5MB)`
        );
      }

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        {
          image: resultImageBuffer,
          caption: `✨ *Edit Image Result*\n\n📝 Prompt: ${prompt}`,
        },
        { quoted: msg }
      );
    } catch (error) {
      console.error('Error in editimage command:', error);

      if (error.response) {
        const status = error.response.status;
        if (status === 400) return await reply('❌ Bad Request: invalid parameters.');
        if (status === 429) return await reply('❌ Rate limit exceeded. Try again later.');
        if (status === 500) return await reply('❌ Provider server error. Try again later.');
      }
      if (error.code === 'ECONNABORTED') {
        return await reply('❌ Request timeout. Image processing took too long.');
      }
      return await reply(`❌ Error: ${error.message || 'Unknown error occurred'}`);
    }
  },
};
