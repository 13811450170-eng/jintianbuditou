// products.js · 商业化推荐 adapter
// ------------------------------------------------------------
// 读 server/data/products.json(真实京东商品目录,由 refresh-products.mjs 用 o2 metasearch 生成),
// 按「本次游戏结果 + 健康档案」做纯规则意图映射,选 2-3 条商品,附 Joy 生活方式口吻推荐语。
//
// 健康红线:纯规则、无 LLM,文案只谈「放松辅助 / 减少低头 / 久坐改善」等生活方式,
// 绝不出现「治疗/康复颈椎病/疗效」等医疗声明(与 health-coaching skill 一致)。
//
// 请求路径只读本地 JSON(零依赖、可离线)。可选:PRODUCTS_LIVE=1 且 metasearch 在 PATH 时,
// 先实时查一次,失败回退目录 —— 镜像 jd-gateway 的 try-live→fallback 模式。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = join(__dirname, '..', 'data', 'products.json');

// 目录只读一次,进程内缓存(刷新目录后重启后端即可)。
let _catalog = null;
function loadCatalog() {
  if (_catalog) return _catalog;
  try {
    _catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')).categories || {};
  } catch {
    _catalog = {};   // 目录缺失 → 空,recommend 返回空推荐(前端静默隐藏卡)
  }
  return _catalog;
}

// 品类兜底推荐语(当本次没有可挂钩的数据信号时用)。生活方式口吻,非医疗。
const CATEGORY_FALLBACK = {
  'neck-massager':     '久坐一天脖子发紧,靠一会儿放松放松也挺舒服的~',
  'shoulder-massager': '肩膀圆着扛了一天,给它一点热敷和揉捏,松快些。',
  'neck-pillow':       '睡觉时把颈椎托住,第二天不容易落枕。',
  'laptop-stand':      '把屏幕垫到平视高度,你就不用一直低头啦 —— 这才是治本。',
  'ergonomic-chair':   '久坐族的椅子撑住腰背,坐姿正了脖子肩膀都轻松。',
  'eye-mask':          '盯屏幕一天,热敷一下眼睛,睡前放松的小仪式。',
  'eye-lamp':          '光线柔和些,看东西不那么费眼。',
};

// 从本次训练结果 + 档案里提取「可用于话术的信号」,一次算好给下面复用。
function extractSignals({ analysis, session, profile } = {}) {
  const p = profile || {};
  const fling = session?.flingCount || 0;
  const warnAxes = (analysis?.insights || []).filter(i => i.level === 'warn').map(i => i.text);
  const sit = Number(p.sitHoursPerDay) || 0;
  const screen = Number(p.screenHoursPerDay) || 0;
  const office = /设计|程序|工程|运营|产品|财务|文案|编辑|客服|办公|白领/.test(p.occupation || '');
  return { fling, warnAxes, sit, screen, office, complaint: p.chiefComplaint };
}

// 数据驱动推荐语:优先引用本次真实信号(甩头次数/久坐时长/主诉),讲清「为什么给你推它」。
// 没有可挂钩信号时回退品类兜底句。全程生活方式口吻,不做任何医疗/疗效声明。
function buildReason(key, s) {
  switch (key) {
    case 'neck-massager':
      if (s.fling >= 3) return `这次检测到 ${s.fling} 次甩头,脖子还挺紧张的,练后靠一会儿放松放松挺舒服。`;
      if (s.warnAxes.length) return '这次有几个方向还没太到位,颈部偏紧,热敷揉捏帮你松一松。';
      return CATEGORY_FALLBACK[key];
    case 'shoulder-massager':
      return s.complaint === 'shoulder'
        ? '你提到肩颈不舒服,圆肩扛了一天,给它点热敷揉捏松快些。'
        : CATEGORY_FALLBACK[key];
    case 'neck-pillow':
      return CATEGORY_FALLBACK[key];
    case 'laptop-stand':
      if (s.sit >= 6) return `你每天坐 ${s.sit} 小时,把屏幕垫到平视就不用一直低头 —— 这才是治本。`;
      if (s.office) return '办公久坐,把屏幕垫到平视高度,少低头才是治本。';
      return CATEGORY_FALLBACK[key];
    case 'ergonomic-chair':
      if (s.sit >= 6) return `每天 ${s.sit} 小时的椅子,撑住腰背坐姿正了,脖子肩膀都轻松。`;
      return CATEGORY_FALLBACK[key];
    case 'eye-mask':
      if (s.screen >= 6) return `每天盯屏幕 ${s.screen} 小时,热敷一下眼睛,睡前放松的小仪式。`;
      if (s.complaint === 'eye') return '你提到眼睛容易累,热敷一下,睡前放松。';
      return CATEGORY_FALLBACK[key];
    case 'eye-lamp':
      return s.screen >= 6 ? '用屏时间长,光线柔和些看东西不那么费眼。' : CATEGORY_FALLBACK[key];
    default:
      return CATEGORY_FALLBACK[key] || '';
  }
}

// —— 意图映射:从游戏结果 + 档案推断该推哪些品类,带优先级。——
// 返回品类 key 数组(去重、保序),前面的更相关。
function pickCategories({ analysis, session, profile, level } = {}) {
  const cats = [];
  const add = k => { if (k && !cats.includes(k)) cats.push(k); };

  const p = profile || {};
  const complaint = p.chiefComplaint;               // neck | shoulder | eye
  const sit = Number(p.sitHoursPerDay) || 0;
  const screen = Number(p.screenHoursPerDay) || 0;

  // 1) 主诉最高优先
  if (complaint === 'shoulder') add('shoulder-massager');
  if (complaint === 'eye') { add('eye-mask'); add('eye-lamp'); }
  if (complaint === 'neck') { add('neck-massager'); add('neck-pillow'); }

  // 2) 关卡部位
  if (level === 'rowing' || level === 'star') add('shoulder-massager');

  // 3) 本次游戏信号:甩头多 / 逐轴偏弱 → 颈部放松
  const fling = session?.flingCount || 0;
  const warnAxes = (analysis?.insights || []).filter(i => i.level === 'warn').length;
  if (fling >= 3 || warnAxes >= 1) add('neck-massager');

  // 4) 生活方式:久坐 / 办公职业 → 工位改善(治本,优先于按摩仪)
  const office = /设计|程序|工程|运营|产品|财务|文案|编辑|客服|办公|白领/.test(p.occupation || '');
  if (sit >= 6 || office) { add('laptop-stand'); add('ergonomic-chair'); }

  // 5) 用屏多 → 护眼
  if (screen >= 6) { add('eye-mask'); add('eye-lamp'); }

  // 6) 兜底:颈部放松 + 工位
  add('neck-massager');
  add('laptop-stand');

  return cats;
}

// 从目录里按品类取一条(优先自营+高好评,已在目录里排好序,取第一条)。
function topOf(catalog, key) {
  const items = catalog[key]?.items || [];
  return items[0] || null;
}

export const productsAdapter = {
  name: 'products',

  // 主入口。返回 { reason, products:[{...全部商品字段, category, categoryLabel, reason}] }
  async recommend({ analysis, session, profile, level, limit = 3 } = {}) {
    const catalog = loadCatalog();
    const cats = pickCategories({ analysis, session, profile, level });
    const signals = extractSignals({ analysis, session, profile });   // 本次数据信号,话术挂钩用

    const products = [];
    for (const key of cats) {
      if (products.length >= limit) break;
      const item = topOf(catalog, key);
      if (!item) continue;
      if (products.some(x => x.id === item.id)) continue;   // 去重
      products.push({
        ...item,                                  // 透传全部字段(name/price/image/url/shop/isSelf/goodRate/salesYear/sellingPoints)
        category: key,
        categoryLabel: catalog[key]?.label || key,
        reason: buildReason(key, signals),        // 数据驱动推荐语
      });
    }

    if (!products.length) {
      return { reason: '', products: [] };   // 目录缺失 → 前端隐藏卡
    }

    // 顶部一句总起:优先点出本次最突出的信号,让「为什么推荐」从第一句就清楚。
    let reason;
    if (signals.fling >= 3) {
      reason = `这次有 ${signals.fling} 次甩头、脖子偏紧,Joy 挑了几样帮你练后放松、也少低头的好物~`;
    } else if (signals.sit >= 6) {
      reason = `你每天久坐 ${signals.sit} 小时,Joy 挑了几样帮你把「少低头」坚持下去的小东西~`;
    } else if (level === 'rowing' || level === 'star') {
      reason = '练完肩膀,Joy 顺手挑了几样能帮你放松、改善坐姿的好物~';
    } else {
      reason = '练完这一组,Joy 挑了几样帮你把「少低头」坚持下去的小东西~';
    }

    return { reason, products };
  },
};
