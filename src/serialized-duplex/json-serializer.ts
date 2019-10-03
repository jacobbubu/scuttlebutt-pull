import split = require('@jacobbubu/pull-split')
import { ldjson } from '../pull-stringify'
import * as pull from 'pull-stream'

const Truthy = () => true

const serialize = ldjson
const parse = function() {
  return pull(split('\n'), pull.filter(Truthy), pull.map(JSON.parse))!
}

export { serialize }
export { parse }
