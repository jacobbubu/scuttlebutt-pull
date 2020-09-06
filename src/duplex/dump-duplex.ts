import { EventEmitter } from 'events'
import * as pull from 'pull-stream'
import { createId } from '../utils'
import * as jsonSerializer from './json-serializer'

export interface DumpDuplexOptions {
  watch: boolean
}

export class DumpDuplex extends EventEmitter implements pull.Duplex<any, any> {
  private _source: pull.Source<any> | undefined
  private _sink: pull.Sink<any> | undefined

  private _askEnd: pull.EndOrError = false
  private _sourceEnded: pull.EndOrError = false
  private _sinkEnded: pull.EndOrError = false
  private _rawSinkRead: pull.Source<any> | null = null

  private _sourceReadCount = 0
  private _sourceCbs: pull.SourceCallback<any>[] = []
  private _sinkCbs: pull.SourceCallback<any>[] = []

  private _dumpStream: pull.Sink<any>
  private _watch = false

  private _syncSent = false
  private _syncReceived = false

  constructor(dumpStream: pull.Sink<any>, opts: Partial<DumpDuplexOptions>) {
    super()
    this._watch = opts.watch ?? false
    this._dumpStream = pull(jsonSerializer.serialize(), dumpStream)
  }

  get source() {
    if (!this._source) {
      const self = this
      this._source = function (abort: pull.Abort, cb: pull.SourceCallback<any>) {
        if (self._sourceEnded) {
          return cb(null, self._sourceEnded)
        }
        if (abort) {
          self._askEnd = abort
        }
        self._sourceReadCount++
        if (self._sourceReadCount === 1) {
          cb(null, { id: createId(), clock: {} })
          return
        }
        if (self._sourceReadCount === 2) {
          cb(null, 'SYNC')
          self._syncSent = true
          if (self._syncSent && self._syncReceived) {
            self.emit('synced')
            if (!self._watch) {
              self.end()
            }
          }
          return
        }
        self._sourceCbs.push(cb)
        self.sourceDrain()
      }
    }
    return this._source
  }

  get sink() {
    if (!this._sink) {
      const self = this
      this._sink = (read: pull.Source<any>) => {
        self._rawSinkRead = read
        const sinkRead: pull.Source<any> = (abort, cb) => {
          self._sinkCbs.push(cb)

          self._rawSinkRead!(abort || self._askEnd, (endOrError, data) => {
            if (endOrError) {
              self._sinkEnded = endOrError
              const tempCb = self._sinkCbs.shift()
              return tempCb?.(endOrError)
            }

            if (self._watch || !self._syncReceived) {
              const tempCb = self._sinkCbs.shift()
              tempCb?.(null, data)
            }

            if (data.toString() === 'SYNC') {
              self._syncReceived = true
              if (self._syncSent && self._syncReceived) {
                self.emit('synced')
                if (!self._watch) {
                  self.end()
                }
              }
            }
          })
        }

        self._dumpStream(sinkRead)
      }
    }
    return this._sink
  }

  end(end?: pull.Abort) {
    if (this._askEnd) return

    this._askEnd = end || true

    if (!this._sinkEnded && this._rawSinkRead) {
      const self = this
      this._rawSinkRead(this._askEnd, (end) => {
        const tempCb = self._sinkCbs.shift()
        tempCb?.(end)
        self._sinkEnded = end
      })
    }
    this.sourceDrain()
  }

  private sourceDrain() {
    if (this._sourceEnded) return
    if (this._askEnd) {
      while (this._sourceCbs.length > 0) {
        this._sourceCbs.shift()!(this._askEnd)
      }
      this._sourceEnded = true
    }
  }
}
