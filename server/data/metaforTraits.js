// Shared traits used to combine quiz and listening results.
export const METAFOR_TRAITS = [
  {
    id: "energy",
    label: "Energy",
    poles: {
      A: { name: "Amped", trait: "You reach for music that turns the volume of the day up." },
      M: { name: "Mellow", trait: "You use music to slow things down and settle in." },
    },
  },
  {
    id: "discovery",
    label: "Discovery",
    poles: {
      X: { name: "Explorer", trait: "New sounds excite you, and your library never sits still." },
      L: { name: "Loyalist", trait: "You know what you love and come back to it again and again." },
    },
  },
  {
    id: "focus",
    label: "Focus",
    poles: {
      W: { name: "Wordsmith", trait: "Lyrics are where a song lands for you." },
      S: { name: "Soundscaper", trait: "You feel the beat, texture and melody before the words." },
    },
  },
  {
    id: "setting",
    label: "Setting",
    poles: {
      C: { name: "Crowd", trait: "Music is something you share, whether that is a playlist or a concert." },
      O: { name: "Solo", trait: "Music is your personal space, best enjoyed on your own." },
    },
  },
];
