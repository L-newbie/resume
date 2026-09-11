import { useEffect, useRef, useState } from 'react'
import { UI } from '../content/data'
import { SECTIONS } from '../content/sections'
import { useApp } from '../lib/store'
import type { OrbScene } from '../three/OrbScene'

/**
 * 引线从大洲生长到小屏边缘所需的时间（ms）—— 屏体在这之后才展开。
 *
 * 820 比「够用」要长：引线是整个开机序列的起手式，
 * 走太快就只是个转场，慢下来才有「信号从那块大陆传过来」的感觉。
 * 试过 520，用户说还可以再慢一点。
 * ⚠️ 往上加的时候盯着总时长：LEAD + 打字全程要短于 DWELL(5.6s)。
 */
const LEAD_MS = 820

/** 系统「减少动效」：跳过所有生长 / 打字动画，直接给终态 */
const reduced = () =>
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * 科幻小屏 —— 挂在大洲上的虚拟投影。
 *
 * 关键设计：小屏是 **DOM 而不是 3D 贴图**。
 * 场景每帧把大洲锚点投影成屏幕坐标，这里直接写 transform。
 * 文字永远清晰（贴图上的小字必糊）、CSS 辉光好做、hover/click 天然可用。
 *
 * 开机序列（切到新大洲时重放）—— 内容是被大洲「投影」出来的，
 * 所以顺序必须是 **先有线，再有屏，最后有字**：
 *   0ms     引线从大洲锚点开始生长，朝小屏的位置伸过去
 *   520ms   线到位，一道横扫的亮线沿线头拉开屏体
 *   760ms   屏体纵向展开、边框亮起
 *   1100ms  标题逐字打印（慢，13 字/秒）
 *   1520ms  副标题逐字打印（30 字/秒）
 *   2040ms  读数行逐条滑入，数值也逐字打印
 *   3040ms  「点击进入」亮起 —— 就绪
 * 全程约 3.5 秒，OrbScene 的 DWELL 是 5.6 秒，留足了余量。
 *
 * ⚠️ OrbScene 只在**相机停稳且入场动画跑完**之后才调 onFocus，
 * 所以这里可以假定动画一旦开始就不会被运镜打断。
 *
 * 性能：位置每帧走 rAF 直写 style，零 React 重渲染。
 */
export function Panes({ scene }: { scene: OrbScene }) {
  const lang = useApp((s) => s.lang)
  const open = useApp((s) => s.open)
  const setHover = useApp((s) => s.setHover)
  const rootRef = useRef<HTMLDivElement>(null)
  const leadRef = useRef<SVGSVGElement>(null)
  /** 当前正对的大洲 —— 换了就重放开机动画。-1 = 还没开机 */
  const [focus, setFocus] = useState(-1)
  /**
   * 开机序列的起始时间戳。引线的生长进度按它算 ——
   * 放在 ref 里而不是 state：每帧都要读，进 state 会疯狂重渲染。
   */
  const bootAt = useRef(0)
  /**
   * 引线伸出的程度：0 = 还在大洲锚点上，1 = 已经画到小屏。
   * 只由开机动画的进度决定，和球体转不转无关。
   */
  const reachRef = useRef(0)

  useEffect(() => {
    // 链式包装：onFocus 是单个回调，直接赋值会覆盖别处的订阅
    const prev = scene.onFocus
    scene.onFocus = (i) => {
      prev?.(i)
      // 高亮换了就**立刻**重放开机动画，不排队、不等上一条线收完。
      //
      // 上一块的小屏是另一个 DOM 元素，focus 一变它自己就隐藏了；
      // 引线全场只有一条 SVG，起点每帧跟着「当前高亮大洲」的锚点走 ——
      // 所以从构造上就不可能出现两条线，不需要额外的交接机制。
      // （之前排过队，结果是转动中屏幕整整空一秒，反而更糟。）
      bootAt.current = performance.now()
      setFocus(i)
    }
    return () => {
      scene.onFocus = prev
    }
  }, [scene])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const els = Array.from(root.children) as HTMLElement[]

    const lead = leadRef.current
    const leadLine = lead?.querySelector('line') as SVGLineElement | null
    const leadDot = lead?.querySelector('circle') as SVGCircleElement | null

    let raf = 0
    let lastAccent = ''
    const frame = () => {
      raf = requestAnimationFrame(frame)

      // ── 引线伸出的程度 ──
      // reach: 0 = 缩在大洲锚点上，1 = 已经画到小屏边缘。
      //
      // 只由「开机动画走到哪了」决定，**不看球体转不转**。
      // 板块一高亮就开始往外长，上一块的线因为起点换了大洲，
      // 自然就不在原处了 —— 不需要先收回再放出来。
      //
      // 转动中照常显示：起点每帧跟着大洲锚点走，
      // 于是线是「连在那块大陆上跟着一起转」的，这正是要的效果。
      const elapsed = bootAt.current ? performance.now() - bootAt.current : -1
      reachRef.current =
        elapsed < 0 ? 0 : reduced() ? 1 : Math.min(1, elapsed / LEAD_MS)
      const reach = reachRef.current

      // 把 3D 层算出的主色同步给 CSS —— 小屏边框、辉光、引线都读它。
      // 每帧只在**变了**的时候写：setProperty 会触发样式重算，
      // 无条件每帧写等于每帧强制 recalc，60fps 下很浪费。
      if (scene.accentCss !== lastAccent) {
        lastAccent = scene.accentCss
        document.documentElement.style.setProperty('--accent', lastAccent)
      }

      for (let i = 0; i < els.length; i++) {
        const p = scene.panes[i]
        const el = els[i]
        /*
          引线没画到位之前小屏不出现 ——
          「线先到，屏才被投影出来」这个因果是整段动画的意义所在。

          ⚠️ 必须同时看 p.armed。focusIdx 在运镜**一开始**就换成新的一块，
          但 onFocus 要等相机停稳才发；那段时间里 bootAt 还停在上一次的
          时间戳，reach 算出来已经是 1，小屏会先闪现一下再消失，
          然后才正常播开机动画。armed 把这个窗口盖掉。
        */
        const shown = p.visible && p.armed && (!p.focused || reach >= 1)
        if (!shown) {
          el.style.opacity = '0'
          el.style.pointerEvents = 'none'
          continue
        }

        const d = p.depth
        // 正对的那块保持原尺寸，侧面的略缩 —— 缩太多字就读不清了
        const scale = p.focused ? 1 : 0.78 + d * 0.16
        el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`
        el.style.opacity = (p.focused ? 1 : 0.2 + d * d * 0.55).toFixed(3)
        el.style.zIndex = String(p.focused ? 120 : Math.round(d * 100))
        // 只有正对的（或展开态下的）小屏可点，避免误触侧面的
        el.style.pointerEvents = p.focused || d > 0.8 ? 'auto' : 'none'
        el.classList.toggle('is-focus', p.focused)
      }

      // ── 画引线 ──
      // 起点**永远**是大洲锚点，终点随 reach 推进。
      // 反过来画（从小屏长向大洲）就成了「屏先存在」，因果就反了。
      // 同样要求 armed —— 否则引线会在小屏之前先闪现一段
      const fi = scene.panes.findIndex((p) => p.focused && p.visible && p.armed)
      const p = fi >= 0 ? scene.panes[fi] : null
      if (!lead || !leadLine || !leadDot) {
        // 没有 SVG 就没什么可做的
      } else if (!p || reach <= 0) {
        // 还没开始长，或者那块大洲转到背面了 → 藏起来
        lead.style.opacity = '0'
      } else {
        const el = els[fi]
        const dx = p.ax - p.x
        const dy = p.ay - p.y
        // 锚点离小屏太近时不画线，画了就是一个点。
        // 阈值取小一点（24）：窄屏上球小、引线本来就短，
        // 卡太严会让手机上永远看不到引线。
        if (Math.hypot(dx, dy) < 24) {
          lead.style.opacity = '0'
        } else {
          // 终点退到小屏边框外一点，不从文字中间冒出来。
          // 屏体还没出现时用它最终的尺寸算 —— 元素只是 opacity:0，
          // 不是 display:none，所以 offsetWidth 仍然是真实值。
          const hw = el.offsetWidth / 2 + 12
          const hh = el.offsetHeight / 2 + 12
          // 求射线与小屏矩形边框的交点
          const tx = Math.abs(dx) > 1e-3 ? hw / Math.abs(dx) : Infinity
          const ty = Math.abs(dy) > 1e-3 ? hh / Math.abs(dy) : Infinity
          const tEdge = Math.min(tx, ty)
          const ex = p.x + dx * tEdge
          const ey = p.y + dy * tEdge
          // easeOutCubic：线冲出来得快，快到时收住，像激光打上去
          const g = 1 - Math.pow(1 - reach, 3)
          // 线本身淡入（前 15% 的行程里完成）—— 不加的话线是「啪」地
          // 以满亮度出现的，那一下很硬。
          lead.style.opacity = Math.min(1, reach / 0.15).toFixed(3)
          leadLine.setAttribute('x1', p.ax.toFixed(1))
          leadLine.setAttribute('y1', p.ay.toFixed(1))
          leadLine.setAttribute('x2', (p.ax + (ex - p.ax) * g).toFixed(1))
          leadLine.setAttribute('y2', (p.ay + (ey - p.ay) * g).toFixed(1))
          leadDot.setAttribute('cx', p.ax.toFixed(1))
          leadDot.setAttribute('cy', p.ay.toFixed(1))
          // 终点标记随线一起长大 —— 线刚从大洲冒头时它还是个小点，
          // 走完全程才张到正常大小。整条线于是像「从这里射出去」的。
          leadDot.setAttribute('r', (1.2 + g * 2.3).toFixed(2))
        }
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [scene])

  return (
    <>
      {/* 引线层：从中央小屏指向当前大洲。放在小屏下面（z-index 更低），
          线从屏体后面伸出来，不压在文字上。 */}
      <svg className="pn-lead" ref={leadRef} aria-hidden="true">
        <line />
        {/* 终点标记：实心点 + 外环，钉在大洲中心的地表上 */}
        <circle r="3.5" />
      </svg>
      <div className="panes" ref={rootRef}>
      {SECTIONS.map((s, i) => (
        <button
          key={s.id}
          className="pane"
          onClick={() => open(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={(e) => {
            setHover(-1)
            // 光斑归位到中心，不然下次进来会从上次离开的位置突然跳
            const el = e.currentTarget
            el.style.setProperty('--mx', '50%')
            el.style.setProperty('--my', '50%')
            el.style.setProperty('--tilt-x', '0deg')
            el.style.setProperty('--tilt-y', '0deg')
            el.style.setProperty('--px', '0')
            el.style.setProperty('--py', '0')
            el.style.setProperty('--mpx', '50%')
            el.style.setProperty('--mpy', '50%')
          }}
          onMouseMove={(e) => {
            // 鼠标在小屏内移动时：光斑跟着走 + 屏体轻微倾斜。
            // 写 CSS 变量而不是 state —— 每帧改 state 会疯狂重渲染。
            const el = e.currentTarget
            const r = el.getBoundingClientRect()
            const px = (e.clientX - r.left) / r.width
            const py = (e.clientY - r.top) / r.height
            el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
            el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
            // 高光那层用**像素**：它靠 transform 移动（合成器的活，不重绘），
            // 而百分比的渐变位置每动一次就要把整块重绘一遍 ——
            // .pn-inner 上挂着 backdrop-filter，重绘它很贵。
            el.style.setProperty('--mpx', `${(e.clientX - r.left).toFixed(0)}px`)
            el.style.setProperty('--mpy', `${(e.clientY - r.top).toFixed(0)}px`)
            // 倾斜 ±13°：小屏是「悬在空中的投影板」，跟手要看得出来。
            // 早期只有 ±4°，用户反馈「几乎看不出在动」。再大就晕，
            // 而且屏体侧面会被透视压扁到读不清字。
            el.style.setProperty('--tilt-y', `${((px - 0.5) * 26).toFixed(2)}deg`)
            el.style.setProperty('--tilt-x', `${((0.5 - py) * 26).toFixed(2)}deg`)
            // 归一化到 −1..1，给内容层做反向视差（见 styles.css 的 .pn-content）
            el.style.setProperty('--px', ((px - 0.5) * 2).toFixed(3))
            el.style.setProperty('--py', ((py - 0.5) * 2).toFixed(3))
          }}
          onFocus={() => setHover(i)}
          onBlur={() => setHover(-1)}
          aria-label={`${s.no} ${s.label[lang]}`}
        >
          {/* key 带 focus + lang：换大洲或换语言时整块重挂 → 开机动画重放 */}
          <PaneBody
            key={`${i}-${focus === i}-${lang}`}
            section={s}
            lang={lang}
            booting={focus === i}
          />
        </button>
      ))}
      </div>
    </>
  )
}

/**
 * 小屏内部 —— 开机序列在这里。
 *
 * `booting` 为真时走完整开机动画；为假（侧面的小屏）时直接静态呈现，
 * 因为那些小屏本来就是模糊的背景元素，做动画是浪费。
 *
 * ⚠️ 所有时间都要加 LEAD_MS 的偏移。这个组件在 onFocus 那一刻就挂载了，
 * 但外层要等引线画到位（LEAD_MS）之后才把 opacity 打开 ——
 * 不加偏移的话扫描线和展开动画会在小屏还不可见时就播完，
 * 用户看到的是「线画完，屏直接带着字蹦出来」。
 */
function PaneBody({
  section: s,
  lang,
  booting,
}: {
  section: (typeof SECTIONS)[number]
  lang: 'zh' | 'en'
  booting: boolean
}) {
  /** 开机阶段：0 = 扫描线，1 = 屏体展开，2 = 内容注入 */
  const [phase, setPhase] = useState(booting ? 0 : 2)

  useEffect(() => {
    if (!booting) return
    // 尊重系统「减少动效」：跳过开机动画
    if (reduced()) {
      setPhase(2)
      return
    }
    const t1 = setTimeout(() => setPhase(1), LEAD_MS + 240)
    const t2 = setTimeout(() => setPhase(2), LEAD_MS + 580)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [booting])

  return (
    <span className={`pn-inner phase-${phase}`}>
      {/* 开机扫描线：一道横扫的亮线，屏体就是被它「拉」出来的 */}
      <span className="pn-boot" aria-hidden="true" />

      {/* 屏体：切角边框 + 底纹 + 水印，phase>=1 后展开 */}
      <span className="pn-frame" aria-hidden="true">
        <i className="pn-c tl" />
        <i className="pn-c tr" />
        <i className="pn-c bl" />
        <i className="pn-c br" />
      </span>
      <span className="pn-scan" aria-hidden="true" />
      <span className="pn-mesh" aria-hidden="true" />
      <span className="pn-ghost" aria-hidden="true">
        {s.no}
      </span>

      {/* 内容：phase>=2 才注入 */}
      <span className="pn-content">
        <span className="pn-bar">
          <i className="pn-led" />
          <b className="pn-no hud-mono">SEC-{s.no}</b>
          <i className="pn-bar-line" />
          <i className="pn-sig hud-mono">LIVE</i>
        </span>

        {/* ⚠️ 下面这些 <Typed> 的 delay **不加** LEAD_MS。
            它们只在 phase>=2 时才挂载，而 phase 的 setTimeout 已经把
            LEAD_MS 算进去了 —— 再加一次就是双重延迟，字会晚半秒才出来。 */}
        <span className="pn-label">
          {phase >= 2 ? (
            <Typed text={s.label[lang]} active={booting} cps={13} delay={0} />
          ) : (
            <i className="pn-blank" />
          )}
        </span>

        <span className="pn-tag">
          {phase >= 2 ? (
            <Typed text={s.tag[lang]} active={booting} cps={30} delay={420} />
          ) : (
            <i className="pn-blank" />
          )}
        </span>

        <span className="pn-readouts hud-mono">
          {s.readouts.map((r, ri) => (
            <span
              key={ri}
              className="pn-row"
              // 等标题和正文打完再逐条滑入。
              // 这个 delay 是相对 PaneBody 挂载时刻的，而挂载发生在
              // 引线开始生长那一刻 —— 所以要把 LEAD_MS 算进去。
              style={{ animationDelay: `${LEAD_MS / 1000 + 1.5 + ri * 0.22}s` }}
            >
              <i className="pn-k">{r.k[lang]}</i>
              <i className="pn-dots" aria-hidden="true" />
              <i className="pn-v">
                {phase >= 2 ? (
                  <Typed
                    text={r.v[lang]}
                    active={booting}
                    cps={34}
                    delay={1560 + ri * 220}
                  />
                ) : null}
              </i>
            </span>
          ))}
        </span>

        <span
          className="pn-enter hud-mono"
          // 所有内容打印完之后才亮起 —— 「就绪」的信号
          style={{ transitionDelay: booting ? `${LEAD_MS / 1000 + 2.5}s` : '0s' }}
        >
          <i className="pn-enter-dot" />
          {UI.clickToEnter[lang]}
        </span>
      </span>
    </span>
  )
}

/**
 * 打字机输出。
 *
 * 用 rAF 按时间推进而不是 setInterval 按帧数 ——
 * 这样在不同刷新率的屏幕上速度一致（120Hz 的 iPad 不会快一倍）。
 * 非激活状态直接全量显示，不做动画。
 */
function Typed({
  text,
  active,
  cps,
  delay,
}: {
  text: string
  active: boolean
  cps: number
  delay: number
}) {
  const [shown, setShown] = useState(active ? '' : text)

  useEffect(() => {
    if (!active) {
      setShown(text)
      return
    }
    if (reduced()) {
      setShown(text)
      return
    }
    setShown('')
    let raf = 0
    let start = 0
    const step = (t: number) => {
      if (!start) start = t
      const el = t - start - delay
      if (el < 0) {
        raf = requestAnimationFrame(step)
        return
      }
      const n = Math.floor((el / 1000) * cps)
      if (n >= text.length) {
        setShown(text)
        return
      }
      setShown(text.slice(0, n))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [text, active, cps, delay])

  const done = shown === text
  return (
    <>
      {shown}
      {!done && <i className="pn-caret" aria-hidden="true" />}
    </>
  )
}
