// process.env.DEBUG = 'sb*'

import { Model } from '../src'
import { delay, printKeyValue } from './utils'

const main = async () => {
  const a = new Model({ id: 'A' })
  a.set('foo', 'bar')
  const b = a.clone() as Model
  await delay(20)

  console.log('--- cloned model---')
  console.log(`cloned model's id:`, b.id)
  printKeyValue(b, 'foo')
  b.set('foo', 'changed from b')
  printKeyValue(b, 'foo')

  console.log('--- original model---')
  console.log(`A has been cloned %d times`, a.clones)
  printKeyValue(a, 'foo')
}

main()
