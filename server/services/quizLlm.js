import { PERSONALITY_TYPES } from "../data/personalityTypes.js";

// The LLM looks at the combined traits from every quiz the user has taken,
// together with their listening and mood patterns, picks the MetaFor
// personality type that fits best, and writes the Wrapped-style summary. Its
// choice is limited to the closest types from the scoring so results stay
// consistent. analysePersonality returns null when the LLM is unavailable or
// replies with something unusable, and the caller then uses the scoring
// result and static text instead.

// The LLM may choose among this many of the best-scoring types.
const CANDIDATE_COUNT = 3;

export function isLlmConfigured() {
  return Boolean(process.env.LLM_API_KEY);
}

// TODO: call the chosen LLM provider here. Keep the API key in server/.env
// (LLM_API_KEY) and never send it to the client. Ask the model for JSON only,
// then return the raw text of its reply.
async function callLlm(prompt) {
  void prompt;
  throw new Error("LLM provider not set up yet");
}

function candidateTypes(ranking) {
  return ranking
    .slice(0, CANDIDATE_COUNT)
    .map(({ id, match }) => ({ ...PERSONALITY_TYPES.find((type) => type.id === id), match }));
}

export function buildAnalysisPrompt({ traits, quizResults, ranking, stats, moodPatterns, profile }) {
  const candidates = candidateTypes(ranking)
    .map((type) => `- ${type.id} ("${type.name}", ${type.match}% match by score): ${type.description}`)
    .join("\n");

  const scores = traits
    .map((trait) => `- ${trait.label}: ${trait.poleName} over ${trait.oppositeName}, ${trait.strength}% lean`)
    .join("\n");

  const percentOrUnknown = (value) => (value === null ? "unknown" : `${value}%`);
  const listening = [
    `Top artists: ${profile.topArtists.map((artist) => artist.name).join(", ") || "unknown"}`,
    `Top track: ${stats.topTrack ?? "unknown"}`,
    `Top genre: ${stats.topGenre ?? "unknown"}`,
    `Average energy of top tracks: ${percentOrUnknown(stats.averageEnergy)}`,
    `Average happiness (valence) of top tracks: ${percentOrUnknown(stats.averageHappiness)}`,
    `Share of plays that were repeat listens: ${percentOrUnknown(stats.repeatListens)}`,
  ].join("\n");

  const moods = moodPatterns
    ? Object.entries(moodPatterns.counts)
        .map(([mood, count]) => `${mood}: ${count}`)
        .join(", ") + ` (from the last ${moodPatterns.total} mood logs)`
    : "No mood logs yet.";

  const results = quizResults
    .map((result) => `- ${result.quizTitle}: ${result.title} (${result.subtitle})`)
    .join("\n");

  return `You are the personality analyst for MetaFor, a music and mood journaling app. Write a result in the style of Spotify Wrapped: personal, specific and fun.

Their quiz results:
${results}

Traits, combined across all their quizzes:
${scores}

Listening data:
${listening}

Mood log patterns: ${moods}

Choose the personality type that fits this user best from these candidates only:
${candidates}

Then write, in the second person:
- a one-sentence headline,
- 3 short insights, each pointing to a specific pattern in the data above (an artist, a stat or a trait) and saying what it suggests about them,
- a summary: a warm closing line of 1 to 2 sentences for their type, like a send-off. Don't list or repeat the quiz results, since the page already shows them.

Rules:
- Keep it warm and light. This is for fun: do not diagnose, mention mental health conditions or give advice.
- If the mood logs show many sad, anxious or angry entries, you may gently acknowledge that music seems to be a comfort, but do not dwell on it.
- Headline at most 140 characters, each insight at most 240 characters, summary at most 280 characters.

Reply with JSON only, no markdown, in this shape:
{"typeId": "...", "headline": "...", "insights": ["...", "...", "..."], "summary": "..."}`;
}

function parseJson(text) {
  // Models sometimes wrap JSON in a markdown fence even when asked not to.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  return JSON.parse(cleaned);
}

function isValidAnalysis(analysis, ranking) {
  const allowed = ranking.slice(0, CANDIDATE_COUNT).map((type) => type.id);
  const isShortText = (value, max) => typeof value === "string" && value.trim() && value.length <= max;

  return (
    allowed.includes(analysis?.typeId) &&
    isShortText(analysis.headline, 140) &&
    isShortText(analysis.summary, 280) &&
    Array.isArray(analysis.insights) &&
    analysis.insights.length >= 2 &&
    analysis.insights.length <= 4 &&
    analysis.insights.every((insight) => isShortText(insight, 240))
  );
}

export async function analysePersonality(input) {
  if (!isLlmConfigured()) return null;

  try {
    const analysis = parseJson(await callLlm(buildAnalysisPrompt(input)));

    if (!isValidAnalysis(analysis, input.ranking)) {
      console.error("[Quiz] LLM analysis was rejected:", analysis);
      return null;
    }

    return analysis;
  } catch (error) {
    console.error("[Quiz] Could not analyse personality:", error.message);
    return null;
  }
}
