import { AsyncModel, link } from '../src'
import { delay } from './utils'

describe('async-model', () => {
  const expected = {
    key: 'foo',
    valueA: 'changed by A',
    valueB: 'changed by B'
  }

  it('local change', done => {
    const a = new AsyncModel('A')

    let c = 2
    a.on('changed', (key, value) => {
      expect(key).toBe(expected.key)
      expect(value).toBe(expected.valueA)
      if (!--c) done()
    })

    a.on(`changed:${expected.key}`, value => {
      expect(value).toBe(expected.valueA)
      if (!--c) done()
    })

    a.set(expected.key, expected.valueA)
  })

  it('change in two-ways', done => {
    const a = new AsyncModel('A')
    const b = new AsyncModel('B')

    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    a.set(expected.key, expected.valueA)

    b.on('changedByPeer', async (key, value, sourceId) => {
      expect(sourceId).toBe(a.id)
      expect(key).toBe(expected.key)
      expect(value).toBe(expected.valueA)

      expect(await b.get(expected.key)).toBe(expected.valueA)

      a.on('changedByPeer', async (key, value, sourceId) => {
        expect(sourceId).toBe(b.id)
        expect(key).toBe(expected.key)
        expect(value).toBe(expected.valueB)
        expect(await a.get(expected.key)).toBe(expected.valueB)
        done()
      })

      b.set(expected.key, expected.valueB)
    })

    link(s1, s2)
  })

  it('clone', done => {
    const a = new AsyncModel('A')
    a.set(expected.key, expected.valueA)
    a.on('cloned', async (b, clones) => {
      expect(await b.get('foo')).toBe(expected.valueA)
      expect(clones).toBe(1)
      await b.set(expected.key, expected.valueB)
      expect(await a.get('foo')).toBe(expected.valueA)
      expect(await b.get('foo')).toBe(expected.valueB)
      expect(b.clones).toBe(0)
      done()
    })
    a.clone()
  })
})
