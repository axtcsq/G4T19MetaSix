// The six MetaFor personality types. These are drafts: rename them, rewrite
// them or change their profiles freely. The rest of the quiz reads from here.
//
// `profile` says where each type sits on the quiz axes (see musicMbti.js),
// from -1 to 1, where a positive number leans towards the first pole
// (Amped, Explorer, Wordsmith, Crowd). Axes left out don't matter for the type.
export const PERSONALITY_TYPES = [
  {
    id: "storm-chaser",
    name: "The Storm Chaser",
    tagline: "Loud, restless and always hunting the next big sound.",
    description:
      "You use music like weather you can control: turn it up and let it carry you. New releases, new genres, new artists, you want all of it, and you want it loud.",
    profile: { energy: 1, discovery: 1 },
  },
  {
    id: "tide-keeper",
    name: "The Tide Keeper",
    tagline: "Steady, calm and loyal to the songs that hold you.",
    description:
      "Your favourite songs come back like the tide. You return to the same calm, familiar tracks because they feel like home, and they never let you down.",
    profile: { energy: -1, discovery: -1 },
  },
  {
    id: "poet",
    name: "The Poet",
    tagline: "You hear every word and keep the ones that matter.",
    description:
      "For you a song is a letter. You listen alone, you listen closely, and the lyrics often say what you couldn't put into words yourself.",
    profile: { focus: 1, setting: -1 },
  },
  {
    id: "daydreamer",
    name: "The Daydreamer",
    tagline: "Soft textures, headphones on, somewhere far away.",
    description:
      "You float on sound more than words. Ambient, lo-fi and gentle melodies are your private space to drift, reset and think.",
    profile: { energy: -1, focus: -1, setting: -1 },
  },
  {
    id: "spark",
    name: "The Spark",
    tagline: "Hand you the aux and the room lights up.",
    description:
      "Music is something you share. You know the song that gets everyone singing, and your playlists are made to be passed around.",
    profile: { energy: 1, setting: 1 },
  },
  {
    id: "wanderer",
    name: "The Wanderer",
    tagline: "No home genre, just the next interesting sound.",
    description:
      "You follow a beat or a texture wherever it leads, across languages and genres. Your library reads like a travel diary.",
    profile: { discovery: 1, focus: -1 },
  },
];
