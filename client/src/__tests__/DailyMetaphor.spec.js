import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DailyMetaphor from '../components/dashboard/DailyMetaphor.vue'
import { METAPHORS, metaphorFor } from '@/data/dailyMetaphors'

describe('Daily metaphor', () => {
  afterEach(() => vi.useRealTimers())

  it('keeps the same line all day and changes it the next day', () => {
    const morning = metaphorFor(new Date('2026-11-04T00:05:00'))
    expect(metaphorFor(new Date('2026-11-04T23:55:00'))).toBe(morning)
    expect(metaphorFor(new Date('2026-11-05T00:05:00'))).not.toBe(morning)
  })

  it('goes through every line before repeating', () => {
    const start = new Date('2026-01-01T12:00:00')
    const seen = new Set()
    for (let day = 0; day < METAPHORS.length; day++) {
      seen.add(metaphorFor(new Date(start.getFullYear(), start.getMonth(), start.getDate() + day, 12)))
    }
    expect(seen.size).toBe(METAPHORS.length)
  })

  it("shows today's line on Home", () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-04T09:00:00'))
    const card = mount(DailyMetaphor)
    expect(card.text()).toContain('Today’s metaphor')
    expect(card.find('blockquote').text()).toBe(metaphorFor(new Date('2026-11-04T09:00:00')))
  })
})
