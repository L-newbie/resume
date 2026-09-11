import { useState } from 'react'
import { AVAILABILITY, IDENTITY, METRICS } from '../../content/data'
import { useApp } from '../../lib/store'
import { useTypewriter } from '../../lib/hooks'

/**
 * 00 个人信息 —— 头像、身份、关键数字。
 *
 * 布局：
 *   上半  头像 | 身份信息（左右两列）
 *   下半  四张数字卡片横排，鼠标移入时横条在其**下方向下展开**
 *
 * 横条不参与网格布局（绝对定位）—— 它展开时如果撑开容器，
 * 整个面板的高度会跟着变，居中的 sheet 会上下跳。
 */
export function HeroPanel() {
  const lang = useApp((s) => s.lang)
  const name = IDENTITY.name[lang]

  /** 当前指着第几张卡片，-1 = 没指 */
  const [active, setActive] = useState(-1)
  const shown = active >= 0 ? METRICS[active] : null

  return (
    <div className="pl-hero">
      {/* ── 上半：头像 | 身份信息 ── */}
      <div className="ph-top">
        <figure className="ph-photo">
          <img
            src={`${import.meta.env.BASE_URL}${IDENTITY.photo}`}
            alt={name}
            width={600}
            height={450}
            loading="eager"
          />
          {/* 四角检测标记 + 扫描线，和小屏是同一套语言 */}
          <span className="pn-corner tl" />
          <span className="pn-corner tr" />
          <span className="pn-corner bl" />
          <span className="pn-corner br" />
          <span className="pn-scan" aria-hidden="true" />
        </figure>

        <div className="ph-id">
          <h3 className="ph-name" aria-label={name}>
            {Array.from(name).map((ch, i) => (
              <span
                key={i}
                className="ph-char"
                style={{ animationDelay: `${0.1 + i * 0.06}s` }}
                aria-hidden="true"
              >
                {ch}
              </span>
            ))}
          </h3>

          {/*
            职位 + 求职状态并成一行。
            职位做成检测框的 class 标签，CONF 0.99 是仿感知模型输出的
            置信度读数（如 person 0.98），纯视觉玩笑。
            状态徽标跟在同一行末尾 —— 两者都是「这个人现在是什么」，
            拆成上下两行反而把一条信息切断了。
          */}
          <div className="ph-role">
            <span className="ph-role-tag" title="detection confidence">
              {IDENTITY.role[lang]}
              <b>CONF 0.99</b>
            </span>

            {AVAILABILITY?.open && (
              <div className="badge-open">
                <i className="pulse" />
                <span className="hud-mono">{AVAILABILITY.label[lang]}</span>
                <em>{AVAILABILITY.detail[lang]}</em>
              </div>
            )}
          </div>

          {/* 事实清单 —— 头像右侧空间很大，用一列读数把它填实。
              这些是「一眼看完就知道是谁」的信息，不需要点开。 */}
          <dl className="ph-facts">
            <div className="ph-fact">
              <dt className="hud-mono">{lang === 'zh' ? '坐标' : 'LOC'}</dt>
              <dd>{IDENTITY.location[lang]}</dd>
            </div>
            <div className="ph-fact">
              <dt className="hud-mono">{lang === 'zh' ? '经验' : 'EXP'}</dt>
              <dd>
                {lang === 'zh'
                  ? `${METRICS[0]?.value ?? '7'} 年数据一线`
                  : `${METRICS[0]?.value ?? '7'} yrs on the data line`}
              </dd>
            </div>
            {/*
              学历。从工作经历时间轴挪过来 —— 它属于「你是谁」，
              混在工作时间轴里会打断「这段时间在哪工作」这条主线
              （在职读的学历尤其：它和工作是并行的，不是接续的）。
              只显示学校 + 专业，不写年份（见 data.ts 的说明）。
            */}
            {IDENTITY.education?.map((e, i) => (
              <div key={i} className="ph-fact">
                <dt className="hud-mono">
                  {i === 0 ? (lang === 'zh' ? '学历' : 'EDU') : ''}
                </dt>
                <dd className="ph-edu">
                  {/* 学校和专业连成一行，用 · 分隔 —— 拆成两行会让
                      这一条比上面的坐标、经验重出一档，喧宾夺主 */}
                  {e.school[lang]} · {e.degree[lang]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* ── 下半：四张卡片横排 + 卡片下方向下展开的横条 ── */}
      {METRICS.length > 0 && (
        <div
          className="ph-stats"
          // 整组一起监听移出：逐张卡片监听的话，
          // 鼠标从一张移到相邻一张的缝隙时横条会闪一下
          onMouseLeave={() => setActive(-1)}
        >
          <ul className="ph-cards" role="tablist">
            {METRICS.map((m, i) => (
              <li key={i} role="presentation" className="ph-cardli">
                <button
                  type="button"
                  role="tab"
                  id={`ph-tab-${i}`}
                  aria-selected={i === active}
                  aria-controls="ph-flyout"
                  className={`ph-card${i === active ? ' is-on' : ''}`}
                  // 触屏没有 hover：focus / click 也要能触发
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                >
                  <span className="ph-card-no hud-mono">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <b className="ph-card-v">{m.value}</b>
                  <span className="ph-card-k">{m.label[lang]}</span>
                  {/* 指向下方横条的小三角，选中时滑出 */}
                  <i className="ph-card-arrow" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          {/*
            横条在卡片**下方**，向下展开。
            key={active} 让它每次切换都重挂 —— 打字机才会从头开始。
          */}
          {shown && (
            <Flyout
              key={active}
              index={active}
              value={shown.value}
              label={shown.label[lang]}
              text={shown.detail[lang]}
            />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 从右向左飞出的详情横条。
 *
 * 独立成组件是为了 key={active} 能真正重挂载 —— 打字机 hook 的
 * 状态要跟着重置，否则换标签时会接着上一条的进度继续打。
 *
 * top 跟着当前标签走，横条和标签水平对齐，指哪条弹哪条。
 */
function Flyout({
  index,
  value,
  label,
  text,
}: {
  index: number
  value: string
  label: string
  text: string
}) {
  /*
    打字速度按文本长度反推，而不是给一个固定的字/秒。
    ⚠️ 固定速度在双语站点上必然有一头不合适：同一条描述中文 71 字、
    英文 242 字，按 42 字/秒中文 1.7 秒打完，英文要 5.8 秒 ——
    长到用户已经读完在等光标了。
    这里固定**总时长**约 1.7 秒，速度自适应；再钳一个上下限，
    免得极短的文本一闪而过、极长的糊成一片。
  */
  const cps = Math.min(150, Math.max(28, Math.round(text.length / 1.7)))
  const typed = useTypewriter(text, cps)
  const done = typed.length >= text.length

  return (
    <div
      className="ph-flyout"
      id="ph-flyout"
      role="tabpanel"
      aria-labelledby={`ph-tab-${index}`}
    >
      <b className="ph-flyout-v">{value}</b>
      <div className="ph-flyout-text">
        <span className="ph-flyout-k hud-mono">{label}</span>
        {/*
          aria-live 让读屏在内容变化时播报；但打字过程中逐字播报会很吵，
          所以打完之前不播报（aria-busy），打完再交出去。
        */}
        <p className="ph-flyout-d" aria-busy={!done}>
          {typed}
          {!done && <i className="ph-caret" aria-hidden="true" />}
        </p>
      </div>
    </div>
  )
}
