import * as pull from 'pull-stream'
import { Model, createDumpDuplex } from '../src'
import { delay } from './utils'
import * as fs from 'fs'

jest.setTimeout(1000)

function haveProperties(props: string[], obj: Object) {
  props.forEach((prop) => expect(obj).toHaveProperty([prop]))
}

describe('dump-duplex', () => {
  it('watch = false', async (done) => {
    const a = new Model()
    a.set('foo', 'bar')
    const s1 = a.createStream()

    const dumpStream = createDumpDuplex(
      pull.collect(async (err, result) => {
        expect(err).toBeFalsy()
        expect(result).toBeInstanceOf(Array)
        expect(result.length).toBe(4)

        haveProperties(['id', 'clock'], JSON.parse(result[0]))
        expect(JSON.parse(result[1])).toBeInstanceOf(Array)
        expect(JSON.parse(result[1])[0]).toEqual(['foo', 'bar'])
        expect(JSON.parse(result[2])).toBe('SYNC')
        expect(result[3]).toBe('')
        done()
      })
    )

    pull(s1, dumpStream, s1)
    a.set('foo1', 'bar1')
  })

  it('watch = true', async (done) => {
    let target = 2

    const a = new Model()
    a.set('foo', 'bar')
    const s1 = a.createStream()

    const dumpStream = createDumpDuplex(
      pull.collect(async (err, result) => {
        expect(err).toBeFalsy()
        expect(result).toBeInstanceOf(Array)
        expect(result.length).toBe(4 + target)

        haveProperties(['id', 'clock'], JSON.parse(result[0]))
        expect(JSON.parse(result[1])).toBeInstanceOf(Array)
        expect(JSON.parse(result[1])[0]).toEqual(['foo', 'bar'])
        expect(JSON.parse(result[2])).toBe('SYNC')
        expect(JSON.parse(result[3])[0]).toEqual(['foo1', 'bar1'])
        expect(JSON.parse(result[4])[0]).toEqual(['foo2', 'bar2'])
        expect(result[5]).toBe('')
        done()
      }),
      { watch: true }
    )

    pull(s1, dumpStream, s1)

    for (let i = 1; i <= target; i++) {
      a.set('foo' + i, 'bar' + i)
    }
    await delay(50)
    dumpStream.end()
  })
})
