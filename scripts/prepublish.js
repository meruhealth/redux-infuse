const fs = require('fs')
const path = require('path')
const pkg = require('../package.json')

const newPkgJSON = {
  main: './index.js',
}

const fieldsToCopy = [
  'name',
  'version',
  'description',
  'author',
  'repository',
  'license',
  'bugs',
  'homepage',
  'dependencies',
  'peerDependencies',
]

fieldsToCopy.forEach(key => { newPkgJSON[key] = pkg[key] })

try {
  fs.mkdirSync(path.resolve(__dirname, '..', 'build'))
} catch (e) {
  // dir already exists
}

fs.writeFileSync(path.resolve(__dirname, '..', 'build', 'package.json'), JSON.stringify(newPkgJSON, null, 2))
