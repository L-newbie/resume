import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store'
import { usePointer } from '../lib/hooks'
import type { Capability } from '../lib/capability'
import { OrbScene } from '../three/OrbScene'
import { Panes } from './Panes'
import { OrbNav } from './OrbNav'
import { PhotoBadge } from './PhotoBadge'

/**
 * 3D 球体层。
 *
 * 被 React.lazy 包起来 —— three.js 不进首屏分包。
 * 组件本身几乎不渲染东西，只负责：
 *   建 canvas → 起场景 → 每帧喂状态 → 卸载时清理
 *
 * 它订阅 active/hover（都是低频事件），
 * 指针状态走 ref，不触发重渲染。
 */
export default function SceneLayer({ cap }: { cap: Capability }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { target, smooth } = usePointer()
  const markReady = useApp((s) => s.markReady)
  const [scene, setScene] = useState<OrbScene | null>(null)

  // 渲染循环每帧读这些值，不能靠闭包捕获某一次渲染的快照
  const active = useApp((s) => s.active)
  const hover = useApp((s) => s.hover)
  const stateRef = useRef({ active, hover })
  stateRef.current = { active, hover }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let sc: OrbScene
    try {
      sc = new OrbScene(canvas, cap)
    } catch (err) {
      // WebGL 建 context 失败（显存耗尽、驱动问题）→ 静默降级到 CSS 背景
      console.warn('[orb] WebGL init failed, falling back:', err)
      markReady()
      return
    }

    /*
      每帧把外部状态喂进场景。

      ⚠️ 缓动必须按**时间**算，不能按帧数。
      原来是每帧 `* 0.06`：60fps 下到达 90% 要 37 帧（620ms），
      而在 30fps 的机器上同样的 37 帧变成 1.2 秒 —— 机器越慢越黏手。
      改成 1 − e^(−dt/τ) 之后，不管多少帧率，响应时间都是 τ 决定的。

      ⚠️ τ 从等效的 0.27s 收到 0.07s。这一路缓动是**串联**的：
      指针先平滑一次，OrbScene 里相机视差再缓动一次，
      两段加起来原本接近 1.4 秒 —— 用户说的「鼠标移动有延迟」就是它。
      不能直接去掉平滑：原始的 mousemove 抖动会让球一颤一颤的。
    */
    let raf = 0
    let last = performance.now()
    const feed = () => {
      raf = requestAnimationFrame(feed)
      const now = performance.now()
      // 切后台回来时 dt 会是好几秒，钳一下免得指针「瞬移」
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const k = 1 - Math.exp(-dt / 0.07)
      smooth.current.x += (target.current.x - smooth.current.x) * k
      smooth.current.y += (target.current.y - smooth.current.y) * k
      const s = stateRef.current
      sc.update({
        active: s.active,
        hover: s.hover,
        pointer: smooth.current,
      })
    }
    feed()
    sc.start()
    setScene(sc)
    markReady()

    const onResize = () => sc.resize()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)

    // ── 拖拽旋转 ──
    // 绑在 canvas 上而不是 window：小屏是 canvas 之上的独立 DOM，
    // 在小屏上按下不该触发球体旋转。
    let dragDist = 0
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (!sc.dragStart(e.clientX, e.clientY)) return
      dragDist = 0
      canvas.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      dragDist += sc.dragMove(e.clientX, e.clientY)
      // 拖过 4px 才算真拖拽 —— 手抖的几像素不该换光标
      if (dragDist > 4) canvas.classList.add('is-dragging')
    }
    const onUp = (e: PointerEvent) => {
      sc.dragEnd()
      canvas.classList.remove('is-dragging')
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
      // 没怎么移动 = 这是一次点击而不是拖拽 → 试着在海面上放个事件。
      // 阈值和上面「算不算拖拽」的判定用同一个（4px），
      // 两边不一致的话会出现「既算拖拽又算点击」的重叠区间。
      if (dragDist <= 4) {
        /*
          点击优先级：先判「是不是点在球上且当前正开着板块」——
          那种情况下点球 = 返回大球状态。
          ⚠️ 必须在 hitOcean 之前判：球缩到左上角后仍然可点，
          先跑 hitOcean 的话点球会变成「在小球上放一个台风」。
        */
        const st = useApp.getState()
        if (st.active >= 0 && sc.hitOrb(e.clientX, e.clientY)) {
          st.close()
        } else {
          sc.hitOcean(e.clientX, e.clientY)
        }
      }
      dragDist = 0
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)

    // ── 「鼠标是否在球上」的判定 ──
    // 必须绑在 window 而不是 canvas：小屏和 HUD 都盖在 canvas 之上，
    // 鼠标移到它们上面时 canvas 收不到 pointermove，
    // overOrb 就会卡在最后一次的值 —— 球会莫名其妙一直停着不转。
    // 绑 window 才能全程跟踪，移出球体范围立刻恢复巡航。
    const onWinMove = (e: PointerEvent) => sc.setPointerOverOrb(e.clientX, e.clientY)
    const onWinLeave = () => sc.clearPointerOverOrb()
    window.addEventListener('pointermove', onWinMove, { passive: true })
    document.addEventListener('pointerleave', onWinLeave)

    // 标签页切到后台时停掉渲染 —— 省电，手机上尤其重要
    const onVisibility = () => {
      if (document.hidden) sc.stop()
      else sc.start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      window.removeEventListener('pointermove', onWinMove)
      document.removeEventListener('pointerleave', onWinLeave)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      setScene(null)
      sc.dispose()
    }
    // cap 变化（跨设备档位）时整体重建场景
  }, [cap, markReady, target, smooth])

  return (
    <>
      <canvas ref={canvasRef} className="orb-canvas" aria-hidden="true" />
      {scene && <Panes scene={scene} />}
      {scene && <OrbNav scene={scene} />}
      {/* 球面弧形照片的原件 —— 只在首页显示，跟着球转到哪块换图 */}
      <PhotoBadge scene={scene} />
    </>
  )
}
