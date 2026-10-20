import { describe, expect, it } from 'vitest'
import { gardenParameters } from '../components/dashboard/artworkModel'
describe('Spotify listening garden', () => {
  it('uses recorded plays to size flowers and keeps identity deterministic', () => {
    const data = {
      period: 'weekly',
      discovery: 0,
      artists: [
        { name: 'First', weekly: 8 },
        { name: 'Second', weekly: 2 },
      ],
    }
    const garden = gardenParameters(data)
    expect(garden.flowers.map((f) => f.artist)).toEqual(['First', 'Second'])
    expect(garden.flowers[0].radius).toBeGreaterThan(garden.flowers[1].radius)
    expect(gardenParameters(data)).toEqual(garden)
  })
  it('handles empty history without invalid geometry', () => {
    expect(gardenParameters({ period: 'weekly', artists: [] }).flowers).toEqual([])
    expect(
      Number.isFinite(
        gardenParameters({ period: 'weekly', artists: [{ name: 'New', weekly: 0 }] }).flowers[0]
          .radius,
      ),
    ).toBe(true)
  })
})
