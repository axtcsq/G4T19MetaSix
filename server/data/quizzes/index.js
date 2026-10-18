import { auxAlignment } from "./auxAlignment.js";
import { loveOnRepeat } from "./loveOnRepeat.js";
import { musicalNeeds } from "./musicalNeeds.js";
import { musicMbti } from "./musicMbti.js";
import { soundwoods } from "./soundwoods.js";
import { spotifyHoroscope } from "./spotifyHoroscope.js";

// Every quiz on the Personality page, in the order the cards appear.
//
// A quiz has an id, title, description, the dimensions its options score,
// its questions, and evaluate(answers, spotifyProfile), which returns its
// fixed result plus `traits`: how the result scores on the MetaFor traits
// (data/metaforTraits.js) that the Patterns section combines.
export const QUIZZES = [musicMbti, spotifyHoroscope, auxAlignment, loveOnRepeat, soundwoods, musicalNeeds];

export function findQuiz(id) {
  return QUIZZES.find((quiz) => quiz.id === id);
}
