import Scuttlebutt from '..'
import * as u from '../utils'

import {
  ScuttlebuttOptions,
  Sources,
  Update,
  UpdateItems,
  ReliableEventValueItems,
  ModelAccept,
} from '../interfaces'

class ReliableEvent extends Scuttlebutt {
  public events: Map<string, any[]> = new Map()

  constructor(opts?: ScuttlebuttOptions | string) {
    super(opts)
  }

  // args = [eventName, arg1, arg2,...]
  push(...args: any[]) {
    this.localUpdate(args)
    return true
  }

  applyUpdate(update: Update) {
    const key = update[UpdateItems.Data][ReliableEventValueItems.Key]
    if (!this.events.get(key)) {
      this.events.set(key, [])
    }
    this.events.get(key)!.push(update)
    // emit the event.
    this.emit.apply(this, update[0])
    this.emit('__fired__', ...update[0])
    return true
  }

  isAccepted(peerAccept: ModelAccept, update: Update) {
    const { blacklist, whitelist } = peerAccept
    const key = update[UpdateItems.Data][ReliableEventValueItems.Key]
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

    this.events.forEach((v, key) => {
      if (peerAccept && !this.isAccepted(peerAccept, [[key], 0, this.id])) {
        return
      }
      this.events.get(key)!.forEach((update: Update) => {
        if (u.filter(update, peerSources)) {
          h.push(update)
        }
      })
    })
    return u.sort(h)
  }
}

export { ReliableEvent }
