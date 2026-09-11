// ─────────────────────────────────────────────────────────────
// 海面居民的图标图集 —— 用 canvas 程序画出来，零二进制资源。
//
// 为什么是图标而不是写实的船：
// 球半径在屏幕上约 450px，地球周长 40000km → 1px ≈ 14km。
// 一艘 330m 的航母按真实比例只有 **0.023px**，放大 900 倍才看得出形状，
// 那时它比一整块大洲还大。所以这里明确**不按比例**，
// 走古地图上装饰画的路子：看得出是什么，但不假装写实。
//
// 图集是 4×2 的格子，每格 64×64，用 point sprite 采样。
// 单张纹理 + 一次 draw call，比每个物体一个 mesh 便宜得多。
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three'

/** 图集里每格的边长（px） */
const CELL = 64
/** 图集的列数 / 行数 */
export const ATLAS_COLS = 4
export const ATLAS_ROWS = 2

/**
 * 海面居民的种类。索引 = 图集里的格子号（行优先）。
 * ⚠️ 顺序改了要同步改 buildOceanLife 里的分布比例。
 */
export const enum Kind {
  Cargo = 0, // 货轮
  Carrier = 1, // 航母
  Warship = 2, // 军舰
  Boat = 3, // 渔船
  Whale = 4, // 鲸鱼
  Shark = 5, // 鲨鱼
  FishBig = 6, // 大鱼
  FishSmall = 7, // 小鱼群
}

/**
 * 画一格。
 *
 * 统一的画法约定：
 *   · 朝向一律**朝右**（+x）—— 着色器按航向旋转，起点必须一致
 *   · 只用白色 + 透明度，颜色交给着色器（这样能跟着板块主色变）
 *   · 留 4px 边距，避免线性采样时和相邻格子串色
 */
function drawCell(g: CanvasRenderingContext2D, kind: Kind) {
  const S = CELL
  const c = S / 2 // 中心
  g.save()
  g.translate(c, c)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.strokeStyle = '#fff'
  g.fillStyle = '#fff'

  switch (kind) {
    case Kind.Cargo: {
      // 货轮：长船体 + 一摞集装箱 + 船楼在尾部
      g.lineWidth = 2.5
      g.beginPath()
      g.moveTo(-22, 2)
      g.lineTo(20, 2)
      g.lineTo(16, 9)
      g.lineTo(-19, 9)
      g.closePath()
      g.fill()
      // 集装箱：三摞高低不一，这是「货轮」最好认的特征
      g.fillRect(-16, -6, 9, 8)
      g.fillRect(-5, -9, 9, 11)
      g.fillRect(6, -5, 7, 7)
      // 船楼
      g.fillRect(-22, -8, 5, 10)
      break
    }
    case Kind.Carrier: {
      // 航母：宽平的飞行甲板 + 右舷舰岛 + 甲板上的斜角线
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(-24, -2)
      g.lineTo(22, -2)
      g.lineTo(18, 6)
      g.lineTo(-21, 6)
      g.closePath()
      g.fill()
      // 舰岛（偏右后）—— 航母区别于其它船的关键
      g.fillRect(4, -9, 6, 8)
      g.fillRect(6, -14, 2, 5) // 桅杆
      // 甲板斜角跑道
      g.globalAlpha = 0.55
      g.lineWidth = 1.4
      g.beginPath()
      g.moveTo(-20, 3)
      g.lineTo(14, -0.5)
      g.stroke()
      g.globalAlpha = 1
      break
    }
    case Kind.Warship: {
      // 军舰：瘦长、尖艏、高桅杆 + 炮塔
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(-18, 1)
      g.lineTo(22, 4) // 尖艏
      g.lineTo(-16, 8)
      g.closePath()
      g.fill()
      // 上层建筑 + 桅杆
      g.fillRect(-6, -6, 8, 7)
      g.beginPath()
      g.moveTo(-2, -6)
      g.lineTo(-2, -16)
      g.lineWidth = 2
      g.stroke()
      // 前主炮
      g.fillRect(6, -2, 6, 4)
      break
    }
    case Kind.Boat: {
      // 渔船：小船体 + 一张三角帆，最容易一眼认出来的剪影
      g.lineWidth = 2.2
      g.beginPath()
      g.moveTo(-12, 4)
      g.lineTo(13, 4)
      g.lineTo(9, 11)
      g.lineTo(-9, 11)
      g.closePath()
      g.fill()
      // 桅杆 + 帆
      g.beginPath()
      g.moveTo(0, 4)
      g.lineTo(0, -16)
      g.stroke()
      g.beginPath()
      g.moveTo(1, -15)
      g.lineTo(12, 2)
      g.lineTo(1, 2)
      g.closePath()
      g.fill()
      break
    }
    case Kind.Whale: {
      // 鲸鱼：圆胖身体 + 大尾鳍 + 喷出的水柱（跃出海面的样子）
      g.beginPath()
      g.ellipse(-2, 2, 18, 8, 0, 0, Math.PI * 2)
      g.fill()
      // 尾鳍（在左侧，因为朝向右）
      g.beginPath()
      g.moveTo(-18, 2)
      g.lineTo(-27, -6)
      g.lineTo(-24, 2)
      g.lineTo(-27, 9)
      g.closePath()
      g.fill()
      // 背鳍
      g.beginPath()
      g.moveTo(0, -6)
      g.lineTo(3, -12)
      g.lineTo(7, -5)
      g.closePath()
      g.fill()
      // 喷水柱 —— 「鲸鱼」的标志
      g.globalAlpha = 0.7
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(9, -6)
      g.lineTo(11, -16)
      g.moveTo(9, -6)
      g.lineTo(15, -14)
      g.stroke()
      g.globalAlpha = 1
      break
    }
    case Kind.Shark: {
      // 鲨鱼：流线型身体 + 标志性的高背鳍 + 新月形尾
      g.beginPath()
      g.moveTo(20, 2) // 吻部
      g.quadraticCurveTo(2, -7, -14, -2)
      g.quadraticCurveTo(2, 9, 20, 2)
      g.fill()
      // 背鳍 —— 鲨鱼的识别特征，画得高而尖
      g.beginPath()
      g.moveTo(0, -5)
      g.lineTo(4, -17)
      g.lineTo(9, -3)
      g.closePath()
      g.fill()
      // 新月尾
      g.beginPath()
      g.moveTo(-14, -2)
      g.lineTo(-24, -10)
      g.lineTo(-19, -1)
      g.lineTo(-24, 7)
      g.closePath()
      g.fill()
      break
    }
    case Kind.FishBig: {
      // 大鱼：经典的鱼形剪影 + 叉尾
      g.beginPath()
      g.moveTo(18, 0)
      g.quadraticCurveTo(2, -10, -10, 0)
      g.quadraticCurveTo(2, 10, 18, 0)
      g.fill()
      g.beginPath()
      g.moveTo(-10, 0)
      g.lineTo(-21, -8)
      g.lineTo(-16, 0)
      g.lineTo(-21, 8)
      g.closePath()
      g.fill()
      // 眼睛（挖个洞，让它看着是条鱼而不是个梭子）
      g.globalCompositeOperation = 'destination-out'
      g.beginPath()
      g.arc(11, -1, 2, 0, Math.PI * 2)
      g.fill()
      g.globalCompositeOperation = 'source-over'
      break
    }
    case Kind.FishSmall: {
      // 小鱼群：三条一组，错开排布 —— 单独一条小鱼太小看不见
      const one = (ox: number, oy: number, s: number) => {
        g.save()
        g.translate(ox, oy)
        g.scale(s, s)
        g.beginPath()
        g.moveTo(9, 0)
        g.quadraticCurveTo(1, -5, -5, 0)
        g.quadraticCurveTo(1, 5, 9, 0)
        g.fill()
        g.beginPath()
        g.moveTo(-5, 0)
        g.lineTo(-11, -4)
        g.lineTo(-8, 0)
        g.lineTo(-11, 4)
        g.closePath()
        g.fill()
        g.restore()
      }
      one(6, -8, 1)
      one(-6, 2, 1.15)
      one(8, 10, 0.85)
      break
    }
  }
  g.restore()
}

/**
 * 生成图集纹理。
 *
 * ⚠️ 走 canvas 而不是外部图片 —— 「零二进制资源」是这个项目的硬约束
 * （见 CLAUDE/记忆：要炫酷也要轻量）。整张图集约 256×128，
 * 生成一次缓存住，代价可以忽略。
 */
export function buildOceanAtlas(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = CELL * ATLAS_COLS
  cv.height = CELL * ATLAS_ROWS
  const g = cv.getContext('2d')!

  for (let i = 0; i < ATLAS_COLS * ATLAS_ROWS; i++) {
    const cx = (i % ATLAS_COLS) * CELL
    const cy = Math.floor(i / ATLAS_COLS) * CELL
    g.save()
    g.translate(cx, cy)
    drawCell(g, i as Kind)
    g.restore()
  }

  const tex = new THREE.CanvasTexture(cv)
  // 图集采样：关掉 mipmap 的话远处会闪，但开了又会在格子边界串色。
  // 折中：开 mipmap + 线性过滤，靠每格 4px 的留白挡住串色。
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}
