import * as path from 'path'
import { readFileSync } from 'fs'
import { fork } from 'child_process'

import * as colors from 'colors'

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'))

// Call husky to set up the hooks
fork(path.resolve(__dirname, '..', 'node_modules', 'husky', 'lib', 'installer', 'bin'), ['install'])

if (pkg.repository.url.trim()) {
  console.log(colors.cyan('Now run:'))
  console.log(colors.cyan('  npm install -g semantic-release-cli'))
  console.log(colors.cyan('  semantic-release-cli setup'))
  console.log()
  console.log(colors.cyan('Important! Answer NO to "Generate travis.yml" question'))
  console.log()
  console.log(
    colors.gray('Note: Make sure "repository.url" in your package.json is correct before')
  )
} else {
  console.log(colors.red('First you need to set the "repository.url" property in package.json'))
  console.log(colors.cyan('Then run:'))
  console.log(colors.cyan('  npm install -g semantic-release-cli'))
  console.log(colors.cyan('  semantic-release-cli setup'))
  console.log()
  console.log(colors.cyan('Important! Answer NO to "Generate travis.yml" question'))
}

console.log()
