declare module 'pull-pushable' {
  import * as pull from 'pull-stream'

  function pushable<T>(): pushable.Pushable<T>

  namespace pushable {
    export interface Pushable<T> extends pull.Source<T> {
      end(endOrError?: boolean | Error | string): void
      push(data: any): void
    }
  }
  export = pushable
}
