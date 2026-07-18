const { makeNsfwCommand } = require('../../lib/nsfwFetch');
module.exports = makeNsfwCommand({
    name: '69',
    aliases: ['sixtynine'],
    endpoint: 'https://prexzyapis.com/nsfw/sixtynine',
    emoji: '💞',
    label: '69',
});
