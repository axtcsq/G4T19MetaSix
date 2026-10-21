import { METAFOR_TRAITS } from "../data/metaforTraits.js";
import { PERSONALITY_TYPES } from "../data/personalityTypes.js";
import { clamp } from "./quizEngine.js";

// How much the quiz results count versus the user's listening data when
// working out their MetaFor traits, once there is enough listening to go on.
export const QUIZ_WEIGHT = 0.7;
export const SPOTIFY_WEIGHT = 0.3;
// Listening reaches its full weight after this many days or plays, whichever
// comes first. Before that it counts for less, since a day of plays says
// little about someone's habits.
const FULL_WEIGHT_DAYS = 14;
const FULL_WEIGHT_PLAYS = 300;
// The weight moves in steps this size, so Patterns is rebuilt a handful of
// times as listening builds up rather than every few plays.
const WEIGHT_STEP = 0.05;

// How much the listening data counts for this user, from 0 to SPOTIFY_WEIGHT.
export function spotifyWeight(profile) {
  const history = profile?.history;
  if (!history) return SPOTIFY_WEIGHT;
  const share = Math.min(1, Math.max(history.days / FULL_WEIGHT_DAYS, history.plays / FULL_WEIGHT_PLAYS));
  const stepped = Math.floor((SPOTIFY_WEIGHT * share) / WEIGHT_STEP + 1e-9) * WEIGHT_STEP;
  return Number(stepped.toFixed(2));
}

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

// Why the listening data leans the way it does, per trait, for the
// "how it adds up" table.
export function spotifyEvidence(profile) {
  const percent = (value) => (value === null ? null : Math.round(value * 100));
  const energy = percent(averageFeature(profile, "energy"));
  const instrumentalness = percent(averageFeature(profile, "instrumentalness"));
  const danceability = percent(averageFeature(profile, "danceability"));
  const repeats = typeof profile?.repeatListenRatio === "number" ? percent(profile.repeatListenRatio) : null;

  return {
    energy: energy === null ? null : `Top tracks average ${energy}% energy`,
    discovery: repeats === null ? null : `${repeats}% of your plays are repeats`,
    focus:
      instrumentalness === null
        ? null
        : instrumentalness < 25
          ? `Only ${instrumentalness}% instrumental, so words matter`
          : `${instrumentalness}% instrumental, so sound comes first`,
    setting: danceability === null ? null : `Top tracks are ${danceability}% danceable`,
  };
}

// Roughly how happy (valence) music tends to sound for each logged mood.
const MOOD_VALENCE = { Happy: 0.75, Relaxed: 0.55, Anxious: 0.4, Angry: 0.35, Sad: 0.25 };

// One line connecting the user's mood logs with their listening.
export function moodLink(moodPatterns, stats) {
  if (!moodPatterns) return null;

  const [topMood, count] = Object.entries(moodPatterns.counts).sort((a, b) => b[1] - a[1])[0];
  const logged = `You logged ${topMood} most often (${count} of your last ${moodPatterns.total} mood logs)`;

  if (stats.averageHappiness === null) return { topMood, count, total: moodPatterns.total, text: `${logged}.` };

  const gap = stats.averageHappiness / 100 - MOOD_VALENCE[topMood];
  const comparison =
    Math.abs(gap) < 0.12
      ? "so your music matches how you've been feeling"
      : gap > 0
        ? "so your music sounds brighter than your mood, maybe it's how you lift yourself up"
        : "so your music sounds moodier than you feel, maybe it's where you put the heavier stuff";

  return {
    topMood,
    count,
    total: moodPatterns.total,
    text: `${logged}, and your top tracks average ${stats.averageHappiness}% happiness, ${comparison}.`,
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
  const weight = spotifyWeight(profile);

  return METAFOR_TRAITS.map((trait) => {
    const fromQuizzes = average(results.map((result) => result.traits[trait.id]));
    const fromSpotify = signals[trait.id];

    let score = 0;
    if (fromQuizzes !== null && fromSpotify !== null) {
      score = fromQuizzes * (1 - weight) + fromSpotify * weight;
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
  const topTrack = profile?.topTracks?.[0];
  const percent = (value) => (value === null ? null : Math.round(value * 100));

  return {
    topArtist: profile?.topArtists?.[0]?.name ?? null,
    topTrack: topTrack ? `${topTrack.name} by ${topTrack.artist}` : null,
    // The same top genre Spotify Horoscope uses.
    topGenre: profile?.topGenre ?? null,
    averageEnergy: percent(averageFeature(profile, "energy")),
    averageHappiness: percent(averageFeature(profile, "valence")),
    averageDanceability: percent(averageFeature(profile, "danceability")),
    averageAcousticness: percent(averageFeature(profile, "acousticness")),
    repeatListens:
      typeof profile?.repeatListenRatio === "number" ? percent(profile.repeatListenRatio) : null,
  };
}
