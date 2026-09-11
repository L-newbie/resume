// ─────────────────────────────────────────────────────────────
//  ✏️  内容层 —— 全站文案都在这个文件里。
//
//  所有面向用户的字符串都是 { zh: '中文', en: 'English' }。
//  改这里 → 全站生效，不用碰组件代码。
//
//  内容来自你的简历 + real-time-valuation 仓库。
//  标了 ⚠️TODO 的是我无法确认、需要你补的地方。
// ─────────────────────────────────────────────────────────────

import type {
  Availability,
  Identity,
  NavItem,
  Project,
  SkillGroup,
  SocialLink,
  TimelineEntry,
  L,
} from './types'

const GITHUB = 'https://github.com/L-newbie'

/**
 * 这个站自己的地址。
 *
 * ⚠️ 只有 PDF 简历用它（抬头里写「个人网站 …」并做成可点的链接）——
 * 网页上不显示：人已经在站里了，再放一个指向自己的链接是废话。
 */
export const SITE_URL = 'https://l-newbie.github.io/resume'

// ── 01 身份 ────────────────────────────────────────────────

export const IDENTITY: Identity = {
  name: { zh: '赫卫东', en: 'He Weidong' },
  latin: 'HE WEIDONG',
  // ⚠️ 和 PDF 简历的求职意向保持一致：数据开发工程师。
  // 别改回「数据挖掘工程师」—— 挖掘只是这份工作的一部分，
  // 简历上投出去的抬头是数据开发。
  role: { zh: '数据开发工程师', en: 'Data Engineer' },
  roleDetail: {
    zh: '数据闭环 · 数据工具链 · AI 应用开发',
    en: 'Data Loops · Data Toolchains · AI Applications',
  },
  tagline: {
    zh: '七年数据一线。把杂乱的原始数据变成能支撑判断的东西 —— 自动驾驶的动态感知数据闭环，也包括电诈案件里的资金链条。现在用 AI 把这套方法做成能装、能跑、能验证的工具。',
    en: 'Seven years on the data front line. I turn messy raw data into something that supports a decision — the dynamic-perception data loop for autonomous driving, and the money trails inside fraud cases. Now I use AI to turn that method into tools you can install, run, and verify.',
  },
  callsign: { zh: '赫卫东', en: 'HE WEIDONG' },
  // ⚠️ 每年记得 +1。PDF 简历的抬头读它（`npm run pdf`），
  // 写死在脚本里的话改一次要翻两个文件。
  age: 30,
  location: { zh: '中国 · 北京', en: 'Beijing, China' },
  coords: { lat: 39.9042, lon: 116.4074 },
  // 照片放在 public/ 下。当前这张是 4:3 半身照，
  // 裁切窗口对准人脸的 object-position 在 styles.css 的 .pt-media img 里，
  // 手机端的 aspect-ratio 同处。换照片时这两个值要一起改。
  photo: 'photo.jpg',
  // 教育经历从工作经历时间轴挪到这里 —— 学历属于「你是谁」。
  // ⚠️ 只留最高学历，且不写年份、不标「非全日制」——
  // 这些细节在个人信息里是噪声，真要问会在面试里问。
  education: [
    {
      school: { zh: '河北大学', en: 'Hebei University' },
      degree: {
        zh: '计算机科学与技术 · 本科',
        en: 'B.S. Computer Science',
      },
    },
  ],
}

/** 求职状态。设为 null 则不渲染这个 HUD 徽标。 */
export const AVAILABILITY: Availability | null = {
  open: true,
  label: { zh: '考虑机会', en: 'OPEN TO WORK' },
  detail: { zh: '北京 · 行业不限', en: 'Beijing · Any industry' },
}

/**
 * 每个板块对应一张照片（放在 public/ 下，这里只写文件名）。
 *
 * 两处在用，改这里两处一起变：
 *   · 球面上的弧形照片（OrbScene.buildPhotos）
 *   · 左上角的原图小图（PhotoBadge）
 *
 * ⚠️ 顺序必须和 SECTIONS 一致 —— 索引即板块号，也是球面上的瓣号。
 * ⚠️ 长度不足时按板块号取模回绕（见 sectionPhoto），
 * 所以只填一张也不会崩，只是每块都显示同一张。
 *
 * ⚠️ 这里存的是**不带扩展名**的基名。扩展名由 sectionPhoto() 按
 * 浏览器能力选（webp / jpg），所以 public/ 下两种格式要成对存在。
 *
 * 文件名按「板块号 + 板块 id」命名（id 见 SECTIONS，注意 02 是
 * timeline、03 是 projects，不是 career/work）。换图时**直接覆盖
 * 同名文件**即可，不用改这里。
 */
export const SECTION_PHOTOS: string[] = [
  'section-00-hero', // 00 个人信息
  'section-01-skills', // 01 能力
  'section-02-timeline', // 02 工作经历
  'section-03-projects', // 03 项目
  'section-04-contact', // 04 联系我
]

/**
 * 浏览器支不支持 WebP。
 *
 * ⚠️ 只探测一次并缓存 —— 这个判断会被每次取图调用到。
 * 用 canvas 导出 dataURL 的前缀判断：支持时才会真的编码成 webp，
 * 不支持的浏览器会退回 png。
 * 没有 document 时（SSR / 测试）保守返回 false。
 */
let webpOk: boolean | null = null
function supportsWebp(): boolean {
  if (webpOk !== null) return webpOk
  if (typeof document === 'undefined') return (webpOk = false)
  try {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 1
    webpOk = cv.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    webpOk = false
  }
  return webpOk
}

/**
 * 取第 i 个板块的照片文件名（含扩展名）。
 *
 * ⚠️ 数组里存的是**不带扩展名**的基名 —— 扩展名在这里按浏览器
 * 能力选：支持就用 webp（同画质下体积只有 jpg 的三分之一），
 * 不支持退回 jpg。两种格式的文件都在 public/ 下，成对存在。
 * ⚠️ 数组不够长时按板块号回绕，永远返回一个可用的文件名。
 */
export function sectionPhoto(i: number): string {
  if (SECTION_PHOTOS.length === 0) return ''
  const k =
    ((i % SECTION_PHOTOS.length) + SECTION_PHOTOS.length) %
    SECTION_PHOTOS.length
  return `${SECTION_PHOTOS[k]}.${supportsWebp() ? 'webp' : 'jpg'}`
}

// ── 02 导航 ────────────────────────────────────────────────

export const NAV: NavItem[] = [
  { id: 'hero', no: '00', label: { zh: '个人信息', en: 'Profile' } },
  { id: 'skills', no: '01', label: { zh: '能力', en: 'Capabilities' } },
  { id: 'timeline', no: '02', label: { zh: '工作经历', en: 'Career' } },
  { id: 'projects', no: '03', label: { zh: '项目', en: 'Work' } },
  { id: 'contact', no: '04', label: { zh: '联系我', en: 'Contact' } },
]

/**
 * 首屏关键数字。
 * 选的都是「能说明量级或跨度」的维度，不用过程指标（比如写了多少测试）——
 * 那说明不了价值。留空数组则不渲染。
 */
export const METRICS: { value: string; label: L; detail: L }[] = [
  {
    value: '7',
    label: { zh: '年数据一线', en: 'Years in data' },
    detail: {
      zh: '2019 年至今持续做数据，不是转岗路过。七年只做一件事：把杂乱的原始数据，变成能支撑判断的东西。',
      en: 'Continuously in data since 2019 — not a stopover on the way somewhere else. Seven years doing one thing: turning messy raw data into something that supports a decision.',
    },
  },
  {
    value: '3',
    label: { zh: '个行业跨度', en: 'Industries crossed' },
    detail: {
      zh: '金融证券、刑侦数据、自动驾驶 —— 电诈案件里的资金链条，和自动驾驶的动态感知，用的是同一套方法。跨度大意味着它可迁移，不依赖某个行业的特定套路。',
      en: 'Finance, criminal investigation, autonomous driving — the money trails inside fraud cases and dynamic perception for self-driving run on the same method. The spread means it transfers; it does not depend on one industry\u2019s playbook.',
    },
  },
  {
    value: '5',
    label: { zh: '段闭环链路', en: 'End-to-end loops built' },
    detail: {
      zh: '数据挖掘、标签体系、badcase 自动仿真、真值生产、数据打包 —— 每一段都独立能跑，串起来就是一条自动运转的动态感知数据闭环。',
      en: 'Mining, tagging, automated bad-case simulation, ground truth, packaging — each runs on its own; chained together they form a self-running dynamic-perception data loop.',
    },
  },
  {
    value: '0→1',
    label: { zh: '独立产品上线', en: 'Product shipped solo' },
    detail: {
      zh: '基攻宝：产品设计、架构、编码、部署、运维，一个人四万行代码做到上线并持续迭代。现在用 AI 把这套方法做成能装、能跑、能验证的工具。',
      en: 'Ji-Gong-Bao: product design, architecture, code, deployment and operations — 40K lines shipped solo and still iterating. Now I use AI to turn that method into tools you can install, run, and verify.',
    },
  },
]

// ── 04 履历时间轴 ──────────────────────────────────────────

export const TIMELINE: TimelineEntry[] = [
  {
    period: { zh: '2026.03 — 至今', en: 'Mar 2026 — Present' },
    org: { zh: '独立开发 · 基攻宝', en: 'Independent · Ji-Gong-Bao' },
    orgShort: { zh: '基攻宝', en: 'Ji-Gong-Bao' },
    brief: { zh: '独立开发 · 全栈', en: 'Solo · Full-stack' },
    role: { zh: 'AI 应用开发 · 全栈', en: 'AI Application Development · Full-stack' },
    summary: {
      zh: '以 AI 协作为核心工作方式，独立完成从产品设计到运维的完整交付链路，验证「一人全栈」在真实复杂度下的可行性边界。',
      en: 'Working with AI collaboration as the core method, delivering the full chain from product design through operations single-handedly — probing the feasibility boundary of one-person full-stack under real complexity.',
    },
    points: {
      zh: [
        '独立交付「基攻宝」基金实时估值系统 —— 约 4 万行 TypeScript，无后端架构，已上线并迭代至 v3.0，源码与在线体验公开',
        '建立 19 个功能域的自动化回归网并接入 pre-commit 钩子，在无同行评审的条件下构造出可信的质量兜底，这也是敢于持续重构的前提',
        '攻克金融计算的耦合难题：T+N 申赎确认、跨日结算、分红再投、净值重校准存在计算顺序依赖，以显式状态机替代隐式条件分支实现',
        '将方法沉淀为可复用的 Agent Skill，把「AI 怎么用」从个人经验转为他人可直接调用的工程资产',
      ],
      en: [
        'Independently delivered Ji-Gong-Bao, a real-time fund valuation system — ~40K lines of TypeScript, backend-free, live and iterated through v3.0, with source and demo public',
        'Established an automated regression net across 19 functional domains wired into a pre-commit hook, constructing a trustworthy quality backstop absent peer review — the precondition for continuous refactoring',
        'Solved the coupling problem in financial computation: T+N confirmation, cross-day settlement, dividend reinvestment and NAV recalibration carry ordering dependencies, implemented as an explicit state machine rather than implicit branching',
        'Codified the method into reusable Agent Skills, converting "how to work with AI" from personal experience into an engineering asset others can invoke directly',
      ],
    },
    stack: ['Vue 3', 'TypeScript', 'Vite', 'Pinia', 'ECharts', 'Vitest', 'PWA'],
    current: true,
  },
  {
    // ⚠️ 在职中。曾经写成 2021.11 — 2024.10（已离职），和简历对不上。
    period: { zh: '2021.11 — 至今', en: 'Nov 2021 — Present' },
    org: { zh: '北京地平线机器人技术研发有限公司', en: 'Horizon Robotics' },
    orgShort: { zh: '地平线机器人', en: 'Horizon' },
    brief: { zh: '数据开发 · 动态感知', en: 'Data Eng · Perception' },
    role: { zh: '数据开发工程师 · 动态感知数据闭环', en: 'Data Engineer · Dynamic-Perception Data Loop' },
    summary: {
      zh: '主导自动驾驶动态感知的数据基础设施建设，将挖掘、标注、真值、打包四个割裂环节重构为自运转流水线，使数据供给从人力排期解耦为按需配置。',
      en: 'Led data-infrastructure construction for dynamic perception in autonomous driving, restructuring four siloed stages — mining, labeling, ground truth, packaging — into a self-running pipeline that decoupled data supply from headcount scheduling.',
    },
    points: {
      zh: [
        '场景标签体系 —— 参与设计动静态障碍物场景库标签树，将「何种路况构成同一类场景」标准化为可执行规范；开发并维护自动 tagger，统筹保障标签跨专题、跨批次的一致性',
        '时序数据挖掘 —— 解析仿真结果的结构化 msg，构建时序模块与 filter 模型，将离散帧级消息聚合为具明确起止边界的 timeline 事件，使动态行为成为可检索的一等对象',
        'Badcase 自动仿真 —— 为误检漏检制定可复现的检测规则并开发自动仿真模块，产出 web 分析大屏，将归因周期从人工排查压缩为一次看板浏览',
        '长尾专题攻坚 —— 主导小动物检测专题，设计三级漏斗（规则粗筛 → 大模型语义精提 → 规则化人审），以递进式成本分配替代全量标注，方法论此后被复用于其他专题',
        '全链路打通 —— 四个环节接入同一流水线，新专题接入由重写代码降级为修改配置',
        '大模型进链路 —— 锥桶专题以 DAG 编排数据链路，接入 Qwen-VL、SAM3、YOLOv8 等开源模型做匹配与验证，配合车端结果反向验证与人工过滤，稳定支撑每个计划周期 10w+ 的数据需求',
      ],
      en: [
        'Scenario tag system — co-designed the tag tree for static and dynamic obstacles, formalizing what constitutes one class of road situation into an executable specification; built and maintained the auto-tagger, ensuring label consistency across topics and batches',
        'Time-series mining — parsed structured messages from simulation output and built the time-series module and filter model, aggregating frame-level messages into bounded timeline events and making dynamic behavior a first-class retrievable object',
        'Automated bad-case simulation — defined reproducible detection rules for false positives and negatives and built the simulation module, delivering a web analytics dashboard that compressed attribution from manual investigation to a single dashboard read',
        'Long-tail program — led the small-animal detection program, designing a three-stage funnel (rule-based coarse filtering → LLM semantic extraction → rule-governed human review), replacing exhaustive annotation with progressive cost allocation; the methodology was reused across later programs',
        'Full-chain integration — four stages joined into one pipeline, with new-topic onboarding downgraded from rewriting code to editing configuration',
        'Foundation models in the loop — the traffic-cone program orchestrates its pipeline as a DAG, wiring in Qwen-VL, SAM3 and YOLOv8 for matching and verification, paired with reverse validation against on-vehicle model output and human filtering, sustaining 10w+ items per planning cycle',
      ],
    },
    stack: ['Python', 'SQL', 'MySQL', 'YOLO', 'Qwen-VL', 'DAG', 'OpenCV', { zh: '仿真系统', en: 'Simulation' }, 'Linux'],
    current: true,
  },
  {
    period: { zh: '2019.06 — 2021.09', en: 'Jun 2019 — Sep 2021' },
    org: { zh: '北京集侦云科技有限责任公司', en: 'Jizhenyun Technology' },
    orgShort: { zh: '集侦云', en: 'Jizhenyun' },
    brief: { zh: '数据分析 · 刑侦建模', en: 'Analyst · Investigation' },
    role: { zh: '数据分析师 · 刑侦数据建模', en: 'Data Analyst · Criminal-Investigation Modeling' },
    summary: {
      zh: '面向刑侦实战的数据治理与关系建模，在数十张异构账表中还原跨境电诈的资金拆分路径，输出可直接落地侦查的结论。',
      en: 'Data governance and relationship modeling for frontline criminal investigation — reconstructing cross-border fraud fund-splitting paths from dozens of heterogeneous ledgers into conclusions investigators could act on directly.',
    },
    points: {
      zh: [
        '异构数据治理 —— 对数十张来源各异的表执行系统性清洗与实体对齐：缺失值与异常值识别修正、重复消解、字段口径统一，使原本无法联合查询的数据具备统一检索能力',
        '关系分级加权建模 —— 拒绝等权处理所有关联，以交易金额、频次、关系传递层级三个维度对边施加分级权重，使主干资金链自然凸显而非被低价值关联淹没，这一步直接决定分析结果的可读性',
        '公开数据补全 —— 自研爬虫采集企业征信平台的法定代表人、股东结构与关联企业信息，将孤立的企业节点与真实自然人建立连接，拓展出仅凭内部数据无法观察的关联路径',
        '成果落地 —— 输出带置信排序的重点账户清单交由刑侦大队逐一核实，协助勘破该案',
      ],
      en: [
        'Heterogeneous data governance — systematic cleaning and entity alignment across dozens of disparate tables: outlier correction, deduplication, semantic unification, giving previously incompatible sources unified queryability',
        'Weighted relationship modeling — refusing to weight all relations equally, grading edges across transaction amount, frequency and degree of separation so the primary fund chain emerged rather than drowning under low-value links; this step alone determined whether the output was legible',
        'Public-registry enrichment — purpose-built crawlers collected legal representatives, shareholder structures and affiliated entities, connecting isolated corporate nodes to real individuals and surfacing paths unobservable from internal data alone',
        'Delivered outcome — produced a confidence-ranked priority account list verified holder by holder by the investigation unit, contributing to the resolution of the case',
      ],
    },
    stack: ['Python', 'MySQL', 'Pandas', { zh: '爬虫工程', en: 'Crawler Engineering' }, { zh: '关系建模', en: 'Graph Modeling' }],
  },
]

// ── 05 项目 ────────────────────────────────────────────────

export const PROJECTS: Project[] = [
  {
    id: 'fraud-analysis',
    no: '01',
    title: { zh: '电诈资金流向分析', en: 'Telecom-Fraud Money-Flow Analysis' },
    // ⚠️ 以 PDF 简历为准（2021.3-2021.6）。「2019 — 2021」是在集侦云的
    // 整段任期，不是这个案子的周期。
    period: { zh: '2021.03 — 2021.06', en: 'Mar 2021 — Jun 2021' },
    org: { zh: '集侦云 · 联合河北省刑侦大队', en: 'Jizhenyun · with a provincial criminal investigation unit' },
    orgShort: { zh: '集侦云', en: 'Jizhenyun' },
    kind: 'internal',
    tagline: {
      zh: '从数十张异构账表中还原资金拆分路径，输出可直接落地侦查的重点账户清单',
      en: 'Reconstructing fund-splitting paths from dozens of heterogeneous ledgers into an actionable list of priority accounts',
    },
    sections: [
      {
        id: 'context',
        label: { zh: '背景', en: 'Context' },
        body: {
          zh: '一起以网络赌博为外壳的跨境电信诈骗案。资金自受害人充值入口进入后，经多层线上转账与线下取现反复拆分，最终流向境外。原始材料是数十张字段口径互不一致的 Excel 与 SQL 表，账户、自然人、企业、交易流水彼此交织。此类案件的常规做法——将全部关联直接投射为关系图——只会得到一张无法解读的稠密网络：侦查需要的不是拓扑图，而是若干个可立即核查的具体账户。',
          en: 'A cross-border telecom-fraud case operating under the cover of online gambling. Funds entered through victim deposits, then were split repeatedly across layered online transfers and offline cash withdrawals before leaving the country. The source material comprised dozens of Excel and SQL tables with mutually inconsistent field semantics, interleaving accounts, individuals, corporate entities and transaction records. The conventional approach — projecting every relation into a graph — yields only an unreadable dense network. What an investigation requires is not a topology, but a small set of immediately verifiable accounts.',
        },
      },
      {
        id: 'approach',
        label: { zh: '方法', en: 'Approach' },
        points: {
          zh: [
            '异构数据治理 —— 对数十张来源各异的表执行系统性清洗：缺失值与异常值识别修正、重复记录消解、字段口径与格式统一，完成实体对齐后整合入库，使原本无法联合查询的数据具备统一检索能力',
            '关系分级加权建模 —— 全案的关键决策在于拒绝等权处理所有关联。以交易金额、交易频次、关系传递层级三个维度对边施加分级权重，使主干资金链在图上自然凸显，而非被数量级更大的低价值关联淹没。这一步直接决定了分析结果的可读性',
            '公开数据补全 —— 自研爬虫系统采集企业征信平台的法定代表人、股东结构与关联企业信息，将原始数据中孤立的企业节点与真实自然人建立连接，拓展出仅凭内部数据无法观察到的关联路径',
            '资金路径追踪 —— 沿加权后的主干链路逐层回溯拆分节点，识别通道账户与终端归集账户，形成带置信排序的重点账户清单',
          ],
          en: [
            'Heterogeneous data governance — systematic cleaning across dozens of disparate tables: detection and correction of missing and outlier values, duplicate resolution, unification of field semantics and formats, followed by entity alignment and consolidation into a single store, giving previously incompatible sources unified queryability',
            'Weighted relationship modeling — the decisive judgment was refusing to weight all relations equally. Edges were graded across three dimensions — transaction amount, frequency, and degree of separation — so the primary fund chain emerged naturally rather than drowning under orders-of-magnitude more low-value links. This step alone determined whether the output was legible',
            'Public-registry enrichment — a purpose-built crawler system collected legal representatives, shareholder structures and affiliated entities from corporate-credit platforms, connecting otherwise isolated corporate nodes to real individuals and surfacing paths unobservable from internal data alone',
            'Fund-path tracing — backtracking layer by layer along the weighted primary chain to identify pass-through and terminal aggregation accounts, producing a confidence-ranked list of priority accounts',
          ],
        },
      },
      {
        id: 'outcome',
        label: { zh: '成果', en: 'Outcome' },
        metrics: [
          { value: '数十张', label: { zh: '异构表整合入库', en: 'Heterogeneous tables consolidated' } },
          { value: '3', label: { zh: '维度关系加权模型', en: 'Dimensions in the weighting model' } },
        ],
        body: {
          zh: '重点账户清单交付刑侦大队后逐一核实持有人情况，协助勘破该案。这段经历确立了我此后所有数据工作的交付标准：分析的终点是一个他人可独立核实的结论，而非一张视觉精美的关系图或一组漂亮的中间指标。该标准在后续自动驾驶评测归因中同样成立——指标退化必须能指向具体数据切片，才具备工程价值。',
          en: 'The priority account list was handed to the investigation unit and verified holder by holder, contributing to the resolution of the case. This engagement established the delivery standard I have applied to all subsequent data work: an analysis terminates in a conclusion another party can independently verify — not a visually accomplished graph, nor a flattering intermediate metric. The same standard later held in autonomous-driving evaluation attribution, where a regression must resolve to a specific data slice before it carries engineering value.',
        },
      },
    ],
    stack: ['Python', 'MySQL', 'Pandas', { zh: '爬虫工程', en: 'Crawler Engineering' }, { zh: '关系建模', en: 'Graph Modeling' }],
  },
  {
    id: 'dynamic-data-loop',
    no: '01',
    title: { zh: '动态感知数据闭环', en: 'Dynamic-Perception Data Loop' },
    // ⚠️ 以 PDF 简历为准（2024.3-2024.10）。「2021 — 2024」是把整段
    // 在地平线的时间当成了这个项目的时间，两回事。
    period: { zh: '2024.03 — 2024.10', en: 'Mar 2024 — Oct 2024' },
    org: { zh: '地平线机器人', en: 'Horizon Robotics' },
    orgShort: { zh: '地平线机器人', en: 'Horizon Robotics' },
    kind: 'internal',
    tagline: {
      zh: '将挖掘、标注、真值、打包四个割裂环节重构为自运转流水线，把数据供给从人力排期解耦为按需配置',
      en: 'Restructuring four siloed stages into a self-running pipeline — decoupling data supply from headcount scheduling',
    },
    sections: [
      {
        id: 'context',
        label: { zh: '背景', en: 'Context' },
        body: {
          zh: '感知模型的迭代速度，其上界由数据供给速度决定而非算法本身。彼时的实际状况是：badcase 依赖算法工程师逐个手工收集；检索特定场景需人工遍历仿真日志；真值生产按专题各自为政、缺乏统一规范；评测指标出现退化时，无法归因至具体数据切片。链路的每一处断点都会形成工作堆积，而每一次堆积在结果上等价于模型少完成一轮迭代。问题的本质不在任何单个环节的效率，而在于整条链路缺乏自动流转能力。',
          en: 'The iteration speed of a perception model is bounded by data supply, not by the algorithm itself. The situation at the time: bad cases were collected by hand, one engineer at a time; retrieving a specific scenario meant manually traversing simulation logs; ground-truth production was siloed per topic without unified specification; and when evaluation metrics regressed, the cause could not be attributed to any particular data slice. Every break in the chain formed a backlog, and each backlog was equivalent in outcome to one fewer model iteration. The problem was never the efficiency of any single stage — it was that the chain as a whole could not advance without being pushed.',
        },
      },
      {
        id: 'tagging',
        label: { zh: '标签体系', en: 'Tag System' },
        points: {
          zh: [
            '参与设计动静态障碍物场景库标签树，将「何种路况构成同一类场景」这一判断标准化为可执行规范，为跨专题的数据检索建立统一语义基础',
            '开发并长期维护自动 tagger，对各类标签的增量数据执行定期质检，统筹保障标签在不同专题、不同时间批次间的一致性与准确性',
            '标签树落库后支撑 web 端多条件组合检索，使「找某类场景的数据」从人工遍历日志变为一次结构化查询',
          ],
          en: [
            'Co-designed the scenario tag tree for static and dynamic obstacles, formalizing the judgment of what constitutes one class of road situation into an executable specification, establishing a unified semantic basis for cross-topic retrieval',
            'Built and maintained the automatic tagger long-term, running periodic quality inspection on incremental tag data and ensuring label consistency and accuracy across topics and time batches',
            'With the tag tree persisted, the web layer supports multi-condition composite retrieval — turning "find data for this scenario class" from manual log traversal into a single structured query',
          ],
        },
      },
      {
        id: 'mining',
        label: { zh: '时序挖掘', en: 'Mining' },
        points: {
          zh: [
            '基于仿真结果解析结构化 msg（时间戳、目标类型、速度、Track ID），构建时序模块与 filter 模型',
            '将离散帧级消息按 Track 维度聚合为具备明确起止边界的 timeline 事件，使「某目标在某时段的完整行为」成为可检索的一等对象，而非散落的孤立帧',
            '挖掘结果回写标签树数据库，与标签体系形成互补：标签负责静态场景归类，时序事件负责动态行为刻画，二者联合支撑 web 端条件检索与可视化',
          ],
          en: [
            'Parsed structured messages from simulation output (timestamp, object class, velocity, track ID) and built the time-series module and filter model',
            'Aggregated discrete frame-level messages along the track dimension into timeline events with explicit start and end boundaries, making "the complete behavior of one object over an interval" a first-class retrievable object rather than scattered isolated frames',
            'Mining results were written back into the tag database, complementing the tag system: tags classify static scenarios, timeline events characterize dynamic behavior, and together they support web-side retrieval and visualization',
          ],
        },
      },
      {
        id: 'badcase',
        label: { zh: '仿真归因', en: 'Simulation' },
        points: {
          zh: [
            '针对误检与漏检分别制定可复现的仿真检测规则，将「这算不算一个 badcase」从主观判断转为规则判定',
            '开发自动仿真模块：任务启动后自动遍历当前专题下全部 badcase，无需人工干预',
            '产出 web 端分析大屏，算法团队次日即可直接观察各类 case 的改善与退化分布，将归因周期从人工排查压缩至一次看板浏览',
          ],
          en: [
            'Defined reproducible simulation detection rules for false positives and false negatives separately, converting "does this qualify as a bad case" from subjective judgment into rule-based determination',
            'Built the automated simulation module: on job start it traverses every bad case under the current topic without manual intervention',
            'Delivered a web analytics dashboard so the algorithm team could observe the improvement and regression distribution across case classes the following morning, compressing attribution from manual investigation to a single dashboard read',
          ],
        },
      },
      {
        id: 'outcome',
        label: { zh: '成果', en: 'Outcome' },
        metrics: [
          { value: '4', label: { zh: '环节接入同一流水线', en: 'Stages joined into one pipeline' } },
          { value: '配置化', label: { zh: '新专题接入方式', en: 'New-topic onboarding' } },
        ],
        body: {
          zh: '挖掘、标注、真值生产、数据打包四个原本割裂的环节被整合为一条可自动运转的流水线，新专题接入由重写代码降级为修改配置。这套闭环将数据供给模式从「按人力排期」转变为「按需求配置」。对我个人而言，它是我真正理解「数据基础设施」这一概念的地方——杠杆从来不在某个精巧的脚本，而在于让整条链路不再需要人推动。',
          en: 'Mining, labeling, ground-truth production and dataset packaging — four previously siloed stages — were integrated into a self-running pipeline, with new-topic onboarding downgraded from rewriting code to editing configuration. The loop shifted data supply from headcount-scheduled to demand-configured. Personally, it is where I came to understand what data infrastructure actually means: the leverage never resides in one clever script, but in making the entire chain advance without anyone pushing it.',
        },
      },
    ],
    stack: ['Python', 'SQL', 'MySQL', { zh: '仿真系统', en: 'Simulation' }, { zh: '标签树', en: 'Tag Tree' }, { zh: '时序建模', en: 'Time-Series Modeling' }],
    featured: true,
  },
  {
    id: 'animal-detection',
    no: '02',
    title: { zh: '小动物目标检测专题', en: 'Small-Animal Detection Program' },
    // ⚠️ 以 PDF 简历为准。曾经写成「2023 — 2024」，和实际起止对不上。
    period: { zh: '2024.05 — 2024.10', en: 'May 2024 — Oct 2024' },
    org: { zh: '地平线机器人', en: 'Horizon Robotics' },
    orgShort: { zh: '地平线机器人', en: 'Horizon Robotics' },
    kind: 'internal',
    tagline: {
      zh: '以三级漏斗解构长尾稀疏样本挖掘，用递进式成本分配替代全量标注',
      en: 'Deconstructing long-tail sparse-sample mining into a three-stage funnel — progressive cost allocation in place of exhaustive annotation',
    },
    sections: [
      {
        id: 'context',
        label: { zh: '背景', en: 'Context' },
        body: {
          zh: '自动驾驶的感知对象不止于车辆与行人。猫狗一类小动物在路面出现频率极低，但一旦发生漏检导致碾压、或误检触发幽灵刹车，其安全后果与舆论代价均极为严重。难点恰恰源自「低频」这一属性本身：在海量路采数据中，此类目标是标准的稀疏信号——全量送标成本不可接受，随机抽样又几乎无法命中正样本。这是典型的长尾数据问题，其解法不在模型侧，而在数据侧。',
          en: 'Perception in autonomous driving extends beyond vehicles and pedestrians. Small animals such as cats and dogs appear on roadways at very low frequency, yet a miss resulting in collision, or a false positive triggering phantom braking, carries severe safety and reputational cost. The difficulty derives precisely from that rarity: within bulk road-collection data these are sparse signals — exhaustive annotation is economically infeasible, while random sampling almost never returns a positive. This is a textbook long-tail data problem, and its solution resides on the data side rather than the model side.',
        },
      },
      {
        id: 'funnel',
        label: { zh: '三级漏斗', en: 'Funnel' },
        body: {
          zh: '漏斗的设计原则是递进式成本分配：每一级都以更昂贵但更精准的手段，处理数量级更小的数据。',
          en: 'The funnel is designed around progressive cost allocation: each stage applies a more expensive but more precise method to an order-of-magnitude smaller volume.',
        },
        points: {
          zh: [
            '一级 · 规则粗筛 —— 联合内部工况标签、时间窗口，以及猫狗实际高发区域（住宅区周边、城市道路夜间时段等）先验分布进行筛选，将候选集从全量压缩至可处理量级。成本最低，负责削减数量级',
            '二级 · 模型精提 —— 引入开源大模型执行语义级理解，从粗筛结果中提取真正可能包含目标的帧。单帧成本高于规则筛选，但作用于已缩小的候选集，总成本可控',
            '三级 · 规则化人审 —— 制定明确的判定规则文档后由人工执行终审，产出高纯度数据集。单位成本最高，但处理量已降至最小',
          ],
          en: [
            'Stage one · rule-based coarse filtering — combining internal condition tags, time windows, and the prior distribution of where animals actually appear (residential perimeters, urban roads at night), compressing the candidate pool to a tractable magnitude. Lowest cost, responsible for removing orders of magnitude',
            'Stage two · model-based extraction — an open-source large model performs semantic-level understanding to extract frames plausibly containing targets. Per-frame cost exceeds rule filtering, but it operates on an already-reduced pool, keeping total cost bounded',
            'Stage three · rule-governed human review — explicit written adjudication rules followed by human final review, yielding a high-purity dataset. Highest unit cost, applied to the smallest volume',
          ],
        },
      },
      {
        id: 'operations',
        label: { zh: '数据运营', en: 'Operations' },
        points: {
          zh: [
            '标注规范治理 —— 修订标注规则文档，明确界定小动物在遮挡、模糊、远距离小目标等边界情形下的标注判据，消除标注员的主观裁量空间',
            '质量闭环 —— 协调标注资源排期并全程监控标注质量，确保回流数据可直接使用，而非产生大规模返工',
            '需求池建设 —— 生成标准格式训练数据与汇总文档，建立覆盖不同时间跨度与规模的数据需求池，使后续迭代可按需取数而无须从头重新挖掘',
            '训练与发版支撑 —— 以新数据迭代模型，同步完善评测数据集与评测规则，修订发版文档，为模型上线提供完整的数据侧依据',
          ],
          en: [
            'Annotation specification governance — revised the labeling guidelines to define explicit criteria for boundary cases involving occlusion, blur, and distant small targets, eliminating annotator discretion',
            'Quality loop — coordinated annotator scheduling and monitored quality throughout, ensuring returned data was directly usable rather than generating large-scale rework',
            'Requirement pool — produced standard-format training data and summary documentation, and established a requirement pool spanning time ranges and scales so later iterations could draw on demand instead of re-mining from scratch',
            'Training and release support — iterated the model on new data, refined the evaluation set and its rules in step, and revised release documentation to provide a complete data-side basis for launch',
          ],
        },
      },
      {
        id: 'outcome',
        label: { zh: '成果', en: 'Outcome' },
        metrics: [
          { value: '3', label: { zh: '级漏斗结构', en: 'Funnel stages' } },
          { value: '可复用', label: { zh: '方法论已迁移至其他专题', en: 'Methodology reused across topics' } },
        ],
        body: {
          zh: '该专题的核心产出并非某一批数据，而是一套被固化下来的长尾问题方法论：稀疏目标的关键不在于标注更多，而在于筛选更准——通过递进式成本分配，让昂贵手段只作用于高价值候选。「粗筛 → 模型精提 → 规则人审」这一结构此后在多个专题中被直接复用，成为团队处理低频类别的标准范式。',
          en: 'The principal output was not a particular dataset but a codified methodology for long-tail problems: the answer to a sparse class is not labeling more, it is filtering better — progressive cost allocation confines expensive methods to high-value candidates. The coarse-filter → model-extract → rule-based-review structure was subsequently reused directly across multiple programs, becoming the team standard for handling low-frequency categories.',
        },
      },
    ],
    stack: ['Python', 'YOLO', { zh: '开源大模型', en: 'Open-source LLM' }, 'OpenCV', { zh: '长尾挖掘', en: 'Long-Tail Mining' }],
    featured: true,
  },
  {
    id: 'cone-mining',
    no: '03',
    title: { zh: '锥桶数据挖掘', en: 'Traffic-Cone Data Mining' },
    period: { zh: '2025.08 — 2026.01', en: 'Aug 2025 — Jan 2026' },
    org: { zh: '地平线机器人', en: 'Horizon Robotics' },
    orgShort: { zh: '地平线机器人', en: 'Horizon Robotics' },
    kind: 'internal',
    tagline: {
      zh: '以 DAG 编排整条数据链路，把多个开源大模型接进挖掘环节做匹配与验证，覆盖各场景类型的锥桶数据',
      en: 'Orchestrating the whole pipeline as a DAG and wiring several open-source foundation models into the mining stage for matching and verification, covering traffic cones across scene types',
    },
    sections: [
      {
        id: 'context',
        label: { zh: '背景', en: 'Context' },
        body: {
          zh: '锥桶是施工区域的核心语义：它标记的不是一个障碍物，而是「这条车道此刻不能走」。难点在于形态与场景的组合极多 —— 高速养护、城区占道、事故现场、临时管制，各自的锥桶排布、密度、背景完全不同，靠单一规则或单一模型都覆盖不全。数据侧要解决的问题是：如何让一条链路同时吃下这些差异极大的场景，并且能按需扩展。',
          en: 'A traffic cone carries construction-zone semantics: it marks not an obstacle but the fact that this lane is closed right now. The difficulty is combinatorial — highway maintenance, urban lane occupation, accident scenes, temporary control each differ in cone layout, density and background, and no single rule or single model covers them all. The data-side question is how one pipeline can absorb such varied scenes and still extend on demand.',
        },
      },
      {
        id: 'pipeline',
        label: { zh: '链路编排', en: 'Pipeline' },
        points: {
          zh: [
            'DAG 数据链路 —— 把挖掘、匹配、验证、导出拆成可独立重跑的任务节点并以 DAG 串联，某一环失败只重跑该节点，不必从头再来',
            '资源配置 —— 按节点的实际负载分配 CPU / GPU：规则筛选和 IO 密集的节点走 CPU，模型推理节点排 GPU，避免整条链路被最贵的那一段拖住',
            '多下游适配 —— 同一份挖掘结果适配 2D、BEV、GOD 三个方向各自的输入格式要求，下游换方向不需要重新挖一遍',
          ],
          en: [
            'DAG pipeline — mining, matching, verification and export split into independently re-runnable task nodes chained as a DAG; a failed stage re-runs alone instead of restarting the whole chain',
            'Resource allocation — CPU and GPU assigned by actual node load: rule filtering and IO-bound nodes on CPU, inference nodes queued on GPU, so the chain is not held hostage by its most expensive segment',
            'Multi-consumer adaptation — one mining result adapted to the input formats required by the 2D, BEV and GOD directions, so a change of consumer does not mean re-mining',
          ],
        },
      },
      {
        id: 'models',
        label: { zh: '模型接入', en: 'Models' },
        points: {
          zh: [
            '多模型协同 —— 接入 Qwen-VL、SAM3、YOLOv8 等多个开源模型：视觉语言模型负责场景语义判断，分割与检测模型负责定位与计数，各取所长而不是指望一个模型全包',
            '提示词工程与参数固化 —— 对提示词和模型参数逐项做对照测试，把稳定复现的组合沉淀成 config，使挖掘结果可复现、可交接，而不是依赖调参时的手感',
            '反向验证 —— 用车端模型的输出反过来校验挖掘结果，再叠一层人工过滤，两道关卡卡住误召',
          ],
          en: [
            'Model ensemble — Qwen-VL, SAM3, YOLOv8 and others wired in together: the vision-language model judges scene semantics while segmentation and detection models handle localization and counting — each used for what it is good at rather than expecting one model to do everything',
            'Prompt engineering and frozen parameters — prompts and model parameters tested item by item, with reproducible combinations codified into config so results are reproducible and transferable rather than dependent on tuning intuition',
            'Reverse validation — on-vehicle model output used to check the mining result, with a human filtering pass on top: two gates against false recall',
          ],
        },
      },
      {
        id: 'outcome',
        label: { zh: '成果', en: 'Outcome' },
        metrics: [
          { value: '10w+', label: { zh: '每个计划周期的任务量', en: 'Items per planning cycle' } },
          { value: '3', label: { zh: '个下游方向共用一条链路', en: 'Downstream directions on one pipeline' } },
        ],
        body: {
          zh: '链路跑通之后，每个计划周期基本都能满足 10w+ 的任务需求。更关键的是扩展方式变了：新增一类锥桶场景不再是写一套新脚本，而是加一个任务节点、补一段 config —— 前面几个专题沉淀下来的「配置化接入」在这里又验证了一次。',
          en: 'Once the chain was running, each planning cycle met a 10w+ workload as a matter of course. The more consequential change was in how it extends: adding a new cone scenario is no longer a new script but one more task node and a config entry — the configuration-driven onboarding built up in earlier programs, validated once more.',
        },
      },
    ],
    stack: [
      'Python',
      'DAG',
      'Qwen-VL',
      'SAM3',
      'YOLOv8',
      { zh: '提示词工程', en: 'Prompt Engineering' },
      { zh: 'GPU 调度', en: 'GPU Scheduling' },
    ],
    featured: true,
  },
  {
    id: 'agent-skill-service',
    no: '04',
    title: { zh: 'Agent Skill 知识服务化', en: 'Agent Skill as a Service' },
    period: { zh: '2026.06 — 2026.09', en: 'Jun 2026 — Sep 2026' },
    org: { zh: '地平线机器人', en: 'Horizon Robotics' },
    // ⚠️ 英文必须是 'Horizon Robotics'，和同公司其它三个项目**逐字一致** ——
    // 卡片墙按 orgShort 分区，这里写 'Horizon' 会让英文界面下
    // 地平线被拆成两个区（中文界面正常，所以很难发现）
    orgShort: { zh: '地平线机器人', en: 'Horizon Robotics' },
    kind: 'internal',
    tagline: {
      zh: '把散落在文档与个人经验里的数据生产知识沉淀为 Agent Skill，封装成容器化问答服务常驻集群，团队在协作工具里直接提问即得可执行答案',
      en: 'Codifying tribal knowledge of data production into an Agent Skill, packaged as a containerized Q&A service running persistently on the cluster — the team asks in chat and gets executable answers',
    },
    sections: [
      {
        id: 'context',
        label: { zh: '背景', en: 'Context' },
        body: {
          zh: '数据生产链路的知识高度依赖个人经验：流水线有哪些步骤、每步参数怎么填、不同项目类型的阈值差异、历史数据集与标注记录的对应关系 —— 这些分散在文档、脚本注释和少数几个人的记忆里。新人上手要反复打断他人，老人则被同类问题反复消耗。文档本身不解决问题：它是静态的，读者仍需自行判断「我的场景该用哪组参数」。真正的瓶颈不是缺少文档，而是知识无法被随时、准确地检索到。',
          en: 'Knowledge of the data-production chain lived largely in individual experience: which stages the pipeline has, how each parameter should be filled, how thresholds differ across project types, how historical datasets map to annotation records — scattered across documents, script comments, and a few people\u2019s memory. Onboarding required repeatedly interrupting others; veterans were drained by the same recurring questions. Documentation alone does not solve this: it is static, and the reader still has to judge which parameter set applies to their case. The real bottleneck was never a shortage of documents — it was that the knowledge could not be retrieved reliably on demand.',
        },
      },
      {
        id: 'skill',
        label: { zh: '知识沉淀', en: 'Codification' },
        points: {
          zh: [
            '结构化重组 —— 将全流程知识整理为一套 Agent Skill：能力概览、快速路由表、速查卡、参考文档四层结构。路由表把「用户意图」直接映射到「查哪一节」，让检索一步到位而不是全文扫读',
            '边界显式声明 —— 为 Skill 明确定义三类越界情形（数据查询超范围、功能超工具能力、流程超现有框架）及各自的处置话术。核心原则写进文档：宁可直接说「不在范围内」，也不编造任何具体 ID、路径、阈值或命令',
            '可执行优先 —— 每个能力条目都落到可直接复制运行的命令与参数，而非概念描述。判断依据（如不同项目类型的去重阈值、批大小、格式支持矩阵）以表格固化，消除口头传递中的歧义',
          ],
          en: [
            'Structural reorganization — reorganized end-to-end knowledge into an Agent Skill with four layers: capability overview, fast routing table, quick-reference cards, and reference documents. The routing table maps user intent directly to the relevant section, making retrieval a single step rather than a full-text scan',
            'Explicit boundaries — defined three classes of out-of-scope requests (queries beyond recorded data, functionality beyond the tooling, processes beyond the existing framework) with prescribed responses for each. The governing principle is written into the document: better to say "not in scope" than to fabricate any ID, path, threshold, or command',
            'Executable-first — every capability entry resolves to commands and parameters that can be copied and run, not conceptual description. Decision criteria (dedup thresholds, batch sizes, format support matrices per project type) are fixed in tables, eliminating the ambiguity of verbal handoff',
          ],
        },
      },
      {
        id: 'service',
        label: { zh: '服务化', en: 'Service' },
        points: {
          zh: [
            '协作工具接入 —— 以事件订阅方式监听群消息，收到提问先回执确认、再异步生成答案，避免长耗时推理阻塞交互体验',
            '上下文延续 —— 以会话 ID 维持多轮对话状态，追问不必重述前提；同时约束子会话仅依据 Skill 文档作答、禁用文件搜索类工具，从机制上杜绝答案漂移到文档之外',
            '结构化渲染 —— 将 Markdown 回复解析后映射为协作平台的原生卡片元素（标题、列表、代码块、引用、表格），命令可直接复制，而不是一段难以辨读的纯文本',
            '凭据安全 —— 认证密钥以 AESGCM 加密存储于本地，运行时解出换取访问令牌，不落明文',
          ],
          en: [
            'Chat integration — subscribes to group message events; on receiving a question it first acknowledges, then generates the answer asynchronously, so long-running inference never blocks the interaction',
            'Context continuity — maintains multi-turn state via session IDs so follow-ups need no restatement; the sub-session is simultaneously constrained to answer only from the Skill documents with file-search tooling disabled, structurally preventing drift beyond the source',
            'Structured rendering — parses Markdown replies and maps them onto native platform card elements (headings, lists, code blocks, quotes, tables), so commands are directly copyable rather than an unreadable wall of text',
            'Credential safety — authentication secrets are stored AESGCM-encrypted locally and exchanged for access tokens at runtime; nothing is persisted in plaintext',
          ],
        },
      },
      {
        id: 'ops',
        label: { zh: '部署运维', en: 'Deployment' },
        points: {
          zh: [
            '容器化交付 —— 将运行环境固化为镜像发布到内部仓库，环境与代码一同版本化，消除「本地能跑集群跑不了」的差异',
            '集群常驻 —— 以单节点 DAG 提交至计算平台长期运行，纯 CPU 资源、不限时长；相较个人机器部署，可用性不依赖任何一台终端是否开机',
            '最小权限 —— 所有数据挂载统一降级为只读。服务只需读取知识文档，写权限对它没有意义，却会放大误操作的后果',
            '进程自愈 —— 启动时清理残留进程并写入 PID 文件，接收终止信号时回收子进程与锁文件，避免重复实例与僵尸进程',
          ],
          en: [
            'Containerized delivery — the runtime environment is fixed into an image published to the internal registry, versioning environment alongside code and eliminating "works locally, fails on the cluster" divergence',
            'Persistent on cluster — submitted as a single-node DAG for long-running execution on CPU-only resources with no wall-clock limit; unlike a workstation deployment, availability does not depend on any one machine being powered on',
            'Least privilege — all data mounts are uniformly downgraded to read-only. The service only needs to read knowledge documents; write access buys nothing and magnifies the blast radius of mistakes',
            'Self-healing process — clears residual processes and writes a PID file on startup, and reclaims child processes and lock files on termination signals, preventing duplicate instances and zombies',
          ],
        },
      },
      {
        id: 'outcome',
        label: { zh: '成果', en: 'Outcome' },
        metrics: [
          { value: '7×24', label: { zh: '集群常驻可用', en: 'Always-on cluster service' } },
          { value: '0', label: { zh: '答案越界编造（边界显式约束）', en: 'Fabricated answers by design' } },
        ],
        body: {
          zh: '知识从「问人」变为「问服务」：团队在日常协作工具里直接提问即可得到带命令与参数的可执行答案，无需打断他人、也无需自行翻阅文档判断适用场景。这个项目对我的意义在于验证了一条路径 —— 个人经验可以被系统性地转化为团队随时可调用的工程资产，而承载它的既不是一份没人读的文档，也不是一个需要专人维护的平台，而是一个能自己跑下去的服务。',
          en: 'Knowledge shifted from "ask a person" to "ask a service": the team asks in their everyday chat tool and receives executable answers complete with commands and parameters — without interrupting colleagues or manually judging which documented case applies. What the project proved to me is a path: individual experience can be systematically converted into an engineering asset the team can invoke at any time, carried neither by a document nobody reads nor by a platform requiring a dedicated maintainer, but by a service that keeps running on its own.',
        },
      },
    ],
    stack: [
      'Python',
      'Docker',
      { zh: 'Agent Skill', en: 'Agent Skill' },
      { zh: '集群调度', en: 'Cluster Scheduling' },
      { zh: '事件订阅', en: 'Event Subscription' },
      { zh: 'Markdown 解析', en: 'Markdown Parsing' },
    ],
    featured: true,
  },
  {
    id: 'ji-gong-bao',
    no: '01',
    title: { zh: '基攻宝 · 基金实时估值系统', en: 'Ji-Gong-Bao · Real-Time Fund Valuation' },
    period: { zh: '2026.03 — 2026.06', en: 'Mar 2026 — Jun 2026' },
    org: { zh: '独立开发 · 开源', en: 'Independent · Open Source' },
    orgShort: { zh: '开源项目', en: 'Open Source' },
    kind: 'oss',
    tagline: {
      zh: '独立完成产品设计至运维全链路的金融计算系统，约 4 万行 TypeScript，无后端架构，已开源',
      en: 'A financial-computation system taken from product design through operations single-handedly — ~40K lines of TypeScript, backend-free, open source',
    },
    sections: [
      {
        id: 'context',
        label: { zh: '背景', en: 'Context' },
        body: {
          zh: '场内基金的实时估值分散于天天基金、东方财富、腾讯财经、Yahoo 等多个公开接口之后，数据格式各异、限流策略不一、可用性不稳定。持仓侧的复杂度更高：T+N 申赎确认、跨日结算、分红再投、净值重校准、成本基准回算——每条规则孤立看均不困难，但相互耦合后极易产生计算偏差，而偏差的对象是用户的真实资产。既有工具或要求用户将持仓数据托管至其服务器，或计算过程完全不透明、无法独立验证。',
          en: 'Real-time valuations for exchange-traded funds sit behind a spread of public endpoints — Tiantian, Eastmoney, Tencent Finance, Yahoo — differing in format, rate-limiting policy, and availability. The portfolio side is more complex still: T+N confirmation, cross-day settlement, dividend reinvestment, NAV recalibration, cost-basis recomputation. Each rule is unremarkable in isolation, but their coupling readily produces computational error — and the object of that error is a user’s actual assets. Existing tools either require hosting holdings on their servers, or expose no auditable computation path.',
        },
      },
      {
        id: 'architecture',
        label: { zh: '架构', en: 'Architecture' },
        points: {
          zh: [
            '多 Worker 并发取数架构（v3.0 重构）—— 四个数据源互为兜底，单源失效自动降级切换，请求参数按源差异化收紧以规避限流；上一交易日数据逐条校验后方可进入缓存，杜绝脏数据污染下游计算',
            '无后端设计 —— 以 JSONP 直连公开接口规避跨域限制，全部数据驻留 localStorage。该架构同时解决三个问题：零服务器成本、用户资产数据不出本地、可直接静态部署至 GitHub Pages',
            'PWA 完整支持 —— iOS 可添加至主屏并以独立应用形态运行；以 pageshow 事件兜底解决 Safari 页面缓存导致的跨日状态不刷新；离线状态下缓存数据仍可读',
          ],
          en: [
            'Multi-worker concurrent fetching (the v3.0 rewrite) — four mutually-backing sources with automatic failover, per-source differentiated request parameters to evade rate limits, and previous-trading-day data validated row by row before entering cache, preventing dirty data from contaminating downstream computation',
            'Backend-free design — JSONP direct to public endpoints circumvents CORS; all data resides in localStorage. The architecture resolves three concerns simultaneously: zero server cost, user asset data never leaving the device, and direct static deployment to GitHub Pages',
            'Full PWA support — installable to the iOS home screen and running as a standalone application; a pageshow-event fallback resolves stale cross-day state caused by Safari page caching; cached data remains readable offline',
          ],
        },
      },
      {
        id: 'domain',
        label: { zh: '金融计算', en: 'Domain Logic' },
        points: {
          zh: [
            '完整持仓状态机 —— T+2 待确认订单在净值更新后即刻成交；同日买入与卖出互不干扰、独立结算；手工录入型持仓不被净值重校准覆盖。每一条边界条件均源自实际踩坑后的回补，而非事前设想',
            '收益归因链路 —— 分红再投、成本基准回算、跨日结算三者存在计算顺序依赖，任一环节顺序错置都将导致持仓成本失真，故以显式状态机而非隐式条件分支实现',
            '计算过程可审计 —— 估值推导路径对用户完全透明，这是本项目相对既有闭源工具的根本差异',
          ],
          en: [
            'Complete portfolio state machine — T+2 pending orders settle the moment NAV updates; same-day buys and sells remain independent and settle separately; manually entered positions are never clobbered by NAV recalibration. Every one of these boundary conditions was added after encountering it in practice, not anticipated in design',
            'Return-attribution chain — dividend reinvestment, cost-basis recomputation and cross-day settlement carry ordering dependencies, and misordering any one distorts position cost; the logic is therefore implemented as an explicit state machine rather than implicit conditional branching',
            'Auditable computation — the valuation derivation path is fully transparent to the user, the fundamental differentiator against existing closed-source tools',
          ],
        },
      },
      {
        id: 'quality',
        label: { zh: '质量工程', en: 'Quality' },
        points: {
          zh: [
            '19 个功能域自动化回归网 —— 覆盖页面渲染、持仓计算、跨日结算、取数容错、UI 手势交互；退出码接入 pre-commit 钩子，回归失败则提交被阻断',
            '可定位的失败输出 —— 失败信息精确至「卡在第几步 · 观测到的现象 · 用例所在文件」，单次改动波及的全部用例一次性呈现，消除靠猜测定位问题的环节',
            '一人开发下的质量替代方案 —— 无同行评审的条件下，自动化回归网是唯一可信的质量兜底；这也是该项目敢于持续重构至 v3.0 的前提',
          ],
          en: [
            'Automated regression net across 19 functional domains — covering page rendering, position computation, cross-day settlement, fetch resilience and UI gesture interaction; the exit code is wired into a pre-commit hook so a failing regression blocks the commit',
            'Localizable failure output — failures report the exact step, the observed symptom, and the originating case file, presenting every case a single change affects at once and eliminating guesswork from diagnosis',
            'A quality substitute under solo development — absent peer review, the automated regression net is the only trustworthy backstop; it is also the precondition that made continuous refactoring through v3.0 feasible',
          ],
        },
      },
      {
        id: 'outcome',
        label: { zh: '成果', en: 'Outcome' },
        metrics: [
          { value: '4 万行', label: { zh: 'TypeScript 独立交付', en: 'Lines of TypeScript, solo' } },
          { value: '19', label: { zh: '功能域回归覆盖', en: 'Functional domains covered' } },
          { value: 'v3.0', label: { zh: '已上线并持续迭代', en: 'Live and iterating' } },
        ],
        body: {
          zh: '产品设计、架构、编码、部署、运维全链路由一人完成，已上线稳定运行并迭代至 v3.0，源码与在线体验均已开放。该项目验证了一个此前未被证实的命题：在 AI 协作条件下，一名数据工程师可独立交付具备真实用户、金融计算复杂度与可控工程质量的完整产品——三者同时成立，而非以牺牲其中之一为代价。',
          en: 'Product design, architecture, implementation, deployment and operations were executed entirely solo; the system is live, stable, and has iterated through v3.0, with source and a live demo both public. The project validated a proposition previously unproven for me: under AI collaboration, a single data engineer can independently ship a complete product with real users, genuine financial-computation complexity, and controlled engineering quality — all three holding simultaneously, rather than one being sacrificed for another.',
        },
      },
    ],
    stack: ['Vue 3', 'TypeScript', 'Vite', 'Pinia', 'ECharts', 'Tailwind', 'Vitest', 'PWA'],
    links: [
      { label: { zh: '在线体验', en: 'Live demo' }, href: 'https://L-newbie.github.io/real-time-valuation/' },
      { label: { zh: '源码', en: 'Source' }, href: 'https://github.com/L-newbie/real-time-valuation' },
    ],
    featured: true,
  },
]

// ── 06 能力矩阵 ────────────────────────────────────────────
// level 0–1，驱动 HUD 置信度条。有层次才可信，别全给满。

export const SKILLS: SkillGroup[] = [
  {
    label: { zh: 'AI 与大模型应用', en: 'AI & LLM Applications' },
    core: true,
    caption: {
      zh: '把大模型接进真实工程流程，而不是停在调 API —— 语义级数据精提、知识沉淀为 Agent Skill、AI 协作开发全链路。',
      en: 'Wiring large models into real engineering workflows rather than stopping at API calls — semantic-level extraction, knowledge codified into Agent Skills, AI-assisted delivery end to end.',
    },
    items: [
      {
        name: { zh: 'AI 协作开发', en: 'AI-Assisted Development' },
        level: 0.92,
        key: true,
        note: { zh: '需求拆解 → 部署全流程', en: 'Requirements through deployment' },
        detail: {
          zh: '同一件事做第二遍就该沉淀成工具 —— 这个习惯让我一个人四万行代码把产品做到上线并迭代至 v3.0。AI 不是补全器，是把「我知道怎么做」变成「另一个人也能直接跑」的杠杆。',
          en: 'Anything done twice should become a tool — that habit is why I shipped a 40K-line product solo and iterated it through v3.0. AI is not autocomplete; it is the lever that turns "I know how" into "someone else can run it".',
        },
      },
      {
        name: { zh: '开源大模型应用', en: 'Applied Open-source LLMs' },
        level: 0.9,
        key: true,
        note: { zh: '长尾场景的语义级精提', en: 'Semantic extraction for long-tail cases' },
        detail: {
          zh: '在海量路采数据里捞低频目标，规则筛完还剩数量级过大的候选。引入开源多模态大模型做语义级理解，从「画面里有没有这类目标」这一层筛，成本高于规则但只作用于已缩小的集合，总成本可控。',
          en: 'Fishing rare targets out of bulk road data leaves a candidate pool still orders of magnitude too large after rule filtering. An open-source multimodal model performs semantic-level understanding — costlier per frame than rules, but applied only to an already-reduced set, keeping total cost bounded.',
        },
      },
      {
        name: { zh: 'Agent Skill 开发', en: 'Agent Skill Development' },
        level: 0.88,
        key: true,
        note: { zh: '个人经验 → 团队可调用资产', en: 'Experience into invocable assets' },
        detail: {
          zh: '把散在文档、脚本注释和个人记忆里的流程知识，结构化为带路由表和边界声明的 Skill，再封装成常驻服务。关键是显式定义「不知道」的边界：宁可说不在范围内，也不编造任何 ID、路径或命令。',
          en: 'Reorganized process knowledge scattered across documents, script comments and personal memory into a Skill with routing tables and explicit boundaries, then packaged it as a persistent service. The crux is defining the edge of "I do not know": better to say out-of-scope than to fabricate an ID, path or command.',
        },
      },
      {
        name: { zh: '提示工程', en: 'Prompt Engineering' },
        level: 0.85,
        note: { zh: '约束优先于措辞', en: 'Constraints over phrasing' },
        detail: {
          zh: '可靠性来自约束而非措辞技巧：限定可用工具、限定信息来源、给出越界时的处置话术。让模型能稳定说「这个我不知道」，比让它答得漂亮更有工程价值。',
          en: 'Reliability comes from constraints, not clever phrasing: restrict the available tools, restrict the information sources, and prescribe what to do when a request falls outside them. Getting a model to reliably say "I do not know" carries more engineering value than getting it to answer elegantly.',
        },
      },
      {
        name: { zh: 'RAG 检索增强', en: 'RAG' },
        level: 0.78,
        detail: {
          zh: '为知识服务构建检索层，让回答严格锚定在文档原文而不是模型的先验记忆 —— 这是「答案可被核实」在大模型场景下的等价要求。',
          en: 'Built the retrieval layer for a knowledge service so answers anchor strictly to source documents rather than the model\u2019s prior — the LLM-era equivalent of the requirement that a conclusion be verifiable.',
        },
      },
    ],
  },
  {
    label: { zh: '视觉模型与生成式', en: 'Vision & Generative Models' },
    core: true,
    caption: {
      zh: '不写模型结构，但清楚每类模型在什么数据上会失效、该被派去做什么 —— 检测、开放词汇检测、多模态理解、文生图与图生图，各有各的位置。',
      en: 'I do not author architectures, but I know where each family fails and what each should be assigned to — detection, open-vocabulary detection, multimodal understanding, text-to-image and image-to-image each have their place.',
    },
    items: [
      {
        name: { zh: '开放词汇检测', en: 'Open-Vocabulary Detection' },
        level: 0.88,
        key: true,
        note: { zh: 'Grounding DINO 等，文本提示定位', en: 'Grounding DINO — text-prompted localization' },
        detail: {
          zh: '长尾类别最大的困境是「还没有这个类的标注数据，所以训不出检测器」。开放词汇检测用文本提示直接定位，绕开冷启动 —— 先用它把候选捞出来，人工确认后才形成第一批真值。',
          en: 'The core bind with long-tail classes: no labeled data for the class, so no detector can be trained. Open-vocabulary detection localizes directly from a text prompt, sidestepping the cold start — surface candidates first, confirm by hand, and only then form the first ground truth.',
        },
      },
      {
        name: { zh: '多模态理解', en: 'Multimodal Understanding' },
        level: 0.86,
        key: true,
        note: { zh: 'Qwen-VL 等视觉语言模型', en: 'Qwen-VL and similar VLMs' },
        detail: {
          zh: '用视觉语言模型做帧级语义判定：这一帧的场景、光照、遮挡状态、是否包含目标行为。它给的不是框，是「这批数据值不值得进标注流程」的判断依据。',
          en: 'Vision-language models make frame-level semantic calls: the scene, lighting, occlusion state, and whether a target behavior is present. What they yield is not boxes but the basis for deciding whether a batch is worth entering the annotation pipeline at all.',
        },
      },
      {
        name: { zh: '生成式数据合成', en: 'Generative Data Synthesis' },
        level: 0.8,
        key: true,
        note: { zh: '文生图 / 图生图补长尾样本', en: 'Text-to-image, image-to-image for long-tail' },
        detail: {
          zh: '真实世界里罕见的场景，采集成本可能高到不现实。用世界模型与扩散类模型合成或改写场景（换光照、换天气、插入低频目标），把「等它自然发生」变成「按需构造」。合成数据的价值取决于它是否覆盖了真实分布的空缺，而不是看起来像不像。',
          en: 'Scenarios rare in the real world can be prohibitively expensive to collect. World models and diffusion-based generation synthesize or rewrite scenes — relighting, weather transfer, inserting low-frequency targets — turning "wait for it to happen" into "construct it on demand". Synthetic data is worth what gaps it fills in the real distribution, not how convincing it looks.',
        },
      },
      {
        name: { zh: '目标检测', en: 'Object Detection' },
        level: 0.84,
        note: { zh: 'YOLO 系列，量产侧主力', en: 'YOLO family — the production workhorse' },
        detail: {
          zh: '量产侧真正跑在车上的仍是轻量检测器。我的位置在数据侧：决定它用什么数据训、在什么切片上退化、下一批该补什么。',
          en: 'What actually runs on the vehicle is still a lightweight detector. My position is on the data side: deciding what it trains on, which slices it regresses on, and what the next batch must supply.',
        },
      },
      {
        name: { zh: '模型评测与归因', en: 'Evaluation & Attribution' },
        level: 0.9,
        key: true,
        note: { zh: '指标退化定位到数据切片', en: 'Regression traced to a data slice' },
        detail: {
          zh: '评测的终点不是一个 mAP 数字，而是「哪一类数据让它变差了」。指标退化必须能指向具体切片，才对下一轮迭代有意义 —— 这和我做刑侦分析时的标准是同一条：结论要落到别人能去核实的那一步。',
          en: 'An evaluation does not end at an mAP number but at which class of data degraded it. A regression must resolve to a specific slice to matter for the next iteration — the same standard I held doing criminal-investigation analytics: a conclusion has to land somewhere another party can verify.',
        },
      },
      {
        name: 'PyTorch / OpenCV',
        level: 0.76,
        detail: {
          zh: '训练与推理的落地层：数据加载、预处理、批量推理脚本。我不改网络结构，但要保证喂进去的数据和评测口径是对的。',
          en: 'The layer where training and inference land: data loading, preprocessing, batch inference scripts. I do not alter architectures, but I do guarantee that what goes in and how it is scored are correct.',
        },
      },
    ],
  },
  {
    label: { zh: '数据挖掘与闭环', en: 'Mining & Data Loops' },
    core: true,
    caption: {
      zh: '稀疏目标的关键不是标得更多，而是筛得更准；数据闭环的价值不在某个脚本，而在整条链路不需要人推着走。',
      en: 'The main arena. For rare targets the answer is not labeling more but filtering better; a data loop is worth not any single script but the fact that the chain advances without being pushed.',
    },
    items: [
      {
        name: { zh: '长尾数据挖掘', en: 'Long-Tail Mining' },
        level: 0.94,
        key: true,
        note: { zh: '三级漏斗：规则 → 模型 → 人审', en: 'Three-stage funnel' },
        detail: {
          zh: '设计原则是递进式成本分配：每一级用更昂贵但更精准的手段，处理数量级更小的数据。规则粗筛削数量级，大模型语义精提捞候选，规则化人审定终稿。这套结构后来在多个专题里被直接复用。',
          en: 'Designed around progressive cost allocation: each stage applies a more expensive, more precise method to an order-of-magnitude smaller volume. Rules remove magnitudes, a large model extracts candidates semantically, rule-governed human review finalizes. The structure was later reused directly across programs.',
        },
      },
      {
        name: { zh: '数据闭环搭建', en: 'Data Loop Engineering' },
        level: 0.93,
        key: true,
        note: { zh: '挖掘 → 标注 → 真值 → 打包', en: 'Mining through packaging' },
        detail: {
          zh: '把四个原本各自为政的环节接成一条能自动运转的流水线，新专题接入从重写代码降级为改配置。真正的杠杆从来不在某个精巧的脚本，而在于让整条链路不再需要人推动 —— 链路断在哪里，工作就堆在哪里。',
          en: 'Joined four siloed stages into a self-running pipeline, downgrading new-topic onboarding from rewriting code to editing configuration. The leverage never sits in one clever script but in making the chain advance unpushed — wherever it breaks, work piles up.',
        },
      },
      {
        name: { zh: '时序数据挖掘', en: 'Time-Series Mining' },
        level: 0.9,
        key: true,
        note: { zh: '帧级消息聚合为 timeline 事件', en: 'Frames into timeline events' },
        detail: {
          zh: '把离散的帧级消息按目标维度聚合成有明确起止边界的事件，使「某个目标在某段时间的完整行为」成为可检索的一等对象，而不是散落的孤立帧。',
          en: 'Aggregates discrete frame-level messages along the object dimension into events with explicit boundaries, making "the complete behavior of one object over an interval" a first-class retrievable object rather than scattered frames.',
        },
      },
      {
        name: { zh: '爬虫与数据采集', en: 'Crawling & Collection' },
        level: 0.88,
        key: true,
        note: { zh: '公开平台信息补全', en: 'Public-registry enrichment' },
        detail: {
          zh: '自研爬虫采集公开征信平台的企业与人员关联信息，把内部数据里孤立的节点接上真实的人，拓展出仅凭内部数据无法观察到的关联路径。',
          en: 'Purpose-built crawlers collected corporate and personnel relations from public registries, connecting otherwise isolated internal nodes to real individuals and surfacing paths unobservable from internal data alone.',
        },
      },
      {
        name: { zh: 'Badcase 自动仿真', en: 'Automated Bad-case Sim' },
        level: 0.87,
        note: { zh: '归因周期压缩为一次看板浏览', en: 'Attribution in one dashboard read' },
        detail: {
          zh: '为误检漏检制定可复现的检测规则，任务启动即自动跑完当前专题全部 badcase 并产出分析看板。把「是不是一个 badcase」从主观判断转为规则判定，是这件事能自动化的前提。',
          en: 'Defined reproducible detection rules for false positives and negatives; a job run traverses every bad case under a topic and renders an analytics dashboard. Converting "is this a bad case" from subjective judgment into rule-based determination is what made automation possible at all.',
        },
      },
      {
        name: { zh: '异构数据治理', en: 'Data Governance' },
        level: 0.92,
        note: { zh: '实体对齐与口径统一', en: 'Entity alignment' },
        detail: {
          zh: '数十张字段口径互不一致的表，经清洗、去重、实体对齐后整合入库。同一套方法在金融、刑侦、自动驾驶三个毫不相干的领域都跑通过 —— 我依赖的是方法论，不是某个行业的特定经验。',
          en: 'Dozens of tables with mutually inconsistent field semantics, consolidated through cleaning, deduplication and entity alignment. The same method has held across finance, criminal investigation and autonomous driving — what I rely on is methodology, not one industry\u2019s accumulated tricks.',
        },
      },
],
  },
  {
    label: { zh: '代码与工程交付', en: 'Code & Delivery' },
    core: true,
    caption: {
      zh: '一个人四万行代码做到上线并迭代至 v3.0。质量不靠人盯，靠 19 个功能域的自动化回归网接进提交钩子。',
      en: '40K lines shipped solo, live and iterated through v3.0. Quality is not held by attention but by an automated regression net across 19 domains wired into the commit hook.',
    },
    items: [
      {
        name: 'Python',
        level: 0.95,
        key: true,
        note: { zh: '日常主力语言', en: 'Daily driver' },
        detail: {
          zh: '七年一线的主力语言：数据治理、挖掘流水线、仿真调度、爬虫、服务化，全部在这上面完成。',
          en: 'The workhorse across seven years on the front line: data governance, mining pipelines, simulation orchestration, crawlers and service delivery all built on it.',
        },
      },
{
        name: { zh: '自动化测试', en: 'Automated Testing' },
        level: 0.85,
        key: true,
        note: { zh: '19 个功能域回归网', en: '19-domain regression net' },
        detail: {
          zh: '一人开发没有同行评审，自动化回归网是唯一可信的质量兜底 —— 也正是它让持续重构到 v3.0 成为可能。失败输出精确到「第几步 · 什么现象 · 哪个用例」，消除靠猜定位的环节。',
          en: 'Under solo development there is no peer review, so the regression net is the only trustworthy backstop — and precisely what made refactoring through v3.0 feasible. Failures report the exact step, the observed symptom and the originating case, eliminating guesswork from diagnosis.',
        },
      },
      {
        name: { zh: '容器化与集群部署', en: 'Containers & Cluster Ops' },
        level: 0.82,
        key: true,
        note: { zh: '镜像发布 + 长驻作业', en: 'Image publishing, persistent jobs' },
        detail: {
          zh: '把运行环境固化为镜像，服务以长驻作业跑在集群上，可用性不依赖任何一台终端是否开机。数据挂载一律只读 —— 服务只需读取，写权限对它没有意义却会放大误操作的后果。',
          en: 'Runtime environments fixed into images, services running as persistent cluster jobs so availability never depends on one machine being powered on. Data mounts are uniformly read-only — the service only reads, and write access buys nothing while magnifying the blast radius.',
        },
      },
      {
        name: 'SQL / MySQL',
        level: 0.9,
        detail: {
          zh: '数十张异构表的整合入库与联合查询。清洗和实体对齐做完之后，检索能力才是数据资产真正兑现的地方。',
          en: 'Consolidating dozens of heterogeneous tables into one queryable store. Once cleaning and entity alignment are done, retrieval is where the data asset actually pays off.',
        },
      },
      {
        name: 'Pandas / NumPy',
        level: 0.88,
        detail: {
          zh: '日常分析与批处理的主力。缺失值、异常值、重复记录的识别与修正大多在这一层完成 —— 脏数据流到下游，后面每一步都在放大它。',
          en: 'The workhorse for daily analysis and batch processing. Detection and correction of missing values, outliers and duplicates mostly happen here — dirty data flowing downstream gets amplified at every later step.',
        },
      },
      {
        name: 'Linux / Git',
        level: 0.84,
        detail: {
          zh: '让东西真正跑起来、并且能持续跑下去所需要的那些：环境排查、任务调度、版本管理与协作流程。',
          en: 'What it takes to actually run something and keep it running: environment triage, job scheduling, version control and collaboration flow.',
        },
      },
    ],
  },
]

// ── 07 联系方式 ────────────────────────────────────────────

export const SOCIALS: SocialLink[] = [
  {
    id: 'phone',
    name: { zh: '电话', en: 'Phone' },
    label: '156 4657 2521',
    href: 'tel:+8615646572521',
    icon: 'phone',
  },
  {
    id: 'mail',
    name: { zh: '邮箱', en: 'Email' },
    label: 'weidong624.he@gmail.com',
    href: 'mailto:weidong624.he@gmail.com',
    icon: 'mail',
  },
  {
    id: 'github',
    name: { zh: '代码仓库', en: 'GitHub' },
    label: 'github.com/L-newbie',
    href: GITHUB,
    icon: 'github',
  },
]

export const CONTACT_NOTE: L = {
  zh: '如果你的团队正在建数据闭环、做数据工具链，或者想把 AI 真正落进日常研发流程，欢迎直接联系我。电话和邮件我通常当天回复。',
  en: 'If your team is building a data loop, a data toolchain, or genuinely putting AI into the daily engineering workflow, get in touch. I usually reply to calls and email the same day.',
}

/**
 * 「关于本站」——交代技术实现。
 *
 * ⚠️ 目前**没有任何组件引用它** —— 用户明确要求从联系板块去掉这一段。
 * 保留数据是因为内容本身没问题，将来想放回某个板块可以直接用；
 * 但如果确定不再需要，连同这段一起删掉即可。
 * 改了球体的实现要回来同步这几句，别让它描述一个不存在的版本。
 */
export const COLOPHON: { title: L; paras: L<string>[]; stack: string[] } = {
  title: { zh: '关于本站', en: 'Colophon' },
  paras: [
    {
      zh: '这个球体是程序生成的点云 —— 没有任何模型文件。六块大洲用球面距离场加分形噪声生成，海岸线走 marching squares 描边，形状各不相同。相机分镜停靠到每块大洲，转到的那块高亮并投影出小屏。',
      en: 'The orb is a procedurally generated point cloud — no model files. Six continents come from a spherical distance field perturbed by fractal noise, with coastlines traced by marching squares, so no two share a shape. The camera cuts from continent to continent; whichever faces you lights up and projects its panel.',
    },
    {
      zh: '技术栈：React + TypeScript + 裸 three.js（不用 R3F，省约 150KB）。零二进制资源，三端适配，无 WebGL 时降级为静态导航。',
      en: 'Stack: React + TypeScript + bare three.js (no R3F, saving ~150KB). Zero binary assets, responsive across devices, with a static navigation fallback when WebGL is unavailable.',
    },
  ],
  stack: ['React 18', 'TypeScript', 'three.js', 'Vite', 'GitHub Pages'],
}

// ── 08 界面通用文案 ────────────────────────────────────────

/**
 * 可下载的 PDF 简历。
 *
 * ⚠️ 这个文件是**生成**的，不是手写的：`npm run pdf` 会用本文件的
 * IDENTITY / SKILLS / TIMELINE / PROJECTS 排版出来（见 scripts/build-resume-pdf.mjs）。
 * 内容改了要重跑一次，否则网页和简历会分家。
 *
 * file  放在 public/ 下的实际文件名（ASCII，URL 里不用转义）
 * as    点下载时保存到本地的文件名（中文，投递时对方看到的就是这个）
 */
export const RESUME_PDF = {
  file: 'resume-weidong-he.pdf',
  as: '赫卫东-数据开发工程师-简历.pdf',
}

export const UI = {
  scroll: { zh: '向下滚动', en: 'SCROLL' },
  loading: { zh: '正在初始化', en: 'INITIALIZING' },
  close: { zh: '关闭', en: 'Close' },
  problem: { zh: '问题', en: 'Problem' },
  delivery: { zh: '交付', en: 'Delivery' },
  outcome: { zh: '结果', en: 'Outcome' },
  stackLabel: { zh: '技术栈', en: 'Stack' },
  active: { zh: '进行中', en: 'ACTIVE' },
  confidence: { zh: '置信度', en: 'CONF' },
  menu: { zh: '导航', en: 'Menu' },
  viewProject: { zh: '查看详情', en: 'View details' },
  backToTop: { zh: '回到顶部', en: 'Back to top' },
  // ── 以下几条原先硬编码在组件里的三元表达式中 ──
  // 放这里才能和其它文案一起校对，也不用为了改一个词去翻组件。
  clickToEnter: { zh: '点击进入', en: 'Click to enter' },
  backToOrb: { zh: '返回球体', en: 'Back to orb' },
  /** ⚠️ 故意「反着」的：中文界面下提示切到英文，反之亦然。
      所以 zh 字段是英文、en 字段是中文，不是漏翻。 */
  switchLangHint: { zh: 'Switch to English', en: '切换到中文' },
  downloadResume: { zh: '下载 PDF 简历', en: 'Download résumé (PDF)' },
  downloadResumeHint: { zh: '三页 · A4 · 中文', en: '3 pages · A4 · Chinese' },
} satisfies Record<string, L>
