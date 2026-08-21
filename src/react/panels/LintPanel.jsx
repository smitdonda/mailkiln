/**
 * The lint panel — pillar 3.
 *
 * Issues are clickable: selecting one selects the offending node, which is the
 * difference between a warning you act on and a warning you dismiss.
 *
 * @module mailkiln/react/panels/LintPanel
 */

import { useI18n } from '../i18n/index.jsx'
import { useMailKilnContext } from '../context.jsx'
import { IconAlert, IconCheckCircle, IconInfo, IconWarning } from '../icons.jsx'

/** @type {Record<string, any>} */
const LEVEL_ICON = { error: IconAlert, warn: IconWarning, info: IconInfo }

/**
 * @returns {import('react').ReactElement}
 */
export function LintPanel() {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const { issues, errors, warnings, infos, sizeBytes } = store.lint

  return (
    <>
      <div className="mk-lint-summary">
        {errors ? (
          <span className="mk-badge" data-level="error">
            {t('lint.errors', { count: errors })}
          </span>
        ) : null}
        {warnings ? (
          <span className="mk-badge" data-level="warn">
            {t('lint.warnings', { count: warnings })}
          </span>
        ) : null}
        {infos ? <span className="mk-badge">{t('lint.infos', { count: infos })}</span> : null}
        <span className="mk-spacer-flex" />
        <span className="mk-help">
          {t('lint.size', { size: `${(sizeBytes / 1024).toFixed(1)}KB` })}
        </span>
      </div>

      <div className="mk-scroll">
        {issues.length === 0 ? (
          <p className="mk-empty mk-empty-ok">
            <IconCheckCircle />
            {t('lint.clean')}
          </p>
        ) : (
          <ul className="mk-lint-list">
            {issues.map((issue, index) => {
              const Icon = LEVEL_ICON[issue.level] ?? IconInfo
              return (
                <li key={`${issue.id}-${issue.nodeId ?? 'doc'}-${index}`}>
                  <button
                    type="button"
                    className="mk-lint-item"
                    data-level={issue.level}
                    disabled={!issue.nodeId}
                    title={issue.nodeId ? t('lint.goto') : undefined}
                    onClick={() => issue.nodeId && store.select(issue.nodeId)}
                  >
                    <span className="mk-lint-icon">
                      <Icon />
                    </span>
                    <span className="mk-lint-message">
                      {issue.message}
                      {issue.hint ? (
                        <>
                          <br />
                          <span className="mk-help">{issue.hint}</span>
                        </>
                      ) : null}
                      <br />
                      <span className="mk-lint-id">{issue.id}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
