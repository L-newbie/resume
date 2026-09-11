// 内联 SVG 图标。不引图标库 —— 每个图标就几百字节，
// 全部走 currentColor，跟随主题色。
type P = { className?: string }

export const IconGithub = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
  </svg>
)

export const IconMail = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
    <path d="m3 6.5 9 6.5 9-6.5" />
  </svg>
)

export const IconLinkedin = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM3 9h4v12H3V9Zm6.5 0h3.8v1.7h.05c.53-1 1.83-2.05 3.76-2.05C21.3 8.65 22 10.8 22 14v7h-4v-6.2c0-1.5 0-3.4-2.06-3.4-2.07 0-2.39 1.6-2.39 3.3V21h-4V9Z" />
  </svg>
)

export const IconZhihu = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13.5 4.2h7.9v1.6h-3.2v11.5l1.3-.8 1.9 2.9-3.2 1.9-2.5-3.6V5.8h-2.2V4.2ZM8.6 4c-.4 1.4-.9 2.6-1.4 3.6h4.9v1.6H9.9c0 .9-.1 1.8-.2 2.6h2.3v1.6h-2.5c-.1.4-.2.8-.3 1.2l2.6 3.6-1.2 1.4-2.2-3.1c-.7 1.6-1.8 3-3.4 4.2l-1-1.3c2.3-1.9 3.4-4.3 3.7-7.6H4.2v-1.6h3.6c.1-.8.2-1.7.2-2.6H6.5c-.4.8-.9 1.6-1.4 2.2l-1.3-1C5 7.5 5.9 5.7 6.4 3.6L8.6 4Z" />
  </svg>
)

export const IconX = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.2 2h3.3l-7.2 8.3L22.8 22h-6.6l-5.2-6.8L5 22H1.7l7.7-8.9L1.2 2h6.8l4.7 6.2L18.2 2Zm-1.2 18h1.8L7.1 3.9H5.2L17 20Z" />
  </svg>
)

export const IconLink = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </svg>
)

export const IconDownload = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12" />
    <path d="m7 10.5 5 5 5-5" />
    <path d="M4 20h16" />
  </svg>
)

export const IconArrow = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5" />
  </svg>
)

export const IconClose = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)

export const IconPhone = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M6.5 3h3l1.5 4-2 1.5a13 13 0 0 0 6.5 6.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3Z" />
  </svg>
)

export const ICONS = {
  github: IconGithub,
  mail: IconMail,
  linkedin: IconLinkedin,
  zhihu: IconZhihu,
  x: IconX,
  link: IconLink,
  phone: IconPhone,
} as const
