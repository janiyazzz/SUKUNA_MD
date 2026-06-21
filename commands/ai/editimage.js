/**
 * Edit Image Command
 * Usage: .editimage <prompt>  (reply to an image or static sticker)
 *
 * Providers (first success wins):
 *  1. Pollinations.ai "kontext" img2img — free, no API key, ACTUALLY edits
 *     the exact image you reply to (not a fresh generation).
 *  2. Pollinations.ai text2img          — fallback, ignores the source image
 *  3. prexzyvilla DALL·E                — fallback
 *  4. prexzyvilla Realistic              — fallback
 *
 * Why the old version "edited" by generating a brand new image:
 *  Pollinations' image.pollinations.ai/prompt/{prompt} endpoint is a GET
 *  that only reads query params — it has no way to receive an uploaded
 *  file body. The old code POSTed the image as multipart form-data to that
 *  URL, which silently ignored the file and just generated fresh art from
 *  the prompt. Real img2img on Pollinations needs `model=kontext` plus an
 *  `image=<public URL>` query param — it cannot accept a raw file upload.
 *
 * Fix: we anonymously upload the source image to Litterbox (catbox.moe's
 * temp-hosting API, 1-hour auto-expiry, no key needed) to get a public
 * URL, then call kontext with that exact URL so the model conditions on
 * the real image instead of inventing a new one.
 */

const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@crysnovax/baileys');
const sharp = require('sharp');
const { extractBestUrl } = require('../../lib/mediaFetch');

// Optional sticker -> png helper
let webp2png = null;
try {
  ({ webp2png } = require('../../utils/webp2mp4'));
} catch (_) {}

// ─── Step 0: anonymous temp upload (so Pollinations can fetch the image) ─────
async function uploadToLitterbox(imageBuffer, filename = 'image.jpg') {
  try {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('time', '1h'); // shortest TTL — plenty for one edit request
    form.append('fileToUpload', imageBuffer, { filename });

    const { data } = await axios.post(
      'https://litterbox.catbox.moe/resources/internals/api.php',
      form,
      { headers: form.getHeaders(), timeout: 30000 }
    );

    const url = String(data || '').trim();
    if (!url.startsWith('http')) return null;
    return url;
  } catch (err) {
    console.error('[editimage] Litterbox upload failed:', err.message);
    return null;
  }
}

// ─── Provider 0: prexzyvilla img2img — PRIMARY, real img2img via prompt ────
// Edits the exact source image (via its temp public URL) according to the
// prompt, using the dedicated img2img endpoint.
async function tryPrexzyvillaImg2Img(imageBuffer, prompt) {
  try {
    const imageUrl = await uploadToLitterbox(imageBuffer);
    if (!imageUrl) return null;

    const { data } = await axios.get('https://apis.prexzyvilla.site/ai/img2img', {
      params: {
        imageUrl,
        prompt,
        aspectRatio: '1:1',
        numOutputs: 1,
        resolution: '1024',
      },
      timeout: 120000,
    });

    const best = extractBestUrl(data);
    if (!best?.url) return null;

    const res = await axios.get(best.url, { responseType: 'arraybuffer', timeout: 60000 });
    const buf = Buffer.from(res.data);
    if (!buf || buf.length < 1024) return null;
    return buf;
  } catch (err) {
    console.error('[editimage] prexzyvilla img2img failed:', err.message);
    return null;
  }
}

// ─── Provider 1: Pollinations "kontext" img2img — FALLBACK ──────────────────
// Edits the exact source image (via its temp public URL) according to the
// prompt, instead of generating an unrelated new image from text alone.
async function tryPollinationsImg2Img(imageBuffer, prompt) {
  try {
    const imageUrl = await uploadToLitterbox(imageBuffer);
    if (!imageUrl) return null;

    const response = await axios.get(
      'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt),
      {
        params: {
          model: 'kontext',     // required for image-to-image
          image: imageUrl,      // the exact image being edited
          width: 1024,
          height: 1024,
          nologo: true,
          seed: Math.floor(Math.random() * 999999),
        },
        responseType: 'arraybuffer',
        timeout: 120000, // kontext edits run slower than pure text2img
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      }
    );

    if (response.data && response.data.byteLength > 1024) {
      return Buffer.from(response.data);
    }
    return null;
  } catch (err) {
    console.error('[editimage] Pollinations kontext img2img failed:', err.message);
    return null;
  }
}

// ─── Provider 2: Pollinations text2img (FALLBACK — ignores source image) ────
// Only used if kontext img2img fails (e.g. Litterbox upload down). Generates
// fresh art from the prompt text alone — not a real edit of the original.
async function tryPollinationsText2Img(prompt) {
  try {
    const enhancedPrompt = `${prompt}, high quality, detailed, 4k`;
    const response = await axios.get(
      'https://image.pollinations.ai/prompt/' + encodeURIComponent(enhancedPrompt),
      {
        params: {
          model: 'flux',
          width: 1024,
          height: 1024,
          nologo: true,
          enhance: true,
          seed: Math.floor(Math.random() * 999999),
        },
        responseType: 'arraybuffer',
        timeout: 90000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      }
    );

    if (response.data && response.data.byteLength > 1024) {
      return Buffer.from(response.data);
    }
    return null;
  } catch (err) {
    console.error('[editimage] Pollinations text2img failed:', err.message);
    return null;
  }
}

// ─── Provider 3: prexzyvilla DALL·E ──────────────────────────────────────────
async function tryDalle(prompt) {
  try {
    const { data } = await axios.get('https://apis.prexzyvilla.site/ai/dalle', {
      params: { prompt },
      timeout: 60000,
    });
    if (!data || data.status !== true) return null;

    const arr = data.image_url || data.images || data.result;
    let url = null;
    if (Array.isArray(arr) && arr.length) {
      const first = arr[0];
      url = first?.image?.url || first?.url || (typeof first === 'string' ? first : null);
    }
    url = url ||
      (typeof data.result === 'string' ? data.result : null) ||
      (typeof data.url === 'string' ? data.url : null);
    if (!url) return null;

    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
    const buf = Buffer.from(res.data);
    if (!buf || buf.length < 1024) return null;
    return buf;
  } catch (err) {
    console.error('[editimage] DALL·E fallback failed:', err.message);
    return null;
  }
}

// ─── Provider 4: prexzyvilla Realistic ───────────────────────────────────────
async function tryRealistic(prompt) {
  try {
    const { data } = await axios.get('https://apis.prexzyvilla.site/ai/realistic', {
      params: { prompt },
      timeout: 60000,
    });
    if (!data || data.status !== true) return null;

    const arr = data.image_url || data.images || data.result;
    let url = null;
    if (Array.isArray(arr) && arr.length) {
      const first = arr[0];
      url = first?.image?.url || first?.url || (typeof first === 'string' ? first : null);
    }
    url = url ||
      (typeof data.result === 'string' ? data.result : null) ||
      (typeof data.url === 'string' ? data.url : null);
    if (!url) return null;

    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
    const buf = Buffer.from(res.data);
    if (!buf || buf.length < 1024) return null;
    return buf;
  } catch (err) {
    console.error('[editimage] Realistic fallback failed:', err.message);
    return null;
  }
}

// ─── Main Command ─────────────────────────────────────────────────────────────
module.exports = {
  name: 'editimage',
  aliases: ['gptimage', 'gptimg', 'aiimage', 'vision', 'gi', 'ei'],
  category: 'ai',
  description: 'Edit an image using AI with a text prompt',
  usage: '.editimage <prompt> (reply to image/sticker)',

  async execute({ sock, msg, args, from, reply, prefix }) {
    const px = prefix || '.';
    try {
      const ctxInfo = msg.message?.extendedTextMessage?.contextInfo;
      if (!ctxInfo?.quotedMessage) {
        return await reply(
          '📷 *Edit Image (AI)*\n\n' +
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

      const quotedMsg = ctxInfo.quotedMessage;
      const isImage = !!quotedMsg.imageMessage;
      const isSticker = !!quotedMsg.stickerMessage;

      if (!isImage && !isSticker) {
        return await reply('❌ Please reply to an *image* or *sticker*!');
      }

      await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } }).catch(() => {});

      // Download media
      const targetMessage = {
        key: {
          remoteJid: from,
          id: ctxInfo.stanzaId,
          participant: ctxInfo.participant,
        },
        message: ctxInfo.quotedMessage,
      };

      const mediaBuffer = await downloadMediaMessage(
        targetMessage,
        'buffer',
        {},
        { logger: undefined, reuploadRequest: sock.updateMediaMessage }
      );

      if (!mediaBuffer) {
        return await reply('❌ Failed to download image. Please try again.');
      }

      // Convert sticker to PNG if needed
      let imageBuffer = mediaBuffer;
      if (isSticker) {
        const isAnimated =
          quotedMsg.stickerMessage?.isAnimated ||
          quotedMsg.stickerMessage?.mimetype?.includes('animated');
        if (isAnimated) {
          return await reply('❌ Animated stickers are not supported. Use a static image or sticker.');
        }
        try {
          imageBuffer = webp2png
            ? await webp2png(mediaBuffer)
            : await sharp(mediaBuffer).png().toBuffer();
        } catch (err) {
          console.error('Sticker to PNG conversion failed:', err);
          return await reply('❌ Failed to convert sticker. Please try a regular image.');
        }
      }

      // Normalize to JPEG
      let finalImageBuffer = imageBuffer;
      try {
        const meta = await sharp(imageBuffer).metadata();
        if (meta.format !== 'jpeg' && meta.format !== 'jpg') {
          finalImageBuffer = await sharp(imageBuffer).jpeg({ quality: 90 }).toBuffer();
        }
      } catch (err) {
        console.error('sharp processing error:', err.message);
        // Continue with original buffer
      }

      // Try providers in order — kontext (real img2img) first, then fallbacks
      // that do NOT use the source image, in case kontext is unavailable.
      let resultBuffer = null;
      let providerUsed = '';
      let editedActualImage = false;

      resultBuffer = await tryPrexzyvillaImg2Img(finalImageBuffer, prompt);
      if (resultBuffer) {
        providerUsed = 'prexzyvilla img2img';
        editedActualImage = true;
      }

      if (!resultBuffer) {
        resultBuffer = await tryPollinationsImg2Img(finalImageBuffer, prompt);
        if (resultBuffer) {
          providerUsed = 'Pollinations (Kontext img2img)';
          editedActualImage = true;
        }
      }

      if (!resultBuffer) {
        resultBuffer = await tryPollinationsText2Img(prompt);
        if (resultBuffer) providerUsed = 'Pollinations (text2img fallback)';
      }

      if (!resultBuffer) {
        resultBuffer = await tryDalle(prompt);
        if (resultBuffer) providerUsed = 'DALL·E (fallback)';
      }

      if (!resultBuffer) {
        resultBuffer = await tryRealistic(prompt);
        if (resultBuffer) providerUsed = 'Realistic AI (fallback)';
      }

      if (!resultBuffer || resultBuffer.length === 0) {
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await reply(
          '❌ All image providers are currently unavailable.\n' +
          'Please try again in a few moments.'
        );
      }

      // Size guard
      const maxSize = 5 * 1024 * 1024;
      if (resultBuffer.length > maxSize) {
        try {
          resultBuffer = await sharp(resultBuffer).jpeg({ quality: 70 }).toBuffer();
        } catch (_) {}
        if (resultBuffer.length > maxSize) {
          return await reply(
            `❌ Result image is too large (${(resultBuffer.length / 1024 / 1024).toFixed(2)} MB). Try a different image.`
          );
        }
      }

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        {
          image: resultBuffer,
          caption:
            `✨ *Edit Image Result*\n\n` +
            `📝 Prompt: ${prompt}\n` +
            `🤖 Provider: ${providerUsed}\n` +
            (editedActualImage
              ? `✅ Edited your exact image\n\n`
              : `⚠️ Fallback used — this is a *new* image, not an edit of yours (kontext was unavailable)\n\n`) +
            `> Powered by SUKUNA MD`,
        },
        { quoted: msg }
      );
    } catch (error) {
      console.error('Error in editimage command:', error);
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return await reply('❌ Request timed out. Please try again.');
      }
      return await reply(`❌ Error: ${error.message || 'Unknown error occurred'}`);
    }
  },
};
