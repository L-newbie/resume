import * as THREE from 'three'
import {
  buildCoast,
  buildFlows,
  buildGrid,
  buildOceanLife,
  buildOrb,
  isOcean,
  continentCenters,
  faceAnchors,
  FACES,
  ORB_RADIUS,
} from './orbGeometry'
import {
  bodyFragment,
  bodyVertex,
  flowFragment,
  flowVertex,
  eventFragment,
  eventVertex,
  lifeFragment,
  lifeVertex,
  haloFragment,
  haloVertex,
  lineFragment,
  lineVertex,
  orbFragment,
  orbVertex,
  photoFragment,
  photoVertex,
} from './shaders'
import { ATLAS_COLS, ATLAS_ROWS, buildOceanAtlas } from './oceanSprites'
import type { Capability } from '../lib/capability'
import { sectionPhoto } from '../content/data'

// ─────────────────────────────────────────────────────────────
// 悬浮地球仪。
//
// 交互模型：
//   · 球面是六块大洲，每块 = 一个板块
//   · 相机**分镜切换**停靠到某块大洲（不是匀速漂移）：
//     停 5.6 秒 → 一步转到下一块 → 再停。转到的那块高亮 + 弹出小屏
//   · 鼠标**停在球上**时暂停巡航（移开就继续）
//   · 可以拖拽自由旋转，松手带惯性并吸附到最近的大洲
//   · 点小屏进板块，球缩到左上角
//
// 小屏本身是 DOM，不是 3D 贴图 —— 场景每帧把锚点投影成屏幕坐标，
// DOM 据此定位。这样文字永远清晰、CSS 辉光好做、hover/click 天然可用。
// ─────────────────────────────────────────────────────────────

/** 球面照片的不透明度 —— 太高会盖住点云的文字 */
/** 边缘光冲击的衰减时长（秒） */
const HALO_PULSE = 1.1

const PHOTO_OPACITY = 0.45

/** 换图交叉淡入的时长（秒）。分镜停靠 5.6 秒，取 0.9 有余量 */
const PHOTO_FADE = 0.9

const DEG = Math.PI / 180

const COLOR_A = new THREE.Color('#3ddfe0') // 基色：青。海洋、经纬网、大气辉光用它

/**
 * 每个板块的主色 —— 转到哪块，整个场景就调到那个色。
 *
 * 顺序必须和 SECTIONS / CONTINENTS 一致（索引即板块号）。
 * 全部取同一亮度档的高饱和色：换色时只有色相在动、明度不跳，
 * 所以过渡看着是「调色」而不是「忽明忽暗」。
 *
 * ⚠️ 别选太暗的颜色。它们要在深空底(#05080f)上做加法混合发光，
 * 暗色叠上去几乎看不见，那一块就会显得「没高亮」。
 */
const SECTION_COLORS = [
  new THREE.Color('#3ddfe0'), // 00 个人信息 · 青
  new THREE.Color('#a78bfa'), // 01 能力 · 紫
  new THREE.Color('#ffb454'), // 02 工作经历 · 琥珀
  new THREE.Color('#4ade80'), // 03 项目 · 绿
  new THREE.Color('#60a5fa'), // 04 联系我 · 蓝
]



export interface SceneInput {
  /** 当前打开的板块索引，-1 = 没打开 */
  active: number
  /** 鼠标悬停的板块索引（悬停在小屏上），-1 = 没悬停 */
  hover: number
  pointer: { x: number; y: number }
}

/** 每个小屏每帧的投影结果，供 DOM 定位 */
export interface PaneProjection {
  /** 小屏本体的屏幕位置。固定在视口中央附近。 */
  x: number
  y: number
  /** 大洲锚点的**真实**投影位置 —— 引线从小屏指向这里 */
  ax: number
  ay: number
  /** 正对度 0–1：1 = 正对观众，0 = 转到球背面 */
  depth: number
  visible: boolean
  /** 是不是当前分镜停靠的那块大洲 —— 只有它显示小屏 */
  focused: boolean
  /**
   * 开机动画是否已经真正开始（onFocus 已发出）。
   *
   * focused 在运镜一开始就为 true，但那时动画还没开始 ——
   * DOM 层必须等 armed 才显示，否则会先闪现一帧旧状态。
   */
  armed: boolean
}

/** 每块大洲停留多久（秒），然后切到下一块。
    必须长于小屏的开机 + 打印全序列（约 3s），否则会打到一半就切走。 */
const DWELL = 5.6
/** 一次分镜切换的时长（秒） */
const CUT = 1.15
/** 用户拖拽后，多久恢复自动巡航（秒） */
const RESUME = 6
/**
 * 上下和左右一样是**无限**的 —— 可以一直翻过极点转下去。
 *
 * 曾经夹在 ±0.72（41°）、后来放宽到 ±1.45（83°），都被用户打回：
 * 「上下转动到最上或最下点就转不动了」。翻过极点后球会上下颠倒，
 * 这是地球仪的正常物理，不是 bug —— 继续转就转回来了。
 */
const TAU = Math.PI * 2

/**
 * 鼠标放大镜的镜区角半径，弧度。
 *
 * 0.34 rad ≈ 19.5°，屏幕上的半径是球半径的 sin(19.5°) ≈ 0.33。
 * 球面照片本身的半跨是 38°，所以镜子在照片上大约是「半径的一半」。
 */
const LENS_R = 0.34
/**
 * 镜心处的放大倍率。1.6 起步，用户说「再大一些」→ 2.3。
 *
 * ⚠️ 上限是 **4.0**，别越过：变形曲线 f(x)=Mx+(2−2M)x²+(M−1)x³ 的导数
 * 判别式是 4(M−1)(M−4)，M≥4 时 f' 在 x∈[0.5,0.8] 一段变负 ——
 * 球面上一圈内容会**翻折**过来盖在自己身上。数值实测：
 * M=4 最小斜率 0.000（临界），M=4.2 已经是 −0.067。
 */
const LENS_M = 2.3

export class OrbScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  /** 球体整体挂在这个 group 上 */
  private root = new THREE.Group()

  private points!: THREE.Points
  private pointsMat!: THREE.ShaderMaterial
  private pointsGeo!: THREE.BufferGeometry
  private coastMat!: THREE.ShaderMaterial
  private coastGeo!: THREE.BufferGeometry
  private gridMat!: THREE.ShaderMaterial
  private gridGeo!: THREE.BufferGeometry
  private bodyMat!: THREE.ShaderMaterial
  private bodyGeo!: THREE.SphereGeometry
  private haloMat!: THREE.ShaderMaterial
  private haloGeo!: THREE.SphereGeometry
  private flowMat!: THREE.ShaderMaterial
  private flowGeo!: THREE.BufferGeometry
  private lifeMat!: THREE.ShaderMaterial
  private lifeGeo!: THREE.BufferGeometry
  private lifeTex!: THREE.CanvasTexture
  private eventMat!: THREE.ShaderMaterial
  private eventGeo!: THREE.BufferGeometry
  /** 每块大洲底下的弧形照片 */
  private photoMats: THREE.ShaderMaterial[] = []
  private photoGeo!: THREE.BufferGeometry
  /**
   * 当前贴在球面上的纹理。
   * ⚠️ 只是个引用，**不负责生命周期** —— 真正持有并释放纹理的是
   * photoCache（见 loadPhoto / dispose）。别在这里 dispose，
   * 那会把缓存里还在用的纹理销毁掉。
   */
  private photoTex: THREE.Texture | null = null
  /**
   * 同时存在的事件上限 —— 和着色器里的数组长度必须一致。
   *
   * 从 6 提到 14：事件缩到真实尺度（台风 38px，原来 328px）之后，
   * 6 个散在整个球面上等于什么都没发生。数量补上来才有「洋面上
   * 到处在出事」的感觉，而总覆盖面积仍远小于原来的 6 个巨盘。
   */
  private readonly EVENT_SLOTS = 14
  /** 每个槽位的存活进度 0→1，>=1 表示空闲 */
  private eventAge: number[] = []
  /** 各槽的持续时间（秒）—— 三种事件长短不一 */
  private eventDur: number[] = []

  private cap: Capability
  private count: number

  private raf = 0
  private clock = new THREE.Clock()
  private disposed = false

  private reveal = 0
  private orbScale = 1
  private orbShiftX = 0
  private orbShiftY = 0

  // ── 分镜巡航 ──
  /** 当前停靠的大洲索引 */
  private cursor = 0
  /** 停靠计时器 */
  private dwellT = 0
  private yaw = 0
  private targetYaw = 0
  private pitch = 0
  private targetPitch = 0

  // ── 拖拽 ──
  private dragging = false
  private lastPx = 0
  private lastPy = 0
  /** 松手后的惯性角速度 */
  private velY = 0
  private velX = 0
  /** 用户交互后的冷却计时 —— 期间不自动巡航 */
  private idleT = 0
  /** 鼠标是否停在球体上 —— 停在球上才暂停巡航 */
  private overOrb = false
  /**
   * 最近一次指针的**像素**坐标（-1 = 不在画布上）。
   *
   * 放大镜每帧都要拿它重新和球求交：球是一直在转的，光标钉着不动时
   * 镜下的那块地也在换 —— 只在 pointermove 里算一次的话，镜子会
   * 粘在某块陆地上跟着球跑，而不是钉在屏幕上。
   */
  private pointerPx = { x: -1, y: -1 }
  /**
   * 放大镜的四个 uniform —— 只给**球面照片**那一层用。
   *
   * ⚠️ 别再铺到点云 / 海岸线 / 海面 / 船那几层去（做过一版，被打回）：
   * 用户要放大的是球面上的那张背景图，文字和线条跟着一起变形
   * 反而像画面坏了。
   * ⚠️ 每帧只改 .value，别替换对象 —— 和 accent 一个道理，引用会断。
   */
  private lensU = {
    uLensDir: { value: new THREE.Vector3(0, 0, 1) },
    uLensAmt: { value: 0 },
    uLensR: { value: LENS_R },
    uLensM: { value: LENS_M },
  }

  /** 高亮的大洲 + 强度 */
  private focusIdx = 0
  private focusMix = 0
  /** 运镜途中压住的开机动画，相机到位后补放。-1 = 没有 */
  private pendingFocus = -1
  /**
   * 入场后有没有放过第一次开机动画。
   *
   * 首屏必须等球体完全铺开再弹小屏（用户明确要求）。而首帧的
   * focusIdx 和 want 都是 0，`want !== focusIdx` 永远不成立 ——
   * 不额外记一个标记的话，第 0 块的开机动画根本不会被触发。
   */
  private booted = false

  private anchors = faceAnchors()

  /** 小屏当前所在的一侧（+1 右 / −1 左），以及缓动中的实际偏移 */
  private paneSide = 1
  private paneX = 0
  private paneY = 0
  /** 上一帧的 dt —— projectPanes 里做缓动要用，它不在 tick 的作用域内 */
  private lastDt = 0.016
  /**
   * 相机停稳了吗 —— 只用来决定「什么时候触发一次开机动画」。
   *
   * ⚠️ 不要拿它去藏小屏或引线。试过「转动中全部收起来」，
   * 结果是切换的一秒里屏幕整个空掉，比重叠更难看。
   * 板块一高亮就显示内容，上一块自己隐藏，互不影响。
   */
  steady = false
  /**
   * 当前实际显示的主色。每帧朝「正在转向的那块大洲」的主色插值 ——
   * 转动途中整个场景的色调是连续渐变的，到位时正好是新板块的调子。
   *
   * ⚠️ 这个 Color 实例被多个 uniform **共享引用**（点云的 uColorB、
   * 海岸线的 uFocusColor）。改它的分量等于同时改了所有引用处；
   * 别用 `= new Color()` 整个替换，那样引用会断掉、颜色就不动了。
   */
  private accent = new THREE.Color().copy(SECTION_COLORS[0])
  /** accent 的 CSS 形式，供 DOM 层读取（见 Panes.tsx 每帧写 --accent） */
  accentCss = `#${SECTION_COLORS[0].getHexString()}`
  /** 每块大洲的中心经纬度 —— 相机转向它时用 */
  private centers = continentCenters()
  private tmpVec = new THREE.Vector3()

  readonly panes: PaneProjection[] = Array.from({ length: FACES }, () => ({
    x: 0,
    y: 0,
    ax: 0,
    ay: 0,
    depth: 0,
    visible: false,
    focused: false,
    armed: false,
  }))

  /** 分镜切到新大洲时回调 —— 外部据此重放小屏的打字动画 */
  onFocus: ((index: number) => void) | null = null
  /**
   * 当前正对的大洲变了就回调 —— **不等相机停稳**。
   *
   * ⚠️ 和 onFocus 的区别很重要，别合并：
   * onFocus 只在停稳后发，因为小屏的开机动画一旦开始就不能被打断
   *（拖拽中每扫过一块就触发一次，会叠出好几条引线）。
   * 但左侧板块导航的高亮是纯指示，必须**实时**跟着球走 ——
   * 手动拖动时不同步的话，高亮会一直停在拖动前那一块。
   */
  onFaceChange: ((index: number) => void) | null = null
  /** 上一次通过 onFaceChange 播报出去的索引 */
  private lastAnnounced = -1

  private input: SceneInput = {
    active: -1,
    hover: -1,
    pointer: { x: 0, y: 0 },
  }

  constructor(canvas: HTMLCanvasElement, cap: Capability) {
    this.cap = cap
    this.count = cap.particles

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // 点云不需要 MSAA，圆形 sprite 自带柔边
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: false,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cap.dprCap))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setClearColor(0x000000, 0)

    this.camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    )
    this.camera.position.set(0, 0, this.cameraDistance())

    this.scene.add(this.root)
    this.buildBody()
    this.buildPoints()
    this.buildLines()
    this.buildFlows()
    this.buildOceanLife()
    this.buildEvents()
    this.buildPhotos()

    // 开场就停在第 0 块大洲
    const p0 = this.poseFor(0)
    this.targetYaw = p0.yaw
    this.yaw = p0.yaw
    this.targetPitch = p0.pitch
    this.pitch = p0.pitch
  }

  /**
   * 让第 f 块大洲正对观众所需的 (yaw, pitch)。
   *
   * 大洲散布在各自的经纬度上，所以按它的真实坐标算：
   * 经度决定 yaw，纬度决定 pitch。
   *
   * 推导：经度 θ 的点在 (cos θ·cos lat, sin lat, sin θ·cos lat)。
   * three.js 绕 Y 转 yaw 后 z' = −x·sin(yaw) + z·cos(yaw) = cos lat·sin(θ − yaw)。
   * 要让它最大（正对 +z，即相机方向），需 θ − yaw = π/2 → **yaw = θ − π/2**。
   *
   * ⚠️ 这里曾经写反成 `π/2 − θ`。符号反了之后，相机转到的位置和
   * cursor 指向的大洲对不上 —— 表面症状就是「板块转过来直接跳走」
   * 和「有的板块根本不显示小屏」（那块的 depth 只有 0.13，
   * 被 projectPanes 的 depth > 0.15 判掉了）。
   */
  private poseFor(f: number): { yaw: number; pitch: number } {
    const c = this.centers[f] ?? { lon: 0, lat: 0 }
    const theta = (c.lon * Math.PI) / 180
    return {
      yaw: theta - Math.PI / 2,
      // 纬度不全给：给满会让球转到只剩极点朝向观众，构图很怪。
      // 0.62 是「看得出偏了但仍是正常球面视角」的折中。
      pitch: THREE.MathUtils.clamp((c.lat * Math.PI) / 180, -0.7, 0.7) * 0.62,
    }
  }

  /**
   * 当前 (yaw, pitch) 下哪块大洲最正对观众。
   * 大洲不均匀分布，不能用取模反解 —— 实打实算每块的正对度取最大。
   */
  private faceAt(yaw: number, pitch: number): number {
    let best = 0
    let bestZ = -2
    for (let f = 0; f < FACES; f++) {
      const c = this.centers[f]
      if (!c) continue
      const lon = (c.lon * Math.PI) / 180
      const lat = (c.lat * Math.PI) / 180
      const x = Math.cos(lon) * Math.cos(lat)
      const y = Math.sin(lat)
      const z = Math.sin(lon) * Math.cos(lat)
      // 施加球体当前的 yaw（绕 Y）+ pitch（绕 X）
      const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw)
      const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch)
      // 正对观众 = 转完之后 z 最大（+z 指向相机）
      if (z2 > bestZ) {
        bestZ = z2
        best = f
      }
    }
    return best
  }

  /**
   * 相机距离：保证整个球**完整落在视锥内**，不被裁到。
   *
   * 要装下的不只是 ORB_RADIUS —— 辉光外壳在 1.06 倍处、锚点在 1.01 倍、
   * 海岸线在 1.014 倍，点还有呼吸浮动。1.16 倍覆盖得住这些，
   * 再乘 1.04 给 HUD 角标让一线。
   *
   * 系数别再往大调：1.34 时球只占屏幕高度 75%，四周空得发慌。
   */
  private cameraDistance() {
    const aspect = window.innerWidth / window.innerHeight
    const fov = 48 * (Math.PI / 180)
    const need = ORB_RADIUS * 1.16
    const dv = need / Math.tan(fov / 2)
    const dh = need / (Math.tan(fov / 2) * aspect)
    return Math.max(dv, dh) * 1.04
  }

  /**
   * 实心球体本体 —— 垫在点云下面，让球真正有实体。
   *
   * 半径取 0.985 倍：略小于点云（1.0）和海岸线（1.014），
   * 这样陆地的光点和海岸线都浮在球面**之上**而不是陷进去。
   * 取 1.0 会和点云在同一深度上打架，边缘出现摩尔纹。
   *
   * ⚠️ 这个球必须是**不透明**的（transparent: false，中心 alpha 拉满）。
   * 半透明的话背面的大洲和页面背景都会隐约透出来 —— 用户明确说过
   * 「变为实体这样就不会出现透视的问题」。轮廓处的大气辉光另外用
   * 一个加法混合的外壳做（见 buildHalo），不靠本体的半透明去凑。
   */
  private buildBody() {
    // 段数按档位给：低端机 32×24 足够，点云本来就把球面盖住了
    // 段数：海面纹理是逐片元算的，但球的轮廓要够圆，
    // 低模球在边缘会看出多边形的棱。
    const seg = this.cap.tier === 'low' ? 40 : 64
    this.bodyGeo = new THREE.SphereGeometry(ORB_RADIUS * 0.985, seg, seg / 2)
    this.bodyMat = new THREE.ShaderMaterial({
      vertexShader: bodyVertex,
      fragmentShader: bodyFragment,
      // 不透明 —— 它的职责就是挡住背后的一切
      transparent: false,
      depthWrite: true,
      depthTest: false,
      side: THREE.FrontSide,
      uniforms: {
        uReveal: { value: 0 },
        uTime: { value: 0 },
        // 深海 / 浅海。
        // ⚠️ 上一版是 #071c30 / #12466b —— 深海亮度只有 11%，
        // 在深色页面底上和背景糊成一片，用户说「海洋没展示出来」
        // 说的就是这个：海面纹理的代码都在跑，但暗到看不见。
        // 现在深海提到 ~22%、浅海提到 ~45%，两者仍拉开一档做层次。
        uColor: { value: new THREE.Color('#0d3352') },
        uColorShoal: { value: new THREE.Color('#1d6f9e') },
      },
    })
    const mesh = new THREE.Mesh(this.bodyGeo, this.bodyMat)
    // 深度测试关着（整个场景都关），靠 renderOrder 保证它**先**画，
    // 后画的点云和海岸线自然盖在它上面。
    mesh.renderOrder = -1
    mesh.frustumCulled = false
    this.root.add(mesh)

    // 大气辉光：套在本体外面一圈（1.06 倍），加法混合、只有轮廓处亮。
    // 本体不透明会切出一条硬边，靠这层把边缘晕开。
    // 画在本体之后、点云之前（renderOrder 介于两者之间）。
    this.haloGeo = new THREE.SphereGeometry(ORB_RADIUS * 1.06, seg, seg / 2)
    this.haloMat = new THREE.ShaderMaterial({
      vertexShader: haloVertex,
      fragmentShader: haloFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      // 只画背面：辉光要在球的**外圈**，画正面的话会糊在球脸上
      side: THREE.BackSide,
      uniforms: {
        uReveal: { value: 0 },
        uTime: { value: 0 },
        /** 切板块时冲一下的强度，由 tick 衰减回 0 */
        uPulse: { value: 0 },
        uColor: { value: COLOR_A.clone() },
      },
    })
    const halo = new THREE.Mesh(this.haloGeo, this.haloMat)
    halo.renderOrder = -0.5
    halo.frustumCulled = false
    this.root.add(halo)
  }

  /**
   * 海洋上的数据流弧线 —— 填住球面上那些空荡荡的海。
   *
   * 洲际之间的大圆弧，每条弧上有亮点在跑。弧线本体只是极淡的底纹，
   * 真正被看见的是跑动的亮点 —— 「有数据在两块大陆之间流动」。
   * 这呼应整站的数据闭环主题，同时不抢大洲和小屏的注意力。
   */
  private buildFlows() {
    const f = buildFlows()
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(f.sphere.length), 3))
    geo.setAttribute('aSphere', new THREE.BufferAttribute(f.sphere, 3))
    geo.setAttribute('aT', new THREE.BufferAttribute(f.t, 1))
    geo.setAttribute('aFace', new THREE.BufferAttribute(f.face, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20)

    this.flowGeo = geo
    this.flowMat = new THREE.ShaderMaterial({
      vertexShader: flowVertex,
      fragmentShader: flowFragment,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uFocus: { value: 0 },
        // 和主色共享引用 —— 流线跟着板块一起变色
        uColor: { value: this.accent },
        // 低端机上把流线压得更淡，省一点填充率
        uOpacity: { value: this.cap.tier === 'low' ? 0.5 : 0.8 },
      },
    })
    const obj = new THREE.LineSegments(this.flowGeo, this.flowMat)
    obj.frustumCulled = false
    // 加法混合，画在点云之上一点点（同样：depthTest 全关，只认 renderOrder）
    obj.renderOrder = 0.5
    this.root.add(obj)
  }

  /**
   * 海面上的船只与海洋生物。
   *
   * 用户明确要「海洋上随机分布动态的货轮、航母、军舰、渔船，
   * 以及跃出海面的鲸鱼鲨鱼鱼群」。按真实比例这些只有 0.02px
   *（1px ≈ 14km），所以走**古地图装饰画**的路子：明确不按比例，
   * 图标画到看得出是什么为止。图标是 canvas 程序生成的，零二进制资源。
   *
   * 全部是一个 Points + 一张图集 = 一次 draw call。
   * 位置在着色器里沿大圆推进，CPU 每帧只更新 uTime。
   */
  private buildOceanLife() {
    // 数量按档位给：低端机砍到三分之一，这些是装饰不是主体
    const n =
      this.cap.tier === 'low' ? 34 : this.cap.tier === 'mid' ? 70 : 110
    const L = buildOceanLife(n)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(L.count * 3), 3))
    geo.setAttribute('aOrigin', new THREE.BufferAttribute(L.origin, 3))
    geo.setAttribute('aHeading', new THREE.BufferAttribute(L.heading, 3))
    geo.setAttribute('aKind', new THREE.BufferAttribute(L.kind, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(L.seed, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20)

    this.lifeGeo = geo
    this.lifeTex = buildOceanAtlas()
    this.lifeMat = new THREE.ShaderMaterial({
      vertexShader: lifeVertex,
      fragmentShader: lifeFragment,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      // 正常混合而不是加法 —— 加法会让船变成一团糊光，
      // 认不出形状；这些图标的价值就在于「看得出是什么」。
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uSizeScale: { value: this.sizeScale() },
        // 浮在海面之上、低于流线(1.052)，免得和流线抢层
        uRadius: { value: ORB_RADIUS * 1.026 },
        uAtlas: { value: this.lifeTex },
        uAtlasGrid: { value: new THREE.Vector2(ATLAS_COLS, ATLAS_ROWS) },
        // 冷白 —— 不跟板块主色走。这些是海面上的中性元素，
        // 跟着变色会和高亮的大洲混在一起，分不清主次。
        uColor: { value: new THREE.Color('#cfe6f2') },
      },
    })
    const pts = new THREE.Points(this.lifeGeo, this.lifeMat)
    pts.frustumCulled = false
    // ⚠️ 必须显式给 renderOrder。整个场景 depthTest 全关，画面完全靠
    // renderOrder 决定叠放顺序；不给的话默认 0，和点云/海岸线同级，
    // three 按加入顺序画 —— 这一层会被后画的点云盖掉，屏幕上什么都看不到。
    // 1 = 在点云(0)之上、事件层(2)之下。
    pts.renderOrder = 1
    this.root.add(pts)
  }

  /**
   * 球正面的弧形照片 —— 铺满整个可见半球。
   *
   * ⚠️ 半径必须在 0.986–0.999 之间。实心本体在 0.985 且**不透明**
   *（见 buildBody 的警告），比它小的东西一律看不见；点云在 1.0 以上。
   * 照片夹在这条缝里 —— 文字笔画的空隙处透出照片，笔画本身盖住它。
   *
   * ⚠️ 只有**一张**，不是每块大洲各一张。它始终朝向当前正对的那块
   * 大洲，跟着分镜一起转 —— 「占据整个正面」意味着同时只可能看到
   * 一张，做成五张各占一小片反而看不出是同一层。
   */
  private buildPhotos() {
    /*
      网格密度。
      贴合球面本身 24×16 就够（跨度 104°，看不出棱），但**放大镜**是在
      顶点上做的形变（见 photoVertex 的 lensWarp），变形精度等于网格密度：
      24×16 时每格 3.2°，镜区（17°）里只有十来个格子，放大的照片
      会看出折面。加密到 96×64 后每格 0.8°，代价是 6273 个顶点、
      12288 个三角形 —— 一次性建好，每帧只走顶点着色器，可以忽略。
    */
    const SEG_U = 96
    const SEG_V = 64
    const grid: number[] = []
    const idx: number[] = []
    for (let j = 0; j <= SEG_V; j++) {
      for (let i = 0; i <= SEG_U; i++) {
        grid.push(i / SEG_U, j / SEG_V)
      }
    }
    const row = SEG_U + 1
    for (let j = 0; j < SEG_V; j++) {
      for (let i = 0; i < SEG_U; i++) {
        const a = j * row + i
        idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array((grid.length / 2) * 3), 3)
    )
    geo.setAttribute('aGrid', new THREE.BufferAttribute(new Float32Array(grid), 2))
    geo.setIndex(idx)
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20)
    this.photoGeo = geo

    /*
      纹理异步加载。⚠️ 不能等它加载完再建 mesh ——
      那样首屏会缺一层，而且 load 失败时整块逻辑不会执行。
      先建好，图到了再换上去。
    */
    /*
      预加载全部五张。
      ⚠️ 不预加载的话每块第一次转到时都要等一次网络往返（200ms+），
      期间朝向已经跳到新大洲、图却还是旧的 —— 就是「切换有空缺」。
      分镜每 5.6 秒切一块，转完一圈要 28 秒，与其分五次卡顿，
      不如开场一次性拉完（五张各 200KB，且是同一张图的副本时浏览器
      还会命中 HTTP 缓存）。
      ⚠️ 先装第 0 块，其余在后台预热 —— 首屏不等其它四张。
    */
    this.loadPhoto(0)
    for (let f = 1; f < FACES; f++) this.preloadPhoto(f)

    const mat = new THREE.ShaderMaterial({
      vertexShader: photoVertex,
      fragmentShader: photoFragment,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      uniforms: {
        // 放大镜（只有这一层用 —— 用户要放大的是球面上的这张图，
        // 不是点云文字和海岸线）。⚠️ 共享 lensU 的对象引用，每帧只改 .value
        ...this.lensU,
        uReveal: { value: 0 },
        // 夹在本体(0.985)和点云(1.0)之间
        uRadius: { value: ORB_RADIUS * 0.993 },
        // 朝向每帧更新（见 tick 里的 aimPhoto）
        uCenter: { value: new THREE.Vector3(0, 0, 1) },
        uTanU: { value: new THREE.Vector3(1, 0, 0) },
        uTanV: { value: new THREE.Vector3(0, 1, 0) },
        /*
          半跨 52°（全跨 104°）。

          屏幕上照片的边缘落在球半径的 sin(52°) ≈ 79% 处，四角更远
          （对角 67.7°，约 92%）—— 基本铺到球的边缘，只留一圈球面本身。
          ⚠️ 38° 太保守：那时边缘只到 62%，用户说「没铺满、周围还有很多空白」。
          ⚠️ 但也别铺到 88°（=100%，整个可见半球）：那样照片占满正面，
          点云的文字和海面全被压在底下，球就不是球了、成了一个贴着图的圆。
          边缘另有片元里 12% 的渐隐把它融进点云。
        */
        uHalfU: { value: 52 * DEG },
        uHalfV: { value: 52 * DEG },
        uMap: { value: this.photoTex },
        uMapB: { value: this.photoTex },
        uMix: { value: 1 },
        uOpacity: { value: PHOTO_OPACITY },
        uTint: { value: this.accent },
      },
    })
    const mesh = new THREE.Mesh(this.photoGeo, mat)
    mesh.frustumCulled = false
    // 本体(-1) 之后、点云(0) 之前
    mesh.renderOrder = -0.4
    this.root.add(mesh)
    this.photoMats.push(mat)
  }

  /**
   * 把某块的照片预热进缓存，不改变当前显示。
   * ⚠️ 和 loadPhoto 的区别：它不碰 photoFace / uniforms，
   * 纯粹是「提前把图拉下来」，避免真正切到时才发请求。
   */
  private preloadPhoto(f: number) {
    const file = sectionPhoto(f)
    if (!file || this.photoCache.has(file)) return
    const base = import.meta.env.BASE_URL ?? '/'
    new THREE.TextureLoader().load(`${base}${file}`, (t) => {
      this.prepTexture(t)
      this.photoCache.set(file, t)
    })
  }

  /**
   * 纹理就位前的统一处理。
   *
   * ⚠️ initTexture 是这里的关键：three.js 默认在**第一次渲染用到**
   * 纹理时才上传到 GPU。一张 1620×1080 解码后是 6.7MB，上传要
   * 5–15ms —— 正好落在切换的那一帧上，表现就是「换图时卡一下」。
   * 预热阶段主动上传，把这个开销挪到开场，切换时就只是换个引用。
   *
   * ⚠️ 关掉 mipmap：照片贴在球面正中、尺寸几乎不变，
   * 用不上多级细节；而生成 mipmap 本身也要时间和 33% 额外显存。
   */
  private prepTexture(t: THREE.Texture) {
    t.colorSpace = THREE.SRGBColorSpace
    t.generateMipmaps = false
    t.minFilter = THREE.LinearFilter
    t.magFilter = THREE.LinearFilter
    // 各向异性对正对着看的平面没有帮助，省掉
    t.anisotropy = 1
    this.renderer.initTexture(t)
  }

  /** 当前球面照片对应的板块号 —— 换了才重新加载 */
  private photoFace = -1
  /** 边缘光的冲击强度 1→0，切板块时置 1 */
  private haloPulse = 0
  /** 照片朝向已经对准哪一块 —— 换了才重算切基，不用每帧做 */
  private photoAimFace = -1
  /**
   * 朝向**应该**对准哪一块。由 apply() 在纹理就位时设置 ——
   * 和 photoFace（发起加载时就变）区分开，避免旧图被搬到新大洲上。
   */
  private photoAimTarget = -1
  /** 朝向插值用的临时对象 —— 每帧复用，不在 tick 里 new */
  private photoAimGoal = new THREE.Vector3(0, 0, 1)
  private photoAimQuat = new THREE.Quaternion()
  private photoAimSlerp = new THREE.Quaternion()
  /**
   * 换图的过渡进度 0→1。
   * ⚠️ 不能用 CSS 那套过渡 —— 这是 WebGL 的 uniform，
   * 得自己在 tick 里按 dt 推进。
   */
  private photoMix = 1
  /** 已加载过的纹理，按文件名缓存。转回同一块不重复请求。 */
  private photoCache = new Map<string, THREE.Texture>()

  /**
   * 换成第 f 块板块的照片。
   *
   * ⚠️ 纹理必须缓存：分镜每 5.6 秒切一块，不缓存的话转一圈就发五次
   * 请求，转回来再发五次。
   */
  private loadPhoto(f: number) {
    if (f === this.photoFace) return
    this.photoFace = f
    const file = sectionPhoto(f)
    if (!file) return

    const apply = (t: THREE.Texture) => {
      // 上一张（可能没有 —— 首次加载时是 null）
      const prevTex = this.photoTex
      /*
        首次加载不做过渡：B 槽没有有效的旧图，硬淡的话会从一片空白
        渐显，首屏看着像图迟迟没加载出来。直接给终态。
        之后每次换图才从 0 走到 1。
      */
      const isFirst = prevTex === null

      for (const m of this.photoMats) {
        // 旧图挪到 B 槽当淡出源，新图进 A 槽
        m.uniforms.uMapB.value = prevTex ?? t
        m.uniforms.uMap.value = t
        m.uniforms.uMix.value = isFirst ? 1 : 0
        m.uniforms.uOpacity.value = PHOTO_OPACITY
      }
      this.photoTex = t
      this.photoMix = isFirst ? 1 : 0
      // 图就位了，这时才允许朝向跳到新大洲（见 aimPhoto 的说明）
      this.photoAimTarget = f
    }

    const cached = this.photoCache.get(file)
    if (cached) {
      apply(cached)
      return
    }

    const base = import.meta.env.BASE_URL ?? '/'
    new THREE.TextureLoader().load(
      `${base}${file}`,
      (t) => {
        this.prepTexture(t)
        this.photoCache.set(file, t)
        // ⚠️ 回调是异步的 —— 期间可能已经转到别的板块了，
        // 那时不能把这张图贴上去，否则会闪一下错的图
        if (this.photoFace === f) apply(t)
      },
      undefined,
      () => {
        // 加载失败：这一块不显示照片，不要留一块黑矩形
        if (this.photoFace === f) {
          for (const m of this.photoMats) m.uniforms.uOpacity.value = 0
        }
      }
    )
  }

  /**
   * 让照片弧面正对相机。
   *
   * ⚠️ 必须每帧算，而且用的是**局部坐标**。
   * 照片挂在 root 下，会跟着球的 yaw/pitch 一起转 —— 要让它始终
   * 朝向观众，就得把「相机方向」转换回 root 的局部系再作为中心。
   * 直接用世界坐标的 (0,0,1) 会导致球一转照片就转到背面去了。
   */
  private aimPhoto(dt: number) {
    const m = this.photoMats[0]
    if (!m) return

    /*
      推进换图的交叉淡入。
      ⚠️ 用**固定时长**（PHOTO_FADE 秒）线性推进，不是指数缓动 ——
      指数缓动永远到不了 1，uMix 会一直停在 0.99x，旧纹理就永远
      释放不掉，也永远差一点点没切干净。
    */
    if (this.photoMix < 1) {
      this.photoMix = Math.min(1, this.photoMix + dt / PHOTO_FADE)
      const t = this.photoMix
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      for (const mm of this.photoMats) mm.uniforms.uMix.value = e
    }

    /*
      ── 朝向 ──
      照片钉在球面上（跟着球转），朝向指向当前板块的大洲。

      ⚠️ 朝向必须**平滑转过去**，不能瞬移。
      相邻两块相距 72–87°，一旦瞬间跳过去，照片中心当场转到球的
      侧面甚至背面 —— 着色器里 vFade = smoothstep(0, 0.25, front)，
      front = cos(87°) ≈ 0.06 时 vFade 只剩 0.13。
      于是「换图」看起来是「照片先黑掉再出现」，
      手动拖拽时相机不动，这一下尤其刺眼。
      改成球面插值之后，照片是从旧大洲**滑**到新大洲的，
      全程都在正面附近，front 不会掉下去。
    */
    const f = this.photoAimTarget
    if (f < 0) return
    const c0 = this.centers[f]
    if (!c0) return

    const lon = c0.lon * DEG
    const lat = c0.lat * DEG
    this.photoAimGoal.set(
      Math.cos(lon) * Math.cos(lat),
      Math.sin(lat),
      Math.sin(lon) * Math.cos(lat)
    )

    const c = m.uniforms.uCenter.value as THREE.Vector3
    // 首次直接就位 —— 开场没有「上一个朝向」可以插值
    if (this.photoAimFace < 0) {
      c.copy(this.photoAimGoal)
      this.photoAimFace = f
    } else {
      /*
        球面插值。系数和球体运镜同量级（CUT=1.15s），
        这样照片和相机是**一起**转到新大洲的，不会一前一后。
        ⚠️ 用 slerp 而不是 lerp+normalize：后者在两点接近对跖时
        会经过球心附近，方向剧烈抖动。
      */
      const k = 1 - Math.pow(0.02, dt / CUT)
      this.photoAimQuat.setFromUnitVectors(c, this.photoAimGoal)
      this.photoAimSlerp.identity().slerp(this.photoAimQuat, k)
      c.applyQuaternion(this.photoAimSlerp).normalize()
      this.photoAimFace = f
    }

    /*
      切基跟着中心走。
      ⚠️ 两个都要取反，否则照片左右镜像 + 上下颠倒：
      d(center)/d(lon) 绕 Y 转过 yaw 后落在屏幕左，而纹理 u 增大
      取图片右侧；tanV 同理。取反后两个方向都对上。
      ⚠️ 这里用**插值后的中心**反推经度，不是直接用目标经度 ——
      否则转动途中切基和中心对不上，照片会扭。
    */
    const curLon = Math.atan2(c.z, c.x)
    const tu = m.uniforms.uTanU.value as THREE.Vector3
    const tv = m.uniforms.uTanV.value as THREE.Vector3
    tu.set(Math.sin(curLon), 0, -Math.cos(curLon)).normalize()
    tv.crossVectors(c, tu).normalize()
  }

  /**
   * 点击海面触发的事件层（台风 / 火山 / 龙卷风）。
   *
   * 几何是 EVENT_SLOTS 份相同的小圆盘网格，每份绑一个槽位号。
   * 三种效果共用同一套顶点和材质，靠 uType 在片元里分流 ——
   * 一次 draw call 就够，不用为每种效果各建一个 mesh。
   */
  private buildEvents() {
    const SEG = 18 // 圆盘的环向 / 径向细分
    const grid: number[] = []
    const slot: number[] = []
    const idx: number[] = []

    let base = 0
    for (let s = 0; s < this.EVENT_SLOTS; s++) {
      // 一个极坐标网格：中心点 + 若干环
      for (let ring = 0; ring <= SEG; ring++) {
        const rr = ring / SEG
        for (let a = 0; a <= SEG; a++) {
          const th = (a / SEG) * Math.PI * 2
          grid.push(Math.cos(th) * rr, Math.sin(th) * rr)
          slot.push(s)
        }
      }
      // 三角形索引
      const row = SEG + 1
      for (let ring = 0; ring < SEG; ring++) {
        for (let a = 0; a < SEG; a++) {
          const i0 = base + ring * row + a
          const i1 = i0 + 1
          const i2 = i0 + row
          const i3 = i2 + 1
          idx.push(i0, i2, i1, i1, i2, i3)
        }
      }
      base += row * row
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(slot.length * 3), 3))
    geo.setAttribute('aGrid', new THREE.BufferAttribute(new Float32Array(grid), 2))
    geo.setAttribute('aSlot', new THREE.BufferAttribute(new Float32Array(slot), 1))
    geo.setIndex(idx)
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20)

    // 所有槽位一开始都是空的（age >= 1）
    this.eventAge = new Array(this.EVENT_SLOTS).fill(2)
    this.eventDur = new Array(this.EVENT_SLOTS).fill(1)

    this.eventGeo = geo
    this.eventMat = new THREE.ShaderMaterial({
      vertexShader: eventVertex,
      fragmentShader: eventFragment,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uRadius: { value: ORB_RADIUS * 1.03 },
        uCenter: {
          value: Array.from({ length: this.EVENT_SLOTS }, () => new THREE.Vector3(0, 1, 0)),
        },
        uTanU: {
          value: Array.from({ length: this.EVENT_SLOTS }, () => new THREE.Vector3(1, 0, 0)),
        },
        uTanV: {
          value: Array.from({ length: this.EVENT_SLOTS }, () => new THREE.Vector3(0, 0, 1)),
        },
        uAge: { value: this.eventAge.slice() },
        uType: { value: new Array(this.EVENT_SLOTS).fill(0) },
        uColorA: { value: new THREE.Color('#8fe3ff') },
        uColorB: { value: new THREE.Color('#ff7a3c') },
      },
    })
    const mesh = new THREE.Mesh(this.eventGeo, this.eventMat)
    mesh.frustumCulled = false
    // 画在最上层 —— 事件是前景，要压住船和流线
    mesh.renderOrder = 2
    this.root.add(mesh)
  }

  /**
   * 屏幕像素 → 球面上的**局部**方向（单位向量）；没打中球返回 null。
   *
   * 解析求交：点云没有实体表面可求交，但我们有实心本体，
   * 直接解方程比 Raycaster 省得多。
   * 命中点必须转回局部坐标 —— 球是转着的，用世界坐标的话
   * 判陆海会永远判在同一片海、放大镜会永远罩着同一块地。
   *
   * 点击海面（hitOcean）和放大镜（updateLens）共用这一段。
   */
  private hitLocal(px: number, py: number): THREE.Vector3 | null {
    // 屏幕坐标 → NDC → 世界空间的射线
    const ndc = new THREE.Vector3(
      (px / window.innerWidth) * 2 - 1,
      -(py / window.innerHeight) * 2 + 1,
      0.5
    )
    ndc.unproject(this.camera)
    const dir = ndc.sub(this.camera.position).normalize()

    // 射线 vs 球（球心在 root.position，半径含当前缩放）
    const oc = this.camera.position.clone().sub(this.root.position)
    const R = ORB_RADIUS * this.orbScale
    const b = oc.dot(dir)
    const c = oc.dot(oc) - R * R
    const disc = b * b - c
    if (disc < 0) return null // 没打中球
    const t = -b - Math.sqrt(disc) // 取近端交点
    if (t < 0) return null

    const hit = this.camera.position.clone().addScaledVector(dir, t).sub(this.root.position)
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert()
    // matrixWorld 含位移，这里只要旋转部分，所以先减了 position 再用 3x3
    return hit.applyMatrix4(inv.setPosition(0, 0, 0)).normalize()
  }

  /**
   * 鼠标放大镜：把光标压住的那片球面撑开。
   *
   * 每帧重算命中点 —— 球在自转，光标不动时镜下的地也在换。
   * 只在首页开镜：打开板块后球缩成左上角一个小图标，放大没有意义。
   */
  private updateLens(dt: number) {
    const on = this.input.active < 0 && this.overOrb && this.pointerPx.x >= 0
    const hit = on ? this.hitLocal(this.pointerPx.x, this.pointerPx.y) : null

    // 缓动进出（时间常数约 0.18s）。瞬开瞬关会「啪」地跳一下，
    // 而且擦着球的边缘划过时会疯狂闪烁。
    const k = 1 - Math.pow(0.004, dt)
    this.lensU.uLensAmt.value += ((hit ? 1 : 0) - this.lensU.uLensAmt.value) * k

    // 只在命中时更新镜心：移开后镜子在原地缩回去，
    // 而不是「唰」地滑到球心或上一次的位置。
    if (hit) this.lensU.uLensDir.value.copy(hit)
  }

  /**
   * 点击画布：命中海面就放一个事件。
   *
   * @returns 是否真的触发了（点在陆地或球外就不触发）
   */
  hitOcean(px: number, py: number): boolean {
    if (this.input.active >= 0) return false

    const local = this.hitLocal(px, py)
    if (!local) return false

    if (!isOcean([local.x, local.y, local.z])) return false

    this.spawnEvent(local)
    return true
  }

  /** 在给定的球面方向上放一个随机类型的事件 */
  private spawnEvent(dirLocal: THREE.Vector3) {
    // 找一个空槽；全满就顶掉最老的那个
    let slot = this.eventAge.findIndex((a) => a >= 1)
    if (slot < 0) {
      let oldest = 0
      for (let i = 1; i < this.EVENT_SLOTS; i++) {
        if (this.eventAge[i] > this.eventAge[oldest]) oldest = i
      }
      slot = oldest
    }

    // 切平面的两个基 —— 圆盘就铺在这个平面上
    const up = Math.abs(dirLocal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
    const tu = new THREE.Vector3().crossVectors(dirLocal, up).normalize()
    const tv = new THREE.Vector3().crossVectors(dirLocal, tu).normalize()

    const u = this.eventMat.uniforms
    u.uCenter.value[slot].copy(dirLocal)
    u.uTanU.value[slot].copy(tu)
    u.uTanV.value[slot].copy(tv)
    // 类型：随机，但**不重复上一次** —— 纯随机会连出两三个一样的，
    // 轮转又太规律（转一圈就看穿了）。这样既随机又不会撞车。
    let type = Math.floor(Math.random() * 3)
    if (type === this.lastEventType) type = (type + 1 + Math.floor(Math.random() * 2)) % 3
    this.lastEventType = type
    u.uType.value[slot] = type
    // 台风摊得慢、火山短促、龙卷风居中
    this.eventDur[slot] = type === 0 ? 4.2 : type === 1 ? 2.6 : 3.2
    this.eventAge[slot] = 0
  }

  /** 上一次放的事件类型 —— 用来避免连续两次一样 */
  private lastEventType = -1
  /** 距离下一次自动事件还有多久（秒） */
  private autoEventT = 4

  /**
   * 自动在海面上放事件 —— 不用点也会有东西发生。
   *
   * 用户要求「所有的事物和事件都作为随机出现、随机数量自动呈现」。
   * 点击是主动触发，这里是被动发生的那一半。
   *
   * 找位置的办法是拒绝采样：随机取球面方向，是海才用。
   * 试 30 次还没找到就这轮放弃（下一轮再来），不阻塞渲染。
   */
  private tickAutoEvents(dt: number) {
    // 打开板块时不放 —— 那时球缩在角落，放了也看不见，白费
    if (this.input.active >= 0) return

    this.autoEventT -= dt
    if (this.autoEventT > 0) return
    // 下一次的间隔也是随机的：0.6–3.0 秒。
    // ⚠️ 原来是 3–11 秒，那是配着「一个台风盖住半个球」调的 ——
    // 事件缩到真实尺度后，那个节奏下海面几乎永远是空的。
    // 固定间隔会让人看出节奏，随机才像「自然发生」。
    this.autoEventT = 0.6 + Math.random() * 2.4

    for (let i = 0; i < 30; i++) {
      // 球面均匀采样
      const u = Math.random() * 2 - 1
      const th = Math.random() * Math.PI * 2
      const rr = Math.sqrt(Math.max(0, 1 - u * u))
      const v = new THREE.Vector3(Math.cos(th) * rr, u, Math.sin(th) * rr)
      if (!isOcean([v.x, v.y, v.z])) continue
      this.spawnEvent(v)
      // 有 30% 的概率连着再放 1–2 个（在别处）——
      // 每次都恰好一个也是一种规律，偶尔成群才像随机。
      if (Math.random() < 0.3) {
        this.autoEventT = 0.25 + Math.random() * 0.5
      }
      return
    }
  }

  private buildPoints() {
    const g = buildOrb(this.count)
    const geo = new THREE.BufferGeometry()
    // position 是占位 —— 顶点着色器完全接管位置计算
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(g.count * 3), 3))
    geo.setAttribute('aSphere', new THREE.BufferAttribute(g.sphere, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(g.size, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(g.seed, 1))
    geo.setAttribute('aHue', new THREE.BufferAttribute(g.hue, 1))
    geo.setAttribute('aFace', new THREE.BufferAttribute(g.face, 1))
    geo.setAttribute('aLand', new THREE.BufferAttribute(g.land, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20)

    this.pointsMat = new THREE.ShaderMaterial({
      vertexShader: orbVertex,
      fragmentShader: orbFragment,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      // 加法混合 —— 点重叠处自然变亮，出辉光感，省掉一个 bloom pass
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uSizeScale: { value: this.sizeScale() },
        uReveal: { value: 0 },
        uFocus: { value: 0 },
        uFocusMix: { value: 0 },
        uColorA: { value: COLOR_A.clone() },
        uColorB: { value: this.accent },
        uOpacity: { value: this.cap.tier === 'low' ? 0.9 : 1 },
      },
    })

    this.pointsGeo = geo
    this.points = new THREE.Points(geo, this.pointsMat)
    this.points.frustumCulled = false
    this.root.add(this.points)
  }

  /** 海岸线 + 经纬网，共用一套 shader，只是参数不同 */
  private buildLines() {
    const mk = (
      data: { sphere: Float32Array; face: Float32Array },
      opts: { color: THREE.Color; focusColor: THREE.Color; opacity: number }
    ) => {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.sphere.length), 3))
      geo.setAttribute('aSphere', new THREE.BufferAttribute(data.sphere, 3))
      geo.setAttribute('aFace', new THREE.BufferAttribute(data.face, 1))
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20)
      const mat = new THREE.ShaderMaterial({
        vertexShader: lineVertex,
        fragmentShader: lineFragment,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uReveal: { value: 0 },
          uFocus: { value: 0 },
          uFocusMix: { value: 0 },
          uColor: { value: opts.color },
          uFocusColor: { value: opts.focusColor },
          uOpacity: { value: opts.opacity },
        },
      })
      const obj = new THREE.LineSegments(geo, mat)
      obj.frustumCulled = false
      this.root.add(obj)
      return { geo, mat }
    }

    /*
      笔画轮廓：勾出每个字的边，高亮时明显变亮。

      ⚠️ 透明度从 0.8 压到 0.34。大洲改成文字之后轮廓不再是
      5 条闭合海岸线，而是每个笔画各一条 —— 「工作经历」四个字
      就有 30 多个笔画。0.8 的亮度下这些线会连成一片，把笔画内部
      的点云盖住，字反而糊了。压暗后线只负责勾边，主体仍是点云。
    */
    const coast = mk(buildCoast(), {
      color: COLOR_A.clone(),
      focusColor: this.accent,
      opacity: 0.34,
    })
    this.coastGeo = coast.geo
    this.coastMat = coast.mat

    // 经纬网：地球仪的坐标系，很淡
    const grid = mk(buildGrid(), {
      color: COLOR_A.clone(),
      focusColor: COLOR_A.clone(),
      opacity: 0.2,
    })
    this.gridGeo = grid.geo
    this.gridMat = grid.mat
  }

  /**
   * 点尺寸随视口缩放。
   * 手机上视口小、粒子少，单个点要画大一点才有密度感。
   */
  private sizeScale() {
    const h = window.innerHeight
    const base = THREE.MathUtils.clamp(h / 900, 0.7, 1.35)
    return this.cap.tier === 'low' ? base * 1.5 : base
  }

  update(input: SceneInput) {
    this.input = input
  }

  // ── 拖拽交互 ─────────────────────────────────────────────

  /** @returns 是否真的开始拖拽（打开板块时不拖） */
  dragStart(px: number, py: number): boolean {
    if (this.input.active >= 0) return false
    this.dragging = true
    this.lastPx = px
    this.lastPy = py
    this.velY = 0
    this.velX = 0
    return true
  }

  /** @returns 本次移动的累计像素距离，供外部判断「是拖拽还是点击」 */
  dragMove(px: number, py: number): number {
    if (!this.dragging) return 0
    const dx = px - this.lastPx
    const dy = py - this.lastPy
    this.lastPx = px
    this.lastPy = py
    // 每 px 转多少弧度 —— 0.006 约等于「拖半屏转半圈」
    this.yaw += dx * 0.006
    this.targetYaw = this.yaw
    // 上下可以一直转到（接近）极点，不像以前那样在 ±41° 撞墙。
    // 但不能真的转过极点：过了 90° 球就倒置，「往上拖」会变成往下转，
    // 方向感反过来非常晕。1.45 rad ≈ 83°，刚好能看到极点又不翻过去。
    this.pitch += dy * 0.004
    this.targetPitch = this.pitch
    // 记录瞬时速度做惯性
    this.velY = dx * 0.006
    this.velX = dy * 0.004
    this.idleT = RESUME
    return Math.hypot(dx, dy)
  }

  dragEnd() {
    if (!this.dragging) return
    this.dragging = false
    /*
      ⚠️ **不吸附**（2026-09-08 用户要求）。
      原来松手后会转到最近那块大洲的预设姿态，用户原话：
      「移动到什么角度当前就展示什么角度，不要立刻弹设置的角度」。

      现在只做两件事：
      ① cursor 更新成「现在正对的是哪一块」—— 高亮、小屏、主色都读它；
      ② target 设成当前角度 —— 否则 tick 里那条分镜缓动会每帧
         把球往旧的 target 拉回去，等于慢速吸附。

      自动巡航仍会在 idleT（RESUME=6s）走完后接管，那不是「立刻」，
      而且用户随时可以再拖。
    */
    this.cursor = this.faceAt(this.yaw, this.pitch)
    this.targetYaw = this.yaw
    this.targetPitch = this.pitch
  }

  /**
   * 鼠标是否停在球体上 —— 只有停在球上才暂停巡航。
   *
   * 用屏幕距离判定：球心投影到屏幕，鼠标离它小于球的屏幕半径即命中。
   * 比射线求交便宜得多，而且点云本来就没有实体表面可求交。
   */
  setPointerOverOrb(cx: number, cy: number) {
    this.tmpVec.set(0, 0, 0).applyMatrix4(this.root.matrixWorld).project(this.camera)
    const sx = (this.tmpVec.x * 0.5 + 0.5) * window.innerWidth
    const sy = (-this.tmpVec.y * 0.5 + 0.5) * window.innerHeight
    this.overOrb = Math.hypot(cx - sx, cy - sy) < this.orbRadiusPx()
    // 放大镜要用像素坐标每帧重新求交，这里只负责记下来
    this.pointerPx.x = cx
    this.pointerPx.y = cy
  }

  /** 指针离开画布 */
  clearPointerOverOrb() {
    this.overOrb = false
    this.pointerPx.x = -1
  }

  /**
   * 球心当前的屏幕坐标与半径（px）。
   *
   * 供 DOM 层用：打开板块后球缩到左上角，那条板块导航列表要挂在
   * 球的正下方 —— 位置只有 3D 层知道（缩放和位移都是缓动的），
   * 所以每帧从这里取。
   */
  orbScreen(): { x: number; y: number; r: number } {
    this.tmpVec.set(0, 0, 0).applyMatrix4(this.root.matrixWorld).project(this.camera)
    return {
      x: (this.tmpVec.x * 0.5 + 0.5) * window.innerWidth,
      y: (-this.tmpVec.y * 0.5 + 0.5) * window.innerHeight,
      r: this.orbRadiusPx(),
    }
  }

  /**
   * 球的**稳定**锚点 —— 给挂在球下方的 DOM（板块导航）定位用。
   *
   * ⚠️ 和 orbScreen() 的区别：这里**剔除掉每帧的浮动与视差**。
   * root.position.y 里叠了 `sin(t*0.42)*0.2` 的悬浮，相机也随指针
   * 做视差位移 —— orbScreen 如实反映这些（点击判定需要真实位置），
   * 但导航条跟着读就会一直上下抖。
   *
   * 球继续转、继续浮；导航只跟「球缩到哪个位置」这个缓动量走。
   */
  orbAnchor(): { x: number; y: number; r: number } {
    /*
      orbShiftX / orbShiftY 的定义就是「相对视口半宽 / 半高的占比」
      （见 tick 里 wantSX / wantSY 的注释），所以从它们到屏幕坐标
      只是一次线性映射，不需要过投影矩阵 —— 过了反而会把相机的
      指针视差和球体的悬浮一起带进来，那正是要剔除的东西。
    */
    return {
      x: (this.orbShiftX * 0.5 + 0.5) * window.innerWidth,
      y: (-this.orbShiftY * 0.5 + 0.5) * window.innerHeight,
      r: this.orbRadiusPx(),
    }
  }

  /**
   * 屏幕坐标是否落在球体上 —— 点击它可以返回大球状态。
   * 判定和 setPointerOverOrb 同一套（屏幕距离 vs 球的屏幕半径）。
   */
  hitOrb(px: number, py: number): boolean {
    const s = this.orbScreen()
    return Math.hypot(px - s.x, py - s.y) < s.r
  }

  /**
   * 求「让第 f 块大洲正对」的姿态，且 yaw 取**离当前最近**的等价角。
   * yaw 是无界累加的（拖多圈会一直增大），直接用 poseFor 的原始值
   * 会导致相机绕回原点转好几圈。
   */
  private nearestPoseFor(f: number, from: number): { yaw: number; pitch: number } {
    const p = this.poseFor(f)
    const k = Math.round((from - p.yaw) / TAU)
    // pitch 现在也是无界累加的（上下能一直翻），所以同样要取最近的等价角 ——
    // 不然拖着翻过两圈之后，吸附会让球倒着转回去好几圈。
    const kp = Math.round((this.pitch - p.pitch) / TAU)
    return { yaw: p.yaw + k * TAU, pitch: p.pitch + kp * TAU }
  }

  /** 外部直接切到某块大洲（键盘 / 点击导航） */
  focusFace(f: number) {
    this.cursor = ((f % FACES) + FACES) % FACES
    const p = this.nearestPoseFor(this.cursor, this.yaw)
    this.targetYaw = p.yaw
    this.targetPitch = p.pitch
    this.dwellT = 0
    this.idleT = RESUME
  }

  private tick = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.tick)

    const dt = Math.min(this.clock.getDelta(), 0.05) // 切后台回来时钳一下
    this.lastDt = dt
    const t = this.clock.elapsedTime
    const { active, hover, pointer } = this.input

    // ── 入场 ──
    if (this.reveal < 1) {
      this.reveal = Math.min(1, this.reveal + dt * 0.42)
      const e = 1 - Math.pow(1 - this.reveal, 3) // easeOutCubic
      this.pointsMat.uniforms.uReveal.value = e
      this.coastMat.uniforms.uReveal.value = e
      this.gridMat.uniforms.uReveal.value = e
      this.bodyMat.uniforms.uReveal.value = e
      this.haloMat.uniforms.uReveal.value = e
      this.flowMat.uniforms.uReveal.value = e
      this.lifeMat.uniforms.uReveal.value = e
      for (const m of this.photoMats) m.uniforms.uReveal.value = e
    }

    // ── 分镜巡航 ──
    // 停在一块大洲上 DWELL 秒，然后一步切到下一块。
    // 这不是匀速自转 —— 是「镜头切换」，每一站都有停顿让人看清。
    //
    // 暂停条件：鼠标停在**球体上**（不是整个页面）、悬停小屏、
    // 打开了板块、正在拖拽、或刚拖过还在冷却期。
    const cruising =
      active < 0 && hover < 0 && !this.overOrb && !this.dragging && this.idleT <= 0
    if (cruising) {
      this.dwellT += dt
      if (this.dwellT >= DWELL) {
        this.dwellT = 0
        this.cursor = (this.cursor + 1) % FACES
        const p = this.nearestPoseFor(this.cursor, this.yaw)
        this.targetYaw = p.yaw
        this.targetPitch = p.pitch
      }
    } else {
      this.dwellT = 0
      if (this.idleT > 0) this.idleT -= dt
    }

    // ── 惯性 + 缓动 ──
    if (!this.dragging) {
      if (Math.abs(this.velY) > 1e-4 || Math.abs(this.velX) > 1e-4) {
        // 惯性衰减
        this.yaw += this.velY
        this.pitch += this.velX
        const damp = Math.pow(0.02, dt)
        this.velY *= damp
        this.velX *= damp
        this.targetYaw = this.yaw
        this.targetPitch = this.pitch
        // 惯性基本停下时吸附到最近的大洲
        if (Math.abs(this.velY) < 0.002 && Math.abs(this.velX) < 0.002) {
          this.velY = 0
          this.velX = 0
          this.dragging = true // 让 dragEnd 的守卫通过
          this.dragEnd()
        }
      } else {
        // 分镜切换的缓动：CUT 秒走完，用指数缓动
        const k = 1 - Math.pow(0.0015, dt / CUT)
        this.yaw += (this.targetYaw - this.yaw) * k
        this.pitch += (this.targetPitch - this.pitch) * k
      }
    }

    /*
      ── 板块内：球持续自转 ──
      打开板块后 cruising 为 false，球缓动到目标角度就**停住**了，
      缩在左上角一动不动像张贴图。这里给一个恒定的慢自转，
      让它保持「活着」。

      ⚠️ 同时推进 targetYaw —— 否则上面的分镜缓动会每帧把 yaw
      往回拉，两者打架，表现为球在原地轻微抽搐。
      速度取 0.12 rad/s（约 52 秒一圈）：明显在动，又不至于分散
      对右侧内容的注意力。
    */
    if (active >= 0 && !this.dragging) {
      const spinRate = 0.12 * dt
      this.yaw += spinRate
      this.targetYaw += spinRate
    }

    // ── 高亮哪块大洲 ──
    //
    // ⚠️ 这里不能无条件用 faceAt(yaw) 实时算。
    // 相机从大洲 0（经度 60°）转到大洲 1（经度 180°）的途中会经过 120°，
    // 那正好是大洲 4 的经度 —— faceAt 会在半路短暂命中大洲 4，
    // 触发 onFocus、小屏开始开机动画，然后相机继续转走把它打断。
    // 表现就是「小屏弹出一点又切走」「跳过某些板块」。
    //
    // 所以：巡航 / 分镜切换时**锁定目标 cursor**，
    // 只有用户手动转球（拖拽 / 惯性滑行）时才用 faceAt 实时跟随。
    const manual =
      this.dragging || Math.abs(this.velY) > 1e-4 || Math.abs(this.velX) > 1e-4
    const nearest = manual ? this.faceAt(this.yaw, this.pitch) : this.cursor
    const want = active >= 0 ? active : hover >= 0 ? hover : nearest

    /*
      实时播报「现在正对哪一块」。
      ⚠️ 用 nearest 而不是 want —— want 会被 active / hover 覆盖，
      那是「打开了哪个板块」，不是「球转到了哪一块」。
      拖拽时 nearest 每帧由 faceAt 实时算，导航高亮才跟得上。
      只在值真的变了才发，避免每帧触发 React 重渲染。
    */
    if (nearest !== this.lastAnnounced) {
      this.lastAnnounced = nearest
      this.onFaceChange?.(nearest)
      // 球面照片跟着换 —— 和左上角的原图小图用同一个信号源，
      // 两者始终是同一张
      this.loadPhoto(nearest)
      // 边缘光冲一下，呼应「换了个调子」
      this.haloPulse = 1
    }

    // 「相机停稳了吗」—— 引线和小屏只在停稳后才出现。
    //
    // ⚠️ 这里曾经写成 `manual || 差值 < 0.25`，也就是**手动转球时无条件算停稳**。
    // 后果：拖拽 / 惯性滑行途中每扫过一块大洲就触发一次 onFocus，
    // 上一块的引线还没收掉、下一块的又开始画，转一圈能叠出好几条线。
    //
    // 正确的判据对两种情况是同一条：角速度足够小 **且** 已经贴近目标角度。
    // 手动时看惯性残速（拖拽中恒为「没停」），自动时看离目标还差多少。
    const spin = Math.hypot(this.velY, this.velX)
    const settled = this.dragging
      ? false // 手指还按着 = 一定没停稳
      : manual
        ? spin < 0.004 // 惯性基本停下（和 dragEnd 的吸附阈值同量级）
        : // 自动运镜：剩下的角度不到 0.45 弧度（≈26°）就算「快到了」。
          // 阈值给得松是**故意**的 —— 引线要 520ms 才长完，
          // 卡到 0.25 的话线得等相机几乎完全停死才开始长，
          // 中间会空出近一秒什么都没有。松到 0.45 之后，
          // 线在相机收尾的同时长出来，两个动作叠在一起，衔接是连的。
          Math.abs(this.targetYaw - this.yaw) < 0.45

    // 首帧入场没跑完之前不放开机动画 —— 用户要求「地图完全展开后再显示小屏」。
    // reveal 是点云的入场进度，>0.98 即球体已经铺满。
    const revealed = this.reveal > 0.98

    // 转动一开始就把 booted 清掉：转停后必须**重放**一次开机动画。
    // 不清的话，「拖一圈又转回同一块大洲」时 want === focusIdx、
    // pendingFocus 也是 -1，三个分支全不进 —— 引线被淡出收掉之后
    // 再没人把它重新画出来，那块板块就永远空着了。
    if (!settled) this.booted = false
    if (want !== this.focusIdx) {
      this.focusIdx = want
      // 相机还在飞的时候压住开机动画，到位后再补放 ——
      // 否则动画会在运镜途中被下一次切换打断。
      if (settled && revealed) {
        this.booted = true
        this.onFocus?.(want)
      } else {
        this.pendingFocus = want
      }
    } else if (this.pendingFocus >= 0 && settled && revealed) {
      // 运镜到位，补放之前压住的那次
      this.booted = true
      this.onFocus?.(this.pendingFocus)
      this.pendingFocus = -1
    } else if (!this.booted && settled && revealed) {
      // 首屏：focusIdx 和 want 一开始就都是 0，上面两个分支都进不去。
      // 等球体铺开、相机停稳后在这里放第一次开机动画。
      this.booted = true
      this.onFocus?.(this.focusIdx)
    }
    const wantMix = active >= 0 || hover >= 0 ? 1 : 0.85
    this.steady = settled && revealed
    this.focusMix += (wantMix - this.focusMix) * (1 - Math.pow(0.02, dt))

    // ── 主色跟着转 ──
    // 目标色取 focusIdx 那块的主色，每帧朝它插值；用和 focusMix 同一条
    // 缓动曲线，颜色和高亮强度同步变化，看着是同一件事的两个侧面。
    //
    // ⚠️ 必须 lerp 而不是直接赋值 —— 直接赋的话切板块时颜色硬跳，
    // 「转动过程中用色彩完成过渡」就落空了。
    // 也不能替换 this.accent 实例，它被多个 uniform 共享引用着。
    const wantColor = SECTION_COLORS[this.focusIdx] ?? SECTION_COLORS[0]
    // 速率跟着**相机走到哪了**，而不是一个固定的缓动常数。
    // 固定常数时颜色 600ms 就到位，而相机要 1150ms —— 转到一半颜色
    // 就不动了，后半程完全没有变化，过渡显得很短。
    // 现在颜色和镜头是同一条时间线：镜头还在走，颜色就还在变。
    const swing = Math.abs(this.targetYaw - this.yaw)
    // 0.15~1.05 弧度映射到慢~快：离目标越近收得越紧，避免尾巴拖太长
    const colorK = 1 - Math.pow(0.02, dt * THREE.MathUtils.clamp(1.6 - swing, 0.45, 1.6))
    this.accent.lerp(wantColor, colorK)
    // 大气辉光同步，否则球的轮廓永远是青的、和主色对不上
    this.haloMat.uniforms.uColor.value.copy(this.accent)
    this.haloMat.uniforms.uTime.value = t
    /*
      切板块的冲击衰减。
      ⚠️ 用固定时长线性衰减而不是指数 —— 指数永远到不了 0，
      轮廓会一直比静息态亮一点点，越切越亮。
    */
    if (this.haloPulse > 0) {
      this.haloPulse = Math.max(0, this.haloPulse - dt / HALO_PULSE)
      // easeOutCubic：起手最亮，快速收，像一次脉冲而不是慢慢暗
      const e = 1 - Math.pow(1 - this.haloPulse, 3)
      this.haloMat.uniforms.uPulse.value = e
    }
    // 把主色透出给 CSS：小屏的边框、辉光、引线都读 --accent，
    // 于是 DOM 层和 3D 层是同一个颜色在动，不会各走各的。
    // 写在 documentElement 上而不是某个元素上 —— 谁都能用。
    this.accentCss = `#${this.accent.getHexString()}`

    for (const m of [this.pointsMat, this.coastMat, this.gridMat]) {
      m.uniforms.uFocus.value = this.focusIdx
      m.uniforms.uFocusMix.value = this.focusMix
    }

    // ── 打开板块：球缩到左上角 ──
    // 内容面板占 76%（平板 82%），球只能待在左侧那条窄带里。
    // 窄屏面板更宽 → 球要缩得更小、贴得更左，否则被面板压住。
    const inPanel = active >= 0
    const phone = window.innerWidth < 768
    const narrow = window.innerWidth < 1200
    /*
      打开板块时球让到一边。
      ⚠️ 手机是**另一套**：面板改成了底部抽屉（占下方 78%），
      顶部留出一条横带。球该待在那条带里 —— 居中偏上、不缩太小，
      而不是沿用桌面的「缩到左下角」（那会被抽屉盖住，等于看不见）。
    */
    const wantScale = inPanel ? (phone ? 0.24 : narrow ? 0.24 : 0.34) : 1
    // 视口半宽占比：手机居中，桌面靠左
    const wantSX = inPanel ? (phone ? 0 : narrow ? -0.78 : -0.66) : 0
    /*
      视口半高占比。⚠️ **正值向上**（世界坐标 y 向上）。

      手机：抽屉占下方 78%，顶部 HUD 到抽屉之间只剩一条
      95–134px 的带。球要整个待在这条带里 ——
      0.70 让球心落在带中央，配 0.24 的缩放（半径 37–39px）
      上下都不越界。
      取值再大就压到 HUD，再小就探进抽屉被切掉。

      桌面：往上提到左上角（0.46），那里是空的。
    */
    const wantSY = inPanel ? (phone ? 0.7 : 0.46) : 0
    const ease = 1 - Math.pow(0.02, dt)
    this.orbScale += (wantScale - this.orbScale) * ease
    this.orbShiftX += (wantSX - this.orbShiftX) * ease
    this.orbShiftY += (wantSY - this.orbShiftY) * ease

    // ── 应用变换 ──
    this.root.rotation.y = this.yaw
    // 指针视差叠加一点点，让球「悬浮」而不是钉在那里
    this.root.rotation.x = this.pitch - pointer.y * 0.06
    this.root.rotation.z = Math.sin(t * 0.17) * 0.02
    this.root.scale.setScalar(this.orbScale)

    const camDist = this.camera.position.z
    const halfW =
      Math.tan((this.camera.fov / 2) * (Math.PI / 180)) * camDist * this.camera.aspect
    const halfH = Math.tan((this.camera.fov / 2) * (Math.PI / 180)) * camDist
    this.root.position.x = this.orbShiftX * halfW
    // 悬浮：缓慢上下浮动
    this.root.position.y = this.orbShiftY * halfH + Math.sin(t * 0.42) * 0.2
    this.root.updateMatrixWorld()

    // 相机随指针轻微视差
    const targetZ = this.cameraDistance()
    this.camera.position.z += (targetZ - this.camera.position.z) * (1 - Math.pow(0.05, dt))
    /*
      横向视差要跟手。
      ⚠️ 别沿用上面那条 `1 − 0.05^dt`（到 90% 要 769ms）——
      指针在 SceneLayer 里已经平滑过一次，这里再慢慢跟就是**串联**两段延迟，
      加起来近 1.4 秒，体感正是用户说的「鼠标移动有延迟」。
      z 那条保持慢：它响应的是「打开/关闭板块」这类一次性变化，不是指针。
    */
    this.camera.position.x +=
      (pointer.x * 0.5 - this.camera.position.x) * (1 - Math.exp(-dt / 0.07))
    // 相机始终看向原点，**不跟随球体的位移** ——
    // 跟随的话球会永远停在画面正中，位移完全失效（这个 bug 踩过一次）。
    this.camera.lookAt(0, 0, 0)
    this.camera.updateMatrixWorld()

    // ⚠️ 必须放在 root / camera 的 updateMatrixWorld 之后 ——
    // 放大镜要用**这一帧**的矩阵做射线求交，用上一帧的矩阵的话
    // 球转得快时镜子会明显落后于光标。
    this.updateLens(dt)

    this.pointsMat.uniforms.uTime.value = t
    this.flowMat.uniforms.uTime.value = t
    this.flowMat.uniforms.uFocus.value = this.focusIdx
    this.lifeMat.uniforms.uTime.value = t
    this.bodyMat.uniforms.uTime.value = t

    // 自动事件 + 各槽计时
    this.tickAutoEvents(dt)
    this.eventMat.uniforms.uTime.value = t
    const ageU = this.eventMat.uniforms.uAge.value as number[]
    for (let i = 0; i < this.EVENT_SLOTS; i++) {
      if (this.eventAge[i] < 1) this.eventAge[i] += dt / this.eventDur[i]
      ageU[i] = this.eventAge[i]
    }

    // ⚠️ 必须在 updateMatrixWorld 之后 —— aimPhoto 要用 root 的世界矩阵求逆
    this.aimPhoto(dt)
    this.projectPanes()
    this.renderer.render(this.scene, this.camera)
  }

  /** 球体当前的屏幕半径（px），含缩放。多处要用，抽出来。 */
  private orbRadiusPx(): number {
    const d = this.camera.position.z
    const halfH = Math.tan((this.camera.fov / 2) * (Math.PI / 180)) * d
    return ((ORB_RADIUS * this.orbScale) / halfH) * (window.innerHeight / 2)
  }

  /**
   * 小屏相对视口中心的偏移（px）。
   *
   * 小屏**让到球体侧面**，不压在球上 —— 引线才有一段干净的距离可走，
   * 「大洲 → 引线 → 小屏」这条视觉链路才读得出来。压在球上时引线
   * 从屏体底下钻出来，看着像小屏长在球里。
   *
   * @param side +1 = 让到右边，−1 = 让到左边。由调用方按锚点在哪一侧决定。
   */
  /**
   * 左侧还放得下小屏吗 —— 「球半径 + 引线的最小可见长度 + 小屏半宽」
   * 是否装得进「中线到导航右缘」这段距离。
   *
   * 引线短于 28px 时就只是个点（Panes 里画线的阈值是 24），
   * 那时并排已经没有意义，不如整个让到右边。
   */
  private paneFitsLeft(): boolean {
    const w = window.innerWidth
    if (w < 900) return true // 窄屏走纵向模式，不涉及左右
    const paneW = Math.min(310, w * 0.8)
    const NAV_BAND = 190
    const maxLeft = Math.max(0, w / 2 - paneW / 2 - NAV_BAND)
    // 偏移至少要比球半径多出 28px，引线才有可见长度
    return maxLeft >= this.orbRadiusPx() + 28
  }

  private paneOffsetPx(side: number): { x: number; y: number } {
    const rPx = this.orbRadiusPx()
    const w = window.innerWidth

    // 小屏的实际宽度。⚠️ 必须和 styles.css 的 .pane { width } 保持一致，
    // 否则夹不住溢出（或者夹过头，引线没长度可画）。
    const paneW = w < 768 ? Math.min(290, w * 0.86) : Math.min(310, w * 0.8)

    /*
      左侧被板块导航占掉的一条带（.orb-nav.is-home）。
      ⚠️ 不加这个的话，小屏往左让时会压在导航上 ——
      实测 1600px 及以下重叠 79–156px，导航整个被盖住看不清。

      NAV_BAND 必须 ≥ 导航的 left + 实际宽度。
      导航是 left: clamp(16px, 3vw, 44px)，内容宽约 128px，
      取 190 留一点余量。改导航的宽度或 left 时要一起调这个数。
      窄屏（<900）走纵向模式，导航本身也不显示，所以不设禁区。
    */
    const NAV_BAND = w < 900 ? 0 : 190
    // 偏移后小屏边缘不能出界；往左时还要躲开导航那条带
    const maxRight = Math.max(0, (w - paneW) / 2 - 10)
    const maxLeft = Math.max(0, w / 2 - paneW / 2 - NAV_BAND)
    const maxX = side < 0 ? maxLeft : maxRight

    // 让到球体侧面：理想位置是「球的屏幕半径 + 小屏半宽 + 余量」，
    // 屏体边缘刚好擦着球的轮廓外侧。
    const want = rPx + paneW / 2 + 24

    // 但球在多数屏上很大（1440×900 时半径就有 373px），完全让开会出界。
    // 夹到 maxX 即可 —— 小屏压住球的一点边缘没关系，
    // 关键是引线有一段横向距离可走，「大洲 → 线 → 屏」读得出来。
    // 早先这里是 want > maxX 就退回纵向，结果只有 1920 宽才走并排，
    // 笔记本上全是「球上屏下」，白做了。
    //
    // 真放不下时（手机）才退回纵向：球在上、小屏在下。
    const narrow = w < 900
    return {
      x: narrow ? 0 : side * Math.min(want, maxX),
      // 并排时不再需要纵向下沉，小屏和球同高读起来更稳；
      // 纵向模式下才把小屏压到球下方。
      y: narrow ? rPx * 0.92 : 0,
    }
  }

  /**
   * 把 6 个锚点投影成屏幕坐标，写进 this.panes 供 DOM 读取。
   *
   * depth = 「这块大洲有多正对观众」：锚点法线（相对球心的方向）
   * 和「锚点 → 相机」方向的点积。正对时 1，转到背面时 -1。
   */
  private projectPanes() {
    const w = window.innerWidth
    const h = window.innerHeight

    for (let i = 0; i < FACES; i++) {
      this.tmpVec.set(...this.anchors[i])
      this.tmpVec.applyMatrix4(this.root.matrixWorld)

      const nx = this.tmpVec.x - this.root.position.x
      const ny = this.tmpVec.y - this.root.position.y
      const nz = this.tmpVec.z - this.root.position.z
      const nl = Math.hypot(nx, ny, nz) || 1
      const vx = this.camera.position.x - this.tmpVec.x
      const vy = this.camera.position.y - this.tmpVec.y
      const vz = this.camera.position.z - this.tmpVec.z
      const vl = Math.hypot(vx, vy, vz) || 1
      const facing = (nx * vx + ny * vy + nz * vz) / (nl * vl)

      const p = this.panes[i]
      p.depth = THREE.MathUtils.clamp(facing * 0.5 + 0.5, 0, 1)
      p.focused = i === this.focusIdx
      /*
        这一块的开机动画有没有真正开始（onFocus 已经发出去了）。

        ⚠️ focusIdx 在**运镜一开始**就换成新的一块，但 onFocus 要等
        相机停稳（settled）才发。中间这段时间里 DOM 层的 bootAt 还停在
        上一次的时间戳，算出的 reach 已经是 1 —— 小屏会先闪现一下
        再消失，然后才正常播开机动画。
        用这个标记把那段窗口盖掉：没 armed 就一律不显示。
      */
      p.armed = i === this.focusIdx ? this.booted : false

      this.tmpVec.project(this.camera)
      // 大洲锚点的真实位置 —— 引线的终点
      p.ax = (this.tmpVec.x * 0.5 + 0.5) * w
      p.ay = (-this.tmpVec.y * 0.5 + 0.5) * h

      // 在球的正面、且是当前聚焦的那块，就算「可指向」。
      // ⚠️ 这里**不**看 steady —— 转动中锚点照样要更新，
      // 引线才能一边跟着大洲走一边往回缩（见 Panes.tsx 的交接动画）。
      // 「转动中要不要显示」是 DOM 层按 steady 决定的，不是这里。
      p.visible = this.tmpVec.z < 1 && p.focused && p.depth > 0.15
    }

    // 小屏的位置要等锚点算完才知道 —— 它让向锚点的**反**侧，
    // 所以必须先有 ax。用聚焦那块的锚点决定，六块共用同一个位置
    //（同时只显示一块，不会打架）。
    //
    // ⚠️ 位置只跟「锚点在球心左边还是右边」有关，不跟着锚点连续飘：
    // 大洲的投影会随经纬度上下左右跑，小屏跟着跑就会顶到 HUD、
    // 掉出屏幕、或者每次停靠位置都不一样。阅读位置必须是稳定的。
    const f = this.panes[this.focusIdx]
    if (f?.visible) {
      // 带迟滞：锚点越过中线**一段距离**（球半径的 18%）才换边。
      // 只判正负的话，锚点在中线附近抖动会让小屏左右横跳。
      const dead = this.orbRadiusPx() * 0.18
      if (f.ax < w * 0.5 - dead) this.paneSide = 1
      else if (f.ax > w * 0.5 + dead) this.paneSide = -1

      /*
        左侧被板块导航占掉一条带之后，窄一点的屏幕上左侧已经放不下
        「球 + 引线 + 小屏」了 —— 硬放的结果是小屏压进球里、引线长度
        变成负数（实测 1280px 时 −3px），线直接消失。
        这种情况强制换到右侧：右边是空的，让过去比挤在左边好。
        ⚠️ 这个判断必须在迟滞之后 —— 否则会和迟滞打架来回横跳。
      */
      if (this.paneSide < 0 && !this.paneFitsLeft()) this.paneSide = 1
    }
    const off = this.paneOffsetPx(this.paneSide)
    // 换边时平滑滑过去，不瞬移。惯性系数和球体的运镜同量级。
    const k = 1 - Math.pow(0.02, this.lastDt)
    this.paneX += (off.x - this.paneX) * k
    this.paneY += (off.y - this.paneY) * k
    for (const p of this.panes) {
      p.x = w * 0.5 + this.paneX
      p.y = h * 0.5 + this.paneY
    }
  }

  start() {
    if (this.raf) return
    this.clock.start()
    this.raf = requestAnimationFrame(this.tick)
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.cap.dprCap))
    this.renderer.setSize(w, h)
    // 点云和海面居民都按视口缩放，两个都要更新 ——
    // 漏掉 life 的话，改窗口后船的大小就和球对不上了。
    for (const m of [this.pointsMat, this.lifeMat]) {
      m.uniforms.uPixelRatio.value = this.renderer.getPixelRatio()
      m.uniforms.uSizeScale.value = this.sizeScale()
    }
  }

  dispose() {
    this.disposed = true
    this.stop()
    this.onFocus = null
    this.pointsGeo.dispose()
    this.pointsMat.dispose()
    this.coastGeo.dispose()
    this.coastMat.dispose()
    this.gridGeo.dispose()
    this.gridMat.dispose()
    this.bodyGeo.dispose()
    this.bodyMat.dispose()
    this.haloGeo.dispose()
    this.haloMat.dispose()
    this.flowGeo.dispose()
    this.flowMat.dispose()
    this.lifeGeo.dispose()
    this.lifeMat.dispose()
    this.photoGeo.dispose()
    for (const m of this.photoMats) m.dispose()
    for (const t of this.photoCache.values()) t.dispose()
    this.photoCache.clear()
    this.lifeTex.dispose()
    this.eventGeo.dispose()
    this.eventMat.dispose()
    this.renderer.dispose()
  }
}
