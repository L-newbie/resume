// ─────────────────────────────────────────────────────────────
// 内容层类型定义。全站文案都走这里，UI 组件只负责渲染。
// 双语：所有面向用户的字符串都是 LocalizedText = { zh, en }。
// ─────────────────────────────────────────────────────────────

export type Lang = 'zh' | 'en'

/** 一段双语文本。写内容时两种语言都要给，缺一个会在类型检查时报错。 */
export interface L<T = string> {
  zh: T
  en: T
}

/** 取出当前语言的值。`pick({zh:'你好',en:'Hi'}, 'zh') === '你好'` */
export const pick = <T,>(v: L<T>, lang: Lang): T => v[lang]

/**
 * 技术标签 / 技能名。
 *
 * 大部分是专有名词（Python、three.js），中英文一样，直接写字符串。
 * 但「数据挖掘 / Mining」这种需要区分 —— 写成 { zh, en }。
 * ⚠️ 别再往字符串里塞 `中文 / English` —— 那样两种语言会同时显示，
 * 切了语言也不变，是最早那版留下的写法。
 */
export type Tag = string | L

/** 把 Tag 归一成当前语言的字符串 */
export const tag = (t: Tag, lang: Lang): string =>
  typeof t === 'string' ? t : t[lang]

// ── 身份 / 首屏 ────────────────────────────────────────────

export interface Identity {
  /** 中文名 / 英文名，首屏主标题 */
  name: L
  /** 姓名下方的拼音 / 罗马字，装饰用 */
  latin?: string
  /** 周岁。只有 PDF 简历的抬头用它，网页上不显示 */
  age?: number
  /** 一句话职位，如「数据挖掘工程师」 */
  role: L
  /** 职位的补充说明，比 role 更具体的一行 */
  roleDetail?: L
  /** 首屏副标题，2–3 句，说明你在做什么 */
  tagline: L
  /**
   * HUD 角标用的短标识。
   * ⚠️ 必须是双语的 —— 它出现在左上角 HUD 和照片说明里，
   * 切到中文时跟着变成中文名，否则「切了语言但角标还是英文」很出戏。
   */
  callsign: L
  location: L
  /** 首屏 HUD 上显示的坐标（装饰用，可写公司所在城市） */
  coords: { lat: number; lon: number }
  /**
   * 个人照片。放在 public/ 下，这里写 'photo.jpg' 即可。
   * 留空 / 设为 null → 显示程序生成的占位图，不会破版。
   */
  photo?: string | null
  /**
   * 教育经历。
   * ⚠️ 放在身份里而不是工作经历时间轴里 —— 学历是「你是谁」的一部分，
   * 混进工作时间轴会让「这段时间在哪工作」这条主线断掉
   *（在职读的学历尤其如此，它和工作是并行的，不是接续的）。
   * ⚠️ 刻意**不带年份字段** —— 个人信息里只要「什么学校、什么专业」，
   * 年份是噪声。
   */
  education?: { school: L; degree: L }[]
}

/** 求职状态徽标 */
export interface Availability {
  open: boolean
  label: L
  detail: L
}

// ── 导航 ──────────────────────────────────────────────────

export interface NavItem {
  /** 对应 section 的 DOM id */
  id: string
  /** 编号，如 '01' */
  no: string
  label: L
}

// ── 履历时间轴 ─────────────────────────────────────────────

export interface TimelineEntry {
  /** 时间区间，如 '2021 — 2024'；用 '至今' / 'Now' 表示当前 */
  period: L
  /** 组织 / 学校 */
  org: L
  /**
   * 曲线时间轴上的节点标签 —— 必须短（2–6 字）。
   * org 是全称（「北京地平线机器人技术研发有限公司」），
   * 挂在节点上会把曲线撑变形，所以另给一个简称。
   */
  orgShort: L
  /** 节点下方的一行角色摘要，比 role 更短 */
  brief: L
  /** 岗位 / 学位 */
  role: L
  /** 一句话概括这段经历的核心 */
  summary: L
  /** 具体产出，建议写「问题 → 交付」而不是职责流水账 */
  points: L<string[]>
  /** 技术栈标签，渲染成 chip */
  stack?: Tag[]
  /** 当前进行中 → HUD 上显示 ●ACTIVE 脉冲 */
  current?: boolean
}

// ── 项目 ──────────────────────────────────────────────────

/**
 * 项目详情里的一个内容分组。
 * 详情页右侧的浮动按钮和这些分组一一对应，点哪个显示哪段。
 *
 * body / points / metrics 三者按需给，不必都有 ——
 * 「背景」通常只要一段散文，「交付」适合要点列表，
 * 「成果」配指标卡最有说服力。
 */
export interface ProjectSection {
  /** 锚点 id，也是浮动按钮的 key */
  id: string
  /** 浮动按钮上的短标签，2–4 个字 */
  label: L
  /** 段落正文 */
  body?: L
  /** 要点列表。每条建议写「做了什么 → 达成什么」 */
  points?: L<string[]>
  /** 指标卡：一个数字 + 一句说明。放在分组顶部 */
  metrics?: { value: string; label: L }[]
}

export interface Project {
  /** 唯一 id，用于 URL hash 和详情弹层 */
  id: string
  no: string
  title: L
  /** 卡片上的一句话概括 */
  tagline: L
  /**
   * 时间区间。
   * ⚠️ PROJECTS 数组按时间**从早到晚**排列，卡片也按这个顺序从左到右铺。
   * 加新项目时放到对应的时间位置，别直接 push 到末尾。
   */
  period: L
  /** 所属组织（全称，显示在卡片和详情页） */
  org: L
  /**
   * 分组用的短名 —— 卡片墙按它分区。
   * 开源项目统一归到「开源项目」区，公司项目按公司各自成区。
   * ⚠️ 同一家公司的项目这个值必须完全一致，否则会被拆成两个区。
   */
  orgShort: L
  /**
   * 项目性质。
   * oss      开源项目，可公开源码与在线体验
   * internal 公司内部项目，不提供外链
   */
  kind: 'oss' | 'internal'
  /** 内容分组 —— 详情页右侧的浮动按钮由它生成 */
  sections: ProjectSection[]
  stack: Tag[]
  /** 外链，没有就不渲染按钮。内部项目一律不给。 */
  links?: { label: L; href: string }[]
  /** 标记为重点项目 → 卡片高亮 */
  featured?: boolean
}

// ── 能力矩阵 ───────────────────────────────────────────────

export interface SkillGroup {
  label: L
  /** 这一组的一句话说明，解释「强在哪」而不只是「会什么」 */
  caption?: L
  /**
   * 这一组是不是**重点方向**。
   * 重点组在「个人优势」板块里排在前面、整组高亮 ——
   * 当前重点：数据挖掘、数据采集、模型相关、AI 大模型相关。
   */
  core?: boolean
  /**
   * level: 0–1；note 是卡片上常驻的一行短说明。
   * ⚠️ level 现在只用来**排序**，不再渲染成进度条 ——
   * 21 条 level 全落在 0.68–0.95，条长几乎一样，
   * 既占掉 90% 的视觉重量又给不出区分度。
   * key:  标记这一项是重点技能，渲染成高亮 chip。
   * detail: 鼠标移入卡片时展开的详情。写「怎么用的 / 解决了什么」，
   *         不是名词解释 —— 三条优势（跨域可迁移 / 从数据到结论 /
   *         工具化的习惯）就是融进这里，不再单独占一块。
   */
  items: {
    name: Tag
    level: number
    note?: L
    key?: boolean
    detail?: L
  }[]
}

// ── 联系方式 ───────────────────────────────────────────────

export interface SocialLink {
  id: string
  /** 显示出来的值：号码 / 邮箱 / 地址。大小写敏感，不翻译也不转大写。 */
  label: string
  /** 这一项叫什么（电话 / 邮箱）—— 小屏读数行的左侧标签用它 */
  name: L
  href: string
  /** 图标名，对应 ui/Icons.tsx 里的 key */
  icon: 'github' | 'mail' | 'linkedin' | 'zhihu' | 'x' | 'link' | 'phone'
}
