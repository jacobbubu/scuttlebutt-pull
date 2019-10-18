import { ReliableEvent, link } from '../src'

const a = new ReliableEvent({ id: 'A' })
const b = new ReliableEvent({ id: 'B' })

// in a <-> b relationship, a is read-only and b is write-only
const s1 = a.createStream({ name: 'a->b' })
const s2 = b.createStream({ name: 'b->a' })

link(s1, s2)

a.push('ota', 'ota has started')

setTimeout(() => {
  a.push('ota', '30% progress')
}, 500)

setTimeout(() => {
  a.push('ota', '70% progress')
}, 1000)

setTimeout(() => {
  a.push('ota', '100% done')
}, 1500)

setTimeout(() => {
  a.push('CRITICAL', 'The 🔋 is about to 💥!')
}, 2000)

b.on('ota', event => {
  console.log(`Received@${b.id} (ota): ${event}`)
})

b.on('CRITICAL', event => {
  console.log(`Received@${b.id} (CRITICAL): ${event}`)
})
