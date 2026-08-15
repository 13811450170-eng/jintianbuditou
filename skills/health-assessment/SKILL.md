---
name: health-assessment
description: 颈肩健康评估 —— 把用户的红旗问卷、疼痛自评与传感器采集的 8 向颈部 ROM / 肩部基线,转成可判定的健康状态与分流结论(可用 / 受限 / 重测 / 停止)。是"评估—指导"闭环的前半段,产出即 health-coaching 的准入参数。
---

# 颈肩健康评估 (health-assessment)

> 医学背书来源见《今天不低头-健康背书调研》。本 skill 只做**状态判定与分级**,
> **不确诊、不宣称任何方向"治疗有效"**。中心化/外周化等 MDT 反应须由合格临床人员解读,不作为面向普通用户的结论。

## 定位

把"用户现在能不能练、有没有异常"转成机器可判定的结论。它是整个安全闭环的**准入闸门**:
练习前决定放不放行,每个动作前给出目标上限,练习后判断是否需要停止或转介。

产出的 `flow`(分流结论)正是 [[health-coaching]] 的输入。

## 何时触发

- **练习前筛查**:进入任何颈/肩动作游戏之前,必须先跑一次。
- **动作前基线校准**:每个方向以本次有效 ROM 作为个人基线。
- **练习后反馈**:收集主观感受与异常信号,做安全闭环判定。

## 输入 schema

```jsonc
{
  "phase": "pre | post",              // 练习前筛查 / 练习后反馈
  "redFlags": {                        // 安全门槛(任一 true = 硬拦截)
    "neck":     ["近期头颈外伤", "进行性剧烈症状", "手脚无力/笨拙", "走路不稳", "吞咽或呼吸困难", "大小便功能新变化"],
    "shoulder": ["近期肩部外伤", "肩/臂明显变形或肿胀", "无法正常抬臂", "持续麻木或无力", "发热不适", "胸痛或呼吸困难"]
    // 实际传入为 { key: boolean } 或命中项数组,命中任意一项即触发线下转介
  },
  "pain": { "level": 0, "region": "neck | shoulder | arm | none" },  // NPRS/VAS 0–10
  "cnfds": 0,                          // 哥本哈根颈部功能障碍量表,可选
  "calib": { "keypointQuality": 0.0, "shoulderLine": true, "trunkRef": true },  // 中立位校准
  "romNeck": {                         // 8 向主动 ROM,方向键见下
    "protrusion": { "value": 0, "compensation": [], "confidence": 0.0, "discomfort": false }
    // flexion / retraction / extension / lateralL / lateralR / rotationL / rotationR 同构
  },
  "baselineShoulder": {                // 肩部轻量基线
    "flexionL": { "reach": 0, "compensation": [], "confidence": 0.0, "discomfort": false },
    "flexionR": { ... }, "scapularRetraction": { ... }
  }
}
```

## 核心逻辑(判定顺序)

严格按序,前一层否决则不进入后一层:

1. **红旗硬门槛** — `redFlags.neck` 或 `redFlags.shoulder` 命中任意一项 → 直接 `stop`,提示线下医疗评估,**不进游戏**。
2. **疼痛与功能基线** — 记录 NPRS/VAS(0–10)与疼痛区域;CNFDS 量化对日常的干扰。高疼痛不直接拦截,但会下调目标并倾向 `gentle`。
3. **中立位校准** — 关键点质量/肩线/躯干参考系不达标 → 该次 `remeasure`(重测),不产出基线。
4. **逐方向 ROM 判定 + 代偿识别** — 每个方向独立打标,识别耸肩 / 躯干旋转 / 躯干前倾后仰等代偿;`discomfort=true` 的方向直接降级。
5. **练后异常信号**(phase=post)— 症状向肩/上肢/手指延伸、新麻木区、明显无力、眩晕、练后活动度下降或疼痛持续加重 → `stop` 并转介。

### 逐方向四态判定

| 判定 | 触发条件 | 对 coaching 的含义 |
| --- | --- | --- |
| `available` 可用 | 舒适完成、无 `discomfort`、代偿轻微、`confidence` 足够 | 开放该方向玩法 |
| `limited` 受限 | 幅度不足或代偿明显但无痛 | 开放但**下调目标角度** |
| `remeasure` 重测 | 追踪置信度低 / 校准不达标 | 要求复测,暂不产出基线 |
| `stop` 停止 | 该方向 `discomfort=true` 或触发红旗 | 关闭该方向玩法 |

## 输出 schema

```jsonc
{
  "gate": "pass | refer",              // refer = 触发红旗,不进游戏
  "flow": "both | neckOnly | shoulderOnly | none",  // 分流结论(见下表)
  "baseline": {                        // 每方向有效 ROM,coaching 用它 downscale
    "neck":     { "flexion": { "effectiveRom": 0, "status": "available" }, ... },
    "shoulder": { "flexionL": { "status": "available" }, ... }
  },
  "pain": { "level": 0, "region": "neck" },
  "referReasons": [],                  // gate=refer 或 phase=post 触发停止时,列具体信号
  "tone": "gentle | cheer"             // 高疼痛/触发信号 → gentle
}
```

### 分流规则(§1.5)

| 筛查与基线结果 | `flow` | 系统处理 |
| --- | --- | --- |
| 颈部、肩部均通过 | `both` | 开放通过筛查和基线的颈/肩动作 |
| 仅颈部通过 | `neckOnly` | 关闭肩部,仅开放通过基线的颈部动作 |
| 仅肩部通过 | `shoulderOnly` | 关闭颈部,仅开放通过基线的肩部动作 |
| 均未通过 / 触发共同安全门槛 | `none` | 不进入动作游戏,提示线下医疗评估 |

## 与工程的对接

对应后端 `server/adapters` 的 **`analyze`** 能力(练习后)与筛查前置。现有 `stub.analyze` 已实现逐轴点评
(`insights[].level` = good/warn/todo)与甩头(`flingCount`)安全红线判定 —— 本 skill 是它的**规则超集**:
把"红旗硬门槛 + 8 向 ROM 四态分流"补齐到评估侧。

- 骨架实现见:`server/adapters/health-assessment.stub.js`(不覆盖现有 `stub.js`,带 TODO 留接口)。
- 前端契约保持不变:`insights[].level` ∈ {good, warn, todo};报告页 `mock-report.html` 已消费该结构。
- 隐私红线:后端只接收数值化 session,**绝不接收任何画面**(见 `server/index.js` 注释)。

## 边界

- 不做诊断,不给个体化诊疗处方。
- 不依据单次练习后的疼痛/活动度变化向普通用户宣称某方向"治疗有效"。
- 输出的 `refer` 只提示"建议线下评估",不指明具体疾病。
