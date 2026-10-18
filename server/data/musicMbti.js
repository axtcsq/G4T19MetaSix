// Music MBTI: four axes, each with two poles. The quiz scores the user on each
// axis, and those scores decide which personality type (personalityTypes.js)
// fits them best.
export const AXES = [
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

// Every option points at one pole of its question's axis. Weight 2 is a strong
// lean, weight 1 a mild one.
export const STATIC_QUESTIONS = [
  {
    id: "energy-1",
    axis: "energy",
    text: "It's Friday evening after a long week. What are you queueing up?",
    options: [
      { id: "a", text: "Something loud enough to shake off the week", pole: "A", weight: 2 },
      { id: "b", text: "An upbeat playlist to get ready to go out", pole: "A", weight: 1 },
      { id: "c", text: "Something chill to unwind with", pole: "M", weight: 1 },
      { id: "d", text: "Soft acoustic songs and a cup of tea", pole: "M", weight: 2 },
    ],
  },
  {
    id: "energy-2",
    axis: "energy",
    text: "Pick the soundtrack for your morning commute.",
    options: [
      { id: "a", text: "High-tempo pop or EDM", pole: "A", weight: 2 },
      { id: "b", text: "Mid-tempo indie that builds", pole: "A", weight: 1 },
      { id: "c", text: "Lo-fi beats", pole: "M", weight: 1 },
      { id: "d", text: "Ambient or classical", pole: "M", weight: 2 },
    ],
  },
  {
    id: "energy-3",
    axis: "energy",
    text: "When you're stressed, music helps you most by...",
    options: [
      { id: "a", text: "Letting you scream along and release it", pole: "A", weight: 2 },
      { id: "b", text: "Giving you a burst of motivation", pole: "A", weight: 1 },
      { id: "c", text: "Calming your thoughts down", pole: "M", weight: 2 },
      { id: "d", text: "Keeping you company quietly", pole: "M", weight: 1 },
    ],
  },
  {
    id: "discovery-1",
    axis: "discovery",
    text: "Spotify drops your Discover Weekly. You...",
    options: [
      { id: "a", text: "Listen to every track the same day", pole: "X", weight: 2 },
      { id: "b", text: "Skim it and save a couple", pole: "X", weight: 1 },
      { id: "c", text: "Forget about it most weeks", pole: "L", weight: 1 },
      { id: "d", text: "Never open it, your favourites are enough", pole: "L", weight: 2 },
    ],
  },
  {
    id: "discovery-2",
    axis: "discovery",
    text: "How many times can you replay a song you love?",
    options: [
      { id: "a", text: "A few times, then I move on", pole: "X", weight: 2 },
      { id: "b", text: "A week or two of heavy rotation", pole: "X", weight: 1 },
      { id: "c", text: "Months, honestly", pole: "L", weight: 1 },
      { id: "d", text: "Some songs have been on repeat for years", pole: "L", weight: 2 },
    ],
  },
  {
    id: "discovery-3",
    axis: "discovery",
    text: "A friend recommends a genre you've never tried.",
    options: [
      { id: "a", text: "Dive straight into a deep-cut playlist", pole: "X", weight: 2 },
      { id: "b", text: "Give their top pick a listen", pole: "X", weight: 1 },
      { id: "c", text: "Say you'll check it out later", pole: "L", weight: 1 },
      { id: "d", text: "Politely stick to what you know", pole: "L", weight: 2 },
    ],
  },
  {
    id: "focus-1",
    axis: "focus",
    text: "What makes a song stick in your head?",
    options: [
      { id: "a", text: "A line that hits a little too close to home", pole: "W", weight: 2 },
      { id: "b", text: "A chorus you can sing along to", pole: "W", weight: 1 },
      { id: "c", text: "A melody you keep humming", pole: "S", weight: 1 },
      { id: "d", text: "A beat drop or a production detail", pole: "S", weight: 2 },
    ],
  },
  {
    id: "focus-2",
    axis: "focus",
    text: "Would you enjoy a song in a language you don't understand?",
    options: [
      { id: "a", text: "Not really, I need to know what it's about", pole: "W", weight: 2 },
      { id: "b", text: "Maybe, after I look up the translation", pole: "W", weight: 1 },
      { id: "c", text: "Sure, if it sounds good", pole: "S", weight: 1 },
      { id: "d", text: "Absolutely, the sound is what matters", pole: "S", weight: 2 },
    ],
  },
  {
    id: "focus-3",
    axis: "focus",
    text: "You're studying or working. What's playing?",
    options: [
      { id: "a", text: "My usual songs with lyrics", pole: "W", weight: 1 },
      { id: "b", text: "Podcasts or spoken word", pole: "W", weight: 2 },
      { id: "c", text: "Instrumental versions of songs", pole: "S", weight: 1 },
      { id: "d", text: "Pure instrumental or ambient tracks", pole: "S", weight: 2 },
    ],
  },
  {
    id: "setting-1",
    axis: "setting",
    text: "Where do you enjoy music the most?",
    options: [
      { id: "a", text: "In the crowd at a concert", pole: "C", weight: 2 },
      { id: "b", text: "In the car with friends", pole: "C", weight: 1 },
      { id: "c", text: "On a solo walk", pole: "O", weight: 1 },
      { id: "d", text: "Alone in my room with headphones", pole: "O", weight: 2 },
    ],
  },
  {
    id: "setting-2",
    axis: "setting",
    text: "Someone asks to see your playlists. You...",
    options: [
      { id: "a", text: "Send the link right away, plus a few more", pole: "C", weight: 2 },
      { id: "b", text: "Share one you're proud of", pole: "C", weight: 1 },
      { id: "c", text: "Hesitate, it feels personal", pole: "O", weight: 1 },
      { id: "d", text: "Keep them private, they're just for me", pole: "O", weight: 2 },
    ],
  },
  {
    id: "setting-3",
    axis: "setting",
    text: "You're on aux at a party.",
    options: [
      { id: "a", text: "Love it, I know exactly what the room needs", pole: "C", weight: 2 },
      { id: "b", text: "Happy to, I'll play the crowd-pleasers", pole: "C", weight: 1 },
      { id: "c", text: "I'll do it, but I'm a bit nervous", pole: "O", weight: 1 },
      { id: "d", text: "Please give it to someone else", pole: "O", weight: 2 },
    ],
  },
];
