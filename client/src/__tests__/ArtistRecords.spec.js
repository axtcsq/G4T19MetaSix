import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ArtistRecords from '../components/dashboard/ArtistRecords.vue'

const artists = [
  { name: 'Neck Deep', weekly: 8, url: 'https://open.spotify.com/artist/1', art: 'https://i.scdn.co/a' },
  { name: 'Trapt', weekly: 6, url: 'https://open.spotify.com/artist/2' },
  { name: 'Fleetwood Mac', weekly: 6, url: 'https://open.spotify.com/artist/3' },
  { name: 'Slipknot', weekly: 5, url: 'https://open.spotify.com/artist/4' },
  { name: 'American Authors', weekly: 4, url: 'https://open.spotify.com/artist/5' },
]

const px = (value) => parseFloat(value)

describe('Artist records', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
    }
    // jsdom has no layout, so give the list a width to pack into.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(450)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('gives the most played artist the biggest record', async () => {
    const records = mount(ArtistRecords, { props: { artists, period: 'weekly' } })
    await nextTick()

    const sizes = records
      .findAll('.record-item')
      .map((item) => px(item.attributes('style').match(/--record-size: ([\d.]+)px/)[1]))
    expect(sizes).toHaveLength(5)
    expect(sizes[0]).toBe(Math.max(...sizes))
    expect(sizes[4]).toBe(Math.min(...sizes))
    expect(records.find('.record-link').attributes('aria-label')).toBe(
      '1. Neck Deep, 8 recorded plays, on Spotify (opens new tab)',
    )
    records.unmount()
  })

  it('places every record without overlapping another', async () => {
    const records = mount(ArtistRecords, { props: { artists, period: 'weekly' } })
    await nextTick()

    // Each artist's record and the name under it. jsdom can't measure text, so names are sized the way the component estimates them there.
    const areas = records.findAll('.record-item').map((item, index) => {
      const style = item.element.style
      const size = px(item.attributes('style').match(/--record-size: ([\d.]+)px/)[1])
      const [left, top, width] = [px(style.left), px(style.top), px(style.width)]
      const name = artists[index].name.length * 8.5
      const lines = name > width ? 2 : 1
      const textWidth = Math.min(width, Math.max(name, 64))
      return {
        width,
        left,
        parts: [
          { left: left + (width - size) / 2, top, width: size, height: size },
          {
            left: left + (width - textWidth) / 2,
            top: top + size,
            width: textWidth,
            height: Math.ceil(12 + lines * 20.4 + 18),
          },
        ],
      }
    })
    const apart = (a, b) =>
      a.left + a.width <= b.left ||
      b.left + b.width <= a.left ||
      a.top + a.height <= b.top ||
      b.top + b.height <= a.top
    areas.forEach((artist, i) => {
      expect(artist.left).toBeGreaterThanOrEqual(0)
      expect(artist.left + artist.width).toBeLessThanOrEqual(450)
      areas.slice(i + 1).forEach((other) => {
        artist.parts.forEach((part) =>
          other.parts.forEach((otherPart) => expect(apart(part, otherPart)).toBe(true)),
        )
      })
    })
    records.unmount()
  })

  it('gives each record without album art its own label colour', async () => {
    const records = mount(ArtistRecords, { props: { artists, period: 'weekly' } })
    await nextTick()

    const colours = records
      .findAll('.record-label:not(.has-art)')
      .map((label) => label.element.style.background)
    expect(colours).toHaveLength(4)
    expect(new Set(colours).size).toBe(4)
    records.unmount()
  })
})
