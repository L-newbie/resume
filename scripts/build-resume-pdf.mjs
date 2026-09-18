// ─────────────────────────────────────────────────────────────
//  用站点的内容层生成一份可投递的 PDF 简历。
//
//  运行：npm run pdf   →  public/resume-weidong-he.pdf
//
//  **版式参考**：赫卫东-7年-本科-15646572521.pdf（用户给的那份模板）
//    · 姓名居中，下面一行「30岁 | 本科 | 7年经验 | 电话 | 邮箱 | 学校」也居中
//    · 蓝色小标题：求职意向 / 个人优势 / 工作 / 项目
//    · 经历抬头三栏：左时间、中机构、右岗位
//    · 工作要点 a. b. c.；项目里 ◆ 是分组、a. b. c. 是组内条目
//    · 项目按「项目介绍 / 工作描述 / 项目总结」三段写
//
//  **内容来源**：src/content/data.ts —— 站点上那份，**一条不删**。
//  ⚠️ 曾经为了压到 3 页把项目要点截到「2 组 × 2 条」，用户反馈
//  「web 段的内容尤其是项目要都写入 pdf，现在看起来不完整」。
//  现在是全量：每个项目的每个分组、每条要点、背景段落、成果指标都进 PDF。
//  篇幅换完整性 —— 这是明确的取舍，别再加 max 截断。
//
//  为什么从 data.ts 生成而不是另写一份：
//  站点内容一直在改（岗位、在职时间、新项目），两份各写各的必然分家。
//
//  ⚠️ 中文字体：这台机器的系统字体只有 DejaVu（不含汉字），
//  所以从 devDependency 里取 Noto Sans SC 的 TTF。
//  pdfkit 会**只嵌入用到的字形**（子集化），产物只有一百多 KB。
//
//  ⚠️ 产物提交在 public/ 下，普通 `npm run build` 不跑这个脚本。
// ─────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import * as esbuild from 'esbuild'
import PDFDocument from 'pdfkit'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(root, 'public', 'resume-weidong-he.pdf')

const FONT_DIR = join(root, 'node_modules', '@expo-google-fonts', 'noto-sans-sc')
const FONT = {
  regular: join(FONT_DIR, '400Regular', 'NotoSansSC_400Regular.ttf'),
  medium: join(FONT_DIR, '500Medium', 'NotoSansSC_500Medium.ttf'),
  bold: join(FONT_DIR, '700Bold', 'NotoSansSC_700Bold.ttf'),
}
for (const [k, f] of Object.entries(FONT)) {
  if (!existsSync(f)) {
    console.error(`✘ 缺少中文字体（${k}）：${f}`)
    console.error('  装一下：npm i -D @expo-google-fonts/noto-sans-sc')
    process.exit(1)
  }
}

// ── 取内容 ────────────────────────────────────────────────
// data.ts 只 import 了 types 里的**类型**，打包出来是纯数据，没有副作用。
const tmp = mkdtempSync(join(tmpdir(), 'resume-'))
const bundle = join(tmp, 'data.mjs')
await esbuild.build({
  entryPoints: [join(root, 'src', 'content', 'data.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundle,
  logLevel: 'error',
})
const C = await import(pathToFileURL(bundle).href)
rmSync(tmp, { recursive: true, force: true })

/** {zh,en} 取中文；纯字符串原样返回（专有名词） */
const zh = (v) => (v == null ? '' : typeof v === 'string' ? v : (v.zh ?? ''))
/** a. b. c. … */
const alpha = (i) => `${String.fromCharCode(97 + i)}.`
/** 「2021.11 — 至今」→「2021.11-至今」，对齐模板的写法 */
const dash = (v) => zh(v).replace(/\s*—\s*/, '-')

// ── 版式系统 ──────────────────────────────────────────────
/*
  ⚠️ 字号、间距、颜色**全部集中在这里**，正文里不许出现裸数字。
  上一版是每处现填，改一个间距要翻遍全文，而且各处对不齐 ——
  用户说「重新调整优化架构，包括字、格式、间距，做到更美观」，
  第一件事就是把这些收成一套可调的比例。

  字号取 8.6 / 9 / 9.8 / 11.5 / 21 五档，跨度足够拉开层级又不显杂。
  行距按「中文正文 1.55 倍行高」定：8.8pt 字配 3.1pt 行间距。
*/
const PAGE = { size: 'A4', margins: { top: 46, bottom: 48, left: 56, right: 56 } }
const W = 595.28 - PAGE.margins.left - PAGE.margins.right
const LEFT = PAGE.margins.left

const T = {
  name: 21,
  meta: 8.6,
  section: 11.5,
  entry: 9.8,
  body: 8.8,
  small: 8.2,
}
const LG = { body: 3.1, tight: 2.4 } // lineGap
const GAP = {
  headerAfter: 13, // 抬头分隔线之后
  sectionBefore: 15, // 小标题之前（大于之后 —— 靠近它领起的内容）
  sectionAfter: 7,
  entryBefore: 12, // 两条经历/项目之间
  headAfter: 4, // 三栏抬头之后
  blockAfter: 5, // 段落之后
  bullet: 3.2, // 要点之间
  groupBefore: 5, // ◆ 分组之前
}
const INK = '#2b2b2b' // 正文
const DIM = '#6f7a83' // 次要
const BLUE = '#2f74b5' // 姓名 / 小标题 / 记号
const RULE = '#d8e2ea'
const BAND = '#f2f6f9' // 项目总结的底色带

/*
  ⚠️ bufferPages: true 是页脚必需的 —— 不缓存页面的话 switchToPage 会抛，
  页码只能写在最后一页上，而且总页数在写的时候还不知道。
*/
const doc = new PDFDocument({ ...PAGE, autoFirstPage: false, compress: true, bufferPages: true })
doc.registerFont('sc', FONT.regular)
doc.registerFont('scm', FONT.medium)
doc.registerFont('scb', FONT.bold)
doc.info.Title = `${zh(C.IDENTITY.name)} · ${zh(C.IDENTITY.role)}`
doc.info.Author = zh(C.IDENTITY.name)

const bottom = () => doc.page.height - PAGE.margins.bottom
/** 这一块放不下就翻页 —— 标题、抬头不能和它领起的内容分家 */
const need = (h) => {
  if (doc.y + h > bottom()) doc.addPage()
}
/** 量一段文字排出来多高，用于翻页判断和画底色带 */
const measure = (text, { size = T.body, width = W, lineGap = LG.body, font = 'sc' } = {}) =>
  doc.font(font).fontSize(size).heightOfString(text, { width, lineGap })

doc.addPage()

// ── 抬头 ──────────────────────────────────────────────────
const id = C.IDENTITY
const edu = id.education?.[0]
doc
  .font('scb')
  .fontSize(T.name)
  .fillColor(BLUE)
  // 字距拉开一点 —— 两个字的中文名不加字距会挤成一团
  .text(zh(id.name), LEFT, doc.y, { width: W, align: 'center', characterSpacing: 2.5 })

doc.moveDown(0.5)
doc
  .font('sc')
  .fontSize(T.meta)
  .fillColor(DIM)
  .text(
    [
      `${id.age ?? 30}岁`,
      zh(edu?.degree)?.split('·').pop()?.trim() || '本科',
      '7年经验',
      ...C.SOCIALS.filter((s) => s.id !== 'github').map((s) => s.label),
      zh(edu?.school),
    ].join('   |   '),
    LEFT,
    doc.y,
    { width: W, align: 'center' }
  )

/*
  第三行：个人简历网站，做成**可点的链接**。

  ⚠️ 分段上色（标签灰、网址蓝并挂 link），所以不能拼成一个字符串。
  ⚠️ 整行居中要自己按 widthOfString 算起点 ——
  pdfkit 的 align:'center' 只对单次 text 调用生效，
  连排的几段会各自居中，拼出来是错位的。
  ⚠️ GitHub 不放这里：上面那行的联系方式（SOCIALS）里已经有了，
  抬头写两遍是噪声。
*/
{
  const site = C.SITE_URL
  const segs = [
    { t: '个人简历网站 ', c: DIM },
    { t: site.replace(/^https?:\/\//, ''), c: BLUE, link: site },
  ]
  doc.font('sc').fontSize(T.meta)
  const total = segs.reduce((sum, g) => sum + doc.widthOfString(g.t), 0)
  let x = LEFT + (W - total) / 2
  const y = doc.y + 3
  for (const g of segs) {
    doc.fillColor(g.c).text(g.t, x, y, {
      lineBreak: false,
      link: g.link ?? null,
      underline: false,
    })
    x += doc.widthOfString(g.t)
  }
  doc.x = LEFT
  doc.y = y + doc.currentLineHeight()
}

// 抬头和正文之间一条细线 —— 比空白更能把「名片」和「内容」分开
doc.y += 9
doc.moveTo(LEFT, doc.y).lineTo(LEFT + W, doc.y).lineWidth(0.7).strokeColor(RULE).stroke()
doc.y += GAP.headerAfter

// ── 排版原语 ──────────────────────────────────────────────
/** 蓝色小标题 + 下面一条细线 */
function section(title) {
  need(58)
  doc.y += GAP.sectionBefore
  doc.font('scb').fontSize(T.section).fillColor(BLUE).text(title, LEFT, doc.y, { width: W })
  doc.y += 2
  doc.moveTo(LEFT, doc.y).lineTo(LEFT + W, doc.y).lineWidth(0.7).strokeColor(RULE).stroke()
  doc.y += GAP.sectionAfter
}

/**
 * 经历/项目抬头三栏：左时间 / 中标题 / 右岗位。
 *
 * ⚠️ 三段在同一个 y 上分别定位，不能用 continued 连排 ——
 * 中间那栏要真正居中、右边那栏要贴右边缘。
 * ⚠️ 三栏的**字重不同**：中间是主角（bold INK），时间和岗位是
 * 定位信息（medium，一灰一蓝）。模板里三栏同粗，看久了分不出主次。
 */
function entryHead(left, center, right) {
  need(52)
  const y = doc.y
  doc.font('scm').fontSize(T.body).fillColor(DIM).text(left, LEFT, y + 1, {
    width: W * 0.24,
    align: 'left',
  })
  doc.font('scb').fontSize(T.entry).fillColor(INK).text(center, LEFT + W * 0.24, y, {
    width: W * 0.52,
    align: 'center',
  })
  doc.font('scm').fontSize(T.body).fillColor(BLUE).text(right, LEFT + W * 0.76, y + 1, {
    width: W * 0.24,
    align: 'right',
  })
  doc.x = LEFT
  doc.y = y + doc.font('scb').fontSize(T.entry).currentLineHeight() + GAP.headAfter
}

function para(text, opts = {}) {
  if (!text) return
  const { indent = 0, size = T.body, color = INK, font = 'sc', gap = GAP.blockAfter } = opts
  const w = W - indent
  need(Math.min(measure(text, { size, width: w, font }), 46))
  doc
    .font(font)
    .fontSize(size)
    .fillColor(color)
    .text(text, LEFT + indent, doc.y, { width: w, lineGap: LG.body })
  doc.x = LEFT
  doc.y += gap
}

/**
 * 带记号的要点，悬挂缩进。
 * mark 'a' → a. b. c.（工作要点、项目组内要点）
 * mark '◆' → 蓝色菱形（项目里的分组名）
 */
function bullets(items, { mark = 'a', indent = 0, size = T.body, font = 'sc' } = {}) {
  const gutter = mark === 'a' ? 15 : 12
  items.filter(Boolean).forEach((t, i) => {
    const w = W - indent - gutter
    need(Math.min(measure(t, { size, width: w, font }), 40))
    const y = doc.y
    doc
      .font(mark === 'a' ? 'sc' : 'scm')
      .fontSize(size)
      .fillColor(mark === 'a' ? DIM : BLUE)
      .text(mark === 'a' ? alpha(i) : '◆', LEFT + indent, y, { width: gutter })
    doc.y = y
    doc
      .font(font)
      .fontSize(size)
      .fillColor(INK)
      .text(t, LEFT + indent + gutter, y, { width: w, lineGap: LG.body })
    doc.x = LEFT
    doc.y += GAP.bullet
  })
}

/**
 * 带标签的段落：「项目介绍：」这类前缀用中黑，正文用常规。
 *
 * ⚠️ 标签和正文必须是**同一次排版**（continued），不能分两次 text ——
 * 分开写的话正文会从下一行开始，「标签独占一行」很难看。
 * ⚠️ 曾经把项目总结做成浅灰底色块 + 蓝竖条，用户打回
 *「项目总结不要单独用特殊格式」—— 三段（介绍/工作内容/总结）
 * 现在是同一种样式，靠标签区分，层次交给缩进和 ◆ 记号去表达。
 */
function labeled(label, text, opts = {}) {
  if (!text) return
  const { indent = 0, size = T.body, gap = GAP.blockAfter } = opts
  const w = W - indent
  need(Math.min(measure(label + text, { size, width: w }), 46))
  doc.font('scm').fontSize(size).fillColor(INK).text(label, LEFT + indent, doc.y, {
    width: w,
    lineGap: LG.body,
    continued: true,
  })
  doc.font('sc').fontSize(size).fillColor(INK).text(text, { lineGap: LG.body })
  doc.x = LEFT
  doc.y += gap
}

/**
 * 项目里的小节标签：项目介绍 / 工作内容 / 项目总结。
 *
 * ⚠️ 独占一行 + 蓝色 + 左边一道短竖条，**必须和正文明显不同**。
 * 曾经是「标签中黑 + 正文常规」连排在同一行，用户打回
 *「项目介绍、工作内容、项目总结应该和普通的文字有区分」——
 * 只差一个字重，扫视时根本分不出这是标签还是正文。
 * ⚠️ 标签顶左对齐版心，内容统一缩进 BODY_IN —— 缩进本身就是层级：
 * 一眼能看出「这段属于哪一节」。
 */
const BODY_IN = 12
function blockLabel(text) {
  need(34)
  const y = doc.y
  doc.rect(LEFT, y + 2, 2, 8.5).fillColor(BLUE).fill()
  doc.font('scm').fontSize(T.body).fillColor(BLUE).text(text, LEFT + 7, y, { width: W - 7 })
  doc.x = LEFT
  doc.y += 2.5
}

/** 两个项目之间的分隔线 —— 光靠空白分不开，六个项目会糊成一片 */
function divider() {
  doc.y += 9
  need(4)
  doc.moveTo(LEFT, doc.y).lineTo(LEFT + W, doc.y).lineWidth(0.6).strokeColor(RULE).stroke()
  doc.y += 11
}

// ── 求职意向 ──────────────────────────────────────────────
section('求职意向')
{
  const cells = [
    zh(id.role),
    zh(id.location).replace(/^中国\s*·\s*/, ''),
    '薪资面议',
    // 模板里这一栏是「在职找工作 - 到岗时间另议」。不取 AVAILABILITY.label
    //（站点上是「考虑机会」）—— 简历上说清「在职」更实用，对方据此判断到岗周期。
    '在职找工作 · 到岗时间另议',
  ]
  need(24)
  const y = doc.y
  const cw = W / cells.length
  cells.forEach((c, i) => {
    doc
      .font(i === 0 ? 'scm' : 'sc')
      .fontSize(T.body)
      .fillColor(i === 0 ? INK : DIM)
      .text(c, LEFT + cw * i, y, { width: cw, align: i === 0 ? 'left' : 'center' })
  })
  doc.x = LEFT
  doc.y = y + doc.currentLineHeight() + 2
}

// ── 个人优势 ──────────────────────────────────────────────
// 模板是 a./b./c./d. 四条。站点的四个能力域各带一句 caption
// （讲「强在哪」而不是「会什么」），正好就是这四条。
section('个人优势')
/*
  ⚠️ 关键词并进同一条，不要另起一行灰色小字。
  曾经是「四条优势」+「四条关键词清单」两组，用户打回
  「个人优势中的几个灰色小字应该和上面的内容汇总一起写，不要单独描述」——
  同一个能力域被拆成两处，读的人要来回对照。
*/
bullets(
  C.SKILLS.map(
    (g) =>
      `${zh(g.label)} —— ${zh(g.caption).replace(/。$/, '')}；涉及${g.items
        .map((it) => zh(it.name))
        .join('、')}。`
  )
)

// ── 工作 ──────────────────────────────────────────────────
section('工作')
C.TIMELINE.forEach((e, i) => {
  if (i) doc.y += GAP.entryBefore
  // 页尾只剩一点空间时整条翻页 —— 抬头孤零零挂在页脚上方很难看
  need(110)
  entryHead(dash(e.period), zh(e.org), zh(e.role).split('·')[0].trim())
  para(zh(e.summary), { color: DIM })
  // ⚠️ 不写技术栈。用户明确要求去掉 —— 关键技术在要点里本来就带着
  //（Qwen-VL、DAG、YOLO…），单列一行是重复，还占版面。
  bullets(zh(e.points))
})

// ── 项目 ──────────────────────────────────────────────────
section('项目')
C.PROJECTS.forEach((p, i) => {
  if (i) doc.y += GAP.entryBefore
  need(110)
  // 项目抬头右侧的岗位：跟着所在公司走，不跟着当前抬头走 ——
  // 电诈项目在集侦云期间做，岗位是数据分析师；
  // 开源项目没有公司岗位，写独立开发。
  const roleOf = (p) =>
    zh(p.orgShort) === '开源项目'
      ? '独立开发'
      : zh(p.orgShort) === '集侦云'
        ? '数据分析师'
        : zh(id.role)
  entryHead(dash(p.period), zh(p.title), roleOf(p))

  /*
    ── 三块结构 ──
    ① 项目介绍（含背景）② 工作内容 ③ 项目总结
    用户明确要的顺序和分块：「项目介绍和背景放在一起、下一块是工作内容、
    最后是项目总结，结构要清晰层次要明显」。

    ⚠️ 站点上「背景」是 sections 里 id='context' 的那一段散文，
    这里把它并进项目介绍 —— 一句话定位 + 为什么做这件事，本来就是一件事，
    拆成两块反而看不出重点。
  */
  const ctx = p.sections.find((s) => s.id === 'context')
  const intro = [zh(p.tagline).replace(/。$/, ''), zh(ctx?.body)].filter(Boolean).join('。')
  blockLabel('项目介绍')
  para(intro, { indent: BODY_IN })

  /*
    工作内容 —— **全量**，一条不删。
    背景（已并进介绍）和成果（留给总结）在这里跳过。
  */
  const groups = p.sections.filter((s) => s.id !== 'outcome' && s.id !== 'context')
  if (groups.length) {
    doc.y += 3
    /*
      ⚠️「工作内容」这行标签不能自己留在页尾 —— blockLabel 内部的 need()
      只量它自己那一行。这里要求「标签 + 组标题 + 两行要点」的空间。
    */
    need(64)
    blockLabel('工作内容')
    if (groups.length === 1) {
      /*
        ⚠️ 只有一组时**不加 ◆ 那一层**。
        电诈那个项目只有「方法」一组，套上 ◆ 就成了
        「工作内容 → ◆ 方法 → a.b.c.d.」—— 中间那层只有一个元素，
        纯粹是噪声。用户原话：「直接展示 a-d，不要再加一层方法」。
      */
      const g = groups[0]
      if (g.body) para(zh(g.body), { indent: BODY_IN, size: T.small, color: DIM, gap: 3 })
      if (g.points) bullets(zh(g.points), { mark: 'a', indent: BODY_IN, size: T.small })
    } else {
      for (const g of groups) {
        doc.y += GAP.groupBefore
        // 组标题不能落单在页尾，同上
        need(46)
        bullets([zh(g.label)], { mark: '◆', indent: BODY_IN })
        if (g.body) para(zh(g.body), { indent: BODY_IN + 18, size: T.small, color: DIM, gap: 3 })
        if (g.points)
          bullets(zh(g.points), { mark: 'a', indent: BODY_IN + 18, size: T.small })
      }
    }
  }

  // 项目总结：成果指标 + 结论段
  const outcome = p.sections.find((s) => s.id === 'outcome')
  const metrics = p.sections.flatMap((s) => s.metrics ?? [])
  const bits = []
  if (metrics.length) bits.push(metrics.map((m) => `${m.value} ${zh(m.label)}`).join('；'))
  if (outcome?.body) bits.push(zh(outcome.body))
  if (bits.length) {
    doc.y += 4
    need(40)
    blockLabel('项目总结')
    para(bits.join('。'), { indent: BODY_IN })
  }

  // 项目之间画一条线 —— 六个项目只靠空白分不开
  if (i < C.PROJECTS.length - 1) divider()

})

// ── 页脚：细线 + 姓名 + 页码 ──────────────────────────────
const range = doc.bufferedPageRange()
const pages = range.count
for (let i = range.start; i < range.start + pages; i++) {
  doc.switchToPage(i)
  /*
    ⚠️ 页脚写在下边距**之外**，pdfkit 会认为文字溢出并自动**再开一页** ——
    症状是 4 页的内容产出 8 页，后 4 页只有页脚。
    临时把 bottom margin 归零 + lineBreak:false 才不会触发自动分页。
  */
  const keep = doc.page.margins.bottom
  doc.page.margins.bottom = 0
  const y = doc.page.height - 34
  doc.moveTo(LEFT, y - 6).lineTo(LEFT + W, y - 6).lineWidth(0.5).strokeColor(RULE).stroke()
  doc
    .font('sc')
    .fontSize(T.small)
    .fillColor(DIM)
    .text(`${zh(id.name)} · ${zh(id.role)}`, LEFT, y, { width: W * 0.5, lineBreak: false })
  doc
    .font('sc')
    .fontSize(T.small)
    .fillColor(DIM)
    .text(`${i + 1} / ${pages}`, LEFT + W * 0.5, y, {
      width: W * 0.5,
      align: 'right',
      lineBreak: false,
    })
  doc.page.margins.bottom = keep
}
doc.flushPages()

const chunks = []
doc.on('data', (c) => chunks.push(c))
const done = new Promise((res) => doc.on('end', res))
doc.end()
await done
writeFileSync(OUT, Buffer.concat(chunks))

const kb = (readFileSync(OUT).length / 1024).toFixed(0)
console.log(`✔ ${OUT.replace(root + '/', '')}  ${pages} 页 · ${kb} KB`)
