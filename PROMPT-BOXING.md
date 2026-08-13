# 拳击派对 · Nano Banana 生图工单

> 本文档只覆盖傍晚 Joy 拳击派对一关。目标:让 Joy 变成"才才型拳击教练",再出 3 种风格的场景对比图,选出方向后再批量出后续图。

---

## 0 · Nano Banana 使用速查

### 是什么

Google 的图片生成模型 `Gemini 2.5 Flash Image`,官方 nickname 是 Nano Banana。2025 年 8 月正式开放,擅长:
- **多参考图保持角色一致性**(最多可上传约 3 张 reference)
- **中英混合 prompt**
- **精确的局部指令**(比如"只改衣服,别的不动")
- **无水印输出**

### 三种入口 & 收费

| 入口 | 网址 | 免费额度 | 备注 |
|---|---|---|---|
| **Google AI Studio** | aistudio.google.com | 每天几十张(免费) | 需 Google 账号 + VPN |
| **Gemini 官网** | gemini.google.com | 免费,速率限制 | 同上,需 VPN |
| **API 调用** | ai.google.dev | $0.039/张 | 走开发者接口,能程序化批处理 |

**推荐用 Google AI Studio 网页版**——支持多张参考图拖入,免费额度足够我们出这一关。

### 上手 3 步

1. 打开 [aistudio.google.com](https://aistudio.google.com),用 Google 账号登录
2. 左侧模型选 `Gemini 2.5 Flash Image`(名字里有 "Image" 那个,不是 Flash 也不是 Pro)
3. **先拖参考图,再输入 prompt**——顺序反了,参考图不生效

### 一致性关键 3 条

- 每张 Joy 图都必须**第一张拖入 `img/anchor/joy-standard.png`**(白色 chibi 3D 玩偶感)
- prompt 里明确写:`保持与参考图完全一致的头身比 1:1.3、眼睛画法、红色项圈、白色身体`
- 遇到风格漂移(比如变成毛茸茸真狗),负向 prompt 加上 `realistic fur, photorealistic, brown fur, sharp teeth`

---

## 1 · Joy 才才型拳击教练形象

### 才才型教练的性格锚(先想清再写 prompt)

> Joy 是发明家 / 毒舌 / 负情商 / 高智商外星狗。当上拳击教练后:
> - **口头禅**:"就这?我以为你能坚持到第二组"
> - **表情**:嘴角一勾轻蔑一笑,眼神眯起像在鉴定你的战斗力
> - **姿态**:一只前爪叉腰,另一只戴着拳套指着你,或者悠闲坐在角落椅子上翘着后爪
> - **反差萌**:嘲讽你的时候身体动作却是热心的——比如一边翻白眼一边递水
> - **服装**:白色 chibi 身体基础上,加**红色拳击拳套**(可以只戴单只作为教练标志)+ 可选一条毛巾搭肩

### 1.1 · Joy 教练标准立绘(先出这张作为教练系列锚点)

**用途:** 拳击关"介绍教练是谁"的主视觉,也作为后续 Joy 各种动作图的教练风格 reference

**目标文件名:** `img/joy/joy-coach-standard.png`
**长宽比:** 1:1 / 1024×1024
**参考图:**
1. `img/anchor/joy-standard.png`(角色锚,必须第一张)
2. `3B/3BST00201.png`(3/4 站姿辅助,可选)

**正向 prompt(直接复制到 Nano Banana):**

```
以第一张参考图为角色 reference,保持完全一致的头身比 1:1.3 / 
黑色椭圆眼睛 / 红色项圈 / 白色圆润 chibi 3D 玩偶质感 / 弧形微笑嘴。

生成新姿态:Joy 一只白色 chibi 3D 玩偶感的狗,担任拳击教练角色,
右前爪戴着一只红色拳击手套(左爪没戴,自然叉腰),身体保持标准站姿,
表情是"才才型教练"的招牌表情 —— 嘴角微微一勾露出得意的轻笑,
一只眼睛眯起像在打量对手,另一眼保持大而圆的官方画法,
头略向侧一点,像刚说完一句吐槽。整体气场是「毒舌但可爱」不是凶。

Background: pure off-white studio background, soft studio lighting,
subtle floor shadow beneath. Product-shot rendering, no other characters,
no text or logo, transparent PNG friendly.
```

**负向 prompt:**

```
photorealistic, realistic dog fur, brown fur, sharp teeth, aggressive face,
angry, blood, violence, multiple characters, human proportions, tall body,
gym equipment in background, 2D flat cartoon, sketch, line art
```

**验收标准:**
- 眼睛还是**黑色椭圆**(不是圆眼珠、不是拟真犬眼)
- 身体是**纯白色**(不是米色不是灰色)
- **红色项圈**保留
- 头身比看着像 Joy 官方 anchor,不是被拉长成人型
- 才才气场看得出来(嘴角微翘、单眼眯)——不是标准笑脸,也不是凶脸

---

### 1.2 · Joy 教练指导姿态(cover 页 / 教学环节用)

**用途:** cover 页大立绘 / 教学演示 "看好我怎么出拳"

**目标文件名:** `img/joy/joy-coach-pointing.png`
**长宽比:** 3:4 / 768×1024
**参考图:**
1. `img/anchor/joy-standard.png`
2. `img/joy/joy-coach-standard.png`(**必须先生成 1.1,再作为姿态锚**)

**正向 prompt:**

```
以第一张为角色 reference,以第二张为教练风格 reference,
生成同一只 Joy 教练,新姿态:身体正面朝向观察者,
右前爪戴红色拳击手套向前伸出指向画面(像在说「看我」),
左前爪自然抓着一条白色毛巾搭在肩上,身体微前倾,
表情继续是才才型 —— 眉毛一挑嘴角一勾,像在说"就这动作,你也会?"

Background: pure off-white studio background, dramatic side rim light 
adding a subtle red glow from the right, no other characters.
```

**负向 prompt:** 同 1.1

---

## 2 · 拳击场景 3 种风格(各出 1 张对比图,选一种批量做)

**都是 16:9 / 1920×1080 横向背景板**——用于游戏 gameplay 页的场景背景。**不喂 Joy 参考图**(避免 AI 在场景里塞进狗)。

### 2A · 赛博未来拳台

**目标文件名(试出图):** `img/bg/boxing-arena-cyber.png`
**参考图:** 无

**正向 prompt:**

```
An empty futuristic cyberpunk boxing arena, wide horizontal composition,
hexagonal light panels covering the walls glowing red #ff2244 and gold #ffcc00,
a raised boxing ring at center with red ropes, spotlight from above hitting
the ring floor, dark atmospheric fog rolling in the corners,
pitch black #0a0510 background with red and gold neon accents,
holographic sponsor banners floating in the distance (blurred),
no characters, no boxers, no audience,
cinematic wide-angle shot, dramatic lighting, high contrast,
concept art style, matte painting quality.
Color palette: #0a0510 background, #ff2244 hot red glow, #ffcc00 gold accents.
```

**负向 prompt:** `characters, boxers, dogs, referee, audience, people, realistic photo, daytime, bright colors, cluttered scene, watermark, text, logo`

---

### 2B · 复古拳馆

**目标文件名(试出图):** `img/bg/boxing-arena-vintage.png`

**正向 prompt:**

```
An empty vintage boxing gym from the early 20th century, wide horizontal
composition, wooden floor with wear marks, a classic boxing ring at center
with weathered red ropes and canvas floor, warm tungsten pendant lights
hanging from a tin ceiling casting golden pools of light, brick walls with
old fight posters (blurred, no readable text), a punching bag in the
background corner, dust particles in the air catching the light,
sepia-warm color grading, red and gold accents throughout,
no characters, no boxers, no audience,
cinematic wide-angle shot, Rocky-movie aesthetic, matte painting style.
Color palette: warm brown #4a2e1f, aged gold #d4a44a, blood red #a51b0c,
cream #fff2d4.
```

**负向 prompt:** `characters, boxers, dogs, referee, audience, people, realistic photo, futuristic, neon, modern gym equipment, cluttered, watermark, text on posters`

---

### 2C · 明亮商业健身房

**目标文件名(试出图):** `img/bg/boxing-arena-bright.png`

**正向 prompt:**

```
An empty bright modern boxing gym, wide horizontal composition,
sunlight streaming through large industrial windows on the left side,
polished concrete floor, a clean modern boxing ring at center with 
bright red ropes and white canvas, punching bags and speed bags visible
on the right wall (chibi 3D toy style props matching Joy IP aesthetic),
warm daylight color grading, cream #fff2d4 walls, red #ea3323 accents,
no characters, no boxers, no people,
cinematic wide-angle shot, cheerful and energetic mood,
Studio Ghibli painted background aesthetic, healing tone
(unlike traditional dark boxing scenes).
Color palette: cream white #fff2d4, joy red #ea3323, soft blue #cae7ff, 
warm gold #ffd66b.
```

**负向 prompt:** `dark scene, cyberpunk, neon, characters, dogs, boxers, people, photorealistic photo, cluttered, night time, watermark, text, logo`

---

## 3 · 出图后怎么办

1. **对比 3 张场景**,挑一张符合你脑海里"拳击派对"氛围的
2. 把选中那张改名为 `img/bg/boxing-arena.png`(去掉后缀)
3. 剩下 2 张可以先扔到 `img/bg/rejected/` 备份

选定场景后,才继续生成:
- Joy 教练出各种拳的动图(左钩拳 / 右钩拳 / 上勾拳 / idle)
- KO 海报大图
- 装饰元素(拳套、汗滴、速度线)

**这些后续 prompt 等你选定场景风格后我再写**——因为要根据场景光线氛围调整教练身上的 rim light 方向和色调。

---

## 4 · 常见问题快答

**Q: Nano Banana 生成的图有水印吗?**
A: 有一个不可见的 SynthID 水印(供内容溯源),但**画面上看不到**,可以直接放进 HTML 用。

**Q: 出图慢/失败?**
A: 免费额度用完了会限速,等 1-2 分钟再试。或者换用 Gemini 官网入口(gemini.google.com/app)。

**Q: 中文 prompt 能懂吗?**
A: 能。但"京东 IP chibi 3D 玩偶感"这类**风格关键词用英文更准**——已经写在上面 prompt 里了,直接复制即可。

**Q: 图生出来带白底,想要透明?**
A: prompt 结尾加 `transparent PNG background, no background at all`。若仍带白底,用 removebg.com 二次抠。

**Q: 3 种场景生成完了想再补更多?**
A: 常见还可以试:**天台户外拳台**(黄昏)/ **地下车库拳赛**(硬核)/ **JD 星球拳击训练营**(蓝紫科幻)。跟我说,我加 prompt。
