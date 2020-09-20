import * as pull from 'pull-stream'

export type OnEnd = (endOrError: pull.EndOrError) => void
export interface SourceStateOption {
  onEnd?: OnEnd
}

export class SourceState {
  private _sourceEnding: pull.EndOrError = false
  private _sourceAborting: pull.Abort = false
  private _endReason: pull.EndOrError = false

  constructor(private _opts: SourceStateOption = {}) {}

  get finished() {
    return this._endReason
  }

  get finishing() {
    return this._sourceEnding || this._sourceAborting
  }

  get ending() {
    return this._sourceEnding
  }

  get aborting() {
    return this._sourceAborting
  }

  get normal() {
    return !this.finishing && !this.finished
  }

  askEnd(request: pull.EndOrError = true) {
    if (this.finished || this._sourceEnding || this._sourceAborting) {
      return false
    }

    this._sourceEnding = request
    return true
  }

  askAbort(request: pull.Abort = true) {
    if (this.finished || this._sourceAborting) {
      // even in the ending state, abort has higher priority.
      return false
    }

    this._sourceAborting = request
    return true
  }

  ended(request: pull.EndOrError = true) {
    const isFirst = !this._endReason
    if (isFirst) {
      this._sourceEnding = false
      this._sourceAborting = false
      this._endReason = request
      this._opts.onEnd?.(request === true ? null : request)
    }
    return isFirst
  }
}
