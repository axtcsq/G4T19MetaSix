import { genreWord } from "../genreWords.js";
import { clamp, percent } from "../../services/quizEngine.js";

// Spotify Horoscope: star sign (from the birthday) + top genre + average
// energy of the user's top tracks, e.g. "Jazzy Easygoing Libra".
// It has no questions; the user only gives their birthday.

// [sign, element, start month, start day]; each sign runs until the next starts.
const SIGNS = [
  ["Capricorn", "earth", 1, 1],
  ["Aquarius", "air", 1, 20],
  ["Pisces", "water", 2, 19],
  ["Aries", "fire", 3, 21],
  ["Taurus", "earth", 4, 20],
  ["Gemini", "air", 5, 21],
  ["Cancer", "water", 6, 21],
  ["Leo", "fire", 7, 23],
  ["Virgo", "earth", 8, 23],
  ["Libra", "air", 9, 23],
  ["Scorpio", "water", 10, 23],
  ["Sagittarius", "fire", 11, 22],
  ["Capricorn", "earth", 12, 22],
];

const SIGN_TRAITS = {
  Aries: "Bold and impatient, you want the song to start with the chorus.",
  Taurus: "Loyal to what feels good, you'll replay a comfort album for years.",
  Gemini: "Curious and restless, your queue changes genre every three songs.",
  Cancer: "Sentimental to the core, every song is attached to a memory.",
  Leo: "A natural performer, you sing like the whole room is your audience.",
  Virgo: "Detail-oriented, you notice the production choices nobody else hears.",
  Libra: "A seeker of harmony, you love music that's balanced and beautiful.",
  Scorpio: "Intense and private, you keep your deepest listening to yourself.",
  Sagittarius: "An adventurer, you'd fly across the world for the right festival.",
  Capricorn: "Ambitious and steady, you build playlists that get things done.",
  Aquarius: "An original, you were into that artist before anyone else.",
  Pisces: "A dreamer, you drift into music and come back changed.",
};

const ELEMENT_TRAITS = {
  fire: "As a fire sign, music is fuel: you play it to get moving.",
  air: "As an air sign, music is conversation: you love sharing and swapping songs.",
  earth: "As an earth sign, music is grounding: you return to what's reliable.",
  water: "As a water sign, music is feeling: you listen to process what's inside.",
};

const ENERGY_WORDS = [
  [0.75, "Fierce", "Your music runs hot: loud, fast and full of adrenaline."],
  [0.6, "Bold", "Your music has drive: upbeat and confident without being overwhelming."],
  [0.45, "Easygoing", "Your music sits in the middle: relaxed, but never sleepy."],
  [0.3, "Chill", "Your music keeps things calm: gentle tempos and soft edges."],
  [0, "Dreamy", "Your music floats: slow, quiet and atmospheric."],
];

export function starSign(month, day) {
  let sign = SIGNS[0];
  for (const entry of SIGNS) {
    if (month > entry[2] || (month === entry[2] && day >= entry[3])) sign = entry;
  }
  return { name: sign[0], element: sign[1] };
}

function parseBirthday(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCMonth() === month - 1 && date.getUTCDate() === day && date <= new Date() && year >= 1900;

  return valid ? { month, day } : null;
}

// null when none of the top tracks have audio features yet.
function averageEnergy(profile) {
  const values = profile.topTracks.map((track) => track.energy).filter((value) => typeof value === "number");
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export const spotifyHoroscope = {
  id: "spotify-horoscope",
  title: "Spotify Horoscope",
  description: "Your star sign, read through your top genres and energy.",
  // Every sign, for the list on the Personality page. The full result adds a
  // genre word and an energy word in front, e.g. "Jazzy Easygoing Libra".
  outcomes: Object.entries(SIGN_TRAITS).map(([name, meaning]) => {
    const element = SIGNS.find(([sign]) => sign === name)[1];
    return { name, tag: `${element[0].toUpperCase()}${element.slice(1)} sign`, meaning };
  }),
  outcomeNote: "Your full result puts a genre word and an energy word in front of your sign, like \"Jazzy Easygoing Libra\".",
  dimensions: [],
  questions: [],
  needsBirthday: true,

  validateExtras(answers) {
    return parseBirthday(answers.birthday) ? null : "Please enter a valid birthday";
  },

  evaluate(answers, profile) {
    const { month, day } = parseBirthday(answers.birthday);
    const sign = starSign(month, day);
    // The same top genre Patterns shows, worked out in the listening profile.
    const genre = profile.topGenre ?? null;
    const { word: genreName, meaning: genreMeaning } = genreWord(genre) ?? {
      word: "Eclectic",
      meaning: "a bit of everything",
    };
    const energy = averageEnergy(profile);
    const [, energyWord, energyMeaning] = ENERGY_WORDS.find(([minimum]) => (energy ?? 0.5) >= minimum);
    const title = `${genreName} ${energyWord} ${sign.name}`;

    return {
      resultId: `${genreName}-${energyWord}-${sign.name}`.toLowerCase(),
      title,
      subtitle: `${sign.name}, ${sign.element} sign`,
      headline: `Based on the quiz, we think you are ${/^[AEIOU]/.test(title) ? "an" : "a"} ${title}.`,
      description: `${SIGN_TRAITS[sign.name]} ${ELEMENT_TRAITS[sign.element]} Your stars are written in ${genreMeaning}. ${energyMeaning}`,
      justification: [
        `Your birthday makes you a ${sign.name}, ${["air", "earth"].includes(sign.element) ? "an" : "a"} ${sign.element} sign.`,
        genre ? `Your top genre is ${genre}, which makes you ${genreName}.` : "We couldn't find a top genre, so you're Eclectic.",
        energy === null
          ? `We couldn't read your tracks' energy yet, so you're ${energyWord} for now.`
          : `Your top tracks average ${percent(energy)}% energy, which makes you ${energyWord}.`,
      ],
      breakdown: [
        { kind: "tag", label: "Sign", value: sign.name },
        { kind: "tag", label: "Genre", value: genreName },
        { kind: "tag", label: "Energy", value: energyWord },
      ],
      // Fire and air signs lean Crowd, earth and water lean Solo.
      traits: {
        energy: clamp((energy - 0.5) * 2),
        setting: ["fire", "air"].includes(sign.element) ? 0.5 : -0.5,
      },
    };
  },
};
