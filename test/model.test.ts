import { Model, link } from '../src'

describe('model', () => {
  const expected = {
    key: 'foo',
    valueA: 'changed by A',
    valueB: 'changed by B'
  }
  it.skip('change before sync', done => {
    const a = new Model('A')
    const b = new Model('B')

    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    a.set(expected.key, expected.valueA)

    link(s1, s2)

    s2.on('synced', () => {
      expect(b.get(expected.key)).toBe(expected.valueA)
      done()
    })
  })

  it.skip('change after sync', done => {
    const a = new Model('A')
    const b = new Model('B')

    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    link(s1, s2)

    a.set(expected.key, expected.valueA)

    b.on('changedByPeer', (key, value) => {
      expect(key).toBe(expected.key)
      expect(value).toBe(expected.valueA)
      expect(b.get(expected.key)).toBe(expected.valueA)
      done()
    })
  })

  it('change in two-ways', done => {
    const a = new Model('A')
    const b = new Model('B')

    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    link(s1, s2)

    a.set(expected.key, expected.valueA)

    b.on('changedByPeer', (key, value, sourceId) => {
      expect(sourceId).toBe(a.id)
      expect(key).toBe(expected.key)
      expect(value).toBe(expected.valueA)
      expect(b.get(expected.key)).toBe(expected.valueA)

      a.on('changedByPeer', (key, value, sourceId) => {
        expect(sourceId).toBe(b.id)
        expect(key).toBe(expected.key)
        expect(value).toBe(expected.valueB)
        expect(a.get(expected.key)).toBe(expected.valueB)
        done()
      })

      b.set(expected.key, expected.valueB)
    })
  })
})
