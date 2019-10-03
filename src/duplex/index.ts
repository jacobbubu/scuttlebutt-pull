import { EventEmitter } from 'events'
import * as pull from 'pull-stream'
import Pushable = require('pull-pushable')

export interface DuplexInterface {
  readonly source: pull.Source<any>
  readonly sink: pull.Sink<any>
}

// export type OnData = (data: any, cb: (err?: Error | string | null) => void) => void
export type OnData = (data: any) => Promise<any>
export type OnClose = () => void | Promise<any>

class Duplex extends EventEmitter implements DuplexInterface {
  private _readable = true
  private _writable = true
  private _source: Pushable.Pushable<string> | undefined
  private _sink: pull.Sink<string> = read => {
    const self = this
    read(null, function next(endOrError, data) {
      if (true === endOrError) {
        // emit 'close' when upstream has no more data
        self.onClose && self.onClose()
        return
      }
      if (endOrError) {
        throw endOrError
      }
      if (!self.onData) {
        read(null, next)
      } else {
        self
          .onData(data)
          .then(() => {
            read(null, next)
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
      this._source = Pushable()
    }
    return this._source
  }

  // 这是 duplex 的 writable 部分, sb 通过 on(’data‘) 从这里读取数据
  get sink() {
    return this._sink
  }

  abort(err?: boolean | Error | string) {
    this.source.end(err)
  }

  end() {
    this.source.end()
  }

  push(data: any) {
    this.source.push(data)
  }
}

export function link(a: DuplexInterface, b: DuplexInterface) {
  // setImmediate(() => {
  //   pull(a.source, b.sink)
  //   pull(b.source, a.sink)
  // })
  pull(a.source, b.sink)
  pull(b.source, a.sink)
}

export { Duplex }
