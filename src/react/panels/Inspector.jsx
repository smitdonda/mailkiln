/**
 * Property editors.
 *
 * Every block's panel is generated from its `schema` — there is no per-block
 * Inspector component in this package, which is the only honest way to claim that
 * custom blocks are first-class. Structural nodes (section / row / column) and the
 * document itself use hand-written schemas of the same shape.
 *
 * Fields are grouped into collapsible sections so the common controls stay above
 * the fold; a text block otherwise opens with fourteen inputs.
 *
 * @module mailkiln/react/panels/Inspector
 */

import { useMemo, useState } from 'react'
import { FONT_OPTIONS, getBlockDef } from '../../core/index.js'
import { useMailKilnContext } from '../context.jsx'
import { useI18n } from '../i18n/index.jsx'
import { Field, getIn } from '../fields/index.jsx'
import { LayoutPicker } from './LayoutPicker.jsx'
import { RepeatFields, VisibilityFields } from './VisibilityFields.jsx'
import { matchPreset } from '../rowPresets.js'
import { IconChevronRight, IconPlus } from '../icons.jsx'

/**
 * Standalone inspector, for consumers assembling their own layout. `<MailKiln>`
 * itself renders these fields inside {@link import('./SidePanel.jsx').SidePanel}.
 *
 * @returns {import('react').ReactElement}
 */
export function Inspector() {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const { selection } = store

  return (
    <aside className="mk-panel" aria-label={t('inspector.title')}>
      <div className="mk-panel-head">
        <span className="mk-panel-title">
          {selection ? titleFor(selection, t) : t('inspector.document')}
        </span>
      </div>
      <div className="mk-panel-body">
        {selection ? <NodeFields location={selection} /> : <DocumentFields />}
      </div>
    </aside>
  )
}

/**
 * @param {import('../../core/types.js').NodeLocation} selection
 * @param {(key: string) => string} t
 * @returns {string}
 */
function titleFor(selection, t) {
  if (selection.kind === 'block') {
    const def = getBlockDef(selection.node.type)
    return def?.label ?? selection.node.type
  }
  return t(`inspector.${selection.kind}`)
}

/**
 * Fields for whichever node is selected.
 *
 * @param {object} props
 * @param {import('../../core/types.js').NodeLocation} props.location
 * @returns {import('react').ReactElement | null}
 */
export function NodeFields({ location }) {
  switch (location.kind) {
    case 'block':
      return <BlockFields location={location} />
    case 'column':
      return <ColumnFields location={location} />
    case 'row':
      return <RowFields location={location} />
    case 'section':
      return <SectionFields location={location} />
    default:
      return null
  }
}

/**
 * Group fields by their optional `group`, preserving declaration order within
 * each group. Ungrouped fields come first, always open.
 *
 * @param {import('../../core/types.js').FieldDef[]} schema
 * @returns {Array<[string, import('../../core/types.js').FieldDef[]]>}
 */
function groupFields(schema) {
  /** @type {Map<string, import('../../core/types.js').FieldDef[]>} */
  const map = new Map()
  for (const field of schema) {
    const key = field.group ?? ''
    const list = map.get(key)
    if (list) list.push(field)
    else map.set(key, [field])
  }
  return [...map.entries()]
}

/**
 * @param {object} props
 * @param {Array<[string, import('../../core/types.js').FieldDef[]]>} props.groups
 * @param {Record<string, any>} props.values
 * @param {(patch: Record<string, any>, tagKey?: string) => void} props.onChange
 * @returns {import('react').ReactElement}
 */
function FieldGroups({ groups, values, onChange }) {
  return (
    <>
      {groups.map(([group, fields]) => {
        const body = fields
          .filter((field) => !field.when || field.when(values))
          .map((field) => (
            <Field
              key={field.key}
              field={field}
              value={getIn(values, field.key)}
              onChange={(next, tagKey) => onChange({ [field.key]: next }, tagKey)}
            />
          ))
        if (!body.length) return null
        return group ? (
          <CollapsibleGroup key={group} label={group}>
            {body}
          </CollapsibleGroup>
        ) : (
          <div className="mk-fields" key="main">
            {body}
          </div>
        )
      })}
    </>
  )
}

/**
 * @param {object} props
 * @param {string} props.label
 * @param {boolean} [props.defaultOpen]
 * @param {import('react').ReactNode} props.children
 * @returns {import('react').ReactElement}
 */
function CollapsibleGroup({ label, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mk-group">
      <button
        type="button"
        className="mk-group-head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <IconChevronRight />
        {label}
      </button>
      {open ? <div className="mk-group-body">{children}</div> : null}
    </div>
  )
}

/**
 * @param {object} props
 * @param {import('../../core/types.js').BlockLocation} props.location
 * @returns {import('react').ReactElement}
 */
function BlockFields({ location }) {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const block = location.node
  const def = getBlockDef(block.type)

  const groups = useMemo(() => groupFields(def?.schema ?? []), [def])

  if (!def) {
    return (
      <p className="mk-empty">
        Block type “{block.type}” is not registered, so it has no editor. Its content is preserved.
      </p>
    )
  }
  return (
    <>
      {def.schema?.length ? (
        <FieldGroups
          groups={groups}
          values={block.props ?? {}}
          onChange={(patch, tagKey) => store.patch(block.id, patch, tagKey)}
        />
      ) : (
        // A block with no fields of its own still gets a visibility group —
        // `showIf` is not a block property, so it does not depend on the schema.
        <p className="mk-empty">{t('inspector.none')}</p>
      )}
      <CollapsibleGroup label={t('visibility.group')} defaultOpen={Boolean(block.showIf)}>
        <VisibilityFields node={block} />
      </CollapsibleGroup>
    </>
  )
}

/**
 * @param {object} props
 * @param {import('../../core/types.js').ColumnLocation} props.location
 * @returns {import('react').ReactElement}
 */
function ColumnFields({ location }) {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const column = location.node

  /** @type {import('../../core/types.js').FieldDef[]} */
  const schema = [
    { key: 'width', type: 'number', label: 'Width %', min: 5, max: 100 },
    {
      key: 'verticalAlign',
      type: 'select',
      label: t('inspector.verticalAlign'),
      options: [
        { value: 'top', label: 'Top' },
        { value: 'middle', label: 'Middle' },
        { value: 'bottom', label: 'Bottom' },
      ],
    },
    { key: 'padding', type: 'spacing', label: 'Padding' },
    { key: 'backgroundColor', type: 'color', label: 'Background' },
  ]

  return (
    <FieldGroups
      groups={groupFields(schema)}
      values={column.props ?? {}}
      onChange={(patch, tagKey) => store.patch(column.id, patch, tagKey)}
    />
  )
}

/**
 * @param {object} props
 * @param {import('../../core/types.js').RowLocation} props.location
 * @returns {import('react').ReactElement}
 */
function RowFields({ location }) {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const row = location.node
  const widths = row.columns.map((column) => Number(column.props?.width) || 0)

  /** @type {import('../../core/types.js').FieldDef[]} */
  const schema = [
    { key: 'stackOnMobile', type: 'toggle', label: t('inspector.stack') },
    { key: 'gap', type: 'range', label: t('inspector.gap'), min: 0, max: 40, step: 2 },
    { key: 'padding', type: 'spacing', label: 'Padding' },
    { key: 'backgroundColor', type: 'color', label: 'Background' },
  ]

  return (
    <>
      <div className="mk-fields" style={{ paddingBottom: 4 }}>
        <span className="mk-label">{t('inspector.layout')}</span>
      </div>
      {/* Thumbnails, not a `1 2 3 4` segmented control: the numbers said nothing
          about the result and could not express an uneven split, which is why
          "Even widths" had to exist as a separate button. Picking a preset sets
          count and widths in one undo step, so that button is gone. */}
      <LayoutPicker
        compact
        active={matchPreset(widths)}
        onPick={(next) => store.setRowLayout(row.id, next)}
      />
      <FieldGroups
        groups={groupFields(schema)}
        values={row.props ?? {}}
        onChange={(patch, tagKey) => store.patch(row.id, patch, tagKey)}
      />
      <CollapsibleGroup
        label={t('visibility.group')}
        defaultOpen={Boolean(row.showIf || row.repeat)}
      >
        <VisibilityFields node={row} />
        <RepeatFields row={row} />
      </CollapsibleGroup>
    </>
  )
}

/**
 * @param {object} props
 * @param {import('../../core/types.js').SectionLocation} props.location
 * @returns {import('react').ReactElement}
 */
function SectionFields({ location }) {
  const t = useI18n()
  const { store } = useMailKilnContext()
  const section = location.node

  /** @type {import('../../core/types.js').FieldDef[]} */
  const schema = [
    { key: 'backgroundColor', type: 'color', label: 'Background' },
    { key: 'padding', type: 'spacing', label: 'Padding' },
    { key: 'backgroundImage', type: 'image', label: t('inspector.backgroundImage'), group: 'Background' },
    { key: 'fullWidth', type: 'toggle', label: t('inspector.fullWidth'), group: 'Background' },
    {
      key: 'borderTop',
      type: 'text',
      label: 'Border top',
      placeholder: '1px solid #eee',
      vars: false,
      group: 'Borders',
    },
    {
      key: 'borderBottom',
      type: 'text',
      label: 'Border bottom',
      placeholder: '1px solid #eee',
      vars: false,
      group: 'Borders',
    },
  ]

  return (
    <>
      <FieldGroups
        groups={groupFields(schema)}
        values={section.props ?? {}}
        onChange={(patch, tagKey) => store.patch(section.id, patch, tagKey)}
      />
      <CollapsibleGroup label={t('visibility.group')} defaultOpen={Boolean(section.showIf)}>
        <VisibilityFields node={section} />
      </CollapsibleGroup>
      <div className="mk-fields">
        <button
          type="button"
          className="mk-btn mk-btn-outline"
          onClick={() => store.addRow(section.id, 1)}
        >
          <IconPlus />
          {t('canvas.addRow')}
        </button>
      </div>
    </>
  )
}

/**
 * Document-level settings — the Settings tab.
 *
 * @returns {import('react').ReactElement}
 */
export function DocumentFields() {
  const t = useI18n()
  const { store } = useMailKilnContext()

  /** @type {import('../../core/types.js').FieldDef[]} */
  const schema = [
    {
      key: 'name',
      type: 'text',
      label: t('inspector.name'),
      vars: false,
      help: 'Names the exported component and its files. Never sent.',
    },
    { key: 'subject', type: 'text', label: t('inspector.subject'), vars: true },
    {
      key: 'preheader',
      type: 'textarea',
      label: t('inspector.preheader'),
      vars: true,
      help: 'The preview line after the subject in the inbox.',
    },
    { key: 'width', type: 'number', label: t('inspector.width'), min: 320, max: 900, group: 'Layout' },
    { key: 'backgroundColor', type: 'color', label: t('inspector.background'), group: 'Layout' },
    {
      key: 'contentBackgroundColor',
      type: 'color',
      label: t('inspector.contentBackground'),
      group: 'Layout',
    },
    { key: 'fontFamily', type: 'select', label: t('inspector.font'), options: FONT_OPTIONS, group: 'Type' },
    { key: 'textColor', type: 'color', label: t('inspector.textColor'), group: 'Type' },
    { key: 'linkColor', type: 'color', label: t('inspector.linkColor'), group: 'Type' },
    { key: 'darkModeAware', type: 'toggle', label: t('inspector.darkMode'), group: 'Type' },
  ]

  return (
    <>
      <div className="mk-section-label">{t('inspector.document')}</div>
      <FieldGroups
        groups={groupFields(schema)}
        values={store.doc.settings}
        onChange={(patch, tagKey) => store.patchSettings(patch, tagKey)}
      />
    </>
  )
}
