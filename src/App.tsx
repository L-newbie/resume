import { lazy, Suspense, useEffect } from 'react'
import { HudFrame, LoadingVeil } from './components/Hud'
import { SectionPanel } from './components/SectionPanel'
import { Cursor } from './components/Cursor'
import { SECTIONS } from './content/sections'
import { useApp } from './lib/store'
import { useCapability, useKeyNav, useViewportUnitFix } from './lib/hooks'

// three.js 走独立分包，首屏 HTML/CSS 不等它。
// 弱设备 / 无 WebGL 时这个 import 根本不会发生。
const SceneLayer = lazy(() => import('./components/SceneLayer'))

/**
 * 悬浮地球仪导航。
 *
 *   默认  一个点云地球仪，球面是六块大洲，每块 = 一个板块。
 *         相机分镜切换停靠到各块大洲，转到的那块高亮 + 弹出小屏。
 *         鼠标停在球上暂停巡航，可拖拽自由旋转。
 *   板块  点小屏进入，球缩到左上角，右侧展开完整内容。
 */
export default function App() {
  const cap = useCapability()
  const lang = useApp((s) => s.lang)
  const active = useApp((s) => s.active)
  const markReady = useApp((s) => s.markReady)

  // 移动端 100vh 修正
  useViewportUnitFix()
  // 键盘：左右键切板块、ESC 返回、M 切模式
  useKeyNav()

  // 同步 <html lang>，影响字体选择与断词
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  }, [lang])

  // 降级路径：不加载 3D 时也要让加载遮罩消失
  const use3D = cap.tier !== 'off'
  useEffect(() => {
    if (!use3D) markReady()
  }, [use3D, markReady])

  return (
    <div className={`app${active >= 0 ? ' is-open' : ''}`}>
      <LoadingVeil />

      {/* 球体层：满屏 canvas + 挂在球面上的 DOM 小屏 */}
      <div className={`orb-layer tier-${cap.tier}`}>
        {use3D ? (
          <Suspense fallback={null}>
            <SceneLayer cap={cap} />
          </Suspense>
        ) : (
          <FallbackNav />
        )}
      </div>

      {/* 噪点 + 扫描线：纯 CSS，不额外开 WebGL context */}
      <div className="grain" aria-hidden="true" />

      <HudFrame />

      {/* 自定义光标：内部自行判断是否为鼠标设备 */}
      {!cap.coarse && <Cursor />}

      <SectionPanel />
    </div>
  )
}

/**
 * 无 WebGL 时的降级导航。
 *
 * 球体是这个站的全部交互入口 —— 它没了就必须有替代品，
 * 否则页面完全不可用。这里给一个朴素的板块列表。
 */
function FallbackNav() {
  const lang = useApp((s) => s.lang)
  const open = useApp((s) => s.open)

  return (
    <nav className="fallback-nav">
      <ul>
        {SECTIONS.map((s, i) => (
          <li key={s.id}>
            <button onClick={() => open(i)}>
              <span className="hud-mono">{s.no}</span>
              <span>{s.label[lang]}</span>
              <em>{s.tag[lang]}</em>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
