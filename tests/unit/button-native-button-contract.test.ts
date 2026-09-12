import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Base UI Button defaults `nativeButton` to true (host is `<button>`).
 * `render={<Link />}` / `render={<a />}` swaps the host to an anchor, and
 * without `nativeButton={false}` Base UI console.errors on every public page
 * (Next.js Issues overlay).
 */

const ROOTS = ['app', 'components', 'lib']

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx$/.test(entry)) out.push(full)
  }
  return out
}

function buttonOpenTags(src: string): string[] {
  const tags: string[] = []
  const re = /<Button\b/g
  let match: RegExpExecArray | null
  while ((match = re.exec(src))) {
    let depth = 0
    for (let i = match.index; i < src.length; i++) {
      const ch = src[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (ch === '>' && depth === 0) {
        tags.push(src.slice(match.index, i + 1))
        break
      }
    }
  }
  return tags
}

function renderIsNonButton(tag: string): boolean {
  if (!/\brender=\{/.test(tag)) return false
  return /render=\{<(Link|a)\b/.test(tag)
}

describe('Button nativeButton contract', () => {
  it('sets nativeButton={false} when Button render is a Link or <a>', () => {
    const files = ROOTS.flatMap((dir) => walk(join(process.cwd(), dir)))
    const violations: string[] = []

    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      if (!src.includes('<Button')) continue
      for (const tag of buttonOpenTags(src)) {
        if (!renderIsNonButton(tag)) continue
        if (!/\bnativeButton=\{false\}/.test(tag)) {
          const rel = file.replace(`${process.cwd()}/`, '')
          violations.push(`${rel}: ${tag.replace(/\s+/g, ' ').slice(0, 160)}`)
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })
})
