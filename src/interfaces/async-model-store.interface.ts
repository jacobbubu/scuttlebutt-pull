import { Sources, Update } from './scuttlebutt.interface'

export abstract class AsyncModelStoreBase {
  abstract async init(): Promise<void>
  abstract async get(key: string): Promise<Update | undefined>
  abstract async set(key: string, clock: Update): Promise<void>
  abstract async history(
    sources: Sources,
    isAccepted?: (update: Update) => boolean | Promise<boolean>
  ): Promise<Update[]>
  abstract async keys(): Promise<string[]>
  abstract async toJSON(): Promise<Record<string, any>>
}
