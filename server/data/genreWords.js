// The genres MetaFor has a word for, as [keyword, word, meaning]. A genre
// matches when it contains the keyword, and the first match wins, so more
// specific genres come first. Spotify Horoscope uses the word, and the
// listening profile prefers a top genre that has one.
export const GENRE_WORDS = [
  ["k-pop", "K-Pop", "glossy, high-production pop"],
  ["lo-fi", "Lo-fi", "soft, hazy beats"],
  ["jazz", "Jazzy", "smooth chords and swing"],
  ["metal", "Metal", "heavy riffs and raw power"],
  ["punk", "Punk", "fast, loud and rebellious songs"],
  ["rock", "Rock", "guitars and big choruses"],
  ["hip hop", "Hip-Hop", "rhythm and wordplay"],
  ["hip-hop", "Hip-Hop", "rhythm and wordplay"],
  ["rap", "Hip-Hop", "rhythm and wordplay"],
  ["r&b", "Silky", "smooth, soulful grooves"],
  ["rnb", "Silky", "smooth, soulful grooves"],
  ["soul", "Soulful", "warm, emotional vocals"],
  ["folk", "Folky", "acoustic storytelling"],
  ["country", "Country", "stories with a twang"],
  ["classical", "Classical", "orchestral, timeless pieces"],
  ["electro", "Electric", "synths and pulsing beats"],
  ["house", "Electric", "synths and pulsing beats"],
  ["edm", "Electric", "synths and pulsing beats"],
  ["indie", "Indie", "independent, offbeat sounds"],
  ["musical", "Theatrical", "showtunes and big stage moments"],
  ["broadway", "Theatrical", "showtunes and big stage moments"],
  ["soundtrack", "Cinematic", "film scores and sweeping themes"],
  ["video game", "Cinematic", "film scores and sweeping themes"],
  ["videogame", "Cinematic", "film scores and sweeping themes"],
  ["ambient", "Ambient", "slow, spacious soundscapes"],
  ["pop", "Poppy", "bright, catchy hooks"],
];

// { word, meaning } for a genre, or null when MetaFor has no word for it.
export function genreWord(genre) {
  const match = genre && GENRE_WORDS.find(([keyword]) => genre.includes(keyword));
  return match ? { word: match[1], meaning: match[2] } : null;
}
