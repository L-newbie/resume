import { create } from 'zustand'
import type { Lang } from '../content/types'

const LANG_KEY = 'wh-lang'

/** 首次进入时的语言：localStorage → 浏览器语言 → 中文 */
function initialLang(): Lang {
  if (typeof window === 'undefined') return 'zh'
  const saved = localStorage.getItem(LANG_KEY)
  if (saved === 'zh' || saved === 'en') return saved
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

interface AppState {
  lang: Lang
  setLang: (l: Lang) => void
  toggleLang: () => void

  /** 当前打开的板块索引，-1 = 没打开（停在球体首页） */
  active: number
  open: (i: number) => void
  close: () => void

  /** 鼠标悬停的板块索引，-1 = 没悬停。球体据此暂停自转 */
  hover: number
  setHover: (i: number) => void

  /** 3D 场景是否已就绪 —— 加载遮罩据此淡出 */
  ready: boolean
  markReady: () => void
}

export const useApp = create<AppState>((set, get) => ({
  lang: initialLang(),
  setLang: (lang) => {
    localStorage.setItem(LANG_KEY, lang)
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    set({ lang })
  },
  toggleLang: () => get().setLang(get().lang === 'zh' ? 'en' : 'zh'),

  active: -1,
  // 打开板块时清掉 hover —— 否则关闭后 hover 还挂着，球不会恢复自转
  open: (active) => set({ active, hover: -1 }),
  close: () => set({ active: -1 }),

  hover: -1,
  setHover: (hover) => {
    if (get().hover !== hover) set({ hover })
  },

  ready: false,
  markReady: () => set({ ready: true }),
}))
