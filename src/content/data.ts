// ─────────────────────────────────────────────────────────────
//  ✏️  内容层 —— 全站文案都在这个文件里。
//
//  所有面向用户的字符串都是 { zh: '中文', en: 'English' }。
//  改这里 → 全站生效，不用碰组件代码。
//
//  内容来自你的简历。
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
    zh: '七年数据一线。把杂乱的原始数据变成能支撑判断的东西 —— 自动驾驶的动态感知数据闭环，也包括电诈案件里的资金链条。',
    en: 'Seven years on the data front line. I turn messy raw data into something that supports a decision — the dynamic-perception data loop for autonomous driving, and the money trails inside fraud cases.',
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
    value: '4',
    label: { zh: '段闭环链路', en: 'End-to-end loops built' },
    detail: {
      zh: '数据挖掘、标签体系、真值生产、数据打包 —— 每一段都独立能跑，串起来就是一条自动运转的动态感知数据闭环。',
      en: 'Mining, tagging, ground truth, packaging — each runs on its own; chained together they form a self-running dynamic-perception data loop.',
    },
  },
  {
    value: '10w+',
    label: { zh: '锥桶专题周期供给', en: 'Cones supplied per cycle' },
    detail: {
      zh: '锥桶数据链路以 DAG 编排、多模型协同，每个计划周期稳定满足 10w+ 的数据需求 —— 前面专题沉淀的「配置化接入」在差异极大的场景上再次得到验证。',
      en: 'The cone data pipeline — DAG-orchestrated, multi-model — steadily meets a 10w+ items demand per planning cycle, validating the configuration-driven onboarding built up in earlier programs on wildly different scenes.',
    },
  },
]

// ── 04 履历时间轴 ──────────────────────────────────────────

export const TIMELINE: TimelineEntry[] = [
  {
    // ⚠️ 在职中。曾经写成 2021.11 — 2024.10（已离职），和简历对不上。
    period: { zh: '2021.11 — 至今', en: 'Nov 2021 — Present' },
    org: { zh: '北京地平线机器人技术研发有限公司', en: 'Horizon Robotics' },
    orgShort: { zh: '地平线机器人', en: 'Horizon' },
    brief: { zh: '数据开发 · 动态感知', en: 'Data Eng · Perception' },
    role: { zh: '数据开发工程师', en: 'Data Engineer' },
    summary: {
      zh: '主导自动驾驶动态感知的数据基础设施建设，覆盖标签体系、场景检索与训练前数据打包，将割裂环节重构为自运转流水线，使数据供给从人力排期解耦为按需配置。',
      en: 'Led data-infrastructure construction for dynamic perception in autonomous driving — covering the tag system, scenario retrieval and pre-training data packaging — restructuring siloed stages into a self-running pipeline that decoupled data supply from headcount scheduling.',
    },
    points: {
      zh: [
        '场景标签体系 —— 参与设计动静态障碍物场景库标签树, 设计filter规则，开发并维护自动 tagger 代码',
        '长尾专题攻坚 —— 主导小动物检测专题，设计三级漏斗（规则粗筛 → 大模型语义精提 → 规则化人审），以递进式成本分配替代全量标注，方法论此后被复用于其他专题',
        '训练数据生产 —— 负责训练前的数据生产环节，将挖掘、标注、真值环节的产出整合为标准格式训练集，支撑模型迭代的数据供给',
        '全链路打通 —— 多个环节接入同一流水线，新专题接入由重写代码降级为修改配置',
        '大模型进链路 —— 专题项目以 DAG 编排数据链路，接入 Qwen-VL、SAM3、YOLOv8 等开源模型做匹配与验证，稳定支撑每个训练与发版周期内的数据需求',
      ],
      en: [
        'Scenario tag system — co-designed the tag tree for static and dynamic obstacles, formalizing what constitutes one class of road situation into an executable specification; designed filter rules, developed and maintained the auto-tagger code, and safeguarded cross-topic, cross-batch consistency through periodic quality inspection',
        'Long-tail program — led the small-animal detection program, designing a three-stage funnel (rule-based coarse filtering → LLM semantic extraction → rule-governed human review), replacing exhaustive annotation with progressive cost allocation; the methodology was reused across later programs',
        'Training-data production — owned the pre-training data-production stage, consolidating outputs of the mining, labeling and ground-truth stages into standard-format training sets to support model iteration',
        'Full-chain integration — multiple stages joined into one pipeline, with new-topic onboarding downgraded from rewriting code to editing configuration',
        'Foundation models in the loop — the traffic-cone program orchestrates its pipeline as a DAG, wiring in Qwen-VL, SAM3 and YOLOv8 for matching and verification, paired with reverse validation against on-vehicle model output and human filtering, sustaining 10w+ items per planning cycle',
      ],
    },
    stack: ['Python', 'SQL', 'MySQL', 'YOLO', 'Qwen-VL', 'DAG', 'OpenCV', 'Linux'],
    current: true,
  },
  {
    period: { zh: '2019.06 — 2021.09', en: 'Jun 2019 — Sep 2021' },
    org: { zh: '北京集侦云科技有限责任公司', en: 'Jizhenyun Technology' },
    orgShort: { zh: '集侦云', en: 'Jizhenyun' },
    brief: { zh: '数据分析 · 刑侦建模', en: 'Analyst · Investigation' },
    role: { zh: '数据分析师', en: 'Data Analyst' },
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
    org: { zh: '集侦云', en: 'Jizhenyun' },
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
          zh: '一起以网络赌博为外壳的跨境电信诈骗案。资金经受害人充值进入后，由多层线上转账与线下取现反复拆分，最终流向境外。原始材料为数十张字段口径互不一致的 Excel 与 SQL 表，账户、自然人、企业、交易流水相互交织。此类案件的常规做法——将全部关联投射为关系图——只能得到一张无法解读的稠密网络；侦查需要的是若干可立即核查的具体账户，而非拓扑图。',
          en: 'A cross-border telecom-fraud case operating under the cover of online gambling. Funds entered through victim deposits, then were split repeatedly across layered online transfers and offline cash withdrawals before leaving the country. The source material comprised dozens of Excel and SQL tables with mutually inconsistent field semantics, interleaving accounts, individuals, corporate entities and transaction records. The conventional approach — projecting every relation into a graph — yields only an unreadable dense network. What an investigation requires is not a topology, but a small set of immediately verifiable accounts.',
        },
      },
      {
        id: 'approach',
        label: { zh: '方法', en: 'Approach' },
        points: {
          zh: [
            '异构账表治理 —— 数十张表分属赌资流水、银行明细、第三方支付记录等不同来源，同一含义在不同表中的字段名与格式互不一致，同一人在不同表中的证件号写法也并不统一。逐表梳理字段语义并建立映射字典，修正缺失与异常值、消解重复记录后整合入 MySQL，首次使全部数据源支持联合检索',
            '实体对齐与关系建图 —— 以账户、自然人、企业三类实体为核心节点，依据证件号、手机号、设备信息与交易对手构建实体间的关联边，将案件还原为一张可计算的关系网络，为后续量化分析提供底座',
            '关系分级加权 —— 全案的关键决策：图上低价值关联的数量远大于资金主干，等权处理会使主干被淹没。以交易金额、交易频次、关系传递层级三个维度对边施加分级权重，主干资金链由此自然凸显。分析结果的可读性由这一步直接决定',
            '公开数据补全 —— 自研爬虫采集企业征信平台的法定代表人、股东结构与关联企业信息，将账表中孤立的企业节点与真实自然人建立连接，拓展出仅凭案件内部数据不可见的关联路径',
            '资金路径追踪 —— 沿加权后的主干链路逐层回溯拆分节点：区分过账通道账户与终端归集账户、识别取现环节的卡农线索，最终输出按置信度排序的重点账户清单',
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
          zh: '重点账户清单交付刑侦大队后逐一核实，协助勘破该案。该案确立了我此后数据工作的交付标准：分析的终点是一个可被独立核实的结论——不是一张精美的关系图，也不是一组好听的中间指标；结论只有落到能逐一核查的具体账户上，对侦查才是可用的。',
          en: 'The priority account list was handed to the investigation unit and verified holder by holder, contributing to the resolution of the case. This engagement established the delivery standard I have applied to all subsequent data work: an analysis terminates in a conclusion another party can independently verify — not a visually accomplished graph, nor a flattering intermediate metric. The same standard later held in autonomous-driving evaluation attribution, where a regression must resolve to a specific data slice before it carries engineering value.',
        },
      },
    ],
    stack: ['Python', 'MySQL', 'Pandas', { zh: '爬虫工程', en: 'Crawler Engineering' }, { zh: '关系建模', en: 'Graph Modeling' }],
  },
  {
    id: 'dynamic-data-loop',
    no: '02',
    title: { zh: '动态感知数据闭环', en: 'Dynamic-Perception Data Loop' },
    // ⚠️ 以 PDF 简历为准（2024.3-2024.10）。「2021 — 2024」是把整段
    // 在地平线的时间当成了这个项目的时间，两回事。
    period: { zh: '2024.03 — 2024.10', en: 'Mar 2024 — Oct 2024' },
    org: { zh: '地平线机器人', en: 'Horizon Robotics' },
    orgShort: { zh: '地平线机器人', en: 'Horizon Robotics' },
    kind: 'internal',
    tagline: {
      zh: '一套可复用的数据基础工具建设：标签与检索、数据挖掘、数据标注、数据打包，串联为从原始数据到训练集的完整供给链路',
      en: 'A reusable data-infrastructure toolchain — tags and retrieval, data mining, annotation and packaging — chained into a complete supply line from raw data to training sets',
    },
    sections: [
      {
        id: 'context',
        label: { zh: '背景', en: 'Context' },
        body: {
          zh: '感知模型迭代的上界是数据供给速度，而非算法本身。彼时检索靠人工遍历日志、真值生产各自为政、各环节格式互不一致，链路每处断点都等价于模型少一轮迭代——问题不在单环节效率，而在缺乏可复用的基础设施。本项目即为此构建一套覆盖标签与检索、数据挖掘、数据标注、数据打包的基础工具链。',
          en: 'The iteration speed of a perception model is bounded by data supply, not by the algorithm. Retrieval meant manual log traversal, ground-truth production was siloed, and formats diverged at every stage — each break in the chain equaled one fewer model iteration. The gap was reusable infrastructure, not per-stage efficiency. This project built that toolchain: tags and retrieval, data mining, annotation, and packaging.',
        },
      },
      {
        id: 'tagging',
        label: { zh: '标签与检索', en: 'Tags & Retrieval' },
        points: {
          zh: [
            '公司级标签树按来源分为项目标签、标签库、地理场景、采集标签、路测标签等若干子树，各来源标签统一挂载在时间线标签体系上、可跨来源组合检索；我负责其中动态障碍物场景库的标签树设计 —— 围绕目标类型、动静态属性、运动状态等维度，将「何种路况构成同一类场景」的判断标准化为层级化的可执行规范',
            '负责开发并长期维护动态障碍物方向下的自动 tagger：基于路采数据回传信号中的结构化字段（工况、位姿、目标框等）实现标签的规则化批量推断与挂载，标签回写标签树数据库、与工况环境等其他来源标签形成关联',
            '前端检索：用户通过 web 端组合标签条件、点选提供的按钮，或直接编写 SQL 完成数据获取；我主导为检索提供数据支撑并完成各类场景的检索测试 —— 高频组合与长尾边界组合逐类验证结果的准确性与召回边界，确保检索结果可被算法团队直接使用',
          ],
          en: [
            'The company-level tag tree is organized by source into several subtrees — project tags, the tag library, GeoHub scene tags, collection tags and road-test tags — all mounted on one timeline-tag system and jointly queryable across sources; I owned the tag-tree design for the dynamic-obstacle scene library, formalizing "what constitutes one class of road situation" around target class, static/dynamic attribute and motion state into a hierarchical executable specification',
            'Developed and maintained the auto-tagger for the dynamic-obstacle direction: rule-based batch label inference and attachment over structured fields in the road-collection telemetry (driving condition, pose, object boxes), with results written back into the tag-tree database and cross-linked with tags from other sources such as driving conditions',
            'Front-end retrieval: users fetch data on the web by composing tag conditions via the provided buttons, or by writing SQL directly; I led data support for retrieval and its scenario-by-scenario testing — verifying accuracy and recall boundaries for high-frequency and long-tail condition combinations so results could be used directly by the algorithm team',
            'Ran periodic quality inspection on incremental tag data (sampled re-review, cross-batch consistency comparison), ensuring label consistency and accuracy across topics and time batches',
          ],
        },
      },
      {
        id: 'mining',
        label: { zh: '数据挖掘', en: 'Mining' },
        points: {
          zh: [
            '开发数据挖掘链路：以检测模型对路采数据执行批量推理，按工况、目标类型、置信度阈值等条件组合筛选候选场景，命中结果沉淀为可检索的结构化数据，链路化而非一次性脚本产出',
            '引入多模态模型补充语义级挖掘：检测模型只认「框得住的目标」，多模态模型能理解「什么场合下出现的什么目标」，两者互补显著扩展可挖掘场景的覆盖面',
            '挖掘执行依托云端集群批量调度，按数据批次组织推理任务，支持断点续跑与结果增量合并，保障大规模路采数据下挖掘吞吐',
            '挖掘结果在链路中携带工况、目标类型等属性信息，随数据一并进入下游标注与打包环节，支撑后续按场景筛选与统计，不依赖平台级的自动联动机制',
          ],
          en: [
            'Developed the mining pipeline: detection models ran batch inference over road-collection data, candidate scenarios were filtered by composed conditions — driving condition, target class, confidence thresholds — and hits were consolidated into retrievable structured data, as a pipeline rather than one-off scripts',
            'Introduced multimodal models to supplement semantic-level mining: a detector only recognizes what it can box; a multimodal model understands what target appears in what situation. The two are complementary and together extend minable scenario coverage substantially',
            'Mining ran on cloud-cluster batch scheduling, with inference tasks organized per data batch, supporting checkpoint resume and incremental result merging to sustain throughput over bulk road-collection data',
            'Mining output carries its attributes — driving condition, target class and the like — through the pipeline into downstream annotation and packaging, supporting later scenario-level filtering and statistics, without depending on any platform-level automatic linkage',
          ],
        },
      },
      {
        id: 'annotation',
        label: { zh: '数据标注', en: 'Annotation' },
        points: {
          zh: [
            '数据筛选 —— 两级执行：自动粗筛以模型置信度、目标密度、场景覆盖等指标对候选数据分级，将明显低价值数据前置过滤；粗筛结果再由人工执行二次精筛，确定最终入标范围，避免标注预算平均摊派',
            '预标注 —— 以检测模型推理结果作为标注初稿，人工在其上执行校正而非从零绘制，降低单帧标注成本；预标注质量与人工校正量按批次统计，反向用于调整预标注模型与阈值',
            '人工标注 —— 制定标注规则文档统一判定口径（目标类型边界、遮挡截断处理、歧义场景裁决等），标注完成后执行质检与抽检，保障真值质量可核查',
          ],
          en: [
            'Data triage — two-level execution: automatic coarse filtering graded candidates by model confidence, target density and scenario coverage, filtering out clearly low-value data up front; the coarse-filtered result then went through a manual fine-screening that fixed the final annotation scope, keeping the budget from being spread evenly',
            'Pre-labeling — detection-model inference output served as the annotation draft, with humans correcting rather than drawing from scratch, cutting per-frame cost; pre-label quality and human-correction volume were tracked per batch and fed back into pre-label model and threshold tuning',
            'Human labeling — a written rule document unified adjudication criteria (target-type boundaries, occlusion and truncation handling, ambiguous-scenario rulings); quality inspection and spot checks followed labeling to keep ground truth auditable',
          ],
        },
      },
      {
        id: 'packaging',
        label: { zh: '数据打包', en: 'Packaging' },
        points: {
          zh: [
            '将标注产出的真值结果打包为 LMDB 格式的训练集，内容包括标注结果、数据索引、图像数据、位置信息等，符合模型训练的输入结构',
            '打包流程工程化：以数据批次为单位组织打包任务，支持增量打包与版本化管理，历史训练集可复现、可回溯到具体批次与切片',
            '打包遵循既定的通用规则，在此之上按专题定制内容（样本组织方式、数据范围、版本标识等），定制不侵入通用流程，新专题打包仅调整配置',
            '打包过程内建数据验证：完整性校验（样本数与真值记录一一对应）、格式校验（训练框架可直接解析）、统计核对（类别分布符合预期），异常批次在进入训练前即被拦截',
          ],
          en: [
            'Packaged annotation outputs — the ground-truth results — into LMDB-format training sets containing the annotation results themselves, data indices, image data, location information and the rest, matching the model-training input structure',
            'Packaging was engineered as a workflow: tasks organized per data batch, with incremental packaging and versioning, so historical training sets remain reproducible and traceable to specific batches and slices',
            'Packaging follows established generic rules, on top of which per-topic customization is applied (sample organization, data scope, version identifiers and the like); customization never intrudes on the generic flow, so a new topic only requires configuration changes',
            'Data verification is built into packaging: integrity checks (sample count matching ground-truth records one-to-one), format checks (directly parseable by the training framework), and statistical reconciliation (class distribution as expected) — defective batches are intercepted before they reach training',
          ],
        },
      },
      {
        id: 'outcome',
        label: { zh: '成果', en: 'Outcome' },
        metrics: [
          { value: 'LMDB', label: { zh: '训练集统一出口格式', en: 'One output format into training' } },
          { value: '配置化', label: { zh: '新专题接入方式', en: 'New-topic onboarding' } },
        ],
        body: {
          zh: '四环节整合为一条可复用的工具链，数据供给从「按人力排期」转为「按需求配置」，新专题打包仅需调整配置。其价值不在单点工具，而在各环节以统一规范衔接后的整链路可复用性。',
          en: 'The four stages were integrated into one reusable toolchain: data supply shifted from headcount-scheduled to demand-configured, and packaging a new topic requires only configuration edits. The value resides not in any single tool but in the reusability of the whole chain once every stage speaks the same specification.',
        },
      },
    ],
    stack: ['Python', 'SQL', 'MySQL', { zh: '标签树', en: 'Tag Tree' }, { zh: '数据挖掘', en: 'Data Mining' }, { zh: '数据标注', en: 'Annotation' }, { zh: 'LMDB', en: 'LMDB' }, 'Linux'],
    featured: true,
  },
  {
    id: 'animal-detection',
    no: '03',
    title: { zh: '小动物目标检测专题', en: 'Small-Animal Detection Program' },
    // ⚠️ 以 PDF 简历为准。曾经写成「2023 — 2024」，和实际起止对不上。
    period: { zh: '2024.05 — 2024.10', en: 'May 2024 — Oct 2024' },
    org: { zh: '地平线机器人', en: 'Horizon Robotics' },
    orgShort: { zh: '地平线机器人', en: 'Horizon Robotics' },
    kind: 'internal',
    tagline: {
      zh: '面向安全长尾类别的数据攻坚：以三级漏斗从海量路采数据中富集稀疏样本，交付可训练的正样本数据集',
      en: 'A data campaign for a safety-critical long-tail class: enriching sparse samples out of bulk road-collection data through a three-stage funnel into a trainable positive-sample set',
    },
    sections: [
      {
        id: 'context',
        label: { zh: '背景', en: 'Context' },
        body: {
          zh: '自动驾驶的感知对象不止于车辆与行人。猫狗一类小动物在路面出现频率极低，但一旦漏检导致碾压、或误检触发幽灵刹车，安全后果与舆论代价均极严重，属于典型的「安全相关但样本极稀」的长尾类别。难点源自「低频」本身：在全量路采数据中此类目标是稀疏信号——全量送标成本不可接受，随机抽样几乎无法命中正样本。解法不在模型侧，而在数据侧：如何在成本约束下把稀疏正样本从海量数据中富集出来。',
          en: 'Perception in autonomous driving extends beyond vehicles and pedestrians. Small animals such as cats and dogs appear on roadways at very low frequency, yet a miss resulting in collision, or a false positive triggering phantom braking, carries severe safety and reputational cost — a safety-critical yet data-starved long-tail class. The difficulty derives from that rarity itself: within bulk road-collection data these are sparse signals; exhaustive annotation is economically infeasible, and random sampling almost never returns a positive. The solution resides on the data side: enriching sparse positives out of massive data under a cost constraint.',
        },
      },
      {
        id: 'funnel',
        label: { zh: '三级漏斗', en: 'Funnel' },
        body: {
          zh: '漏斗的设计原则是递进式成本分配：每级的单位成本递增、精度递增，处理量递减一个数量级——让最贵的手段只作用于最小的数据量。',
          en: 'The funnel is designed around progressive cost allocation: unit cost and precision rise stage by stage while volume drops an order of magnitude each time — the most expensive method touches only the smallest volume.',
        },
        points: {
          zh: [
            '一级 · 规则粗筛 —— 以先验知识压缩数量级：联合内部工况标签（时间窗口、路段类型）、猫狗高发场景的先验分布（住宅区周边、城市道路夜间时段）过滤全量数据，候选集从 PB 级路采压缩至可处理量级。成本趋近于零，代价是召回有限——先验之外的出现场景会在这一级漏掉，需在后续迭代中补充先验',
            '二级 · 模型精提 —— 以语义理解提高命中密度：引入开源大模型对粗筛候选执行语义级判断，从「时间地点上像」推进到「画面内容上像」，保留真正可能包含目标的帧并给出置信度。单帧成本显著高于规则筛选，但作用于已压缩的候选集，总成本可控',
            '三级 · 规则化人审 —— 以人工判定锁定最终真值：制定明确的判定规则文档（目标可见性、遮挡比例、最小尺寸下限等）后执行人工终审，产出高纯度数据集。单位成本最高，但处理量已被前两级压至最小',
          ],
          en: [
            'Stage one · rule-based coarse filtering — compressing orders of magnitude on priors: internal condition tags (time windows, road-segment type) combined with priors on where animals actually appear (residential perimeters, urban roads at night) filtered the full corpus down to a tractable pool. Cost near zero, at the price of bounded recall — scenes outside the priors drop out here, and the priors get patched in later iterations',
            'Stage two · model-based extraction — raising hit density through semantic understanding: an open-source large model judged the coarse-filtered candidates semantically, advancing from "the time and place look right" to "the content looks right", keeping plausible frames with confidence scores. Per-frame cost far exceeds rule filtering, but it operates on the compressed pool, keeping total cost bounded',
            'Stage three · rule-governed human review — locking final ground truth by human judgment: an explicit written adjudication document (target visibility, occlusion ratio, minimum size threshold) preceded human final review, yielding a high-purity dataset. Highest unit cost, applied to the smallest volume',
          ],
        },
      },
      {
        id: 'operations',
        label: { zh: '数据运营', en: 'Operations' },
        points: {
          zh: [
            '漏斗阈值迭代 —— 精提模型对不同类别目标的判分可靠度不同：按筛选反馈统计各误检、漏检类别的实际情况，针对性调整各类别的置信度阈值，而非全局一刀切',
            '标注规范治理 —— 修订标注规则文档，明确小动物在遮挡、模糊、远距离小目标等边界情形下的标注判据，压缩标注员的主观裁量空间',
            '质量闭环 —— 协调标注资源排期并全程监控标注质量，回流数据可直接进入训练而非大规模返工',
            '需求池建设 —— 产出标准格式训练数据与汇总文档，沉淀覆盖不同时间跨度与场景类型的数据需求池，后续迭代按需取数，无须从头重新挖掘',
            '训练与发版支撑 —— 以新数据迭代模型，同步完善评测数据集与评测规则，修订发版文档，为模型上线提供完整的数据侧依据',
          ],
          en: [
            'Funnel threshold iteration — the extraction model scores different target classes with unequal reliability: per-class error and miss patterns from filtering feedback drove targeted confidence-threshold adjustments per class, rather than one global cutoff',
            'Annotation specification governance — revised the labeling guidelines to define explicit criteria for boundary cases involving occlusion, blur and distant small targets, compressing annotator discretion',
            'Quality loop — coordinated annotator scheduling and monitored quality throughout, ensuring returned data entered training directly rather than generating large-scale rework',
            'Requirement pool — produced standard-format training data and summary documentation, and established a requirement pool spanning time ranges and scene types, so later iterations drew on demand instead of re-mining from scratch',
            'Training and release support — iterated the model on new data, refined the evaluation set and its rules in step, and revised release documentation to provide a complete data-side basis for launch',
          ],
        },
      },
      {
        id: 'outcome',
        label: { zh: '成果', en: 'Outcome' },
        metrics: [
          { value: '', label: { zh: '三级递进式漏斗', en: 'Progressive funnel stages' } },
          { value: '', label: { zh: '可复用，方法论已迁移至其他专题', en: 'Methodology reused across topics' } },
        ],
        body: {
          zh: '专题交付了可直接训练的正样本数据集，支撑小动物检测能力的迭代上线；更重要的产出是一套固化的长尾方法论：稀疏目标的关键不在标注更多，而在筛选更准——递进式成本分配让昂贵手段只作用于高价值候选。「粗筛 → 模型精提 → 规则人审」的结构此后在多个专题中被直接复用，成为团队处理低频类别的标准范式。',
          en: 'The program delivered a directly trainable positive-sample set that carried the small-animal detection capability into release; the more durable output is the codified methodology: the answer to a sparse class is not labeling more but filtering better — progressive cost allocation confines expensive methods to high-value candidates. The coarse-filter → model-extract → rule-based-review structure was reused directly across multiple programs, becoming the team standard for low-frequency categories.',
        },
      },
    ],
    stack: ['Python', 'YOLO', { zh: '开源大模型', en: 'Open-source LLM' }, 'OpenCV', { zh: '长尾挖掘', en: 'Long-Tail Mining' }],
    featured: true,
  },
  {
    id: 'cone-mining',
    no: '04',
    title: { zh: '锥桶数据挖掘', en: 'Traffic-Cone Data Mining' },
    period: { zh: '2025.08 — 2026.01', en: 'Aug 2025 — Jan 2026' },
    org: { zh: '地平线机器人', en: 'Horizon Robotics' },
    orgShort: { zh: '地平线机器人', en: 'Horizon Robotics' },
    kind: 'internal',
    tagline: {
      zh: '把差异极大的多场景锥桶数据整合进一条链路：DAG 编排任务节点，多模型协同完成匹配与验证，一套挖掘结果支撑多个方向',
      en: 'Bringing highly disparate cone scenes into one pipeline: task nodes orchestrated as a DAG, multi-model matching and verification, one mining result serving multiple directions',
    },
    sections: [
      {
        id: 'context',
        label: { zh: '背景', en: 'Context' },
        body: {
          zh: '锥桶承载的是施工区语义：它标记的不是一个障碍物，而是「这条车道此刻不能走」——属于漏检代价高、场景差异大的类别。难点在于组合爆炸：高速养护、城区占道、事故现场、临时管制，各自的锥桶排布、密度、光照与背景完全不同，单一规则或单一模型都覆盖不全。数据侧要回答的问题是：如何让一条链路同时消化差异极大的场景，并且能按需扩展。',
          en: 'A traffic cone carries construction-zone semantics: it marks not an obstacle but the fact that this lane is closed right now — a high-miss-cost class with extreme scene variance. The difficulty is combinatorial: highway maintenance, urban lane occupation, accident scenes and temporary control each differ completely in cone layout, density, lighting and background, and no single rule or model covers them all. The data-side question: how one pipeline absorbs such disparate scenes and still extends on demand.',
        },
      },
      {
        id: 'pipeline',
        label: { zh: '链路编排', en: 'Pipeline' },
        points: {
          zh: [
            'DAG 任务编排 —— 把挖掘、匹配、验证、导出拆成职责单一的任务节点，以 DAG 声明依赖关系后串联执行：节点间数据落盘、状态可查，某一环失败只重跑该节点，不必从头再来；这使长链路在大批量数据上的容错成本降到最低。节点按场景类型分组并行，不同场景的挖掘任务互不阻塞，整体吞吐不受最慢场景拖累',
            '场景解耦 —— 各场景类型（高速养护、城区占道、事故现场、临时管制）各自维护独立的筛选条件与判定参数，一个场景的规则调整不影响其他场景的进行中任务，差异极大的场景得以在同一条链路上独立演进',
            '资源配置 —— 按节点的实际负载特性分配算力：规则筛选与 IO 密集节点走 CPU，模型推理节点排 GPU 队列，避免整条链路被最贵的一段拖住，也避免 GPU 空转在非推理任务上',
            '多格式导出 —— 同一份挖掘结果按各方向的输入格式要求分别导出，更换使用方向不触发重新挖掘，一次挖掘多处消费',
          ],
          en: [
            'DAG task orchestration — mining, matching, verification and export split into single-responsibility task nodes, wired by declared dependencies: data lands on disk between nodes, state is inspectable, and a failed stage re-runs alone instead of restarting the whole chain — minimizing the fault-tolerance cost of a long pipeline over bulk data. Nodes run in parallel groups by scene type, so mining tasks of different scenes never block one another and overall throughput is not dragged by the slowest scene',
            'Scene decoupling — each scene type (highway maintenance, urban lane occupation, accident scenes, temporary control) keeps its own filtering conditions and adjudication parameters; adjusting one scene’s rules never disturbs the in-flight tasks of another, allowing wildly different scenes to evolve independently on the same pipeline',
            'Resource allocation — compute assigned by node characteristics: rule filtering and IO-bound nodes on CPU, inference nodes queued on GPU, so the chain is not held hostage by its most expensive segment and GPUs never idle on non-inference work',
            'Multi-format export — one mining result exported separately to the input formats required by each direction; switching directions never triggers re-mining — one mining pass, multiple consumers',
          ],
        },
      },
      {
        id: 'models',
        label: { zh: '模型接入', en: 'Models' },
        points: {
          zh: [
            '多模型分工 —— 接入 Qwen-VL、SAM3、YOLOv8 等开源模型并按能力分层：视觉语言模型做场景级语义判断（是否施工区、排布类型、语义描述），检测模型做实例级定位与计数，分割模型补轮廓与掩膜精度',
            '提示词工程与参数固化 —— 对提示词逐项做对照测试：同一场景以不同表述提问、比较判分稳定性，把稳定复现的提示词与参数组合沉淀为 config，使挖掘结果可复现、可交接，而不依赖调参时的手感；也使「换模型升级」变成改配置而非改代码',
          ],
          en: [
            'Model division of labor — Qwen-VL, SAM3, YOLOv8 and other open-source models wired in with layered roles: the vision-language model judges scene-level semantics (construction zone or not, layout type, semantic description), detection models handle instance-level localization and counting, segmentation models supply contour and mask precision',
            'Prompt engineering and frozen parameters — prompts tested pairwise: the same scene queried with different phrasings, comparing score stability; reproducible prompt-parameter combinations are codified into config, making results reproducible and transferable rather than dependent on tuning intuition, and turning model upgrades into a configuration change instead of a code change',
          ],
        },
      },
      {
        id: 'outcome',
        label: { zh: '成果', en: 'Outcome' },
        metrics: [
          { value: 'DAG', label: { zh: '链路编排方式', en: 'Pipeline orchestration' } },
          { value: '多模型', label: { zh: '分工协同接入', en: 'Models in division of labor' } },
        ],
        body: {
          zh: '链路跑通后，多场景锥桶数据的供给进入稳定节奏。更关键的产出是扩展方式的变化：新增一类锥桶场景不再是写一套新脚本，而是加一个任务节点、补一段 config——多模型分工与 DAG 编排让链路在保持可验证性的前提下按需生长，此前专题沉淀的「配置化接入」在此再次得到验证。',
          en: 'Once running, the chain supplied multi-scene cone data at a steady cadence. The more consequential output is how it extends: adding a new cone scenario is no longer a new script but one more task node and a config entry — the model division of labor and DAG orchestration let the pipeline grow on demand without sacrificing verifiability, validating once more the configuration-driven onboarding built up in earlier programs.',
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
    no: '05',
    title: { zh: 'Agent Skill 知识服务化', en: 'Agent Skill as a Service' },
    period: { zh: '2026.06 — 2026.09', en: 'Jun 2026 — Sep 2026' },
    org: { zh: '地平线机器人', en: 'Horizon Robotics' },
    // ⚠️ 英文必须是 'Horizon Robotics'，和同公司其它三个项目**逐字一致** ——
    // 卡片墙按 orgShort 分区，这里写 'Horizon' 会让英文界面下
    // 地平线被拆成两个区（中文界面正常，所以很难发现）
    orgShort: { zh: '地平线机器人', en: 'Horizon Robotics' },
    kind: 'internal',
    tagline: {
      zh: '把团队数据生产的经验知识整理成 Agent Skill 文档，封装为常驻集群的问答服务，团队在协作工具里提问即得答案',
      en: 'Codifying the team’s data-production know-how into an Agent Skill, packaged as an always-on Q&A service on the cluster — ask in chat, get the answer',
    },
    sections: [
      {
        id: 'context',
        label: { zh: '背景', en: 'Context' },
        body: {
          zh: '数据生产链路的知识——流程步骤、参数怎么填、不同项目类型的阈值差异——散落在文档、脚本注释和少数人的记忆里。文档是静态的，读者仍需自行判断「我的场景该用哪组参数」；瓶颈不在缺文档，而在知识无法被随时、准确地检索到。',
          en: 'Knowledge of the data-production chain — pipeline stages, parameter choices, per-project-type thresholds — was scattered across documents, script comments and a few people\u2019s memory. Documents are static; the reader still has to judge which parameter set applies. The bottleneck was never missing documentation, but knowledge that could not be retrieved reliably on demand.',
        },
      },
      {
        id: 'approach',
        label: { zh: '方案', en: 'Approach' },
        points: {
          zh: [
            '知识沉淀 —— 将全流程知识整理为一套 Agent Skill：能力概览、快速路由表、速查卡、参考文档四层结构，把「用户意图」直接映射到对应内容；条目全部落到可直接复制运行的命令与参数，并显式声明越界情形——宁答「不在范围内」，不编造任何 ID、路径或命令',
            '服务化 —— 封装为容器化问答服务常驻集群：接入协作工具监听群消息，先回执确认、再异步生成答案；以会话 ID 维持多轮追问，回复渲染为平台原生卡片，命令可直接复制',
            '可靠性 —— 约束子会话仅依据 Skill 文档作答，从机制上杜绝答案编造；容器化交付消除环境差异，集群常驻使可用性不依赖任何个人终端',
          ],
          en: [
            'Codification — reorganized end-to-end knowledge into an Agent Skill with four layers: capability overview, fast routing table, quick-reference cards and reference documents, mapping user intent straight to the relevant entry; every entry resolves to copyable commands and parameters, and out-of-scope cases are declared explicitly — better to say "not in scope" than fabricate any ID, path or command',
            'Service — packaged as a containerized Q&A service running persistently on the cluster: subscribed to group chat events, acknowledging first and answering asynchronously; session IDs carry multi-turn follow-ups, replies rendered as native platform cards with directly copyable commands',
            'Reliability — sub-sessions are constrained to answer only from the Skill documents, structurally preventing fabrication; containerized delivery eliminates environment drift, and cluster residency frees availability from any personal workstation',
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
          zh: '知识从「问人」变为「问服务」：团队在日常协作工具里提问即得带命令与参数的可执行答案。项目验证了一条路径——个人经验可以系统性转化为团队随时可调用的工程资产，载体是一个能自己跑下去的服务。',
          en: 'Knowledge shifted from "ask a person" to "ask a service": the team asks in their everyday chat tool and gets executable answers with commands and parameters. The project proved a path — individual experience can be systematically converted into an engineering asset the team invokes on demand, carried by a service that keeps running on its own.',
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
          zh: '同一件事做第二遍就该沉淀成工具。AI 不是补全器，是把「我知道怎么做」变成「另一个人也能直接跑」的杠杆 —— 复杂业务规则讲给 AI 推导结构，正确性由数据和回归兜底。',
          en: 'Anything done twice should become a tool. AI is not autocomplete; it is the lever that turns "I know how" into "someone else can run it" — spell the business rules out, let the AI derive the structure, and hold correctness with data and regression.',
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
        name: { zh: '目标检测', en: 'Object Detection' },
        level: 0.84,
        note: { zh: 'YOLO 系列，量产侧主力', en: 'YOLO family — the production workhorse' },
        detail: {
          zh: '量产侧真正跑在车上的仍是轻量检测器。我的位置在数据侧：决定它用什么数据训、在什么切片上退化、下一批该补什么。',
          en: 'What actually runs on the vehicle is still a lightweight detector. My position is on the data side: deciding what it trains on, which slices it regresses on, and what the next batch must supply.',
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
      zh: '写的不是一次性脚本：数据链路以 DAG 编排、可独立重跑，打包产出带完整清单与校验记录。质量靠机制兜底，不靠人盯。',
      en: 'Not one-off scripts: pipelines orchestrated as DAGs with independently re-runnable stages, packaging outputs shipping with complete manifests and verification records. Quality is held up by mechanisms, not by supervision.',
    },
    items: [
      {
        name: 'Python',
        level: 0.95,
        key: true,
        note: { zh: '日常主力语言', en: 'Daily driver' },
        detail: {
          zh: '七年一线的主力语言：数据治理、挖掘流水线、数据打包、爬虫、服务化，全部在这上面完成。',
          en: 'The workhorse across seven years on the front line: data governance, mining pipelines, simulation orchestration, crawlers and service delivery all built on it.',
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
