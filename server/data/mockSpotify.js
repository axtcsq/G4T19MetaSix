// Stand-in for the user's Spotify data until the Spotify API set-up is merged.
// Field names follow the Spotify Web API (top artists, top tracks) and
// ReccoBeats audio features, so the real data can replace this object directly.
export const mockSpotifyProfile = {
  displayName: "Demo Listener",
  topArtists: [
    { name: "Laufey", genres: ["jazz pop", "bedroom pop"] },
    { name: "Keshi", genres: ["bedroom r&b", "lo-fi"] },
    { name: "Phoebe Bridgers", genres: ["indie folk", "sad indie"] },
    { name: "NewJeans", genres: ["k-pop"] },
    { name: "Daft Punk", genres: ["electro", "french house"] },
  ],
  topTracks: [
    { name: "From The Start", artist: "Laufey", energy: 0.45, valence: 0.62, danceability: 0.58, acousticness: 0.71, instrumentalness: 0.0, speechiness: 0.04 },
    { name: "Like I Need U", artist: "Keshi", energy: 0.38, valence: 0.33, danceability: 0.66, acousticness: 0.42, instrumentalness: 0.01, speechiness: 0.06 },
    { name: "Motion Sickness", artist: "Phoebe Bridgers", energy: 0.52, valence: 0.28, danceability: 0.43, acousticness: 0.31, instrumentalness: 0.0, speechiness: 0.03 },
    { name: "Super Shy", artist: "NewJeans", energy: 0.82, valence: 0.54, danceability: 0.78, acousticness: 0.19, instrumentalness: 0.0, speechiness: 0.08 },
    { name: "Get Lucky", artist: "Daft Punk", energy: 0.81, valence: 0.86, danceability: 0.79, acousticness: 0.04, instrumentalness: 0.03, speechiness: 0.05 },
    { name: "Something Real", artist: "Keshi", energy: 0.29, valence: 0.21, danceability: 0.55, acousticness: 0.64, instrumentalness: 0.12, speechiness: 0.04 },
  ],
  // Share of recent plays that were tracks already played in the last month.
  repeatListenRatio: 0.64,
};
