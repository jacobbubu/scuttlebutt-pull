import { Model, link } from '../src'
import { delay } from './utils'

jest.setTimeout(1000)

describe('readable', () => {
  const expected = {
    key: 'foo',
    valueA: 'changed by A',
    valueB: 'changed by B'
  }

  it('A is read-ony to B (changed before sync)', done => {
    const a = new Model('A')
    const b = new Model('B')

    b.set(expected.key, expected.valueB)

    const s1 = a.createReadStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    s1.on('synced', () => {
      // A won't be changed by B
      expect(a.get(expected.key)).toBeUndefined()
      done()
    })

    link(s1, s2)
  })

  it('"synced" only fired once on b->a and a->b streams when A is read-only and B is write-only', async () => {
    const a = new Model('A')
    const b = new Model('B')

    b.set(expected.key, expected.valueB)

    const s1 = a.createReadStream({ name: 'a->b' })
    const s2 = b.createWriteStream({ name: 'b->a' })

    const s1Fired = jest.fn()
    const s2Fired = jest.fn()

    s1.on('synced', s1Fired)
    s2.on('synced', s2Fired)

    link(s1, s2)

    await delay(10)

    expect(s1Fired).toHaveBeenCalledTimes(1)
    expect(s2Fired).toHaveBeenCalledTimes(1)
  })

  it('"synced" only fired once on b->a and a->b streams when A is read-only', async () => {
    const a = new Model('A')
    const b = new Model('B')

    b.set(expected.key, expected.valueB)

    const s1 = a.createReadStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    const s1Fired = jest.fn()
    const s2Fired = jest.fn()

    s1.on('synced', s1Fired)
    s2.on('synced', s2Fired)

    link(s1, s2)

    await delay(10)

    expect(s1Fired).toHaveBeenCalledTimes(1)
    expect(s2Fired).toHaveBeenCalledTimes(1)
  })

  it('"synced" only fired once on b->a and a->b streams when B is write-only', async () => {
    const a = new Model('A')
    const b = new Model('B')

    b.set(expected.key, expected.valueB)

    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    const s1Fired = jest.fn()
    const s2Fired = jest.fn()

    s1.on('synced', s1Fired)
    s2.on('synced', s2Fired)

    link(s1, s2)

    await delay(10)

    expect(s1Fired).toHaveBeenCalledTimes(1)
    expect(s2Fired).toHaveBeenCalledTimes(1)
  })

  it('A is read-ony to B (changed after sync)', async () => {
    const a = new Model('A')
    const b = new Model('B')

    const s1 = a.createReadStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    a.set(expected.key, expected.valueA)
    link(s1, s2)

    await delay(50)
    b.set(expected.key, expected.valueB)

    await delay(50)
    expect(b.get(expected.key)).toBe(expected.valueB)
    expect(a.get(expected.key)).toBe(expected.valueA)
  })

  it('B is write-only to A (changed before sync)', async () => {
    const a = new Model('A')
    const b = new Model('B')

    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createWriteStream({ name: 'b->a' })

    b.set(expected.key, expected.valueB)
    link(s1, s2)

    await delay(50)
    expect(a.get(expected.key)).toBeUndefined()
  })

  it('B is write-only to A (changed after sync)', async () => {
    const a = new Model('A')
    const b = new Model('B')

    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createWriteStream({ name: 'b->a' })

    link(s1, s2)
    a.set(expected.key, expected.valueA)

    await delay(50)
    b.set(expected.key, expected.valueB)

    await delay(50)
    expect(b.get(expected.key)).toBe(expected.valueB)
    expect(a.get(expected.key)).toBe(expected.valueA)
  })

  it('A is read-ony and B is write-only (changed after sync)', async () => {
    const a = new Model('A')
    const b = new Model('B')

    const s1 = a.createSourceStream({ name: 'a->b' })
    const s2 = b.createSinkStream({ name: 'b->a' })

    link(s1, s2)

    await delay(50)
    a.set(expected.key, expected.valueA)

    await delay(50)
    expect(b.get(expected.key)).toBe(expected.valueA)

    await delay(50)
    b.set(expected.key, expected.valueB)

    await delay(50)
    expect(b.get(expected.key)).toBe(expected.valueB)
    expect(a.get(expected.key)).toBe(expected.valueA)
  })
})
