import { useEffect, useRef, useState } from 'react'
import { getCapability, refreshCapability, type Capability } from './capability'
import { useApp } from './store'
import { SECTION_COUNT } from '../content/sections'

/**
 * 键盘导航。
 *
 * 页面本身不滚动，所以方向键是空闲的：
 *   ← →  切板块（打开状态下）/ 打开第一个（球体状态下）
 *   ESC  返回球体
 *   1–6  直接跳到对应板块
 */
export function useKeyNav() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 输入框里不拦（当前没有，但以后加了搜索/表单就会踩坑）
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const { active, open, close } = useApp.getState()

      // 数字键直达
      if (e.key >= '1' && e.key <= String(Math.min(9, SECTION_COUNT))) {
        e.preventDefault()
        open(Number(e.key) - 1)
        return
      }

      switch (e.key) {
        case 'Escape':
          if (active >= 0) {
            e.preventDefault()
            close()
          }
          break
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          open(active < 0 ? 0 : (active + 1) % SECTION_COUNT)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          open(active < 0 ? SECTION_COUNT - 1 : (active - 1 + SECTION_COUNT) % SECTION_COUNT)
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/**
 * 指针位置，归一化到 [-1, 1]，带缓动。
 * 鼠标和触摸都走同一条路径 —— 手机上手指拖动同样能推动球体视差。
 * 返回 ref 而不是 state：3D 每帧读它，不能触发 React 重渲染。
 */
export function usePointer() {
  const target = useRef({ x: 0, y: 0 })
  const smooth = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const set = (cx: number, cy: number) => {
      target.current.x = (cx / window.innerWidth) * 2 - 1
      target.current.y = -((cy / window.innerHeight) * 2 - 1)
    }
    const onMouse = (e: MouseEvent) => set(e.clientX, e.clientY)
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) set(t.clientX, t.clientY)
    }
    const onLeave = () => {
      // 归位到中心，视差平滑消散
      target.current.x = 0
      target.current.y = 0
    }
    window.addEventListener('mousemove', onMouse, { passive: true })
    window.addEventListener('touchmove', onTouch, { passive: true })
    window.addEventListener('touchstart', onTouch, { passive: true })
    window.addEventListener('touchend', onLeave, { passive: true })
    document.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('touchstart', onTouch)
      window.removeEventListener('touchend', onLeave)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return { target, smooth }
}

/**
 * 设备能力，跨断点时自动重算。
 * 用 250ms 防抖 —— 拖窗口 / 转屏时不要疯狂重建粒子系统。
 */
export function useCapability(): Capability {
  const [cap, setCap] = useState<Capability>(() => getCapability())
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const onResize = () => {
      clearTimeout(t)
      t = setTimeout(() => {
        const next = refreshCapability()
        // 只有档位真的变了才更新，避免无谓重渲染
        setCap((prev) => (prev.tier === next.tier ? prev : next))
      }, 250)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])
  return cap
}

/** 真实视口高度 —— 移动端浏览器地址栏会吃掉 100vh，用 CSS 变量 --vh 兜底 */
export function useViewportUnitFix() {
  useEffect(() => {
    const set = () => {
      document.documentElement.style.setProperty(
        '--vh',
        `${window.innerHeight * 0.01}px`
      )
    }
    set()
    window.addEventListener('resize', set)
    window.addEventListener('orientationchange', set)
    return () => {
      window.removeEventListener('resize', set)
      window.removeEventListener('orientationchange', set)
    }
  }, [])
}

/**
 * 打字机效果 —— 把 text 一个字一个字吐出来。
 *
 * @param text   要打的完整文本。**变了就从头重打**（这正是切换卡片时要的）。
 * @param cps    每秒多少字。中文信息密度高，默认给得快一些。
 * @param enabled 关掉时直接返回完整文本（用于减少动效 / 首屏之外的场景）
 *
 * ⚠️ 用 rAF 累计时间推进游标，不是 setInterval(1000/cps)。
 * setInterval 在低帧率或后台标签页会漂移，而且每字一个定时器很吵；
 * rAF 里按 dt 累加，掉帧时会一次多吐几个字，总时长仍然对得上。
 *
 * ⚠️ 返回的是**切片**而不是逐字拼接的字符串 —— 拼接会在每帧产生
 * 新的中间字符串，长文本下是没必要的垃圾。
 */
export function useTypewriter(text: string, cps = 42, enabled = true): string {
  const [n, setN] = useState(() => (enabled ? 0 : text.length))

  useEffect(() => {
    if (!enabled) {
      setN(text.length)
      return
    }
    // 系统要求减少动效时不打字，直接给全文
    if (
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setN(text.length)
      return
    }

    setN(0)
    let raf = 0
    let prev = performance.now()
    let acc = 0
    const step = (now: number) => {
      const dt = Math.min(now - prev, 100) // 切后台回来时钳一下，别一次吐完
      prev = now
      acc += (dt / 1000) * cps
      const k = Math.min(text.length, Math.floor(acc))
      setN(k)
      if (k < text.length) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [text, cps, enabled])

  return text.slice(0, n)
}
