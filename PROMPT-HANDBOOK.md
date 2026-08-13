# 星动 Joy · Nano Banana 生图提示词手册

> 给设计师的一份"照葫芦画瓢"生图指南。按顺序执行,拿到图后按命名扔进对应目录,4 个 HTML 会自动加载。

---

## 使用说明(必读 · 3 分钟)

### 工作流

```
① 筹备锚图(0.5 天)
   └─ 翻 IP 手册 PDF,把 6 只狗 + DD 的官方立绘截图存到 img/anchor/
② 拿手册 → 打开 Nano Banana(Gemini 2.5 Flash Image)
   └─ 每条 prompt 都是一份"傻瓜式执行卡":先拖参考图,再复制 prompt
③ 每张图预算 3-5 次生成,挑一张最像的,按命名扔进对应文件夹
④ 4 个 HTML 直接刷新就能看到新图
```

### Nano Banana 用法要点(重要!)

1. **必须先拖参考图,再输入 prompt**。参考图告诉它"角色长什么样",prompt 告诉它"这张图要什么姿态/场景"。参考图缺失就等着抽卡吧。

2. **同一角色的所有图,第一张参考图永远是它的 anchor**。比如所有 Joy 图,第一张拖的都是 `img/anchor/joy-standard.png`。

3. **多参考图叠加**:角色 anchor 可以最多叠 2-3 张(比如 Joy 立绘 + Joy 表情锚)。**背景图不喂角色 anchor**,否则会在场景里塞进不想要的狗。

4. **prompt 语言**:中英混合。核心风格关键词用英文(nano banana 英文语料多),角色/场景描述用中文。

5. **负向 prompt**:每条都有,建议每次都带上,防止走样。

### 命名规范速查

```
img/
├── anchor/         *-standard.png    锚图,一次性,4 关共用
├── joy/            joy-<场景>-<状态>.png
├── dogas/          <狗名>-<场景>-<状态>.png
├── bg/             <场景>-<氛围>.png
├── deco/           <场景>-<元素>.png    透明底,单个装饰元素
├── hud/            <元素>.png           HUD 图标,小,简单
└── result/         <场景>-<状态>.png    结果页大图
```

---

## 全局风格锚(Style Anchor · 一切从这里开始)

**目标:** 确保 4 个游戏里所有狗都是"京东 IP chibi 3D 玩偶感"的同一家族。

### 锚图 0.1 · Joy 标准立绘 ✓(已就位,无需生成)

- **文件:** `img/anchor/joy-standard.png`
- **来源:** 直接从 `3B/3BST00101.png` 复制过来(已完成)
- **特征描述**(供后续 prompt 引用):
  > 白色圆润 chibi 3D 玩偶感,大脑袋(头身比 1:1.3),黑色椭圆眼睛,黑色椭圆鼻子,弧形微笑嘴,两只软塌塌的耳朵,红色项圈,身体白色无纹路,studio lighting,off-white background。

### 锚图 0.2 · 5 只 Doga 立绘 + DD 机器人

**由你完成:** 打开 `JOY及DOGA IP规范手册3.0 2.pdf`,把以下 6 只的官方立绘截图,按命名存到 `img/anchor/`:

- `img/anchor/chill-standard.png` — Chill(暖男/博物馆管理员)
- `img/anchor/yummy-standard.png` — Yummy(测评师/傲慢)
- `img/anchor/snow-standard.png` — Snow(带货女王)
- `img/anchor/max-standard.png` — Max(探险家哈士奇/眉毛/红领巾)
- `img/anchor/blink-standard.png` — Blink(Party King)
- `img/anchor/dd-robot-standard.png` — DD 机器人(若 PDF 里没有,用下方 prompt 0.3 生成)

**截图技巧:** 用 macOS `Cmd + Shift + 4`,选官方 3D 立绘正面全身,裁掉多余留白,存为 PNG。

### Prompt 0.3 · DD 机器人立绘(仅当 PDF 里没有时用)

- **用途:** DD 机器人作为 Joy 的助手,在星光派对里当准星
- **目标文件名:** `img/anchor/dd-robot-standard.png`
- **长宽比:** 1:1 / 1024×1024
- **参考图:** `img/anchor/joy-standard.png`(用作**风格 reference**,不是角色 reference)
- **正向 prompt(中英混合):**
  ```
  A small red round robot mascot, DD robot, cute chibi 3D toy style,
  matching the same "京东 IP" aesthetic as the reference image,
  白色圆润机身 with a friendly digital face on a small screen,
  antenna on top, no arms or short stubby arms,
  soft studio lighting, off-white background, transparent PNG,
  same head-to-body ratio and rendering style as reference.
  ```
- **负向 prompt:** `realistic robot, mechanical parts visible, industrial design, dark colors, humanoid, sharp edges, complex machinery`

---

## 场景 1 · 傍晚 Joy 拳击派对(mock-joy-boxing.html)

**主色:** 黑 #0a0510 · 热血红 #ff2244 · 金 #ffcc00
**氛围:** 赛博拳击擂台,黑红热血,六边形光墙,聚光灯

### 1.1 · Joy 拳击 idle 姿态

- **用途:** 中央擂台上 Joy 的默认站立姿态(4 拳都从这个 idle 变过来)
- **目标文件名:** `img/joy/joy-boxing-idle.png`
- **长宽比:** 3:4 / 768×1024(纵向,方便嵌入擂台)
- **参考图:** 
  1. `img/anchor/joy-standard.png`(角色锚)
  2. 从 `3B-face/` 挑一张"专注/自信"表情(建议 3B-face/06.png 或 类似)
- **正向 prompt(中英混合):**
  ```
  以参考图为角色 reference,Joy 一只白色 chibi 3D 玩偶感的狗,
  站在拳击擂台中央,戴着红色拳击手套,身体微前倾进入 boxing stance,
  两拳架在下巴前,眼神专注坚定,red boxing helmet 头盔可选,
  背景 pitch black 纯黑,rim light 从两侧打红光和金光,
  cinematic lighting, hero pose, studio rendering,
  保持与参考图完全一致的头身比 1:1.3 / 眼睛画法 / 白色身体。
  ```
- **负向 prompt:** `realistic dog, brown fur, dark scene without rim light, blood, injury, angry aggressive face, multiple characters, complex background`
- **备注:** HTML 里会把这张图放在擂台中央的 SVG 占位位置,替换掉现有那个手画 SVG Joy。

### 1.2 · Joy 出左钩拳(用户躲左侧用)

- **目标文件名:** `img/joy/joy-boxing-jab-left.png`
- **长宽比:** 3:4 / 768×1024
- **参考图:** 
  1. `img/anchor/joy-standard.png`
  2. `img/joy/joy-boxing-idle.png`(**注意:idle 图先生成好,这里作为姿态锚**)
- **正向 prompt:**
  ```
  同一只 Joy(白色 chibi 3D 玩偶感狗),从 idle 姿势打出一记左钩拳(left hook),
  左手拳套向画面右前方(观察者视角)伸出,motion blur 手套后拖尾,
  身体侧转积蓄力量,眼神凶狠但保留 chibi 圆润感,
  black background with red rim light + speed lines,
  同参考图角色特征,头身比 1:1.3,白色身体,红项圈。
  ```
- **负向 prompt:** `realistic dog, angry violent face, blood, sharp teeth, human proportions, dark serious tone`

### 1.3 · Joy 出右钩拳

- **目标文件名:** `img/joy/joy-boxing-jab-right.png`
- **参考图/尺寸同 1.2**
- **prompt 改动:** 把"左钩拳 left hook" → "右钩拳 right hook",拳套方向对称即可。

### 1.4 · Joy 出上勾拳(用户收下巴躲用)

- **目标文件名:** `img/joy/joy-boxing-uppercut.png`
- **参考图/尺寸同 1.2**
- **prompt 改动:** 
  > 打出一记 uppercut 上勾拳,右手(或左手)拳套从下方向上挥出,motion blur 从腰部拉向头顶,身体略后仰蓄力。

### 1.5 · 拳击场背景板

- **用途:** 整个拳击游戏的场景背景(非 cover 页,而是 gameplay 页面)
- **目标文件名:** `img/bg/boxing-arena.png`
- **长宽比:** 16:9 / 1920×1080
- **参考图:** 无(背景不喂角色)
- **正向 prompt:**
  ```
  Cyberpunk boxing arena, empty ring at center, hexagonal light panels on
  the walls glowing red and gold, spotlight from above hitting the ring floor,
  dark navy blue mist in the corners, atmospheric fog, no characters,
  pitch black background with red and gold accents,
  cinematic wide-angle shot, dramatic lighting, high contrast.
  Color palette: #0a0510 background, #ff2244 red glow, #ffcc00 gold accents.
  ```
- **负向 prompt:** `characters, boxers, referee, audience, realistic photo, daytime, bright colors, cartoonish flat`

### 1.6 · KO 海报(结果页大图)

- **用途:** 击败 Joy 后的胜利结算页
- **目标文件名:** `img/result/boxing-ko-poster.png`
- **长宽比:** 3:4 / 1200×1600(海报比例)
- **参考图:** 
  1. `img/anchor/joy-standard.png`
- **正向 prompt:**
  ```
  Retro boxing poster style, "K.O.!" giant graffiti text at top in bold red,
  Joy the chibi 3D white dog character at bottom fainting comically with
  swirl eyes (×_× face), stars orbiting head, keeping the "京东 IP" cute
  toy aesthetic (no violence, no injury), background is torn newspaper +
  red splash paint, gold trophy silhouette in corner,
  vintage fight poster composition, dramatic typography.
  ```
- **负向 prompt:** `realistic violence, blood, injury, angry expression, dark tone, horror`

### 1.7 · 装饰:红色拳击手套(透明 PNG)

- **用途:** cover 页动作卡角落装饰,或 HUD 里躲拳判定图标
- **目标文件名:** `img/deco/boxing-glove.png`
- **长宽比:** 1:1 / 512×512
- **参考图:** 无
- **正向 prompt:**
  ```
  A single red boxing glove, chibi 3D toy style, matte finish, laces visible,
  gold trim, isolated on transparent background, studio lighting,
  soft shadow beneath, product photography angle.
  ```
- **负向 prompt:** `realistic leather, dirt, damage, blood, multiple gloves, background scene`

---

## 场景 2 · 中午 Doga 午餐(mock-lunch-restaurant.html)

**主色:** 木棕 #2a1810 · 金 #d4a44a · 奶油 #fff2d4
**氛围:** 温暖木质餐厅内景,吊灯,大圆桌,6 只狗围坐

### 前置要求

**6 张 Doga anchor 必须先就位**(见 0.2)。本节所有立绘都以对应的 anchor 为角色参考。

### 2.1 · 6 只 Doga 食客肖像(6 张,批量生成)

**通用 prompt 模板**(为每只狗替换 `<角色名>` 和 `<性格特写>`):

- **目标文件名:** `img/dogas/<狗名>-lunch-portrait.png`(例 `chill-lunch-portrait.png`)
- **长宽比:** 1:1 / 1024×1024
- **参考图:**
  1. `img/anchor/<狗名>-standard.png`(角色锚)
  2. `img/anchor/joy-standard.png`(**风格锚**,保证画风一致)
- **正向 prompt:**
  ```
  以参考图第一张为角色 reference,同一只 <角色名>(<性格特写>),
  坐在餐厅圆桌前,两爪自然放在桌沿,一副等待上菜的期待表情,
  头略前倾专注看向画面,与参考图相同的头身比 1:1.3 和渲染风格,
  warm restaurant lighting, off-white background,
  soft shadow beneath, upper body only (from chest up),
  no food on table (food will be layered via CSS),
  同 chibi 3D 玩偶感 aesthetic 作为参考图。
  ```
- **负向 prompt:** `realistic dog, table full of food, other characters, full body, standing, dark scene, angry expression`

**6 只狗的性格特写填空(替换 `<性格特写>`):**

| 狗名 | 性格特写 |
|---|---|
| Chill | 温和暖男气质,眼神慈祥,像是餐厅老板娘般欢迎 |
| Yummy | 挑剔评委表情,眉毛微挑,前爪抱着一个小评分板 |
| Snow | 带货女王范,眼神明亮,像是要开播介绍这道菜 |
| Max | 探险家的旺盛食欲,大眼睛看着食物方向,红领巾飘动 |
| Blink | Party King 慵懒感,一副刚睡醒等饭吃的表情 |
| Joy | 主人翁的照顾之意,一副"大家都吃好了吗"的关切 |

### 2.2 · Yummy 饿了气泡态(单独生成,用于机制核心图)

- **用途:** 午餐核心机制是"喂饱饥饿的 Doga",Yummy 是最挑剔的那只,需要一张"饿了气泡"版本
- **目标文件名:** `img/dogas/yummy-lunch-hungry.png`
- **长宽比:** 1:1 / 1024×1024
- **参考图:**
  1. `img/anchor/yummy-standard.png`
  2. `img/dogas/yummy-lunch-portrait.png`(先生成好)
- **正向 prompt:**
  ```
  同一只 Yummy(挑剔评委气质的 chibi 3D 玩偶感狗),坐姿,
  肚子发出咕咕叫的表情,双眼盯着某个方向饥饿地渴望,
  两爪捂着肚子,keep the same character features as reference,
  warm restaurant background, soft shadow,
  upper body portrait, no thought bubble in image (added via CSS).
  ```
- **负向 prompt:** `angry, aggressive, thought bubble drawn in image, food in scene, other characters`

### 2.3 · 餐厅背景板

- **用途:** 午餐游戏 gameplay 页背景
- **目标文件名:** `img/bg/lunch-restaurant.png`
- **长宽比:** 16:9 / 1920×1080
- **参考图:** 无
- **正向 prompt:**
  ```
  A cozy warm-toned restaurant interior, top-down slight tilt view of a
  large round wooden table at center, chibi cartoon toy style,
  hanging lanterns above with soft warm glow, wood grain texture,
  cream tablecloth on table, warm ambient lighting from lanterns,
  no characters, no food yet (added by game),
  color palette: #2a1810 dark wood, #6b4423 mid wood, #d4a44a gold,
  #fff2d4 cream. Cozy Studio Ghibli aesthetic, painted background style.
  ```
- **负向 prompt:** `realistic photo, characters, food, cluttered, dark modern restaurant, industrial, chairs visible`

### 2.4 · 装饰:红色灯笼(透明 PNG)

- **目标文件名:** `img/deco/lunch-lantern.png`
- **长宽比:** 1:2 / 512×1024(纵向)
- **正向 prompt:**
  ```
  A single traditional red Chinese lantern, glowing warm yellow from within,
  gold tassels hanging below, chibi 3D toy style matching Joy IP aesthetic,
  isolated on transparent background, soft rim light,
  minimalist product-shot rendering.
  ```
- **负向 prompt:** `multiple lanterns, background scene, realistic photo, damage`

### 2.5 · 装饰:食物图标 × 6(透明 PNG)

**通用 prompt 模板**(食物随狗变):

- **目标文件名:** `img/deco/food-<食物名>.png`
- **长宽比:** 1:1 / 512×512
- **正向 prompt:**
  ```
  A single <食物> in chibi 3D toy style,
  matching Joy IP aesthetic, cute and simple, glossy surface,
  isolated on transparent background, soft shadow beneath,
  product-shot 3/4 view.
  ```
- **6 个食物填空:**
  - `food-bone.png` — a cartoon bone(骨头)
  - `food-apple.png` — a red apple
  - `food-chicken.png` — a chicken drumstick
  - `food-salad.png` — a bowl of fresh salad
  - `food-tea.png` — a small teacup with warm tea
  - `food-cake.png` — a slice of strawberry cake

---

## 场景 3 · 夜晚 星光派对(mock-night-fireworks.html)

**主色:** 深夜蓝 #0a0f2e · 金 #ffd66b · 紫 #3d2860 · Joy 红 #ea3323(点缀)
**氛围:** 深夜阳台 / 天台,6 只狗坐一排看夜空,流星,月亮,烟花

### 前置要求

**复用场景 2 的 6 只 Doga anchor**,只需生成新姿态(坐姿看星空)。

### 3.1 · 6 只 Doga 坐姿群像(6 张,批量)

**通用 prompt 模板:**

- **目标文件名:** `img/dogas/<狗名>-party-sit.png`
- **长宽比:** 3:4 / 768×1024
- **参考图:**
  1. `img/anchor/<狗名>-standard.png`
  2. `img/anchor/joy-standard.png`(风格锚)
- **正向 prompt:**
  ```
  以参考图为角色 reference,同一只 <角色名>,side view sitting on a rooftop
  edge, facing the night sky, tail relaxed behind, one paw on the ground,
  looking up at stars in wonder, moonlit rim light on top of head,
  transparent background, chibi 3D toy style, night atmosphere but character
  itself well-lit, preserve character features from reference.
  ```
- **负向 prompt:** `standing, front view, indoor scene, daytime, other characters, full darkness on character`

### 3.2 · 夜空背景板

- **目标文件名:** `img/bg/party-night-sky.png`
- **长宽比:** 16:9 / 1920×1080
- **正向 prompt:**
  ```
  A magical night sky as seen from a rooftop, deep navy blue #0a0f2e
  transitioning to purple #3d2860 near horizon, a large luminous moon
  in upper right, dense scattered stars, a subtle Milky Way band,
  wispy purple clouds, no characters, no fireworks yet (added via CSS),
  Studio Ghibli painted sky aesthetic, dreamlike, calm and peaceful.
  ```
- **负向 prompt:** `realistic photo, city lights, characters, fireworks in image, sun, daytime`

### 3.3 · 装饰:流星(透明 PNG)

- **目标文件名:** `img/deco/party-shooting-star.png`
- **长宽比:** 3:1 / 768×256(横向拉长)
- **正向 prompt:**
  ```
  A single shooting star with bright golden core and long white-to-gold
  trailing tail, isolated on fully transparent background, glow effect,
  no other elements, chibi toy aesthetic, cute and simple.
  ```
- **负向 prompt:** `multiple stars, background sky, realistic photo, complex composition`

### 3.4 · 装饰:烟花绽放(透明 PNG)

- **目标文件名:** `img/deco/party-firework.png`
- **长宽比:** 1:1 / 1024×1024
- **正向 prompt:**
  ```
  A single burst of colorful firework, radiating outward from center,
  gold and pink and light-blue sparkles, isolated on transparent background,
  particle trails, chibi cute style not realistic,
  centered composition, no ground, no characters.
  ```
- **负向 prompt:** `realistic fireworks photo, city background, multiple bursts, dark noise`

### 3.5 · 结果页:派对合影

- **用途:** 一次派对结束后,6 只狗 + DD 的合影
- **目标文件名:** `img/result/party-family-photo.png`
- **长宽比:** 4:3 / 1600×1200
- **参考图:** 6 张 Doga anchor + Joy + DD anchor(如果 nano banana 允许多张,尽量都拖)
- **正向 prompt:**
  ```
  A group photo of 7 characters: Joy the white chibi dog in center,
  surrounded by Chill / Yummy / Snow / Max / Blink dogs and DD robot,
  all in chibi 3D toy style matching reference images, all looking at
  the camera with happy expressions, rooftop night sky background with
  moon and stars behind them, fireworks bursting in the sky,
  warm rim light on each character, group hug composition,
  same character features as references, keepsake photo aesthetic.
  ```
- **负向 prompt:** `realistic photo, missing characters, character variation from references, dark faces, sad expressions`

---

## 场景 4 · 早晨 Joy 散步(index.html)

**主色:** 樱花粉 #ffc0cb · 桃粉 #ffb6a8 · 新绿 #a8e6cf · 天蓝 #cae7ff
**氛围:** 清晨樱花公园小径,樱花飘落,阳光斑驳

### 4.1 · Joy 散步姿态(walk)

- **用途:** 主玩法虽然用 canvas 绘制,但 cover 页需要一张 Joy 立绘作为主视觉
- **目标文件名:** `img/joy/joy-walk-idle.png`
- **长宽比:** 3:4 / 768×1024
- **参考图:** 
  1. `img/anchor/joy-standard.png`
- **正向 prompt:**
  ```
  Joy the white chibi 3D toy dog, walking pose (mid-stride), tail wagging,
  looking forward with excited happy expression, one paw lifted,
  cherry blossom petals gently falling around, morning sunlight rim light,
  transparent background, 3/4 view, same character features as reference,
  同参考图的头身比 1:1.3,红项圈,黑椭圆眼睛。
  ```
- **负向 prompt:** `running fast, aggressive, dark scene, other characters, full background`

### 4.2 · Joy 开心跳跃(结算页用)

- **目标文件名:** `img/joy/joy-walk-happy.png`
- **长宽比:** 1:1 / 1024×1024
- **参考图:** `img/anchor/joy-standard.png` + `img/joy/joy-walk-idle.png`
- **正向 prompt:**
  ```
  Joy jumping in joy (中心构图),4 paws off the ground,
  arms up in celebration, huge happy smile, eyes sparkling ✧
  cherry petals swirling around, warm morning sunlight,
  chibi 3D toy style, transparent background,
  same character as reference: white body, red collar, big black eyes.
  ```
- **负向 prompt:** `sad, still standing, ground visible, other characters, dark`

### 4.3 · 樱花公园背景板

- **目标文件名:** `img/bg/walk-park-cherry.png`
- **长宽比:** 16:9 / 1920×1080
- **正向 prompt:**
  ```
  Early morning cherry blossom park path, wide horizontal composition,
  a curving stone path leading from foreground into distance,
  cherry blossom trees on both sides in full bloom, pink and white
  petals in the air, soft morning sunlight beams filtering through
  branches, dew on grass, no characters, no obstacles,
  Studio Ghibli painted background aesthetic, calm and healing,
  color palette: #ffc0cb pink, #a8e6cf mint green, #cae7ff sky blue.
  ```
- **负向 prompt:** `characters, dogs, animals, people, autumn colors, night, rain, dark clouds`

### 4.4 · 装饰:樱花花瓣(透明 PNG)

- **目标文件名:** `img/deco/walk-cherry-petal.png`
- **长宽比:** 1:1 / 256×256(小尺寸,做 CSS 粒子层)
- **正向 prompt:**
  ```
  A single cherry blossom petal, soft pink #ffc0cb,
  slightly curled edge, isolated on fully transparent background,
  simple flat toon rendering (not photorealistic).
  ```
- **负向 prompt:** `multiple petals, flower cluster, realistic photo, complex shading`

### 4.5 · 装饰:骨头(透明 PNG)

- **目标文件名:** `img/deco/walk-bone.png`
- **长宽比:** 1:1 / 512×512
- **正向 prompt:**
  ```
  A cute cartoon dog bone, cream white color, chibi 3D toy style,
  glossy surface, isolated on transparent background, small drop shadow,
  minimalist product-shot rendering.
  ```
- **负向 prompt:** `realistic bone, multiple bones, meat, blood, background scene`

---

## HUD 通用图标(所有 4 关共用)

**位置:** `img/hud/`

- `star-dust.png` — 星屑图标(小,金色亮片)
- `heart.png` — 爱心(粉色,chibi 玩具感)
- `bone.png` — 复用 `img/deco/walk-bone.png`,或者缩小版本

**通用 prompt:**
```
A single [element] icon, chibi 3D toy style, glossy, small,
isolated on transparent background, soft glow, minimalist.
```

---

## 生成顺序建议(自上而下)

如果你想一天内看到最大焕新效果,按这个顺序:

```
Day 0.5:  锚图筹备 → PDF 翻图,存 6 张 Doga anchor
         (无需 Nano Banana)

Day 1 上: Prompt 1.1 (Joy 拳击 idle) → 1.5 (拳击场背景)
         看拳击 cover 焕新效果
Day 1 下: Prompt 1.2 / 1.3 / 1.4 (Joy 三种拳)
         Prompt 1.6 (KO 海报)

Day 2:   Prompt 2.1 × 6 (6 只 Doga 午餐坐姿)
         Prompt 2.3 (餐厅背景)
         Prompt 2.5 × 6 (6 个食物图标)

Day 3:   Prompt 3.1 × 6 (6 只派对坐姿,复用 anchor)
         Prompt 3.2 (夜空背景)
         Prompt 3.3-3.5 (流星、烟花、合影)

Day 4:   Prompt 4.1 / 4.2 (Joy 散步姿态)
         Prompt 4.3 (樱花公园背景)
         Prompt 4.4 / 4.5 (樱花瓣、骨头)
         做最后统调
```

---

## 常见问题

**Q1: 角色一致性走样怎么办?**  
A: 3 步排查——(a) 参考图有没有第一张放 anchor?(b) prompt 里有没有"same character features as reference"?(c) 负向 prompt 有没有排除"multiple characters" / "different dog"?
每张图预算 3-5 次生成,挑最像的。

**Q2: 生出来图带白底/彩底,不是透明的怎么办?**  
A: 在 prompt 里明确加 `isolated on transparent background, PNG transparency, no background`。仍不行就用 removebg 之类工具二次抠。

**Q3: 场景图里被塞了角色进去怎么办?**  
A: 场景图 prompt 里加强调 `no characters, no dogs, no people`;负向也加。**且不要喂角色 anchor**。

**Q4: 生的图风格和 Joy 官方 3D 差太多?**  
A: 大概率是没喂 Joy anchor,或者 prompt 缺"京东 IP chibi 3D 玩偶感"关键词。第一张参考图永远是 `joy-standard.png`。

**Q5: 我只想快速看效果,能跳步吗?**  
A: 可以。跳到 Day 1 上,直接生 Joy 拳击 idle + 拳击场背景两张,替换 mock-joy-boxing.html 里的手画 SVG,焕新对比最直观。

---

*最后更新:方案通过后自动生成。生图迭代过程遇到问题,直接更新此文件*
