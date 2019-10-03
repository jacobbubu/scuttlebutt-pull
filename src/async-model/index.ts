import Scuttlebutt from '..'
import * as u from '../utils'
import { MemoryAsyncModelStore as DefaultStore } from './memory-store'

import {
  ScuttlebuttOptions,
  Sources,
  Update,
  UpdateItems,
  ModelValueItems,
  AsyncModelStoreBase,
  ModelAccept
} from '../interfaces'

class AsyncModel extends Scuttlebutt {
  public store: AsyncModelStoreBase

  constructor(opts?: ScuttlebuttOptions | string) {
    if (typeof opts === 'string') {
      opts = { id: opts }
      super(opts)
    } else {
      opts = opts || {}
      super({ ...opts })
    }
    opts = opts as ScuttlebuttOptions
    this.store = opts && opts.store ? opts.store : new DefaultStore()
  }

  async set(k: string, v: any) {
    this.logger.info(`set('${k}', '${v}]')`)

    if (k === '__proto__') {
      return u.protoIsIllegal(this)
    }
    await this.localUpdate([k, v])
    return
  }

  async get(k: string, withClock = false) {
    if (k === '__proto__') {
      return u.protoIsIllegal(this)
    }

    const update = await this.store.get(k)
    if (update) {
      return withClock ? update : update[UpdateItems.Data][ModelValueItems.Value]
    }
  }

  async keys() {
    return this.store.keys()
  }

  async applyUpdate(update: Update) {
    const key = update[UpdateItems.Data][ModelValueItems.Key]
    if ('__proto__' === key) {
      u.protoIsIllegal(this)
      return false
    }

    // ignore if we already have a more recent value
    const storedClock = await this.store.get(key)
    if (
      'undefined' !== typeof storedClock &&
      storedClock[UpdateItems.Timestamp] > update[UpdateItems.Timestamp]
    ) {
      this.emit('_remove', update)
      return false
    }

    // otherwise we remove the local one
    if (storedClock) {
      this.emit('_remove', storedClock)
    }

    await this.store.set(key, update)

    this.emit.apply(this, ['update', update])
    this.emit('change', key, update[UpdateItems.Data][ModelValueItems.Value])
    this.emit('change:' + key, update[UpdateItems.Data][ModelValueItems.Value])

    return true
  }

  isAccepted(peerAccept: ModelAccept, update: Update) {
    const { blacklist, whitelist } = peerAccept
    const key = update[UpdateItems.Data][ModelValueItems.Key]
    if (blacklist && Array.isArray(blacklist)) {
      if (blacklist.includes(key)) {
        return false
      }
    }
    if (whitelist && Array.isArray(whitelist)) {
      return whitelist.includes(key) ? true : false
    }
    return true
  }

  async history(peerSources: Sources, peerAccept?: ModelAccept) {
    this.logger.info('history:', peerSources)
    const res = await this.store.history(
      peerSources,
      peerAccept ? this.isAccepted.bind(this, peerAccept) : undefined
    )
    this.logger.debug('  length:', res.length, res)
    return res
  }

  async toJSON() {
    return this.store.toJSON()
  }
}

export { AsyncModel }
