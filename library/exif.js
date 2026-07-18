const { WebPMux } = require('node-webpmux');

/**
 * Add EXIF metadata to WebP sticker
 * @param {Buffer} buffer - WebP buffer
 * @param {string} packName - Sticker pack name
 * @param {string} author - Pack author
 * @param {string[]} tags - Sticker tags/emojis
 * @returns {Promise<Buffer>} - Modified WebP with metadata
 */
async function addExif(buffer, packName = 'SUKUNA MD', author = 'sukuna', tags = ['🔥']) {
    try {
        const img = new WebPMux.Image();
        await img.initLib();
        
        img.loadBuffer(buffer);

        const exifJson = {
            "sticker-pack-id": "com.sukuna.sticker",
            "sticker-pack-name": packName,
            "sticker-pack-author": author,
            "sticker-pack-author-email": "",
            "sticker-pack-publisher": author,
            "sticker-pack-publisher-email": "",
            "sticker-pack-license": "",
            "sticker-pack-license-agreement": "",
            "sticker-pack-privacy-policy": "",
            "sticker-pack-user-privacy-policy": "",
            "sticker-pack-category": "",
            "animatedSticker": false,
            "trayImageFileName": "",
            "publisherContactEmail": "",
            "publisherWebsite": "",
            "androidAppDownloadLink": "",
            "iosAppDownloadLink": ""
        };

        const exifBuffer = Buffer.from(JSON.stringify(exifJson));
        img.setExif(exifBuffer);

        return img.saveBuffer();
    } catch (err) {
        console.error('[EXIF ERROR]', err.message);
        // Return original buffer if exif fails
        return buffer;
    }
}

module.exports = { addExif };
