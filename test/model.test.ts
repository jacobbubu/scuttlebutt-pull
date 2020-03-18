import { Model, link } from '../src'
import { delay } from './utils'

jest.setTimeout(1000)

describe('model', () => {
  const expected = {
    key: 'foo',
    valueA: 'changed by A',
    valueB: 'changed by B'
  }

  it('local change', done => {
    const a = new Model('A')

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

  it('change before sync', done => {
    const a = new Model('A')
    const b = new Model('B')

    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    a.set(expected.key, expected.valueA)

    s2.on('synced', () => {
      expect(b.get(expected.key)).toBe(expected.valueA)
      done()
    })

    link(s1, s2)
  })

  it('change after sync', done => {
    const a = new Model('A')
    const b = new Model('B')

    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    b.on('changedByPeer', (key, value) => {
      expect(key).toBe(expected.key)
      expect(value).toBe(expected.valueA)
      expect(b.get(expected.key)).toBe(expected.valueA)
      done()
    })

    link(s1, s2)
    a.set(expected.key, expected.valueA)
  })

  it('change in two-ways', done => {
    const a = new Model('A')
    const b = new Model('B')

    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

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

    link(s1, s2)
  })

  it('clone', done => {
    const a = new Model('A')
    a.set(expected.key, expected.valueA)
    a.on('cloned', async (b, clones) => {
      expect(b.get('foo')).toBe(expected.valueA)
      expect(clones).toBe(0)
      b.set(expected.key, expected.valueB)
      await delay(10)
      expect(a.get('foo')).toBe(expected.valueA)
      expect(b.get('foo')).toBe(expected.valueB)
      expect(b.clones).toBe(0)
      done()
    })
    a.clone()
  })
})
