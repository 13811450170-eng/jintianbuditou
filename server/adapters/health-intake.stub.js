// health-intake.stub.js · 颈肩背景采集 adapter(规则化,不调真 LLM)
// ------------------------------------------------------------
// 对应 skill: skills/health-intake/SKILL.md
// 把用户一段自然语言自述解析为结构化背景资料 + 意图画像,交给 health-assessment 作 pre 背景。
// 与真 LLM 版(jd-gateway.intake)输出结构一致,内网网关连不上时由 provider 降级到这里。
//
// 边界(照 SKILL.md):不做安全判定、不诊断、不出 gate;既往不适只作"降负荷"提示,
// BMI/久坐/屏幕只用健康促进语言(知识库第 6 节),缺失字段显式标记不臆测。

const KEYS = ['nickname','age','gender','heightCm','weightKg','occupation','sitHoursPerDay','screenHoursPerDay','history','chiefComplaint'];
const KEY_FIELDS = ['age','occupation','sitHoursPerDay','chiefComplaint'];   // 关键缺失只看这四项
const COMPLAINT_CN = { neck: '颈部', shoulder: '肩部', eye: '眼部' };

const FOLLOWUP = {
  age: '对了,方便告诉 Joy 你今年多大吗?年龄不同,颈椎的保养重点也不一样~',
  occupation: '你平时是做什么工作的呀?久坐族和体力活,陪练的方式可不一样哦。',
  sitHoursPerDay: '一天下来,大概要坐着不动多久呢?',
  chiefComplaint: '现在身上哪个部位最想让 Joy 帮忙?脖子、肩膀,还是眼睛?',
};

// 从自然语言抽取背景字段。策略:先"消费"带单位的片段(身高/体重/久坐/屏幕),
// 再在剩余串里找孤立数字当年龄,避免"每天坐9小时"里的 9 被误判为年龄。
function extractFields(text, known) {
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
    [/文员|行政|hr/i, '文员'],
  ];
  for (const [re, name] of OCC) { if (re.test(text || '')) { fields.occupation = name; break; } }

  // 既往不适(命中词原样收集,通俗描述,不做疾病归类)
  const HIST = ['颈椎病','颈椎间盘','肩周炎','腰椎','腰间盘','鼠标手','腱鞘炎','干眼症','干眼','高度近视','富贵包','落枕','偏头痛'];
  for (const h of HIST) { if ((text || '').includes(h) && !fields.history.includes(h)) fields.history.push(h); }

  // 主诉部位:取最先出现的
  const t = text || '';
  const order = [
    ['neck', t.search(/颈|脖|转头|低头|落枕/)],
    ['shoulder', t.search(/肩|圆肩|含胸|扩胸|后背/)],
    ['eye', t.search(/眼|视力|干涩|看东西|模糊/)],
  ].filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]);
  if (order.length && !fields.chiefComplaint) fields.chiefComplaint = order[0][0];

  return fields;
}

// 意图画像:健康促进语言(知识库第 6 节),非医疗结论。就久坐/屏幕/BMI/既往/主诉各给至多一条。
function buildIntentProfile(f) {
  const notes = [];
  if (f.sitHoursPerDay >= 8) notes.push({ dimension: 'sit', level: 'warn', text: `每天久坐约 ${f.sitHoursPerDay} 小时,颈肩长期静态负荷偏大,记得多起身换姿势。` });
  else if (f.sitHoursPerDay >= 5) notes.push({ dimension: 'sit', level: 'warn', text: `每天坐着约 ${f.sitHoursPerDay} 小时,每小时起来活动一下会更轻松。` });
  else if (f.sitHoursPerDay != null) notes.push({ dimension: 'sit', level: 'good', text: `久坐时间控制得不错(约 ${f.sitHoursPerDay} 小时),继续保持~` });

  if (f.screenHoursPerDay >= 8) notes.push({ dimension: 'screen', level: 'warn', text: `每天看屏幕约 ${f.screenHoursPerDay} 小时,试试 20-20-20:每 20 分钟看看远处 20 秒。` });

  const bmi = (f.heightCm > 0 && f.weightKg > 0) ? Math.round((f.weightKg / ((f.heightCm / 100) ** 2)) * 10) / 10 : null;
  if (bmi != null) {
    if (bmi >= 28) notes.push({ dimension: 'bmi', level: 'warn', text: `BMI ${bmi} 偏高,规律活动对颈肩和整体都有帮助。` });
    else if (bmi >= 24) notes.push({ dimension: 'bmi', level: 'todo', text: `BMI ${bmi} 略偏重,搭配日常活动会更舒服。` });
    else if (bmi < 18.5) notes.push({ dimension: 'bmi', level: 'todo', text: `BMI ${bmi} 偏低,注意营养和核心力量,支撑颈椎更省力。` });
    else notes.push({ dimension: 'bmi', level: 'good', text: `BMI ${bmi} 在正常区间,身体基础不错。` });
  }

  if (Array.isArray(f.history) && f.history.length) {
    notes.push({ dimension: 'history', level: 'todo', text: `你提到有${f.history.join('、')},Joy 会把训练放缓、幅度调小,量力而行。` });
  }
  if (f.chiefComplaint && COMPLAINT_CN[f.chiefComplaint]) {
    notes.push({ dimension: 'complaint', level: 'warn', text: `你最想缓解${COMPLAINT_CN[f.chiefComplaint]},Joy 会优先安排这个部位的关卡。` });
  }

  const who = [f.age ? `${f.age} 岁` : '', f.occupation || ''].filter(Boolean).join('的');
  const headline = who ? `${who},Joy 已经大概懂你了` : 'Joy 已经大概懂你了';
  return { headline, notes: notes.slice(0, 4) };
}

export const healthIntakeStub = {
  // text: 自然语言自述;known: 已采集字段(多轮携带);round: 追问轮次
  async intake({ text, known } = {}) {
    const fields = extractFields(text, known);
    const missing = KEY_FIELDS.filter(k => fields[k] == null);
    const done = missing.length === 0;
    return {
      fields,
      missing,
      followupQuestion: done ? null : FOLLOWUP[missing[0]],
      done,
      intentProfile: buildIntentProfile(fields),
      handoffToAssessment: {
        chiefComplaint: fields.chiefComplaint,
        history: fields.history || [],
        lifestyle: { sitHoursPerDay: fields.sitHoursPerDay, screenHoursPerDay: fields.screenHoursPerDay },
      },
    };
  },
};
