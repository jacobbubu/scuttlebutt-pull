import { Model, link } from '../src'
import { delay } from './utils'

const main = async () => {
  const a = new Model({ id: 'A' })
  const b = new Model({ id: 'B' })

  // in a <-> b relationship, a is read-only and b is write-only
  const s1 = a.createStream({ name: 'a->b' })
  const s2 = b.createStream({ name: 'b->a' })

  link(s1, s2)

  console.log(a.listenerCount('_update'), b.listenerCount('_update'))

  await delay(50)
  s1.end()

  await delay(50)
  console.log(a.listenerCount('_update'), b.listenerCount('_update'))
}

main()
