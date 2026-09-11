import { useEffect, useRef, useState } from 'react'
import { sectionPhoto } from '../content/data'
import { SECTIONS } from '../content/sections'
import { useApp } from '../lib/store'
import type { OrbScene } from '../three/OrbScene'

/**
 * 左上角的原图小图 —— 球面上那张弧形照片的「原件」。
 *
 * 球面那张被弯曲、压暗、掺了板块主色，看不清本来的样子；
 * 这里给一张未经处理的原图做参照，两者始终是同一张。
 *
 * 交互：移入即放大预览，移出复原；点击**锁定**放大（再点或按 ESC 收起）。
 * ⚠️ 两者都要有 —— 只做 hover 的话触屏和键盘用户完全用不了；
 * 只做 click 的话鼠标用户得多点一次才能看清。
 *
 * ⚠️ 跟着**球转到哪块**换图，而不是跟着「打开了哪个板块」——
 * 它只在首页显示，那时根本没有打开的板块。
 *
 * ⚠️ 进入板块后不显示：那时球已经缩到角落、右侧是内容面板，
 * 再挂一张图只会和面板抢注意力。
 */
export function PhotoBadge({ scene }: { scene: OrbScene | null }) {
  const active = useApp((s) => s.active)
  const lang = useApp((s) => s.lang)
  /** 球当前正对的板块 —— 决定显示哪张照片 */
  const [face, setFace] = useState(0)
  /** 鼠标是否停在上面 */
  const [hover, setHover] = useState(false)
  /** 是否点击锁定了放大 */
  const [locked, setLocked] = useState(false)

  /*
    订阅「球转到哪一块」。
    ⚠️ 用 onFaceChange 而不是 onFocus：后者要等相机停稳才发，
    手动拖球时图会一直停在拖动前那张。
    ⚠️ 链式包装 —— 这两个回调都是单个引用，直接赋值会覆盖别处的订阅。
  */
  useEffect(() => {
    if (!scene) return
    const prev = scene.onFaceChange
    scene.onFaceChange = (i) => {
      prev?.(i)
      setFace(i)
    }
    return () => {
      scene.onFaceChange = prev
    }
  }, [scene])

  // 锁定放大时按 ESC 收起
  useEffect(() => {
    if (!locked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setLocked(false)
      }
    }
    // 捕获阶段：抢在别处的 ESC 之前，否则会连带触发其它关闭逻辑
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [locked])

  // 切板块时收起锁定 —— 图都换了，还锁着上一张的放大态很怪
  const faceRef = useRef(face)
  useEffect(() => {
    if (faceRef.current !== face) {
      faceRef.current = face
      setLocked(false)
    }
  }, [face])

  // 打开板块时整个不渲染
  if (active >= 0) return null

  const src = sectionPhoto(face)
  if (!src) return null

  const label = SECTIONS[face]?.label[lang] ?? ''
  const big = hover || locked

  return (
    <>
      {/*
        放大时的背景遮罩。
        ⚠️ 条件是 big（hover 或 locked）而不是只有 locked ——
        移入和点击的效果要一致，只给点击加遮罩的话两种方式看起来
        完全是两回事。
        ⚠️ hover 态的遮罩必须 pointer-events:none：它铺满全屏，
        能接收鼠标的话会立刻夺走 badge 的 hover，变成
        「放大→遮罩出现→鼠标离开 badge→收起」的闪烁死循环。
      */}
      {big && (
        <div
          className={`pb-scrim${locked ? ' is-locked' : ''}`}
          onClick={locked ? () => setLocked(false) : undefined}
          aria-hidden="true"
        />
      )}

      <figure
        className={`photo-badge${big ? ' is-big' : ''}${locked ? ' is-locked' : ''}`}
      >
        <button
          type="button"
          className="pb-hit"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onFocus={() => setHover(true)}
          onBlur={() => setHover(false)}
          onClick={() => setLocked((v) => !v)}
          aria-label={
            lang === 'zh' ? `${label} · 影像，点击放大` : `${label} image, click to enlarge`
          }
          aria-expanded={locked}
        >
          {/*
            ⚠️ 这里**不加 key**，也不做切换动画。
            球面上那张已经有交叉淡入了；小图是「原件」，
            职责是随时给出当前板块的清晰参照 ——
            它再来一次动画只是重复，反而让人分神。
            换 src 时浏览器直接换图，瞬时生效。
          */}
          <img
            src={`${import.meta.env.BASE_URL}${src}`}
            alt=""
            loading="lazy"
            draggable={false}
          />
          {/* 四角检测标记 + 扫描线，和小屏、头像是同一套语言 */}
          <span className="pn-corner tl" />
          <span className="pn-corner tr" />
          <span className="pn-corner bl" />
          <span className="pn-corner br" />
          <span className="pn-scan" />
          <span className="pb-cap hud-mono">
            {label || (lang === 'zh' ? '影像' : 'IMAGE')}
          </span>
        </button>
      </figure>
    </>
  )
}
