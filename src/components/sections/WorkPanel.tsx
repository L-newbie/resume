import { useEffect, useRef, useState } from 'react'
import { PROJECTS, UI } from '../../content/data'
import { useApp } from '../../lib/store'
import { tag } from '../../content/types'
import type { Project, ProjectSection } from '../../content/types'
import { IconArrow, IconClose } from '../Icons'

/**
 * 03 项目 —— 逐级下钻的关系树 + 详情层。
 *
 * ⚠️ 不一次把所有卡片铺出来。三级内容同屏堆叠时，屏幕上是
 * 十几个并列的块，层级关系反而被淹没。改成**逐级下钻**：
 *
 *   第一屏  来源节点（企业项目）
 *   选中后  展开该来源下的分支（企业 → 各公司）
 *   再选中  展开该分支下的项目卡片
 *
 * 左侧始终保留一条已选路径（面包屑式的节点链），
 * 随时能回到上一级重选 —— 树的形状靠「路径 + 当前层」表达，
 * 而不是靠把整棵树画出来。
 *
 * ⚠️ 曾经还有一支「开源项目」分支；唯一的开源项目（基攻宝）
 * 删除后这支只剩空壳，连带拆掉 —— 数据层不再有 kind:'oss' 的项目。
 */
export function WorkPanel() {
  const lang = useApp((s) => s.lang)
  const [openId, setOpenId] = useState<string | null>(null)
  /** 当前下钻到的来源：'internal' | null */
  const [source, setSource] = useState<Src | null>(null)
  /** 当前下钻到的公司 */
  const [company, setCompany] = useState<string | null>(null)

  const open = PROJECTS.find((p) => p.id === openId) ?? null

  const internal = PROJECTS.filter((p) => p.kind === 'internal')

  /** 企业项目按公司分组。Map 保持插入顺序 → 天然是时间序 */
  const companies = new Map<string, typeof PROJECTS>()
  for (const p of internal) {
    const k = p.orgShort[lang]
    const arr = companies.get(k)
    if (arr) arr.push(p)
    else companies.set(k, [p])
  }

  /** 当前这一层要显示的项目卡片；还没钻到底就是 null */
  const shown: typeof PROJECTS | null =
    source === 'internal' && company
      ? (companies.get(company) ?? [])
      : null

  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en)

  return (
    <div className="pl-work">
      {/*
        ⚠️ 打开详情时**整棵树不渲染**（而不是让详情浮在它上面）。

        两个坑都踩过：
        1. 详情曾是 position:absolute; inset:0 贴在树上 —— 高度被树
           撑出的高度锁死，而详情内容比树高约 450px，溢出并重叠。
        2. 改用 `hidden` 属性也没用 —— hidden 只是 UA 样式里的
           display:none，而 .wk-tree 显式写了 display:flex，
           优先级更高，树照样显示。
        直接不渲染最干净：两者互斥，各占自己需要的高度。
      */}
      {!open && (
      <div className="wk-tree">
        {/* ── 已选路径 ── */}
        <nav className="wk-path" aria-label={t('层级', 'Hierarchy')}>
          <button
            className={`wk-node is-root${source === null ? ' is-on' : ''}`}
            onClick={() => {
              setSource(null)
              setCompany(null)
            }}
          >
            <span className="wk-node-dot" aria-hidden="true" />
            {t('全部项目', 'All Projects')}
            <span className="wk-node-n hud-mono">
              {String(PROJECTS.length).padStart(2, '0')}
            </span>
          </button>

          {source && (
            <>
              <span className="wk-path-link" aria-hidden="true" />
              <button
                className={`wk-node${!company ? ' is-on' : ''}`}
                /*
                  ⚠️ 点这个节点在没有 company 时等于什么都没发生。
                  改为退回上一级（根）—— 每个可点的节点都必须有实际去处。
                */
                onClick={() => {
                  if (company) setCompany(null)
                  else setSource(null)
                }}
              >
                <span className="wk-node-dot" aria-hidden="true" />
                {t('企业项目', 'Corporate')}
                <span className="wk-node-n hud-mono">
                  {String(internal.length).padStart(2, '0')}
                </span>
              </button>
            </>
          )}

          {/*
            末级节点。它就是当前所在层，点它没有「去处」——
            所以渲染成 span 而不是 button：一个点了没反应的按钮
            比不可点的标签更让人困惑。
          */}
          {company && (
            <>
              <span className="wk-path-link" aria-hidden="true" />
              <span className="wk-node is-on is-current" aria-current="page">
                <span className="wk-node-dot" aria-hidden="true" />
                {company}
                <span className="wk-node-n hud-mono">
                  {String(companies.get(company)?.length ?? 0).padStart(2, '0')}
                </span>
              </span>
            </>
          )}
        </nav>

        {/* ── 当前层 ── */}
        <div className="wk-stage" key={`${source}-${company}`}>
          {/* 第一层：选公司（企业项目是唯一来源，直接铺公司分支） */}
          {source === null && (
            <ul className="wk-branches">
              {[...companies.entries()].map(([name, items]) => (
                <Branch
                  key={name}
                  label={name}
                  sub={`${items[0].period[lang]} — ${items[items.length - 1].period[lang]}`}
                  onClick={() => {
                    setSource('internal')
                    setCompany(name)
                  }}
                />
              ))}
            </ul>
          )}

          {/* 末层：项目卡片 */}
          {shown && <Cards items={shown} lang={lang} onOpen={setOpenId} />}
        </div>
      </div>
      )}

      {open && <Detail project={open} onClose={() => setOpenId(null)} />}
    </div>
  )
}

type Src = 'internal'

/**
 * 树上的一个可下钻分支。
 *
 * ⚠️ 不再有「全息预览」浮层。它悬停时浮出下一层的清单，但那层内容
 * 点进去立刻就能看到 —— 预览等于把同一份信息说两遍，而它的侧向
 * 定位、边界避让、裁剪兜底又带来一堆复杂度和布局风险。
 */
function Branch({
  label,
  sub,
  onClick,
}: {
  label: string
  sub: string
  onClick: () => void
}) {
  return (
    <li className="wk-branch-li">
      <button className="wk-branch" onClick={onClick}>
        <span className="wk-branch-glyph" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="wk-branch-text">
          <span className="wk-branch-label">{label}</span>
          <span className="wk-branch-sub">{sub}</span>
        </span>
        <span className="wk-branch-go" aria-hidden="true">
          <IconArrow />
        </span>
      </button>
    </li>
  )
}

function Cards({
  items,
  lang,
  onOpen,
}: {
  items: typeof PROJECTS
  lang: 'zh' | 'en'
  onOpen: (id: string) => void
}) {
  return (
    <ul className="wk-cards">
      {items.map((p, i) => (
        <li key={p.id} style={{ animationDelay: `${i * 70}ms` }}>
          <button
            className={`wk-card${p.featured ? ' is-featured' : ''}`}
            onClick={() => onOpen(p.id)}
          >
            <span className="wk-card-top">
              <span className="wk-no hud-mono">{p.no}</span>
              <span className="wk-period hud-mono">{p.period[lang]}</span>
            </span>

            <h6 className="wk-card-title">{p.title[lang]}</h6>
            <p className="wk-card-tag">{p.tagline[lang]}</p>

            <span className="wk-card-cta hud-mono">
              {UI.viewProject[lang]}
              <IconArrow />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * 项目详情层。
 *
 * 右侧悬浮按钮切分组，左侧显示当前分组的内容。
 */
function Detail({
  project,
  onClose,
}: {
  project: Project
  onClose: () => void
}) {
  const lang = useApp((s) => s.lang)
  const [secId, setSecId] = useState(project.sections[0]?.id ?? '')
  const sec =
    project.sections.find((s) => s.id === secId) ?? project.sections[0]
  const closeRef = useRef<HTMLButtonElement>(null)

  // ESC 关闭 + 打开时把焦点移到关闭键。
  // 不接管焦点的话，键盘用户按 Tab 会走到详情层背后的卡片上。
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    // 捕获阶段：抢在 SectionPanel 的 ESC 之前处理，
    // 否则按一次 ESC 会连详情层带整个板块一起关掉。
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="wk-detail" role="dialog" aria-modal="true">
      <header className="wk-dt-head">
        <div className="wk-dt-meta">
          <span className="wk-no hud-mono">{project.no}</span>
          <span className={`wk-kind hud-mono is-${project.kind}`}>
            {lang === 'zh' ? '公司项目' : 'Internal'}
          </span>
          <span className="wk-period hud-mono">{project.period[lang]}</span>
        </div>

        <h4 className="wk-dt-title">{project.title[lang]}</h4>
        {/* 详情页给全称（含合作方），卡片墙的分区标题用的是 orgShort */}
        <p className="wk-dt-org">{project.org[lang]}</p>

        <button
          ref={closeRef}
          className="wk-dt-close"
          onClick={onClose}
          aria-label={UI.close[lang]}
        >
          <IconClose />
        </button>
      </header>

      <div className="wk-dt-main">
        {/* key 换了重挂 → 切分组时内容淡入，看得出确实换了一段 */}
        <div className="wk-dt-body" key={sec.id}>
          <SectionBody section={sec} lang={lang} />
        </div>

        {/*
          右侧悬浮的分组按钮。
          移入即切换（不必点击）—— 这是浏览式的导航，
          要求先点一下才换内容会让人多做一次无谓的动作。
          点击和聚焦同样生效，键盘和触屏才用得了。
          整组监听 mouseleave 但**不重置** —— 停在最后看过的那段。
        */}
        <nav className="wk-dock" aria-label={UI.menu[lang]}>
          {project.sections.map((s, i) => (
            <button
              key={s.id}
              className={`wk-dock-btn${s.id === sec.id ? ' is-on' : ''}`}
              style={{ animationDelay: `${i * 60}ms` }}
              onMouseEnter={() => setSecId(s.id)}
              onFocus={() => setSecId(s.id)}
              onClick={() => setSecId(s.id)}
              aria-current={s.id === sec.id}
            >
              <span className="wk-dock-no hud-mono">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="wk-dock-label">{s.label[lang]}</span>
            </button>
          ))}
        </nav>
      </div>

      {/*
        技术栈单独占一行，和内容区分离。
        ⚠️ 原来 chips 和外链挤在同一个 flex 行里，chips 有 8 个时
        会把外链挤到第二行、并和上方内容视觉上黏在一起。
        现在给它独立的一栏和标题，是「这个项目用了什么」的索引，
        不参与正文阅读。
      */}
      <footer className="wk-dt-foot">
        <div className="wk-stack">
          <span className="wk-stack-label hud-mono">
            {UI.stackLabel[lang]}
          </span>
          <div className="chips">
            {project.stack.map((t, i) => (
              <span key={i} className="chip">
                {tag(t, lang)}
              </span>
            ))}
          </div>
        </div>

        {/* 内部项目没有外链 —— links 为空就整块不渲染 */}
        {project.links && project.links.length > 0 && (
          <div className="wk-links">
            {project.links.map((l, i) => (
              <a
                key={i}
                className="wk-link"
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {l.label[lang]}
                <IconArrow />
              </a>
            ))}
          </div>
        )}
      </footer>
    </div>
  )
}

/**
 * 一个分组的内容。
 *
 * ⚠️ 排版的关键是**把三种内容明确分开**：
 * 原来指标、正文、要点是三个紧挨着的块，读起来是一整片密不透风的字，
 * 找不到落点。现在：
 *   指标  横排的数字卡，最先看到
 *   正文  独立一段，左侧一条竖线标出「这是背景陈述」
 *   要点  编号列表，每条的小标题单独占一行
 * 三者之间用明显的留白和分隔线隔开，扫读时有节奏。
 */
function SectionBody({
  section,
  lang,
}: {
  section: ProjectSection
  lang: 'zh' | 'en'
}) {
  const points = section.points?.[lang] ?? []

  return (
    <>
      {section.metrics && section.metrics.length > 0 && (
        <ul className="wk-metrics">
          {section.metrics.map((m, i) => (
            <li key={i} className="wk-metric">
              <b>{m.value}</b>
              <span>{m.label[lang]}</span>
            </li>
          ))}
        </ul>
      )}

      {section.body && (
        <blockquote className="wk-prose">{section.body[lang]}</blockquote>
      )}

      {points.length > 0 && (
        <ol className="wk-points">
          {points.map((d, i) => (
            <Point key={i} index={i} text={d} />
          ))}
        </ol>
      )}
    </>
  )
}

/**
 * 一条要点。
 *
 * 内容里用 `小标题 —— 说明` 的写法。这里把两部分**拆成上下两行**
 * 而不是同一行加粗 —— 同一行时小标题会被后面几十个字淹没，
 * 等于没有标题。拆行后一眼能扫完所有小标题，再决定读哪条。
 *
 * ⚠️ 只切第一个 `——`：正文里也可能有破折号（中文行文常用），
 * 全切会把句子中间也断开。
 */
function Point({ index, text }: { index: number; text: string }) {
  const i = text.indexOf(' —— ')
  const no = String(index + 1).padStart(2, '0')

  if (i < 0) {
    return (
      <li className="wk-point">
        <span className="wk-point-no hud-mono">{no}</span>
        <span className="wk-point-body">{text}</span>
      </li>
    )
  }

  return (
    <li className="wk-point">
      <span className="wk-point-no hud-mono">{no}</span>
      <span className="wk-point-body">
        <b className="wk-point-key">{text.slice(0, i)}</b>
        <span className="wk-point-desc">{text.slice(i + 4)}</span>
      </span>
    </li>
  )
}
