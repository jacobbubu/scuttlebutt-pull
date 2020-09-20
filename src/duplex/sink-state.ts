import * as pull from 'pull-stream'

export type OnEnd = (endOrError: pull.EndOrError) => void
export interface SinkStateOption {
  onEnd?: OnEnd
}

export class SinkState {
  private _sinkEnding: pull.EndOrError = false
  private _sinkAborting: pull.Abort = false
  private _endReason: pull.EndOrError = false

  constructor(private _opts: SinkStateOption = {}) {}

  get finished() {
    return this._endReason
  }

  get finishing() {
    return this._sinkEnding || this._sinkAborting
  }

  get ending() {
    return this._sinkEnding
  }

  get aborting() {
    return this._sinkAborting
  }

  get normal() {
    return !this.finishing && !this.finished
  }

  askEnd(request: pull.EndOrError = true) {
    if (this.finished || this._sinkEnding || this._sinkAborting) {
      return false
    }

    this._sinkEnding = request
    return true
  }

  askAbort(request: pull.Abort = true) {
    if (this.finished || this._sinkAborting) {
      // even in the ending state, abort has higher priority.
      return false
    }

    this._sinkAborting = request
    return true
  }

  ended(request: pull.EndOrError = true) {
    const isFirst = !this._endReason
    if (isFirst) {
      this._sinkEnding = false
      this._sinkAborting = false
      this._endReason = request
      this._opts.onEnd?.(request === true ? null : request)
    }
    return isFirst
  }
}
