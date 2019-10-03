import { Model, link } from '../src'

describe('model', () => {
  const expected = {
    key: 'foo',
    value: 'changed by A'
  }
  it('change before sync', done => {
    const a = new Model('A')
    const b = new Model('B')

    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    a.set(expected.key, expected.value)

    link(s1, s2)

    s2.on('synced', () => {
      expect(b.get(expected.key)).toBe(expected.value)
      done()
    })
  })

  it('change after sync', done => {
    const a = new Model('A')
    const b = new Model('B')

    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    link(s1, s2)

    a.set(expected.key, expected.value)

    b.on('change', (key, value) => {
      expect(key).toBe(expected.key)
      expect(value).toBe(expected.value)
      expect(b.get(expected.key)).toBe(expected.value)
      done()
    })
  })
})
