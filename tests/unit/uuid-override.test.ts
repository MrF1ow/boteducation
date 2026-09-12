import { test } from 'vitest'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'

const require = createRequire(import.meta.url)
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function uuidFrom(pkgJsonPath: string) {
  return require(require.resolve('uuid', { paths: [dirname(pkgJsonPath)] })) as {
    v4: (buf?: unknown) => string
  }
}

function uuidMajor(pkgJsonPath: string) {
  const uuidPkg = require.resolve('uuid/package.json', {
    paths: [dirname(pkgJsonPath)],
  })
  const pkg = JSON.parse(readFileSync(uuidPkg, 'utf8')) as { version: string }
  return Number(pkg.version.split('.')[0])
}

test('Puck uuid is 11 or newer and v4 works with no buf argument', () => {
  const puckPkg = require.resolve('@measured/puck/package.json')
  assert.ok(uuidMajor(puckPkg) >= 11)
  const id = uuidFrom(puckPkg).v4()
  assert.match(id, UUID_V4)
})

test('jayson uuid is 11 or newer and v4 works with no buf argument', () => {
  const jaysonPkg = require.resolve('jayson/package.json')
  assert.ok(uuidMajor(jaysonPkg) >= 11)
  const id = uuidFrom(jaysonPkg).v4()
  assert.match(id, UUID_V4)
})
