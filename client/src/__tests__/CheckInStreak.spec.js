import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import CheckInStreak from '../components/dashboard/CheckInStreak.vue'
import { getStreak } from '@/api/moods'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/api/moods', () => ({ getStreak: vi.fn(), getMoods: vi.fn() }))

const mountStreak = () =>
  mount(CheckInStreak, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })

describe('Check-in streak', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    useAuthStore().user = { id: 'user-1' }
  })

  it('shows the streak, its savers and a link to check in', async () => {
    getStreak.mockResolvedValue({
      days: 8,
      checkedInToday: false,
      savers: 1,
      maxSavers: 2,
      nextSaverIn: 6,
      savedYesterday: false,
    })
    const streak = mountStreak()
    await flushPromises()

    expect(streak.find('.streak-count').text()).toBe('8 days in a row')
    expect(streak.find('.streak-note').text()).toContain('Check in today to keep it going.')
    expect(streak.find('.streak-link').exists()).toBe(true)
    expect(streak.findAll('.saver')).toHaveLength(2)
    expect(streak.findAll('.saver.is-earned')).toHaveLength(1)
  })

  it('says when a saver covered yesterday, and counts down once checked in', async () => {
    getStreak.mockResolvedValue({
      days: 8,
      checkedInToday: false,
      savers: 0,
      maxSavers: 2,
      nextSaverIn: 6,
      savedYesterday: true,
    })
    const saved = mountStreak()
    await flushPromises()
    expect(saved.find('.streak-note').text()).toContain('A streak saver covered yesterday.')

    getStreak.mockResolvedValue({
      days: 9,
      checkedInToday: true,
      savers: 0,
      maxSavers: 2,
      nextSaverIn: 5,
      savedYesterday: false,
    })
    const today = mountStreak()
    await flushPromises()
    expect(today.find('.streak-note').text()).toBe(
      'Checked in today. 5 more days to earn a streak saver.',
    )
    expect(today.find('.streak-link').exists()).toBe(false)
  })

  it('stays hidden when signed out', async () => {
    useAuthStore().user = null
    const streak = mountStreak()
    await flushPromises()
    expect(getStreak).not.toHaveBeenCalled()
    expect(streak.find('.check-in-streak').exists()).toBe(false)
  })
})
