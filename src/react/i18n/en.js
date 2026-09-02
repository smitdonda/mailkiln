/**
 * English strings. Every user-visible string in the editor lives in a locale
 * file — none are inlined in components — so a new language is one file.
 *
 * @module mailkiln/react/i18n/en
 */

/** @type {Record<string, string>} */
export const en = {
  // toolbar
  'toolbar.undo': 'Undo',
  'toolbar.redo': 'Redo',
  'toolbar.export': 'Export',
  'toolbar.desktop': 'Desktop',
  'toolbar.mobile': 'Mobile',
  'toolbar.panel': 'Panel',
  'toolbar.theme': 'Toggle dark mode',
  'toolbar.name': 'Template name',
  'toolbar.untitled': 'Untitled email',

  // views
  'view.design': 'Design',
  'view.preview': 'Preview',
  'view.checks': 'Checks',

  // side panel
  'panel.content': 'Content',
  'panel.rows': 'Rows',
  'panel.settings': 'Settings',
  'panel.close': 'Close panel',
  'panel.back': 'Back to content',
  'panel.ancestors': 'Selected node ancestors',
  'panel.contentHint': 'Drag a block onto the canvas, or press Enter to append it.',
  'panel.rowsHint': 'Click a layout to add it as a new row.',

  // row layouts
  'rows.1': '1 column',
  'rows.2': '2 columns',
  'rows.3': '3 columns',
  'rows.4': '4 columns',
  'rows.2-1': '2 : 1',
  'rows.1-2': '1 : 2',
  'rows.3-1': '3 : 1',
  'rows.1-3': '1 : 3',

  // palette
  'palette.title': 'Blocks',
  'palette.search': 'Search blocks',
  'palette.empty': 'No blocks match “{query}”.',
  'palette.hint': 'Drag onto the canvas, or press Enter to append.',
  'palette.limit': '{label}: limit of {limit} reached for this template.',

  // empty canvas
  'blank.title': 'Start building your email',
  'blank.body': 'Drag blocks from the panel, or pick a starting point below.',
  'blank.press': 'Press',
  'blank.toQuickInsert': 'to quick-insert.',
  'blank.addSection': 'Add columns',
  'blank.addText': 'Add text',
  'blank.addButton': 'Add button',

  // quick insert
  'quick.title': 'Quick insert',
  'quick.placeholder': 'Search blocks…',
  'quick.empty': 'No blocks match “{query}”.',

  // canvas
  'canvas.empty': 'Drop a block here',
  'canvas.addRow': 'Add row',
  'canvas.emptyColumn': 'Empty column',
  'canvas.addSection': 'Add section',
  'canvas.duplicate': 'Duplicate',
  'canvas.delete': 'Delete',
  'canvas.drag': 'Drag',
  'canvas.moveUp': 'Move up',
  'canvas.moveDown': 'Move down',

  // inline rich text
  'richtext.toolbar': 'Text formatting',
  'richtext.bold': 'Bold',
  'richtext.italic': 'Italic',
  'richtext.underline': 'Underline',
  'richtext.link': 'Link',
  'richtext.unlink': 'Remove link',
  'richtext.bulletList': 'Bulleted list',
  'richtext.numberList': 'Numbered list',
  'richtext.clear': 'Clear formatting',
  'richtext.linkUrl': 'Link URL',
  'richtext.linkText': 'Text',
  'richtext.apply': 'Apply',

  // special links
  'link.special': 'Special links',
  'link.unsubscribe': 'Unsubscribe',
  'link.preferences': 'Manage preferences',
  'link.viewInBrowser': 'View in browser',

  // display conditions & repeats
  'visibility.group': 'Visibility',
  'visibility.conditional': 'Show conditionally',
  'visibility.showWhen': 'Show when',
  'visibility.operator': 'Condition',
  'visibility.value': 'Value',
  'visibility.previewShown': 'With your sample data: shown.',
  'visibility.previewHidden': 'With your sample data: hidden.',
  'visibility.previewIncomplete': 'Incomplete — the block shows everywhere until you finish this.',
  'visibility.op.truthy': 'is set',
  'visibility.op.falsy': 'is not set',
  'visibility.op.notEmpty': 'is not empty',
  'visibility.op.empty': 'is empty',
  'visibility.op.eq': 'equals',
  'visibility.op.ne': 'does not equal',
  'visibility.op.gt': 'is greater than',
  'visibility.op.lt': 'is less than',
  'visibility.repeat': 'Repeat for each item',
  'visibility.repeatOver': 'Repeat over',
  'visibility.repeatAs': 'Item name',
  'visibility.repeatHint': 'Write {{{as}.field}} inside this row.',
  'visibility.repeatCount': 'Your sample data has {count} item(s).',
  'visibility.repeatNoArray': 'That path is not an array in your sample data.',
  'visibility.badgeIf': 'if {condition}',
  'visibility.badgeRepeat': 'each {path}',

  // inspector
  'inspector.title': 'Properties',
  'inspector.none': 'Select a block to edit it.',
  'inspector.document': 'Email settings',
  'inspector.name': 'Template name',
  'inspector.subject': 'Subject',
  'inspector.preheader': 'Preheader',
  'inspector.width': 'Content width',
  'inspector.background': 'Page background',
  'inspector.contentBackground': 'Content background',
  'inspector.font': 'Font',
  'inspector.textColor': 'Text colour',
  'inspector.linkColor': 'Link colour',
  'inspector.darkMode': 'Dark-mode aware',
  'inspector.columns': 'Columns',
  'inspector.layout': 'Layout',
  'inspector.stack': 'Stack on mobile',
  'inspector.gap': 'Gap',
  'inspector.verticalAlign': 'Vertical align',
  'inspector.section': 'Section',
  'inspector.row': 'Row',
  'inspector.column': 'Column',
  'inspector.fullWidth': 'Full-width background',
  'inspector.backgroundImage': 'Background image',

  // fields
  'field.top': 'Top',
  'field.right': 'Right',
  'field.bottom': 'Bottom',
  'field.left': 'Left',
  'field.alignLeft': 'Left',
  'field.alignCenter': 'Centre',
  'field.alignRight': 'Right',
  'field.upload': 'Upload',
  'field.uploading': 'Uploading…',
  'field.url': 'or paste a URL',
  'field.addItem': 'Add item',
  'field.removeItem': 'Remove',
  'field.vars': 'Merge variables',
  'field.varsHint': 'Type {{ to insert a variable',

  // code panel
  'code.text': 'Text',

  // lint
  'lint.clean': 'No issues found.',
  'lint.errors': '{count} errors',
  'lint.warnings': '{count} warnings',
  'lint.infos': '{count} notes',
  'lint.size': 'Rendered size: {size}',
  'lint.goto': 'Show the block this affects',

  // import

  // dnd announcements
  'dnd.instructions':
    'Press space or enter to pick up a block. Use the arrow keys to move it. Press space or enter again to drop it, or escape to cancel.',
  'dnd.picked': 'Picked up {name}.',
  'dnd.over': 'Moved {name} over position {index}.',
  'dnd.dropped': 'Dropped {name} at position {index}.',
  'dnd.cancelled': 'Cancelled moving {name}.',
}
