const { makeNsfwCommand } = require('../../lib/nsfwFetch');
module.exports = makeNsfwCommand({
    name: 'fuck',
    aliases: ['sex'],
    endpoint: 'https://apis.prexzyvilla.site/nsfw/fuck',
    emoji: '🔥',
    label: 'Fuck',
});
