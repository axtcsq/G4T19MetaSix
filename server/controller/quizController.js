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
import { buildListeningProfile } from "../services/listeningProfile.js";
import { moodMusic } from "../services/moodMusic.js";
import { overallMood } from "../services/overallMood.js";
import { analysePersonality } from "../services/quizLlm.js";
import {
  SPOTIFY_WEIGHT,
  spotifyWeight,
  combineTraits,
  describeTypes,
  listeningStats,
  moodLink,
  rankTypes,
  songForType,
  spotifyEvidence,
  spotifySignals,
} from "../services/patterns.js";
import { validateAnswers } from "../services/quizEngine.js";

// Counts recent mood logs per mood for the signed-in user.
async function getMoodPatterns(userId) {
  const logs = await retrieveMoodLogs(userId);

  if (logs.length === 0) return null;

  const counts = Object.fromEntries(MOODS.map((mood) => [mood, 0]));
  for (const log of logs) counts[log.mood] += 1;

  return { total: logs.length, counts };
}

// The user's overall mood over the last 30 days, from their journal and listening.
async function lastMonthMood(user) {
  const today = new Date();
  const date = (back) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: user.timezone || "UTC" }).format(
      new Date(today.getTime() - back * 24 * 60 * 60 * 1000),
    );
  return overallMood(user, { from: date(29), to: date(0) });
}

// Works out a stored attempt's result. Skips attempts that don't fit the quiz anymore (e.g. the questions changed).
function evaluateAttempt(attempt, profile) {
  const quiz = findQuiz(attempt.quizId);
  if (!quiz || validateAnswers(quiz, attempt.answers)) return null;

  return {
    quizId: quiz.id,
    quizTitle: quiz.title,
    takenAt: attempt.createdAt,
    ...quiz.evaluate(attempt.answers, profile),
  };
}

async function latestResults(userId, profile) {
  const attempts = await retrieveLatestAttempts(userId);
  const order = (result) =>
    QUIZZES.findIndex((quiz) => quiz.id === result.quizId);

  return attempts
    .map((attempt) => evaluateAttempt(attempt, profile))
    .filter(Boolean)
    .sort((a, b) => order(a) - order(b));
}

function publicType(id) {
  const { name, tagline, description } = PERSONALITY_TYPES.find(
    (type) => type.id === id,
  );
  return { id, name, tagline, description };
}

// Line under Patterns when there's no LLM summary. Just a send-off for the type, the cards above already explain the result.
function closingLine(typeId) {
  return PERSONALITY_TYPES.find((type) => type.id === typeId).closing;
}

// Summarises every quiz result into one MetaFor personality and saves it.
async function rebuildPersonality(user, profile) {
  const userId = user._id;
  const results = await latestResults(userId, profile);
  const traits = combineTraits(results, profile);
  const ranking = rankTypes(traits);
  const stats = listeningStats(profile);
  const quizResults = results.map(({ quizId, quizTitle, title, subtitle }) => ({
    quizId,
    quizTitle,
    title,
    subtitle,
  }));
  const moodPatterns = await getMoodPatterns(userId);

  // Every row of the "how it adds up" table: one per quiz, then Spotify.
  const round = (value) =>
    typeof value === "number" ? Number(value.toFixed(2)) : null;
  const evidence = spotifyEvidence(profile);
  const signals = spotifySignals(profile);
  const sources = [
    ...results.map((result) => ({
      kind: "quiz",
      id: result.quizId,
      label: result.quizTitle,
      result: result.title,
      traits: Object.fromEntries(
        Object.entries(result.traits).map(([id, value]) => [id, round(value)]),
      ),
    })),
    {
      kind: "spotify",
      id: "spotify",
      label: "Your Spotify listening",
      result: stats.topArtist
        ? `Top artist: ${stats.topArtist}`
        : "Listening data",
      traits: Object.fromEntries(
        Object.entries(signals).map(([id, value]) => [id, round(value)]),
      ),
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

  return savePersonality(userId, {
    typeId,
    match: ranking.find((item) => item.id === typeId).match,
    runnerUpId: runnerUp.id,
    runnerUpMatch: runnerUp.match,
    headline:
      analysis?.headline ??
      `So far you lean ${traits.map((trait) => trait.poleName).join(", ")}.`,
    insights: analysis?.insights ?? traits.map((trait) => trait.trait),
    summary: analysis?.summary ?? closingLine(typeId),
    traits,
    quizResults,
    sources,
    weights: {
      quizzes: Number((1 - spotifyWeight(profile)).toFixed(2)),
      spotify: spotifyWeight(profile),
    },
    ranking: ranking.map(({ id, match }) => ({
      id,
      name: publicType(id).name,
      match,
    })),
    moodLink: moodLink(moodPatterns, stats, await lastMonthMood(user)),
    stats,
    source: analysis ? "llm" : "scoring",
  });
}

// Check whether saved quiz results need rebuilding.
async function isOutdated(userId, personality, profile) {
  const results = await latestResults(userId, profile);
  const titles = (list) =>
    list
      .map((result) => `${result.quizId}:${result.quizTitle}:${result.title}`)
      .join("|");

  return (
    titles(results) !== titles(personality.quizResults) ||
    personality.weights?.spotify !== spotifyWeight(profile)
  );
}

function formatPersonality(personality) {
  // Personalities saved before quiz results were recorded are out of date.
  if (!personality?.quizResults?.length) return null;

  return {
    type: { ...publicType(personality.typeId), match: personality.match },
    runnerUp: {
      ...publicType(personality.runnerUpId),
      match: personality.runnerUpMatch,
    },
    headline: personality.headline,
    insights: personality.insights,
    // Read live, so edits to a type's closing line show without a rebuild.
    summary:
      personality.source === "llm"
        ? personality.summary
        : closingLine(personality.typeId),
    traits: personality.traits,
    quizResults: personality.quizResults,
    sources: personality.sources,
    // What listening counts for once there's enough of it. Added here, not saved, so older personalities get it too.
    weights: personality.weights && {
      ...personality.weights,
      full: SPOTIFY_WEIGHT,
    },
    ranking: personality.ranking,
    moodLink: personality.moodLink,
    stats: personality.stats,
    source: personality.source,
    updatedAt: personality.updatedAt,
  };
}

// GET /api/quiz
export async function getQuizzes(req, res) {
  const results = await latestResults(
    req.user._id,
    await buildListeningProfile(req.user),
  );

  res.json(
    QUIZZES.map((quiz) => {
      const result = results.find((item) => item.quizId === quiz.id);

      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        questionCount: quiz.questions.length,
        needsBirthday: Boolean(quiz.needsBirthday),
        outcomes: quiz.outcomes,
        outcomeNote: quiz.outcomeNote ?? null,
        latestResult: result
          ? { title: result.title, subtitle: result.subtitle }
          : null,
      };
    }),
  );
}

// GET /api/quiz/types The six MetaFor types, for the Personality page.
export function getPersonalityTypes(req, res) {
  res.json(describeTypes());
}

// GET /api/quiz/personality
export async function getPersonality(req, res) {
  const userId = req.user._id;
  let personality = await findPersonality(userId);

  // Rebuild if it was saved before the "how it adds up" data, or the quiz results changed (rename, new listening).
  if (!personality?.quizResults?.length) {
    return res.json(formatPersonality(personality));
  }

  const profile = await buildListeningProfile(req.user);
  if (
    !personality.sources ||
    (await isOutdated(userId, personality, profile))
  ) {
    personality = await rebuildPersonality(req.user, profile);
  }

  // Worked out live, so they follow the latest listening and journal without a rebuild.
  const [moodPatterns, lastMonth] = await Promise.all([getMoodPatterns(userId), lastMonthMood(req.user)]);
  res.json({
    ...formatPersonality(personality),
    song: songForType(profile, personality.traits),
    moodLink: moodLink(moodPatterns, listeningStats(profile), lastMonth),
  });
}

// GET /api/quiz/mood-music
export async function getMoodMusic(req, res) {
  res.json(await moodMusic(req.user));
}

// GET /api/quiz/genre-mix
export async function getGenreMix(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json((await buildListeningProfile(req.user)).genreMix);
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

  const attempt = await findLatestAttempt(req.user._id, quiz.id);
  const result =
    attempt && evaluateAttempt(attempt, await buildListeningProfile(req.user));

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
  const stored = Object.fromEntries(
    quiz.questions.map((question) => [question.id, answers[question.id]]),
  );
  if (quiz.needsBirthday) stored.birthday = answers.birthday;

  const profile = await buildListeningProfile(req.user);
  const attempt = await addQuizAttempt({
    userId: req.user._id,
    quizId: quiz.id,
    answers: stored,
  });
  const result = evaluateAttempt(attempt, profile);
  const personality = await rebuildPersonality(req.user, profile);

  res.status(201).json({ result, personality: formatPersonality(personality) });
}
