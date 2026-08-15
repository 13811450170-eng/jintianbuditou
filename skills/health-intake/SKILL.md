---
name: health-intake
description: 面向办公室人群的颈肩动作游戏"进入前背景采集"。把用户的自然语言自述解析为结构化背景资料（年龄、性别、身高体重、职业、久坐与用屏时长、既往不适、主诉部位），标记关键缺失并生成追问，产出以健康促进语言表述的意图画像，交给 health-assessment 作为 pre 阶段背景。不做安全判定、不诊断、不推荐动作或关卡。
---

# 颈肩健康背景采集（health-intake）

## 目标与依据

将用户"我是谁、平时怎么用身体、最想解决哪里"的一段自述，转为可解释的结构化背景资料与意图画像，作为进入 `health-assessment` 前的第一步。详细口径以[颈肩健康知识库](../../docs/颈肩健康知识库.md)为准，尤其使用第 1、2、6 节。

- 将第 1 节使用原则作为总边界：本 Skill 不诊断、不承诺疗效、不替代专业评估。
- 将第 2 节资料范围用于把关表达口吻：MDT/NHS/JOSPT 等资料只作动作与舒适范围的通俗背景，不据此对个人下结论。
- 将第 6 节办公室场景建议作为意图画像的唯一医学背书来源：久坐时长、用屏时长、工位习惯只用健康促进语言表达（"换个姿势、起身活动"），不表述为疾病风险分级。

本 Skill 是"评估链路的入口"，只负责采集与整理背景。**安全警示信号自查、可练判定、基线与四态结论，全部由 `health-assessment` 负责**，本 Skill 不得替代，也不得输出 `gate` / `available` / `stop` 等评估语义。

## 与其它 Skill 的关系

```
health-intake            health-assessment          health-coaching
采集背景/意图/主诉    →   安全闸门 + 基线 + 四态   →   低负荷动作方案
自然语言 → 结构化画像     (phase: pre / post)          (消费 available / limited)
```

本 Skill 的输出经由 `handoffToAssessment` 交给 `health-assessment` 作 pre 背景；主诉部位、既往不适原样传递，不夹带任何安全或可练结论。

## 接收输入

```jsonc
{
  "text": "用户的一段自然语言自述",
  "known": {},          // 已采集字段（多轮追问时携带，未提及的原样保留）
  "round": 1            // 当前追问轮次，从 1 起
}
```

只解析用户"明确说到"的信息；未提及的字段必须标记为缺失，不得以默认值或"正常"替代。`known` 中已有的值若本轮未提及则原样保留，不得清空。

## 按顺序处理

1. **抽取背景字段。** 从 `text` 解析下列字段，抽不到的置 `null`（`history` 置 `[]`）：昵称、年龄、性别、身高、体重、职业、日均久坐小时、每日用屏小时、既往不适、主诉部位。既往不适只收集用户自述的通俗描述（如"颈椎不好""干眼"），不做疾病归类。
2. **判定关键缺失。** 关键字段为 `age`、`occupation`、`sitHoursPerDay`、`chiefComplaint` 四项；缺失者进入 `missing`。其余字段缺失不阻断。
3. **生成追问。** `missing` 非空且 `round` 不超过 3 时，针对最重要的一项缺失生成一句轻松、口语化的 `followupQuestion`（一次只问一项）；`missing` 为空则 `followupQuestion=null` 且 `done=true`。
4. **生成意图画像。** 依据第 6 节，用健康促进语言就久坐/用屏/BMI/既往不适/主诉各给至多一条通俗提示，汇成 `intentProfile`。不得出现疾病名归因、风险百分比或治疗承诺。
5. **组装交接背景。** 把主诉、既往不适、生活方式整理进 `handoffToAssessment`，供评估参考；不包含任何安全或可练判断。

## 输出结果

始终返回以下结构。字段为空时使用 `null` 或空数组，不得省略 `intentProfile` 与 `handoffToAssessment`。

```jsonc
{
  "fields": {
    "nickname": null,
    "age": null,
    "gender": null,             // 男 | 女 | null
    "heightCm": null,
    "weightKg": null,
    "occupation": null,
    "sitHoursPerDay": null,
    "screenHoursPerDay": null,
    "history": [],              // 用户自述的既往不适通俗描述
    "chiefComplaint": null      // neck | shoulder | eye | null
  },
  "missing": ["age", "occupation", "sitHoursPerDay", "chiefComplaint"],
  "followupQuestion": "string | null",
  "done": false,
  "intentProfile": {            // 意图画像：健康促进语言，非医疗结论
    "headline": "",
    "notes": [
      { "dimension": "sit | screen | bmi | history | complaint", "level": "good | warn | todo", "text": "" }
    ]
  },
  "handoffToAssessment": {      // 交给 health-assessment 的 pre 背景，不含安全/可练结论
    "chiefComplaint": null,
    "history": [],
    "lifestyle": { "sitHoursPerDay": null, "screenHoursPerDay": null }
  }
}
```

`level` 语义与其它 Skill 一致：`good` 表现较好、`warn` 值得留意、`todo` 建议关注。此处仅用于生活方式层面的通俗表达，不构成医学分级。

## 记录边界

- 仅记录结构化文本与数值；不采集、不上传、不保存任何摄像头画面。
- 既往不适只作"进入练习时降低负荷、放慢节奏"的产品提示，不解释为疾病、不做诊断归因。
- BMI、久坐与用屏时长只用于第 6 节意义上的健康促进表达；不得表述为疾病风险、不得给出治疗性建议。
- 缺失字段显式标记为 `missing`，不得以"正常"或默认值填补。
- 安全警示信号自查不在本 Skill 范围内；`handoffToAssessment` 不得包含任何 `gate` / `stop` / 可练结论。评估与分流一律交由 `health-assessment`。
