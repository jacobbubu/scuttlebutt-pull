import * as pull from '@jacobbubu/pull-stream'

function defined(...args: any) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== undefined) return args[i]
  }
}

function pullStringify(options: Record<string, any>) {
  options = defined(options, {})

  // default is pretty double newline delimited json
  const open = defined(options.open, '')
  const prefix = defined(options.prefix, '')
  const suffix = defined(options.suffix, '\n\n')
  const close = defined(options.close, '')
  const indent = defined(options.indent, 2)
  const stringify = defined(options.stringify, JSON.stringify)

  let first = true
  let ended: boolean | Error = false
  return function<T>(read: pull.Source<T>) {
    return function readForSink(endFromSink: boolean | Error | null, cbFromSink: Function) {
      if (endFromSink) {
        // pass the end request from sink to source
        read(true, function(endFromSource, data) {
          // and then, give sink a callback that we have finished the stream
          return cbFromSink(true)
        })
        return
      }
      // if the source has requested an end before
      if (ended) return cbFromSink(ended)

      read(null, function(endFromSource, data) {
        if (!endFromSource) {
          const f = first
          first = false

          const serialized = stringify(data, null, indent)
          cbFromSink(null, (f ? open : prefix) + serialized + suffix)
        } else {
          ended = endFromSource
          if (ended !== true) {
            return cbFromSink(ended)
          }
          cbFromSink(null, first ? open + close : close)
        }
      })
    }
  }
}

type Stringify = (
  value: any,
  replacer?: (this: any, key: string, value: any) => any | (number | string)[] | null,
  space?: string | number
) => string

const ldjson = function(stringify?: Stringify) {
  return pullStringify({
    suffix: '\n',
    indent: 0,
    stringify: stringify
  })
}

export { ldjson }
