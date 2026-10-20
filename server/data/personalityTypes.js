// The six MetaFor personality types. These are drafts: rename them, rewrite
// them or change their profiles freely. The rest of the quiz reads from here.
//
// `description` is shown on the Patterns card as what the type means.
// `closing` is the line under the Patterns section, a send-off for that type.
// `profile` says where each type sits on the MetaFor traits (metaforTraits.js),
// from -1 to 1, where a positive number leans towards the first pole
// (Amped, Explorer, Wordsmith, Crowd). Traits left out don't matter for the type.
export const PERSONALITY_TYPES = [
  {
    id: "storm-chaser",
    name: "The Storm Chaser",
    tagline: "Loud, restless and always hunting the next big sound.",
    description:
      "You use music like weather you can control: turn it up and let it carry you. New releases, new genres, new artists, you want all of it, and you want it loud. Music is how you burn off a bad day and how you celebrate a good one. You're happiest mid-chorus with the volume a little too high, already wondering what you'll discover next.",
    closing:
      "Keep chasing the noise. Somewhere out there is a song you haven't heard yet that's about to become your new favourite.",
    profile: { energy: 1, discovery: 1 },
  },
  {
    id: "tide-keeper",
    name: "The Tide Keeper",
    tagline: "Steady, calm and loyal to the songs that hold you.",
    description:
      "Your favourite songs come back like the tide. You return to the same calm, familiar tracks because they feel like home, and they never let you down. Music is how you steady yourself: a comfort album after a long day, the same playlist on every commute. You don't need something new to feel something deep, and the songs you love carry years of memories.",
    closing:
      "Your comfort songs are a safe harbour. Keep them close, they'll still be there for you after the next long day.",
    profile: { energy: -1, discovery: -1 },
  },
  {
    id: "poet",
    name: "The Poet",
    tagline: "You hear every word and keep the ones that matter.",
    description:
      "For you a song is a letter. You listen alone, you listen closely, and the lyrics often say what you couldn't put into words yourself. You remember the exact line that described your week and send it to the one person who'll get it. Music is how you make sense of what you feel, and your favourite songs read like pages from your diary.",
    closing:
      "Keep collecting the lines that find you. One day a lyric you saved will say exactly what someone else needs to hear.",
    profile: { focus: 1, setting: -1 },
  },
  {
    id: "daydreamer",
    name: "The Daydreamer",
    tagline: "Soft textures, headphones on, somewhere far away.",
    description:
      "You float on sound more than words. Ambient, lo-fi and gentle melodies are your private space to drift, reset and think. Headphones on is your way of closing the door for a while, and you come back calmer. You notice textures and moods that other people miss, and your playlists feel like places rather than lists.",
    closing:
      "Put the headphones on and drift for a while. The quiet places you build out of sound are where you find your way back to yourself.",
    profile: { energy: -1, focus: -1, setting: -1 },
  },
  {
    id: "spark",
    name: "The Spark",
    tagline: "Hand you the aux and the room lights up.",
    description:
      "Music is something you share. You know the song that gets everyone singing, and your playlists are made to be passed around. You light up when a room comes alive to something you picked, and you remember which song each friend loves. For you, the best music moments happen together: in the car, at a gig or on a crowded dance floor.",
    closing:
      "Keep the aux close and the playlist ready. Somebody's night is about to get better because of a song you picked.",
    profile: { energy: 1, setting: 1 },
  },
  {
    id: "wanderer",
    name: "The Wanderer",
    tagline: "No home genre, just the next interesting sound.",
    description:
      "You follow a beat or a texture wherever it leads, across languages and genres. Your library reads like a travel diary. You're the friend who knows an artist nobody else has heard of yet, and you love the feeling of a sound you can't quite name. Music is how you explore, and there's always another stop on the map.",
    closing:
      "There's always another stop on the map. Follow the next strange sound and see where it takes you.",
    profile: { discovery: 1, focus: -1 },
  },
];
