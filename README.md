# 今天不低头 · AI 体感颈椎健康游戏

京东黑马 Hackathon 项目 · 用摄像头 + AI 让办公室久坐人群做颈椎微理疗。

- **初赛已通过** · 现在准备复赛
- 复赛玩法按**部位**组织:颈部(拳击/喂饭/星光)+ 肩部(划船/摘星),Joy 主角 + Doga 家族群演
- 主玩法用**头部 / 上肢姿态**驱动(转头/抬头低头/侧屈/抬臂),不需要额外设备

## 快速开始(给队友)

### 1. 装 GitHub Desktop

https://desktop.github.com/ 下载,用你的 GitHub 账号登录。命令行不熟的话这是最省心的方式。

### 2. Clone 项目到本地

GitHub Desktop → **File → Clone Repository** → 选 `13811450170-eng/jintianbuditou` → 选一个本地存放位置 → **Clone**

### 3. 起本地服务

> ⚠️ **一定要用下面的 Node 后端起服务,别再用 `python3 -m http.server`。**
> 那种纯静态服务器**不提供 `/api/*` 接口**,会导致游戏报告的 AI 点评、训练方案、
> 商品推荐、开局问诊、评估闸门等一切要后端的功能**静默失灵**(页面在,但对应卡片不出来)。

后端是**零依赖**的(只用 Node 内置模块,不用 `npm install`),它同时干两件事:
托管静态页面 + 提供 `/api/*` 接口,一个端口全搞定,摄像头也满足 localhost 安全上下文。

打开终端,cd 到项目文件夹,运行:

```bash
node server/index.js
```

看到 `今天不低头 后端 · http://localhost:3000` 就成了,浏览器打开 **`http://localhost:3000`**。

- 需要 Node ≥ 18(`node -v` 查看;没有就装一个 LTS 版)。
- 默认走本地演示模式(`LLM_PROVIDER=stub`),**不需要任何 key**,AI 相关卡片用规则化数据即可跑通、可演示。
- 接入真实内网大模型时才需在 `server/.env` 配 `LLM_PROVIDER=jd-gateway` 及网关地址/key(见 `server/.env.example`)。
- 命令行不熟的话,让 AI 助手帮你起服务也行。

### 4. 常用调试参数

- `http://localhost:3000/?debug=1` — 打开实时角度调试面板
- 直接预览某关卡的报告长相(不玩游戏):`http://localhost:3000/mock-report.html?branch=boxing`(可换 walk/lunch/rowing/star)

## 项目结构

> 📌 **根目录 = 当前在用的 app 页面**(HTML 之间靠文件名互相跳转,所以都放同一层,别挪进子文件夹)。
> 文档在 `docs/`,已被取代的旧版页在 `_archive/`。

```
├── index.html                       # 主入口 · 首页(打开 localhost 默认进这里)
│
│  【颈部关卡 · 在用】
├── mock-boxing-video.html           # 拳击派对(视频底图版,依赖 img/boxing.mp4)
├── mock-joy-boxing.html             # 拳击派对(CSS/canvas 可玩原型)
├── mock-lunch-video.html            # 餐厅喂 Doga(视频底图版,依赖 img/lunch.mp4)
├── mock-walk.html                   # 森林公园散步(初赛真玩版,头姿驱动三车道跑酷)
│
│  【肩部关卡 · 在用】
├── mock-rowing-video.html           # 河道划船(视频底图版,依赖 img/rowing.mp4)
├── mock-shoulder-star.html          # 举臂摘星(抬臂上举够星星)
│
│  【产品页面(非关卡)】
├── mock-onboarding.html             # 首次自查引导
├── mock-body-profile.html           # 身体档案
├── mock-report.html                 # 单次训练报告(接后端 AI 逐轴点评)
├── mock-weekly-report.html          # 周报
├── mock-addiction-report.html       # 留存/上瘾机制报告
├── zone.html                        # 部位关卡列表(颈部/肩部入口)
├── design-system.html               # 关卡 HUD 设计系统母版(参考用)
│
├── js/                              # pose-kernel.js(头姿检测内核) · you-facecam.js(小窗)
├── server/                          # 零依赖 Node 后端(LLM 代理 · 3 端点 · 同源托管)
├── skills/                          # 健康评估/指导 skill 规格文档
├── assets/joy/                      # 已加工的 Joy 表情、素材(可直接引用)
├── img/                             # 关卡背景、Joy 立绘、视频底图(boxing/rowing/lunch.mp4)
│
├── docs/                            # 📄 文档与比赛材料(玩法方案/交接/报名/PROMPT 手册/架构图)
└── _archive/                        # 🗄️ 已被取代的旧版页(保留备查,不再维护)
```

> **视频版关卡**(`mock-boxing-video` / `mock-rowing-video` / `mock-lunch-video`)用一段合成视频当底图做**画面演示**,HUD 叠在视频上。视频文件已在 Git 里,clone 下来即有;但仍需走本地服务器打开(见上面第 3 步),`file://` 双击不会加载视频。
>
> **`_archive/` 里有什么**:`mock-lunch-restaurant`(被 lunch-video 取代)、`mock-rowing-river`(被 rowing-video 取代)、`mock-night-fireworks`(烟花关已无入口)、`_record-rowing`(划船素材录制工具页)。需要旧版随时能移回根目录。

## 关卡总览(按部位组织)

| 部位 | 关卡 | 主要动作 | 文件 | 状态 |
|------|------|---------|------|------|
| 颈部 | 森林公园散步 | 转头 / 抬头低头 / 侧屈 | `mock-walk.html` | ✅ 初赛真玩版 |
| 颈部 | 拳击派对 | 4 拳型(左钩/右钩/上勾/下勾) | `mock-joy-boxing.html` | 🧪 可玩原型 |
| 颈部 | 拳击派对(视频版) | 同上 · 视频底图演示 | `mock-boxing-video.html` | 🎬 画面演示 |
| 颈部 | 餐厅喂 Doga(视频版) | 转头对准 · 金勺喂食 | `mock-lunch-video.html` | 🎬 画面演示 |
| 肩部 | 河道划船(视频版) | 前倾→后仰扩胸 · 肩胛后收 | `mock-rowing-video.html` | 🎬 画面演示 |
| 肩部 | 举臂摘星 | 抬臂上举够星星 | `mock-shoulder-star.html` | 🧪 可玩原型 |

> 🎬 **视频版** = 用合成视频当底图做画面演示(还没接姿态检测),让人一眼看懂关卡长什么样;🧪 **可玩原型** = 摄像头 + 姿态检测能真玩。
>
> 旧版可玩原型(餐厅 `mock-lunch-restaurant`、划船 `mock-rowing-river`、星光派对 `mock-night-fireworks`)已移入 `_archive/`,被视频版 / 摘星关取代。

## 分工协作建议

- **改 UI / 视觉:** 各关卡 html 的视觉/HUD 各自独立,可以分工各改一个
- **改检测逻辑要当心:** 四个真玩关卡共用 `js/pose-kernel.js`(头姿检测内核),改内核会同时影响多关;各关自己的阈值/手感是在各 html 里注入的,改那部分只影响单关
- **想改前提前打个招呼:** 同一个 html 两人一起改容易冲突,尽量避免
- **改完记得推:** GitHub Desktop 左下角写「改了什么」→ Commit → 顶部 Push origin

## 相关资源(不在 Git 里,通过云盘分享)

| 文件 | 大小 | 位置 |
|------|------|------|
| JOY 及 DOGA IP 规范手册 3.0 PDF | 59MB | 云盘链接:待补 |
| 初阶段方案演示视频 (.mov) | 298MB | 云盘链接:待补 |
| 3B / 3B-face 原始素材 | 55MB | 云盘链接:待补 |

> 这些文件通过 `.gitignore` 排除,不进 Git 是为了保持 clone 速度。需要的话找 lx 要云盘链接。

## 玩法要点(初赛版本 · mock-walk.html)

颈部锻炼分三段:**转头 → 抬头低头 → 侧屈**,每段 4 个目标,中间有回正休息。

- 慢而稳才得分(护颈)
- 保持约 2.5 秒才收集(避免快速甩头)
- 到达最大幅度时 Joy 会转圈庆祝

## 项目状态

- 2026-07-29 · 初赛通过
- 2026-08 · 复赛玩法按**部位**重组(颈部 / 肩部),新增肩部关卡(河道划船、举臂摘星)
- 2026-08 · 拳击 / 划船新增**视频底图版**,用合成视频做画面演示
