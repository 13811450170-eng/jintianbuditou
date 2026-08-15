---
name: health-coaching
description: 颈肩练习指导 —— 基于 health-assessment 的分流与基线,给出今天能做、怎么做、练到哪的个性化低负荷方案:按分流开放动作、以个人有效 ROM 下调目标、注入统一安全规则、练中实时代偿提醒。是"评估—指导"闭环的后半段。
---

# 颈肩练习指导 (health-coaching)

> 医学背书来源见《今天不低头-健康背书调研》。动作库**只作为产品玩法的理论来源和专业参考,
> 不构成面向个体的诊疗处方**。所有动作均在舒适、无痛范围内缓慢完成;不得以疼痛、极限幅度或快速次数为目标。

## 定位

把 [[health-assessment]] 的评估结论,转成"今天做什么、每个动作练到哪、怎么提醒"的可执行方案。
评估负责判定,指导负责干预 —— 评估的产出(分流 + 基线)正是指导的准入与参数。

## 何时触发

- 评估通过、进入动作游戏时(选关卡 / 定灵敏度)。
- 练习过程中(实时代偿提醒、节奏控制)。
- 练后由 [[health-assessment]] 再次接手做安全闭环,形成"评估 → 指导 → 再评估"循环。

## 输入 schema

来自 health-assessment 的输出,加上用户问诊回答:

```jsonc
{
  "flow": "both | neckOnly | shoulderOnly | none",  // 分流,决定开放哪套动作
  "baseline": { "neck": { "flexion": {"effectiveRom":0,"status":"available"}, ... }, "shoulder": {...} },
  "pain": { "level": 0, "region": "neck" },
  "answers": { "feel": "酸胀 | 发紧 | 还好", "goal": "轻松放松 | 认真练一组" }  // 问诊
}
```

## 动作库(§2 理论来源)

**颈部**(NHS 一般人群资料 + 中国康复医学会《颈椎病诊治与康复指南 2010》缓慢屈伸侧屈旋转保健建议):

| 动作 | 方向键 | 说明 |
| --- | --- | --- |
| 颈部屈曲 Flexion | `flexion` | 缓慢低头,下巴向胸前靠近至舒适范围,回中立 |
| 颈部伸展 Extension | `extension` | 缓慢抬头向上看,回中立 |
| 颈部侧弯 Lateral Flexion | `lateralL/R` | 耳朵靠向同侧肩,不耸肩 |
| 头部转动 Rotation | `rotationL/R` | 头转向一侧,躯干不转 |
| 头部前突 Protrusion | `protrusion` | MDT 8 向扩展动作,暂未匹配玩法 |
| 头部后缩 Retraction | `retraction` | MDT 8 向扩展动作,暂未匹配玩法 |

**肩部**(NHS 无器械坐/站姿动作):

| 动作 | 键 | 说明 |
| --- | --- | --- |
| 坐姿肩关节前屈 | `flexionL/R` | 手臂缓慢向前上方抬起,只抬到能维持肩胛控制的高度,受控放回 |
| 坐姿肩胛后缩 | `scapularRetraction` | 两侧肩胛轻轻后靠,短暂停留后放松;不耸肩、不夹紧 |

## 核心逻辑

1. **按分流开放动作** — 严格遵循 `flow`,只从被开放的部位取动作:
   | `flow` | 路径 |
   | --- | --- |
   | `both` | 颈 + 肩动作全开放 |
   | `neckOnly` | 只开颈部,关闭肩部 |
   | `shoulderOnly` | 只开肩部,关闭颈部 |
   | `none` | 不进动作游戏,提示线下评估 |
   `status=stop` 的具体方向即使在开放部位内也剔除;`limited` 保留但降级。

2. **以个人基线下调目标** — 用 `baseline.*.effectiveRom` 作为该方向目标角度的**上限**,`limited` 方向进一步下调;关闭 `discomfort` 方向的相关玩法。绝不以极限幅度为目标。

3. **注入统一安全规则**(§2.1)— 不做颈部绕圈;不做快速甩头;不将伸展与旋转叠加;不以疼痛、极限幅度或高频次数为目标;不自行用手加压;完成一个方向回中立位再做下一次。

4. **练中实时代偿提醒** — 检测到耸肩 / 躯干后仰 / 躯干旋转代偿时即时提示纠正;甩头(安全红线)是首要纠正项 —— 康复讲"慢而稳"。

5. **组合而非单点** — 动作 + 规律间歇 + 工位/姿势提醒(CUH NHS 建议:电脑工作等加重不适的任务应拆分进行、规律休息;《指南 2010》建议久坐者约每小时改变体位)。证据显示组合优于单纯拉伸。

## 输出 schema

对齐后端 `recommend` 现有契约,并扩展当日方案:

```jsonc
{
  "level": "walk | boxing | lunch | fireworks",  // 推荐关卡(现有关卡键)
  "reason": "Joy 口吻的推荐理由",
  "suggestSensitivity": 50,           // 灵敏度:酸胀/高疼痛 → 调低(省力)
  "tone": "gentle | cheer",
  "plan": [                            // 当日动作清单(扩展字段)
    { "axis": "flexion", "targetRom": 0, "safetyCap": 0, "cues": ["慢而稳","回中立"] }
  ],
  "breaks": "规律间歇 / 工位提醒建议"
}
```

### 关卡映射(沿用现有 stub.recommend 规则)

| 问诊 | 关卡 | 灵敏度 | 取向 |
| --- | --- | --- | --- |
| 酸胀 | `walk` 散步(轻柔) | 35 | gentle |
| 发紧(不酸) | `lunch` 喂饭(定向大幅活动) | 50 | cheer |
| 认真练一组 | `boxing` 拳击(强度最高、颈椎覆盖全) | 55 | cheer |
| 还好 + 轻松放松 | `walk` 散步 | 50 | cheer |

## 与工程的对接

对应后端 `server/adapters` 的 **`recommend`** 能力。现有 `stub.recommend` 已实现"问诊 → 关卡 + 灵敏度 + Joy 点评";
本 skill 是它的**规则超集**:在 `recommend` 之上叠加 `flow` 门禁、基线 downscale 与当日 `plan` 生成。

- 骨架实现见:`server/adapters/health-coaching.stub.js`(不覆盖现有 `stub.js`,带 TODO 留接口)。
- 现有 `walk/boxing/lunch/fireworks` 关卡键、`suggestSensitivity`、`tone` 契约保持不变。

## 边界

- 动作库仅为理论参考,不构成个体化诊疗处方。
- 肩部动作不表述为对肩周炎、肩袖撕裂等具体疾病的治疗。
- `flow=none` 时不给任何练习方案,只提示线下评估。
