// ─────────────────────────────────────────────────────────────
// 板块名文字掩码 —— 大洲的形状就是板块名本身。
//
// 做法：把每个板块名画到离屏 canvas 上，读回像素做成布尔掩码；
// 球面采样时把 (经度, 纬度) 换算成该块的局部 UV，查掩码定陆海。
//
// 为什么是 canvas 而不是预先算好的点阵：
// 中文字形数据量太大，硬编码进源码不现实；canvas 由浏览器自带的
// 字体渲染，零二进制资源（这是项目的硬约束），换文案也不用改代码。
//
// ⚠️ 没有 canvas 的环境（SSR / 测试）会拿不到掩码 —— 那时回退到
// 一个矩形块，保证球体仍然成形而不是整个消失。
// ─────────────────────────────────────────────────────────────

/** 掩码分辨率。宽高比要和大洲在球面上的跨度比例接近，否则字会被拉变形 */
const MASK_W = 256
const MASK_H = 96

export interface TextMask {
  /** MASK_W × MASK_H 的布尔数组，true = 笔画命中 */
  bits: Uint8Array
  w: number
  h: number
  /** 掩码是不是真的画出来了 —— false 表示走了降级 */
  ok: boolean
}

/**
 * 把一段文字渲染成掩码。
 *
 * ⚠️ 字重要够粗（900）且字号占满画布高度 —— 点云是**离散采样**，
 * 细笔画会在采样时断成一截截认不出来。宁可字形略胖也要保证连续。
 */
function renderMask(text: string): TextMask {
  const empty = (): TextMask => ({
    // 降级：中间一个实心块。球体仍然成形，只是没有字形。
    bits: (() => {
      const b = new Uint8Array(MASK_W * MASK_H)
      for (let y = MASK_H * 0.2; y < MASK_H * 0.8; y++) {
        for (let x = MASK_W * 0.1; x < MASK_W * 0.9; x++) {
          b[Math.floor(y) * MASK_W + Math.floor(x)] = 1
        }
      }
      return b
    })(),
    w: MASK_W,
    h: MASK_H,
    ok: false,
  })

  if (typeof document === 'undefined') return empty()

  try {
    const cv = document.createElement('canvas')
    cv.width = MASK_W
    cv.height = MASK_H
    const g = cv.getContext('2d', { willReadFrequently: true })
    if (!g) return empty()

    g.fillStyle = '#000'
    g.fillRect(0, 0, MASK_W, MASK_H)

    // 字号先按高度给，再按实际宽度回缩 —— 字数不同（2~4 字）时
    // 保证每块大洲的文字都填满掩码，而不是短的一块字很小。
    let size = Math.floor(MASK_H * 0.82)
    g.font = `900 ${size}px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif`
    const maxW = MASK_W * 0.94
    const w = g.measureText(text).width
    if (w > maxW) {
      size = Math.floor(size * (maxW / w))
      g.font = `900 ${size}px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif`
    }

    g.fillStyle = '#fff'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, MASK_W / 2, MASK_H / 2)

    const px = g.getImageData(0, 0, MASK_W, MASK_H).data
    const bits = new Uint8Array(MASK_W * MASK_H)
    let hit = 0
    for (let i = 0; i < bits.length; i++) {
      // 只看红通道就够 —— 画的是纯白字
      if (px[i * 4] > 110) {
        bits[i] = 1
        hit++
      }
    }
    // 一个像素都没命中说明字体没加载好，走降级而不是给一个空球
    if (hit === 0) return empty()
    return { bits, w: MASK_W, h: MASK_H, ok: true }
  } catch {
    return empty()
  }
}

/** 掩码按文本缓存 —— 同一块大洲会被采样上万次，不能每次重画 */
const cache = new Map<string, TextMask>()

export function textMask(text: string): TextMask {
  let m = cache.get(text)
  if (!m) {
    m = renderMask(text)
    cache.set(text, m)
  }
  return m
}

/**
 * 查询掩码在归一化坐标 (u, v) 处是否命中笔画。
 * u, v ∈ [0, 1]，超出范围一律不命中。
 */
export function maskHit(m: TextMask, u: number, v: number): boolean {
  if (u < 0 || u > 1 || v < 0 || v > 1) return false
  const x = Math.min(m.w - 1, Math.floor(u * m.w))
  const y = Math.min(m.h - 1, Math.floor(v * m.h))
  return m.bits[y * m.w + x] === 1
}
