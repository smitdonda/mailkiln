/**
 * HTML renderer — nested presentation tables, inline styles, MSO conditionals
 * and a VML fallback for background images.
 *
 * Everything here exists because of a specific client, and the comments say
 * which one. That is the difference between "generated HTML" and "HTML that
 * lands in Outlook 2016 looking like the design".
 *
 * @module mailkiln/core/render/html
 */

import { getBlockDef } from '../registry.js'
import {
  TABLE_CLOSE,
  attrs,
  borderStyles,
  escapeAttr,
  escapeHtml,
  mergeStyles,
  mso,
  spacingToCss,
  styleAttr,
  tableOpen,
} from './inline.js'
import { createRenderContext, withScope } from './context.js'
import { HIDE_CLASS, blockClass, mobileBreakpoint, mobileFontSize, mobileRules } from './mobile.js'
import { evaluateCondition, repeatScopes } from '../conditions.js'

/** @typedef {import('../types.js').EmailDocument} EmailDocument */
/** @typedef {import('../types.js').RenderContext} RenderContext */
/** @typedef {import('../types.js').Block} Block */
/** @typedef {import('../types.js').Row} Row */
/** @typedef {import('../types.js').Column} Column */
/** @typedef {import('../types.js').Section} Section */

/** Class applied to columns that should stack on narrow screens. */
const STACK_CLASS = 'mk-stack'

/**
 * Does a display condition remove this node from the output?
 *
 * Never on the canvas. A node the editor refuses to draw is a node you cannot
 * select, and a condition you cannot select is a condition you cannot undo — the
 * same reason "hide on mobile" dims rather than hides there. The editor marks
 * conditional nodes instead; the Preview tab and every export honour them.
 *
 * @param {{ showIf?: any }} node
 * @param {RenderContext} ctx
 * @returns {boolean}
 */
function isHiddenByCondition(node, ctx) {
  if (!node?.showIf || ctx.options?.editable) return false
  return !evaluateCondition(node.showIf, ctx.scope)
}

/**
 * Render one block's own markup (no wrapper). Unknown block types render a
 * visible placeholder rather than disappearing — a silent hole in an email is
 * far worse than an obvious one.
 *
 * @param {Block} block
 * @param {RenderContext} ctx
 * @returns {string}
 */
export function renderBlockContent(block, ctx) {
  const def = getBlockDef(block.type)
  if (!def) {
    return `<div${styleAttr({
      padding: 12,
      border: '1px dashed #dc2626',
      color: '#dc2626',
      fontSize: 12,
      fontFamily: 'monospace',
    })}>Unknown block type "${escapeHtml(block.type)}"</div>`
  }
  return def.render.html(block.props ?? {}, ctx) ?? ''
}

/**
 * Render a block wrapped in its padding / alignment / background cell. Every
 * block gets the same wrapper, so `padding` and `align` behave identically for
 * built-ins and third-party blocks.
 *
 * @param {Block} block
 * @param {RenderContext} ctx
 * @returns {string}
 */
export function renderBlockHtml(block, ctx) {
  if (isHiddenByCondition(block, ctx)) return ''
  const props = block.props ?? {}
  const content = renderBlockContent(block, ctx)
  if (!content) return ''
  const classes = [
    props.hideOnMobile === true ? HIDE_CLASS : '',
    mobileFontSize(props) ? blockClass(block.id) : '',
  ]
    .filter(Boolean)
    .join(' ')
  const cellStyle = mergeStyles({
    padding: spacingToCss(props.padding),
    backgroundColor: props.backgroundColor,
    // Word's rendering engine adds its own cell spacing without this.
    msoTableLspace: '0pt',
    msoTableRspace: '0pt',
  })
  return [
    tableOpen({ width: '100%', className: classes || undefined }),
    '<tr>',
    `<td${attrs({ align: props.align })}${styleAttr(cellStyle)}>`,
    content,
    '</td>',
    '</tr>',
    TABLE_CLOSE,
  ].join('')
}

/**
 * @param {Column} column
 * @param {Row} row
 * @param {number} availableWidth Content width in px available to this row.
 * @param {number} index
 * @param {RenderContext} ctx
 * @returns {string}
 */
function renderColumn(column, row, availableWidth, index, ctx) {
  const props = column.props ?? {}
  const pct = Number(props.width) || 100
  const gap = Number(row.props?.gap) || 0
  const isFirst = index === 0
  const isLast = index === (row.columns?.length ?? 1) - 1
  const half = Math.round(gap / 2)

  // Outlook uses the width attribute (px); everyone else uses the percentage.
  const pxWidth = Math.max(1, Math.round((pct / 100) * availableWidth))

  const blocks = (column.blocks ?? []).map((b) => renderBlockHtml(b, ctx)).join('')
  const cellStyle = mergeStyles(
    {
      width: `${pct}%`,
      verticalAlign: props.verticalAlign || 'top',
      padding: spacingToCss(props.padding),
      paddingLeft: !isFirst && half ? half : '',
      paddingRight: !isLast && half ? half : '',
      backgroundColor: props.backgroundColor,
    },
    borderStyles(props),
  )

  return `<td${attrs({
    class: row.props?.stackOnMobile === false ? undefined : STACK_CLASS,
    width: String(pxWidth),
    valign: props.verticalAlign || 'top',
  })}${styleAttr(cellStyle)}>${blocks || '&nbsp;'}</td>`
}

/**
 * @param {Row} row
 * @param {number} availableWidth
 * @param {RenderContext} ctx
 * @returns {string}
 */
function renderRow(row, availableWidth, ctx) {
  if (isHiddenByCondition(row, ctx)) return ''
  // A repeated row is rendered once per item, each with its own scope, so
  // `{{item.title}}` reads a different item each time. On the canvas it stays a
  // single row — three copies would mean three nodes sharing one set of ids, and
  // drag-and-drop would have no way to tell them apart.
  if (row.repeat && !ctx.options?.editable) {
    return repeatScopes(row.repeat, ctx.scope)
      .map((scope) => renderRowOnce(row, availableWidth, withScope(ctx, scope)))
      .join('')
  }
  return renderRowOnce(row, availableWidth, ctx)
}

/**
 * @param {Row} row
 * @param {number} availableWidth
 * @param {RenderContext} ctx
 * @returns {string}
 */
function renderRowOnce(row, availableWidth, ctx) {
  const padding = row.props?.padding
  const inner = availableWidth - ((padding?.left ?? 0) + (padding?.right ?? 0))
  const cells = (row.columns ?? [])
    .map((column, i) => renderColumn(column, row, inner, i, ctx))
    .join('')
  const rowTable = `${tableOpen({ width: '100%' })}<tr>${cells}</tr>${TABLE_CLOSE}`
  const cellStyle = mergeStyles(
    {
      padding: spacingToCss(padding),
      backgroundColor: row.props?.backgroundColor,
    },
    borderStyles(row.props),
  )
  return `<tr><td${styleAttr(cellStyle)}>${rowTable}</td></tr>`
}

/**
 * @param {Section} section
 * @param {RenderContext} ctx
 * @returns {string}
 */
function renderSection(section, ctx) {
  if (isHiddenByCondition(section, ctx)) return ''
  const props = section.props ?? {}
  const width = Number(ctx.settings.width) || 600
  const padding = props.padding
  const available = width - ((padding?.left ?? 0) + (padding?.right ?? 0))

  const rows = (section.rows ?? []).map((row) => renderRow(row, available, ctx)).join('')

  const container = [
    // Outlook ignores max-width, so a ghost table pins the container to a real
    // pixel width there while everyone else uses max-width and stays fluid.
    mso(
      `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="${width}" align="center"><tr><td>`,
      'mso | IE',
    ),
    tableOpen({
      width: '100%',
      align: 'center',
      className: 'mk-container',
      style: {
        maxWidth: width,
        // A section's own background wins over the document's content colour.
        // Without this the container painted white *over* the section band, so a
        // tinted section showed its colour only in the page gutters — the canvas
        // rendered it correctly and the export did not, which is the worst kind
        // of disagreement for a WYSIWYG editor.
        backgroundColor:
          props.fullWidth === true
            ? ''
            : props.backgroundColor || ctx.settings.contentBackgroundColor,
      },
    }),
    rows,
    TABLE_CLOSE,
    mso('</td></tr></table>', 'mso | IE'),
  ].join('')

  const hasBgImage = !!props.backgroundImage
  const outerStyle = mergeStyles({
    backgroundColor: props.backgroundColor,
    backgroundImage: hasBgImage ? `url('${props.backgroundImage}')` : '',
    backgroundSize: hasBgImage ? 'cover' : '',
    backgroundPosition: hasBgImage ? 'center' : '',
    backgroundRepeat: hasBgImage ? 'no-repeat' : '',
  })

  const body = hasBgImage
    ? [
        // VML is the only way Word-engine Outlook shows a background image.
        mso(
          `<v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:${width}px;"><v:fill type="frame" src="${escapeAttr(props.backgroundImage)}" color="${escapeAttr(props.backgroundColor || '#ffffff')}" /><v:textbox inset="0,0,0,0">`,
          'gte mso 9',
        ),
        container,
        mso('</v:textbox></v:rect>', 'gte mso 9'),
      ].join('')
    : container

  return [
    tableOpen({ width: '100%', style: outerStyle, extra: { bgcolor: props.backgroundColor } }),
    '<tr>',
    `<td align="center"${styleAttr(
      mergeStyles({
        padding: spacingToCss(padding),
        borderTop: props.borderTop,
        borderBottom: props.borderBottom,
      }),
    )}>`,
    body,
    '</td>',
    '</tr>',
    TABLE_CLOSE,
  ].join('')
}

/**
 * The `<style>` block. Media queries are the only place we use a stylesheet:
 * Outlook ignores it (fine — desktop needs no stacking) and every client that
 * does support it honours the mobile layout.
 *
 * @param {RenderContext} ctx
 * @returns {string}
 */
function headStyles(ctx) {
  const width = Number(ctx.settings.width) || 600
  const rules = [
    'html,body{margin:0 !important;padding:0 !important;height:100% !important;width:100% !important}',
    '*{-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%}',
    'table,td{mso-table-lspace:0pt !important;mso-table-rspace:0pt !important;border-collapse:collapse !important}',
    'img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}',
    // Belt and braces with the inline colour every text block now writes: this
    // catches anchors inside a raw-HTML block, which we emit verbatim.
    ctx.settings.linkColor
      ? `a{color:${ctx.settings.linkColor};text-decoration:none}`
      : 'a{text-decoration:none}',
    '#outlook a{padding:0}',
    // iOS turns these into blue links otherwise.
    "a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;font-size:inherit !important;font-family:inherit !important;font-weight:inherit !important;line-height:inherit !important}",
    `@media only screen and (max-width:${mobileBreakpoint(width)}px){`,
    `.${STACK_CLASS}{display:block !important;width:100% !important;max-width:100% !important;padding-left:0 !important;padding-right:0 !important}`,
    '.mk-container{width:100% !important}',
    `.${HIDE_CLASS}{display:none !important}`,
    ...mobileRules(ctx.doc),
    '}',
  ]
  if (ctx.settings.darkModeAware) {
    rules.push(
      '@media (prefers-color-scheme:dark){',
      '.mk-dark-bg{background-color:#111827 !important}',
      '.mk-dark-text{color:#f3f4f6 !important}',
      '}',
    )
  }
  return `<style type="text/css">\n${rules.join('\n')}\n</style>`
}

/**
 * The hidden preheader. The padding characters stop the client from pulling body
 * copy into the inbox preview line after the intended text.
 *
 * @param {RenderContext} ctx
 * @returns {string}
 */
function preheader(ctx) {
  const text = ctx.resolve(ctx.settings.preheader ?? '')
  if (!text) return ''
  const pad = '&#847;&zwnj;&nbsp;'.repeat(30)
  return `<div${styleAttr({
    display: 'none',
    fontSize: '1px',
    lineHeight: '1px',
    maxHeight: 0,
    maxWidth: 0,
    opacity: 0,
    overflow: 'hidden',
    msoHide: 'all',
  })}>${escapeHtml(text)}${pad}</div>`
}

/**
 * Render just the sections — the body content without the document chrome.
 * Used by the canvas preview and by the size measurement in the linter.
 *
 * @param {EmailDocument} doc
 * @param {object} [options]
 * @param {import('../types.js').VarsDef | null} [options.vars]
 * @returns {string}
 */
export function renderSectionsHtml(doc, options = {}) {
  const ctx = createRenderContext(doc, { vars: options.vars, target: 'html' })
  return (doc.sections ?? []).map((section) => renderSection(section, ctx)).join('')
}

/**
 * Render a complete, sendable HTML email.
 *
 * @param {EmailDocument} doc
 * @param {object} [options]
 * @param {import('../types.js').VarsDef | null} [options.vars]
 * @returns {string}
 */
export function renderToHtml(doc, options = {}) {
  const ctx = createRenderContext(doc, { vars: options.vars, target: 'html' })
  const settings = ctx.settings
  const sections = (doc.sections ?? []).map((section) => renderSection(section, ctx)).join('')

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="${escapeAttr(settings.language || 'en')}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
<meta name="color-scheme" content="${settings.darkModeAware ? 'light dark' : 'light only'}" />
<meta name="supported-color-schemes" content="${settings.darkModeAware ? 'light dark' : 'light only'}" />
<title>${escapeHtml(ctx.resolve(settings.subject ?? ''))}</title>
${mso('<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>')}
${headStyles(ctx)}
</head>
<body${styleAttr({
    margin: 0,
    padding: 0,
    width: '100%',
    backgroundColor: settings.backgroundColor,
    fontFamily: settings.fontFamily,
    color: settings.textColor,
  })}>
${preheader(ctx)}
${tableOpen({ width: '100%', style: { backgroundColor: settings.backgroundColor }, extra: { bgcolor: settings.backgroundColor } })}
<tr>
<td align="center"${styleAttr({ padding: 0 })}>
${sections}
</td>
</tr>
${TABLE_CLOSE}
</body>
</html>`
}
