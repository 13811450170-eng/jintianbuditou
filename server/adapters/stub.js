// stub.js · 本地演示用 provider(不调真 LLM)
// ------------------------------------------------------------
// 基于游戏传来的真实 session 数据(byAxis/flingCount)做规则化分析,
// 产出结构与真 LLM adapter 完全一致 —— 这样整条闭环(埋点→后端→报告页渲染)
// 在 JD 网关接口确认前就能先跑通、可演示,且看起来"AI 真读懂了你的数据"。
//
// 康复红线体现在文案取向:表扬"慢而稳"(保持时长足够、甩头少),
// 对甩头多、幅度不足给温和纠正 —— 与游戏的安全设计一致。

const AXIS_CN = { yaw: '转头', pitch: '抬头低头', roll: '侧屈' };

export const stubAdapter = {
  // 开局引导:每次从题库随机抽,体现"AI 现场问诊"感(内网 DeepSeek 版天然随机)。
  // feel/goal 两个关键 id 语义固定(recommend 依赖),但措辞与追加题随机。
  async intro({ profile } = {}) {
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const greetings = [
      '嗨,我是 Joy~ 正式开始前,让我先"读"一下你今天的状态。',
      '来啦!老规矩,先让我给你把把脉,几个小问题~',
      '在开练之前,我想先了解下你此刻的身体感受,好对症陪练。',
      '喵…哦不,汪!先别急着动,让我这个外星狗先分析下你今天的情况。',
    ];
    const feelQs = [
      '现在脖子肩膀,是酸、是紧、还是没啥特别感觉?',
      '此刻你的颈肩,更接近哪种状态?',
      '低头一整天了,现在脖子给你什么信号?',
    ];
    const goalQs = [
      '今天想轻松放松一下,还是想认真练一组?',
      '这次是想摸鱼式松一松,还是来点强度?',
    ];
    const extras = [
      { id: 'duration', q: '今天已经连续坐了多久没起来动了?', options: ['1 小时内', '两三小时', '半天没动了'] },
      { id: 'sleep', q: '昨晚睡得怎么样?睡姿也会影响颈椎哦。', options: ['睡得不错', '一般', '落枕/没睡好'] },
      { id: 'mood', q: '顺便问下,今天心情如何?放松点更容易练到位~', options: ['挺好', '有点累', '压力山大'] },
    ];
    const questions = [
      { id: 'feel', q: pick(feelQs), options: ['酸胀', '发紧', '还好'] },
      { id: 'goal', q: pick(goalQs), options: ['轻松放松', '认真练一组'] },
    ];
    if (Math.random() < 0.7) questions.push(pick(extras));   // 70% 概率追加一题,更像现场问诊
    return {
      greeting: pick(greetings),
      questions,
      suggestSensitivity: profile && profile.feel === '酸胀' ? 35 : 50,
    };
  },

  // 问诊推荐:收用户答案 → 推荐关卡 + 灵敏度 + Joy 点评。聚合页用它决定高亮哪个入口。
  async recommend({ answers } = {}) {
    const feel = answers && answers.feel;
    const goal = answers && answers.goal;

    // 关卡键与聚合页入口对应:walk=散步(index) boxing=拳击 lunch=喂饭 fireworks=烟花
    let level = 'walk', reason = '', sensitivity = 50;

    if (feel === '酸胀') {
      // 酸胀 = 已经不舒服,推轻柔的散步,灵敏度调省力
      level = 'walk'; sensitivity = 35;
      reason = '脖子有点酸的话,先跟我散散步、轻轻活动开,别急着发力。';
    } else if (goal === '认真练一组') {
      // 想认真练 = 推拳击(强度最高、颈椎覆盖最全)
      level = 'boxing'; sensitivity = 55;
      reason = '想好好练一组?那来打一场,跟着节拍闪避出击,出出汗!';
    } else if (feel === '发紧') {
      // 发紧但不酸 = 喂饭关,定向大幅活动帮拉伸
      level = 'lunch'; sensitivity = 50;
      reason = '发紧就多做些大方向的转头,来喂喂饿了的伙伴,把僵住的地方舒展开。';
    } else {
      // 还好 + 轻松放松 = 默认散步
      level = 'walk'; sensitivity = 50;
      reason = '那我们轻松散个步吧,边走边活动,舒舒服服的~';
    }

    return { level, reason, suggestSensitivity: sensitivity, tone: feel === '酸胀' ? 'gentle' : 'cheer' };
  },

  // 结果分析:读 session.byAxis / flingCount 生成逐轴点评
  async analyze({ session } = {}) {
    if (!session || !session.byAxis) {
      return { headline: '这次没记录到足够动作', insights: [], advice: '下次动作幅度大一点、慢一点,Joy 就能看清你练得怎么样啦。', tone: 'gentle' };
    }
    const { byAxis, flingCount = 0, totalActions = 0, durationMs = 0 } = session;
    const insights = [];

    // 逐轴:覆盖 + 幅度 + 保持
    for (const axis of ['yaw', 'pitch', 'roll']) {
      const b = byAxis[axis]; if (!b) continue;
      const cn = AXIS_CN[axis];
      if (b.reps === 0) {
        insights.push({ axis, level: 'todo', text: `${cn}这次几乎没练到,下次可以多留意这个方向。` });
      } else if (b.holdAvg && b.holdAvg < 150) {
        insights.push({ axis, level: 'warn', text: `${cn}做了 ${b.reps} 次,但保持时间偏短(约 ${b.holdAvg}ms)。慢一点、到位后多停一下,对颈椎更好。` });
      } else if (b.holdAvg) {
        insights.push({ axis, level: 'good', text: `${cn} ${b.reps} 次,峰值约 ${b.peakMax}°、平均保持 ${b.holdAvg}ms,稳得不错!` });
      } else {
        insights.push({ axis, level: 'good', text: `${cn} ${b.reps} 次,峰值约 ${b.peakMax}°,到位!` });
      }
    }

    // 甩头(安全红线指标)
    if (flingCount >= 3) {
      insights.push({ axis: 'safety', level: 'warn', text: `检测到 ${flingCount} 次甩头。康复讲究"慢而稳",快速甩脖子反而伤颈椎,下次放慢些。` });
    } else if (flingCount === 0 && totalActions > 0) {
      insights.push({ axis: 'safety', level: 'good', text: '全程没有甩头,动作很稳 —— 这正是护颈椎最关键的一点。' });
    }

    const goods = insights.filter(i => i.level === 'good').length;
    const headline = flingCount >= 3 ? '练到了,但节奏可以再稳一点'
      : goods >= 2 ? '这一组练得很稳,给你点个赞'
      : '开了个好头,继续保持';

    return {
      headline,
      insights,
      advice: '每天两三组、动作慢而稳,比一次练很多更有用。明天 Joy 还等你~',
      tone: flingCount >= 3 ? 'gentle' : 'cheer',
      meta: { totalActions, durationSec: Math.round(durationMs / 1000) },
    };
  },

  // 对话式录入:从中文自由描述里规则化抽取基础档案字段,产出与 jd-gateway.intake 一致的结构。
  // 策略:先"消费"掉带单位的片段(身高/体重/久坐/屏幕),再在剩余串里找孤立数字当年龄,
  // 避免"每天坐9小时"里的 9 被误判为年龄。抽不到的关键项进 missing,给一句 Joy 口吻追问。
  async intake({ text, known } = {}) {
    const KEYS = ['nickname','age','gender','heightCm','weightKg','occupation','sitHoursPerDay','screenHoursPerDay','history','chiefComplaint'];
    const fields = {};
    for (const k of KEYS) fields[k] = (known && known[k] != null) ? known[k] : (k === 'history' ? [] : null);
    if (!Array.isArray(fields.history)) fields.history = [];

    let work = String(text || '');
    const eat = (re) => { const m = work.match(re); if (m) work = work.replace(m[0], ' '); return m; };

    // 身高:带单位优先,否则孤立三位数 150-209
    let m = eat(/(\d{3})\s*(?:cm|厘米|公分)/i);
    if (m) fields.heightCm = +m[1];
    else { m = work.match(/(?<!\d)(1[5-9]\d|20\d)(?!\d)/); if (m) { fields.heightCm = +m[1]; work = work.replace(m[0], ' '); } }

    // 体重:kg/公斤/千克 原值,斤 折半
    m = eat(/(\d{2,3})\s*(?:kg|公斤|千克)/i);
    if (m) fields.weightKg = +m[1];
    else { m = eat(/(\d{2,3})\s*斤/); if (m) fields.weightKg = Math.round(+m[1] / 2); }

    // 久坐:先消费,避免其数字被年龄误抓
    m = eat(/坐\D{0,6}(\d{1,2})\s*(?:个)?\s*(?:小时|h|钟头)/i) || eat(/久坐\D{0,4}(\d{1,2})/);
    if (m) fields.sitHoursPerDay = +m[1];

    // 屏幕时长
    m = eat(/(?:屏幕|看屏|盯屏|电脑|手机)\D{0,8}(\d{1,2})\s*(?:小时|h)/i);
    if (m) fields.screenHoursPerDay = +m[1];

    // 年龄:带"岁"优先,否则剩余串里孤立的 18-69
    m = work.match(/(\d{1,2})\s*岁/) || work.match(/今年\D{0,2}(\d{1,2})/) || work.match(/(?<!\d)([2-6]\d|1[89])(?!\d)/);
    if (m) fields.age = +m[1];

    // 性别
    if (/女(?:士|生|孩|性)?|妹|姑娘/.test(text || '')) fields.gender = '女';
    else if (/男(?:士|生|性)?|先生|小伙|大哥/.test(text || '')) fields.gender = '男';

    // 职业(命中即取,存中文类别)
    const OCC = [
      [/程序员|开发|工程师|码农|后端|前端|测试/, '程序员'],
      [/设计师?|ui|视觉|交互/i, '设计师'],
      [/产品经理|产品/, '产品经理'],
      [/运营/, '运营'],
      [/教师|老师/, '教师'],
      [/学生/, '学生'],
      [/司机/, '司机'],
      [/销售/, '销售'],
      [/客服/, '客服'],
      [/财务|会计/, '财务'],
      [/医生|护士|医护/, '医护'],
      [/编辑|文案|写作/, '文案'],
      [/教师|文员|行政|hr/i, '文员'],
    ];
    for (const [re, name] of OCC) { if (re.test(text || '')) { fields.occupation = name; break; } }

    // 既往病史/不适(命中词原样收集)
    const HIST = ['颈椎病','颈椎间盘','肩周炎','腰椎','腰间盘','鼠标手','腱鞘炎','干眼症','干眼','高度近视','富贵包','落枕','偏头痛'];
    for (const h of HIST) { if ((text || '').includes(h) && !fields.history.includes(h)) fields.history.push(h); }

    // 主诉部位:取最先出现的
    const t = text || '';
    const hit = [
      ['neck', t.search(/颈|脖|转头|低头|落枕/)],
      ['shoulder', t.search(/肩|圆肩|含胸|扩胸|后背/)],
      ['eye', t.search(/眼|视力|干涩|看东西|模糊/)],
    ].filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]);
    if (hit.length && !fields.chiefComplaint) fields.chiefComplaint = hit[0][0];

    // 关键缺失项 + 一句追问
    const FOLLOWUP = {
      age: '对了,方便告诉 Joy 你今年多大吗?年龄不同,颈椎的保养重点也不一样~',
      occupation: '你平时是做什么工作的呀?久坐族和体力活,陪练的方式可不一样哦。',
      sitHoursPerDay: '一天下来,大概要坐着不动多久呢?',
      chiefComplaint: '现在身上哪个部位最想让 Joy 帮忙?脖子、肩膀,还是眼睛?',
    };
    const missing = ['age','occupation','sitHoursPerDay','chiefComplaint'].filter(k => fields[k] == null);
    const done = missing.length === 0;
    return { fields, missing, followupQuestion: done ? null : FOLLOWUP[missing[0]], done };
  },
};
