// process.env.DEBUG = 'sb*'
import * as fs from 'fs'
import * as path from 'path'
import osenv = require('osenv')
import writeFile from '@jacobbubu/pull-write-file'

import * as pull from 'pull-stream'
import { Model, createDumpDuplex } from '../src'
import { delay } from './utils'

const file = path.join(osenv.tmpdir(), 'pull-write-file_test.' + Date.now())

function printFile(file: string) {
  console.log('file content:')
  console.log(
    fs
      .readFileSync(file)
      .toString()
      .split('\n')
      .map(line => '   ' + line)
      .join('\n')
  )
}

const main = async () => {
  console.log('write to:', file)

  const a = new Model({ id: 'A' })
  a.set('foo', 'bar')
  const s1 = a.createStream({ name: 'a->b' })
  const dumpStream = createDumpDuplex(
    writeFile(file, _ => {
      printFile(file)
      fs.unlinkSync(file)
    })
  )

  pull(s1, dumpStream, s1)
  await delay(10)

  a.set('foo1', 'bar1')
}

// tslint:disable-next-line:no-floating-promises
main()
