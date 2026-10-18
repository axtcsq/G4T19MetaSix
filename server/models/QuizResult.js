import mongoose from "mongoose";

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

// One finished quiz attempt.
// TODO: add the user's id once auth is merged, and filter every query by it.
const quizResultSchema = new mongoose.Schema(
  {
    quizId: { type: String, required: true },
    traits: { type: [traitSchema], required: true },
  },
  {
    timestamps: true,
    collection: "quizresults",
  },
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
    quizzesTaken: [String],
    stats: mongoose.Schema.Types.Mixed,
    source: { type: String, enum: ["llm", "scoring"] },
  },
  {
    timestamps: true,
    collection: "personalities",
  },
);

const QuizResult = mongoose.models.QuizResult || mongoose.model("QuizResult", quizResultSchema);
const Personality = mongoose.models.Personality || mongoose.model("Personality", personalitySchema);

export function addQuizResult(result) {
  return QuizResult.create(result);
}

// The most recent result of each quiz, so retaking a quiz replaces its old answers.
export function retrieveLatestQuizResults() {
  return QuizResult.aggregate([
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$quizId", result: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$result" } },
  ]);
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

export default QuizResult;
