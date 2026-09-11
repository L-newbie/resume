import { useEffect, useRef } from 'react'
import { UI } from '../content/data'
import { SECTIONS } from '../content/sections'
import { useApp } from '../lib/store'
import { IconClose } from './Icons'
import { HeroPanel } from './sections/HeroPanel'
import { CareerPanel } from './sections/CareerPanel'
import { WorkPanel } from './sections/WorkPanel'
import { SkillsPanel } from './sections/SkillsPanel'
import { ContactPanel } from './sections/ContactPanel'

/** ⚠️ 顺序必须和 SECTIONS 一致 —— 索引即板块号，也是球面上的瓣号。
    「关于」已并入「能力」，所以这里是 5 个而不是 6 个。 */
const PANELS = [
  HeroPanel,
  SkillsPanel,
  CareerPanel,
  WorkPanel,
  ContactPanel,
]

/**
 * 板块面板 —— 点小屏之后展开的完整内容。
 *
 * 布局：球缩到左侧继续转（那是 3D 层做的），面板占右侧。
 * 面板顶部的读数条对应当前板块，和小屏上的编号呼应 ——
 * 「你点的那块投影，现在展开了」。
 *
 * 内容可以内部滚动：板块内容本来就长短不一，
 * 硬压到一屏会逼着删内容，不值得。
 */
export function SectionPanel() {
  const active = useApp((s) => s.active)
  const close = useApp((s) => s.close)
  const lang = useApp((s) => s.lang)
  const bodyRef = useRef<HTMLDivElement>(null)

  // ESC 关闭
  useEffect(() => {
    if (active < 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, close])

  /**
   * 滚动区上下缘的渐隐。
   *
   * 只在「那个方向确实还有内容」时才渐隐 —— 滚到顶还给上缘蒙一层，
   * 第一行就永远是暗的，看着像渲染坏了。
   */
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const sync = () => {
      const top = el.scrollTop
      const rest = el.scrollHeight - el.clientHeight - top
      el.style.setProperty('--fade-t', `${Math.min(28, Math.max(0, top))}px`)
      el.style.setProperty('--fade-b', `${Math.min(28, Math.max(0, rest))}px`)
    }
    sync()
    el.addEventListener('scroll', sync, { passive: true })
    // 内容会变高（履历折叠展开、切项目），高度变了要重算
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    for (const c of Array.from(el.children)) ro.observe(c)
    return () => {
      el.removeEventListener('scroll', sync)
      ro.disconnect()
    }
  }, [active])

  if (active < 0) return null

  const s = SECTIONS[active]
  const Body = PANELS[active] ?? HeroPanel

  return (
    // key 换了整块重挂 → 切板块时动画重放，且各面板内部状态不串
    <section className="sheet" key={s.id} aria-label={s.label[lang]}>
      <header className="sh-head">
        <span className="sh-no hud-mono">{s.no}</span>
        <span className="sh-rule" />
        <h2 className="sh-title">{s.label[lang]}</h2>
        <button
          className="sh-close"
          onClick={close}
          aria-label={UI.backToOrb[lang]}
        >
          <IconClose />
        </button>
      </header>

      {/* 00 个人信息不显示这行 —— 它的 tag 就是 IDENTITY.role，
          而面板里已经有一个显眼的职位标签，重复了。
          其它板块的 tag 是各自独立的一句话，照常显示。 */}
      {s.tag[lang] && s.id !== 'hero' && <p className="sh-tag">{s.tag[lang]}</p>}

      <div className="sh-body" data-scrollable="" ref={bodyRef}>
        <Body />
      </div>
    </section>
  )
}
