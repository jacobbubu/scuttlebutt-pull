import { Model, link } from '../src'
import { delay } from './utils'

jest.setTimeout(1000)

describe('stream', () => {
  it('end one stream', async () => {
    const a = new Model()
    const b = new Model()

    const s1 = a.createStream()
    const s2 = b.createStream()

    const s1UpdateSentFired = jest.fn()
    const s1UpdateReceivedFired = jest.fn()

    const s2UpdateSentFired = jest.fn()
    const s2UpdateReceivedFired = jest.fn()

    s1.on('updateSent', s1UpdateSentFired)
    s1.on('updateReceived', s1UpdateReceivedFired)

    s2.on('updateSent', s2UpdateSentFired)
    s2.on('updateReceived', s2UpdateReceivedFired)

    a.set('foo', 'changed by A')

    link(s1, s2)

    await delay(10)

    expect(s1UpdateSentFired).toHaveBeenCalledTimes(1)
    expect(s1UpdateSentFired.mock.calls[0][0]).toBe(s1)
    expect(s1UpdateSentFired.mock.calls[0][1]).toBeInstanceOf(Array)
    expect(s1UpdateSentFired.mock.calls[0][2]).toBe(1)
    expect(s1UpdateSentFired.mock.calls[0][3]).toBe(a.id + '/' + s1.name)

    expect(s1UpdateReceivedFired).toBeCalledTimes(0)

    expect(s2UpdateSentFired).toBeCalledTimes(0)
    expect(s2UpdateReceivedFired).toHaveBeenCalledTimes(1)
    expect(s2UpdateReceivedFired.mock.calls[0][0]).toBe(s2)
    expect(s2UpdateReceivedFired.mock.calls[0][1]).toBeInstanceOf(Array)
    expect(s2UpdateReceivedFired.mock.calls[0][2]).toBe(1)
    expect(s2UpdateReceivedFired.mock.calls[0][3]).toBe(b.id + '/' + s2.name)
  })
})
