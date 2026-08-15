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
  // 开局引导:返回 1~2 个引导问题 + Joy 口吻招呼
  async intro({ profile } = {}) {
    return {
      greeting: '嗨,我是 Joy。开始前先问你两个小问题,我好知道今天怎么陪你练~',
      questions: [
        { id: 'feel', q: '现在脖子肩膀,是酸、是紧、还是没啥特别感觉?', options: ['酸胀', '发紧', '还好'] },
        { id: 'goal', q: '今天想轻松放松一下,还是想认真练一组?', options: ['轻松放松', '认真练一组'] },
      ],
      // 灵敏度建议:酸/紧的人默认省力一点(游戏侧可选用)
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
};
