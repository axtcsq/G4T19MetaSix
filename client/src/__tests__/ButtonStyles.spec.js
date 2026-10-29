import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

describe('shared button theme', () => {
  it.each([
    ['solid', 'glass-action'],
    ['outline', 'glass-secondary'],
    ['soft', 'glass-secondary'],
    ['ghost', 'glass-text'],
  ])('uses the shared style for %s buttons', (variant, className) => {
    const router = createRouter({ history: createMemoryHistory(), routes: [] })
    const wrapper = mount(UButton, {
      props: { variant },
      slots: { default: 'Action' },
      global: { plugins: [router] },
    })
    expect(wrapper.classes()).toContain(className)
    expect(wrapper.text()).toBe('Action')
    wrapper.unmount()
  })
})
