import { test } from 'vitest'
import assert from 'node:assert/strict'
import { supabaseStorageRemotePatterns } from '@/lib/images/supabase-storage-remote-patterns'

test('hosted project URL allows only that host storage objects', () => {
  assert.deepEqual(
    supabaseStorageRemotePatterns('https://abcd.supabase.co'),
    [
      {
        protocol: 'https',
        hostname: 'abcd.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  )
})

test('local supabase CLI URL keeps http and the 54321 port', () => {
  assert.deepEqual(
    supabaseStorageRemotePatterns('http://127.0.0.1:54321'),
    [
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
        pathname: '/storage/v1/object/**',
      },
    ],
  )
})

test('missing or invalid URLs produce no pattern', () => {
  assert.deepEqual(supabaseStorageRemotePatterns(undefined), [])
  assert.deepEqual(supabaseStorageRemotePatterns(''), [])
  assert.deepEqual(supabaseStorageRemotePatterns('not a url'), [])
  assert.deepEqual(supabaseStorageRemotePatterns('ftp://files.example'), [])
})
