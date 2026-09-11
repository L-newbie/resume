// ─────────────────────────────────────────────────────────────
// 球体几何 —— 大洲的形状就是**板块名本身**。
//
// 球面不是均匀铺满的点云：每块大洲是一组按板块名字形排布的点，
// 「个人信息」「能力」「工作经历」「项目」「联系我」五组，
// 散布在球面两个纬度带上。每块大洲 = 一个板块，
// 转到正面的那块自动高亮 + 弹出小屏。
//
// 生成方式：把板块名画到离屏 canvas，读像素做成布尔掩码（见
// textMask.ts）；球面采样时把经纬度换算成该块的局部 UV 查掩码。
//
// ⚠️ 这里曾经是「距离场 + 分形噪声」生成的不规则大陆（带海岸线、
// 半岛）。改成文字之后 angDist / fbm 都没有了用武之地，已删除；
// 要找那套实现请翻 git 历史。
//
// 全部程序生成，零资源文件。
// ─────────────────────────────────────────────────────────────

import { maskHit, textMask } from './textMask'

/** 确定性伪随机 —— 同一 seed 每次刷新形态一致，不会闪 */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 大洲数 = 板块数 */
export const FACES = 5

/** 球半径（世界单位） */
export const ORB_RADIUS = 7.4

/**
 * 陆地相对海面抬升多少（占半径的比例）。
 *
 * 0.035 ≈ 球半径的 3.5%，在屏幕上是十几个像素 —— 看得出「陆地是厚的」，
 * 又不至于让球变成一个疙瘩。
 * ⚠️ 别往大调太多：抬得越高，侧面看大洲边缘的「悬崖」越明显，
 * 而这些边缘并没有侧壁几何，会露出破绽。
 */
export const LAND_LIFT = 0.035

// ─────────────────────────────────────────────────────────────
// 大洲定义
//
// 每块大洲一个中心（经度 lon / 纬度 lat），加上若干子核 ——
// 子核让轮廓变成不规则的团块而不是一个圆，这是「像大陆」的关键。
//
// ⚠️ 中心位置的排布规则（改之前先读这段，这里踩过坑）：
//
//   **经度必须单调递增**，这条是硬约束。
//   巡航是 cursor 0→1→2… 依次走的，相机从一块转到下一块时若经度
//   不单调，途中会正对到别的大洲 —— 表现就是「转过来的板块和
//   cursor 对不上」「有的板块被跳过」。早先排成 60/180/300/0/…
//   就是栽在这里。
//
//   除此之外**刻意不规则**：
//   经度间隔 62/79/63/59（不是等距的 72），纬度 −31/33/−6/34/−27
//   五个值各不相同（不是 ±20 交替）。等距 + 交替的排布转一圈就能
//   预判下一块在哪，像个转盘而不像星球。
//
//   两条量化底线，改坐标时必须重新验：
//   · 任意两块的角距离 ≥ 62°（当前 71.8°）—— 小于 60° 会两块
//     同时进画面，构图上分不出主角
//   · |纬度| + 纬度半跨 ≤ 85° —— 越过极点文字会被经线挤变形
//     （当前最大 45°）

interface Continent {
  /** 文字中心的经度（度，0–360） */
  lon: number
  /** 文字中心的纬度（度，-90–90） */
  lat: number
  /** 板块名 —— 它的字形就是这块大洲的轮廓 */
  text: string
  /** 经度方向的跨度（度） */
  spanLon: number
  /** 纬度方向的跨度（度） */
  spanLat: number
}

/*
  ⚠️ 纬度**全部为 0**（2026-09-08 用户要求）。

  曾经是南北交替（−31/+33/−6/+34/−27），本意是让球面看着不呆板。
  但相机停靠时会跟着 pitch 上下摆（见 poseFor），于是每块板块的
  名字一会儿靠上一会儿靠下，球面照片也跟着偏出画面中心。
  用户原话：「每一个板块旋转板块名字都要和工作经历一样在中间显示，
  这样图像也可以展示的很好，不要靠上或者靠下」。

  ⚠️ 经度仍必须**单调递增**（21/83/162/225/284）——
  巡航是按顺序一块块转过去的，不单调的话中途会正对到别的大洲，
  faceAt 半路命中它，表现为「板块转过来直接跳走」。
  ⚠️ 相邻两块的经度间距要大于两者的半跨之和，否则陆地连成一片：
  间距 62/79/63/59/97，半跨和 48/48/48/41/55，都留有余量。
  （纬度归零后 landInfo 里的 cos(lat) 补偿系数变成 1，
  每块的经度跨度比原来还窄一点，只会更安全。）
*/
const CONTINENTS: Continent[] = [
  // 00 个人信息 —— 4 字，横向最长
  { lon: 21, lat: 0, text: '个人信息', spanLon: 62, spanLat: 24 },
  // 01 能力 —— 2 字，方形
  { lon: 83, lat: 0, text: '能力', spanLon: 34, spanLat: 22 },
  // 02 工作经历 —— 4 字
  { lon: 162, lat: 0, text: '工作经历', spanLon: 62, spanLat: 24 },
  // 03 项目 —— 2 字
  { lon: 225, lat: 0, text: '项目', spanLon: 34, spanLat: 22 },
  // 04 联系我 —— 3 字
  { lon: 284, lat: 0, text: '联系我', spanLon: 48, spanLat: 23 },
]

const DEG = Math.PI / 180

export interface OrbGeometry {
  /** n*3 球面位置 */
  sphere: Float32Array
  /** 归属哪块大洲（0–4）；海洋点记 -1 */
  face: Float32Array
  size: Float32Array
  seed: Float32Array
  hue: Float32Array
  /** 1 = 陆地，0 = 海洋 */
  land: Float32Array
  count: number
}

/**
 * 这个点属于哪块大洲（-1 = 海洋）。
 *
 * 做法：对每块大洲求「到最近子核的距离 − 该子核半径」，
 * 得到一个有符号距离场；再叠噪声扰动边界，负值即陆地。
 * 取所有大洲里最「深入内陆」的那块作为归属。
 */
function landAt(lon: number, lat: number): number {
  return landInfo(lon, lat).face
}

/**
 * 陆地归属 + **深入内陆的程度**。
 *
 * depth 是有符号距离场的绝对值（度）：海岸线上约 0，越往内陆越大。
 * 抬升高度用它 —— 海岸低、内陆高，才有「大陆是隆起的一块」的感觉，
 * 整块等高地抬起来只会像一个圆盘扣在球上。
 */
function landInfo(lon: number, lat: number): { face: number; depth: number } {
  for (let c = 0; c < CONTINENTS.length; c++) {
    const ct = CONTINENTS[c]

    // 经度差要取环绕最近的那一个（0° 和 359° 只差 1°，不是 359°）
    let dLon = lon - ct.lon
    dLon = ((dLon % 360) + 540) % 360 - 180
    const dLat = lat - ct.lat

    /*
      ⚠️ 经度跨度按纬度收缩。
      高纬处同样的经度差对应更短的实际弧长，不补偿的话字会被
      横向拉宽 —— 纬度 ±20° 时差约 6%，肉眼可见。
    */
    const shrink = Math.max(0.35, Math.cos(ct.lat * DEG))
    const halfLon = ct.spanLon / 2 / shrink
    const halfLat = ct.spanLat / 2

    if (Math.abs(dLon) > halfLon || Math.abs(dLat) > halfLat) continue

    /*
      落进这块的范围 → 换算成掩码的归一化坐标。

      ⚠️ u 要**取反**（0.5 − 而不是 0.5 +），否则字是左右镜像的。
      球面点是 (cos θ·cos lat, sin lat, sin θ·cos lat)，正对某块时
      yaw = 中心经度 − π/2；代进绕 Y 的旋转后，**经度增大 → 世界 x
      减小 → 屏幕偏左**。而掩码的 u 是从左(0)到右(1)。
      两者方向相反，所以必须翻过来。
      （实测：+20° 相对经度落在屏幕 x = −0.32，确实在左边。）
    */
    const u = 0.5 - (dLon / halfLon) * 0.5
    // v 要翻转：纬度向北为正，而掩码的 y 向下为正
    const v = 0.5 - (dLat / halfLat) * 0.5

    const m = textMask(ct.text)
    if (!maskHit(m, u, v)) continue

    /*
      depth 供陆地抬升用（海岸低、内陆高）。
      字形没有「内陆」的概念，改用**到笔画边缘的距离**：
      在 3×3 邻域里数命中的格子，全中说明在笔画中心。
      这样笔画中间比边缘高一点，字看起来是「浮起来的一笔」
      而不是一块等高的贴纸。
    */
    let around = 0
    const du = 1 / m.w
    const dv = 1 / m.h
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (maskHit(m, u + ox * du * 2, v + oy * dv * 2)) around++
      }
    }
    // around ∈ 1..9 → depth 0..12（沿用原来的量纲，抬升公式不用改）
    return { face: c, depth: ((around - 1) / 8) * 12 }
  }
  return { face: -1, depth: 0 }
}

/**
 * 生成球体点云。
 *
 * 陆地点密、海洋点稀 —— 海洋点不是装饰，它们让「球」这个形状立得住：
 * 没有它们，六块大洲会像浮空的碎片，看不出是个球。
 */
export function buildOrb(n: number): OrbGeometry {
  const rand = mulberry32(11)
  // ── 超采样倍率 ──
  // 拒绝采样会丢掉绝大部分点，这里要把丢掉的补回来，使最终点数 ≈ n。
  //
  // ⚠️ 大洲改成文字字形后陆地占比**大幅下降**：五块文字框合计占
  // 球面 13.4%，而中文笔画只占框内约 30% —— 实际陆地仅约 4%。
  // （之前不规则大陆是 10.4%，倍率 6.7；再往前 6 块时是 12.4%。）
  // 保留率 = 0.04 + 0.96×0.05 ≈ 0.088，1/0.088 ≈ 11.3。
  // 倍率不够的话笔画会断成一截截，字根本认不出来。
  // ⚠️ 改文案、跨度或海洋保留率都要重算这个数。
  const N = Math.floor(n * 11.3)

  const sph: number[] = []
  const fcs: number[] = []
  const szs: number[] = []
  const sds: number[] = []
  const hus: number[] = []
  const lnd: number[] = []

  for (let i = 0; i < N; i++) {
    // 斐波那契球面分布：点间距均匀，不在两极堆积
    const y = 1 - (i / Math.max(1, N - 1)) * 2
    const rr = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = (i * Math.PI * (3 - Math.sqrt(5))) % (Math.PI * 2)

    const lonDeg = (theta / DEG) % 360
    const latDeg = Math.asin(Math.max(-1, Math.min(1, y))) / DEG
    const info = landInfo(lonDeg, latDeg)
    const f = info.face
    const isLand = f >= 0

    // 海洋点抽得更稀。本体现在是**真的海**（有深浅、洋流、阳光反射，
    // 见 bodyFragment），这些点只是浮在海面上的碎光 ——
    // 留太多会盖住下面的洋流纹理，反而把海弄脏。
    if (!isLand && rand() > 0.05) continue

    // ── 陆地抬升 ──
    // 陆地整块浮在海面之上，形成看得见的「厚度」。
    // 高度按深入内陆的程度给：海岸线附近几乎贴着海面，
    // 内陆隆起到最高 —— 整块等高地抬起来会像个圆盘扣在球上，不像大陆。
    // 12° 内陆就到满高；再深也不继续长，否则大块大洲会鼓成山包。
    const inland = isLand ? Math.min(1, info.depth / 12) : 0
    // smoothstep 让海岸到内陆的爬升是缓的，不是一道坎
    const lift = inland * inland * (3 - 2 * inland) * LAND_LIFT

    // ⚠️ 抖动只往**上**加，不能往下减。
    // 原来是 ±0.05 居中抖动，海岸线附近 lift≈0 的点会掉到 0.975，
    // 低于实心球体的 0.985 —— 那些点直接被球体吞掉，海岸一圈会缺一块。
    // 抖动收得很小（陆地 0.012）—— 大了会把陆地顶得比海岸线还高，
    // 也会戳穿 halo 外壳。真正的「厚度」来自 lift，不是靠抖动。
    const jitter = rand() * (isLand ? 0.012 : 0.008)
    const rad = ORB_RADIUS * (1 + lift + jitter)
    sph.push(Math.cos(theta) * rr * rad, y * rad, Math.sin(theta) * rr * rad)

    fcs.push(f)
    szs.push(isLand ? 0.62 + Math.pow(rand(), 2.2) * 2.4 : 0.32 + rand() * 0.45)
    sds.push(rand())
    hus.push(rand())
    lnd.push(isLand ? 1 : 0)
  }

  return {
    sphere: new Float32Array(sph),
    face: new Float32Array(fcs),
    size: new Float32Array(szs),
    seed: new Float32Array(sds),
    hue: new Float32Array(hus),
    land: new Float32Array(lnd),
    count: lnd.length,
  }
}

/**
 * 大洲海岸线（LineSegments 用）。
 *
 * 沿陆海边界描亮线 —— 这是「看得出是大洲」的关键：
 * 光靠点云疏密，边界是糊的；描了边，陆地立刻分明。
 *
 * 做法：在经纬网格上做 marching squares —— 逐个格子看相邻两角的
 * 陆海状态，状态不同就在中间画一小段线，连起来就是等值线。
 */
export function buildCoast(): {
  sphere: Float32Array
  face: Float32Array
} {
  const sph: number[] = []
  const fcs: number[] = []

  /*
    ⚠️ 网格从 288×144 提到 576×288。
    大洲改成文字字形后，笔画在球面上很细 —— 288×144 时一笔只有
    2–4 格宽，marching squares 描出来的边会把笔画内部糊死，
    字变成一团亮块。加倍分辨率后一笔有 5–8 格，轮廓才描得出来。
    代价是线段数约翻四倍，但这是一次性构建，且线本身很淡。
  */
  const LON_STEPS = 576
  const LAT_STEPS = 288

  const at = (lonDeg: number, latDeg: number) => {
    const theta = (((lonDeg % 360) + 360) % 360) * DEG
    const y = Math.sin(latDeg * DEG)
    const rr = Math.sqrt(Math.max(0, 1 - y * y))
    // 海岸线画在陆地边缘的顶面上，压过那里的抖动上限（1.012）一点点。
    // 不跟着 LAND_LIFT 走 —— 交界处的陆地本来就还没抬起来，
    // lift 是按深入内陆的程度给的，海岸线上 inland≈0。
    const rad = ORB_RADIUS * 1.016
    return [Math.cos(theta) * rr * rad, y * rad, Math.sin(theta) * rr * rad] as const
  }

  // 先把整张陆海图算出来，避免 marching 时重复调用 landAt
  const grid: number[][] = []
  for (let j = 0; j <= LAT_STEPS; j++) {
    const row: number[] = []
    const latDeg = -90 + (j / LAT_STEPS) * 180
    for (let i = 0; i <= LON_STEPS; i++) {
      row.push(landAt((i / LON_STEPS) * 360, latDeg))
    }
    grid.push(row)
  }

  const lonAt = (i: number) => (i / LON_STEPS) * 360
  const latAt = (j: number) => -90 + (j / LAT_STEPS) * 180

  for (let j = 0; j < LAT_STEPS; j++) {
    for (let i = 0; i < LON_STEPS; i++) {
      const a = grid[j][i]
      const b = grid[j][i + 1]
      const c = grid[j + 1][i]
      const lonMid = (lonAt(i) + lonAt(i + 1)) / 2
      const latMid = (latAt(j) + latAt(j + 1)) / 2

      // 横向边界
      if ((a >= 0) !== (b >= 0)) {
        const f = a >= 0 ? a : b
        sph.push(...at(lonMid, latAt(j)), ...at(lonMid, latMid))
        fcs.push(f, f)
      }
      // 纵向边界
      if ((a >= 0) !== (c >= 0)) {
        const f = a >= 0 ? a : c
        sph.push(...at(lonAt(i), latMid), ...at(lonMid, latMid))
        fcs.push(f, f)
      }
    }
  }

  return { sphere: new Float32Array(sph), face: new Float32Array(fcs) }
}

/**
 * 经纬网格线 —— 地球仪的坐标系。
 * 它让「球」这个形状立得住：只有散点的话看不出是球面还是一团雾。
 */
export function buildGrid(): { sphere: Float32Array; face: Float32Array } {
  const sph: number[] = []
  const fcs: number[] = []

  const push = (theta: number, y: number) => {
    const rr = Math.sqrt(Math.max(0, 1 - y * y))
    sph.push(
      Math.cos(theta) * rr * ORB_RADIUS,
      y * ORB_RADIUS,
      Math.sin(theta) * rr * ORB_RADIUS
    )
    // 网格线不属于任何大洲，记 -1（不参与高亮）
    fcs.push(-1)
  }

  // 纬线
  const LAT = 7
  const SEG = 120
  for (let la = 1; la <= LAT; la++) {
    const y = -1 + (la / (LAT + 1)) * 2
    for (let k = 0; k < SEG; k++) {
      push((k / SEG) * Math.PI * 2, y)
      push(((k + 1) / SEG) * Math.PI * 2, y)
    }
  }

  // 经线
  const LON = 12
  const VSEG = 40
  for (let lo = 0; lo < LON; lo++) {
    const theta = (lo / LON) * Math.PI * 2
    for (let k = 0; k < VSEG; k++) {
      // 用 sin 分布让两极附近取样更密
      push(theta, Math.sin(-Math.PI / 2 + (k / VSEG) * Math.PI))
      push(theta, Math.sin(-Math.PI / 2 + ((k + 1) / VSEG) * Math.PI))
    }
  }

  return { sphere: new Float32Array(sph), face: new Float32Array(fcs) }
}

/**
 * 6 个小屏的锚点 —— 每块大洲的**视觉重心**，贴在球面上。
 *
 * ⚠️ 不能直接用 CONTINENTS 里声明的主中心。大洲是若干子核并起来的
 * 不规则形状，主中心不等于视觉重心：能力(04) 的子核在 +17° 和 −13°，
 * 整体明显右偏，实测重心离主中心 4.8°；项目(03) 偏 5.2°。
 * 用主中心的话引线的终点会落在陆地边上甚至海里，「标记插在大洲中心」
 * 这个感觉就没了 —— 用户第一眼就是在能力那块看出来的。
 *
 * 做法：在经纬网格上采样陆地点，按 landAt 的归属求每块的三维重心，
 * 再归一化投回球面。三维平均而不是经纬度平均 —— 后者在跨 0°/360°
 * 的大洲上会算出完全错误的结果（比如 350° 和 10° 平均成 180°）。
 *
 * 半径必须贴着球面（1.01，只比海岸线的 1.014 略低一点点）。
 * 曾经用 1.1 让它「浮」在球面外，结果引线的终点看着是悬空的。
 */
export function faceAnchors(): [number, number, number][] {
  const acc = Array.from({ length: FACES }, () => ({ x: 0, y: 0, z: 0, n: 0 }))

  // 采样密度够粗即可 —— 重心是统计量，128×64 已经稳定到小数点后一位
  const LON_N = 128
  const LAT_N = 64
  for (let j = 0; j <= LAT_N; j++) {
    const latDeg = -90 + (j / LAT_N) * 180
    const lat = latDeg * DEG
    // 按纬度加权：高纬的格子在球面上覆盖的面积更小
    const w = Math.cos(lat)
    for (let i = 0; i < LON_N; i++) {
      const lonDeg = (i / LON_N) * 360
      const f = landAt(lonDeg, latDeg)
      if (f < 0) continue
      const theta = lonDeg * DEG
      const a = acc[f]
      a.x += Math.cos(theta) * Math.cos(lat) * w
      a.y += Math.sin(lat) * w
      a.z += Math.sin(theta) * Math.cos(lat) * w
      a.n += w
    }
  }

  // 锚点要浮在**抬升后的陆地顶面**之上，否则引线的终点会陷进地里。
  // 1.05 略高于最高陆地（1 + LAND_LIFT + 抖动 ≈ 1.047）。
  const rad = ORB_RADIUS * 1.05
  return acc.map((a, f) => {
    // 兜底：万一某块大洲被噪声吃光了，退回声明的主中心，
    // 总比返回 (0,0,0) 让引线指向球心强
    if (a.n === 0) {
      const c = CONTINENTS[f]
      const theta = (((c.lon % 360) + 360) % 360) * DEG
      const y = Math.sin(c.lat * DEG)
      const rr = Math.sqrt(Math.max(0, 1 - y * y))
      return [Math.cos(theta) * rr * rad, y * rad, Math.sin(theta) * rr * rad]
    }
    const len = Math.hypot(a.x, a.y, a.z) || 1
    return [(a.x / len) * rad, (a.y / len) * rad, (a.z / len) * rad]
  })
}

/** 每块大洲的中心经纬度（度）—— 相机要转到它正面时用 */
export function continentCenters(): { lon: number; lat: number }[] {
  return CONTINENTS.map((c) => ({ lon: c.lon, lat: c.lat }))
}

/**
 * 每块大洲的中心 + 经纬跨度 —— 照片弧面要按这个尺寸贴。
 * 和 continentCenters 分开是因为绝大多数调用方只要中心点，
 * 多带两个字段会让那些地方的类型平白变宽。
 */
export function continentBounds(): {
  lon: number
  lat: number
  spanLon: number
  spanLat: number
}[] {
  return CONTINENTS.map((c) => ({
    lon: c.lon,
    lat: c.lat,
    spanLon: c.spanLon,
    spanLat: c.spanLat,
  }))
}

/**
 * 海洋上的数据流弧线。
 *
 * 球面上除了六块大洲，剩下的都是很稀疏的海洋点 —— 空得发慌。
 * 这些弧线填在那里：从一块大洲的中心出发，沿**大圆**走到另一块，
 * 像洲际之间的数据链路。配合着色器里沿弧行进的亮点，
 * 观感是「有数据在两块大陆之间流动」，呼应数据闭环这个主题。
 *
 * 每段线带两个属性：
 *   aT     它在整条弧上的位置 0–1 —— 着色器据此让亮点跑起来
 *   aFace  这条弧从哪块大洲出发 —— 那块高亮时整条弧跟着亮
 *
 * ⚠️ 只连**相邻**的大洲（i → i+1）。连成全图（每两块都连）时试过一次，
 * 15 条弧糊成一团毛线球，反而把大洲盖住了。6 条刚好。
 */
export function buildFlows(): {
  sphere: Float32Array
  t: Float32Array
  face: Float32Array
} {
  const sph: number[] = []
  const ts: number[] = []
  const fcs: number[] = []

  /** 经纬度 → 单位向量 */
  const dir = (lonDeg: number, latDeg: number): [number, number, number] => {
    const lon = lonDeg * DEG
    const lat = latDeg * DEG
    return [Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat)]
  }

  const SEG = 48
  for (let i = 0; i < CONTINENTS.length; i++) {
    const a = CONTINENTS[i]
    const b = CONTINENTS[(i + 1) % CONTINENTS.length]
    const va = dir(a.lon, a.lat)
    const vb = dir(b.lon, b.lat)

    // 两端点的夹角 —— 球面插值（slerp）要用
    const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]))
    const omega = Math.acos(dot)
    const sinO = Math.sin(omega) || 1e-6

    const at = (u: number): [number, number, number] => {
      // 沿大圆做球面线性插值 —— 直接对坐标做线性插值会「切进球里」，
      // 弧线会陷到球面以下，被实心球体挡住看不见。
      const k0 = Math.sin((1 - u) * omega) / sinO
      const k1 = Math.sin(u * omega) / sinO
      const x = va[0] * k0 + vb[0] * k1
      const y = va[1] * k0 + vb[1] * k1
      const z = va[2] * k0 + vb[2] * k1
      const l = Math.hypot(x, y, z) || 1
      // 抬到 1.052：必须高过**最高的陆地**（1 + LAND_LIFT + 抖动 ≈ 1.047），
      // 否则弧线飞到内陆上空时会被隆起的陆地埋掉。
      const r = (ORB_RADIUS * 1.052) / l
      return [x * r, y * r, z * r]
    }

    // ⚠️ 只画中间那段，两端各留出来。
    // 端点是大洲**中心**，整条弧照画的话前后各有一截压在陆地上 ——
    // 实测 50% 的弧长盖着大洲，把地形糊住了。
    // 掐掉两端 28% 之后，弧从一块大陆的近海出发、落到另一块的近海，
    // 「洲际链路」的意思还在，但不压地形。
    const TRIM = 0.28
    for (let k = 0; k < SEG; k++) {
      const u0 = TRIM + (k / SEG) * (1 - TRIM * 2)
      const u1 = TRIM + ((k + 1) / SEG) * (1 - TRIM * 2)
      sph.push(...at(u0), ...at(u1))
      // aT 仍归一化到 0–1，亮点才能跑满整条可见的弧
      ts.push(k / SEG, (k + 1) / SEG)
      fcs.push(i, i)
    }
  }

  return {
    sphere: new Float32Array(sph),
    t: new Float32Array(ts),
    face: new Float32Array(fcs),
  }
}

/**
 * 海面上的居民 —— 船只与海洋生物。
 *
 * 每一个都带：所在经纬度、航向、种类、相位。
 * 着色器让它们**沿各自的大圆航线漂移**，所以位置是 GPU 每帧算的，
 * 这里只给出发点和方向。
 *
 * ⚠️ 位置必须真的在海上。做法是拒绝采样：随机取点，
 * `landAt < 0` 才收；还要求离最近的陆地有一段距离，
 * 否则船会紧贴海岸线看着像搁浅了。
 */
export interface OceanLife {
  /** n*3 出发点（单位向量，半径在着色器里给） */
  origin: Float32Array
  /** n*3 航向（切向单位向量，垂直于 origin） */
  heading: Float32Array
  /** 种类 = 图集里的格子号 */
  kind: Float32Array
  /** 各自的相位 / 速度扰动，避免所有个体整齐划一 */
  seed: Float32Array
  count: number
}

/**
 * 各种类的投放比例。
 * 小鱼群和渔船最多（海面上本来就是小东西多），
 * 航母最少 —— 太多就不稀奇了。
 * 索引对应 oceanSprites.ts 的 Kind。
 */
const LIFE_MIX = [
  { kind: 0, weight: 14 }, // 货轮
  { kind: 1, weight: 3 }, // 航母
  { kind: 2, weight: 8 }, // 军舰
  { kind: 3, weight: 18 }, // 渔船
  { kind: 4, weight: 7 }, // 鲸鱼
  { kind: 5, weight: 8 }, // 鲨鱼
  { kind: 6, weight: 14 }, // 大鱼
  { kind: 7, weight: 20 }, // 小鱼群
]

/**
 * @param n     大致投放多少个（实际数量会在这个数上下浮动）
 * @param seed  随机种子。**不传就每次刷新都不一样** ——
 *              用户要求「所有事物随机出现、随机数量」，
 *              固定种子会让每次进站看到的是同一支船队。
 *              （地形用固定种子，那个必须稳定；这里相反。）
 */
export function buildOceanLife(n: number, seed?: number): OceanLife {
  const rand = mulberry32(seed ?? Math.floor(Math.random() * 0xffffffff))
  const org: number[] = []
  const hdg: number[] = []
  const knd: number[] = []
  const sds: number[] = []

  // 按权重展开成抽签池
  const pool: number[] = []
  for (const m of LIFE_MIX) for (let i = 0; i < m.weight; i++) pool.push(m.kind)

  // 数量本身也随机：在 n 的 ±35% 之间浮动。
  // 固定数量的话，即使位置随机，「海上永远是 110 个」也会被看出来。
  const target = Math.max(6, Math.round(n * (0.65 + rand() * 0.7)))

  let guard = 0
  while (knd.length < target && guard < target * 200) {
    guard++
    // 球面均匀采样（不能直接 rand 纬度，那样两极会挤成一堆）
    const u = rand() * 2 - 1
    const theta = rand() * Math.PI * 2
    const lat = Math.asin(u) / DEG
    const lon = (theta / DEG) % 360

    /*
      必须在海上，而且要离文字块有一段距离。

      ⚠️ 判据是「整块文字框之外」，不是「当前点不在笔画上」。
      大洲改成字形后笔画之间全是缝隙 —— 逐点判断的话船会生成在
      「工」字的两横之间，观感是卡在字里。
      早先那版还在四个方向各采样一次，同样漏：缝隙比 3.5° 宽时
      四个方向可能都落在空白处。
      直接按文字框排除，再留 4° 余量。
    */
    if (nearAnyText(lon, lat, 4)) continue

    const rr = Math.sqrt(Math.max(0, 1 - u * u))
    const ox = Math.cos(theta) * rr
    const oy = u
    const oz = Math.sin(theta) * rr

    // 航向：球面上任取一个切向。
    // 做法是拿一个不平行于法线的参考向量叉乘两次。
    const refY = Math.abs(oy) < 0.9 ? [0, 1, 0] : [1, 0, 0]
    // t1 = normalize(cross(o, ref)) —— 切平面上的一个基
    let tx = oy * refY[2] - oz * refY[1]
    let ty = oz * refY[0] - ox * refY[2]
    let tz = ox * refY[1] - oy * refY[0]
    let tl = Math.hypot(tx, ty, tz) || 1
    tx /= tl
    ty /= tl
    tz /= tl
    // t2 = cross(o, t1) —— 切平面上另一个基，和 t1 垂直
    const bx = oy * tz - oz * ty
    const by = oz * tx - ox * tz
    const bz = ox * ty - oy * tx
    // 在切平面里随机转一个角度，得到最终航向
    const a = rand() * Math.PI * 2
    const hx = tx * Math.cos(a) + bx * Math.sin(a)
    const hy = ty * Math.cos(a) + by * Math.sin(a)
    const hz = tz * Math.cos(a) + bz * Math.sin(a)

    org.push(ox, oy, oz)
    hdg.push(hx, hy, hz)
    knd.push(pool[Math.floor(rand() * pool.length)])
    sds.push(rand())
  }

  return {
    origin: new Float32Array(org),
    heading: new Float32Array(hdg),
    kind: new Float32Array(knd),
    seed: new Float32Array(sds),
    count: knd.length,
  }
}

/**
 * 这个经纬度是否落在**任何一块文字的外接框**内（含 pad 度的余量）。
 *
 * 和 landAt 的区别：landAt 判「是不是笔画」，这里判「是不是那块字的
 * 地盘」。船只投放要用后者 —— 笔画之间的缝隙虽然是「海」，
 * 但把船放进去看着像卡在字里。
 */
function nearAnyText(lon: number, lat: number, pad: number): boolean {
  for (const ct of CONTINENTS) {
    let dLon = lon - ct.lon
    dLon = (((dLon % 360) + 540) % 360) - 180
    const shrink = Math.max(0.35, Math.cos(ct.lat * DEG))
    const halfLon = ct.spanLon / 2 / shrink + pad
    const halfLat = ct.spanLat / 2 + pad
    if (Math.abs(dLon) <= halfLon && Math.abs(lat - ct.lat) <= halfLat) {
      return true
    }
  }
  return false
}

/**
 * 这个方向上是不是开阔海面 —— 点击触发事件前用它判断。
 *
 * @param v 单位向量（球面上的方向）
 */
export function isOcean(v: [number, number, number]): boolean {
  const lat = Math.asin(Math.max(-1, Math.min(1, v[1]))) / DEG
  let lon = Math.atan2(v[2], v[0]) / DEG
  if (lon < 0) lon += 360
  return landAt(lon, lat) < 0
}
