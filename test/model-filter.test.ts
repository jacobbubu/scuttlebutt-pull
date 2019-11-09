import { Model, link } from '../src'
import { delay } from './utils'

jest.setTimeout(1000)

describe('model-accepted', () => {
  const accept = { whitelist: ['foo'] }
  const expected = {
    key: 'foo',
    valueA: 'changed by A',
    valueB: 'changed by B'
  }

  const ignored = {
    key: 'ignored',
    valueA: 'changed by A'
  }

  it('whitelist-filter out in history', done => {
    const a = new Model('A')
    const b = new Model({ id: 'B', accept })

    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    a.set(expected.key, expected.valueA)
    a.set(ignored.key, ignored.valueA)

    s2.on('synced', () => {
      expect(b.get(expected.key)).toBe(expected.valueA)
      expect(b.get(ignored.key)).toBeUndefined()
      done()
    })

    link(s1, s2)
  })

  it('whitelist-filter out in following update', async () => {
    const a = new Model('A')
    const b = new Model({ id: 'B', accept })

    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    link(s1, s2)

    await delay(10)
    a.set(expected.key, expected.valueA)
    a.set(ignored.key, ignored.valueA)

    await delay(10)
    expect(a.get(expected.key)).toBe(expected.valueA)
    expect(a.get(ignored.key)).toBe(ignored.valueA)

    expect(b.get(expected.key)).toBe(expected.valueA)
    expect(b.get(ignored.key)).toBeUndefined()
  })
})
