import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicMoodsCard from '../components/dashboard/MusicMoodsCard.vue'

const data = {
  lens: 'lyrics',
  plays: 100,
  comparedDays: 8,
  matchedDays: 2,
  axes: [
    { axis: 'happy', share: 22 },
    { axis: 'sad', share: 56 },
    { axis: 'angry', share: 22 },
  ],
  moods: [
    { name: 'Melancholic', axis: 'sad', plays: 40, share: 40, mixed: false },
    { name: 'Aggressive', axis: 'angry', plays: 22, share: 22, mixed: false },
    { name: 'Euphoric', axis: 'happy', plays: 18, share: 18, mixed: false },
    { name: 'Bittersweet', axis: 'sad', plays: 20, share: 20, mixed: true },
  ],
}

describe("Your Music's Moods", () => {
  it('lists each big mood with the song moods inside it', () => {
    const card = mount(MusicMoodsCard, { props: { data } })
    const groups = card.findAll('.mood-group')

    expect(groups.map((group) => group.find('strong').text())).toEqual(['Sad', 'Happy', 'Angry'])
    expect(groups.at(0).find('.group-share').text()).toBe('56%')
    expect(groups.at(0).find('.group-songs').text()).toContain('Melancholic 40%')
    expect(groups.at(0).find('.group-songs').text()).toContain('Bittersweet* 20%')
    expect(card.text()).toContain('* Also counts partly as another mood.')
  })

  it('says the biggest mood in plain words', () => {
    const card = mount(MusicMoodsCard, { props: { data } })

    expect(card.find('.insight-text').text()).toBe(
      'Mostly Sad (56%), led by Melancholic songs. Matched your mood on 2 of 8 logged days.',
    )
    expect(card.find('.source-note').text()).toBe('From sound and lyrics · last 14 days · 100 plays')
  })
})
