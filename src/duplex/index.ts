import { EventEmitter } from 'events'
import * as pull from 'pull-stream'
import { pushable, Read } from '@jacobbubu/pull-pushable'

export interface DuplexInterface {
  readonly source: pull.Source<any>
  readonly sink: pull.Sink<any>
}

export type OnData = (data: any) => Promise<any>
export type OnCloseError = Error | string | null
export type OnClose = (err?: OnCloseError) => void | Promise<any>

class Duplex extends EventEmitter implements DuplexInterface {
  private _readable = true
  private _writable = true
  private _ended: boolean = false
  private _source: Read<string> | undefined
  private _sink: pull.Sink<string> = read => {
    const self = this
    read(this._ended, function next(endOrError, data) {
      if (true === endOrError) {
        // emit 'close' when upstream has no more data
        self._finish()
        return
      }
      if (endOrError) {
        self._finish(endOrError)
        return
      }
      if (!self.onData) {
        read(self._ended, next)
      } else {
        self
          .onData(data)
          .then(() => {
            read(self._ended, next)
          })
          .catch(err => read(err, next))
      }
    })
    return undefined
  }

  constructor(private _name: string = '', private onData?: OnData, private onClose?: OnClose) {
    super()
  }

  get name(): string {
    return this._name || ''
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

  // 这是 duplex 的 readable 的部分, sb 往里写数据
  // 下游的 sink 从这里拉数据
  get source() {
    if (!this._source) {
      this._source = pushable()
    }
    return this._source
  }

  // 这是 duplex 的 writable 部分, sb 通过 on(’data‘) 从这里读取数据
  get sink() {
    return this._sink
  }

  end(err?: boolean | Error | string) {
    this.source.end(err as any)
    this._finish()
  }

  push(data: any) {
    this.source.push(data)
  }

  _finish(err?: OnCloseError) {
    if (!this._ended) {
      this.onClose && this.onClose(err)
    }
    this._ended = true
  }
}

export function link(a: DuplexInterface, b: DuplexInterface) {
  pull(a.source, b.sink)
  pull(b.source, a.sink)
}

export { Duplex }
