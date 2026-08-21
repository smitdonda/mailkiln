/**
 * Inline SVG icons.
 *
 * No icon-library dependency: the whole set is under 2KB, and a peer dependency
 * on someone's icon package is a real cost for consumers (duplicate icon sets,
 * version conflicts) in exchange for nothing.
 *
 * @module mailkiln/react/icons
 */

/** @typedef {import('react').SVGProps<SVGSVGElement>} IconProps */
/** @typedef {(props: IconProps) => import('react').ReactElement} IconComponent */

/**
 * Build an icon component from its paths. One typed factory keeps every icon
 * below a two-line declaration.
 *
 * @param {import('react').ReactNode} paths
 * @returns {IconComponent}
 */
function icon(paths) {
  /**
   * @param {IconProps} props
   * @returns {import('react').ReactElement}
   */
  return function Icon(props) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        width="1em"
        height="1em"
        {...props}
      >
        {paths}
      </svg>
    )
  }
}

export const IconText = icon(<path d="M4 6h16M4 12h12M4 18h9" />)

export const IconHeading = icon(<path d="M6 4v16M18 4v16M6 12h12" />)

export const IconImage = icon(
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="m3 17 5-4 4 3 3-2 6 5" />
  </>,
)

export const IconButton = icon(
  <>
    <rect x="3" y="8" width="18" height="8" rx="4" />
    <path d="M9 12h6" />
  </>,
)

export const IconDivider = icon(
  <>
    <path d="M6 7h12M6 17h12" opacity="0.45" />
    <path d="M3 12h18" />
  </>,
)

export const IconSpacer = icon(
  <>
    <path d="M4 5h16M4 19h16" />
    <path d="M12 9v6M9.5 11.5 12 9l2.5 2.5M9.5 12.5 12 15l2.5-2.5" />
  </>,
)

export const IconSocial = icon(
  <>
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="12" cy="12" r="2.5" />
    <circle cx="18" cy="12" r="2.5" />
  </>,
)

export const IconVideo = icon(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m10 9.5 5 2.5-5 2.5z" />
  </>,
)

export const IconCode = icon(<path d="m9 8-5 4 5 4M15 8l5 4-5 4" />)

export const IconUndo = icon(
  <>
    <path d="M4 8h9a5 5 0 1 1 0 10H8" />
    <path d="m4 8 4-4M4 8l4 4" />
  </>,
)

export const IconRedo = icon(
  <>
    <path d="M20 8h-9a5 5 0 1 0 0 10h5" />
    <path d="m20 8-4-4M20 8l-4 4" />
  </>,
)

export const IconTrash = icon(<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />)

export const IconCopy = icon(
  <>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 5H6a1 1 0 0 0-1 1v9" />
  </>,
)

export const IconDrag = icon(
  <>
    <circle cx="9" cy="6" r="1.2" fill="currentColor" />
    <circle cx="15" cy="6" r="1.2" fill="currentColor" />
    <circle cx="9" cy="12" r="1.2" fill="currentColor" />
    <circle cx="15" cy="12" r="1.2" fill="currentColor" />
    <circle cx="9" cy="18" r="1.2" fill="currentColor" />
    <circle cx="15" cy="18" r="1.2" fill="currentColor" />
  </>,
)

export const IconDesktop = icon(
  <>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M9 20h6M12 16v4" />
  </>,
)

export const IconMobile = icon(
  <>
    <rect x="7" y="3" width="10" height="18" rx="2" />
    <path d="M11 18h2" />
  </>,
)

export const IconUpload = icon(
  <>
    <path d="M12 16V5m-4 4 4-4 4 4" />
    <path d="M5 17v2h14v-2" />
  </>,
)

export const IconDownload = icon(
  <>
    <path d="M12 5v11m-4-4 4 4 4-4" />
    <path d="M5 19h14" />
  </>,
)

export const IconPlus = icon(<path d="M12 5v14M5 12h14" />)

export const IconMoon = icon(<path d="M20 13.5A8 8 0 0 1 10.5 4a8 8 0 1 0 9.5 9.5z" />)

export const IconWarning = icon(
  <>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4M12 17h.01" />
  </>,
)

export const IconCheck = icon(<path d="m5 13 4 4L19 7" />)

export const IconSearch = icon(
  <>
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-4.5-4.5" />
  </>,
)

export const IconChevronRight = icon(<path d="m9 5 7 7-7 7" />)

export const IconArrowLeft = icon(<path d="M19 12H5m6-6-6 6 6 6" />)

/** The Rows tab: stacked layout bands. */
export const IconRows = icon(
  <>
    <rect x="3" y="4" width="18" height="6" rx="1.5" />
    <rect x="3" y="14" width="8" height="6" rx="1.5" />
    <rect x="13" y="14" width="8" height="6" rx="1.5" />
  </>,
)

/** The Settings tab: sliders. */
export const IconSliders = icon(
  <>
    <path d="M5 6h14M5 12h14M5 18h14" />
    <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
    <circle cx="8" cy="18" r="2" fill="currentColor" stroke="none" />
  </>,
)

/** The Content tab: a grid of blocks. */
export const IconGrid = icon(
  <>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </>,
)

export const IconEye = icon(
  <>
    <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.6" />
  </>,
)

export const IconAlignLeft = icon(<path d="M4 6h16M4 12h10M4 18h13" />)

export const IconAlignCenter = icon(<path d="M4 6h16M7 12h10M5.5 18h13" />)

export const IconAlignRight = icon(<path d="M4 6h16M10 12h10M7 18h13" />)

export const IconInfo = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </>,
)

export const IconAlert = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6M12 16.5h.01" />
  </>,
)

export const IconCheckCircle = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 2.5 2.5L16 9.5" />
  </>,
)

export const IconClose = icon(<path d="M6 6l12 12M18 6L6 18" />)

export const IconSend = icon(
  <>
    <path d="M21 3 10.5 13.5" />
    <path d="M21 3 14.5 21l-4-7.5L3 9.5z" />
  </>,
)

export const IconMail = icon(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m3.5 7.5 7.3 5.2a2 2 0 0 0 2.4 0l7.3-5.2" />
  </>,
)

export const IconArrowUp = icon(<path d="M12 19V5m-6 6 6-6 6 6" />)

export const IconArrowDown = icon(<path d="M12 5v14m6-6-6 6-6-6" />)

export const IconSection = icon(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 10h18" />
  </>,
)

/* --- inline rich-text toolbar -------------------------------------------- */

export const IconBold = icon(<path d="M7 5h5.2a3.5 3.5 0 0 1 0 7H7zm0 7h6.2a3.5 3.5 0 0 1 0 7H7z" />)

export const IconItalic = icon(<path d="M10 5h7M7 19h7M14.5 5 9.5 19" />)

export const IconUnderline = icon(<path d="M7 4v6a5 5 0 0 0 10 0V4M5 20h14" />)

export const IconLink = icon(
  <>
    <path d="M10.6 13.4a3.8 3.8 0 0 0 5.4 0l2.4-2.4a3.8 3.8 0 1 0-5.4-5.4l-1.2 1.2" />
    <path d="M13.4 10.6a3.8 3.8 0 0 0-5.4 0l-2.4 2.4a3.8 3.8 0 1 0 5.4 5.4l1.2-1.2" />
  </>,
)

export const IconUnlink = icon(
  <>
    <path d="M14.5 9.5 17 7a3.6 3.6 0 1 1 5 5l-2.5 2.5" />
    <path d="M9.5 14.5 7 17a3.6 3.6 0 1 1-5-5l2.5-2.5" />
    <path d="m3 3 18 18" />
  </>,
)

export const IconListBullet = icon(
  <>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
  </>,
)

export const IconListNumber = icon(
  <>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M3.4 4.6 4.6 4v3.6M3.2 10.6a1.2 1.2 0 0 1 2.2.7c0 .9-2.2 1.6-2.2 2.5h2.4M3.4 16.4a1.1 1.1 0 0 1 2 .6c0 .5-.5.9-1.1.9.7 0 1.2.4 1.2 1s-.5 1-1.1 1a1.2 1.2 0 0 1-1.1-.6" />
  </>,
)

/** Strip formatting: a "T" with an x, the convention every editor uses. */
export const IconClearFormat = icon(
  <>
    <path d="M5 6.5V5h9v1.5M9.5 5v10M7.5 19h4" />
    <path d="m15 13.5 5 5m0-5-5 5" />
  </>,
)

/**
 * Palette icon lookup, keyed by the `icon` string a block declares. A block with
 * an unknown (or absent) icon name falls back to the code glyph.
 *
 * @type {Record<string, IconComponent>}
 */
export const BLOCK_ICONS = {
  text: IconText,
  heading: IconHeading,
  image: IconImage,
  button: IconButton,
  divider: IconDivider,
  spacer: IconSpacer,
  social: IconSocial,
  video: IconVideo,
  code: IconCode,
}
