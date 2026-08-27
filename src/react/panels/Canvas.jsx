/**
 * The canvas.
 *
 * Each block is rendered with the *real* HTML renderer, so what you drag around is
 * the actual email markup rather than a React approximation that drifts from the
 * output. The surrounding chrome — hover outlines, drop zones, the mobile frame —
 * is editor-only and never reaches the export.
 *
 * @module mailkiln/react/panels/Canvas
 */

import { Fragment, useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
  conditionSummary,
  createRenderContext,
  evaluateCondition,
  normalizeCondition,
  normalizeRepeat,
  renderBlockHtml,
  repeatScopes,
  spacingToCss,
  withScope,
} from '../../core/index.js'
import { useMailKilnContext } from '../context.jsx'
import { useI18n } from '../i18n/index.jsx'
import { SortableBlock } from '../dnd/SortableBlock.jsx'
import { DropIndicator } from '../dnd/DropIndicator.jsx'
import { NodeToolbar } from './NodeToolbar.jsx'
import { BlankState, isPristine } from './BlankState.jsx'
import { IconPlus } from '../icons.jsx'

/**
 * @param {object} props
 * @param {'desktop' | 'mobile' | 'text'} [props.device]
 * @param {() => void} [props.onQuickInsert]
 * @returns {import('react').ReactElement}
 */
export function Canvas({ device = 'desktop', onQuickInsert }) {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const { doc } = store
  const blank = isPristine(doc)
  // The mobile frame narrows the paper, so chrome sized to the document width
  // would hang off it. On desktop the paper fills the working area rather than
  // sitting at `settings.width` — the narrow card left most of the screen as dead
  // gutter. The trade-off: desktop blocks lay out wider than the email really is,
  // so the Preview tab (a real iframe at `settings.width`) stays the honest check
  // on line lengths before sending.
  const width = device === 'mobile' ? 375 : null

  // One render context per document version, shared by every block. `editable`
  // is what makes blocks mark their inline-editable element; no export path sets
  // it, so the marker never reaches a real email.
  const ctx = useMemo(
    () => createRenderContext(doc, { vars: store.vars, target: 'html', options: { editable: true } }),
    [doc, store.vars],
  )

  return (
    <div className="mk-scroll" onClick={() => store.select(null)} role="presentation">
      <div className="mk-canvas-wrap">
        <div
          className="mk-canvas"
          data-device={device}
          style={{
            maxWidth: width ?? undefined,
            backgroundColor: doc.settings.contentBackgroundColor,
          }}
        >
          {blank ? (
            <BlankState onQuickInsert={onQuickInsert} />
          ) : (
            doc.sections.map((section, index) => (
              <SectionView
                key={section.id}
                section={section}
                ctx={ctx}
                index={index}
                count={doc.sections.length}
              />
            ))
          )}
        </div>

        {/* Outside `.mk-canvas` on purpose: the canvas carries the *email's*
            background, so a chrome button placed on it ends up with editor text
            colour on email paper — invisible in dark mode. */}
        {blank ? null : (
          <button
            type="button"
            className="mk-btn mk-btn-outline mk-add-section"
            style={{ maxWidth: width ?? undefined }}
            onClick={(event) => {
              event.stopPropagation()
              store.addSection()
            }}
          >
            <IconPlus />
            {t('canvas.addSection')}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Row and column borders, as inline style. The canvas has to draw them or the
 * design disagrees with the export, which is the one thing a WYSIWYG editor
 * cannot do.
 *
 * @param {Record<string, any>} props
 * @returns {import('react').CSSProperties}
 */
function borderStyle(props) {
  return {
    borderTop: props?.borderTop || undefined,
    borderRight: props?.borderRight || undefined,
    borderBottom: props?.borderBottom || undefined,
    borderLeft: props?.borderLeft || undefined,
  }
}

/**
 * A node's display condition, resolved against the sample data — or `null`.
 *
 * The canvas draws conditional nodes whichever way the branch falls. Hiding one
 * for real would make it unselectable, and a condition you cannot select is a
 * condition you cannot remove; the Preview tab and every export do hide it.
 *
 * @param {{ showIf?: any }} node
 * @param {import('../../core/types.js').RenderContext} ctx
 * @returns {{ label: string, hidden: boolean } | null}
 */
export function conditionState(node, ctx) {
  if (!normalizeCondition(node?.showIf)) return null
  return {
    label: conditionSummary(node.showIf),
    hidden: !evaluateCondition(node.showIf, ctx.scope),
  }
}

/**
 * @param {object} props
 * @param {string} props.label
 * @param {boolean} [props.hidden]
 * @returns {import('react').ReactElement}
 */
export function ConditionBadge({ label, hidden }) {
  return (
    <span className="mk-cond-badge" data-off={hidden || undefined} title={label}>
      {label}
    </span>
  )
}

/**
 * @param {object} props
 * @param {import('../../core/types.js').Section} props.section
 * @param {import('../../core/types.js').RenderContext} props.ctx
 * @param {number} props.index
 * @param {number} props.count
 * @returns {import('react').ReactElement}
 */
function SectionView({ section, ctx, index, count }) {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const selected = store.selectedId === section.id
  const props = section.props ?? {}
  const condition = conditionState(section, ctx)

  return (
    <div
      className="mk-section"
      data-selected={selected || undefined}
      data-conditional={condition ? '' : undefined}
      data-cond-off={condition?.hidden || undefined}
      data-section-id={section.id}
      style={{
        padding: spacingToCss(props.padding) || undefined,
        backgroundColor: props.backgroundColor || undefined,
        backgroundImage: props.backgroundImage ? `url(${props.backgroundImage})` : undefined,
        backgroundSize: props.backgroundImage ? 'cover' : undefined,
        borderTop: props.borderTop || undefined,
        borderBottom: props.borderBottom || undefined,
      }}
      onClick={(event) => {
        event.stopPropagation()
        store.select(section.id)
      }}
    >
      {condition ? <ConditionBadge label={condition.label} hidden={condition.hidden} /> : null}
      {section.rows.map((row, rowIndex) => (
        <RowView
          key={row.id}
          row={row}
          ctx={ctx}
          sectionId={section.id}
          index={rowIndex}
          count={section.rows.length}
        />
      ))}
      {selected ? (
        <NodeToolbar
          label={t('inspector.section')}
          canMoveUp={index > 0}
          canMoveDown={index < count - 1}
          // `index + 2` to move down one, not `index + 1`: the move removes the
          // node before re-inserting it, so the target index is interpreted in
          // the list that no longer contains it.
          onMoveUp={() => store.moveSection(section.id, index - 1)}
          onMoveDown={() => store.moveSection(section.id, index + 2)}
          onDuplicate={() => store.duplicate(section.id)}
          onDelete={() => store.remove(section.id)}
        />
      ) : null}
    </div>
  )
}

/**
 * @param {object} props
 * @param {import('../../core/types.js').Row} props.row
 * @param {import('../../core/types.js').RenderContext} props.ctx
 * @param {string} props.sectionId
 * @param {number} props.index
 * @param {number} props.count
 * @returns {import('react').ReactElement}
 */
function RowView({ row, ctx, sectionId, index, count }) {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const selected = store.selectedId === row.id
  const props = row.props ?? {}
  const condition = conditionState(row, ctx)
  const repeat = normalizeRepeat(row.repeat)

  // A repeated row stays a *single* row on the canvas, scoped to the first item
  // so you edit against real content. Drawing three copies would mean three DOM
  // nodes sharing one set of ids, and drag-and-drop could not tell them apart —
  // the Preview tab is where you see all of them.
  const rowCtx = repeat ? withScope(ctx, repeatScopes(repeat, ctx.scope)[0]) : ctx

  return (
    <div
      className="mk-row"
      data-selected={selected || undefined}
      data-conditional={condition || repeat ? '' : undefined}
      data-cond-off={condition?.hidden || undefined}
      data-row-id={row.id}
      style={{
        padding: spacingToCss(props.padding) || undefined,
        backgroundColor: props.backgroundColor || undefined,
        gap: props.gap ? `${props.gap}px` : undefined,
        ...borderStyle(props),
      }}
      onClick={(event) => {
        event.stopPropagation()
        store.select(row.id)
      }}
    >
      {condition || repeat ? (
        <ConditionBadge
          label={[
            condition ? condition.label : '',
            repeat ? t('visibility.badgeRepeat', { path: repeat.path }) : '',
          ]
            .filter(Boolean)
            .join(' · ')}
          hidden={condition?.hidden}
        />
      ) : null}
      {row.columns.map((column) => (
        <ColumnView key={column.id} column={column} ctx={rowCtx} />
      ))}
      {selected ? (
        <NodeToolbar
          label={t('inspector.row')}
          canMoveUp={index > 0}
          canMoveDown={index < count - 1}
          onMoveUp={() => store.moveRow({ rowId: row.id, toSectionId: sectionId, toIndex: index - 1 })}
          onMoveDown={() =>
            store.moveRow({ rowId: row.id, toSectionId: sectionId, toIndex: index + 2 })
          }
          onDuplicate={() => store.duplicate(row.id)}
          onDelete={() => store.remove(row.id)}
        />
      ) : null}
    </div>
  )
}

/**
 * @param {object} props
 * @param {import('../../core/types.js').Column} props.column
 * @param {import('../../core/types.js').RenderContext} props.ctx
 * @returns {import('react').ReactElement}
 */
function ColumnView({ column, ctx }) {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const props = column.props ?? {}

  const { setNodeRef, isOver } = useDroppable({
    id: `column:${column.id}`,
    data: { kind: 'column', columnId: column.id },
  })

  const blocks = useMemo(() => column.blocks ?? [], [column.blocks])
  const items = useMemo(() => blocks.map((block) => block.id), [blocks])

  return (
    <div
      ref={setNodeRef}
      className="mk-col"
      data-over={isOver || undefined}
      data-selected={store.selectedId === column.id || undefined}
      data-column-id={column.id}
      // A column has its own width, padding, background and vertical alignment,
      // and none of them were reachable without this: clicking a column used to
      // bubble to the row, so the column property panel could never be opened.
      // It also decides where the palette appends, which made the second block
      // in a multi-column row drag-only.
      onClick={(event) => {
        event.stopPropagation()
        store.select(column.id)
      }}
      style={{
        flexBasis: `${props.width ?? 100}%`,
        maxWidth: `${props.width ?? 100}%`,
        padding: spacingToCss(props.padding) || undefined,
        backgroundColor: props.backgroundColor || undefined,
        verticalAlign: props.verticalAlign,
        ...borderStyle(props),
      }}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <DropIndicator columnId={column.id} index={0} />
        {blocks.map((block, index) => (
          <Fragment key={block.id}>
            <SortableBlock
              block={block}
              columnId={column.id}
              index={index}
              condition={conditionState(block, ctx)}
              html={renderBlockHtml(block, ctx)}
              selected={store.selectedId === block.id}
              onSelect={store.select}
              onDelete={store.remove}
              onDuplicate={store.duplicate}
              onPatch={store.patch}
            />
            <DropIndicator columnId={column.id} index={index + 1} />
          </Fragment>
        ))}
      </SortableContext>

      {blocks.length === 0 ? (
        <div className="mk-col-empty">
          <IconPlus />
          {t('canvas.empty')}
        </div>
      ) : null}
    </div>
  )
}
