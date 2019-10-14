import { Model, AsyncModel } from '../src'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const printKeyValue = function(model: Model, key: string) {
  console.log(`${model.id}[${key}]:`, `'${model.get(key)}'`)
}

const printAsyncKeyValue = async function(model: AsyncModel, key: string) {
  console.log(`${model.id}[${key}]:`, `'${await model.get(key)}'`)
}

export { printKeyValue, printAsyncKeyValue, delay }
