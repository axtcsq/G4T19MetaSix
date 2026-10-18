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
import { combineTraits, listeningStats, rankTypes } from "../services/patterns.js";
import { validateAnswers } from "../services/quizEngine.js";

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

async function latestResults(profile) {
  const attempts = await retrieveLatestAttempts();
  return attempts.map((attempt) => evaluateAttempt(attempt, profile)).filter(Boolean);
}

function publicType(id) {
  const { name, tagline, description } = PERSONALITY_TYPES.find((type) => type.id === id);
  return { id, name, tagline, description };
}

// Summarises every quiz result into one MetaFor personality and saves it.
async function rebuildPersonality() {
  const profile = getSpotifyProfile();
  const results = await latestResults(profile);
  const traits = combineTraits(results, profile);
  const ranking = rankTypes(traits);
  const stats = listeningStats(profile);
  const quizResults = results.map(({ quizId, quizTitle, title, subtitle }) => ({ quizId, quizTitle, title, subtitle }));

  const analysis = await analysePersonality({
    traits,
    quizResults,
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
    headline:
      analysis?.headline ?? `So far you lean ${traits.map((trait) => trait.poleName).join(", ")}.`,
    insights: analysis?.insights ?? traits.map((trait) => trait.trait),
    summary: analysis?.summary ?? type.description,
    traits,
    quizResults,
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
    stats: personality.stats,
    source: personality.source,
    updatedAt: personality.updatedAt,
  };
}

// GET /api/quiz
export async function getQuizzes(req, res) {
  const results = await latestResults(getSpotifyProfile());

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

  const attempt = await findLatestAttempt(quiz.id);
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

  const attempt = await addQuizAttempt({ quizId: quiz.id, answers: stored });
  const result = evaluateAttempt(attempt, getSpotifyProfile());
  const personality = await rebuildPersonality();

  res.status(201).json({ result, personality: formatPersonality(personality) });
}
