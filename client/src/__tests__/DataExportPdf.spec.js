import { describe, expect, it } from 'vitest'
import { dataExportItems, wrapText } from '../utils/dataExportPdf'

const DATA = {
  exportedAt: '2026-11-05T09:00:00.000Z',
  account: { displayName: 'Sam', timezone: 'Asia/Singapore', birthday: null, spotifyLinked: true },
  journal: [
    {
      createdAt: '2026-11-04T09:00:00.000Z',
      mood: 'Happy',
      journal: 'A good day.',
      song: { name: 'Dance!', artists: ['Lotus Juice'] },
      hasDrawing: true,
      hasPhoto: true,
    },
  ],
  quizAttempts: [
    { createdAt: '2026-11-04T09:00:00.000Z', quizId: 'music-mbti', answers: { a: 1, b: 2 } },
    { createdAt: '2026-10-04T09:00:00.000Z', quizId: 'music-mbti', answers: { a: 1 } },
  ],
  listens: [
    { playedAt: '2026-11-04T09:00:00.000Z', track: { name: 'ダンス', artists: ['アトラス'] } },
    { playedAt: '2026-11-03T09:00:00.000Z', track: null },
  ],
}
const QUIZZES = [{ id: 'music-mbti', title: 'Music MBTI', latestResult: { title: 'INFP', subtitle: 'The Dreamer' } }]
const texts = (items) => items.map(([, text]) => text).join('\n')

describe('The exported data', () => {
  it('includes every section with its contents', () => {
    const text = texts(dataExportItems(DATA, QUIZZES))
    expect(text).toContain('Name: Sam')
    expect(text).toContain('Journal (1)')
    expect(text).toContain('A good day.')
    expect(text).toContain('Song of the Day: Dance! by Lotus Juice')
    expect(text).toContain('a drawing and a photo')
    expect(text).toContain('Listening history (2)')
    expect(text).toContain('ダンス by アトラス')
    expect(text).toContain('Unknown song')
  })

  it('gives the result only to the newest attempt, which is the one it belongs to', () => {
    const text = texts(dataExportItems(DATA, QUIZZES))
    expect(text).toContain('Quizzes (2)')
    expect(text.match(/Result: INFP, The Dreamer/g)).toHaveLength(1)
    expect(text).toContain('2 answers saved')
    expect(text).toContain('1 answer saved')
  })

  it('still works with no history at all, or without the quiz list', () => {
    const text = texts(dataExportItems({ exportedAt: DATA.exportedAt, account: {} }))
    expect(text).toContain('No journal entries.')
    expect(text).toContain('No quizzes taken.')
    expect(text).toContain('No plays saved.')
    expect(texts(dataExportItems(DATA))).toContain('music-mbti')
  })
})

describe('Wrapping text in the PDF', () => {
  const fits = (line) => line.length <= 10

  it('breaks at spaces, and keeps line breaks', () => {
    expect(wrapText('one two three\nfour', fits)).toEqual(['one two', 'three', 'four'])
  })

  it('breaks text with no spaces between characters', () => {
    expect(wrapText('あいうえおかきくけこさしすせそ', fits)).toEqual(['あいうえおかきくけこ', 'さしすせそ'])
  })
})
