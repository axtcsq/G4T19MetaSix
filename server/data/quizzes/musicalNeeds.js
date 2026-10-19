import { clamp, shareRow, shares, tallyAnswers, topDimension } from "../../services/quizEngine.js";

// Maslow’s Mixtape: Maslow's hierarchy of needs for where music sits in
// the user's life. Answers and the user's Spotify playlist names both add
// points to a level; the level with the most points is the result.
const LEVELS = {
  utility: {
    name: "Physiological: Music as Fuel",
    short: "Fuel",
    meaning: "Music keeps your body and brain running. It's the beat behind workouts, study sessions and commutes, and without it your productivity would crash.",
    keywords: ["workout", "gym", "run", "study", "focus", "work", "commute", "white noise", "rain sounds"],
    traits: { focus: -1, energy: 0.5 },
  },
  safety: {
    name: "Safety: Music as Shelter",
    short: "Shelter",
    meaning: "Music is your safe place. Familiar songs calm you down, help you sleep and make a hard day feel smaller.",
    keywords: ["sleep", "calm", "comfort", "chill", "relax", "cozy", "wind down"],
    traits: { energy: -1, discovery: -0.5 },
  },
  belonging: {
    name: "Belonging: Music as Connection",
    short: "Connection",
    meaning: "Music is how you connect. Shared playlists, gigs and car singalongs are how you bond with people, and losing music would mean losing a way to be together.",
    keywords: ["party", "friends", "road trip", "jam", "karaoke", "pregame", "squad", "blend"],
    traits: { setting: 1 },
  },
  esteem: {
    name: "Esteem: Music as Identity",
    short: "Identity",
    meaning: "Music is part of how you show the world who you are. Your taste is curated, your Wrapped gets posted, and the artists you love say something about you.",
    keywords: ["aesthetic", "main character", "my top", "taste", "vibes", "favourites", "favorites"],
    traits: { discovery: 0.5, setting: 0.5 },
  },
  selfActualisation: {
    name: "Self-actualisation: Music as Self",
    short: "Self",
    meaning: "Music is how you understand yourself. You listen to whole albums, feel every lyric and come out the other side a little different.",
    keywords: ["album", "feels", "journal", "reflect", "late night", "deep", "soul", "healing"],
    traits: { focus: 1, setting: -0.5 },
  },
};

const ORDER = ["utility", "safety", "belonging", "esteem", "selfActualisation"];

const options = (texts) =>
  ORDER.map((level, index) => ({ id: level, text: texts[index], scores: { [level]: 1 } }));

function classifyPlaylists(profile) {
  const matches = [];

  for (const playlist of profile.playlists ?? []) {
    const name = playlist.name.toLowerCase();
    const level = ORDER.find((key) => LEVELS[key].keywords.some((keyword) => name.includes(keyword)));
    if (level) matches.push({ name: playlist.name, level });
  }

  return matches;
}

export const musicalNeeds = {
  id: "musical-needs",
  title: "Maslow’s Mixtape",
  description: "From survival fuel to self-discovery: where does music sit in your life?",
  dimensions: ORDER,
  questions: [
    {
      id: "lose-music",
      text: "If you lost music for a week, what would suffer most?",
      options: options([
        "My productivity, I can't focus or work out without it",
        "My calm, music is my safe place",
        "My friendships, we bond over music",
        "My style, music is part of how I present myself",
        "My sense of self, music is how I understand who I am",
      ]),
    },
    {
      id: "when",
      text: "Most of your listening happens...",
      options: options([
        "While working out, studying or commuting",
        "While winding down or falling asleep",
        "With friends or at events",
        "While choosing what to post or share",
        "With a full album and nothing else going on",
      ]),
    },
    {
      id: "cant-live-without",
      text: "The playlist you couldn't live without:",
      options: options([
        "My focus or gym playlist",
        "My comfort songs",
        "The group's shared playlist",
        "The one that shows off my taste",
        "The one that feels like my life story",
      ]),
    },
    {
      id: "replay",
      text: "Why do you replay a song?",
      options: options([
        "It keeps my pace",
        "It feels safe and familiar",
        "It reminds me of people I love",
        "It's my song, it represents me",
        "It reveals something new every time",
      ]),
    },
    {
      id: "wrapped",
      text: "Your Spotify Wrapped makes you feel...",
      options: options([
        "Indifferent, it's just background noise",
        "Comforted by my old favourites",
        "Excited to compare with friends",
        "Proud, I post it straight away",
        "Reflective about my whole year",
      ]),
    },
    {
      id: "live",
      text: "Live music means...",
      options: options([
        "A fun way to burn energy",
        "Somewhere I know every song",
        "Being part of the crowd",
        "Being seen at the right shows",
        "An almost spiritual experience",
      ]),
    },
    {
      id: "headphones",
      text: "When choosing headphones, you care most about...",
      options: options([
        "Staying put during workouts",
        "Noise cancelling, my own bubble",
        "Easy sharing or a good speaker for the group",
        "How they look",
        "Sound quality, every detail",
      ]),
    },
  ],

  evaluate(answers, profile) {
    const totals = tallyAnswers(this, answers);
    const playlists = classifyPlaylists(profile);
    for (const playlist of playlists) totals[playlist.level] += 1;

    const percents = shares(totals);
    const top = topDimension(totals, ORDER);
    const level = LEVELS[top];

    const traits = {};
    for (const key of ORDER) {
      for (const [trait, value] of Object.entries(LEVELS[key].traits)) {
        traits[trait] = (traits[trait] ?? 0) + (value * percents[key]) / 100;
      }
    }
    for (const trait of Object.keys(traits)) traits[trait] = clamp(traits[trait] * 2);

    const fromPlaylists = playlists.filter((playlist) => playlist.level === top).map((playlist) => `"${playlist.name}"`);

    return {
      resultId: top,
      title: level.name,
      subtitle: `Level ${ORDER.indexOf(top) + 1} of 5`,
      headline: `Based on the quiz, music sits at the ${level.short} level of your Maslow’s Mixtape.`,
      description: level.meaning,
      justification: [
        `${percents[top]}% of your answers and playlists point to music as ${level.short.toLowerCase()}.`,
        fromPlaylists.length
          ? `Your playlists back this up: ${fromPlaylists.join(", ")}.`
          : `We looked at ${playlists.length} of your playlists, and your answers carried this result.`,
      ],
      // Listed from the top of the pyramid down.
      breakdown: [...ORDER].reverse().map((key) => shareRow(LEVELS[key].short, percents[key])),
      traits,
    };
  },
};
