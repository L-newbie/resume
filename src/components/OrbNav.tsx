import { useEffect, useRef, useState } from 'react'
import { SECTIONS } from '../content/sections'
import { useApp } from '../lib/store'
import { ResumeDownload } from './ResumeDownload'
import type { OrbScene } from '../three/OrbScene'

/**
 * 板块列表 —— 两种形态共用一个组件。
 *
 *   首页（active < 0）  固定在视口左侧，和球体**双向联动**：
 *                       球转到哪块，列表跟着高亮；移入某项，球转过去；
 *                       点击直接进入该板块。
 *   板块内（active ≥ 0）挂在缩小的地球正下方，标出当前在哪一个，
 *                       点击可直接横跳到别的板块。
 *
 * ⚠️ 位置每帧从 3D 层取（scene.orbScreen()）而不是写死 ——
 * 球的缩放和位移都是缓动的，写死会让列表在开合的那 0.5 秒里和球分家。
 * 定位走 rAF 直写 style，零 React 重渲染。
 */
export function OrbNav({ scene }: { scene: OrbScene }) {
  const lang = useApp((s) => s.lang)
  const active = useApp((s) => s.active)
  const open = useApp((s) => s.open)
  const rootRef = useRef<HTMLElement>(null)

  /** 球当前正对的大洲 —— 首页靠它高亮 */
  const [focus, setFocus] = useState(0)

  /*
    订阅「球转到哪一块」。

    ⚠️ 用 onFaceChange 而**不是** onFocus。
    onFocus 只在相机停稳后才发 —— 手动拖动球时 settled 恒为 false，
    高亮会一直停在拖动前那一块，跟不上球。
    onFaceChange 是实时的，专门给这种纯指示用途。

    ⚠️ 仍然是单个回调（不是事件列表），所以**链式包装**原有的，
    直接赋值会把别处的订阅覆盖掉。
  */
  useEffect(() => {
    const prev = scene.onFaceChange
    scene.onFaceChange = (i) => {
      prev?.(i)
      setFocus(i)
    }
    return () => {
      scene.onFaceChange = prev
    }
  }, [scene])

  // 板块内：跟着球定位。首页是固定位置，不需要每帧算。
  // ⚠️ 窄屏跳过 —— 那里导航是底部固定条，位置由 CSS 定；
  // 继续每帧写 transform 会和 CSS 打架（只能靠 !important 压住，
  // 而且白跑一个 rAF）。
  useEffect(() => {
    if (active < 0) return
    if (window.matchMedia('(max-width: 767px)').matches) return
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = rootRef.current
      if (!el) return
      /*
        ⚠️ 用 orbAnchor() 而不是 orbScreen()。
        orbScreen 是球的**真实**屏幕位置，含每帧的悬浮
        （root.position.y 里的 sin 浮动）和相机的指针视差 ——
        导航条跟着读就会一直上下抖。
        orbAnchor 只反映「球缩到哪个位置」这个缓动量：
        球照常自转、照常浮动，导航条稳稳待着。
      */
      const s = scene.orbAnchor()
      /*
        只写**纵向**：挂在球下方，留出球半径 + 一点间距。
        横向不写 —— 左边缘由 CSS 的 --nav-x 决定，和首页那版是同一个值。
        ⚠️ 以前是 translate(-50%) 居中挂在球正下方，于是进板块时
        列表会横向跳一大段，和首页那列对不上。用户要求两者对齐。
      */
      el.style.transform = `translate(0, ${(s.y + s.r + 18).toFixed(1)}px)`
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [scene, active])

  // 切回首页时清掉板块态留下的 transform，免得列表卡在球下方
  useEffect(() => {
    if (active < 0 && rootRef.current) {
      rootRef.current.style.transform = ''
    }
  }, [active])

  const inPanel = active >= 0
  const current = inPanel ? active : focus

  return (
    <nav
      ref={rootRef}
      className={`orb-nav${inPanel ? ' is-docked' : ' is-home'}`}
      aria-label={lang === 'zh' ? '板块导航' : 'Sections'}
    >
      <ul>
        {SECTIONS.map((s, i) => (
          <li key={s.id}>
            <button
              className={`on-item${i === current ? ' is-on' : ''}`}
              onClick={() => open(i)}
              // 首页：移入让球转过去。板块内不联动 ——
              // 那时球只是装饰，转它没有意义还会分散注意力。
              onMouseEnter={inPanel ? undefined : () => scene.focusFace(i)}
              onFocus={inPanel ? undefined : () => scene.focusFace(i)}
              aria-current={i === current}
            >
              <span className="on-no hud-mono">{s.no}</span>
              <span className="on-label">{s.label[lang]}</span>
              <span className="on-bar" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {/*
        下载简历挂在列表**下面**、在同一个 nav 容器里。

        ⚠️ 放进容器而不是单独 fixed 定位 —— 板块内导航的位置是 JS 每帧
        写在 nav 根节点上的（跟着缩小的球走），按钮在容器里就自动跟着跑，
        首页和板块内都不用各写一套定位。
        用户要求：「放在导航栏下面，即使进入板块内也正常显示，
        按钮可以小一点与导航栏目对齐」。
      */}
      <ResumeDownload compact />
    </nav>
  )
}
