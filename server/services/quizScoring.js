import { PERSONALITY_TYPES } from "../data/personalityTypes.js";

// How much the quiz answers count versus the user's listening data.
const QUIZ_WEIGHT = 0.7;
const SPOTIFY_WEIGHT = 0.3;

const MAX_OPTION_WEIGHT = 2;

function clamp(value, min = -1, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function average(tracks, feature) {
  const values = tracks.map((track) => track[feature]).filter((value) => typeof value === "number");
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

// Each signal is between -1 and 1, where a positive number leans towards the
// trait's first pole (A, X, W, C). null means there is not enough data.
export function spotifySignals(profile) {
  const tracks = profile?.topTracks ?? [];
  const energy = average(tracks, "energy");
  const instrumentalness = average(tracks, "instrumentalness");
  const danceability = average(tracks, "danceability");
  const repeatRatio = profile?.repeatListenRatio;

  return {
    energy: energy === null ? null : clamp((energy - 0.5) * 2),
    discovery: typeof repeatRatio === "number" ? clamp((0.5 - repeatRatio) * 2) : null,
    focus: instrumentalness === null ? null : clamp((0.25 - instrumentalness) * 4),
    setting: danceability === null ? null : clamp((danceability - 0.5) * 2),
  };
}

// Returns an error message, or null when every question has a valid answer.
export function validateAnswers(quiz, answers) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return "Answers must be an object";
  }

  for (const question of quiz.questions) {
    if (!question.options.some((option) => option.id === answers[question.id])) {
      return "Every question must be answered";
    }
  }

  return null;
}

// Describes a score between -1 and 1 on one trait for display.
function describeTrait(axis, score) {
  const [firstPole, secondPole] = Object.keys(axis.poles);
  const pole = score >= 0 ? firstPole : secondPole;

  return {
    id: axis.id,
    label: axis.label,
    score: Number(score.toFixed(2)),
    pole,
    poleName: axis.poles[pole].name,
    oppositeName: axis.poles[pole === firstPole ? secondPole : firstPole].name,
    firstPoleName: axis.poles[firstPole].name,
    secondPoleName: axis.poles[secondPole].name,
    // How strongly the user leans to their pole, from 50 (balanced) to 100.
    strength: Math.round(50 + Math.abs(score) * 50),
    trait: axis.poles[pole].trait,
  };
}

// Scores one quiz attempt. Assumes answers have already been validated.
export function scoreQuiz(quiz, answers, profile) {
  const signals = spotifySignals(profile);

  return quiz.axes.map((axis) => {
    const [firstPole] = Object.keys(axis.poles);
    const axisQuestions = quiz.questions.filter((question) => question.axis === axis.id);

    const total = axisQuestions.reduce((sum, question) => {
      const option = question.options.find((item) => item.id === answers[question.id]);
      return sum + (option.pole === firstPole ? option.weight : -option.weight);
    }, 0);

    const quizScore = total / (axisQuestions.length * MAX_OPTION_WEIGHT);
    const spotifyScore = signals[axis.id] ?? null;
    const score =
      spotifyScore === null ? quizScore : quizScore * QUIZ_WEIGHT + spotifyScore * SPOTIFY_WEIGHT;

    return describeTrait(axis, score);
  });
}

// Averages each trait across every quiz that measured it.
export function combineTraits(quizzes, results) {
  const byTrait = new Map();

  for (const result of results) {
    const quiz = quizzes.find((item) => item.id === result.quizId);
    if (!quiz) continue;

    for (const trait of result.traits) {
      const axis = quiz.axes.find((item) => item.id === trait.id);
      if (!axis) continue;

      const entry = byTrait.get(trait.id) ?? { axis, scores: [] };
      entry.scores.push(trait.score);
      byTrait.set(trait.id, entry);
    }
  }

  return [...byTrait.values()].map(({ axis, scores }) =>
    describeTrait(axis, scores.reduce((sum, score) => sum + score, 0) / scores.length),
  );
}

// Ranks every personality type by how close its profile is to the user's
// traits. match is a percentage, 100 being an exact fit. Traits the user
// hasn't been measured on yet count as balanced (0).
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

// Wrapped-style facts about the user's listening, shown on the result page
// and given to the LLM as evidence.
export function listeningStats(profile) {
  const tracks = profile?.topTracks ?? [];
  const genreCounts = {};

  for (const artist of profile?.topArtists ?? []) {
    for (const genre of artist.genres) {
      genreCounts[genre] = (genreCounts[genre] ?? 0) + 1;
    }
  }

  const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const percent = (value) => (value === null ? null : Math.round(value * 100));

  return {
    topArtist: profile?.topArtists?.[0]?.name ?? null,
    topTrack: tracks[0] ? `${tracks[0].name} by ${tracks[0].artist}` : null,
    topGenre,
    averageEnergy: percent(average(tracks, "energy")),
    averageHappiness: percent(average(tracks, "valence")),
    repeatListens:
      typeof profile?.repeatListenRatio === "number" ? percent(profile.repeatListenRatio) : null,
  };
}
