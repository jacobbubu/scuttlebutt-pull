import * as u from '../utils'
import { AsyncModelStoreBase, Sources, Update, UpdateItems, ModelValueItems } from '../interfaces'

export class MemoryAsyncModelStore extends AsyncModelStoreBase {
  public store: Map<string, Update> = new Map()

  async init(): Promise<void> {
    // nothing to do here
  }

  async get(key: string): Promise<Update | undefined> {
    return this.store.get(key)
  }

  async set(key: string, update: Update): Promise<void> {
    this.store.set(key, update)
  }

  async history(sources: Sources, isAccepted?: (update: Update) => boolean): Promise<Update[]> {
    const h: Update[] = []
    this.store.forEach((update) => {
      if (isAccepted && !isAccepted(update)) return
      if (u.filter(update, sources)) {
        h.push(update)
      }
    })
    return u.sort(h)
  }

  async keys(): Promise<string[]> {
    const a: string[] = []
    this.store.forEach((update, k) => {
      const v = update[UpdateItems.Data][ModelValueItems.Value]
      if (!u.isNil(v)) {
        a.push(k)
      }
    })
    return a
  }

  async toJSON(): Promise<Record<string, any>> {
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
