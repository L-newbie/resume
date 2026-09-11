// ─────────────────────────────────────────────────────────────
//  板块定义 —— 每个板块在小屏上「透出一点点」的内容。
//
//  小屏是科幻 HUD 的尺度：一个编号、一个标题、两三行读数。
//  它不承载完整信息，只负责勾起「点进去看看」的欲望。
//  完整内容在板块面板里（见 components/sections/）。
//
//  ⚠️ 顺序必须与 orbGeometry 的 FACES 一致 —— 索引即球面上的瓣号。
// ─────────────────────────────────────────────────────────────

import { IDENTITY, PROJECTS, SKILLS, SOCIALS } from './data'
import type { L } from './types'

/** 小屏上的一行读数：左标签 + 右数值 */
export interface Readout {
  k: L
  v: L
}

export interface Section {
  id: string
  /** 两位编号，HUD 风格 */
  no: string
  label: L
  /** 小屏上的副标题，一句话 */
  tag: L
  /** 小屏上的读数行，2–3 条 */
  readouts: Readout[]
}

/**
 * 中英文相同的内容（数字、专有名词、联系方式）。
 * ⚠️ 只用于**本来就不该翻译**的值 —— 别拿它兜中文文案，
 * 那会让「切了语言但这一行还是中文」。
 */
const same = (s: string): L => ({ zh: s, en: s })

export const SECTIONS: Section[] = [
  {
    id: 'hero',
    no: '00',
    label: { zh: '个人信息', en: 'Profile' },
    tag: IDENTITY.role,
    readouts: [
      { k: { zh: '姓名', en: 'NAME' }, v: IDENTITY.name },
      { k: { zh: '坐标', en: 'LOC' }, v: IDENTITY.location },
      { k: { zh: '状态', en: 'STATUS' }, v: { zh: '考虑机会', en: 'OPEN' } },
    ],
  },
  {
    /*
      01 能力 —— 原「关于」和「能力」合并而来。
      两者说的是同一件事（我会什么、强在哪），拆成两个板块会让
      观点和证据分家：读完自述还得再点一次才看到技能。
    */
    id: 'skills',
    no: '01',
    label: { zh: '能力', en: 'Capabilities' },
    tag: {
      zh: 'AI 与大模型 · 数据链路 · 代码交付',
      en: 'AI & LLM · Data Pipelines · Shipping Code',
    },
    /*
      ⚠️ 值是「该方向下有几项技能」，不是置信度小数。
      早先用组内最高 level（0.92 / 0.90 / 0.94）—— 三行几乎一样、
      没有单位也没有说明，读者根本不知道那个数字在讲什么。
      条数至少是可解读的：数字大 = 这个方向铺得广。
    */
    readouts: SKILLS.slice(0, 3).map((g) => ({
      k: g.label,
      v: {
        zh: `${g.items.length} 项`,
        en: `${g.items.length}`,
      },
    })),
  },
  {
    id: 'timeline',
    no: '02',
    label: { zh: '工作经历', en: 'Career' },
    tag: {
      zh: '金融证券 · 刑侦数据 · 自动驾驶 · 独立开发',
      en: 'Finance · Investigation · Autonomous Driving · Independent',
    },
    readouts: [
      { k: same('2026'), v: { zh: '独立开发', en: 'Independent' } },
      { k: same('2021'), v: { zh: '地平线机器人', en: 'Horizon Robotics' } },
      { k: same('2019'), v: { zh: '集侦云', en: 'Jizhenyun' } },
    ],
  },
  {
    id: 'projects',
    no: '03',
    label: { zh: '项目', en: 'Work' },
    tag: {
      zh: '从数据闭环到独立产品',
      en: 'From data loops to shipped products',
    },
    /*
      ⚠️ 三行必须是**同一类**东西。
      早先是「01 : 项目名」「02 : 项目名」「合计 : 5」——
      前两行的 k 是无信息量的序号，第三行的 k 却是汇总标签，
      三行放在一起读不成一张表。
      现在统一为「来源 : 数量」，和板块内的分组方式一致。
    */
    readouts: [
      {
        k: { zh: '企业项目', en: 'Corporate' },
        v: same(`${PROJECTS.filter((p) => p.kind === 'internal').length}`),
      },
      {
        k: { zh: '开源项目', en: 'Open Source' },
        v: same(`${PROJECTS.filter((p) => p.kind === 'oss').length}`),
      },
      {
        k: { zh: '时间跨度', en: 'Span' },
        v: same('2019 — 2026'),
      },
    ],
  },
  {
    id: 'contact',
    no: '04',
    label: { zh: '联系我', en: 'Contact' },
    tag: {
      zh: '打电话或发邮件，我会第一时间回复',
      en: 'Call or email — usually a same-day reply',
    },
    readouts: SOCIALS.slice(0, 3).map((s) => ({
      // 标签走双语（电话 / Phone）。之前用 s.icon.toUpperCase()，
      // 中英文都是 PHONE/MAIL/GITHUB —— 切到中文也不变，不够严谨。
      k: s.name,
      // 值是号码 / 邮箱 / 地址，本来就不翻译，也**不能转大写**
      //（大小写敏感，见 styles.css 里 .pn-v 的 text-transform: none）
      v: same(s.label),
    })),
  },
]

/** 板块数量，必须等于 orbGeometry 的 FACES */
export const SECTION_COUNT = SECTIONS.length
