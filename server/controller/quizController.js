import { mockSpotifyProfile } from "../data/mockSpotify.js";
import { PERSONALITY_TYPES } from "../data/personalityTypes.js";
import { QUIZZES, findQuiz } from "../data/quizzes/index.js";
import { MOODS, retrieveMoodLogs } from "../models/MoodLog.js";
import {
  addQuizAttempt,
  findLatestAttempt,
  findPersonality,
  retrieveLatestAttempts,
  savePersonality,
} from "../models/QuizAttempt.js";
import { analysePersonality } from "../services/quizLlm.js";
import {
  QUIZ_WEIGHT,
  SPOTIFY_WEIGHT,
  combineTraits,
  listeningStats,
  moodLink,
  rankTypes,
  spotifyEvidence,
  spotifySignals,
} from "../services/patterns.js";
import { validateAnswers } from "../services/quizEngine.js";

// The signed-in user's _id. Null until auth is merged, so every quiz query
// still filters by user and only this needs changing then.
function currentUserId(req) {
  return req.user?._id ?? null;
}

// TODO: replace with the signed-in user's Spotify data once auth and the
// Spotify API set-up are merged.
function getSpotifyProfile() {
  return mockSpotifyProfile;
}

// Counts recent mood logs per mood.
// TODO: only count the signed-in user's logs once auth is merged.
async function getMoodPatterns() {
  const logs = await retrieveMoodLogs();

  if (logs.length === 0) return null;

  const counts = Object.fromEntries(MOODS.map((mood) => [mood, 0]));
  for (const log of logs) counts[log.mood] += 1;

  return { total: logs.length, counts };
}

// Works out a stored attempt's result. Attempts whose answers no longer fit
// the quiz (for example after its questions changed) are skipped.
function evaluateAttempt(attempt, profile) {
  const quiz = findQuiz(attempt.quizId);
  if (!quiz || validateAnswers(quiz, attempt.answers)) return null;

  return { quizId: quiz.id, quizTitle: quiz.title, takenAt: attempt.createdAt, ...quiz.evaluate(attempt.answers, profile) };
}

async function latestResults(userId, profile) {
  const attempts = await retrieveLatestAttempts(userId);
  const order = (result) => QUIZZES.findIndex((quiz) => quiz.id === result.quizId);

  return attempts
    .map((attempt) => evaluateAttempt(attempt, profile))
    .filter(Boolean)
    .sort((a, b) => order(a) - order(b));
}

function publicType(id) {
  const { name, tagline, description } = PERSONALITY_TYPES.find((type) => type.id === id);
  return { id, name, tagline, description };
}

// Used under the Patterns section when no LLM summary is available.
function fallbackSummary(quizResults, type) {
  const titles = quizResults.map((result) => result.title);
  const list =
    titles.length > 1 ? `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}` : titles[0];
  return `Your quizzes describe you as ${list}. Put together with your listening, that adds up to ${type.name}.`;
}

// Summarises every quiz result into one MetaFor personality and saves it.
async function rebuildPersonality(userId) {
  const profile = getSpotifyProfile();
  const results = await latestResults(userId, profile);
  const traits = combineTraits(results, profile);
  const ranking = rankTypes(traits);
  const stats = listeningStats(profile);
  const quizResults = results.map(({ quizId, quizTitle, title, subtitle }) => ({ quizId, quizTitle, title, subtitle }));
  const moodPatterns = await getMoodPatterns();

  // Every row of the "how it adds up" table: one per quiz, then Spotify.
  const round = (value) => (typeof value === "number" ? Number(value.toFixed(2)) : null);
  const evidence = spotifyEvidence(profile);
  const signals = spotifySignals(profile);
  const sources = [
    ...results.map((result) => ({
      kind: "quiz",
      id: result.quizId,
      label: result.quizTitle,
      result: result.title,
      traits: Object.fromEntries(Object.entries(result.traits).map(([id, value]) => [id, round(value)])),
    })),
    {
      kind: "spotify",
      id: "spotify",
      label: "Your Spotify listening",
      result: stats.topArtist ? `Top artist: ${stats.topArtist}` : "Listening data",
      traits: Object.fromEntries(Object.entries(signals).map(([id, value]) => [id, round(value)])),
      evidence,
    },
  ];

  const analysis = await analysePersonality({
    traits,
    quizResults,
    ranking,
    stats,
    moodPatterns,
    profile,
  });

  const typeId = analysis?.typeId ?? ranking[0].id;
  const runnerUp = ranking.find((type) => type.id !== typeId);
  const type = publicType(typeId);

  return savePersonality(userId, {
    typeId,
    match: ranking.find((item) => item.id === typeId).match,
    runnerUpId: runnerUp.id,
    runnerUpMatch: runnerUp.match,
    headline:
      analysis?.headline ?? `So far you lean ${traits.map((trait) => trait.poleName).join(", ")}.`,
    insights: analysis?.insights ?? traits.map((trait) => trait.trait),
    summary: analysis?.summary ?? fallbackSummary(quizResults, type),
    traits,
    quizResults,
    sources,
    weights: { quizzes: QUIZ_WEIGHT, spotify: SPOTIFY_WEIGHT },
    ranking: ranking.map(({ id, match }) => ({ id, name: publicType(id).name, match })),
    moodLink: moodLink(moodPatterns, stats),
    stats,
    source: analysis ? "llm" : "scoring",
  });
}

function formatPersonality(personality) {
  // Personalities saved before quiz results were recorded are out of date.
  if (!personality?.quizResults?.length) return null;

  return {
    type: { ...publicType(personality.typeId), match: personality.match },
    runnerUp: { ...publicType(personality.runnerUpId), match: personality.runnerUpMatch },
    headline: personality.headline,
    insights: personality.insights,
    summary: personality.summary,
    traits: personality.traits,
    quizResults: personality.quizResults,
    sources: personality.sources,
    weights: personality.weights,
    ranking: personality.ranking,
    moodLink: personality.moodLink,
    stats: personality.stats,
    source: personality.source,
    updatedAt: personality.updatedAt,
  };
}

// GET /api/quiz
export async function getQuizzes(req, res) {
  const results = await latestResults(currentUserId(req), getSpotifyProfile());

  res.json(
    QUIZZES.map((quiz) => {
      const result = results.find((item) => item.quizId === quiz.id);

      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        questionCount: quiz.questions.length,
        needsBirthday: Boolean(quiz.needsBirthday),
        latestResult: result ? { title: result.title, subtitle: result.subtitle } : null,
      };
    }),
  );
}

// GET /api/quiz/personality
export async function getPersonality(req, res) {
  const userId = currentUserId(req);
  let personality = await findPersonality(userId);

  // Rebuild personalities saved before the "how it adds up" data existed.
  if (personality?.quizResults?.length && !personality.sources) {
    personality = await rebuildPersonality(userId);
  }

  res.json(formatPersonality(personality));
}

// GET /api/quiz/:quizId
export function getQuiz(req, res) {
  const quiz = findQuiz(req.params.quizId);

  if (!quiz) {
    return res.status(404).json({ error: "Quiz not found" });
  }

  res.json({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    needsBirthday: Boolean(quiz.needsBirthday),
    // Option scores stay on the server; the client only needs the text.
    questions: quiz.questions.map(({ id, text, options }) => ({
      id,
      text,
      options: options.map((option) => ({ id: option.id, text: option.text })),
    })),
  });
}

// GET /api/quiz/:quizId/result
export async function getLatestResult(req, res) {
  const quiz = findQuiz(req.params.quizId);

  if (!quiz) {
    return res.status(404).json({ error: "Quiz not found" });
  }

  const attempt = await findLatestAttempt(currentUserId(req), quiz.id);
  const result = attempt && evaluateAttempt(attempt, getSpotifyProfile());

  if (!result) {
    return res.status(404).json({ error: "You haven't taken this quiz yet" });
  }

  res.json(result);
}

// POST /api/quiz/:quizId/result
export async function submitQuiz(req, res) {
  const quiz = findQuiz(req.params.quizId);

  if (!quiz) {
    return res.status(404).json({ error: "Quiz not found" });
  }

  const answers = req.body?.answers;
  const error = validateAnswers(quiz, answers);

  if (error) {
    return res.status(400).json({ error });
  }

  // Keep only the fields the quiz uses.
  const stored = Object.fromEntries(quiz.questions.map((question) => [question.id, answers[question.id]]));
  if (quiz.needsBirthday) stored.birthday = answers.birthday;

  const userId = currentUserId(req);
  const attempt = await addQuizAttempt({ userId, quizId: quiz.id, answers: stored });
  const result = evaluateAttempt(attempt, getSpotifyProfile());
  const personality = await rebuildPersonality(userId);

  res.status(201).json({ result, personality: formatPersonality(personality) });
}
