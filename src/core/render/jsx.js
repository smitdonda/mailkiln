/**
 * PILLAR 1 — eject to React Email code.
 *
 * This emitter is the reason mailkiln exists. Every other visual builder hands
 * you a proprietary JSON blob and a rendered HTML string; this one hands you a
 * component you own, in the framework the ecosystem already uses, with your merge
 * variables as real props.
 *
 * Two hard requirements shape the code below:
 *
 *   1. **Deterministic output.** Same document in, byte-identical file out, with
 *      stable prop order. The export has to diff cleanly in the consumer's git
 *      history or it is not really "their code".
 *   2. **It must always compile.** A block with no `jsx` renderer degrades to
 *      `dangerouslySetInnerHTML` with its HTML output rather than failing the
 *      export, and any text containing markup takes the same path.
 *
 * The formatter is ~90 lines and has no `prettier` dependency, on purpose.
 *
 * @module mailkiln/core/render/jsx
 */

import { getBlockDef } from '../registry.js'
import { documentVarPaths, emitPropsInterface, emitPropsJsdoc, varRoots } from '../vars.js'
import { spacingToCss } from './inline.js'
import { createRenderContext } from './context.js'
import { el, guard, isElement, isGuard, isLoop, isRaw, loop, raw, varsToChildren } from './jsxNode.js'
import { conditionExpression, normalizeRepeat } from '../conditions.js'
import { renderBlockContent } from './html.js'
import { HIDE_CLASS, blockClass, mobileFontSize, mobileMediaCss } from './mobile.js'

/** @typedef {import('../types.js').EmailDocument} EmailDocument */
/** @typedef {import('../types.js').JsxNode} JsxNode */
/** @typedef {import('../types.js').JsxElement} JsxElement */
/** @typedef {import('../types.js').RenderContext} RenderContext */

/**
 * Components we can import from `@react-email/components`. Anything else is
 * emitted as a plain lowercase HTML tag, which needs no import.
 */
export const REACT_EMAIL_COMPONENTS = new Set([
  'Body',
  'Button',
  'Column',
  'Container',
  'Font',
  'Head',
  'Heading',
  'Hr',
  'Html',
  'Img',
  'Link',
  'Markdown',
  'Preview',
  'Row',
  'Section',
  'Text',
])

const INDENT = '  '
const MAX_LINE = 96

// ---------------------------------------------------------------------------
// printing
// ---------------------------------------------------------------------------

/**
 * @param {string} value
 * @returns {string}
 */
function quote(value) {
  return value.includes('"') ? `'${value.replace(/'/g, "\\'")}'` : `"${value}"`
}

/**
 * @param {string} key
 * @returns {string}
 */
function objectKey(key) {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)
}

/**
 * Print a JS value as source. Handles the nested objects our style props use.
 *
 * @param {any} value
 * @param {number} depth
 * @returns {string}
 */
function printValue(value, depth) {
  if (isRaw(value)) return value.__raw
  if (value === null) return 'null'
  if (typeof value === 'string') return quote(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${value.map((v) => printValue(v, depth)).join(', ')}]`
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined && v !== '')
    if (!entries.length) return '{}'
    const inline = `{ ${entries.map(([k, v]) => `${objectKey(k)}: ${printValue(v, depth)}`).join(', ')} }`
    if (inline.length <= MAX_LINE - depth * 2) return inline
    const pad = INDENT.repeat(depth + 1)
    const body = entries
      .map(([k, v]) => `${pad}${objectKey(k)}: ${printValue(v, depth + 1)},`)
      .join('\n')
    return `{\n${body}\n${INDENT.repeat(depth)}}`
  }
  return 'undefined'
}

/**
 * @param {string} key
 * @param {any} value
 * @param {number} depth
 * @returns {string | null}
 */
function printProp(key, value, depth) {
  if (value === undefined || value === null || value === '' || value === false) return null
  if (value === true) return key
  if (isRaw(value)) return `${key}=${value.__raw}`
  if (typeof value === 'string') return `${key}=${quote(value)}`
  // depth + 1: a multi-line style object is nested one level inside the tag that
  // carries it, and its closing brace has to line up with the prop, not the tag.
  return `${key}={${printValue(value, depth + 1)}}`
}

/**
 * @param {JsxNode} node
 * @param {number} depth
 * @param {Set<string>} used Collects component names for the import statement.
 * @returns {string}
 */
function printNode(node, depth, used) {
  const pad = INDENT.repeat(depth)
  if (node === null || node === undefined || node === '') return ''
  if (Array.isArray(node)) {
    return node
      .map((child) => printNode(child, depth, used))
      .filter(Boolean)
      .join('\n')
  }
  if (isRaw(node)) return pad + node.__raw

  // `{cond && (…)}` and `{list.map((item, i) => (…))}`. Both indent their child
  // one level and close on their own line, so nesting a conditional row inside a
  // conditional section still reads like hand-written JSX.
  if (isGuard(node)) {
    const inner = printNode(node.child, depth + 1, used)
    return inner ? `${pad}{${node.__guard} && (\n${inner}\n${pad})}` : ''
  }
  if (isLoop(node)) {
    const inner = printNode(node.child, depth + 1, used)
    return inner ? `${pad}{${node.__loop}.map((${node.params}) => (\n${inner}\n${pad}))}` : ''
  }

  if (typeof node === 'string' || typeof node === 'number') return pad + String(node)
  if (!isElement(node)) return ''

  if (REACT_EMAIL_COMPONENTS.has(node.tag)) used.add(node.tag)

  const props = Object.entries(node.props ?? {})
    .map(([key, value]) => printProp(key, value, depth))
    .filter(Boolean)

  const children = (node.children ?? []).filter((c) => c !== null && c !== undefined && c !== '')
  const openInline = `<${node.tag}${props.length ? ` ${props.join(' ')}` : ''}`

  // Inline children (text and expressions) MUST stay on one line. JSX condenses
  // a newline next to text into a single space, so splitting
  // `Thanks, {user.name}!` across lines would export as `Thanks, Smit !` — a
  // stray space in front of the punctuation, in the recipient's inbox.
  const allInline = children.every((child) => typeof child === 'string' || isRaw(child))
  if (children.length && allInline) {
    const text = children.map((child) => (isRaw(child) ? child.__raw : String(child))).join('')
    const props1 = props.length ? ` ${props.join(' ')}` : ''
    const single = `${pad}<${node.tag}${props1}>${text}</${node.tag}>`
    if (single.length <= MAX_LINE) return single
    // Too long: break the props out, but keep the children on their own single
    // line so the whitespace semantics stay intact.
    const open =
      props.length > 0
        ? `${pad}<${node.tag}\n${props.map((p) => `${pad}${INDENT}${p}`).join('\n')}\n${pad}>`
        : `${pad}<${node.tag}>`
    return `${open}\n${pad}${INDENT}${text}\n${pad}</${node.tag}>`
  }

  const openTag =
    openInline.length + pad.length <= MAX_LINE
      ? `${pad}${openInline}`
      : `${pad}<${node.tag}\n${props.map((p) => `${pad}${INDENT}${p}`).join('\n')}\n${pad}`

  if (!children.length) {
    return openTag.endsWith(pad) ? `${openTag}/>` : `${openTag} />`
  }

  const inner = children
    .map((child) => printNode(child, depth + 1, used))
    .filter(Boolean)
    .join('\n')
  return `${openTag}>\n${inner}\n${pad}</${node.tag}>`
}

// ---------------------------------------------------------------------------
// document -> tree
// ---------------------------------------------------------------------------

/**
 * @param {import('../types.js').Block} block
 * @param {RenderContext} ctx
 * @returns {JsxNode}
 */
function blockNode(block, ctx) {
  const def = getBlockDef(block.type)
  const props = block.props ?? {}
  if (def?.render?.jsx) {
    const node = def.render.jsx(props, ctx)
    return typeof node === 'string' ? raw(node) : node
  }
  // No jsx renderer: fall back to the block's HTML. Not pretty, but the export
  // never fails because someone shipped a block with one renderer.
  const html = def ? renderBlockContent(block, ctx) : `<!-- unknown block: ${block.type} -->`
  return el('div', {
    dangerouslySetInnerHTML: raw(`{{ __html: ${JSON.stringify(html)} }}`),
  })
}

/**
 * @param {import('../types.js').Column} column
 * @param {RenderContext} ctx
 * @returns {import('../types.js').JsxLeaf[]}
 */
function columnBlocks(column, ctx) {
  return (column.blocks ?? []).map((block) => {
    const node = blockNode(block, ctx)
    const padding = spacingToCss(block.props?.padding)
    const wrapperStyle = {
      padding: padding || undefined,
      backgroundColor: block.props?.backgroundColor || undefined,
      textAlign: block.props?.align && block.props.align !== 'left' ? block.props.align : undefined,
    }
    // A mobile rule has nowhere to land without a wrapper, so a block that has
    // one gets a wrapper it would otherwise have skipped.
    const className =
      [
        block.props?.hideOnMobile === true ? HIDE_CLASS : '',
        mobileFontSize(block.props ?? {}) ? blockClass(block.id) : '',
      ]
        .filter(Boolean)
        .join(' ') || undefined
    const hasStyle = Object.values(wrapperStyle).some((v) => v !== undefined)
    const wrapped =
      !hasStyle && className === undefined
        ? node
        : el('Section', hasStyle ? { className, style: wrapperStyle } : { className }, [node])
    return /** @type {import('../types.js').JsxLeaf} */ (conditional(block, wrapped))
  })
}

/**
 * Wrap a node in its display condition, if it has one.
 *
 * @param {{ showIf?: any }} node
 * @param {JsxNode} rendered
 * @returns {JsxNode}
 */
function conditional(node, rendered) {
  const expression = conditionExpression(node?.showIf)
  return expression ? guard(expression, rendered) : rendered
}

/**
 * The border sides a row or column has set, as React style properties. Only the
 * sides actually in use are emitted, so a template with no borders exports the
 * same JSX it did before the field existed.
 *
 * @param {Record<string, any> | undefined} props
 * @returns {Record<string, string>}
 */
function borders(props) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const side of ['borderTop', 'borderRight', 'borderBottom', 'borderLeft']) {
    if (props?.[side]) out[side] = String(props[side])
  }
  return out
}

/**
 * @param {import('../types.js').Row} row
 * @param {RenderContext} ctx
 * @returns {JsxNode}
 */
function rowNode(row, ctx) {
  const repeat = normalizeRepeat(row.repeat)
  if (repeat) {
    // Inside the loop `{{item.title}}` has to become `{item.title}` and nothing
    // else — the emitter already turns every `{{path}}` into an expression, and
    // the loop variable is just another path once it is in scope.
    const inner = rowNodeOnce({ ...row, repeat: undefined }, ctx, { key: raw(`{${repeat.as}Index}`) })
    return conditional(row, loop(repeat.path, `${repeat.as}, ${repeat.as}Index`, inner))
  }
  return conditional(row, rowNodeOnce(row, ctx))
}

/**
 * @param {import('../types.js').Row} row
 * @param {RenderContext} ctx
 * @param {Record<string, any>} [extraProps] Merged into the outermost element — the
 *   `key` a mapped row needs.
 * @returns {JsxNode}
 */
function rowNodeOnce(row, ctx, extraProps) {
  const columns = row.columns ?? []
  const rowStyle = {
    padding: spacingToCss(row.props?.padding) || undefined,
    backgroundColor: row.props?.backgroundColor || undefined,
    ...borders(row.props),
  }
  const hasRowStyle = Object.values(rowStyle).some((v) => v !== undefined)

  // A single plain column needs no Row/Column wrapper. Skipping it keeps simple
  // templates readable instead of burying one <Text> under two layout tags.
  if (columns.length === 1) {
    const column = columns[0]
    const plain =
      !spacingToCss(column.props?.padding) &&
      !column.props?.backgroundColor &&
      Object.keys(borders(column.props)).length === 0 &&
      (column.props?.verticalAlign ?? 'top') === 'top'
    // …unless the row is mapped: React needs the `key` on a single element, and
    // an array of blocks has nowhere to put one.
    if (plain && !hasRowStyle && !extraProps) return columnBlocks(column, ctx)
    if (plain) {
      return el(
        'Section',
        { ...extraProps, style: hasRowStyle ? rowStyle : undefined },
        columnBlocks(column, ctx),
      )
    }
  }

  return el(
    'Row',
    { ...extraProps, ...(hasRowStyle ? { style: rowStyle } : {}) },
    columns.map((column) => {
      const blocks = columnBlocks(column, ctx)
      return el(
        'Column',
        {
          style: {
            width: `${column.props?.width ?? 100}%`,
            verticalAlign: column.props?.verticalAlign || undefined,
            padding: spacingToCss(column.props?.padding) || undefined,
            backgroundColor: column.props?.backgroundColor || undefined,
            ...borders(column.props),
          },
        },
        // An empty cell collapses in several clients, so give it a nbsp — the
        // same thing the HTML renderer does.
        blocks.length ? blocks : [raw("{'\\u00a0'}")],
      )
    }),
  )
}

/**
 * @param {import('../types.js').Section} section
 * @param {RenderContext} ctx
 * @returns {JsxNode}
 */
function sectionNode(section, ctx) {
  const props = section.props ?? {}
  const rows = (section.rows ?? []).map((row) => rowNode(row, ctx))
  const container = el(
    'Container',
    {
      style: {
        maxWidth: Number(ctx.settings.width) || 600,
        width: '100%',
        // Mirrors the HTML renderer: the section's own background wins, or the
        // container would paint over the band.
        backgroundColor:
          props.fullWidth === true
            ? undefined
            : props.backgroundColor || ctx.settings.contentBackgroundColor,
      },
    },
    rows,
  )
  const outerStyle = {
    backgroundColor: props.backgroundColor || undefined,
    backgroundImage: props.backgroundImage ? `url(${props.backgroundImage})` : undefined,
    backgroundSize: props.backgroundImage ? 'cover' : undefined,
    padding: spacingToCss(props.padding) || undefined,
    borderTop: props.borderTop || undefined,
    borderBottom: props.borderBottom || undefined,
  }
  return conditional(section, el('Section', { style: outerStyle }, [container]))
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

/**
 * What this template is called: its own name if it has one, else the subject
 * line, else a generic fallback.
 *
 * The subject is a poor name and only a fallback — "50% off — today only!" is a
 * fine subject and a terrible component name, and the same subject may well be
 * shared by several templates.
 *
 * @param {EmailDocument} doc
 * @returns {string}
 */
export function documentName(doc) {
  const settings = doc?.settings ?? {}
  return String(settings.name ?? '').trim() || String(settings.subject ?? '').trim() || 'EmailTemplate'
}

/**
 * @param {string} value
 * @returns {string} a PascalCase JS identifier
 */
export function toComponentName(value) {
  const cleaned = String(value ?? '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
  if (!cleaned) return 'EmailTemplate'
  const name = cleaned
    .split(/\s+/)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('')
  return /^[A-Za-z]/.test(name) ? name : `Email${name}`
}

/**
 * Emit a React Email component.
 *
 * @param {EmailDocument} doc
 * @param {object} [options]
 * @param {import('../types.js').VarsDef | null} [options.vars]
 * @param {'jsx' | 'tsx'} [options.lang] Output language. `jsx` is the default;
 *   `tsx` adds the generated `Props` interface. Both are the same component.
 * @param {string} [options.name] Component name. Defaults to the subject line,
 *   or `EmailTemplate`.
 * @returns {string}
 */
export function renderToJsx(doc, options = {}) {
  const lang = options.lang === 'tsx' ? 'tsx' : 'jsx'
  // `raw: true` — the emitter needs `{{tags}}` intact so it can turn them into
  // prop references rather than baking the sample values into the code.
  const ctx = createRenderContext(doc, { vars: options.vars, target: 'jsx', raw: true })
  const name = toComponentName(options.name ?? documentName(doc))
  const roots = varRoots(documentVarPaths(doc))

  /** @type {Set<string>} */
  const used = new Set()

  const body = []
  if (doc?.settings?.preheader) {
    body.push(el('Preview', {}, varsToChildren(doc.settings.preheader)))
  }
  body.push(
    el(
      'Body',
      {
        style: {
          backgroundColor: ctx.settings.backgroundColor,
          fontFamily: ctx.settings.fontFamily,
          color: ctx.settings.textColor,
          margin: 0,
          padding: 0,
        },
      },
      (doc?.sections ?? []).map((section) => sectionNode(section, ctx)),
    ),
  )

  // The ejected component has to behave like the sent email, not merely resemble
  // it — a block marked "hide on mobile" that stays visible in your own code
  // would make the setting a lie the moment you ejected.
  const mobileCss = mobileMediaCss(doc, Number(ctx.settings.width) || 600)
  const head = mobileCss
    ? el('Head', {}, [el('style', {}, [raw(`{\`${mobileCss}\`}`)])])
    : el('Head', {})

  const tree = el('Html', { lang: ctx.settings.language || 'en' }, [head, ...body])
  const markup = printNode(tree, 2, used)

  const imports = [...used].sort()
  const importLine = imports.length
    ? `import { ${imports.join(', ')} } from '@react-email/components'`
    : ''

  const signature =
    roots.length === 0
      ? `export function ${name}()`
      : lang === 'tsx'
        ? `export function ${name}({ ${roots.join(', ')} }: ${name}Props)`
        : `export function ${name}({ ${roots.join(', ')} })`

  const typeBlock =
    roots.length === 0
      ? ''
      : lang === 'tsx'
        ? emitPropsInterface(`${name}Props`, options.vars ?? null, roots)
        : emitPropsJsdoc(options.vars ?? null, roots)

  const defaults =
    roots.length && options.vars
      ? `${name}.PreviewProps = ${printValue(pickRoots(options.vars.sample, roots), 0)}`
      : ''

  return [
    importLine,
    '',
    typeBlock,
    signature + ' {',
    `${INDENT}return (`,
    markup,
    `${INDENT})`,
    '}',
    defaults ? '' : null,
    defaults || null,
    '',
  ]
    .filter((line) => line !== null && line !== undefined)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

/**
 * Convenience wrapper for the TypeScript flavour.
 *
 * @param {EmailDocument} doc
 * @param {object} [options]
 * @param {import('../types.js').VarsDef | null} [options.vars]
 * @param {string} [options.name]
 * @returns {string}
 */
export function renderToTsx(doc, options = {}) {
  return renderToJsx(doc, { ...options, lang: 'tsx' })
}

/**
 * The sample data for the roots a template uses — emitted as `PreviewProps` so
 * `react-email dev` shows the template with real content immediately.
 *
 * @param {Record<string, any>} sample
 * @param {string[]} roots
 * @returns {Record<string, any>}
 */
function pickRoots(sample, roots) {
  /** @type {Record<string, any>} */
  const out = {}
  for (const root of roots) {
    if (sample && Object.prototype.hasOwnProperty.call(sample, root)) out[root] = sample[root]
  }
  return out
}

export { el, raw } from './jsxNode.js'
