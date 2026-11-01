import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MonthMoods from '../components/dashboard/MonthMoods.vue'
import { getMoodInsights } from '@/api/listens'

vi.mock('@/api/listens', () => ({ getMoodInsights: vi.fn() }))

const mountMonth = () =>
  mount(MonthMoods, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })

describe('Month at a glance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('colours each day by its main music mood and sums up the month', async () => {
    getMoodInsights.mockResolvedValue({
      days: [
        { date: '2026-10-01', listenCount: 8, axes: { happy: 2, sad: 6 } },
        { date: '2026-10-02', listenCount: 3, axes: {} },
        { date: '2026-10-03', listenCount: 4, axes: { sad: 3, angry: 1 } },
      ],
    })
    const month = mountMonth()
    await flushPromises()

    expect(getMoodInsights).toHaveBeenCalledWith('2026-10-01', '2026-10-03')
    const days = month.findAll('.month-grid button')
    expect(days).toHaveLength(31)
    // October 2026 starts on a Thursday, the fourth column.
    expect(month.find('.month-grid li').attributes('style')).toContain('grid-column-start: 4')
    expect(days.at(0).attributes('aria-label')).toContain('mostly Sad · 8 plays')
    expect(days.at(1).attributes('aria-label')).toContain('3 plays, not analysed yet')
    expect(days.at(3).attributes('disabled')).toBeDefined()
    expect(month.find('.month-summary').text()).toBe('Mostly Sad: 2 of 2 listening days.')

    await days.at(2).trigger('click')
    expect(month.find('.month-readout').text()).toContain('mostly Sad · 4 plays')
    month.unmount()
  })

  it('goes back a month but not past this one', async () => {
    getMoodInsights.mockResolvedValue({ days: [] })
    const month = mountMonth()
    await flushPromises()

    expect(month.find('[aria-label="Next month"]').attributes('disabled')).toBeDefined()
    expect(month.find('.month-summary').text()).toContain('No analysed plays')
    await month.find('[aria-label="Previous month"]').trigger('click')
    await flushPromises()
    expect(getMoodInsights).toHaveBeenLastCalledWith('2026-09-01', '2026-09-30')
    expect(month.findAll('.month-grid button')).toHaveLength(30)
    month.unmount()
  })
})
