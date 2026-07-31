/**
 * The lint panel — pillar 3.
 *
 * Issues are clickable: selecting one selects the offending node, which is the
 * difference between a warning you act on and a warning you dismiss.
 *
 * @module mailforge/react/panels/LintPanel
 */

import { useI18n } from '../i18n/index.jsx'
import { useMailForgeContext } from '../context.jsx'
import { IconAlert, IconCheckCircle, IconInfo, IconWarning } from '../icons.jsx'

/** @type {Record<string, any>} */
const LEVEL_ICON = { error: IconAlert, warn: IconWarning, info: IconInfo }

/**
 * @returns {import('react').ReactElement}
 */
export function LintPanel() {
  const t = useI18n()
  const { store } = useMailForgeContext()
  const { issues, errors, warnings, infos, sizeBytes } = store.lint

  return (
    <>
      <div className="mf-lint-summary">
        {errors ? (
          <span className="mf-badge" data-level="error">
            {t('lint.errors', { count: errors })}
          </span>
        ) : null}
        {warnings ? (
          <span className="mf-badge" data-level="warn">
            {t('lint.warnings', { count: warnings })}
          </span>
        ) : null}
        {infos ? <span className="mf-badge">{t('lint.infos', { count: infos })}</span> : null}
        <span className="mf-spacer-flex" />
        <span className="mf-help">
          {t('lint.size', { size: `${(sizeBytes / 1024).toFixed(1)}KB` })}
        </span>
      </div>

      <div className="mf-scroll">
        {issues.length === 0 ? (
          <p className="mf-empty mf-empty-ok">
            <IconCheckCircle />
            {t('lint.clean')}
          </p>
        ) : (
          <ul className="mf-lint-list">
            {issues.map((issue, index) => {
              const Icon = LEVEL_ICON[issue.level] ?? IconInfo
              return (
                <li key={`${issue.id}-${issue.nodeId ?? 'doc'}-${index}`}>
                  <button
                    type="button"
                    className="mf-lint-item"
                    data-level={issue.level}
                    disabled={!issue.nodeId}
                    title={issue.nodeId ? t('lint.goto') : undefined}
                    onClick={() => issue.nodeId && store.select(issue.nodeId)}
                  >
                    <span className="mf-lint-icon">
                      <Icon />
                    </span>
                    <span className="mf-lint-message">
                      {issue.message}
                      {issue.hint ? (
                        <>
                          <br />
                          <span className="mf-help">{issue.hint}</span>
                        </>
                      ) : null}
                      <br />
                      <span className="mf-lint-id">{issue.id}</span>
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
