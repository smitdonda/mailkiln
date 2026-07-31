/**
 * Pillar 4 — merge variables.
 *
 * In the TypeScript sketch of this library you declared a generic and the
 * compiler derived the shape. In JavaScript the *sample object is the schema*:
 * we walk it once and get every path, its kind and a preview value. One object
 * then drives all four consumers — `{{` autocomplete in the editor, the
 * unknown-path lint rule, the preview render, and the `Props` interface on the
 * exported component. No declaration step, nothing to keep in sync.
 *
 * @module mailforge/core/vars
 */

/** @typedef {import('./types.js').VarsDef} VarsDef */
/** @typedef {import('./types.js').VarPath} VarPath */

/** Matches `{{ user.name }}` and `{{ items[0].title }}`. */
export const VAR_PATTERN = /\{\{\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d+\])*)\s*\}\}/g

/** How deep we walk the sample object when deriving paths. */
const MAX_DEPTH = 6

/**
 * @param {any} value
 * @returns {VarPath['kind']}
 */
export function kindOf(value) {
  if (value === null || value === undefined) return 'unknown'
  if (Array.isArray(value)) return 'array'
  const t = typeof value
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'object') {
    return /** @type {VarPath['kind']} */ (t)
  }
  return 'unknown'
}

/**
 * Flatten a sample object into interpolatable paths. Arrays expose `[0]` (the
 * shape of an item) plus `.length`, which covers the "3 items in your cart"
 * case without pretending we can loop in a merge tag.
 *
 * @param {Record<string, any>} sample
 * @returns {VarPath[]}
 */
export function walkSample(sample) {
  /** @type {VarPath[]} */
  const out = []

  /**
   * @param {any} value
   * @param {string} prefix
   * @param {number} depth
   */
  const visit = (value, prefix, depth) => {
    const kind = kindOf(value)
    const leaf = kind === 'string' || kind === 'number' || kind === 'boolean'
    if (prefix) out.push({ path: prefix, kind, sample: value, leaf })
    if (depth >= MAX_DEPTH) return

    if (kind === 'array') {
      out.push({ path: `${prefix}.length`, kind: 'number', sample: value.length, leaf: true })
      if (value.length > 0) visit(value[0], `${prefix}[0]`, depth + 1)
      return
    }
    if (kind === 'object') {
      for (const [key, child] of Object.entries(value)) {
        visit(child, prefix ? `${prefix}.${key}` : key, depth + 1)
      }
    }
  }

  visit(sample ?? {}, '', 0)
  return out
}

/**
 * Read a dotted/indexed path out of an object.
 *
 * @param {any} obj
 * @param {string} path
 * @returns {any}
 */
export function getPath(obj, path) {
  if (!path) return undefined
  const parts = String(path)
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
  let cursor = obj
  for (const part of parts) {
    if (cursor == null) return undefined
    cursor = cursor[part]
  }
  return cursor
}

/**
 * Declare the merge variables for a template.
 *
 * @param {object} [init]
 * @param {Record<string, any>} [init.sample] Realistic sample data. This *is* the schema.
 * @param {Record<string, string>} [init.types] Optional overrides for the exported
 *   TS interface, e.g. `{ 'order.total': 'number' }`. Only needed when the sample
 *   value's own type is wrong or too narrow.
 * @returns {VarsDef}
 */
export function defineVars(init = {}) {
  const sample = init.sample ?? {}
  if (typeof sample !== 'object' || Array.isArray(sample)) {
    throw new Error('mailforge: defineVars({ sample }) expects `sample` to be a plain object.')
  }
  const types = init.types ?? {}
  const paths = walkSample(sample)
  const index = new Map(paths.map((p) => [p.path, p]))

  return {
    sample,
    paths,
    types,
    has: (path) => index.has(path),
    get: (path) => getPath(sample, path),
  }
}

/**
 * Every `{{path}}` used in a string, in order, de-duplicated.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function findVarPaths(text) {
  if (typeof text !== 'string' || !text.includes('{{')) return []
  /** @type {string[]} */
  const found = []
  for (const match of text.matchAll(VAR_PATTERN)) {
    if (!found.includes(match[1])) found.push(match[1])
  }
  return found
}

/**
 * Replace `{{path}}` with sample values.
 *
 * Unknown paths are left as-is on purpose: an unresolved tag is visible in the
 * preview (and reported by the `unknown-var` lint rule) instead of silently
 * rendering as an empty string, which is how broken merge tags reach inboxes.
 *
 * @param {string} text
 * @param {VarsDef | Record<string, any> | null} vars
 * @returns {string}
 */
export function interpolate(text, vars) {
  if (typeof text !== 'string' || !text.includes('{{')) return text ?? ''
  const sample = vars && 'sample' in vars ? vars.sample : (vars ?? {})
  return text.replace(VAR_PATTERN, (whole, path) => {
    const value = getPath(sample, path)
    if (value === undefined || value === null) return whole
    if (typeof value === 'object') return whole
    return String(value)
  })
}

/**
 * Top-level identifiers used by a set of paths — the names the exported
 * component destructures from its props.
 *
 * @param {string[]} paths
 * @returns {string[]}
 */
export function varRoots(paths) {
  /** @type {string[]} */
  const roots = []
  for (const path of paths) {
    const root = String(path).split(/[.[]/)[0]
    if (root && !roots.includes(root)) roots.push(root)
  }
  return roots.sort()
}

/**
 * Paths used anywhere in a document. Walks every string prop of every block, so
 * custom blocks get merge-var support without registering anything.
 *
 * @param {import('./types.js').EmailDocument} doc
 * @returns {string[]}
 */
export function documentVarPaths(doc) {
  /** @type {string[]} */
  const found = []
  /** Loop variables introduced by a repeat: `item` in `{{item.title}}`. */
  const locals = new Set()
  /**
   * @param {any} value
   */
  const scan = (value) => {
    if (typeof value === 'string') {
      for (const path of findVarPaths(value)) if (!found.includes(path)) found.push(path)
    } else if (Array.isArray(value)) {
      value.forEach(scan)
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(scan)
    }
  }
  /** @param {string | undefined} path */
  const add = (path) => {
    if (path && !found.includes(path)) found.push(path)
  }

  scan(doc?.settings?.preheader)
  scan(doc?.settings?.subject)
  for (const section of doc?.sections ?? []) {
    // A path used *only* in a display condition is still a path the exported
    // component needs as a prop, and still one the unknown-variable rule should
    // check. Missing them here would make `showIf` silently untyped.
    add(section.showIf?.path)
    for (const row of section.rows ?? []) {
      add(row.showIf?.path)
      add(row.repeat?.path)
      if (row.repeat?.as) locals.add(String(row.repeat.as))
      for (const column of row.columns ?? []) {
        for (const block of column.blocks ?? []) {
          add(block.showIf?.path)
          scan(block.props)
        }
      }
    }
  }

  // `{{item.title}}` inside a repeat resolves to the loop variable, not to a
  // declared root. Dropping those keeps them out of the props interface and out
  // of the linter's "undeclared" list — both correct.
  return locals.size
    ? found.filter((path) => !locals.has(String(path).split(/[.[]/)[0]))
    : found
}

/**
 * Loop variable names introduced anywhere in the document.
 *
 * The linter needs these to tell "you typed `{{itme.title}}`" from "`item` is a
 * loop variable and is perfectly fine".
 *
 * @param {import('./types.js').EmailDocument} doc
 * @returns {Set<string>}
 */
export function documentLocalVars(doc) {
  /** @type {Set<string>} */
  const locals = new Set()
  for (const section of doc?.sections ?? []) {
    for (const row of section.rows ?? []) {
      if (row.repeat?.as) {
        locals.add(String(row.repeat.as))
        locals.add(`${row.repeat.as}Index`)
      }
    }
  }
  return locals
}

// ---------------------------------------------------------------------------
// TypeScript type emission (for the optional `tsx` export)
// ---------------------------------------------------------------------------

/**
 * @param {any} value
 * @returns {string}
 */
function tsTypeOf(value) {
  const kind = kindOf(value)
  switch (kind) {
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'array':
      return `Array<${value.length ? tsTypeOf(value[0]) : 'unknown'}>`
    case 'object': {
      const entries = Object.entries(value)
      if (!entries.length) return 'Record<string, unknown>'
      return `{ ${entries.map(([k, v]) => `${safeKey(k)}: ${tsTypeOf(v)}`).join('; ')} }`
    }
    default:
      return 'unknown'
  }
}

/**
 * @param {string} key
 * @returns {string}
 */
function safeKey(key) {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)
}

/**
 * Type for one root prop, honouring `types` overrides on nested paths.
 *
 * @param {VarsDef} vars
 * @param {string} root
 * @returns {string}
 */
export function tsTypeForRoot(vars, root) {
  const override = vars.types?.[root]
  if (override) return override
  const value = getPath(vars.sample, root)
  const nestedOverrides = Object.keys(vars.types ?? {}).filter((k) => k.startsWith(`${root}.`))
  if (!nestedOverrides.length) return tsTypeOf(value)

  // Rebuild the object type so nested overrides land in the right place.
  /**
   * @param {any} node
   * @param {string} prefix
   * @returns {string}
   */
  const build = (node, prefix) => {
    const direct = vars.types?.[prefix]
    if (direct) return direct
    if (kindOf(node) !== 'object') return tsTypeOf(node)
    const entries = Object.entries(node)
    if (!entries.length) return 'Record<string, unknown>'
    return `{ ${entries.map(([k, v]) => `${safeKey(k)}: ${build(v, `${prefix}.${k}`)}`).join('; ')} }`
  }
  return build(value, root)
}

/**
 * Emit a `Props` interface for the roots a template actually uses.
 *
 * @param {string} name Interface name, e.g. `WelcomeProps`.
 * @param {VarsDef | null} vars
 * @param {string[]} roots
 * @returns {string} '' when there are no props to declare
 */
export function emitPropsInterface(name, vars, roots) {
  if (!roots.length) return ''
  const lines = roots.map((root) => {
    const type = vars ? tsTypeForRoot(vars, root) : 'unknown'
    return `  ${safeKey(root)}: ${type}`
  })
  return `export interface ${name} {\n${lines.join('\n')}\n}`
}

/**
 * Emit a JSDoc `@param` block describing the props — the plain-`.jsx` export's
 * equivalent of the interface, so editors still autocomplete without TS.
 *
 * @param {VarsDef | null} vars
 * @param {string[]} roots
 * @returns {string} '' when there are no props to document
 */
export function emitPropsJsdoc(vars, roots) {
  if (!roots.length) return ''
  const shape = roots
    .map((root) => `${safeKey(root)}: ${vars ? tsTypeForRoot(vars, root) : 'unknown'}`)
    .join('; ')
  return `/**\n * @param {{ ${shape} }} props\n */`
}

// ---------------------------------------------------------------------------
// Foreign merge syntax (used by the HTML importer)
// ---------------------------------------------------------------------------

/**
 * Other platforms' merge syntaxes, in the order we try them.
 *
 * `enabledByDefault: false` marks a syntax too ambiguous to run unasked —
 * SendGrid's `-name-` would happily rewrite "cutting-edge" into a merge tag.
 * Opt into those with `{ only: [...] }`.
 *
 * @type {Array<{ id: string, pattern: RegExp, toPath: (groups: string[]) => string,
 *   enabledByDefault: boolean, label: string }>}
 */
export const FOREIGN_VAR_SYNTAXES = [
  {
    id: 'mailchimp',
    label: 'Mailchimp / Campaign Monitor — *|FNAME|*',
    pattern: /\*\|([A-Z0-9_:]+)\|\*/g,
    toPath: (g) => g[0].toLowerCase().replace(/:/g, '.'),
    enabledByDefault: true,
  },
  {
    id: 'mailgun',
    label: 'Mailgun — %recipient:name%',
    pattern: /%recipient[.:]([\w.]+)%/gi,
    toPath: (g) => g[0].toLowerCase(),
    enabledByDefault: true,
  },
  {
    id: 'percent',
    label: 'Generic — %%NAME%%',
    pattern: /%%([A-Za-z0-9_.]+)%%/g,
    toPath: (g) => g[0].toLowerCase(),
    enabledByDefault: true,
  },
  {
    id: 'sendgrid',
    label: 'SendGrid legacy — -name-',
    pattern: /-([a-z][\w]{2,})-(?![\w-])/g,
    toPath: (g) => g[0].toLowerCase(),
    enabledByDefault: false,
  },
]

/**
 * Rewrite foreign merge tags to mailforge's `{{path}}` form. This is what turns
 * "we can import your HTML" into "we can import your Mailchimp template".
 *
 * @param {string} text
 * @param {object} [options]
 * @param {string[]} [options.only] Run exactly these syntax ids (enables opt-in ones).
 * @returns {{ text: string, found: string[] }}
 */
export function foreignVarsToMailforge(text, options = {}) {
  if (typeof text !== 'string' || !text) return { text: text ?? '', found: [] }
  /** @type {string[]} */
  const found = []
  let out = text
  for (const syntax of FOREIGN_VAR_SYNTAXES) {
    const enabled = options.only ? options.only.includes(syntax.id) : syntax.enabledByDefault
    if (!enabled) continue
    out = out.replace(syntax.pattern, (whole, ...rest) => {
      const groups = rest.slice(0, rest.length - 2).map((g) => (g == null ? '' : String(g)))
      const path = syntax.toPath(groups)
      if (!path) return whole
      if (!found.includes(path)) found.push(path)
      return `{{${path}}}`
    })
  }
  return { text: out, found }
}
