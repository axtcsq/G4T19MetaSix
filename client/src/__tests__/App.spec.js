import { afterEach, describe, it, expect, vi } from 'vitest'

import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '../App.vue'
import router from '../router'

afterEach(() => vi.unstubAllGlobals())

describe('App', () => {
  it('mounts the MetaFor shell with router context', async () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    })
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia(), router],
        stubs: {
          RouterView: true,
          ListeningDock: true,
          UApp: { template: '<div><slot /></div>' },
        },
      },
    })

    await router.isReady()

    expect(wrapper.text()).toContain('MetaFor')
    wrapper.unmount()
  })
})
