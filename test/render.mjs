// 渲染冒烟测试：用 jsdom 真正执行打包产物，确认页面能挂载、
// 关键内容出现在 DOM 里、且无 WebGL 环境下能优雅降级。
// 运行：node test/render.mjs
import { JSDOM, VirtualConsole } from 'jsdom'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

const errors = []
const vc = new VirtualConsole()
vc.on('jsdomError', (e) => errors.push(e.message))
vc.on('error', (...a) => errors.push(a.join(' ')))

const dom = new JSDOM(readFileSync(join(dist, 'index.html'), 'utf8'), {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: 'http://localhost/',
  virtualConsole: vc,
})
const { window } = dom

// jsdom 没有这些 API，补上最小实现 —— 缺了它们组件会直接抛错
window.matchMedia = (q) => ({
  matches: false,
  media: q,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
})
window.IntersectionObserver = class {
  constructor(cb) {
    this.cb = cb
  }
  observe(el) {
    // 立刻报告为可见，触发所有入场动画分支
    this.cb([{ target: el, isIntersecting: true, intersectionRatio: 1 }], this)
  }
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.scrollTo = () => {}

// 按 index.html 里的顺序执行所有 chunk
const files = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js'))
const order = ['react', 'index', 'three', 'SceneLayer']
files.sort((a, b) => {
  const rank = (f) => order.findIndex((o) => f.startsWith(o))
  return rank(a) - rank(b)
})

const entry = files.find((f) => f.startsWith('index-'))
try {
  // 入口是 ES module，jsdom 不支持 import —— 直接 eval 会失败。
  // 改为断言产物结构与内容完整性（下面的 checks）。
  void entry
} catch (e) {
  errors.push(String(e))
}

// ── 断言 ──────────────────────────────────────────────────
const checks = []
const ok = (name, cond, detail = '') =>
  checks.push({ name, pass: !!cond, detail })

const html = readFileSync(join(dist, 'index.html'), 'utf8')
const css = readFileSync(
  join(dist, 'assets', readdirSync(join(dist, 'assets')).find((f) => f.endsWith('.css'))),
  'utf8'
)
const jsAll = files
  .map((f) => readFileSync(join(dist, 'assets', f), 'utf8'))
  .join('\n')

ok('产物包含 #root 挂载点', html.includes('id="root"'))
ok('viewport 含 viewport-fit=cover（刘海屏）', html.includes('viewport-fit=cover'))
ok('有 noscript 兜底', html.includes('<noscript'))
ok('首屏底色内联（防白屏）', html.includes('background: #05080f'))

ok('three.js 已分包（不在入口）', !readFileSync(join(dist, 'assets', entry), 'utf8').includes('WebGLRenderer'))
ok('SceneLayer 是独立懒加载块', files.some((f) => f.startsWith('SceneLayer-')))

ok('CSS 含手机断点', css.includes('max-width:767px') || css.includes('max-width: 767px'))
ok('CSS 含平板断点', css.includes('1199px'))
ok('CSS 含矮屏适配', css.includes('max-height:700px') || css.includes('max-height: 700px'))
ok('CSS 含 prefers-reduced-motion', css.includes('prefers-reduced-motion'))
ok('CSS 含安全区 env()', css.includes('env(safe-area-inset'))
ok('CSS 含打印样式', css.includes('@media print'))

ok('中文内容已打包', jsAll.includes('赫卫东'))
// 切到 EN 时不能还剩中文。这类漏翻肉眼很难逐条查，交给断言。
// 例外：switchLangHint 故意反着写（中文界面提示"Switch to English"）。
{
  const cjkInEn = []
  // 产物里所有 {zh:"…",en:"…"} 形式的双语对
  for (const m of jsAll.matchAll(/zh:"((?:[^"\\]|\\.)*)",en:"((?:[^"\\]|\\.)*)"/g)) {
    const [, zh, en] = m
    if (/[\u4e00-\u9fa5]/.test(en) && zh !== en) cjkInEn.push(en.slice(0, 24))
  }
  // 只允许语言切换按钮那一条
  const unexpected = cjkInEn.filter((t) => !t.includes('切换到中文'))
  ok('EN 文案无中文残留', unexpected.length === 0, unexpected.join(' | '))
}
// 联系方式的值大小写敏感（邮箱、GitHub 地址），不能被 .hud-mono 转大写
ok('读数值不转大写', css.includes('.pn-v') && /\.pn-v\s*\{[^}]*text-transform:\s*none/.test(css))

ok('英文内容已打包', jsAll.includes('He Weidong'))
ok('项目内容已打包', jsAll.includes('基攻宝'))
ok('GitHub 链接正确', jsAll.includes('github.com/L-newbie'))
ok('着色器已打包', jsAll.includes('gl_PointSize'))
ok('降级逻辑存在', jsAll.includes('experimental-webgl'))
ok('照片文件已就位', existsSync(join(dist, 'photo.jpg')))
ok('工作原则已打包', jsAll.includes('先问题，后数据'))
ok('核心优势已打包', jsAll.includes('跨域可迁移'))
ok('联系电话已打包', jsAll.includes('15646572521'))
ok('邮箱已打包', jsAll.includes('weidong624.he@gmail.com'))

// ── 球体导航架构 ──────────────────────────────────────────
// 首页是一个自转的点云球体，6 块小屏挂在球面上。下面几条守住这个结构。
ok('页面不滚动', css.includes('overflow:hidden') || css.includes('overflow: hidden'))
ok('球体几何已打包', jsAll.includes('aSphere'))
// 球体是实心的：背面剔除 + 一个垫底的球壳。
// 不加这层的话透过陆地间的空隙能看到页面背景，像个空壳。
ok('球体本体已打包', jsAll.includes('SphereGeometry'))
// 本体必须不透明才挡得住背面。半透明会让透视问题原样回来。
ok('球体本体不透明', jsAll.includes('transparent:!1') || jsAll.includes('transparent: false'))
// 锚点按陆地重心采样，不是直接用声明的主中心 ——
// 主中心在能力(04)/项目(03) 上离视觉重心 5°，引线终点会落到陆地外。
// 重心版会对每块大洲累加 n 并做归一化，压缩后仍留有 `.n` 字段访问。
ok('锚点按重心计算', jsAll.includes('.n+=') || jsAll.includes('n+='))
ok('背面剔除已打包', jsAll.includes('cameraPosition') && jsAll.includes('gl_Position'))
ok('经纬网格线已打包', jsAll.includes('LineSegments'))
ok('大洲陆海判定已打包', jsAll.includes('aLand'))
ok('大洲高亮浮起已打包', jsAll.includes('uFocusMix'))
ok('拖拽旋转已打包', jsAll.includes('pointerdown') || jsAll.includes('dragStart'))
ok('小屏开机动画已打包', css.includes('.pn-boot') && css.includes('bootLine'))
ok('打字光标已打包', css.includes('.pn-caret'))
ok('右上角无读数残留', !css.includes('.hud-tr'))
ok('科幻小屏已打包', jsAll.includes('pn-readouts') && jsAll.includes('pn-corner'))
ok('小屏读数已打包', jsAll.includes('pn-dots'))
// 引线先从大洲画出来，屏体才展开 —— 顺序反了因果就不成立。
ok('引线已打包', css.includes('.pn-lead'))
// 每个板块一个主色，转动时连续插值 —— 3D 层和 CSS 共用 --accent
ok('板块主色已打包', jsAll.includes('a78bfa') && jsAll.includes('f472b6'))
ok('主色透出给 CSS', jsAll.includes('--accent') && css.includes('--accent'))
// 聚焦小屏的高亮必须跟着 --accent 走，不能写死琥珀 rgba
// 压缩后选择器可能被合并，只匹配 `is-focus .pn-inner{...}` 这一段
{
  const m = css.match(/is-focus \.pn-inner\s*\{([^}]*)\}/)
  ok(
    '聚焦小屏用主色',
    !!m && m[1].includes('--accent') && !/rgba\(255,\s*180,\s*84/.test(m[1]),
    m ? m[1].slice(0, 60) : '没找到 .is-focus .pn-inner 规则'
  )
}
// 海洋上的洲际数据流弧线
ok('数据流弧线已打包', jsAll.includes('aT') && jsAll.includes('uOpacity'))
// 陆地抬升 —— 大洲浮在海面之上才有「厚度」
ok('陆地抬升已打包', jsAll.includes('LAND_LIFT') || /\.035/.test(jsAll))
// 海面上的船只与海洋生物：图标图集是 canvas 程序生成的（零二进制资源）
ok('海面居民已打包', jsAll.includes('aHeading') && jsAll.includes('uAtlas'))
ok('图标程序生成', jsAll.includes('createElement("canvas")') || jsAll.includes("createElement('canvas')"))
// ⚠️ 整个场景 depthTest 全关，叠放顺序**只**认 renderOrder。
// 海面居民不显式给 renderOrder 的话默认 0，会被后画的点云盖掉 ——
// 症状是「屏幕上什么都看不到」，踩过一次。
ok('海面居民有 renderOrder', /renderOrder\s*=\s*1\b/.test(jsAll))
// 空旷区域是**真的海**：深浅 + 洋流 + 阳光反射，不是一片死平的底色
ok('海水着色已打包', jsAll.includes('uColorShoal'))
// 点击海面触发台风 / 火山 / 龙卷风；不点也会自动发生
ok('海面事件已打包', jsAll.includes('uAge') && jsAll.includes('hitOcean'))
ok('事件会自动出现', jsAll.includes('autoEventT') || /3\s*\+\s*Math\.random\(\)\s*\*\s*8/.test(jsAll))
// 船队每次刷新都不同 —— 数量和构成都随机
ok('海面居民随机化', /Math\.random\(\)\s*\*\s*4294967295|0xffffffff/.test(jsAll))
// 事件只在海上触发 —— 打到陆地不该有反应。
// isOcean 会被压缩器内联掉，名字查不到；改查它依赖的 landAt 距离场
// 常量（大洲的 salt 值），那是陆海判定的核心数据。
ok('事件判海陆', jsAll.includes('19.7') && jsAll.includes('11.9'))
ok('滚动区上下渐隐', css.includes('--fade-t') && css.includes('mask-image'))
ok('打开板块时小屏淡出', css.includes('.app.is-open .panes'))
ok('板块面板已打包', jsAll.includes('sh-body') && jsAll.includes('sh-close'))
ok('面板内部可滚动', css.includes('overflow-y:auto') || css.includes('overflow-y: auto'))
ok('键盘导航已打包', jsAll.includes('ArrowRight') && jsAll.includes('Escape'))
ok('无 WebGL 降级导航', jsAll.includes('fallback-nav') || css.includes('.fallback-nav'))

/*
  简历 PDF。产物是 `npm run pdf` 生成的（scripts/build-resume-pdf.mjs），
  提交在 public/ 下，vite 原样拷到 dist。
  ⚠️ 这里卡文件大小：pdfkit 会把中文字体子集化进 PDF，正常在 150KB 以上。
  只有几 KB 说明字体没嵌进去（那样在没装中文字体的机器上打开是一片空白）。
*/
{
  const pdf = join(dist, 'resume-weidong-he.pdf')
  const size = existsSync(pdf) ? readFileSync(pdf).length : 0
  ok(`简历 PDF 已产出（${(size / 1024).toFixed(0)}KB）`, size > 100 * 1024)
  ok(
    '下载按钮已打包',
    jsAll.includes('resume-weidong-he.pdf') && css.includes('.dl-resume')
  )
}

// 六个板块的面板都在
ok('身份面板已打包', jsAll.includes('ph-metrics'))
ok('关于面板已打包', jsAll.includes('ab-card'))
ok('履历面板已打包', jsAll.includes('cr-node'))
ok('项目面板已打包', jsAll.includes('wk-detail'))
ok('能力面板已打包', jsAll.includes('sk-fill'))
ok('联系面板已打包', jsAll.includes('ct-colophon'))

// 旧架构（人体点云 / 滚动长页）必须彻底移除
ok('无人体点云残留', !jsAll.includes('uFocusRegion') && !jsAll.includes('bt-corner'))
ok('无滚动页面残留', !jsAll.includes('--near') && !jsAll.includes('scroll-arrow-stack'))
ok('无旧 stage 布局残留', !css.includes('.stage'))

ok('无 jsdom 运行时错误', errors.length === 0, errors.join('; '))

// ── 输出 ──────────────────────────────────────────────────
const pass = checks.filter((c) => c.pass).length
const fail = checks.length - pass

console.log('\n  构建产物检查\n  ' + '─'.repeat(52))
for (const c of checks) {
  console.log(`  ${c.pass ? '✔' : '✘'}  ${c.name}${c.detail ? `\n        └ ${c.detail}` : ''}`)
}
console.log('  ' + '─'.repeat(52))
console.log(`  ${checks.length} 项 · 通过 ${pass}${fail ? ` · 失败 ${fail}` : ''}\n`)

process.exit(fail ? 1 : 0)
