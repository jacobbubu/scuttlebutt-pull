import { AsyncModel, link } from '../src'
import { delay } from './utils'

jest.setTimeout(1000)

describe('async stream', () => {
  it('end one stream', async () => {
    const a = new AsyncModel()
    const b = new AsyncModel()

    const s1 = a.createStream()
    const s2 = b.createStream()

    link(s1, s2)

    await delay(10)
    expect(a.listenerCount('_update')).toBe(1)
    expect(b.listenerCount('_update')).toBe(1)

    s1.end()
    await delay(10)
    expect(a.listenerCount('_update')).toBe(0)
    expect(b.listenerCount('_update')).toBe(0)
  })

  it('stream count', () => {
    const a = new AsyncModel()
    const b = new AsyncModel()

    const s1 = a.createStream()
    const s2 = b.createStream()

    expect(a.streams).toBe(1)
    expect(b.streams).toBe(1)

    link(s1, s2)

    a.on('unstream', count => {
      expect(count).toBe(0)
    })

    b.on('unstream', count => {
      expect(count).toBe(0)
    })
    s1.end()
  })

  it('stream count', done => {
    const a = new AsyncModel()

    a.createStream({ name: 's1' })
    a.createStream({ name: 's2' })

    expect(a.streams).toBe(2)

    let counter = 2
    a.on('unstream', () => {
      counter--
      if (counter === 0) done()
    })

    a.dispose()
  })
})
