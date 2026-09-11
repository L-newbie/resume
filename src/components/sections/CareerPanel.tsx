import { useState } from 'react'
import { TIMELINE, UI } from '../../content/data'
import { tag } from '../../content/types'
import { useApp } from '../../lib/store'

/**
 * 02 工作经历 —— 一条贯穿的曲线，节点是公司。
 *
 * 曲线用 SVG 画（三次贝塞尔），节点按时间**从左到右**均分在曲线上，
 * 纵坐标跟着曲线起伏 —— 比一条直线更像「一段有起落的路径」。
 *
 * 移入或点击节点展开该段内容；移出不收起 ——
 * 停在最后看过的那段，比弹回默认态更符合预期。
 *
 * ⚠️ 节点坐标必须和曲线用**同一组控制点**算（见 CURVE / pointOnCurve），
 * 否则节点会浮在曲线旁边而不是长在上面。
 */
export function CareerPanel() {
  const lang = useApp((s) => s.lang)

  /*
    ⚠️ TIMELINE 是**倒序**的（最新的在前，符合简历惯例），
    但曲线要按时间从左到右走，所以这里反转一份用于渲染。
    不去改 TIMELINE 本身 —— 别处（小屏读数）依赖它的倒序。
  */
  const items = [...TIMELINE].reverse()

  // 默认选中「进行中」那段；没有就选最后一段（时间上最新）
  const firstCurrent = items.findIndex((e) => e.current)
  const [sel, setSel] = useState(
    firstCurrent >= 0 ? firstCurrent : items.length - 1
  )
  const e = items[sel]

  const n = items.length
  // 节点在曲线上的参数位置：两端各留 12% 边距，中间均分
  const ts = items.map((_, i) => (n === 1 ? 0.5 : 0.12 + (i / (n - 1)) * 0.76))

  return (
    <div className="pl-career">
      {/* ── 曲线时间轴 ── */}
      <div className="cr-curve">
        <svg
          className="cr-svg"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          /* ⚠️ 不能用 preserveAspectRatio="none" —— 那会把描边
             连同曲线一起横向拉伸，线宽在两端和中间不一致，很脏。
             用 slice 保持比例，容器再按 aspect-ratio 控高。 */
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          {/* 底层：完整曲线，很淡 */}
          <path className="cr-track" d={CURVE_D} />
          {/* 高亮层：从起点画到当前节点，dash 动画表示「走到这里」 */}
          <path
            className="cr-progress"
            d={CURVE_D}
            style={{
              // pathLength 归一到 1，直接用参数值当作已走过的比例
              strokeDasharray: 1,
              strokeDashoffset: 1 - ts[sel],
            }}
            pathLength={1}
          />
        </svg>

        {/* 节点。绝对定位在曲线上，用百分比 → 跟着容器缩放 */}
        <ul className="cr-nodes">
          {items.map((it, i) => {
            const p = pointOnCurve(ts[i])
            return (
              <li
                key={i}
                className="cr-nodeli"
                style={{
                  left: `${(p.x / VB_W) * 100}%`,
                  top: `${(p.y / VB_H) * 100}%`,
                }}
              >
                <button
                  className={`cr-node${i === sel ? ' is-on' : ''}${it.current ? ' is-current' : ''}`}
                  // 移入即切换，点击同样生效（触屏和键盘用得上）
                  onMouseEnter={() => setSel(i)}
                  onFocus={() => setSel(i)}
                  onClick={() => setSel(i)}
                  aria-current={i === sel}
                >
                  <span className="cr-dot" aria-hidden="true" />
                  <span className="cr-node-text">
                    <span className="cr-node-year hud-mono">
                      {startYear(it.period[lang])}
                    </span>
                    <span className="cr-node-org">{it.orgShort[lang]}</span>
                    <span className="cr-node-brief">{it.brief[lang]}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* ── 当前这段的内容。key 换了重挂 → 切换时淡入 ── */}
      <article className="cr-panel" key={sel}>
        <header className="cr-head">
          <div className="cr-meta">
            <span className="cr-period hud-mono">{e.period[lang]}</span>
            {e.current && (
              <span className="cr-active">
                <i className="pulse" />
                {UI.active[lang]}
              </span>
            )}
          </div>
          <h4 className="cr-org">{e.org[lang]}</h4>
          <p className="cr-role">{e.role[lang]}</p>
        </header>

        <p className="cr-summary">{e.summary[lang]}</p>

        <ul className="cr-points">
          {e.points[lang].map((p, pi) => (
            <Point key={pi} index={pi} text={p} />
          ))}
        </ul>

        {e.stack && e.stack.length > 0 && (
          <footer className="cr-stack">
            <span className="cr-stack-label hud-mono">
              {UI.stackLabel[lang]}
            </span>
            <div className="chips">
              {e.stack.map((t, ti) => (
                <span key={ti} className="chip">
                  {tag(t, lang)}
                </span>
              ))}
            </div>
          </footer>
        )}
      </article>
    </div>
  )
}

// ── 曲线几何 ────────────────────────────────────────────────
//
// 一条三次贝塞尔。viewBox 是抽象坐标系，按比例缩放到容器
//（preserveAspectRatio 保持比例），所以这里的数值只表达形状。
// 容器用 aspect-ratio 锁住 1000:120 的比例，两者要一致。

const VB_W = 1000
const VB_H = 120
/** 起点、两个控制点、终点 */
const P0 = { x: 0, y: 88 }
const C1 = { x: 260, y: 96 }
const C2 = { x: 620, y: 8 }
const P3 = { x: 1000, y: 34 }

const CURVE_D = `M ${P0.x} ${P0.y} C ${C1.x} ${C1.y}, ${C2.x} ${C2.y}, ${P3.x} ${P3.y}`

/**
 * 三次贝塞尔在参数 t 处的点。
 *
 * ⚠️ 节点定位必须走这个函数 —— 用 SVG 的 getPointAtLength 更准，
 * 但那需要拿到真实 DOM 节点并在布局后测量，会引入一次额外渲染；
 * 这里节点只有三五个，直接算参数式足够，且服务端/测试环境也能算。
 *
 * 注意 t 是**参数**而非弧长比例，两者在曲率大的地方会有偏差。
 * 当前曲线平缓，偏差不可见；曲线改陡时若发现节点分布不均，
 * 需要改成按弧长采样。
 */
function pointOnCurve(t: number) {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return {
    x: a * P0.x + b * C1.x + c * C2.x + d * P3.x,
    y: a * P0.y + b * C1.y + c * C2.y + d * P3.y,
  }
}

/** 从 '2021.11 — 2024.10' 里取出起始年份 '2021' */
function startYear(period: string): string {
  const m = period.match(/\d{4}/)
  return m ? m[0] : period.slice(0, 4)
}

/**
 * 一条要点。
 *
 * 内容里用 `小标题 —— 说明` 的写法，这里拆成上下两行 ——
 * 同一行加粗时小标题会被后面几十个字淹没，等于没有标题。
 *
 * ⚠️ 只切第一个 `——`：正文里也可能有破折号（中文行文常用）。
 */
function Point({ index, text }: { index: number; text: string }) {
  const i = text.indexOf(' —— ')
  const no = String(index + 1).padStart(2, '0')

  if (i < 0) {
    return (
      <li className="cr-point">
        <span className="cr-point-no hud-mono">{no}</span>
        <span className="cr-point-body">{text}</span>
      </li>
    )
  }

  return (
    <li className="cr-point">
      <span className="cr-point-no hud-mono">{no}</span>
      <span className="cr-point-body">
        <b className="cr-point-key">{text.slice(0, i)}</b>
        <span className="cr-point-desc">{text.slice(i + 4)}</span>
      </span>
    </li>
  )
}
