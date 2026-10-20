// Visual presets describe flowers, not specific artists or inferred music traits.
const flowerStyles = {
  rose: { color: '#c7837c', center: '#946044', petals: 9, fullness: 0.82 },
  bluebell: { color: '#8ea5b5', center: '#526a70', petals: 6, fullness: 0.64 },
  marigold: { color: '#d5aa63', center: '#8f6e38', petals: 12, fullness: 0.72 },
  daisy: { color: '#e7d9b8', center: '#aa8b47', petals: 11, fullness: 0.48 },
  sage: { color: '#c4cfbd', center: '#79865c', petals: 7, fullness: 0.7 },
}
// Positions use the renderer’s 1000 × 650 canvas.
const bloomPositions = [
  [490, 185],
  [285, 310],
  [710, 285],
  [450, 420],
  [755, 435],
]

function styleForArtist(name) {
  const styles = Object.values(flowerStyles)
  const nameHash = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0)
  return styles[nameHash % styles.length]
}

export function gardenParameters(data) {
  const artists = (data.artists || []).slice(0, bloomPositions.length)
  const maximumPlays = Math.max(1, ...artists.map((artist) => artist[data.period] || 0))
  // The renderer uses this fingerprint to reset motion when the period or counts change.
  const identity = `${data.period}:${artists.map((artist) => `${artist.name}:${artist[data.period]}`).join('|')}`
  const seed = [...identity].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    7,
  )
  return {
    seed,
    flowers: artists.map((artist, index) => ({
      // Stable name-based selection keeps the same artist's flower color across periods.
      ...styleForArtist(artist.name),
      artist: artist.name,
      plays: artist[data.period] || 0,
      x: bloomPositions[index][0],
      y: bloomPositions[index][1],
      // Square-root scaling keeps quieter artists visible beside the largest bloom.
      radius: 48 + Math.sqrt((artist[data.period] || 0) / maximumPlays) * 65,
      leaves: 2,
    })),
  }
}
