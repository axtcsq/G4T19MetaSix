import { clamp, percent, shareRow, tallyAnswers } from "../../services/quizEngine.js";

// Soundwoods: the "Walk in the Woods" projection test as a journey through a
// sound-filled forest. Each choice nudges four Spotify audio values up or
// down. The result is the forest scene matching the user's valence (happiness)
// and energy, flavoured by their acousticness and instrumentalness.

// Points needed to move a value from the middle (50%) to the edge (0 or 100%).
const SCALE = 12;

const SCENES = {
  "sunlit-clearing": {
    name: "The Sunlit Clearing",
    meaning: "You walk towards the light and the music. When things get hard you meet them head-on, turn the volume up and look for joy. You share good songs freely and expect the best from people.",
  },
  "firefly-grove": {
    name: "The Firefly Grove",
    meaning: "You're a gentle optimist. You cope by slowing down and finding small, warm moments, and your closest connections are quiet ones: a shared song, a soft night in.",
  },
  "thunder-ridge": {
    name: "The Thunder Ridge",
    meaning: "You channel big feelings into big sound. Stress becomes energy, and loud, intense music is how you work through it. You keep your deepest tracks close, sharing them only with people who get it.",
  },
  "moonlit-lake": {
    name: "The Moonlit Lake",
    meaning: "You're reflective and deep. You process feelings slowly, often alone, and music is a mirror you sit with. When you do share a song, it's a sign of real trust.",
  },
};

const option = (id, text, scores) => ({ id, text, scores });

const level = (total) => clamp(0.5 + total / (SCALE * 2), 0, 1);

function averageFeature(profile, feature) {
  const values = profile.topTracks.map((track) => track[feature]).filter((value) => typeof value === "number");
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export const soundwoods = {
  id: "soundwoods",
  title: "Soundwoods",
  description: "A walk through a forest made of sound reveals how you really feel.",
  // Every result, for the list on the Personality page.
  outcomes: Object.values(SCENES).map((scene) => ({ name: scene.name, meaning: scene.meaning })),
  dimensions: ["valence", "energy", "acousticness", "instrumentalness"],
  questions: [
    {
      id: "enter",
      text: "You step into the forest. What do you hear first?",
      options: [
        option("a", "Birdsong and a far-off acoustic guitar", { valence: 1, acousticness: 2 }),
        option("b", "Silence so deep you can hear your heartbeat", { energy: -2, instrumentalness: 1 }),
        option("c", "A festival bassline somewhere beyond the trees", { energy: 2, valence: 1 }),
        option("d", "Wind through the leaves, like a choir without words", { instrumentalness: 2, valence: -1 }),
      ],
    },
    {
      id: "path",
      text: "The path splits in two. Which way?",
      options: [
        option("a", "The sunlit path, with music drifting down it", { valence: 2, energy: 1 }),
        option("b", "The shaded path, where rain is starting", { valence: -1, acousticness: 1 }),
        option("c", "Towards the sound of drums", { energy: 2 }),
        option("d", "The path where there's no sound at all", { energy: -1, instrumentalness: 1 }),
      ],
    },
    {
      id: "storm",
      text: "A sudden storm rolls in. You...",
      options: [
        option("a", "Turn the volume up and dance in it", { energy: 2, valence: 1 }),
        option("b", "Shelter and hum something soft", { energy: -1, acousticness: 2 }),
        option("c", "Listen to the thunder like it's a song", { instrumentalness: 2 }),
        option("d", "Put on a sad song and let it rain", { valence: -2 }),
      ],
    },
    {
      id: "cabin",
      text: "You find a cabin with a record player. You play...",
      options: [
        option("a", "The first upbeat record you see", { valence: 2, energy: 1 }),
        option("b", "A solo piano record", { instrumentalness: 2, acousticness: 1 }),
        option("c", "A folk record full of stories", { acousticness: 2 }),
        option("d", "The heaviest, loudest record there", { energy: 2, valence: -1, acousticness: -1 }),
      ],
    },
    {
      id: "unreleased",
      text: "On the table is an unreleased track by your favourite artist.",
      options: [
        option("a", "Play it right now, loud", { energy: 2 }),
        option("b", "Save it for a quiet moment alone", { energy: -1, acousticness: 1 }),
        option("c", "Wait so you can hear it with someone special", { valence: 2 }),
        option("d", "Leave it, some things should stay unheard", { valence: -1, instrumentalness: 1 }),
      ],
    },
    {
      id: "campfire",
      text: "A stranger by a campfire is playing guitar.",
      options: [
        option("a", "Sit down and sing along", { valence: 2, acousticness: 1 }),
        option("b", "Listen quietly from the dark", { energy: -1, acousticness: 1 }),
        option("c", "Ask them to play something faster", { energy: 2 }),
        option("d", "Hum a melody along without words", { instrumentalness: 2 }),
      ],
    },
    {
      id: "night",
      text: "Night falls. The forest's soundtrack is...",
      options: [
        option("a", "Crickets and a soft ambient hum", { instrumentalness: 1, energy: -2 }),
        option("b", "A lullaby someone is singing nearby", { acousticness: 2, valence: 1 }),
        option("c", "Synths pulsing from the trees", { energy: 1, acousticness: -2 }),
        option("d", "A lonely cello", { valence: -2, instrumentalness: 1 }),
      ],
    },
    {
      id: "leave",
      text: "You leave the woods carrying one sound with you.",
      options: [
        option("a", "Laughter", { valence: 2 }),
        option("b", "The rain", { valence: -1, acousticness: 1 }),
        option("c", "The festival bass", { energy: 2, acousticness: -1 }),
        option("d", "The silence", { energy: -2, instrumentalness: 1 }),
      ],
    },
  ],

  evaluate(answers, profile) {
    const totals = tallyAnswers(this, answers);
    const values = Object.fromEntries(this.dimensions.map((dimension) => [dimension, level(totals[dimension])]));
    const bright = values.valence >= 0.5;
    const lively = values.energy >= 0.5;
    const key = bright ? (lively ? "sunlit-clearing" : "firefly-grove") : lively ? "thunder-ridge" : "moonlit-lake";
    const scene = SCENES[key];

    const justification = [
      `Your forest's happiness (valence) is ${percent(values.valence)}%: ${bright ? "you look for light even in a storm" : "you let sad songs do their work"}.`,
      `Its energy is ${percent(values.energy)}%: ${lively ? "you cope by moving and turning it up" : "you cope by slowing down and going quiet"}.`,
    ];
    if (values.acousticness >= 0.6) justification.push("You kept choosing organic, unplugged sounds: you trust what feels real and close.");
    if (values.instrumentalness >= 0.6) justification.push("Many of your sounds had no words: you feel things before you can say them.");

    // Compare the imagined forest with what the user really listens to.
    const realEnergy = averageFeature(profile, "energy");
    if (realEnergy !== null) {
      const gap = values.energy - realEnergy;
      if (Math.abs(gap) >= 0.15) {
        justification.push(
          `Your imagined forest is ${gap < 0 ? "calmer" : "livelier"} than your actual listening (${percent(realEnergy)}% energy)${gap < 0 ? ", so maybe you're craving some quiet." : ", so maybe you're ready for something bigger."}`,
        );
      } else {
        justification.push(`Your forest matches your real listening closely (${percent(realEnergy)}% energy).`);
      }
    }

    return {
      resultId: key,
      title: scene.name,
      subtitle: `${percent(values.valence)}% happiness, ${percent(values.energy)}% energy`,
      headline: `Based on the quiz, your inner forest is ${scene.name}.`,
      description: scene.meaning,
      justification,
      breakdown: [
        shareRow("Happiness (valence)", percent(values.valence)),
        shareRow("Energy", percent(values.energy)),
        shareRow("Acousticness", percent(values.acousticness)),
        shareRow("Instrumentalness", percent(values.instrumentalness)),
      ],
      // Instrumental sounds lean Soundscaper.
      traits: {
        energy: values.energy * 2 - 1,
        focus: 1 - values.instrumentalness * 2,
      },
    };
  },
};
