import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { fetchWeather, weatherScenes } from '@/api/weather'

export function useGardenWeather() {
  const current = ref(null)
  const preview = ref('live')
  const place = ref('Singapore')
  const busy = ref(false)
  const locating = ref(false)
  const error = ref('')
  let coordinates = { latitude: 1.3521, longitude: 103.8198 }
  let controller,
    interval,
    disposed = false,
    locationRequest = 0
  const scene = computed(() =>
    preview.value === 'live'
      ? current.value
      : {
          condition: preview.value,
          isDay: preview.value !== 'night',
          wind: preview.value === 'wind' ? 42 : 12,
        },
  )
  const description = computed(() => {
    if (preview.value !== 'live')
      return `${preview.value === 'night' ? 'Moonlight' : preview.value === 'wind' ? 'Windy' : weatherScenes[preview.value]} · Preview`
    if (!current.value) return busy.value ? 'Checking the sky…' : 'Weather unavailable'
    return `${weatherScenes[current.value.condition]} · ${Math.round(current.value.temperature)}°C · ${place.value}`
  })
  async function refresh() {
    controller?.abort()
    const request = new AbortController()
    controller = request
    busy.value = true
    error.value = ''
    try {
      const result = await fetchWeather(coordinates, { signal: request.signal })
      if (!disposed && controller === request) current.value = result
    } catch {
      if (!disposed && controller === request && !request.signal.aborted) {
        error.value = current.value
          ? 'Could not refresh weather. Showing the last update.'
          : 'Weather could not load. Try again or preview a sky.'
      }
    } finally {
      if (!disposed && controller === request) busy.value = false
    }
  }
  function useLocation() {
    if (!navigator.geolocation) {
      error.value = 'Location is unavailable in this browser. Singapore weather is still available.'
      return
    }
    locating.value = true
    error.value = ''
    const request = ++locationRequest
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (disposed || request !== locationRequest) return
        locating.value = false
        coordinates = { latitude: coords.latitude, longitude: coords.longitude }
        place.value = 'Your location'
        current.value = null
        preview.value = 'live'
        refresh()
      },
      () => {
        if (disposed || request !== locationRequest) return
        locating.value = false
        error.value =
          'Location could not be accessed. Allow location access in your browser and try again.'
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }
  onMounted(() => {
    refresh()
    interval = window.setInterval(
      () => {
        if (!document.hidden) refresh()
      },
      15 * 60 * 1000,
    )
  })
  onBeforeUnmount(() => {
    disposed = true
    controller?.abort()
    window.clearInterval(interval)
  })
  return { current, preview, scene, description, busy, locating, error, refresh, useLocation }
}
