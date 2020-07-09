import split = require('@jacobbubu/pull-split')
import { ldjson } from '../pull-stringify'
import * as pull from 'pull-stream'

const Truthy = () => true

const JsonParse = (str: string) => {
  return JSON.parse(str)
  // return str.length > 0 ? JSON.parse(str) : str
}

const serialize = ldjson
const parse = function() {
  return pull(split('\n'), pull.filter(Truthy), pull.map(JsonParse))
}

export { serialize }
export { parse }
