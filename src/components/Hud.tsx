import { useEffect, useState } from 'react'
import { IDENTITY, UI } from '../content/data'
import { useApp } from '../lib/store'

/**
 * HUD 外框：四角定位标、边缘刻度、实时读数。
 * 纯装饰，pointer-events: none —— 不挡任何交互。
 *
 * 这一层是「感知视界」隐喻的主要载体：让整个页面看起来像
 * 一个传感器的取景框，而不是一个网页。
 */
export function HudFrame() {
  const [clock, setClock] = useState({ date: '', time: '' })
  const lang = useApp((s) => s.lang)

  // 实时时钟 —— HUD 上的动态读数，让画面「活着」。
  // 年月日时分秒都给全：这是传感器时间戳的读法，只有时分秒像个挂钟。
  // 格式走 ISO 数字（2026-09-07 14:03:22），中英文都能直接读，
  // 不需要跟着 lang 切 —— 数字没有语言。
  useEffect(() => {
    const tick = () => {
      const d = new Date()
      const p = (n: number) => String(n).padStart(2, '0')
      setClock({
        date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
        time: `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`,
      })
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="hud" aria-hidden="true">
      <span className="hud-corner tl" />
      <span className="hud-corner tr" />
      <span className="hud-corner bl" />
      <span className="hud-corner br" />

      {/* 左上：身份标识 + 语言切换。右上留给模式切换按钮，不放读数。 */}
      <div className="hud-readout hud-tl">
        <span className="hud-dot" />
        <span className="hud-mono">{IDENTITY.callsign[lang]}</span>
        <LangToggle />
      </div>

      {/* 左下：坐标 —— 装饰性读数 */}
      <div className="hud-readout hud-bl">
        <span className="hud-mono">
          {IDENTITY.coords.lat.toFixed(4)}°N {IDENTITY.coords.lon.toFixed(4)}°E
        </span>
      </div>

      {/* 右下：时间戳（年月日 + 时分秒）。
          日期压暗一档 —— 走秒的那串才是「活着」的部分，让它更亮。 */}
      <div className="hud-readout hud-br">
        <span className="hud-mono hud-date">{clock.date}</span>
        <span className="hud-sep" />
        <span className="hud-mono">{clock.time}</span>
      </div>

      <div className="hud-ticks top" />
      <div className="hud-ticks bottom" />
    </div>
  )
}

/**
 * 语言切换。
 * 嵌在 HUD 左上角的身份读数里 —— 它本身就是「这份档案用哪种语言呈现」，
 * 和身份标识是同一组信息。HUD 层是 pointer-events:none，这里要单独开回来。
 */
export function LangToggle() {
  const lang = useApp((s) => s.lang)
  const toggle = useApp((s) => s.toggleLang)
  return (
    <button
      className="lang-toggle"
      onClick={toggle}
      aria-label={UI.switchLangHint[lang]}
    >
      <span className={lang === 'zh' ? 'is-on' : ''}>中</span>
      <span className="lang-sep" />
      <span className={lang === 'en' ? 'is-on' : ''}>EN</span>
    </button>
  )
}

/**
 * 加载遮罩：等 3D 场景就绪后淡出。
 * 即使 3D 完全失败也会走 markReady()，不会卡住。
 */
export function LoadingVeil() {
  const ready = useApp((s) => s.ready)
  const lang = useApp((s) => s.lang)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => setGone(true), 900)
    return () => clearTimeout(t)
  }, [ready])

  // 兜底：无论如何 4 秒后强制移除，绝不让遮罩卡死页面
  useEffect(() => {
    const t = setTimeout(() => setGone(true), 4000)
    return () => clearTimeout(t)
  }, [])

  if (gone) return null

  return (
    <div className={`veil${ready ? ' is-hidden' : ''}`}>
      <div className="veil-inner">
        <div className="veil-scan" />
        <span className="veil-text hud-mono">{UI.loading[lang]}</span>
      </div>
    </div>
  )
}
