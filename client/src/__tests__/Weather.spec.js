import { describe, expect, it } from 'vitest'
import { weatherCondition } from '../api/weather'

describe('WMO garden conditions', () => {
  it.each([
    [[0], 'clear'],
    [[1, 2], 'partly'],
    [[3], 'cloudy'],
    [[45, 48], 'fog'],
    [[51, 53, 55, 56, 57], 'drizzle'],
    [[61, 63, 65, 66, 67, 80, 81, 82], 'rain'],
    [[71, 73, 75, 77, 85, 86], 'snow'],
    [[95], 'storm'],
    [[96, 99], 'hail'],
  ])('maps %j to %s', (codes, scene) => {
    for (const code of codes) expect(weatherCondition(code)).toBe(scene)
  })
  it('does not silently present unsupported data as clear skies', () => {
    for (const value of [null, undefined, -1, 100, '63'])
      expect(weatherCondition(value)).toBe('unknown')
  })
})
