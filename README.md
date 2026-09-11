# 赫卫东 · 个人网站

感知视界（Perception HUD）主题的个人主页。零二进制资源 —— 点云、HUD、噪点全部实时生成。

**在线地址：** `https://L-newbie.github.io/<仓库名>/`

---

## 快速开始

```bash
npm install
npm run dev        # http://127.0.0.1:19457
```

| 命令 | 用途 |
| :-- | :-- |
| `npm run dev` | 开发服务器，改代码热更新 |
| `npm run build` | 构建到 `dist/` |
| `npm test` | 构建产物检查（21 项） |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run preview` | 本地预览构建产物 |

---

## ✏️ 改内容看这里

**只需要改一个文件：`src/content/data.ts`**

所有文案都是 `{ zh: '中文', en: 'English' }` 的形式，两种语言都要填。
改这个文件 → 全站生效，不用碰任何组件代码。

文件里分了 8 块：

| 块 | 内容 |
| :-- | :-- |
| `IDENTITY` | 姓名、职位、一句话介绍、坐标 |
| `AVAILABILITY` | 求职状态徽标（设为 `null` 则不显示） |
| `NAV` | 导航项 |
| `ABOUT` / `METRICS` | 自述段落、首屏关键数字 |
| `TIMELINE` | 履历时间轴 |
| `PROJECTS` | 项目（问题 → 交付 → 结果） |
| `SKILLS` | 能力矩阵，`level` 是 0–1 驱动置信度条 |
| `SOCIALS` / `CONTACT_NOTE` | 联系方式 |

### ⚠️ 待补充的地方

搜索 `⚠️TODO` 能找到全部，目前有 5 处：

1. **邮箱** — `SOCIALS` 里的 `mailto:your@email.com`
2. **Skill 仓库** — 第二个项目的名称和链接（我没法访问 GitHub，按简历描述先搭了骨架）
3. **动态数据闭环** — 缺一个可量化结果
4. **小动物检测** — 缺一个数字（挖出多少有效样本 / recall 提升）
5. **Skill 项目** — 缺结果说明

项目详情的 `outcome` 字段是最值得花时间的地方 —— 招聘方看的是结果，不是职责。

---

## 部署到 GitHub Pages

1. 新建仓库，推送本目录
2. 仓库 **Settings → Pages → Source** 选 **GitHub Actions**
3. 推送到 `main` 或 `master` 自动构建部署

`.github/workflows/deploy.yml` 已配好。`vite.config.ts` 里 `base: './'` 用相对路径，
所以放在任意子路径都能跑，也可以本地直接打开 `dist/index.html`。

---

## 设计与实现

### 视觉主题

以自动驾驶感知系统为隐喻：名字被「检测框」框住并给出置信度，
能力用置信度条而非技能标签，背景是随滚动形变的点云，四周是 HUD 取景框。

点云在 6 个形态间随滚动 morph：

| 区段 | 形态 | 含义 |
| :-- | :-- | :-- |
| 首页 | 路面扫描 | 激光雷达回波，近密远疏 |
| 关于 | 球体 | 斐波那契球面均匀分布 |
| 履历 | 竖直时间轴 | 主干 + 节点团簇 |
| 项目 | 特征网格 | 体素 / 特征图 |
| 能力 | 直方图柱阵 | 评测分数条 |
| 联系 | 汇聚环 | 收束收尾 |

### 性能

首屏 gzip 约 **70KB**，three.js（116KB）走独立懒加载分包。

关键取舍：**morph 插值、力场排斥、呼吸浮动全在 GPU 顶点着色器里做**。
CPU 每帧只更新约 10 个 uniform 浮点数，不碰 attribute buffer ——
否则每帧要往显存传几万个浮点数，手机上必掉帧。

粒子加法混合（`AdditiveBlending`）让重叠处自然变亮，省掉一个 bloom 后处理 pass。

### 设备适配

`src/lib/capability.ts` 按 CPU 核数、内存、指针类型、视口宽度分四档：

| 档 | 判定 | 粒子数 | DPR 上限 |
| :-- | :-- | :-- | :-- |
| `off` | 无 WebGL / 用户要求减少动效 | 0（CSS 静态背景） | — |
| `low` | 手机 | 2200 | 1.5 |
| `mid` | 平板 / 弱桌面 | 4500 | 1.75 |
| `high` | 桌面 | 8000 | 2 |

布局也分三档，不是简单缩放：

- **手机 <768px** — 导航移到底部横排胶囊（拇指可达），HUD 精简掉下方读数，
  项目详情全屏铺满，问题/交付/结果改上下堆叠
- **平板 768–1279px** — 导航标签常显（触屏没有 hover）
- **桌面 ≥1280px** — 内容偏左，右侧留出点云空间

另外处理了：iPhone 刘海安全区（`env(safe-area-inset-*)`）、
移动端 100vh 地址栏问题（JS 写 `--vh`）、横屏手机压缩首屏、
`hover: none` 下去掉悬停粘滞、以及打印样式（直接打成一份简历）。

### 目录

```
src/
├── content/
│   ├── data.ts          ← 改这个
│   └── types.ts
├── lib/
│   ├── capability.ts    设备能力分档
│   ├── hooks.ts         滚动 / 指针 / 视口
│   └── store.ts         全局状态（zustand）
├── three/
│   ├── PointCloudScene.ts  场景引擎（裸 three.js）
│   ├── shapes.ts           6 个点云形态生成器
│   └── shaders.ts          GLSL
├── components/
│   ├── SceneLayer.tsx   3D 桥接层（懒加载）
│   ├── Hud.tsx          HUD 外框 / 导航 / 语言切换
│   ├── Hero.tsx         首屏 + 关于
│   ├── Timeline.tsx     履历
│   ├── Projects.tsx     项目 + 详情浮层
│   ├── Skills.tsx       能力 + 联系
│   └── Icons.tsx        内联 SVG
├── App.tsx
└── styles.css           全部样式（设计令牌在顶部 :root）
```

### 调色

改 `src/styles.css` 顶部的 `:root` 变量即可，主要是 `--cyan` 和 `--amber`。
3D 点云的颜色在 `src/three/PointCloudScene.ts` 顶部的 `COLOR_A` / `COLOR_B`，
两处保持一致。

---

## 技术栈

React 18 · TypeScript · Vite · three.js（裸用，未引 R3F）· zustand

不用 R3F/drei 是为了包体积 —— 那一套 gzip 约 330KB，
这里的场景逻辑本身只有 250 行，裸写 three 省下约 150KB。
