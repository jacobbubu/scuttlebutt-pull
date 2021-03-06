import { EventEmitter } from 'events'
import timestamp = require('monotonic-timestamp')
import { link, Duplex } from '../duplex'
import { Debug } from '@jacobbubu/debug'
import AsyncLock = require('async-lock')

const defaultLogger = Debug.create('sb')

import {
  ScuttlebuttOptions,
  Sources,
  Update,
  Verify,
  Sign,
  StreamOptions,
  UpdateItems,
} from '../interfaces'
import { createId } from '../utils'

class AsyncScuttlebutt extends EventEmitter {
  private _sign?: Sign = undefined
  private _verify?: Verify = undefined
  private _clones: number = 0
  private _lock: AsyncLock = new AsyncLock()

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

    this.logger = opts.logger ?? defaultLogger.ns(this.id)
    this.accept = opts.accept
  }

  public isAccepted(peerAccept: any, update: Update): boolean {
    throw new Error('method(isAccepted) must be implemented by subclass')
    return false
  }

  public async applyUpdate(update: Update): Promise<boolean> {
    throw new Error('method(applyUpdate) must be implemented by subclass')
    return false
  }

  public async history(peerSources: Sources, accept?: any): Promise<Update[]> {
    throw new Error('method(history) must be implemented by subclass')
    return []
  }

  public async lockForHistory(cb: () => Promise<unknown>) {
    return this._lock.acquire(`history-${this.id}`, cb)
  }

  // private method
  async _update(update: Update) {
    return this.lockForHistory(async () => {
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

      async function didVerification(verified: boolean) {
        // I'm not sure how what should happen if a async verification
        // errors. if it's an key not found - that is a verification fail,
        // not a error. if it's genuine error, really you should queue and
        // try again? or replay the message later
        // this should be done my the security plugin though, not scuttlebutt.
        if (!verified) {
          self.emit('unverified_data', update)
          return false
        }

        // emit '_update' event to notify every streams on this SB
        const applied = await self.applyUpdate(update)
        if (applied) {
          self.emit('_update', update)
          self.logger.debug('applied "update" and fired ⚡_update')
        }
        return applied
      }

      if (sourceId !== this.id) {
        return this._verify ? didVerification(this._verify(update)) : didVerification(true)
      } else {
        if (this._sign) {
          update[UpdateItems.Singed] = this._sign(update)
        }
        return didVerification(true)
      }
    })
  }

  async localUpdate(trx: any) {
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
    const B = new (A.constructor as ObjectConstructor)() as AsyncScuttlebutt
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

export { AsyncScuttlebutt }
