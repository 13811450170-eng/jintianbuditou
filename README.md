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

摄像头需要安全上下文(HTTPS 或 localhost),**直接双击 html 打不开摄像头**。

打开终端,cd 到 clone 下来的项目文件夹,运行:

```bash
python3 -m http.server 8000
```

然后浏览器打开 `http://localhost:8000`

### 4. 常用调试参数

- `http://localhost:8000/?debug=1` — 打开实时角度调试面板

## 项目结构

```
├── index.html                       # 主入口 · 首页 + 森林公园散步(晨间)关卡
│
│  【颈部关卡】
├── mock-joy-boxing.html             # 拳击派对(CSS/canvas 版)
├── mock-boxing-video.html           # 拳击派对(视频底图版,依赖 img/boxing.mp4)
├── mock-lunch-restaurant.html       # 餐厅喂 Doga(有生成图用图,无图回落 emoji)
├── mock-night-fireworks.html        # 星光派对流星关卡
│
│  【肩部关卡】
├── mock-rowing-river.html           # 河道划船(4 帧 Joy 立绘,前倾→后仰扩胸)
├── mock-rowing-video.html           # 河道划船(视频底图版,依赖 img/rowing.mp4)
├── mock-shoulder-star.html          # 举臂摘星(抬臂上举够星星)
│
│  【产品页面(非关卡)】
├── mock-home-v2.html                # 首页 v2
├── mock-onboarding.html             # 首次自查引导
├── mock-body-profile.html           # 身体档案
├── mock-report.html                 # 单次训练报告
├── mock-weekly-report.html          # 周报
├── mock-addiction-report.html       # 留存/上瘾机制报告
│
├── assets/joy/                      # 已加工的 Joy 表情、素材(可直接引用)
├── img/                             # 关卡背景、Joy 立绘、视频底图(boxing/rowing.mp4)
├── 今天不低头-初赛玩法方案.md            # 初赛完整玩法设计文档
├── 今天不低头-项目交接文档.md            # 交接文档
└── 京东黑马-今天不低头-报名材料.md        # 报名材料
```

> 视频版关卡(`mock-boxing-video` / `mock-rowing-video`)用一段合成视频当底图做**画面演示**,HUD 叠在视频上。视频文件 `img/boxing.mp4` / `img/rowing.mp4` 已在 Git 里,clone 下来即有;但仍需走本地服务器打开(见上面第 3 步),`file://` 双击不会加载视频。

## 关卡总览(按部位组织)

| 部位 | 关卡 | 主要动作 | 文件 | 状态 |
|------|------|---------|------|------|
| 颈部 | 森林公园散步 | 转头 / 抬头低头 / 侧屈 | `index.html` | ✅ 初赛真玩版 |
| 颈部 | 拳击派对 | 4 拳型(左钩/右钩/上勾/下勾) | `mock-joy-boxing.html` | 🧪 可玩原型 |
| 颈部 | 拳击派对(视频版) | 同上 · 视频底图演示 | `mock-boxing-video.html` | 🎬 画面演示 |
| 颈部 | 餐厅喂 Doga | 金勺准星 · 6 位置喂食 | `mock-lunch-restaurant.html` | 🧪 可玩原型 |
| 颈部 | 星光派对 | 头姿控制接流星 | `mock-night-fireworks.html` | 🧪 可玩原型 |
| 肩部 | 河道划船 | 前倾→后仰扩胸 · 肩胛后收 | `mock-rowing-river.html` | 🧪 可玩原型 |
| 肩部 | 河道划船(视频版) | 同上 · 视频底图演示 | `mock-rowing-video.html` | 🎬 画面演示 |
| 肩部 | 举臂摘星 | 抬臂上举够星星 | `mock-shoulder-star.html` | 🧪 可玩原型 |

> 🎬 **视频版** = 用合成视频当底图做画面演示(还没接姿态检测),让人一眼看懂关卡长什么样;🧪 **可玩原型** = 摄像头 + 姿态检测能真玩。

## 分工协作建议

- **改 UI / 视觉:** 各关卡 html 之间没有共享代码,各自独立,可以分工各改一个
- **想改前提前打个招呼:** 同一个 html 两人一起改容易冲突,尽量避免
- **改完记得推:** GitHub Desktop 左下角写「改了什么」→ Commit → 顶部 Push origin

## 相关资源(不在 Git 里,通过云盘分享)

| 文件 | 大小 | 位置 |
|------|------|------|
| JOY 及 DOGA IP 规范手册 3.0 PDF | 59MB | 云盘链接:待补 |
| 初阶段方案演示视频 (.mov) | 298MB | 云盘链接:待补 |
| 3B / 3B-face 原始素材 | 55MB | 云盘链接:待补 |

> 这些文件通过 `.gitignore` 排除,不进 Git 是为了保持 clone 速度。需要的话找 lx 要云盘链接。

## 玩法要点(初赛版本 · index.html)

颈部锻炼分三段:**转头 → 抬头低头 → 侧屈**,每段 4 个目标,中间有回正休息。

- 慢而稳才得分(护颈)
- 保持约 2.5 秒才收集(避免快速甩头)
- 到达最大幅度时 Joy 会转圈庆祝

## 项目状态

- 2026-07-29 · 初赛通过
- 2026-08 · 复赛玩法按**部位**重组(颈部 / 肩部),新增肩部关卡(河道划船、举臂摘星)
- 2026-08 · 拳击 / 划船新增**视频底图版**,用合成视频做画面演示
