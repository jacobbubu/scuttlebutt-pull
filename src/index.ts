/// <reference path="../types/monotonic-timestamp/index.d.ts" />

import { EventEmitter } from 'events'
import timestamp = require('monotonic-timestamp')
import { Duplex, link } from './duplex'
import { Debug } from '@jacobbubu/debug'

const defaultLogger = Debug.create('sb')

import {
  ScuttlebuttOptions,
  Sources,
  Update,
  Verify,
  Sign,
  StreamOptions,
  UpdateItems
} from './interfaces'
import { createId, filter, order, sort, isPromise } from './utils'

class Scuttlebutt extends EventEmitter {
  private _sign?: Sign = undefined
  private _verify?: Verify = undefined
  private _clones: number = 0

  public streams = 0
  public sources: Sources = {}
  public id: string = ''
  public accept: any
  public readonly logger: Debug

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

    this.logger = defaultLogger.ns(this.id)
    this.accept = opts.accept
  }

  public isAccepted(peerAccept: any, update: Update) {
    throw new Error('method(isAccepted) must be implemented by subclass')
    return false
  }

  public applyUpdate(update: Update): boolean | Promise<boolean> {
    throw new Error('method(applyUpdate) must be implemented by subclass')
    return false
  }

  public history(peerSources: Sources, accept?: any): Update[] {
    throw new Error('method(history) must be implemented by subclass')
    return []
  }

  // private method

  _update(update: Update) {
    this.logger.info('_update: %o', update)

    const ts = update[UpdateItems.Timestamp]
    const sourceId = update[UpdateItems.SourceId]
    const latest = this.sources[sourceId] || 0

    if (latest >= ts) {
      this.logger.debug('update is older, ignore it', { latest, ts, diff: ts - latest })
      this.emit('old_data', update)
      return false
    }

    this.sources[sourceId] = ts
    this.logger.debug('update our sources to', this.sources)

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
          self.logger.debug(
            'applied "update" and fired ⚡_update, total listeners:',
            self.listenerCount('_update')
          )
          return updated
        })
      } else {
        if (r) {
          self.emit('_update', update)
          self.logger.debug(
            'applied "update" and fired ⚡_update, total listeners:',
            self.listenerCount('_update')
          )
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
  }

  localUpdate(trx: any) {
    return this._update([trx, timestamp(), this.id])
  }

  createStream(opts: StreamOptions = {}) {
    return new Duplex(this, opts)
  }

  createWriteStream(opts: StreamOptions = {}) {
    opts.writable = true
    opts.readable = false
    return this.createStream(opts)
  }

  createSinkStream(opts: StreamOptions = {}) {
    opts.writable = true
    opts.readable = false
    return this.createStream(opts)
  }

  createReadStream(opts: StreamOptions = {}) {
    opts.writable = false
    opts.readable = true
    return this.createStream(opts)
  }

  createSourceStream(opts: StreamOptions = {}) {
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

  get clones() {
    return this._clones
  }

  clone() {
    const A = this
    const B = new (A.constructor as ObjectConstructor)() as Scuttlebutt
    B.setId(A.id) // same id. think this will work...
    A._clones += 1

    const a = A.createStream({ wrapper: 'raw' })
    const b = B.createStream({ wrapper: 'raw' })
    link(a, b)
    a.on('synced', () => {
      a.end()
      A.emit('cloned', B, A._clones)
    })
    return B
  }
}

export default Scuttlebutt
export { Scuttlebutt }
export { createId }
export { filter }
export { order }
export { sort }
export { filter as updateIsRecent }
export { timestamp }
export * from './duplex'
export * from './interfaces'
export * from './model'
export * from './reliable-event'
export * from './async-scuttlebutt'
export * from './async-model'
