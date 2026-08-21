/**
 * Emit `.d.cts` entry declarations alongside the `.d.ts` ones.
 *
 * Why this exists: a single `types` condition is interpreted as ESM, so a
 * consumer doing `require('mailkiln')` in a CommonJS project gets types that
 * only resolve under `import()`. publint flags it, `are-the-types-wrong` fails
 * on it, and the symptom for the consumer is "the package has no types" —
 * despite the types being right there.
 *
 * The declarations themselves are identical; only the file extension (and so the
 * module system TypeScript infers) differs. Internal relative specifiers keep
 * pointing at the `.js` paths, which TypeScript resolves to the neighbouring
 * `.d.ts` files in both module systems.
 */

import { copyFileSync, existsSync } from 'node:fs'

const entries = [
  ['dist/index.d.ts', 'dist/index.d.cts'],
  ['dist/core/index.d.ts', 'dist/core/index.d.cts'],
]

for (const [source, target] of entries) {
  if (!existsSync(source)) {
    console.error(`dts-cjs: ${source} is missing — run the declaration build first.`)
    process.exit(1)
  }
  copyFileSync(source, target)
  console.log(`dts-cjs: ${source} -> ${target}`)
}
