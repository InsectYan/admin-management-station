'use strict';

/** 小说枚举目录，真源见 docs-project/小说枚举.md */

const GENRE_CATEGORIES = [
  { name: '玄幻', description: '东方玄幻、异界与高武体系', children: ['东方玄幻', '异界大陆', '高武世界', '系统流', '异世大陆'] },
  { name: '仙侠', description: '修真文明与古典仙侠', children: ['现代修真', '修真文明', '洪荒封神', '古典仙侠'] },
  { name: '科幻', description: '星际、赛博与末世想象', children: ['机器时代', '星际战争', '赛博朋克', '末世危机', '克苏鲁', '古武机甲', '时间旅行', '太空歌剧'] },
  { name: '都市', description: '现代都市生活与职场情感', children: ['都市生活', '商战职场', '异术超能', '都市重生', '合租情缘', '娱乐明星', '谍战特工', '爱情婚姻', '乡土小说'] },
  { name: '历史', description: '穿越、架空与权谋战争', children: ['历史穿越', '架空历史', '真实历史', '朝堂权谋', '冷兵器战争'] },
  { name: '悬疑', description: '无限流、民俗与刑侦推理', children: ['无限流', '规则怪谈', '民俗悬疑', '刑侦推理', '心理惊悚'] },
  { name: '武侠', description: '传统与新派江湖', children: ['传统武侠', '新派武侠', '国术武侠', '历史武侠', '快意江湖'] },
  { name: '游戏', description: '网游、电竞与游戏异界', children: ['全息网游', '游戏生涯', '电子竞技', '游戏异界'] },
  { name: '言情', description: '古风现代与多元情感向', children: ['言情古风', '言情现代', '无CP', '百合', 'GL', 'BL', 'ABO', '女尊'] },
  { name: '轻小说', description: '日式、欧美与二次元轻小说', children: ['日式轻小说', '欧美轻小说', '东方轻小说', '二次元轻小说'] },
  { name: '军事', description: '现代战争与特种军事', children: ['现代战争', '特种军事', '历史军事', '军事特战', '军事科技'] },
  { name: '体育', description: '篮球、足球等竞技题材', children: ['体育篮球', '体育足球', '体育网球', '体育综合'] },
  { name: '奇幻', description: '东西方奇幻与魔法异能', children: ['西方奇幻', '东方奇幻', '魔法校园', '异能世界', '奇幻冒险'] },
];

const THEME_HOT = new Set([
  '赛博朋克', '克苏鲁', '规则怪谈', '灵气复苏', '电竞', '职场', '校园',
  '系统', '穿越', '重生', '修仙', '言情', '玄幻', '都市', '悬疑', '科幻',
]);

const THEME_NAMES = [
  '赛博朋克', '克苏鲁', '规则怪谈', '灵气复苏', '电竞', '职场', '校园', '乡土', '美食', '医学',
  '商战', '军事', '历史', '玄学', '修仙', '仙侠', '武侠', '言情', '悬疑', '科幻',
  '都市', '穿越', '重生', '系统', '穿书', '种田', '基建', '经营', '冒险', '奇幻',
  '魔幻', '恐怖', '惊悚', '推理', '探案', '玄幻', '修真', '修罗场', '沙雕', '正剧',
  '治愈', '励志', '现实', '时代', '成长', '日常', '单元', '群像', '反套路', '脑洞',
  '萌宠', '团宠', '马甲', '神豪', '钓系', '豪门', '打脸', '逆袭', '追妻', '虐渣',
  '甜宠', '先婚后爱', '破镜重圆', '青梅竹马', '相爱相杀', '阴差阳错', '近水楼台', '白月光', '龙傲天', '全息',
  '直播', '网红', '穿黄衣的阿肥',
];

const AUDIENCES = [
  '男-青少年-冒险', '女-成年-情感', '中性-全年龄-轻松', '男-成年-职场',
  '女-青少年-校园', '男-中年-历史', '女-中年-家庭', '中性-银发-怀旧',
  '男-Z世代-科幻', '女-Z世代-言情', '男-全年龄-热血', '女-全年龄-治愈',
  '中性-青少年-成长', '男-银发-军事', '女-青少年-奇幻', '中性-成年-悬疑',
];

const LENGTHS = [
  { name: '短篇', min_words: 0, max_words: 30000, description: '0–3 万字，适合碎片化阅读' },
  { name: '中篇', min_words: 30000, max_words: 150000, description: '3–15 万字，适合短时沉浸' },
  { name: '长篇', min_words: 150000, max_words: 500000, description: '15–50 万字，平台主流篇幅' },
  { name: '超长篇', min_words: 500000, max_words: 2000000, description: '50–200 万字，适合长线连载' },
  { name: '史诗篇', min_words: 2000000, max_words: 9999999, description: '200 万字以上，适合 IP 开发' },
];

const UPDATE_PACES = [
  { name: '日更2000-4000字', description: '起点男频主流日更节奏' },
  { name: '周更2000×7字', description: '按周稳定更新，周更约 1.4 万字' },
  { name: '爆更日更1万+字', description: '单日更新超过 8000–10000 字' },
  { name: '断更', description: '暂停更新' },
  { name: '随缘更新', description: '不固定频率，随创作状态更新' },
];

function themeEntries() {
  return THEME_NAMES.map((name, index) => ({
    name,
    heat_level: THEME_HOT.has(name) ? 5 : 1,
    sort_order: index,
  }));
}

module.exports = {
  GENRE_CATEGORIES,
  THEME_NAMES,
  themeEntries,
  AUDIENCES,
  LENGTHS,
  UPDATE_PACES,
};
