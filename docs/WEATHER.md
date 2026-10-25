# Garden weather

The garden displays automatic current Singapore weather. No weather controls, geolocation, preview selection or export appear in the dashboard. The reusable composable retains those capabilities for other consumers.

`api/weather.js` calls Open-Meteo's current forecast endpoint with Singapore coordinates, temperature, WMO weather code, day/night and wind speed. It validates the response and times out after 12 seconds. An optional VITE_WEATHER_API_URL overrides the endpoint for local simulations. See [Open-Meteo documentation](https://open-meteo.com/en/docs).

`useGardenWeather` refreshes every 15 minutes while the page is visible, cancels obsolete requests, and retains the last successful result after a refresh failure. No location data is persisted. Weather animations use the garden clock and respect Pause, reduced motion, document visibility and viewport suspension.

Run `pnpm exec vitest run src/__tests__/Weather.spec.js` to verify response parsing and weather-code mappings. The shared browser verification is `node scripts/check-spotify.mjs <local-vite-url>`; its simulated history does not prove live weather availability.
