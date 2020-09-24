import * as pull from 'pull-stream'
import { AsyncModelStoreBase } from './async-model-store.interface'
export type SourceId = string
export type Timestamp = number
export type From = string
export type Singed = string

export interface ScuttlebuttOptions {
  id?: SourceId
  createId?(): SourceId
  sign?: boolean
  verify?: boolean
  accept?: any
}

export interface AsyncModelOptions extends ScuttlebuttOptions {
  store?: AsyncModelStoreBase
}

export interface StreamOptions {
  readable?: boolean
  writable?: boolean
  tail?: boolean
  name?: string
  clock?: Sources
  sendClock?: boolean
  wrapper?: string | Serializer
  meta?: any
}

export interface Sources {
  [sourceId: string]: Timestamp
}

export enum UpdateItems {
  Data = 0,
  Timestamp,
  SourceId,
  From,
  Singed,
}

export interface Serializer {
  serialize: <In, Out>() => pull.Through<In, Out>
  parse: <In, Out>() => pull.Through<In, Out>
}

export type Update = [any, Timestamp, SourceId, From?, Singed?]
export type Verify = (update: Update) => boolean
export type Sign = (update: Update) => string
