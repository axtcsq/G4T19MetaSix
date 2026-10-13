import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import App from '../App.vue'
import router from '../router'

describe('App', () => {
  it('mounts the MetaFor shell with router context', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [router],
        stubs: {
          UApp: { template: '<div><slot /></div>' },
        },
      },
    })

    await router.isReady()

    expect(wrapper.text()).toContain('MetaFor')
  })
})
