import { balance, percent, scaleRow, tallyAnswers } from "../../services/quizEngine.js";

// Music MBTI: the four MBTI letter pairs, measured with music questions.
// Three questions per pair; options give 2 points (strong lean) or 1 (mild).
const PAIRS = [
  {
    first: "E",
    second: "I",
    label: "Social energy",
    names: { E: "Extraverted", I: "Introverted" },
    meaning: {
      E: "music recharges you most when it's shared, out loud and with people around",
      I: "music recharges you most in your own space, with headphones on",
    },
  },
  {
    first: "S",
    second: "N",
    label: "How you listen",
    names: { S: "Sensing", N: "Intuitive" },
    meaning: {
      S: "you notice what's actually there: the beat, the hook, the production",
      N: "you hear what a song hints at: the story, the symbolism, the bigger picture",
    },
  },
  {
    first: "T",
    second: "F",
    label: "How you judge a song",
    names: { T: "Thinking", F: "Feeling" },
    meaning: {
      T: "you judge songs on craft, structure and how well they work",
      F: "you judge songs on how they make you, and the people around you, feel",
    },
  },
  {
    first: "J",
    second: "P",
    label: "How you organise music",
    names: { J: "Judging", P: "Perceiving" },
    meaning: {
      J: "you like your music planned, sorted and finished",
      P: "you like your music spontaneous, shuffled and open-ended",
    },
  },
];

// What each Music MBTI type means.
const TYPES = {
  INTJ: { name: "The Concept Album Architect", meaning: "You treat albums like blueprints, listening start to finish and noticing how every track fits the plan. You'd rather master one artist's whole discography than skim the charts." },
  INTP: { name: "The Deep-Cut Theorist", meaning: "You go past the singles into B-sides, demos and remixes, building theories about what an artist meant. Your library is a research project you never want to finish." },
  ENTJ: { name: "The Festival Strategist", meaning: "You plan the set times, the route between stages and the playlist for the ride home. Music is an experience you organise for everyone, and it always goes to plan." },
  ENTP: { name: "The Genre Debater", meaning: "You love arguing that a song is underrated, overrated or secretly a different genre. New sounds are puzzles, and you're always first to try the strange new release." },
  INFJ: { name: "The Lyric Interpreter", meaning: "You hear the meaning between the lines and remember the lyric that described your week perfectly. Music is how you understand people, including yourself." },
  INFP: { name: "The Bedroom Dreamer", meaning: "You build whole inner worlds out of songs, usually alone and late at night. Your playlists read like diary entries, and every one has a feeling behind it." },
  ENFJ: { name: "The Playlist Matchmaker", meaning: "You always know the right song for the right person. You make playlists for friends' moods and love watching a room light up at your pick." },
  ENFP: { name: "The Discovery Spark", meaning: "Every week you have a new favourite artist and you can't wait to tell everyone. You chase feelings across genres and bring friends along for the ride." },
  ISTJ: { name: "The Library Keeper", meaning: "Your playlists are named, sorted and maintained. You know exactly which album to reach for and you trust the classics that have never let you down." },
  ISFJ: { name: "The Comfort Curator", meaning: "You return to familiar songs that feel like home, and you remember which songs your friends love. Music is how you take care of yourself and others." },
  ESTJ: { name: "The Aux Organiser", meaning: "On a road trip, you're the one with the downloaded, timed and tested playlist. You keep the music running smoothly so everyone else can enjoy it." },
  ESFJ: { name: "The Singalong Host", meaning: "You pick songs everyone knows the words to. Music is about togetherness, and you're happiest when the whole car is singing." },
  ISTP: { name: "The Sound Tinkerer", meaning: "You notice production details, gear and how a track is built. You listen quietly, take it apart in your head, and rate it on how well it works." },
  ISFP: { name: "The Mood Painter", meaning: "You choose music like colours for how the moment feels. Spontaneous and personal, your taste is hard to label and that's how you like it." },
  ESTP: { name: "The Front Row Thrill-Seeker", meaning: "You want it loud, live and right now. You'd rather be in the front row than read about the album, and you skip anything that doesn't hit." },
  ESFP: { name: "The Dance Floor Star", meaning: "If there's a beat, you're moving. You love whatever gets people dancing and you live for the moment the drop lands." },
};

const option = (id, text, scores) => ({ id, text, scores });

export const musicMbti = {
  id: "music-mbti",
  title: "Music MBTI",
  description: "The classic MBTI, answered through how you listen.",
  // Every result, for the list on the Personality page.
  outcomes: Object.entries(TYPES).map(([code, type]) => ({ name: code, tag: type.name, meaning: type.meaning })),
  dimensions: ["E", "I", "S", "N", "T", "F", "J", "P"],
  questions: [
    {
      id: "ei-1",
      text: "Your favourite artist announces a surprise gig tonight. You...",
      options: [
        option("a", "Rally the group chat, it's a night out", { E: 2 }),
        option("b", "Go if a friend is keen", { E: 1 }),
        option("c", "Catch the livestream from home", { I: 1 }),
        option("d", "Wait for the recording, crowds drain you", { I: 2 }),
      ],
    },
    {
      id: "ei-2",
      text: "How do you usually find a song you end up loving?",
      options: [
        option("a", "Someone plays it at a party", { E: 2 }),
        option("b", "A friend sends it to me", { E: 1 }),
        option("c", "I stumble on it scrolling alone", { I: 1 }),
        option("d", "Deep into an album, on my own, late at night", { I: 2 }),
      ],
    },
    {
      id: "ei-3",
      text: "On a long train ride, you...",
      options: [
        option("a", "Share earbuds and talk about what's playing", { E: 2 }),
        option("b", "Put on a playlist a friend made", { E: 1 }),
        option("c", "Headphones in and people-watch", { I: 1 }),
        option("d", "Noise-cancelling on, full album, do not disturb", { I: 2 }),
      ],
    },
    {
      id: "sn-1",
      text: "What grabs you first in a new song?",
      options: [
        option("a", "A tight beat and clean production", { S: 2 }),
        option("b", "A catchy hook", { S: 1 }),
        option("c", "The mood it puts me in", { N: 1 }),
        option("d", "The story or hidden meaning behind it", { N: 2 }),
      ],
    },
    {
      id: "sn-2",
      text: "Pick a playlist to put on:",
      options: [
        option("a", "This week's top hits", { S: 2 }),
        option("b", "All-time classics", { S: 1 }),
        option("c", "Experimental mixes", { N: 1 }),
        option("d", "Concept albums and soundscapes", { N: 2 }),
      ],
    },
    {
      id: "sn-3",
      text: "A song is about a breakup. You think about...",
      options: [
        option("a", "Exactly what happened in the lyrics", { S: 2 }),
        option("b", "A time something similar happened to you", { S: 1 }),
        option("c", "What the breakup might symbolise", { N: 1 }),
        option("d", "A whole imagined backstory for the singer", { N: 2 }),
      ],
    },
    {
      id: "tf-1",
      text: "When you rate an album, you focus on...",
      options: [
        option("a", "Technical skill and production quality", { T: 2 }),
        option("b", "How well the tracks flow together", { T: 1 }),
        option("c", "How it made me feel", { F: 1 }),
        option("d", "Whether it moved me to tears", { F: 2 }),
      ],
    },
    {
      id: "tf-2",
      text: "A friend's favourite song is one you dislike. You...",
      options: [
        option("a", "Explain honestly why it doesn't work for you", { T: 2 }),
        option("b", "Point out the one thing it does well", { T: 1 }),
        option("c", "Ask what it means to them", { F: 1 }),
        option("d", "Keep quiet and try to love it for them", { F: 2 }),
      ],
    },
    {
      id: "tf-3",
      text: "Choosing music for a road trip, you pick by...",
      options: [
        option("a", "Tempo and run time, so it fits the drive", { T: 2 }),
        option("b", "What suits the route and scenery", { T: 1 }),
        option("c", "What everyone in the car loves", { F: 1 }),
        option("d", "Songs with memories attached", { F: 2 }),
      ],
    },
    {
      id: "jp-1",
      text: "Your playlists are...",
      options: [
        option("a", "Named, sorted and regularly maintained", { J: 2 }),
        option("b", "Mostly organised", { J: 1 }),
        option("c", "A few chaotic mixes", { P: 1 }),
        option("d", "What playlists? I shuffle everything", { P: 2 }),
      ],
    },
    {
      id: "jp-2",
      text: "Before a trip, your music is...",
      options: [
        option("a", "Downloaded and queued a week ahead", { J: 2 }),
        option("b", "A playlist made the night before", { J: 1 }),
        option("c", "Picked in the moment", { P: 1 }),
        option("d", "Whatever the radio plays", { P: 2 }),
      ],
    },
    {
      id: "jp-3",
      text: "Halfway through a song you're not feeling, you...",
      options: [
        option("a", "Finish it, you started it", { J: 2 }),
        option("b", "Give it until the chorus", { J: 1 }),
        option("c", "Skip it", { P: 1 }),
        option("d", "Skip, switch genre, then switch apps", { P: 2 }),
      ],
    },
  ],

  evaluate(answers) {
    const totals = tallyAnswers(this, answers);
    const leans = PAIRS.map((pair) => {
      const score = balance(totals, pair.first, pair.second);
      const letter = score >= 0 ? pair.first : pair.second;
      return { ...pair, score, letter, strength: percent(0.5 + Math.abs(score) / 2) };
    });

    const code = leans.map((lean) => lean.letter).join("");
    const type = TYPES[code];
    const byFirst = Object.fromEntries(leans.map((lean) => [lean.first, lean.score]));

    return {
      resultId: code,
      title: code,
      subtitle: type.name,
      headline: `Based on the quiz, we think you are an ${code}.`,
      description: type.meaning,
      justification: leans.map(
        (lean) => `${lean.names[lean.letter]} (${lean.strength}%): ${lean.meaning[lean.letter]}.`,
      ),
      breakdown: leans.map((lean) =>
        scaleRow(lean.label, lean.names[lean.first], lean.names[lean.second], lean.score),
      ),
      // E/I maps to Crowd/Solo, N/S to Explorer/Loyalist, F/T to Wordsmith/Soundscaper.
      traits: { setting: byFirst.E, discovery: -byFirst.S, focus: -byFirst.T },
    };
  },
};
