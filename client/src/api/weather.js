export const weatherScenes = {
  clear: 'Clear',
  partly: 'Partly cloudy',
  cloudy: 'Overcast',
  fog: 'Foggy',
  drizzle: 'Drizzle',
  rain: 'Rain',
  snow: 'Snow',
  storm: 'Thunderstorm',
  hail: 'Hail',
}

export function weatherCondition(code) {
  if (code === 0) return 'clear'
  if ([1, 2].includes(code)) return 'partly'
  if (code === 3) return 'cloudy'
  if ([45, 48].includes(code)) return 'fog'
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow'
  if (code === 95) return 'storm'
  if ([96, 99].includes(code)) return 'hail'
  return 'unknown'
}

// Coordinates stay in memory. No key, account or location persistence is required.
export async function fetchWeather({ latitude, longitude }, { signal } = {}) {
  if (
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180
  ) {
    throw new Error('Invalid weather coordinates')
  }
  const query = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,weather_code,is_day,wind_speed_10m',
    timezone: 'auto',
  })
  const timeout = AbortSignal.timeout(12000)
  const response = await fetch(
    `${import.meta.env.VITE_WEATHER_API_URL || 'https://api.open-meteo.com/v1/forecast'}?${query}`,
    {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    },
  )
  if (!response.ok) throw new Error(`Weather request failed (${response.status})`)
  const { current } = await response.json()
  if (
    !current ||
    !Number.isFinite(current.temperature_2m) ||
    !Number.isFinite(current.wind_speed_10m) ||
    ![0, 1].includes(current.is_day) ||
    weatherCondition(current.weather_code) === 'unknown' ||
    typeof current.time !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(current.time)
  ) {
    throw new Error('Weather data is incomplete')
  }
  return {
    condition: weatherCondition(current.weather_code),
    temperature: current.temperature_2m,
    wind: Math.max(0, current.wind_speed_10m),
    isDay: current.is_day === 1,
    time: current.time,
  }
}
