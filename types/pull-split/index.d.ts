declare module '@jacobbubu/pull-split' {
  import * as pull from '@jacobbubu/pull-stream'

  // matcher, mapper, reverse, last
  function split<T>(
    matcher?: string | RegExp,
    mapper?: (value: T) => string,
    reverse?: boolean,
    last?: boolean
  ): pull.Through<T, string>
  export = split
}
