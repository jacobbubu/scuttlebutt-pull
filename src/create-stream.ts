import i = require('iterate')
import { Scuttlebutt } from './index'
import { filter } from './utils'
import { Sources, Update, StreamOptions, UpdateItems } from './interfaces'
import { Duplex, OnClose } from './duplex'
import { SerializedDuplex } from './serialized-duplex'
import isPromise = require('is-promise')

function validate(update: Update) {
  /* tslint:disable */
  if (
    !(
      Array.isArray(update) &&
      'string' === typeof update[UpdateItems.SourceId] &&
      '__proto__' !== update[UpdateItems.SourceId] && // THIS WOULD BREAK STUFF
      'number' === typeof update[UpdateItems.Timestamp]
    )
  ) {
    return false
  }
  /* tslint:enable */
  return true
}

interface Outgoing {
  id: string
  clock: Sources
  meta?: any
  accept?: any
}

export default function createStream(sb: Scuttlebutt, opts: StreamOptions = {}): SerializedDuplex {
  opts.name = opts.name || 'stream'

  const logger = sb.logger.ns(opts.name)

  // peerSources 是在当前 stream 上保存对端的 clocks
  let peerSources: Sources = {}
  let peerId = ''

  // peerAccept 是对端传来的过滤条件
  let peerAccept: any
  let syncSent = false
  let syncRecv = false

  sb.streams++

  async function onData(update: Update | object | String) {
    // 如果收到的数据是 Array，我们认为是 Update[]
    if (Array.isArray(update)) {
      if (!duplex.writable) return
      if (validate(update)) {
        return sb._update(update)
      } // tslint:disable-next-line:strict-type-predicates
    } else if ('string' === typeof update) {
      const cmd = update
      if (cmd === 'SYNC') {
        logger.log('SYNC received')
        syncRecv = true
        outer.emit('syncReceived')
        if (syncSent) {
          outer.emit('synced')
        }
      }
    } else {
      // it's a scuttlebutt digest(vector clocks) when clock is an object.
      start(update)
    }
  }

  const onClose: OnClose = () => {
    sb.removeListener('_update', onUpdate)
    sb.removeListener('dispose', dispose)
    sb.streams--
    sb.emit('unstream', sb.streams)
  }

  const duplex = new Duplex(opts.name, onData, onClose)
  const outer = new SerializedDuplex(duplex, opts.wrapper)

  duplex.writable = opts.writable !== false
  duplex.readable = opts.readable !== false

  // Non-writable means we could skip receiving SYNC from peer
  syncRecv = !duplex.writable

  // Non-readable means we don't need to send SYNC to peer
  syncSent = !duplex.readable

  let tail = opts.tail !== false // default to tail = true

  function start(data: Object) {
    logger.log('start with data: %o', data)

    const incoming = data as Outgoing
    if (!incoming || !incoming.clock) {
      duplex.emit('error')
      // 原本_end的实现是要发出最后的数据，同时排干 readable 缓存
      return duplex.abort()
    }

    peerSources = incoming.clock
    peerId = incoming.id
    peerAccept = incoming.accept

    // call this.history to calculate the delta between peers
    const history = sb.history(peerSources, peerAccept)
    if (isPromise(history)) {
      return history.then(promiseResoved)
    } else {
      promiseResoved(history)
    }

    function promiseResoved(history: Update[]) {
      i.each(history, function(update) {
        const u = [...update]
        u[UpdateItems.From] = sb.id
        duplex.push(u)
      })

      logger.log('sent "history" to peer:', history)

      sb.on('_update', onUpdate)

      duplex.push('SYNC')
      syncSent = true
      logger.debug('sent "SYNC" to peer')

      // when we have sent all history
      outer.emit('header', incoming)
      outer.emit('syncSent')
      // when we have received all history
      // emit 'synced' when this stream has synced.
      if (syncRecv) outer.emit('synced')

      if (!tail) duplex.end()
    }

    return
  }

  if (opts && opts.tail === false) {
    outer.on('synced', function() {
      process.nextTick(function() {
        duplex.end()
      })
    })
  }

  // onUpdate 是 SB 上的 on('_update') 的监听函数
  // 用来处理是否“传播”流言
  function onUpdate(update: Update) {
    logger.log('got "update" on stream: %o', update)
    // validate 完成基本的数据结构校验，是否符合 [value, ts, source]
    // 确认当前的 update 是否比 stream 上保存的对端的 clocks 里记录的新
    if (!validate(update) || !filter(update, peerSources)) return

    // this update comes from our peer stream, don't send back
    if (update[UpdateItems.From] === peerId) {
      logger.debug(`"update" ignored by peerId: '${peerId}'`)
      return
    }

    // 传播之前我们首先需要检查过滤条件
    if (duplex.readable && peerAccept && !sb.isAccepted(peerAccept, update)) {
      logger.debug(`"update" ignored by peerAccept: %o`, { update, peerAccept })
      return
    }

    // send 'scuttlebutt' to peer
    update[UpdateItems.From] = sb.id
    duplex.push(update)
    logger.debug('sent "update" to peer: %o', update)

    // really, this should happen before emitting.
    // 只要发送到对端，就更新一下自己这边的对方的 clocks；这是"乐观"更新
    // 如果对端实际未收到会如何？下次连接时 SYNC 自然就追上了
    const ts = update[UpdateItems.Timestamp]
    const source = update[UpdateItems.SourceId]
    peerSources[source] = ts
    logger.debug('updated peerSources to', peerSources)
  }

  function dispose() {
    duplex.end()
  }

  const outgoing: Outgoing = { id: sb.id, clock: { ...sb.sources } }
  if (sb.accept) {
    outgoing.accept = sb.accept
  }

  if (opts && opts.meta) {
    outgoing.meta = opts.meta
  }

  // duplex.readable === true, current stream can provide changes to it's peer
  // duplex.writable === true, current stream can accept changes from it's peer
  if (duplex.readable) {
    // push sync data to peer if readable === true
    duplex.push(outgoing)
    logger.log(`sent "outgoing": %o`, outgoing)

    if (!duplex.writable && !opts.clock) {
      // Non-writable stream will start immediately without waiting for SYNC message
      // notice that the start is an async function
      start({ clock: {} })
    }
    // otherwise, the start will be triggered by on(’data')
  } else if (opts.sendClock) {
    // opts.sendClock === true means send the clock forcedly even when the stream is non-readable
    duplex.push(outgoing)
    logger.log(`sent "outgoing": %o`, outgoing)
  } // otherwise, will send nothing when stream is non-readable

  sb.once('dispose', dispose)

  return outer
}
