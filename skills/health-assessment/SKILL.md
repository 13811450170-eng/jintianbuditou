---
name: health-assessment
description: 面向办公室人群的颈肩动作游戏前筛查、基线记录与练后安全复核。根据安全自查、主观不适、颈肩动作表现和摄像头识别质量，输出可练范围、限制、重测或停止结论；供 health-coaching 生成低负荷动作方案时使用。
---

# 颈肩健康评估（health-assessment）

## 目标与依据

将“本次是否可进入颈肩动作游戏、可练哪个部位、哪些数据可信”转为可解释的结构化结果。详细动作、安全和量化规则以[颈肩健康知识库](../../docs/颈肩健康知识库.md)为准，尤其使用第 1、3、4、7、8 节。

- 将 MDT 仅用于多方向重复动作和个人表现的观察逻辑；不得自动进行 MDT 分类、方向偏好判断或处方。
- 将 NHS 资料仅用于动作及舒适范围的基础参考；不得承诺对具体疾病的治疗效果。
- 将 JOSPT/APTA 指南仅用于安全边界和线下评估提示；不得根据游戏数据判断疾病。

本 Skill 是“进入练习前的闸门”，不作远程诊断，也不输出临床 ROM 或康复结论。

## 运行态与目标态

本文件定义的是**四态目标语义**：`available`、`limited`、`remeasure`、`stop`。它用于统一筛查、游戏提示与练后报告的健康边界。

与 PR #4 对齐的服务端兼容接口 `/api/screen` 仍使用旧字段（`redFlags`、`pain`、`calib`、`romNeck`、`baselineShoulder`）和二态 `gate=pass | refer`。在前端完成迁移前，适配层应同时返回：

- `gate`：旧界面消费的 `pass | refer`；
- `decision.gate`：本 Skill 定义的四态目标语义；
- `flow`、`baseline` 等旧字段，以及 `decision.availableActions`、`decision.blockedActions` 等新字段。

映射规则为：`available`、`limited` → `pass`；`remeasure`、`stop` → `refer`。其中 `refer` 仅表示“当前不进入游戏”；前端必须通过 `decision.gate` 区分“调整环境后重测”和“停止并建议线下评估”，不得把两者混为医疗转介。

## 接收输入

在练习前使用 `phase: pre`，在练后安全复核使用 `phase: post`。接收下列信息；未采集到的字段必须明确标记为缺失，不得以默认正常替代。

```jsonc
{
  "phase": "pre | post",
  "safety": {
    "common": ["近期外伤、疼痛快速或持续加重、发热不适、胸痛或呼吸困难等命中项"],
    "neck": ["明显无力或笨拙、走路不稳、吞咽/呼吸困难、异常剧烈头痛或眩晕、大小便功能新变化等命中项"],
    "shoulder": ["明显变形或肿胀、急性受伤后剧痛、无法正常抬臂、持续麻木或无力等命中项"]
  },
  "discomfort": { "neck": 0, "shoulderLeft": 0, "shoulderRight": 0 },
  "reportedEvents": ["练后出现的新麻木、无力、眩晕或症状向上肢延伸等"],
  "sensorEvents": {
    "flingCount": 0,
    "rapidMovementDetected": false,
    "tuningVersion": "可选：产生该事件的关卡阈值版本"
  },
  "recognitionQuality": {
    "validFrameRate": 0,
    "keypointConfidence": 0,
    "occlusion": false,
    "environmentIssue": ["逆光、出框、多人入镜等"]
  },
  "baseline": {
    "neck": {
      "protrusion": {}, "flexion": {}, "retraction": {}, "extension": {},
      "lateralL": {}, "lateralR": {}, "rotationL": {}, "rotationR": {}
    },
    "shoulder": { "flexionL": {}, "flexionR": {}, "scapularRetraction": {} }
  }
}
```

每个动作基线记录应尽量包含：是否完成、是否主观不适、代偿类型、个人相对表现、动作追踪置信度。不得要求或虚构摄像头临床角度值。

`reportedEvents` 是用户自报的异常感受；`sensorEvents` 是游戏传感器记录的动作控制事件，二者不得互相替代。当前已运行的颈部关卡应至少传递 `flingCount`；不传原始画面，也不把甩头次数解释为疾病信号。

## 按顺序判定

1. **先检查安全警示信号。** 任一 `safety.common`、`safety.neck` 或 `safety.shoulder` 命中，或练后出现新的麻木、无力、眩晕、症状向上肢延伸、明显活动受限或持续加重不适时，返回 `stop`；停止本次游戏，并提示线下医疗评估。
2. **再检查传感器动作控制事件。** `rapidMovementDetected=true` 或 `flingCount` 达到当前关卡配置的提醒阈值时，立即停止该次计分并提示“放慢、回中立位”；练后返回 `limited` 和动作控制提示，不把它当作医学红旗或诊断依据。当前颈部练后分析的提醒阈值为 3 次，属于可版本化、需试测验证的产品调参，不是医学常模。
3. **再检查识别条件。** 上半身出框、关键点持续不稳定、遮挡、逆光或无法建立头部/肩部/躯干参照时，相关部位返回 `remeasure`；说明需要调整摄像头、坐姿或光线，不输出该部位基线结论。
4. **按部位和动作检查舒适完成情况。** 无安全事件且能在舒适范围内完成、识别稳定的动作标记 `available`；有明显代偿、仅能较小范围完成或报告既有轻度不适的动作标记 `limited`。`limited` 仅允许低负荷、较小目标的动作提示。
5. **汇总可练范围。** 颈部、肩部各自至少有一个 `available` 或 `limited` 动作，且该部位不存在停止事件时，才可开放该部位。

不要用未经过试测验证的固定医学阈值判定“活动度异常”或“疼痛过高”。主观不适评分用于个人前后趋势和低负荷提示；安全事件才是停止的依据。

## 输出结果

始终返回以下结构。字段为空时使用空数组或 `null`，不得省略安全结论。

```jsonc
{
  "gate": "available | limited | remeasure | stop",
  "flow": "both | neckOnly | shoulderOnly | none",
  "availableActions": [{ "part": "neck", "axis": "flexion" }, { "part": "shoulder", "axis": "scapularRetraction" }],
  "blockedActions": [{ "part": "neck", "axis": "extension", "reason": "discomfort | safety | lowRecognition" }],
  "baseline": {
    "neck": { "flexion": { "status": "available", "relativeComfortRange": null, "compensations": [] } },
    "shoulder": { "flexionL": { "status": "limited", "relativeComfortRange": null, "compensations": ["shrug"] } }
  },
  "metrics": {
    "discomfort": { "neck": 0, "shoulderLeft": 0, "shoulderRight": 0 },
    "recognitionQuality": { "state": "usable | remeasure", "issues": [] },
    "sensorEvents": { "flingCount": 0, "rapidMovementDetected": false }
  },
  "motionControl": { "status": "normal | slowDown", "message": "" },
  "safetyMessage": "",
  "remeasureReason": [],
  "reportHints": []
}
```

### 状态与分流

| 情况 | `gate` | `flow` | 产品处理 |
|---|---|---|---|
| 颈部、肩部均可用 | `available` 或 `limited` | `both` | 仅开放通过的动作 |
| 仅颈部可用 | `available` 或 `limited` | `neckOnly` | 关闭肩部动作 |
| 仅肩部可用 | `available` 或 `limited` | `shoulderOnly` | 关闭颈部动作 |
| 识别不足，不能可靠判断 | `remeasure` | `none` | 提示调整环境后重测，不作基线结论 |
| 安全警示信号或练后异常 | `stop` | `none` | 不进入或结束游戏，建议线下评估 |
| 多次快速甩动、但无自报异常 | `limited` | 保留已通过部位 | 本次不继续计分，练后优先提示放慢、回中立位 |

若一个部位因识别不足而无法判定，优先让该部位重测；只有另一个部位已可靠通过，才可将其单独开放。

## 记录边界

- 仅记录数值化会话数据、动作标签和环境质量；不得上传、保存或在报告中展示原始摄像头画面。
- 将前突、后缩、屈曲、伸展、左右侧屈、左右旋转作为产品的 8 个记录维度；不得称作 MDT 官方“标准八向处方”。
- 将相对舒适范围、代偿、完成情况和识别质量作为个人追踪数据；不得解释为临床活动度、肌力或康复疗效。
- 将本次评估输出原样传给 `health-coaching`；`gate=remeasure` 或 `stop` 时不得生成动作方案。
- 将 `sensorEvents` 与用户自报事件分开保存。甩头等传感器事件只用于动作控制提示、暂停计分与可解释的练后报告；只有用户自报的异常安全信号才进入停止与线下评估路径。
