import { useState } from 'react'
import { SKILLS } from '../../content/data'
import { tag } from '../../content/types'
import { useApp } from '../../lib/store'

/**
 * 01 能力 —— 四个能力域 + 标签卡，移入卡片展开详情。
 *
 * ⚠️ 原来底部另有「三条优势」（跨域可迁移 / 从数据到结论 / 工具化的
 * 习惯）独占一块。那三条讲的就是各项技能背后的判断，和标签是同一件事
 * 说两遍 —— 现在全部融进各标签卡的 detail 里：想知道为什么强，
 * 移到那张卡上就是了，不必再读一段总结。
 *
 * 四个域对应重点方向：
 * AI/大模型 · 视觉与生成式模型 · 数据挖掘闭环 · 代码交付。
 */
export function SkillsPanel() {
  const lang = useApp((s) => s.lang)
  const [sel, setSel] = useState(0)
  /** 当前展开详情的技能索引，-1 = 没有 */
  const [open, setOpen] = useState(-1)
  const g = SKILLS[sel]
  /** 当前要显示的详情文本；没有移入任何标签时为 null */
  const shown = open >= 0 ? (g.items[open]?.detail ?? null) : null

  return (
    <div className="pl-skills">
      {/* ── 四个能力域 ── */}
      <ul className="sk-domains" role="tablist">
        {SKILLS.map((d, i) => (
          <li key={i} role="presentation">
            <button
              role="tab"
              aria-selected={i === sel}
              className={`sk-domain${i === sel ? ' is-on' : ''}`}
              // 移入即切换，点击/聚焦同样生效
              onMouseEnter={() => {
                setSel(i)
                setOpen(-1) // 换域时收起上一域残留的详情
              }}
              onFocus={() => {
                setSel(i)
                setOpen(-1)
              }}
              onClick={() => setSel(i)}
            >
              <span className="sk-dm-no hud-mono">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="sk-dm-label">{d.label[lang]}</span>
              <span className="sk-dm-n hud-mono">{d.items.length}</span>
              <span className="sk-dm-bar" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {/* ── 当前域：一句话 + 标签卡。key 换了重挂 → 淡入 ── */}
      <div className="sk-body" key={sel}>
        {g.caption && <p className="sk-caption">{g.caption[lang]}</p>}

        <ul
          className="sk-tags"
          // 整组监听移出：逐张卡监听的话，鼠标从一张移到相邻
          // 一张的缝隙时详情会闪一下
          onMouseLeave={() => setOpen(-1)}
        >
          {g.items.map((it, i) => (
            <li key={i} className="sk-tagli">
              <button
                type="button"
                className={`sk-tag${it.key ? ' is-key' : ''}${i === open ? ' is-open' : ''}`}
                style={{ animationDelay: `${i * 45}ms` }}
                onMouseEnter={() => setOpen(i)}
                onFocus={() => setOpen(i)}
                // 触屏没有 hover：点击切换展开
                onClick={() => setOpen(i === open ? -1 : i)}
                aria-expanded={it.detail ? i === open : undefined}
              >
                {/*
                  ⚠️ 只显示名称，不显示 note。
                  note 是各项长短不一的短说明，挂在卡片上会让每张卡
                  高矮不齐、UI 不统一；而它要传达的信息在 detail 里
                  已经完整覆盖（移入即见）。
                  note 字段保留在数据里，供将来别处使用。
                */}
                <span className="sk-tag-name">{tag(it.name, lang)}</span>
              </button>

            </li>
          ))}
        </ul>

        {/*
          详情区。

          ⚠️ **始终占位**，只有内容的可见性在变 —— 这是关键。
          .sheet 是 top:50% + translateY(-50%) 纵向居中的，高度增加 H
          就会整体上移 H/2。所以只要这块「从无到有」，整个面板就会
          向上顶一下，页面布局跟着变。
          让它常驻占位（高度由 CSS 的 min-height 锁死），展开动画只作用于
          内部文字的裁剪，容器高度自始至终不变，布局纹丝不动。

          ⚠️ 也不能用绝对定位的浮层：absolute 虽不占父级布局，
          但溢出部分仍计入滚动容器的 scrollHeight，同样会撑高 .sh-body。
        */}
        <div className={`sk-detail${shown ? ' is-on' : ''}`}>
          {shown && (
            <p className="sk-dt-text" key={`${sel}-${open}`}>
              {shown[lang]}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
