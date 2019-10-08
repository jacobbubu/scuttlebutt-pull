import 'core-js'

import { EventEmitter } from 'events'
import timestamp = require('monotonic-timestamp')
import { link } from './duplex'
import createStream from './create-stream'
import { Logger, DefaultNoopLogger } from './default-logger'

import {
  ScuttlebuttOptions,
  Sources,
  Update,
  Verify,
  Sign,
  StreamOptions,
  UpdateItems,
  LoggerService
} from './interfaces'
import { createId, filter, sort, isPromise } from './utils'

class Scuttlebutt extends EventEmitter {
  private _sign?: Sign = undefined
  private _verify?: Verify = undefined
  private _clones: number = 0

  public logger: LoggerService
  public loggerEnabled = false

  public streams = 0
  public sources: Sources = {}
  public id: string = ''
  public accept: any

  constructor(opts?: ScuttlebuttOptions | string) {
    super()

    if ('string' === typeof opts) {
      opts = { id: opts }
    } else {
      opts = opts || {}
    }

    const id = opts.id
    this.setMaxListeners(Number.MAX_VALUE)

    if (opts && opts.sign && opts.verify) {
      this.setId(opts.id || (opts.createId ? opts.createId() : null))
    } else {
      this.setId(id || createId())
    }

    if (typeof opts.logger === 'boolean') {
      this.logger = opts.logger ? new Logger(this.id) : DefaultNoopLogger
    } else {
      this.logger = typeof opts.logger === 'undefined' ? DefaultNoopLogger : opts.logger!
    }
    this.loggerEnabled = this.logger !== DefaultNoopLogger

    this.accept = opts.accept
  }

  isAccepted(peerAccept: any, update: Update) {
    throw new Error('method(isAccepted) must be implemented by subclass')
    return false
  }

  public applyUpdate(update: Update): boolean | Promise<boolean> {
    throw new Error('method(applyUpdate) must be implemented by subclass')
    return false
  }

  public history(peerSources: Sources, accept?: any): Update[] | Promise<Update[]> {
    throw new Error('method(history) must be implemented by subclass')
    return []
  }

  // private method
  // localUpdate 和 history 会触发 _update
  _update(update: Update) {
    this.logger.debug('_update:', update)

    const ts = update[UpdateItems.Timestamp]
    const sourceId = update[UpdateItems.SourceId]
    const latest = this.sources[sourceId] || 0

    if (latest && latest >= ts) {
      this.logger.debug('  update is older, ignore it', { latest, ts, diff: ts - latest })
      this.emit('old_data', update)
      return false
    }

    this.sources[sourceId] = ts
    this.logger.debug('  new sources', this.sources)

    const self = this

    function didVerification(verified: boolean) {
      // I'm not sure how what should happen if a async verification
      // errors. if it's an key not found - that is a verification fail,
      // not a error. if it's genuine error, really you should queue and
      // try again? or replay the message later
      // -- this should be done my the security plugin though, not scuttlebutt.
      if (!verified) {
        self.emit('unverified_data', update)
        return false
      }

      // emit '_update' event to notify every streams on this SB
      const r = self.applyUpdate(update)
      if (isPromise(r)) {
        return r.then(updated => {
          if (updated) self.emit('_update', update)
          self.logger.debug('  update applied and ⚡_update fired')
          return updated
        })
      } else {
        if (r) {
          self.emit('_update', update)
          self.logger.debug('  update applied and ⚡_update fired')
        }
        return r
      }
    }

    if (sourceId !== this.id) {
      return this._verify ? didVerification(this._verify(update)) : didVerification(true)
    } else {
      if (this._sign) {
        update[UpdateItems.Singed] = this._sign(update)
      }
      return didVerification(true)
    }

    return true
  }

  localUpdate(trx: any) {
    return this._update([trx, timestamp(), this.id])
  }

  createStream(opts: StreamOptions = {}) {
    return createStream(this, opts)
  }

  createWriteStream(opts: StreamOptions = {}) {
    opts.writable = true
    opts.readable = false
    return this.createStream(opts)
  }

  createReadStream(opts: StreamOptions = {}) {
    opts.writable = false
    opts.readable = true
    return this.createStream(opts)
  }

  // each stream will be ended due to this event
  dispose() {
    this.emit('dispose')
  }

  setId(id: string | null) {
    if (id === null) throw new Error('null is not invalid id')
    this.id = id
    return this
  }

  clone() {
    const A = this
    const B = new (A.constructor as ObjectConstructor)() as Scuttlebutt
    B.setId(A.id) // same id. think this will work...
    A._clones += 1

    const a = A.createStream({ wrapper: 'raw' })
    const b = B.createStream({ wrapper: 'raw' })
    // streamDone(b, () => {
    //   A._clones--
    //   emit.call(A, 'unclone', A._clones)
    // })
    link(a, b)
    a.inner.end()
    return B
  }
}

// function streamDone(clonedStream: Duplex, listener: Function) {
//   function onDone(arg: any) {
//     remove()
//     listener(arg)
//   }

//   function remove() {
//     clonedStream.removeListener('end', onDone)
//     clonedStream.removeListener('error', onDone)
//     clonedStream.removeListener('close', onDone)
//   }

//   // this makes emitter.removeListener(event, listener) still work
//   onDone.listener = listener

//   clonedStream.on('end', onDone)
//   clonedStream.on('error', onDone)
//   clonedStream.on('close', onDone)
// }

export default Scuttlebutt
export { Scuttlebutt }
export { createId }
export { filter }
export { sort }
export { filter as updateIsRecent }
export { timestamp }
export * from './duplex'
export * from './interfaces'
export * from './model'
export * from './async-model'
