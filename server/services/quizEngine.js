// Shared helpers for the quizzes in data/quizzes/.
//
// Every quiz question has options, and every option adds points to one or
// more of the quiz's dimensions, e.g. { E: 2 } or { L: 1, G: 2 }. A quiz's
// evaluate() turns those totals into its fixed result, so retaking a quiz
// with the same answers always gives the same result, without an LLM.

export function clamp(value, min = -1, max = 1) {
  return Math.min(max, Math.max(min, value));
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

  return quiz.validateExtras?.(answers) ?? null;
}

export function tallyAnswers(quiz, answers) {
  const totals = Object.fromEntries(quiz.dimensions.map((dimension) => [dimension, 0]));

  for (const question of quiz.questions) {
    const option = question.options.find((item) => item.id === answers[question.id]);

    for (const [dimension, points] of Object.entries(option.scores)) {
      totals[dimension] += points;
    }
  }

  return totals;
}

// Compares two opposing dimensions, from -1 (all `second`) to 1 (all `first`).
export function balance(totals, first, second) {
  const sum = totals[first] + totals[second];
  return sum === 0 ? 0 : (totals[first] - totals[second]) / sum;
}

// Each dimension's share of all the points, as whole percentages.
export function shares(totals) {
  const sum = Object.values(totals).reduce((total, value) => total + Math.max(value, 0), 0);

  return Object.fromEntries(
    Object.entries(totals).map(([dimension, value]) => [
      dimension,
      sum === 0 ? 0 : Math.round((Math.max(value, 0) / sum) * 100),
    ]),
  );
}

// The dimension with the most points. Ties go to the earlier dimension.
export function topDimension(totals, order = Object.keys(totals)) {
  return order.reduce((best, dimension) => (totals[dimension] > totals[best] ? dimension : best));
}

// Breakdown rows shown on a quiz's result page.
export function scaleRow(label, firstName, secondName, score) {
  return { kind: "scale", label, firstPoleName: firstName, secondPoleName: secondName, score };
}

export function shareRow(label, percent) {
  return { kind: "share", label, percent };
}

export function percent(value) {
  return Math.round(value * 100);
}
