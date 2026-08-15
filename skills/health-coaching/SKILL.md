---
name: health-coaching
description: 面向办公室人群的颈肩低负荷动作指导、练中提示与练后数据整理。仅消费 health-assessment 已通过的部位和动作，生成可解释的动作要点、代偿提醒、暂停条件和周报指标；不提供诊断或个体化治疗处方。
---

# 颈肩练习指导（health-coaching）

## 目标与依据

将 `health-assessment` 的筛查结论转为“本次能做什么、动作时注意什么、练后记录什么”的低负荷方案。详细动作、安全和量化规则以[颈肩健康知识库](../../docs/颈肩健康知识库.md)为准，尤其使用第 1、5、6、7、8 节。

仅在 `gate=available` 或 `gate=limited` 时工作，并且只使用 `availableActions` 中的动作。每个动作均用现有的 `part`（`neck` 或 `shoulder`）与 `axis` 表达；不得另建动作 ID。它不诊断疾病，不替代专业评估，也不以疼痛、极限幅度、快速次数或游戏得分为目标。

## 运行态兼容

`health-coaching` 的目标输入是下文的嵌套 `assessment`、`userIntent`、`sessionMetrics` 结构；它消费 `assessment.gate` 的四态结论和 `assessment.availableActions`。若直接传入 `/api/screen` 的兼容响应，适配层应先取其中的 `decision` 作为 `assessment`。

与 PR #4 对齐的服务端 `/api/coach` 尚接受旧结构 `{ flow, baseline, pain, answers }`。在前端迁移完成前，适配层应把 `assessment.gate=available | limited` 映射为可调用的旧输入；`assessment.gate=remeasure | stop` 不得调用关卡推荐。旧输出的 `level`、`suggestSensitivity`、`breaks` 继续保留给现有页面，新输出补充 `plan[].part`、`plan[].status`、`motionControl` 和 `metrics`。不得为了兼容旧界面而绕过四态闸门。

## 接收输入

```jsonc
{
  "assessment": {
    "gate": "available | limited | remeasure | stop",
    "flow": "both | neckOnly | shoulderOnly | none",
    "availableActions": [{ "part": "neck", "axis": "flexion" }],
    "blockedActions": [{ "part": "shoulder", "axis": "flexionL", "reason": "discomfort" }],
    "baseline": {},
    "metrics": { "discomfort": {}, "recognitionQuality": {} }
  },
  "userIntent": { "feel": "酸胀 | 发紧 | 还好", "goal": "轻松活动 | 完成一组" },
  "sessionMetrics": {
    "completedActions": 0,
    "targetActions": 0,
    "compensationEvents": [],
    "validHoldSeconds": 0,
    "sensorEvents": { "flingCount": 0, "rapidMovementDetected": false }
  }
}
```

若输入缺少 `assessment`、`assessment.gate` 不是 `available`/`limited`，或 `flow=none`，不要自行补全筛查结果；返回“先完成安全自查或重测”的结果。

## 选择动作

按 `availableActions` 逐项选择，使用与知识库相同的动作名称与控制原则：

| `part` / `axis` | 动作名称 | 主要提示 | 常见代偿 |
|---|---|---|---|
| `neck` / `flexion` | 颈部屈曲 | 缓慢低头，舒适范围内回到中立位 | 躯干前屈 |
| `neck` / `extension` | 颈部伸展 | 缓慢抬头，单一平面完成后回中立 | 躯干后仰 |
| `neck` / `lateralL`、`lateralR` | 颈部侧屈 | 双肩放松，一侧耳朵向同侧肩靠近 | 耸肩、躯干侧倾、转头 |
| `neck` / `rotationL`、`rotationR` | 颈部旋转 | 躯干稳定，缓慢转头后回中立 | 躯干跟转、耸肩 |
| `neck` / `protrusion` | 头部前突（后期扩展） | 头部水平向前，避免低头或躯干前倾 | 低头、躯干前倾 |
| `neck` / `retraction` | 头部后缩（后期扩展） | 头部水平向后，避免翘下巴或后仰 | 翘下巴、后仰、耸肩 |
| `shoulder` / `flexionL`、`flexionR` | 坐姿肩关节前屈 | 手臂向前上方抬至可维持控制的舒适高度 | 耸肩、躯干后仰/侧倾 |
| `shoulder` / `scapularRetraction` | 坐姿肩胛后缩 | 肩膀放松，肩胛轻轻向后下方靠拢后放松 | 耸肩、抬下巴、过度挺胸 |

对于 `limited` 动作，使用“减小幅度、放慢节奏、优先回中立位”的提示；不得生成目标角度、强制次数或以提高幅度为导向的指令。前突和后缩保留为后期扩展动作；除非评估明确开放且产品已有对应交互，否则不放入当前游戏动作清单。

## 统一安全规则

对每个推荐动作附带以下规则：

1. 在舒适、无痛、缓慢且受控的范围内完成。
2. 每次单一方向动作结束后回到自然中立位。
3. 不做颈部绕圈、快速甩头、伸展叠加旋转或手部末端加压。
4. 检测到 `sensorEvents.rapidMovementDetected` 或累计甩头达到当前关卡提醒阈值时，立即停止本次计分并提示“放慢、回中立位”；下一个动作只在重新稳定后开始。该事件进入 `motionControl` 与练后报告，不替代用户自报安全事件，也不单独触发医疗转介。
5. 出现疼痛、眩晕、麻木、无力、明显不适或新的症状向上肢延伸时，立即停止本次练习，并交回 `health-assessment` 进行练后复核。
6. 检测到耸肩、躯干跟转、躯干前倾/后仰或过度挺胸时，优先提示减小幅度、放慢动作或回中立位；不得将其记为健康异常。

动作游戏外，同时提示规律短暂休息、改变体位和基础工位调整；不得暗示一次拉伸可以抵消长期静态久坐。

## 输出结果

保留现有游戏调用所需的关卡字段，同时新增可解释的动作与数据字段。`level` 和 `suggestSensitivity` 仅服务交互体验，不表达医学强度或治疗剂量。

```jsonc
{
  "level": "walk | boxing | lunch | fireworks | null",
  "reason": "简短、非医疗化的推荐说明",
  "suggestSensitivity": 0,
  "tone": "gentle | cheer",
  "plan": [
    {
      "part": "shoulder",
      "axis": "scapularRetraction",
      "name": "坐姿肩胛后缩",
      "status": "available | limited",
      "cues": ["肩膀放松", "轻轻向后下方靠拢", "回到自然位置"],
      "compensationHints": ["避免耸肩", "避免过度挺胸"],
      "stopConditions": ["疼痛", "眩晕", "麻木", "无力"]
    }
  ],
  "metrics": {
    "completionRate": null,
    "compensationRate": null,
    "validHoldSeconds": 0,
    "recognitionQuality": "usable | remeasure",
    "sensorEvents": { "flingCount": 0, "rapidMovementDetected": false }
  },
  "motionControl": { "status": "normal | slowDown", "message": "" },
  "breakReminder": "建议短暂活动或改变坐姿",
  "reportHints": ["描述练习参与度、动作控制和自我报告变化，不作医疗结论"]
}
```

## 记录与周报口径

按知识库第 8 节记录，优先输出：

- **参与度**：练习天数、会话次数、有效完成数、目标动作数和完成率；
- **动作控制**：代偿提示次数/代偿率、稳定停留时长、在相近条件下的个人相对表现；
- **自我报告**：颈部、左肩、右肩练前后不适评分及中断原因；
- **数据可信度**：有效识别帧率、关键点质量、遮挡和环境问题。

使用 `完成率 = 有效完成数 ÷ 目标动作数`；目标动作为 0 或识别不足时将完成率设为 `null`，不得显示为 0%。使用 `代偿率 = 出现代偿的有效尝试数 ÷ 有效尝试总数`；无有效尝试时同样设为 `null`。

周报只能表述为“动作完成能力、练习参与度、动作控制、识别质量和自我报告舒适度的个人变化”。不得输出“颈椎恢复正常”“功能改善 X%”“动作治疗有效”等临床结论。

## 交接边界

- `assessment.gate=remeasure`：不生成计划，返回摄像头、光线、坐姿或遮挡的调整提示。
- `assessment.gate=stop`：不生成计划或关卡推荐，仅保留安全提示与线下评估建议。
- 练中或练后出现安全事件：中止计划，将事件和练前后主观不适交回 `health-assessment` 做安全复核。
- 保持数据最小化：只传递结构化动作和会话数据，不传递或保存原始视频画面。
