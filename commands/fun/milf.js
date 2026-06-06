const { makeAnimeReaction } = require('../../lib/animeReaction');
module.exports = makeAnimeReaction({
    name: 'milf', emoji: '💖', verb: 'sent milf energy to', selfVerb: 'is radiating milf energy',
    title: 'MILF',
    fallbacks: [
        'https://media.tenor.com/EZl5VG7iv9MAAAAC/anime-mom.gif'
    ],
    description: 'Send a milf reaction GIF'
});
