import { Sources, Update, UpdateItems } from './interfaces'
import { EventEmitter } from 'events'
import isPromise = require('is-promise')

export function createId() {
  return [1, 1, 1]
    .map(function() {
      return Math.random()
        .toString(16)
        .substring(2)
        .toUpperCase()
    })
    .join('')
}

export function filter(update: Update, sources: Sources) {
  // update in local store
  const ts = update[UpdateItems.Timestamp]
  const source = update[UpdateItems.SourceId]
  return !sources || !sources[source] || sources[source] < ts
}

export function sort(hist: Update[]) {
  return hist.sort(function(a, b) {
    // sort by timestamps, then ids.
    // there should never be a pair with equal timestamps
    // and ids.
    return (
      a[UpdateItems.Timestamp] - b[UpdateItems.Timestamp] ||
      (a[UpdateItems.SourceId] > b[UpdateItems.SourceId] ? 1 : -1)
    )
  })
}

export function protoIsIllegal(s: EventEmitter) {
  s.emit('invalid', new Error('"__proto__" is illegal property name'))
}

export const isUndefined = (obj: any): obj is undefined => typeof obj === 'undefined'
export const isObject = (fn: any): fn is object => !isNil(fn) && typeof fn === 'object'
export const validatePath = (path?: string): string =>
  path ? (path.charAt(0) !== '/' ? '/' + path : path) : ''
export const isFunction = (fn: any): boolean => typeof fn === 'function'
export const isString = (fn: any): fn is string => typeof fn === 'string'
export const isConstructor = (fn: any): boolean => fn === 'constructor'
export const isNil = (obj: any): obj is null | undefined => isUndefined(obj) || obj === null
export const isEmpty = (array: any): boolean => !(array && array.length > 0)
export const isSymbol = (fn: any): fn is symbol => typeof fn === 'symbol'
export { isPromise }
