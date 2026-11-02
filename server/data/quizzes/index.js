import { auxAlignment } from "./auxAlignment.js";
import { loveOnRepeat } from "./loveOnRepeat.js";
import { musicalNeeds } from "./musicalNeeds.js";
import { musicMbti } from "./musicMbti.js";
import { soundwoods } from "./soundwoods.js";
import { spotifyHoroscope } from "./spotifyHoroscope.js";

// Quizzes in the order shown on the Personality page.
export const QUIZZES = [musicMbti, spotifyHoroscope, auxAlignment, loveOnRepeat, soundwoods, musicalNeeds];

export function findQuiz(id) {
  return QUIZZES.find((quiz) => quiz.id === id);
}
