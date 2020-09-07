import { EventEmitter } from 'events'
import * as pull from 'pull-stream'
import { Debug } from '@jacobbubu/debug'
import i = require('iterate')
import * as jsonSerializer from './json-serializer'

import { Scuttlebutt } from '../index'
import { filter } from '../utils'
import { AsyncScuttlebutt } from '../async-scuttlebutt'
import { Sources, Update, StreamOptions, UpdateItems, Serializer } from '../interfaces'
import { DumpDuplex, DumpDuplexOptions } from './dump-duplex'

type Read = (abort: pull.Abort, cb: pull.SourceCallback<any>) => void
type OnClose = (err?: pull.EndOrError) => void

function validate(update: Update) {
  /* tslint:disable */
  if (
    !(
      Array.isArray(update) &&
      'string' === typeof update[UpdateItems.SourceId] &&
      '__proto__' !== update[UpdateItems.SourceId] && // THIS WOULD BREAK STUFF
      'number' === typeof update[UpdateItems.Timestamp]
    )
  ) {
    return false
  }
  /* tslint:enable */
  return true
}

interface Outgoing {
  id: string
  clock: Sources
  meta?: any
  accept?: any
}

class Duplex extends EventEmitter implements pull.Duplex<any, any> {
  private _name: string
  private _source: Read | undefined
  private _sink: pull.Sink<any> | undefined
  private _wrapper: string | Serializer
  private _readable = true
  private _writable = true
  private _syncSent = false
  private _syncRecv = false

  private _onclose: OnClose
  private _isFirstRead = true
  private _sentCounter = 0 // update count that the stream has sent
  private _receivedCounter = 0 // update count that the stream has received
  private _tail: boolean
  private logger: Debug

  private _rawSinkRead: pull.Source<any> | null = null
  private _buffer: any[] = []
  private _cbs: pull.SourceCallback<any>[] = []
  private _askAbort: pull.EndOrError = false
  private _askEnd: pull.EndOrError = false
  private _sourceEnded: pull.EndOrError = false
  private _sinkEnded: pull.EndOrError = false
  private _finished: pull.EndOrError = false

  public peerSources: Sources = {}
  public peerAccept: any
  public peerId = ''

  constructor(readonly sb: Scuttlebutt | AsyncScuttlebutt, readonly opts: StreamOptions) {
    super()

    this._name = opts.name || 'stream'
    this._wrapper = opts.wrapper || 'raw'
    this.logger = sb.logger.ns(this._name)

    this._writable = opts.writable !== false
    this._readable = opts.readable !== false

    // Non-writable means we could skip receiving SYNC from peer
    this._syncRecv = !this._writable

    // Non-readable means we don't need to send SYNC to peer
    this._syncSent = !this._readable

    this._tail = opts.tail !== false // default to tail = true

    sb.streams++
    this.end = this.end.bind(this)
    sb.once('dispose', this.end)

    this.sb = sb

    this._onclose = () => {
      this.sb.removeListener('_update', this.onUpdate)
      this.sb.streams -= 1
      this.sb.emit('unstream', this.sb.streams)
    }
  }

  private finish() {
    if (this._finished) return

    const sinkEnded = !this._rawSinkRead || this._sinkEnded

    if (this._sourceEnded && sinkEnded) {
      this._sinkEnded = sinkEnded
      this._finished = true
      this._onclose(this._sourceEnded || this._sinkEnded)
    }
  }

  private getOutgoing() {
    const outgoing: Outgoing = { id: this.sb.id, clock: { ...this.sb.sources } }
    if (this.sb.accept) {
      outgoing.accept = this.sb.accept
    }

    if (this.opts.meta) {
      outgoing.meta = this.opts.meta
    }
    return outgoing
  }

  // process any update ocurred on sb
  private onUpdate = async (update: Update) => {
    this.logger.log('got "update" on stream: %o', update)

    // current stream is in write-only mode
    if (!this._readable) {
      this.logger.debug(`"update" ignored by it's non-readable flag`)
      return
    }

    if (!validate(update) || !filter(update, this.peerSources)) return

    // this update comes from our peer stream, don't send back
    if (update[UpdateItems.From] === this.peerId) {
      this.logger.debug(`"update" ignored by peerId: '${this.peerId}'`)

      // now we know that our peer has the latest knowledge of UpdateItems.SourceId at time "UpdateItems.Timestamp"
      const ts = update[UpdateItems.Timestamp]
      const source = update[UpdateItems.SourceId]
      this.peerSources[source] = ts

      this.logger.debug('updated peerSources to', this.peerSources)
      return
    }

    const isAccepted = this.peerAccept ? this.sb.isAccepted(this.peerAccept, update) : true

    if (!isAccepted) {
      this.logger.debug(`"update" ignored by peerAccept: %o`, {
        update,
        peerAccept: this.peerAccept,
      })
      return
    }

    // send 'scuttlebutt' to peer
    update[UpdateItems.From] = this.sb.id
    this.push(update)
    this.logger.debug('sent "update" to peer: %o', update)

    // really, this should happen before emitting.
    const ts = update[UpdateItems.Timestamp]
    const source = update[UpdateItems.SourceId]
    this.peerSources[source] = ts
    this.logger.debug('updated peerSources to', this.peerSources)
  }

  private rawSource = (abort: pull.Abort, cb: pull.SourceCallback<any>) => {
    if (this._sourceEnded) {
      return cb(this._sourceEnded)
    }

    this._cbs.push(cb)

    if (abort) {
      this._askAbort = abort
      this._isFirstRead = false
    } else if (this._isFirstRead) {
      this._isFirstRead = false
      const outgoing = this.getOutgoing()
      this.push(outgoing, true)
      this.logger.log(`sent "outgoing": %o`, outgoing)
    }
    this.drain()
  }

  private rawSink = (read: Read) => {
    this._rawSinkRead = read
    const self = this
    if (this._sinkEnded) return

    this._rawSinkRead(this._askAbort || this._askEnd, function next(
      end,
      update: Update | object | string
    ) {
      if (true === end) {
        self.logger.debug('sink ended by peer(%s), %o', self.peerId, end)
        self._sinkEnded = end
        self._askAbort ? self.abort() : self.end()
        self.finish()
        return
      }

      if (end) {
        self.logger.error('sink reading errors, %o', end)
        self._sinkEnded = end
        self._askAbort ? self.abort() : self.end()
        self.finish()
        return
      }

      self.logger.debug(
        'sink reads data from peer(%s): %o',
        self.peerId || (update as Outgoing).id,
        update
      )

      const readAgain = () => {
        if (!self._sinkEnded) {
          self._rawSinkRead!(self._askAbort || self._askEnd, next)
        }
      }

      // Array means Update
      if (Array.isArray(update)) {
        // counting the update that current stream received
        self._receivedCounter++
        self.emit(
          'updateReceived',
          self,
          update,
          self._receivedCounter,
          `${self.sb.id}/${self.name}`
        )

        if (!self._writable) return

        if (validate(update)) {
          if (self.sb instanceof AsyncScuttlebutt) {
            // tslint:disable:no-floating-promises
            self.sb._update(update).then(() => {
              readAgain()
            })
            // for async sb._update, we should avoid re-calling read in the sync branch
            return
          } else {
            self.sb._update(update)
          }
        } // tslint:disable-next-line:strict-type-predicates
      } else if ('string' === typeof update) {
        const cmd = update
        if (cmd === 'SYNC') {
          if (self._writable) {
            self.logger.log('SYNC received')
            self._syncRecv = true
            self.emit('syncReceived')
            if (self._syncSent) {
              self.logger.log('emit synced')
              self.emit('synced')
            }
          } else {
            self.logger.log(`ignore peer's(${self.peerId}) SYNC due to our non-writable setting`)
          }
        }
      } else {
        if (self._readable) {
          // it's a scuttlebutt digest(vector clocks) when clock is an object.
          // tslint:disable:no-floating-promises
          self.start(update).then(() => {
            readAgain()
          })
          // for async sb.localUpdate, we should avoid re-calling read in the sync branch
          return
        } else {
          self.peerId = (update as Outgoing).id
          self.logger.log(
            `ignore peer's(${self.peerId}) outgoing data due to our non-readable setting`
          )
        }
      }
      readAgain()
    })
  }

  get source() {
    if (!this._source) {
      if (this._wrapper === 'raw') {
        this._source = this.rawSource
      } else if (this._wrapper === 'json') {
        this._source = pull(this.rawSource as any, jsonSerializer.serialize())
      } else if ('string' === typeof this._wrapper) {
        throw new Error(`unsupported wrapper name(${this._wrapper})`)
      } else {
        this._source = pull(this.rawSource as any, this._wrapper.serialize())
      }
    }
    return this._source
  }

  get sink() {
    if (!this._sink) {
      if (this._wrapper === 'raw') {
        this._sink = this.rawSink
      } else if (this._wrapper === 'json') {
        this._sink = pull(jsonSerializer.parse(), this.rawSink)
      } else if ('string' === typeof this._wrapper) {
        throw new Error(`unsupported wrapper name(${this._wrapper})`)
      } else {
        this._sink = pull(this._wrapper.parse(), this.rawSink)
      }
    }
    return this._sink
  }

  get name(): string {
    return this._name
  }

  get readable(): boolean {
    return this._readable
  }

  set readable(value: boolean) {
    this._readable = value
  }

  get writable(): boolean {
    return this._writable
  }

  set writable(value: boolean) {
    this._writable = value
  }

  get finished() {
    return this._finished
  }

  public push(data: unknown, toHead = false) {
    if (this._sourceEnded) return
    if (toHead) {
      this._buffer.unshift(data)
    } else {
      this._buffer.push(data)
    }
    this.drain()
  }

  private drain() {
    while (this._buffer.length > 0) {
      const cb = this._cbs.shift()
      if (cb) {
        const data = this._buffer.shift()
        cb(null, data)
        // fire this event when the payload has been read by downstream
        if (Array.isArray(data)) {
          // if the payload is an update
          this._sentCounter++
          this.emit('updateSent', this, data, this._sentCounter, `${this.sb.id}/${this.name}`)
        }
      } else {
        break
      }
    }

    if (this._askAbort) {
      // call of all waiting callback functions
      this._cbs.forEach((cb) => {
        cb(this._askAbort)
      })
      this._cbs = []
      this._buffer = []

      this._sourceEnded = this._askAbort
      this.finish()
      return
    }

    if (this._askEnd) {
      if (this._buffer.length > 0) return

      // call of all waiting callback functions
      this._cbs.forEach((cb) => {
        cb(this._askEnd)
      })
      this._cbs = []
      this._sourceEnded = this._askEnd
      this.finish()
    }
  }

  public end(end?: pull.EndOrError) {
    if (this._askEnd) return

    this._askEnd = end || true
    this.drain()
  }

  public abort(abort?: pull.EndOrError) {
    if (this._askAbort) return

    this._askAbort = abort || true

    if (this._rawSinkRead && !this._sinkEnded) {
      this._rawSinkRead(this._askAbort, (end) => {
        this._sinkEnded = end
        this.finish()
      })
    }

    this.drain()
  }

  public async start(data: Object) {
    this.logger.log('start with data: %o', data)
    const incoming = data as Outgoing
    if (!incoming || !incoming.clock) {
      this.emit('error')
      return this.end()
    }
    this.peerSources = incoming.clock
    this.peerId = incoming.id
    this.peerAccept = incoming.accept

    const self = this

    // won't send history/SYNC and further update out if the stream is write-only
    if (!this._readable) {
      return rest()
    }

    // call this.history to calculate the delta between peers
    if (this.sb instanceof AsyncScuttlebutt) {
      await this.sb.lockForHistory(async () => {
        const history = await this.sb.history(this.peerSources, this.peerAccept)
        i.each(history, function (update) {
          const u = [...update]
          u[UpdateItems.From] = self.sb.id
          self.push(u)
        })

        this.logger.log('"history" has been sent to peer:', history)

        if (self._readable) {
          self.push('SYNC')
          self._syncSent = true
          self.logger.debug('"SYNC" has been sent to peer(%s)', self.peerId)
          self.emit('syncSent')
        }

        this.sb.on('_update', this.onUpdate)
      })
      rest()
    } else {
      const history = this.sb.history(this.peerSources, this.peerAccept)
      const self = this
      i.each(history, function (update) {
        const u = [...update]
        u[UpdateItems.From] = self.sb.id
        self.push(u)
      })

      this.logger.log('"history" to peer(%s) has been sent:', self.peerId, history)

      if (self._readable) {
        self.push('SYNC')
        self._syncSent = true
        self.logger.debug('"SYNC" has been sent to peer(%s)', self.peerId)
        self.emit('syncSent')
      }

      this.sb.on('_update', this.onUpdate)

      rest()
    }

    function rest() {
      // when we have sent all history
      self.emit('header', incoming)
      // when we have received all history
      // emit 'synced' when this stream has synced.
      if (self._syncRecv) {
        self.logger.log('emit synced')
        self.emit('synced')
      }

      if (!self._tail) self.end()
    }
  }
}

export function link(a: pull.Duplex<any, any>, b: pull.Duplex<any, any>) {
  pull(a, b, a)
}

export { Duplex }
export function createDumpDuplex(dumpSink: pull.Sink<any>, opts: Partial<DumpDuplexOptions> = {}) {
  return new DumpDuplex(dumpSink, opts)
}
