import Scuttlebutt from '..'
import * as u from '../utils'
import {
  ScuttlebuttOptions,
  Sources,
  Update,
  UpdateItems,
  ModelValueItems,
  ModelAccept,
} from '../interfaces'

class Model extends Scuttlebutt {
  public store: Map<string, Update> = new Map()

  constructor(opts?: ScuttlebuttOptions | string) {
    super(opts)
  }

  set(k: string, v: any) {
    this.logger.log('set: %o', { k, v })

    if (k === '__proto__') {
      return u.protoIsIllegal(this)
    }
    this.localUpdate([k, v])
    return this
  }

  get(k: string, withClock = false) {
    if (k === '__proto__') {
      return u.protoIsIllegal(this)
    }

    const v = this.store.get(k)
    if (v) {
      return withClock ? v : v[UpdateItems.Data][ModelValueItems.Value]
    }
  }

  keys() {
    const a: string[] = []
    this.store.forEach((v, k) => {
      if (!u.isNil(v)) {
        a.push(k)
      }
    })
    return a
  }

  applyUpdate(update: Update) {
    const key = update[UpdateItems.Data][ModelValueItems.Key]

    // ignore if we already have a more recent value
    const v = this.store.get(key)
    if (typeof v !== 'undefined') {
      if (v[UpdateItems.Timestamp] > update[UpdateItems.Timestamp]) {
        this.emit('_remove', update)
        return true
      }
    }

    if (v) {
      this.emit('_remove', v)
    }

    this.store.set(key, update)

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

  history(peerSources: Sources, peerAccept?: ModelAccept) {
    const h: Update[] = []
    const self = this
    this.store.forEach((update: Update) => {
      if (peerAccept && !self.isAccepted(peerAccept, update)) {
        return
      }
      if (u.filter(update, peerSources)) {
        h.push(update)
      }
    })
    return u.sort(h)
  }

  toJSON() {
    const o: Record<string, any> = {}
    this.store.forEach((update, k) => {
      const v = update[UpdateItems.Data][ModelValueItems.Value]
      if (!u.isNil(v)) {
        o[k] = v
      }
    })
    return o
  }
}

export { Model }
