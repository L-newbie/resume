import { useEffect, useRef } from 'react'

/**
 * 自定义光标：一个小圆点 + 一个滞后的描边环。
 *
 * 交互细节：
 *   · 环用缓动跟随，产生「拖尾」的重量感
 *   · 悬停可点击元素时环放大、点缩小（磁吸感）
 *   · 全程走 transform，不触发重排；不进 React 状态，零重渲染
 *
 * 只在有精确指针（鼠标）的设备上挂载 —— 触屏没有光标概念。
 */
export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 触屏 / 无鼠标设备直接不启用
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    const target = { x: innerWidth / 2, y: innerHeight / 2 }
    const ringPos = { ...target }
    let hovering = false
    let visible = false
    let raf = 0

    const onMove = (e: MouseEvent) => {
      target.x = e.clientX
      target.y = e.clientY
      if (!visible) {
        visible = true
        dot.style.opacity = '1'
        ring.style.opacity = '1'
      }
      // 命中可点击元素 → 放大环。
      // 人体 canvas 不是 a/button，但悬停到可点部位时 SceneLayer 会给它
      // 加 .is-hot —— 一并算作可点，否则点人体时光标毫无反馈。
      const el = e.target as HTMLElement
      const hit =
        !!el.closest?.('a, button, [role="button"]') ||
        !!el.closest?.('.scene-canvas.is-hot')
      if (hit !== hovering) {
        hovering = hit
        ring.classList.toggle('is-hover', hit)
        dot.classList.toggle('is-hover', hit)
      }
    }

    const onLeave = () => {
      visible = false
      dot.style.opacity = '0'
      ring.style.opacity = '0'
    }

    const tick = () => {
      raf = requestAnimationFrame(tick)
      // 点直接跟手，环滞后 —— 差速产生拖尾
      dot.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`
      /*
        跟随速度。0.16 → 0.35：到达 90% 从 14 帧(233ms) 缩短到 6 帧(100ms)。
        ⚠️ 233ms 远超人眼可察觉的延迟阈值（约 100ms），体感上是「环在追鼠标」。
        再快就几乎没有拖尾了，那样光标环存在的意义（软化指针运动）也没了。
      */
      ringPos.x += (target.x - ringPos.x) * 0.35
      ringPos.y += (target.y - ringPos.y) * 0.35
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('mouseleave', onLeave)
    raf = requestAnimationFrame(tick)
    document.body.classList.add('has-cursor')

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      document.body.classList.remove('has-cursor')
    }
  }, [])

  return (
    <>
      <div ref={ringRef} className="cursor-ring" aria-hidden="true" />
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
    </>
  )
}
