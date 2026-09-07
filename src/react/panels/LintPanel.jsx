/**
 * The lint panel — pillar 3.
 *
 * Issues are clickable: selecting one shows the offending node, which is the
 * difference between a warning you act on and a warning you dismiss. Selecting
 * alone is not enough — the properties panel only exists in the design view, so
 * clicking an issue from here has to take you back there. `<MailKiln>` passes
 * `onShowBlock` to do exactly that; standalone consumers get plain selection.
 *
 * Three things this view is careful about, all of them learned from watching it
 * at 1440px:
 *
 * - The list is held to a measured column. Full-bleed, a twelve-word message ran
 *   nineteen hundred pixels and the eye had to travel all of it to find nothing.
 * - Each issue names the node it is about and says, in words, that it will take
 *   you there. It was always clickable; nothing said so.
 * - The rendered size is a meter against Gmail's 102KB cut rather than a
 *   sentence in a corner. It is the number that decides whether the footer
 *   arrives at all, so it should read like a fuel gauge.
 *
 * @module mailkiln/react/panels/LintPanel
 */

import { useState } from 'react'
import { findNode, getBlockDef, stripTags, GMAIL_LIMIT } from '../../core/index.js'
import { useI18n } from '../i18n/index.jsx'
import { useMailKilnContext } from '../context.jsx'
import { IconAlert, IconArrowRight, IconCheck, IconInfo, IconWarning } from '../icons.jsx'

/** @type {Record<string, any>} */
const LEVEL_ICON = { error: IconAlert, warn: IconWarning, info: IconInfo }

/** How much of a block's own words identify it in an issue row. */
const SUMMARY_MAX = 32

/**
 * @param {object} [props]
 * @param {(nodeId: string) => void} [props.onShowBlock] Called instead of plain
 *   selection when an issue is clicked.
 * @returns {import('react').ReactElement}
 */
export function LintPanel({ onShowBlock } = {}) {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const { issues, errors, warnings, infos, sizeBytes } = store.lint
  const [level, setLevel] = useState(/** @type {'all' | 'error' | 'warn' | 'info'} */ ('all'))

  // A filter that can strand you on an empty list is worse than no filter, so a
  // level that stops existing falls back to All rather than showing nothing.
  const counts = { all: issues.length, error: errors, warn: warnings, info: infos }
  const active = counts[level] > 0 ? level : 'all'
  const shown = active === 'all' ? issues : issues.filter((issue) => issue.level === active)

  const filters = /** @type {const} */ ([
    ['all', 'lint.all', null],
    ['error', errors === 1 ? 'lint.error' : 'lint.errors', 'error'],
    ['warn', warnings === 1 ? 'lint.warning' : 'lint.warnings', 'warn'],
    ['info', infos === 1 ? 'lint.info' : 'lint.infos', 'info'],
  ])

  const kb = sizeBytes / 1024
  const ratio = Math.min(1, sizeBytes / GMAIL_LIMIT)
  const sizeLevel = ratio >= 1 ? 'error' : ratio >= 0.8 ? 'warn' : undefined

  return (
    <div className="mk-scroll">
      <div className="mk-lint">
        <div className="mk-lint-summary">
          <div className="mk-segmented" role="group" aria-label={t('view.checks')}>
            {filters.map(([id, key, dot]) =>
              counts[id] > 0 || id === 'all' ? (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active === id}
                  onClick={() => setLevel(id)}
                >
                  {dot ? <span className="mk-lint-dot" data-level={dot} /> : null}
                  {id === 'all'
                    ? `${t('lint.all')} ${issues.length}`
                    : t(key, { count: counts[id] })}
                </button>
              ) : null,
            )}
          </div>

          <span className="mk-spacer-flex" />

          {/* The one number that decides whether the unsubscribe footer reaches
              the reader. A gauge says "how close am I" in a way that a sentence
              in the corner never did. */}
          <div className="mk-lint-size" data-level={sizeLevel}>
            <div className="mk-lint-size-row">
              <span className="mk-help">{t('lint.sizeLabel')}</span>
              <span className="mk-lint-size-value">
                {t('lint.sizeOf', { size: kb.toFixed(1), limit: (GMAIL_LIMIT / 1024).toFixed(0) })}
              </span>
            </div>
            <div className="mk-lint-meter">
              <span style={{ width: `${Math.max(2, ratio * 100)}%` }} />
            </div>
            <span className="mk-help">{t('lint.limit')}</span>
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="mk-lint-clean">
            <span className="mk-lint-clean-mark">
              <IconCheck />
            </span>
            <p className="mk-lint-clean-title">{t('lint.clean')}</p>
            <p className="mk-help">{t('lint.limit')}</p>
          </div>
        ) : (
          <ul className="mk-lint-list">
            {shown.map((issue, index) => {
              const Icon = LEVEL_ICON[issue.level] ?? IconInfo
              const where = nodeLabel(store.doc, issue.nodeId, t)
              return (
                <li key={`${issue.id}-${issue.nodeId ?? 'doc'}-${index}`}>
                  <button
                    type="button"
                    className="mk-lint-item"
                    data-level={issue.level}
                    disabled={!issue.nodeId}
                    title={issue.nodeId ? t('lint.goto') : undefined}
                    onClick={() => {
                      if (!issue.nodeId) return
                      if (onShowBlock) onShowBlock(issue.nodeId)
                      else store.select(issue.nodeId)
                    }}
                  >
                    <span className="mk-lint-icon">
                      <Icon />
                    </span>
                    <span className="mk-lint-body">
                      <span className="mk-lint-message">{issue.message}</span>
                      {issue.hint ? <span className="mk-help">{issue.hint}</span> : null}
                      <span className="mk-lint-meta">
                        <span className="mk-lint-id">{issue.id}</span>
                        <span className="mk-lint-where">{where}</span>
                      </span>
                    </span>
                    {/* Rendered on every row and hidden where there is no node
                        to show. Reserving the slot this way costs nothing and
                        keeps its width right in every locale, where a fixed
                        placeholder would be wrong the moment "Show block" is
                        translated. `visibility: hidden` also keeps it out of
                        the accessibility tree and out of reach of the pointer. */}
                    <span className="mk-lint-goto" data-empty={!issue.nodeId || undefined}>
                      {t('lint.show')}
                      <IconArrowRight />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * What the issue is *about*, in the same words the structure pane uses. Without
 * it every row reads as a complaint about the document as a whole.
 *
 * @param {import('../../core/types.js').EmailDocument} doc
 * @param {string} [nodeId]
 * @param {import('../i18n/index.jsx').Translate} [t]
 * @returns {string}
 */
function nodeLabel(doc, nodeId, t) {
  const translate = /** @type {import('../i18n/index.jsx').Translate} */ (t)
  if (!nodeId) return translate('lint.document')
  const found = findNode(doc, nodeId)
  if (!found) return translate('lint.document')
  if (found.kind !== 'block') return translate(`inspector.${found.kind}`)

  const def = getBlockDef(found.node.type)
  const name = def?.label ?? found.node.type
  const props = /** @type {Record<string, any>} */ (found.node.props ?? {})
  for (const key of ['text', 'label', 'title', 'alt', 'src', 'href']) {
    const value = props[key]
    if (typeof value !== 'string') continue
    const clean = stripTags(value).replace(/\s+/g, ' ').trim()
    if (!clean) continue
    const cut = clean.length > SUMMARY_MAX ? `${clean.slice(0, SUMMARY_MAX - 1)}…` : clean
    return `${name} · ${cut}`
  }
  return name
}
