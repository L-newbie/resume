// ─────────────────────────────────────────────────────────────
// 设备能力探测 —— 手机 / 平板 / 桌面的分档依据。
//
// 站点在三个层面上适配设备：
//   1. 布局    纯 CSS 媒体查询（styles.css），这里不管
//   2. 渲染预算 粒子数、DPR、是否开后处理 —— 这个文件
//   3. 降级    没有 WebGL / 用户要求减少动效 → 完全不加载 3D
//
// 探测只在启动时做一次（视口尺寸变化会重算档位，见 useTier）。
// ─────────────────────────────────────────────────────────────

export type Tier = 'off' | 'low' | 'mid' | 'high'

export interface Capability {
  tier: Tier
  /** 点云粒子数 */
  particles: number
  /** devicePixelRatio 上限 —— 手机上限制到 1.5 能省一半以上填充率 */
  dprCap: number
  /** 是否渲染连接线（O(n²) 邻接，只在高端开） */
  links: boolean
  /** 是否开启辉光后处理 */
  bloom: boolean
  /** 触屏设备：关掉 hover 相关交互，改用触摸 */
  coarse: boolean
  /** 用户在系统里要求减少动效 */
  reducedMotion: boolean
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(
      c.getContext('webgl2') ||
      c.getContext('webgl') ||
      c.getContext('experimental-webgl')
    )
  } catch {
    return false
  }
}

/**
 * 判断档位。刻意保守 —— 宁可在中端机上少画点，
 * 也不要掉帧，掉帧比粒子少难看得多。
 */
export function detectCapability(): Capability {
  const reducedMotion =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  const coarse =
    typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

  // 完全降级：没有 WebGL，或用户明确要求减少动效
  if (!hasWebGL() || reducedMotion) {
    return {
      tier: 'off',
      particles: 0,
      dprCap: 1,
      links: false,
      bloom: false,
      coarse,
      reducedMotion,
    }
  }

  const w = window.innerWidth
  const cores = navigator.hardwareConcurrency ?? 4
  // deviceMemory 只有 Chromium 系有，缺省按 4GB 算
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 4

  // 手机：窄屏 或 触屏+小核数
  const isPhone = w < 768 || (coarse && cores <= 4)
  // 平板：中等宽度的触屏设备
  const isTablet = !isPhone && coarse && w < 1280
  // 低配桌面：核数少或内存小
  const isWeakDesktop = !coarse && (cores <= 4 || mem <= 4)

  if (isPhone) {
    return {
      tier: 'low',
      /*
        ⚠️ 大洲改成文字字形后，低端机这档从 2200 提到 3600。
        陆地占比只有约 4%（笔画细），2200 时每块大洲只分到约 200 点，
        四个字每字 50 点 —— 笔画会断成一截截，字认不出来。
        3600 时每块约 325 点，勉强成形。
        这是可读性的下限，不是性能的上限。
      */
      particles: 3600,
      dprCap: 1.5,
      links: false,
      bloom: false,
      coarse,
      reducedMotion,
    }
  }
  if (isTablet || isWeakDesktop) {
    return {
      tier: 'mid',
      particles: 4500,
      dprCap: 1.75,
      links: false,
      bloom: true,
      coarse,
      reducedMotion,
    }
  }
  return {
    tier: 'high',
    particles: 8000,
    dprCap: 2,
    links: true,
    bloom: true,
    coarse,
    reducedMotion,
  }
}

/** 模块级单例：探测一次，全站复用 */
let cached: Capability | null = null
export function getCapability(): Capability {
  if (!cached) cached = detectCapability()
  return cached
}

/** 视口跨越断点时重新探测（手机横竖屏、平板分屏、桌面拖窗口） */
export function refreshCapability(): Capability {
  cached = detectCapability()
  return cached
}
