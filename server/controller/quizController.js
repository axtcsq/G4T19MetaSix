import { mockSpotifyProfile } from "../data/mockSpotify.js";
import { PERSONALITY_TYPES } from "../data/personalityTypes.js";
import { QUIZZES, findQuiz } from "../data/quizzes.js";
import { MOODS, retrieveMoodLogs } from "../models/MoodLog.js";
import {
  addQuizResult,
  findPersonality,
  retrieveLatestQuizResults,
  savePersonality,
} from "../models/QuizResult.js";
import { analysePersonality } from "../services/quizLlm.js";
import {
  combineTraits,
  listeningStats,
  rankTypes,
  scoreQuiz,
  validateAnswers,
} from "../services/quizScoring.js";

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

function publicType(id) {
  const { name, tagline, description } = PERSONALITY_TYPES.find((type) => type.id === id);
  return { id, name, tagline, description };
}

function quizTitle(id) {
  return QUIZZES.find((quiz) => quiz.id === id)?.title ?? id;
}

// Summarises every quiz the user has taken into one MetaFor personality and
// saves it.
async function rebuildPersonality() {
  const results = await retrieveLatestQuizResults();
  const profile = getSpotifyProfile();
  const traits = combineTraits(QUIZZES, results);
  const ranking = rankTypes(traits);
  const stats = listeningStats(profile);
  const quizzesTaken = results.map((result) => result.quizId);

  const analysis = await analysePersonality({
    traits,
    quizzesTaken: quizzesTaken.map(quizTitle),
    ranking,
    stats,
    moodPatterns: await getMoodPatterns(),
    profile,
  });

  const typeId = analysis?.typeId ?? ranking[0].id;
  const runnerUp = ranking.find((type) => type.id !== typeId);
  const type = publicType(typeId);

  return savePersonality({
    typeId,
    match: ranking.find((item) => item.id === typeId).match,
    runnerUpId: runnerUp.id,
    runnerUpMatch: runnerUp.match,
    headline: analysis?.headline ?? type.tagline,
    insights: analysis?.insights ?? traits.map((trait) => trait.trait),
    summary: analysis?.summary ?? type.description,
    traits,
    quizzesTaken,
    stats,
    source: analysis ? "llm" : "scoring",
  });
}

function formatPersonality(personality) {
  if (!personality) return null;

  return {
    type: { ...publicType(personality.typeId), match: personality.match },
    runnerUp: { ...publicType(personality.runnerUpId), match: personality.runnerUpMatch },
    headline: personality.headline,
    insights: personality.insights,
    summary: personality.summary,
    traits: personality.traits,
    quizzesTaken: personality.quizzesTaken,
    stats: personality.stats,
    source: personality.source,
    updatedAt: personality.updatedAt,
  };
}

// GET /api/quiz
export async function getQuizzes(req, res) {
  const results = await retrieveLatestQuizResults();
  const taken = new Set(results.map((result) => result.quizId));

  res.json(
    QUIZZES.map(({ id, title, description, questions }) => ({
      id,
      title,
      description,
      available: Boolean(questions),
      questionCount: questions?.length ?? 0,
      taken: taken.has(id),
    })),
  );
}

// GET /api/quiz/personality
export async function getPersonality(req, res) {
  res.json(formatPersonality(await findPersonality()));
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
    // Poles and weights stay on the server; the client only needs the text.
    questions: quiz.questions.map(({ id, text, options }) => ({
      id,
      text,
      options: options.map((option) => ({ id: option.id, text: option.text })),
    })),
  });
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

  const traits = scoreQuiz(quiz, answers, getSpotifyProfile());
  await addQuizResult({ quizId: quiz.id, traits });
  const personality = await rebuildPersonality();

  res.status(201).json({
    quizId: quiz.id,
    traits,
    personality: formatPersonality(personality),
  });
}
