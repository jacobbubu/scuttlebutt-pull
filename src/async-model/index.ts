import { AsyncScuttlebutt } from '../async-scuttlebutt'
import * as u from '../utils'
import { MemoryAsyncModelStore as DefaultStore } from './memory-store'

import {
  AsyncModelOptions,
  Sources,
  Update,
  UpdateItems,
  ModelValueItems,
  AsyncModelStoreBase,
  ModelAccept
} from '../interfaces'

class AsyncModel extends AsyncScuttlebutt {
  public store: AsyncModelStoreBase

  constructor(opts?: AsyncModelOptions | string) {
    if (typeof opts === 'string') {
      opts = { id: opts }
      super(opts)
    } else {
      opts = opts || {}
      super({ ...opts })
    }
    this.store = opts && opts.store ? opts.store : new DefaultStore()
  }

  async set(k: string, v: any) {
    this.logger.log('set: %o', { k, v })

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

    // ignore if we already have a more recent value
    const storedClock = await this.store.get(key)
    if (
      'undefined' !== typeof storedClock &&
      storedClock[UpdateItems.Timestamp] > update[UpdateItems.Timestamp]
    ) {
      this.emit('_remove', update)
      return true
    }

    // otherwise we remove the local one
    if (storedClock) {
      this.emit('_remove', storedClock)
    }

    await this.store.set(key, update)

    this.emit.apply(this, ['update', update])
    this.emit('changed', key, update[UpdateItems.Data][ModelValueItems.Value])
    this.emit('changed:' + key, update[UpdateItems.Data][ModelValueItems.Value])
    if (update[UpdateItems.SourceId] !== this.id) {
      this.emit(
        'changedByPeer',
        key,
        update[UpdateItems.Data][ModelValueItems.Value],
        update[UpdateItems.From]
      )
    }
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
    const res = await this.store.history(
      peerSources,
      peerAccept ? this.isAccepted.bind(this, peerAccept) : undefined
    )
    return res
  }

  async toJSON() {
    return this.store.toJSON()
  }
}

export { AsyncModel }
