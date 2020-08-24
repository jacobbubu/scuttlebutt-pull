import split from '@jacobbubu/pull-split'
import { ldjson } from '../pull-stringify'
import * as pull from 'pull-stream'

const Truthy = (str: string) => str.length > 0

const JsonParse = (str: string) => {
  return JSON.parse(str)
}

const serialize = ldjson
const parse = function() {
  return pull(split('\n'), pull.filter(Truthy), pull.map(JsonParse))
}

export { serialize }
export { parse }
