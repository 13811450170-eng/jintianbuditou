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

  // 练后指导(post-game coach):读本次逐轴结果,给「下一步重点练什么 + 安全提示」。
  // 对应 skill: health-coaching(练后数据整理)。不诊断、不给强制次数/极限幅度目标。
  // 无 session(拳击/喂饭等聚合关,或直接开报告)→ 给通用低负荷方案,不空手。
  async coachFromSession({ session, profile } = {}) {
    const SAFETY = '慢而稳、不甩头、每个方向做完回正,无痛范围内 —— 这是护颈椎最关键的一点。';
    const BREAKS = '每练两三组歇一会;久坐的话约每小时起身活动、改变体位。';

    if (!session || !session.byAxis) {
      return {
        focus: '这次没记录到逐轴数据,下次动作慢一点、幅度大一点,Joy 就能帮你看清练得怎么样。',
        moves: [
          { name: '转头', cue: '缓慢向左右转到舒适位,各停 2 秒再回正' },
          { name: '抬头低头', cue: '缓慢抬头、缓慢低头,单一方向到位后回中立' },
        ],
        breaks: BREAKS,
        safety: SAFETY,
        tone: 'cheer',
      };
    }

    const { byAxis, flingCount = 0 } = session;
    // 逐轴打分:没练到 / 保持太短 = 下次重点;据此挑 1-2 个方向。
    const weak = [];
    for (const axis of ['yaw', 'pitch', 'roll']) {
      const b = byAxis[axis]; const cn = AXIS_CN[axis];
      if (!b || b.reps === 0) { weak.push({ axis: cn, why: '这次几乎没练到', priority: 2 }); continue; }
      if (b.holdAvg && b.holdAvg < 150) { weak.push({ axis: cn, why: `保持时间偏短(约 ${b.holdAvg}ms)`, priority: 1 }); }
    }
    weak.sort((a, b) => b.priority - a.priority);

    const CUE = {
      '转头': '躯干稳住,缓慢转头到舒适位,停 2 秒再回正',
      '抬头低头': '缓慢抬头、缓慢低头,到位后回到中立位再做下一次',
      '侧屈': '双肩放松,耳朵轻轻靠向同侧肩,别耸肩、别转头',
    };
    const moves = (weak.length ? weak.slice(0, 2) : [{ axis: '转头' }, { axis: '侧屈' }])
      .map(w => ({ name: w.axis, cue: CUE[w.axis] || '缓慢到位、回正', why: w.why }));

    const focus = flingCount >= 3
      ? '这次有点急,下次把动作放慢 —— 慢而稳才真正练到颈椎。'
      : weak.length
        ? `下次重点把「${weak[0].axis}」练到位:${weak[0].why},慢一点、多停一下。`
        : '这一组各方向都练到位了,保持这个节奏,明天继续~';

    return { focus, moves, breaks: BREAKS, safety: SAFETY, tone: flingCount >= 3 ? 'gentle' : 'cheer' };
  },
};
