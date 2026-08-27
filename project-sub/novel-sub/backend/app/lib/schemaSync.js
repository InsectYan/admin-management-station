'use strict';

const SEED_NOVELS = [
  {
    title: '星辰引',
    cover_url: '',
    genre: '玄幻',
    novel_type: '长篇',
    progress_status: 'ongoing',
    progress_percent: 42,
    summary: '少年意外获得星图，踏上修行之路。',
    author_name: '云中客',
    status: 'published',
  },
  {
    title: '长安旧事',
    cover_url: '',
    genre: '历史',
    novel_type: '中篇',
    progress_status: 'completed',
    progress_percent: 100,
    summary: '盛唐年间，一段被尘封的宫廷秘闻。',
    author_name: '墨白',
    status: 'published',
  },
  {
    title: '半夏微凉',
    cover_url: '',
    genre: '言情',
    novel_type: '短篇',
    progress_status: 'completed',
    progress_percent: 100,
    summary: '夏日里的邂逅，改变了两个人的命运。',
    author_name: '清浅',
    status: 'published',
  },
  {
    title: '代码江湖',
    cover_url: '',
    genre: '都市',
    novel_type: '长篇',
    progress_status: 'ongoing',
    progress_percent: 18,
    summary: '程序员穿越到武侠世界，用算法改写武林规则。',
    author_name: '键盘侠',
    status: 'draft',
  },
  {
    title: '迷雾档案',
    cover_url: '',
    genre: '悬疑',
    novel_type: '中篇',
    progress_status: 'ongoing',
    progress_percent: 65,
    summary: '每起案件背后，都藏着同一张面孔。',
    author_name: '夜行者',
    status: 'published',
  },
  {
    title: '灵植记',
    cover_url: '',
    genre: '奇幻',
    novel_type: '长篇',
    progress_status: 'ongoing',
    progress_percent: 30,
    summary: '能与植物对话的少女，守护最后的绿野。',
    author_name: '青禾',
    status: 'draft',
  },
];

async function syncSchemaOnStartup(app) {
  const logger = app.logger;
  const sequelize = app.model;
  if (!sequelize) {
    logger.warn('[SchemaSync] Sequelize unavailable, skip');
    return;
  }

  await sequelize.sync({ alter: true });
  logger.info('[SchemaSync] Sequelize sync completed');

  const { Novel } = app.model;
  const count = await Novel.count();
  if (count === 0) {
    await Novel.bulkCreate(SEED_NOVELS);
    logger.info('[SchemaSync] inserted %d seed novels', SEED_NOVELS.length);
  }
}

module.exports = { syncSchemaOnStartup };
