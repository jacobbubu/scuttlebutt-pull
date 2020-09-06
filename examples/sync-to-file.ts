process.env.DEBUG = 'sb*'

import * as pull from 'pull-stream'
import { Model } from '../src'
import { delay } from './utils'

const main = async () => {
  const a = new Model({ id: 'A' })
  // a.set('foo', 'bar')
  const s1 = a.createSourceStream({ name: 'a->b' })

  pull(s1, pull.log())
  await delay(10)

  a.set('foo1', 'bar1')
}

// tslint:disable-next-line:no-floating-promises
main()
