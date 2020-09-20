import * as pull from 'pull-stream'
import { EventEmitter } from 'events'
import { SourceState } from './source-state'
import { SinkState } from './sink-state'

export interface DuplexOptions<In, Out> {
  allowHalfOpen: boolean
  abortEagerly: boolean
  onReceived: (data: Out, cb: () => void) => void
  onRead: () => void
  onSent: (data: In) => void
  onFinished: (endOrError: pull.EndOrError) => void
}

export class PullDuplex<In, Out> extends EventEmitter implements pull.Duplex<In, Out> {
  private _source: pull.Source<In> | null = null
  private _sink: pull.Sink<Out> | null = null
  private _rawSinkRead: pull.Source<Out> | null = null

  public readonly buffer: In[] = []
  public readonly cbs: pull.SourceCallback<In>[] = []
  public readonly sourceState: SourceState
  public readonly sinkState: SinkState

  constructor(private _opts: Partial<DuplexOptions<In, Out>> = {}) {
    super()
    _opts.allowHalfOpen = _opts.allowHalfOpen ?? false
    _opts.abortEagerly = _opts.abortEagerly ?? false
    this.sourceState = new SourceState({
      onEnd: this.finish.bind(this),
    })

    this.sinkState = new SinkState({
      onEnd: this.finish.bind(this),
    })
  }

  get source() {
    if (!this._source) {
      const self = this
      this._source = function (abort: pull.Abort, cb: pull.SourceCallback<In>) {
        if (self.sourceState.finished) {
          return cb(self.sourceState.finished)
        }

        self.cbs.push(cb)

        if (abort) {
          self.sourceState.askAbort(abort)
        } else {
          self._opts.onRead?.()
        }
        self.sourceDrain()
      }
    }
    return this._source
  }

  get sink() {
    if (!this._sink) {
      const self = this
      this._sink = function (read) {
        self._rawSinkRead = read
        if (!self.sinkState.normal) return

        self._rawSinkRead(self.sinkState.finishing || self.sinkState.finished, function next(
          end,
          data
        ) {
          if (end) {
            if (self.sinkState.ended(end)) {
              if (!self._opts.allowHalfOpen) {
                self._opts.abortEagerly ? self.abortSource(end) : self.endSource(end)
              }
            }
            return
          }
          self._opts.onReceived?.(data!, () => {
            self._rawSinkRead!(self.sinkState.finishing || self.sinkState.finished, next)
          })
        })
      }
    }
    return this._sink
  }

  end(end?: pull.EndOrError) {
    this.endSource(end)
  }

  abort(end?: pull.EndOrError) {
    this.abortSource(end)
  }

  sourceDrain() {
    if (this.sourceState.aborting) {
      const end = this.sourceState.aborting
      // call of all waiting callback functions
      while (this.cbs.length > 0) {
        const cb = this.cbs.shift()
        cb?.(end)
      }
      this.cbs.length = 0
      this.buffer.length = 0

      this.sourceState.ended(end)
      if (!this._opts.allowHalfOpen) {
        this._opts.abortEagerly ? this.abortSink(end) : this.endSink(end)
      }
      return
    }

    while (this.buffer.length > 0) {
      const cb = this.cbs.shift()
      if (cb) {
        const data = this.buffer.shift()!
        cb(null, data)
        if (this._opts.onSent) {
          this._opts.onSent(data)
        }
      } else {
        break
      }
    }

    if (this.sourceState.ending) {
      if (this.buffer.length > 0) return

      const end = this.sourceState.ending

      // call of all waiting callback functions
      while (this.cbs.length > 0) {
        const cb = this.cbs.shift()
        cb?.(end)
      }
      this.cbs.length = 0
      this.sourceState.ended(end)
      if (!this._opts.allowHalfOpen) {
        this._opts.abortEagerly ? this.abortSink(end) : this.endSink(end)
      }
    }
  }

  private abortSource(end: pull.EndOrError = true) {
    if (!this.sourceState.askAbort(end)) return
    this.sourceDrain()

    if (!this._opts.allowHalfOpen) {
      this._opts.abortEagerly ? this.abortSink(end) : this.endSink(end)
    }
  }

  private endSource(end: pull.EndOrError = true) {
    if (!this.sourceState.askEnd(end)) return
    this.sourceDrain()

    if (!this._opts.allowHalfOpen) {
      this.endSink(end)
    }
  }

  private abortSink(abort: pull.Abort = true) {
    if (!this.sinkState.askAbort(abort)) return

    const cont = (end: pull.Abort) => {
      this.sinkState.ended(end)
      if (!this._opts.allowHalfOpen) {
        this._opts.abortEagerly ? this.abortSource(end) : this.endSource(end)
      }
    }

    if (this._rawSinkRead) {
      this._rawSinkRead(abort, (end) => {
        cont(end)
      })
    } else {
      cont(abort)
    }
  }

  private endSink(end: pull.EndOrError = true) {
    if (!this.sinkState.askEnd(end)) return

    const cont = (end: pull.Abort) => {
      this.sinkState.ended(end)
      if (!this._opts.allowHalfOpen) {
        this._opts.abortEagerly ? this.abortSource(end) : this.endSource(end)
      }
    }

    if (this._rawSinkRead) {
      this._rawSinkRead(end, (end) => {
        cont(end)
      })
    } else {
      cont(end)
    }
  }

  private finish() {
    if (this.sourceState.finished && this.sinkState.finished) {
      this._opts.onFinished?.(this.sourceState.finished || this.sinkState.finished)
    }
  }
}
