import { Model, link } from '../src'
import { delay } from './utils'

describe('stream', () => {
  const expected = {
    key: 'foo',
    valueA: 'changed by A',
    valueB: 'changed by B'
  }

  it('end one stream', () => {
    const a = new Model()
    const b = new Model()

    const s1 = a.createStream()
    const s2 = b.createStream()

    expect(a.listenerCount('_update')).toBe(1)
    expect(b.listenerCount('_update')).toBe(1)

    link(s1, s2)

    s1.end()

    expect(a.listenerCount('_update')).toBe(0)
    expect(b.listenerCount('_update')).toBe(0)
  })
})
