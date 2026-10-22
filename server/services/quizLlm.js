import Anthropic from "@anthropic-ai/sdk";
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

// Claude Haiku 5.5 is tried first when ANTHROPIC_API_KEY is set: it is the
// cheapest and fastest Claude model, and low effort keeps its thinking short.
// Groq (GROQ_API_KEY, shared with the Daily Mood journal helper) comes next.
// Both keys stay in server/.env and are never sent to the client.
const CLAUDE_MODEL = "claude-haiku-5-5";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-20b";
// Long enough for the model's reasoning plus the JSON reply.
const MAX_TOKENS = 1500;
// Patterns falls back to the next provider rather than keep the user waiting.
const TIMEOUT_MS = 15000;

let claude = null;
function claudeClient() {
  claude ??= new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 1 });
  return claude;
}

// The exact shape of the reply, so the model returns every field and only one
// of the candidate types. Groq also takes list lengths; for Claude the length
// is checked afterwards by isValidAnalysis.
function analysisSchema(typeIds, { listLengths = false } = {}) {
  return {
    type: "object",
    properties: {
      typeId: { type: "string", enum: typeIds },
      headline: { type: "string" },
      // Before insights: the model writes fields in order and tends to stop
      // after a list, so the last field was often dropped.
      summary: { type: "string" },
      insights: listLengths
        ? { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 }
        : { type: "array", items: { type: "string" } },
    },
    required: ["typeId", "headline", "summary", "insights"],
    additionalProperties: false,
  };
}

// Returns the raw text of Claude's reply, which follows the schema.
async function callClaude(prompt, typeIds) {
  const response = await claudeClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: analysisSchema(typeIds) },
    },
  });

  // A refusal or a cut-off reply has no usable JSON.
  if (response.stop_reason !== "end_turn") {
    throw new Error(`Claude stopped early (${response.stop_reason})`);
  }
  const text = response.content.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Claude returned no text");
  return text;
}

// Returns the raw text of Groq's reply, which follows the schema.
async function callGroq(prompt, typeIds) {
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "personality_analysis",
          strict: true,
          schema: analysisSchema(typeIds, { listLengths: true }),
        },
      },
      temperature: 0.7,
      reasoning_effort: "low",
      max_completion_tokens: MAX_TOKENS,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Groq ${response.status}: ${body.error?.message ?? "request failed"}`);
    error.status = response.status;
    throw error;
  }

  const text = body.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned no text");
  return text;
}

// The providers that have a key, in the order they're tried.
function providers() {
  return [
    process.env.ANTHROPIC_API_KEY && { name: "Claude", call: callClaude, retries: 0 },
    // Groq rejects a reply that doesn't match the schema with a 400. Its model
    // sometimes drops a field, so that gets one more try.
    process.env.GROQ_API_KEY && { name: "Groq", call: callGroq, retries: 1 },
  ].filter(Boolean);
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

Then fill in all four fields, writing in the second person:
1. "typeId": the id of the type you chose.
2. "headline": one sentence.
3. "summary": a warm closing line of 1 to 2 sentences for their type, like a send-off. Don't list or repeat the quiz results, since the page already shows them.
4. "insights": exactly 3 short insights, each pointing to a specific pattern in the data above (an artist, a stat or a trait) and saying what it suggests about them.

Rules:
- Keep it warm and light. This is for fun: do not diagnose, mention mental health conditions or give advice.
- If the mood logs show many sad, anxious or angry entries, you may gently acknowledge that music seems to be a comfort, but do not dwell on it.
- Headline at most 140 characters, each insight at most 240 characters, summary at most 280 characters.

Reply with JSON only, no markdown, in this shape:
{"typeId": "...", "headline": "...", "summary": "...", "insights": ["...", "...", "..."]}`;
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

// Tries each provider in turn and returns the first usable analysis, or null
// so the caller uses the scoring result.
export async function analysePersonality(input) {
  const typeIds = input.ranking.slice(0, CANDIDATE_COUNT).map((type) => type.id);
  const prompt = buildAnalysisPrompt(input);

  for (const provider of providers()) {
    for (let attempt = 0; attempt <= provider.retries; attempt++) {
      try {
        const analysis = parseJson(await provider.call(prompt, typeIds));
        if (isValidAnalysis(analysis, input.ranking)) return analysis;
        console.error(`[Quiz] ${provider.name} analysis was rejected:`, analysis);
        break;
      } catch (error) {
        console.error(`[Quiz] ${provider.name} could not analyse personality:`, error.message);
        if (error.status !== 400) break;
      }
    }
  }
  return null;
}
