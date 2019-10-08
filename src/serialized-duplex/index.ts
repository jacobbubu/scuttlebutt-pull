import { EventEmitter } from 'events'
import pull = require('pull-stream')
import * as jsonSerializer from './json-serializer'
import { Duplex, DuplexInterface } from '../duplex'
import { Serializer } from '../interfaces'

export class SerializedDuplex extends EventEmitter implements DuplexInterface {
  private _source: any
  private _sink: any

  constructor(readonly inner: Duplex, readonly wrapper: string | Serializer = 'json') {
    super()
  }

  get source() {
    if (!this._source) {
      if (this.wrapper === 'raw') {
        this._source = this.inner.source
      } else if (this.wrapper === 'json') {
        this._source = pull(this.inner.source, jsonSerializer.serialize())
      } else if ('string' === typeof this.wrapper) {
        throw new Error(`unsupported wrapper name(${this.wrapper})`)
      } else {
        this._source = pull(this.inner.source, this.wrapper.serialize())
      }
    }
    return this._source
  }

  get sink() {
    if (!this._sink) {
      if (this.wrapper === 'raw') {
        this._sink = this.inner.sink
      } else if (this.wrapper === 'json') {
        this._sink = pull(jsonSerializer.parse(), this.inner.sink)
      } else if ('string' === typeof this.wrapper) {
        throw new Error(`unsupported wrapper name(${this.wrapper})`)
      } else {
        this._sink = pull(this.wrapper.parse(), this.inner.sink)
      }
    }
    return this._sink
  }

  get name() {
    return this.inner.name
  }
}
