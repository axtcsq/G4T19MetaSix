import { clamp, shareRow, shares, tallyAnswers, topDimension } from "../../services/quizEngine.js";

// Love on Repeat: the 5 Love Languages, expressed through music. Every
// option maps to exactly one language; the most-picked language is the result.
const LANGUAGES = {
  curation: {
    name: "Acts of Curation",
    meaning: "You show love by building the perfect playlist for someone. Every track order is a message, and you feel cared for when someone takes the time to make one for you.",
    // Curating means always finding new songs.
    traits: { discovery: 1 },
  },
  words: {
    name: "Words of Acoustic Affirmation",
    meaning: "Lyrics say what you can't. You send the exact line, with the timestamp, and a song that puts your feelings into words means more than any gift.",
    traits: { focus: 1 },
  },
  time: {
    name: "Quality Listening Time",
    meaning: "Music is best together: gigs, karaoke, long drives with the windows down. Shared experiences are how you bond.",
    traits: { setting: 1, energy: 0.5 },
  },
  gifts: {
    name: "Gifts of Vinyl",
    meaning: "A record, a ticket, a band tee: you love giving and getting music you can hold. Physical music is a keepsake of a relationship.",
    // Collectors return to the artists they treasure.
    traits: { discovery: -1 },
  },
  presence: {
    name: "Shared Earbud",
    meaning: "For you, closeness is one earbud each on the bus, or a quiet song playing while you sit together. It's not about the song, it's about who you're listening with.",
    traits: { energy: -1, setting: -0.5 },
  },
};

const ORDER = ["curation", "words", "time", "gifts", "presence"];

const options = (texts) =>
  ORDER.map((language, index) => ({ id: language, text: texts[index], scores: { [language]: 1 } }));

export const loveOnRepeat = {
  id: "love-on-repeat",
  title: "Love on Repeat",
  description: "The 5 Love Languages, played through music.",
  // Every result, for the list on the Personality page.
  outcomes: ORDER.map((key) => ({ name: LANGUAGES[key].name, meaning: LANGUAGES[key].meaning })),
  dimensions: ORDER,
  questions: [
    {
      id: "sent-song",
      text: "Someone sends you a song out of the blue. What makes it special?",
      options: options([
        "It's part of a playlist they made just for me",
        "They pointed out the line that reminded them of me",
        "They want to listen to it together later",
        "It came with the vinyl",
        "They played it from their phone, sitting right beside me",
      ]),
    },
    {
      id: "cared-for",
      text: "Which music gesture makes you feel most cared for?",
      options: options([
        "A birthday playlist made for me",
        "A voice note quoting my favourite lyric",
        "Going to a gig together",
        "A signed album",
        "Sharing an earbud on the bus",
      ]),
    },
    {
      id: "thinking-of-them",
      text: "How do you show a friend you're thinking of them?",
      options: options([
        "Make them a mixtape",
        "Send them a lyric with the timestamp",
        "Invite them to a listening night",
        "Buy them merch from their favourite band",
        "Sit with them and put something calm on",
      ]),
    },
    {
      id: "best-memory",
      text: "Your best music memory is...",
      options: options([
        "When someone's playlist was spot on for me",
        "A song someone dedicated to me",
        "A whole night at a gig with friends",
        "Unwrapping a record as a present",
        "Falling asleep sharing headphones",
      ]),
    },
    {
      id: "friend-sad",
      text: "When a friend is sad, you...",
      options: options([
        "Build them a comfort playlist",
        "Send the lyric that got you through something similar",
        "Take them for a drive with music on",
        "Send them an album you know they'll love",
        "Sit with them, one earbud each, no words needed",
      ]),
    },
    {
      id: "relationship",
      text: "The music thing you'd love most in a relationship:",
      options: options([
        "A shared playlist we both keep adding to",
        "Lyrics written in a card",
        "A weekly listening night together",
        "Surprise vinyl on my doorstep",
        "Slow dancing in the kitchen to a quiet song",
      ]),
    },
    {
      id: "group-chat",
      text: "In the group chat, you're the one who...",
      options: options([
        "Drops curated playlists",
        "Quotes lyrics constantly",
        "Organises karaoke nights",
        "Sends merch links as gifts",
        "Starts a listen-along call",
      ]),
    },
    {
      id: "would-hurt",
      text: "Which would hurt the most?",
      options: options([
        "Someone ignoring the playlist I made them",
        "Someone not reading the lyric I sent",
        "Someone cancelling our gig plans",
        "Losing a record someone gave me",
        "Someone taking out the earbud I shared",
      ]),
    },
  ],

  evaluate(answers) {
    const totals = tallyAnswers(this, answers);
    const percents = shares(totals);
    const primary = topDimension(totals, ORDER);
    const secondary = topDimension(
      Object.fromEntries(ORDER.filter((language) => language !== primary).map((language) => [language, totals[language]])),
    );
    const language = LANGUAGES[primary];

    // Weighted by how often each language was picked.
    const traits = {};
    for (const key of ORDER) {
      for (const [trait, value] of Object.entries(LANGUAGES[key].traits)) {
        traits[trait] = (traits[trait] ?? 0) + (value * percents[key]) / 100;
      }
    }
    for (const trait of Object.keys(traits)) traits[trait] = clamp(traits[trait] * 2);

    return {
      resultId: primary,
      title: language.name,
      subtitle: `With a side of ${LANGUAGES[secondary].name}`,
      headline: `Based on the quiz, we think your music love language is ${language.name}.`,
      description: language.meaning,
      justification: [
        `${percents[primary]}% of your answers were about ${language.name.toLowerCase()}.`,
        `Your second language is ${LANGUAGES[secondary].name} (${percents[secondary]}%).`,
      ],
      breakdown: ORDER.map((key) => shareRow(LANGUAGES[key].name, percents[key])),
      traits,
    };
  },
};
