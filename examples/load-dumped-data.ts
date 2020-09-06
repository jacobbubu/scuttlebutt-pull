process.env.DEBUG = 'sb*'
import * as pull from 'pull-stream'
import { Model } from '../src'
import { delay } from './utils'
import { on } from 'process'

const data = [
  `{"id":"A","clock":{"A":1599396592709}}\n`,
  `[["foo","bar"],1599396592709,"A","A"]\n`,
  `"SYNC"\n`,
  '\n'
]

const main = async () => {
  const a = new Model({ id: 'A' })
  a.on('unstream', (streams) => {
    console.log('data stream finished', streams)
  })
  const s1 = a.createSinkStream({wrapper: 'json'})
  s1.on('synced', async () => {
    console.log('SYNCED', a.toJSON())
  })
  pull(pull.values(data), s1.sink)
}

// tslint:disable-next-line:no-floating-promises
main()
