import mongoose from "mongoose";

// One finished quiz attempt. Only the answers are stored: results are worked
// out from them by the quiz's evaluate(), so the same answers always give the
// same result, and fixing a description updates past results too.
// TODO: add the user's id once auth is merged, and filter every query by it.
const quizAttemptSchema = new mongoose.Schema(
  {
    quizId: { type: String, required: true },
    answers: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
    collection: "quizattempts",
  },
);

const traitSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: String,
    score: { type: Number, required: true, min: -1, max: 1 },
    pole: String,
    poleName: String,
    oppositeName: String,
    firstPoleName: String,
    secondPoleName: String,
    strength: Number,
    trait: String,
  },
  { _id: false },
);

const quizSummarySchema = new mongoose.Schema(
  {
    quizId: String,
    quizTitle: String,
    title: String,
    subtitle: String,
  },
  { _id: false },
);

// The user's MetaFor personality, summarised from all their quiz results.
// It is rebuilt after each quiz so the Personality page doesn't need to call
// the LLM on every visit.
const personalitySchema = new mongoose.Schema(
  {
    typeId: { type: String, required: true },
    match: Number,
    runnerUpId: String,
    runnerUpMatch: Number,
    headline: String,
    insights: [String],
    summary: String,
    traits: [traitSchema],
    quizResults: [quizSummarySchema],
    stats: mongoose.Schema.Types.Mixed,
    source: { type: String, enum: ["llm", "scoring"] },
  },
  {
    timestamps: true,
    collection: "personalities",
  },
);

const QuizAttempt = mongoose.models.QuizAttempt || mongoose.model("QuizAttempt", quizAttemptSchema);
const Personality = mongoose.models.Personality || mongoose.model("Personality", personalitySchema);

export function addQuizAttempt(attempt) {
  return QuizAttempt.create(attempt);
}

// The most recent attempt at each quiz, so retaking a quiz replaces its old answers.
export function retrieveLatestAttempts() {
  return QuizAttempt.aggregate([
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$quizId", attempt: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$attempt" } },
  ]);
}

export function findLatestAttempt(quizId) {
  return QuizAttempt.findOne({ quizId }).sort({ createdAt: -1 });
}

export function savePersonality(personality) {
  return Personality.findOneAndUpdate({}, personality, {
    upsert: true,
    returnDocument: "after",
    runValidators: true,
  });
}

export function findPersonality() {
  return Personality.findOne();
}

export default QuizAttempt;
