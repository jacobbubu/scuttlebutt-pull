import { EventEmitter } from 'events'
import * as pull from 'pull-stream'
import { Debug } from '@jacobbubu/debug'
import * as jsonSerializer from './json-serializer'

import { Scuttlebutt } from '../index'
import { filter } from '../utils'
import { AsyncScuttlebutt } from '../async-scuttlebutt'
import { Sources, Update, StreamOptions, UpdateItems, Serializer } from '../interfaces'
import { DumpDuplex, DumpDuplexOptions } from './dump-duplex'
import { PushableDuplex, OnReceivedCallback, OnReadCallback } from '@jacobbubu/pull-pushable-duplex'

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
  private _sink: pull.Sink<any> | undefined
  private _source: pull.Source<any> | undefined
  private _wrapper: string | Serializer
  private _readable = true
  private _writable = true
  private _syncSent = false
  private _syncRecv = false

  private _isFirstRead = true
  private _sentCounter = 0 // update count that the stream has sent
  private _receivedCounter = 0 // update count that the stream has received
  private _tail: boolean
  private logger: Debug

  public peerSources: Sources = {}
  public peerAccept: any
  public peerId = ''

  private _innerDuplex: PushableDuplex<any, any>

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

    this._innerDuplex = new PushableDuplex({
      onReceived: this.onReceived.bind(this),
      onRead: this.onRead.bind(this),
      onFinished: () => {
        this.sb.removeListener('_update', this.onUpdate)
        this.sb.streams -= 1
        this.sb.emit('unstream', this.sb.streams)
      },
      onSent: (data) => {
        if (Array.isArray(data)) {
          // if the payload is an update
          this._sentCounter++
          this.emit('updateSent', this, data, this._sentCounter, `${this.sb.id}/${this.name}`)
        }
      },
    })

    this.sb = sb
  }

  private onReceived(update: any, done: OnReceivedCallback) {
    if (Array.isArray(update)) {
      update = update as Update
      // counting the update that current stream received
      this._receivedCounter++
      this.emit('updateReceived', this, update, this._receivedCounter, `${this.sb.id}/${this.name}`)

      if (!this._writable) return done()

      if (validate(update)) {
        if (this.sb instanceof AsyncScuttlebutt) {
          // tslint:disable:no-floating-promises
          this.sb._update(update).then(() => {
            return done()
          })
          // for async sb._update, we should avoid re-calling read in the sync branch
          return
        } else {
          this.sb._update(update)
        }
      } // tslint:disable-next-line:strict-type-predicates
    } else if ('string' === typeof update) {
      const cmd = update
      if (cmd === 'SYNC') {
        if (this._writable) {
          this.logger.log('SYNC received')
          this._syncRecv = true
          this.emit('syncReceived')

          if (this._syncSent) {
            this.logger.log('emit synced')
            this.emit('synced')
          }
        } else {
          this.logger.log(`ignore peer's(${this.peerId}) SYNC due to our non-writable setting`)
        }
      }
    } else {
      if (this._readable) {
        // it's a scuttlebutt digest(vector clocks) when clock is an object.
        if (this.sb instanceof AsyncScuttlebutt) {
          // tslint:disable:no-floating-promises
          this.start(update).then(() => {
            return done()
          })
          return
        } else {
          this.start(update)
        }
      } else {
        this.peerId = (update as Outgoing).id
        this.logger.log(
          `ignore peer's(${this.peerId}) outgoing data due to our non-readable setting`
        )
      }
    }
    return done()
  }

  private onRead(cb: OnReadCallback<any>) {
    if (this._isFirstRead) {
      this._isFirstRead = false
      const outgoing = this.getOutgoing()
      this.push(outgoing, true)
      this.logger.log(`sent "outgoing": %o`, outgoing)
    }
    cb()
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

  get source() {
    if (!this._source) {
      if (this._wrapper === 'raw') {
        this._source = this._innerDuplex.source
      } else if (this._wrapper === 'json') {
        this._source = pull(this._innerDuplex.source, jsonSerializer.serialize())
      } else if ('string' === typeof this._wrapper) {
        throw new Error(`unsupported wrapper name(${this._wrapper})`)
      } else {
        this._source = pull(this._innerDuplex.source, this._wrapper.serialize())
      }
    }
    return this._source
  }

  get sink() {
    if (!this._sink) {
      if (this._wrapper === 'raw') {
        this._sink = this._innerDuplex.sink
      } else if (this._wrapper === 'json') {
        this._sink = pull(jsonSerializer.parse(), this._innerDuplex.sink)
      } else if ('string' === typeof this._wrapper) {
        throw new Error(`unsupported wrapper name(${this._wrapper})`)
      } else {
        this._sink = pull(this._wrapper.parse(), this._innerDuplex.sink)
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

  public push(data: unknown, toHead = false) {
    this._innerDuplex.push(data, toHead)
  }

  public end(end?: pull.EndOrError) {
    this._innerDuplex.end(end)
  }

  public abort(abort?: pull.EndOrError) {
    this._innerDuplex.abort(abort)
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
        history.forEach(function (update) {
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
      history.forEach(function (update) {
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
