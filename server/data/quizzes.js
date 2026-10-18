import { AXES as MUSIC_MBTI_AXES, STATIC_QUESTIONS as MUSIC_MBTI_QUESTIONS } from "./musicMbti.js";

// Every quiz the Personality page lists. A quiz measures one or more traits
// (its axes). Trait ids are shared across quizzes: when two quizzes both
// measure "energy", their scores are averaged into one MetaFor trait.
//
// Only Music MBTI has questions so far. The others are placeholders for the
// remaining cards in the Figma design; rename them and add `axes` and
// `questions` (same shape as musicMbti.js) to make one available.
export const QUIZZES = [
  {
    id: "music-mbti",
    title: "Music MBTI",
    description: "Find out what the way you listen says about you.",
    axes: MUSIC_MBTI_AXES,
    questions: MUSIC_MBTI_QUESTIONS,
  },
  {
    id: "spotify-horoscope",
    title: "Spotify Horoscope",
    description: "What your top tracks say about the week ahead.",
  },
  {
    id: "mood-soundtrack",
    title: "Mood Soundtrack",
    description: "Which songs do you reach for on each kind of day?",
  },
  {
    id: "lyric-lens",
    title: "Lyric Lens",
    description: "The lines you remember, and why they stick.",
  },
  {
    id: "genre-compass",
    title: "Genre Compass",
    description: "Map where your taste wanders.",
  },
  {
    id: "listening-rhythm",
    title: "Listening Rhythm",
    description: "When and how you press play.",
  },
];

export function findQuiz(id) {
  return QUIZZES.find((quiz) => quiz.id === id && quiz.questions);
}
