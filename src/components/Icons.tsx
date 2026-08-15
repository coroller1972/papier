import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const defaults: IconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function FolderIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M3.5 7.5h6l2-2h9v13h-17z" />
      <path d="M3.5 9.5h17" />
    </svg>
  )
}

export function FileIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M6.5 3.5h7l4 4v13h-11z" />
      <path d="M13.5 3.5v4h4" />
    </svg>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M12 3.5v11" />
      <path d="m8 10.5 4 4 4-4" />
      <path d="M4.5 18v2h15v-2" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </svg>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="m8 10 4 4 4-4" />
    </svg>
  )
}

export function ZoomOutIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M6 12h12" />
    </svg>
  )
}

export function ZoomInIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M6 12h12M12 6v12" />
    </svg>
  )
}

export function ExpandIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M8.5 4.5h-4v4M15.5 4.5h4v4M8.5 19.5h-4v-4M15.5 19.5h4v-4" />
    </svg>
  )
}
