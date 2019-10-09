import { Model, link } from '../src'
import { printKeyValue } from './utils'

const a = new Model({ id: 'A' })
const b = new Model({ id: 'B' })

// in a <-> b relationship, a is read-only and b is write-only
const s1 = a.createStream({ name: 'a->b' })
const s2 = b.createStream({ name: 'b->a' })

link(s1, s2)

a.set('foo', 'changed by A')

setTimeout(() => {
  printKeyValue(b, 'foo')
}, 100)
