import { AsyncModel, link } from '../src'
import { delay } from './utils'

jest.setTimeout(1000)

describe('async-model-accepted', () => {
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

  it('whitelist-filter out in history', async done => {
    const a = new AsyncModel('A')
    const b = new AsyncModel({ id: 'B', accept })

    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    await a.set(expected.key, expected.valueA)
    await a.set(ignored.key, ignored.valueA)

    s2.on('synced', async () => {
      expect(await b.get(expected.key)).toBe(expected.valueA)
      expect(await b.get(ignored.key)).toBeUndefined()
      done()
    })

    link(s1, s2)
  })

  it('whitelist-filter out in following update', async () => {
    const a = new AsyncModel('A')
    const b = new AsyncModel({ id: 'B', accept })

    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    link(s1, s2)

    await delay(10)
    await a.set(expected.key, expected.valueA)
    await a.set(ignored.key, ignored.valueA)

    await delay(10)
    expect(await a.get(expected.key)).toBe(expected.valueA)
    expect(await a.get(ignored.key)).toBe(ignored.valueA)

    expect(await b.get(expected.key)).toBe(expected.valueA)
    expect(await b.get(ignored.key)).toBeUndefined()
  })
})
