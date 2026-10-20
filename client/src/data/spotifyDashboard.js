// Aggregate only the returned Spotify plays; absent dates are not evidence of no listening.
export function getDashboard(period, history = [], now = new Date()) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (period === 'weekly') start.setDate(start.getDate() - 6)
  else start.setDate(1)
  const items = history.filter(({ track, played_at }) => {
    const time = new Date(played_at).getTime()
    return track?.id && time >= start.getTime() && time <= now.getTime()
  })
  const songs = new Map()
  const artists = new Map()
  const hourly = Array(24).fill(0)
  const daily = []
  for (const date = new Date(start); date <= now; date.setDate(date.getDate() + 1)) {
    daily.push({
      date: date.toLocaleDateString('en-CA'),
      label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: 0,
    })
  }
  // Repeated songs count once per play; collaborations count for each credited artist.
  for (const { track, played_at } of items) {
    hourly[new Date(played_at).getHours()]++
    const date = new Date(played_at).toLocaleDateString('en-CA')
    daily.find((day) => day.date === date).value++
    const song = songs.get(track.id) || {
      id: track.id,
      title: track.name,
      artist: track.artists?.map((artist) => artist.name).join(', ') || '',
      art: track.album?.images?.[0]?.url,
      url: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
      record: track,
      [period]: 0,
    }
    song[period]++
    songs.set(track.id, song)
    for (const artist of track.artists || []) {
      const row = artists.get(artist.id || artist.name) || {
        name: artist.name,
        art: track.album?.images?.[0]?.url,
        album: track.album?.name,
        query: artist.name,
        url: artist.external_urls?.spotify || spotifySearch(artist.name),
        [period]: 0,
      }
      row[period]++
      artists.set(artist.id || artist.name, row)
    }
  }
  const peak = hourly.indexOf(Math.max(...hourly))
  const formatDate = (date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  return {
    period,
    date: `${formatDate(start)} to ${formatDate(now)}`,
    tracks: songs.size,
    plays: items.length,
    artistsCount: artists.size,
    artists: [...artists.values()].sort((a, b) => b[period] - a[period]).slice(0, 5),
    songs: [...songs.values()].sort((a, b) => b[period] - a[period]).slice(0, 5),
    hourly,
    daily,
    repeatListening: [
      { name: 'First play in returned history', value: songs.size, color: '#8caa9b' },
      { name: 'Repeat plays', value: items.length - songs.size, color: '#a54b3b' },
    ],
    metric: 'plays',
    peak: items.length
      ? new Date(2000, 0, 1, peak).toLocaleTimeString([], { hour: 'numeric' })
      : null,
  }
}
export const spotifySearch = (query) =>
  `https://open.spotify.com/search/${encodeURIComponent(query)}`
