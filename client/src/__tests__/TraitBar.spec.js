import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TraitBar from '../components/personality/TraitBar.vue'

const mountBar = (score) =>
  mount(TraitBar, {
    props: { trait: { label: 'Focus', firstPoleName: 'Wordsmith', secondPoleName: 'Soundscaper', score } },
  })

describe('A trait bar', () => {
  it('shows a full lean to the second side clearly', () => {
    const bar = mountBar(-1)
    expect(bar.find('.is-lean').text()).toBe('100% Soundscaper')
    expect(bar.find('.trait-fill').classes()).toContain('is-second')
    expect(bar.find('.trait-fill').attributes('style')).toContain('width: 50%')
    expect(bar.find('[role="meter"]').attributes('aria-label')).toBe('Focus: 100% Soundscaper')
  })

  it('shows a full lean to the first side clearly', () => {
    const bar = mountBar(1)
    expect(bar.find('.is-lean').text()).toBe('Wordsmith 100%')
    expect(bar.find('.trait-fill').classes()).not.toContain('is-second')
  })

  it('picks no side when the score is about even', () => {
    const bar = mountBar(0.02)
    expect(bar.find('.is-lean').exists()).toBe(false)
    expect(bar.find('.trait-balanced').text()).toBe('Balanced')
    expect(bar.find('.trait-fill').attributes('style')).toContain('width: 0%')
  })
})
