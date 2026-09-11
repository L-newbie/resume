/*
 * @Author:  weidong.he
 * @Date: 2026-09-08 14:43:59
 * @LastEditTime: 2026-09-08 14:44:00
 * @LastEditors:  weidong.he
 * @FilePath: /poly_app/resume/scripts/build-resume-pdf copy.mjs
 * @Description:  请在此处输入脚本功能描述
 */
// ─────────────────────────────────────────────────────────────
//  用站点的内容层生成一份可投递的 PDF 简历。
//
//  运行：npm run pdf   →  public/resume-weidong-he.pdf
//
//  **版式参考**：赫卫东-7年-本科-15646572521.pdf（用户给的那份模板）
//    · 姓名居中，下面一行「28岁 | 本科 | 7年经验 | 电话 | 邮箱 | 学校」也居中
//    · 四个蓝色小标题：求职意向 / 个人优势 / 工作 / 项目（不加分隔线）
//    · 经历抬头三栏：左时间、中机构、右岗位，都加粗
//    · 工作要点用 a. b. c. 编号；项目里 ◆ 是一级、a. b. c. 是二级
//    · 项目按「项目介绍 / 工作描述 / 项目总结」三段写
//  **内容来源**：src/content/data.ts —— 也就是站点上那份（比模板更全）。
//
//  为什么从 data.ts 生成而不是另写一份：
//  站点内容一直在改（岗位、在职时间、新项目），两份各写各的必然分家 ——
//  改了网页忘了改 PDF，投出去自相矛盾。站点改完重跑一次即可。
//
//  ⚠️ 中文字体：这台机器的系统字体只有 DejaVu（不含汉字），
//  所以从 devDependency 里取 Noto Sans SC 的 TTF。
//  pdfkit 会**只嵌入用到的字形**（子集化），所以产物只有一百多 KB。
//
//  ⚠️ 产物提交在 public/ 下，普通 `npm run build` 不跑这个脚本，
//  也就不需要装那个 92MB 的字体包。只有要**更新简历**时才跑。
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
/** a. b. c. …（模板里工作要点和项目二级要点都是这个编号） */
const alpha = (i) => `${String.fromCharCode(97 + i)}.`

// ── 版式 ──────────────────────────────────────────────────
const PAGE = { size: 'A4', margins: { top: 40, bottom: 42, left: 52, right: 52 } }
const W = 595.28 - PAGE.margins.left - PAGE.margins.right
const INK = '#333333' // 正文（模板是偏灰的深色，不是纯黑）
const DIM = '#6b6b6b' // 次要信息
const BLUE = '#2f74b5' // 姓名和小标题（对着模板那个蓝取的）

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

const LEFT = PAGE.margins.left
const bottom = () => doc.page.height - PAGE.margins.bottom
/** 这一块放不下就翻页 —— 标题和它下面第一行不能被拆到两页 */
const need = (h) => {
  if (doc.y + h > bottom()) doc.addPage()
}

doc.addPage()

// ── 抬头：姓名 + 一行事实，都居中（模板就是这个样子）──────
const id = C.IDENTITY
const edu = id.education?.[0]
doc.font('scb').fontSize(19).fillColor(BLUE).text(zh(id.name), LEFT, doc.y, {
  width: W,
  align: 'center',
})
doc.moveDown(0.45)
doc
  .font('sc')
  .fontSize(9)
  .fillColor(DIM)
  .text(
    [
      '28岁',
      zh(edu?.degree)?.split('·').pop()?.trim() || '本科',
      '7年经验',
      ...C.SOCIALS.filter((s) => s.id !== 'github').map((s) => s.label),
      zh(edu?.school),
    ].join('   |   '),
    LEFT,
    doc.y,
    { width: W, align: 'center' }
  )

// ── 小工具 ────────────────────────────────────────────────
/** 蓝色小标题。模板里不带分隔线，靠字号和颜色分层 */
function section(title) {
  need(52)
  doc.moveDown(0.95)
  doc.font('scb').fontSize(12).fillColor(BLUE).text(title, LEFT, doc.y, { width: W })
  doc.moveDown(0.4)
}

/**
 * 经历抬头三栏：左时间 / 中机构 / 右岗位。
 * ⚠️ 三段在同一个 y 上分别定位，不能靠 continued 连排 ——
 * 中间那栏要真正居中，右边那栏要贴右边缘。
 */
function entryHead(left, center, right) {
  need(34)
  const y = doc.y
  doc.font('scb').fontSize(9.5).fillColor(INK)
  doc.text(left, LEFT, y, { width: W * 0.26, align: 'left' })
  doc.text(center, LEFT + W * 0.26, y, { width: W * 0.48, align: 'center' })
  doc.text(right, LEFT + W * 0.74, y, { width: W * 0.26, align: 'right' })
  doc.x = LEFT
  doc.y = y + doc.currentLineHeight() + 4
}

/** 普通段落 */
function para(text, opts = {}) {
  if (!text) return
  need(22)
  const { indent = 0, size = 8.8, color = INK, font = 'sc' } = opts
  doc
    .font(font)
    .fontSize(size)
    .fillColor(color)
    .text(text, LEFT + indent, doc.y, { width: W - indent, lineGap: 2.2 })
  doc.x = LEFT
}

/**
 * 带记号的要点，悬挂缩进。
 * mark: 'a' → a. b. c.（模板里工作要点、项目二级要点用它）
 *       '◆' → 实心菱形（模板里项目一级分组用它）
 */
function bullets(items, { mark = 'a', indent = 0, size = 8.8, max = 99 } = {}) {
  const list = items.filter(Boolean).slice(0, max)
  const gutter = mark === 'a' ? 15 : 13
  list.forEach((t, i) => {
    need(20)
    const y = doc.y
    doc.font('sc').fontSize(size).fillColor(mark === 'a' ? DIM : BLUE)
    doc.text(mark === 'a' ? alpha(i) : '◆', LEFT + indent, y, { width: gutter })
    doc.y = y
    doc
      .font('sc')
      .fontSize(size)
      .fillColor(INK)
      .text(t, LEFT + indent + gutter, y, { width: W - indent - gutter, lineGap: 2.1 })
    doc.x = LEFT
    doc.moveDown(0.16)
  })
}

// ── 求职意向 ──────────────────────────────────────────────
// 模板是四栏横排：岗位 / 城市 / 薪资 / 状态
section('求职意向')
{
  const cells = [
    zh(id.role),
    zh(id.location).replace(/^中国\s*·\s*/, ''),
    '薪资面议',
    // 模板里这一栏写的是「在职找工作 - 到岗时间另议」。
    // 不取 AVAILABILITY.label（站点上是「考虑机会」）—— 简历上说清楚
    // 「在职」比「考虑机会」更实用，对方据此判断到岗周期。
    '在职找工作 · 到岗时间另议',
  ]
  need(22)
  const y = doc.y
  const cw = W / cells.length
  cells.forEach((c, i) => {
    doc
      .font(i === 0 ? 'scm' : 'sc')
      .fontSize(9)
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
bullets(
  C.SKILLS.map((g) => `${zh(g.label)} —— ${zh(g.caption)}`),
  { mark: 'a' }
)

// ── 工作 ──────────────────────────────────────────────────
section('工作')
for (const e of C.TIMELINE) {
  entryHead(zh(e.period).replace(/\s*—\s*/, '-'), zh(e.org), zh(e.role).split('·')[0].trim())
  para(zh(e.summary), { color: DIM })
  doc.moveDown(0.25)
  // ⚠️ 每段最多 5 条。地平线那段站点上有 6 条，全放会把最后一个项目的
  // 「项目总结」挤到第 4 页，而那一页只有两行 —— 为两行多一页不值。
  bullets(zh(e.points), { mark: 'a', max: 5 })
  doc.moveDown(0.75)
}

// ── 项目 ──────────────────────────────────────────────────
section('项目')
for (const p of C.PROJECTS) {
  entryHead(
    zh(p.period).replace(/\s*—\s*/, '-'),
    zh(p.title),
    zh(p.orgShort) === '开源项目' ? '独立开发' : zh(id.role)
  )

  para(`项目介绍：${zh(p.tagline)}`, { color: DIM })

  /*
    工作描述。
    ⚠️ 站点上每个项目是几段长文（背景 / 方法 / 成果），整段搬进来十几页打不住。
    这里只取**要点**，并保留层级：分组名走 ◆，组内条目走 a. b. c. ——
    和模板里「◆ 数据挖掘 / a. … b. …」的结构对齐。
    每个项目最多 2 组、每组最多 2 条：模板本身是 3 页，
    放到 3 条就是 4 页 —— 简历第 4 页没人翻。
  */
  const groups = p.sections.filter((s) => s.points).slice(0, 2)
  if (groups.length) {
    doc.moveDown(0.2)
    para('工作描述：', { color: DIM })
    for (const g of groups) {
      need(24)
      doc.moveDown(0.1)
      bullets([zh(g.label)], { mark: '◆', indent: 8 })
      bullets(zh(g.points), { mark: 'a', indent: 26, size: 8.8, max: 2 })
    }
  }

  // 项目总结：优先用成果指标（模板的「项目总结」也是一行结论）
  const metrics = p.sections.flatMap((s) => s.metrics ?? [])
  const outcome = p.sections.find((s) => s.id === 'outcome')
  const summary = metrics.length
    ? metrics.map((m) => `${m.value} ${zh(m.label)}`).join('；')
    : zh(outcome?.body).split('。')[0]
  if (summary) {
    doc.moveDown(0.2)
    para(`项目总结：${summary}`, { font: 'scm', color: INK })
  }
  doc.moveDown(0.8)
}

// ── 页脚：姓名 + 页码 ─────────────────────────────────────
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
  doc
    .font('sc')
    .fontSize(8)
    .fillColor(DIM)
    .text(
      `${zh(id.name)} · ${zh(id.role)}　　${i + 1} / ${pages}`,
      LEFT,
      doc.page.height - 30,
      { width: W, align: 'center', lineBreak: false }
    )
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
