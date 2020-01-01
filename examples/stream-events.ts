import { Model, link, Duplex, Update } from '../src'

const main = async () => {
  const a = new Model({ id: 'A' })
  const b = new Model({ id: 'B' })

  interface StreamStats {
    startedAt: number
    firstSentAt: number
    firstReceivedAt: number
    lastReceivedAt: number
    lastReceivedPayload: any
    lastSentAt: number
    lastSentPayload: any
  }

  const streamStats: Record<string, Partial<StreamStats>> = {}

  // in a <-> b relationship, a is read-only and b is write-only
  const s1 = a.createStream({ name: 'a->b' })
  const s2 = b.createStream({ name: 'b->a' })

  const now = Date.now()
  const s1Id = a.id + '/' + s1.name
  const s2Id = b.id + '/' + s2.name
  streamStats[s1Id] = { startedAt: now }
  streamStats[s2Id] = { startedAt: now }

  a.set('foo', 'changed by A')

  const receivingFn = (update: Update, counter: number, id: string, stats: typeof streamStats) => {
    const now = Date.now()
    stats[id] = stats[id] || {}
    if (counter === 1) {
      stats[id].firstReceivedAt = now
    }
    stats[id].lastReceivedAt = now
    stats[id].lastReceivedPayload = update
  }

  const sentFn = (update: Update, counter: number, id: string, stats: typeof streamStats) => {
    const now = Date.now()
    stats[id] = stats[id] || {}
    if (counter === 1) {
      stats[id].firstSentAt = now
    }
    stats[id].lastSentAt = now
    stats[id].lastSentPayload = update
  }

  s1.on('updateSent', (_, update, counter, id) => {
    sentFn(update, counter, id, streamStats)
    console.log(`updateSent@${id}:`, streamStats)
  })

  s1.on('updateReceived', (_, update, counter, id) => {
    receivingFn(update, counter, id, streamStats)
    console.log(`updateSent@${id}:`, streamStats)
  })

  s2.on('updateSent', (_, update, counter, id) => {
    sentFn(update, counter, id, streamStats)
    console.log(`updateSent@${id}:`, streamStats)
  })

  s2.on('updateReceived', (_, update, counter, id) => {
    receivingFn(update, counter, id, streamStats)
    console.log(`updateSent@${id}:`, streamStats)
  })

  link(s1, s2)
}

// tslint:disable-next-line:no-floating-promises
main()
