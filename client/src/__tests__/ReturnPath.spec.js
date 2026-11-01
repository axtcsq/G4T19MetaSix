import { describe, expect, it } from 'vitest'
import { returnPath } from '@/utils/returnPath'

describe('login return path', () => {
  it('preserves internal destinations and rejects external or ambiguous URLs', () => {
    expect(returnPath('/calendar?month=10#today')).toBe('/calendar?month=10#today')
    for (const path of [null, [], 'https://evil.test', '//evil.test', '/\\evil.test', '/\n/evil.test']) {
      expect(returnPath(path)).toBe('/dashboard')
    }
  })
})
