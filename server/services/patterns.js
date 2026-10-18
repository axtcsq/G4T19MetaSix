import { METAFOR_TRAITS } from "../data/metaforTraits.js";
import { PERSONALITY_TYPES } from "../data/personalityTypes.js";
import { clamp } from "./quizEngine.js";

// How much the quiz results count versus the user's listening data when
// working out their MetaFor traits.
const QUIZ_WEIGHT = 0.7;
const SPOTIFY_WEIGHT = 0.3;

function average(values) {
  const numbers = values.filter((value) => typeof value === "number");
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
}

function averageFeature(profile, feature) {
  return average((profile?.topTracks ?? []).map((track) => track[feature]));
}

// Each signal is between -1 and 1, where a positive number leans towards the
// trait's first pole (Amped, Explorer, Wordsmith, Crowd). null = no data.
export function spotifySignals(profile) {
  const energy = averageFeature(profile, "energy");
  const instrumentalness = averageFeature(profile, "instrumentalness");
  const danceability = averageFeature(profile, "danceability");
  const repeatRatio = profile?.repeatListenRatio;

  return {
    energy: energy === null ? null : clamp((energy - 0.5) * 2),
    discovery: typeof repeatRatio === "number" ? clamp((0.5 - repeatRatio) * 2) : null,
    focus: instrumentalness === null ? null : clamp((0.25 - instrumentalness) * 4),
    setting: danceability === null ? null : clamp((danceability - 0.5) * 2),
  };
}

// Describes a score between -1 and 1 on one MetaFor trait for display.
function describeTrait(trait, score) {
  const [firstPole, secondPole] = Object.keys(trait.poles);
  const pole = score >= 0 ? firstPole : secondPole;

  return {
    id: trait.id,
    label: trait.label,
    score: Number(score.toFixed(2)),
    pole,
    poleName: trait.poles[pole].name,
    oppositeName: trait.poles[pole === firstPole ? secondPole : firstPole].name,
    firstPoleName: trait.poles[firstPole].name,
    secondPoleName: trait.poles[secondPole].name,
    // How strongly the user leans to their pole, from 50 (balanced) to 100.
    strength: Math.round(50 + Math.abs(score) * 50),
    trait: trait.poles[pole].trait,
  };
}

// Averages every quiz result's trait scores, then blends in the listening data.
export function combineTraits(results, profile) {
  const signals = spotifySignals(profile);

  return METAFOR_TRAITS.map((trait) => {
    const fromQuizzes = average(results.map((result) => result.traits[trait.id]));
    const fromSpotify = signals[trait.id];

    let score = 0;
    if (fromQuizzes !== null && fromSpotify !== null) {
      score = fromQuizzes * QUIZ_WEIGHT + fromSpotify * SPOTIFY_WEIGHT;
    } else {
      score = fromQuizzes ?? fromSpotify ?? 0;
    }

    return describeTrait(trait, clamp(score));
  });
}

// Ranks every personality type by how close its profile is to the user's
// traits. match is a percentage, 100 being an exact fit.
export function rankTypes(traits) {
  return PERSONALITY_TYPES.map((type) => {
    const targets = Object.entries(type.profile);
    const distance =
      targets.reduce((sum, [traitId, target]) => {
        const score = traits.find((trait) => trait.id === traitId)?.score ?? 0;
        return sum + Math.abs(score - target);
      }, 0) / targets.length;

    return { id: type.id, match: Math.round((1 - distance / 2) * 100) };
  }).sort((a, b) => b.match - a.match);
}

// Wrapped-style facts about the user's listening, shown in Patterns and given
// to the LLM as evidence.
export function listeningStats(profile) {
  const genreCounts = {};

  for (const artist of profile?.topArtists ?? []) {
    for (const genre of artist.genres) {
      genreCounts[genre] = (genreCounts[genre] ?? 0) + 1;
    }
  }

  const topTrack = profile?.topTracks?.[0];
  const percent = (value) => (value === null ? null : Math.round(value * 100));

  return {
    topArtist: profile?.topArtists?.[0]?.name ?? null,
    topTrack: topTrack ? `${topTrack.name} by ${topTrack.artist}` : null,
    topGenre: Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    averageEnergy: percent(averageFeature(profile, "energy")),
    averageHappiness: percent(averageFeature(profile, "valence")),
    averageDanceability: percent(averageFeature(profile, "danceability")),
    averageAcousticness: percent(averageFeature(profile, "acousticness")),
    repeatListens:
      typeof profile?.repeatListenRatio === "number" ? percent(profile.repeatListenRatio) : null,
  };
}
