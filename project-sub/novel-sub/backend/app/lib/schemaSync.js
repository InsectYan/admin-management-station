'use strict';

const fs = require('fs');
const path = require('path');
const { seedNovelEnums } = require('./enumSeed');

const SYSTEM_TABLES = new Set([
  'schema_migrations',
  'SequelizeMeta',
  'spatial_ref_sys',
]);

const SEED_NOVELS = [
  {
    title: '星辰引',
    genre: '玄幻',
    sub: '东方玄幻',
    length: '长篇',
    audience: '男-青少年-冒险',
    pace: '日更2000-4000字',
    themes: ['玄幻', '系统', '冒险'],
    progress_status: 'ongoing',
    progress_percent: 42,
    summary: '少年意外获得星图，踏上修行之路。',
    author_name: '云中客',
    status: 'published',
  },
  {
    title: '长安旧事',
    genre: '历史',
    sub: '历史穿越',
    length: '中篇',
    audience: '男-中年-历史',
    pace: '周更2000×7字',
    themes: ['历史', '穿越'],
    progress_status: 'completed',
    progress_percent: 100,
    summary: '盛唐年间，一段被尘封的宫廷秘闻。',
    author_name: '墨白',
    status: 'published',
  },
  {
    title: '半夏微凉',
    genre: '言情',
    sub: '言情现代',
    length: '短篇',
    audience: '女-成年-情感',
    pace: '随缘更新',
    themes: ['言情', '甜宠', '都市'],
    progress_status: 'completed',
    progress_percent: 100,
    summary: '夏日里的邂逅，改变了两个人的命运。',
    author_name: '清浅',
    status: 'published',
  },
  {
    title: '代码江湖',
    genre: '都市',
    sub: '异术超能',
    length: '长篇',
    audience: '男-成年-职场',
    pace: '日更2000-4000字',
    themes: ['都市', '系统', '职场'],
    progress_status: 'ongoing',
    progress_percent: 18,
    summary: '程序员穿越到武侠世界，用算法改写武林规则。',
    author_name: '键盘侠',
    status: 'draft',
  },
  {
    title: '迷雾档案',
    genre: '悬疑',
    sub: '刑侦推理',
    length: '中篇',
    audience: '中性-成年-悬疑',
    pace: '周更2000×7字',
    themes: ['悬疑', '推理', '探案'],
    progress_status: 'ongoing',
    progress_percent: 65,
    summary: '每起案件背后，都藏着同一张面孔。',
    author_name: '夜行者',
    status: 'published',
  },
  {
    title: '灵植记',
    genre: '奇幻',
    sub: '东方奇幻',
    length: '长篇',
    audience: '女-青少年-奇幻',
    pace: '日更2000-4000字',
    themes: ['奇幻', '治愈', '种田'],
    progress_status: 'ongoing',
    progress_percent: 30,
    summary: '能与植物对话的少女，守护最后的绿野。',
    author_name: '青禾',
    status: 'draft',
  },
];

function resolveDatabaseDir(app) {
  const candidates = [
    path.join(app.baseDir, '../database'),
    path.join(app.baseDir, 'database'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'init.sql'))) return dir;
  }
  return null;
}

async function runSqlBootstrap(sequelize, dbDir, logger) {
  const files = [path.join(dbDir, 'init.sql')];
  const migrationsDir = path.join(dbDir, 'migrations');
  if (fs.existsSync(migrationsDir)) {
    fs.readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      .sort()
      .forEach((name) => files.push(path.join(migrationsDir, name)));
  }
  for (const file of files) {
    const sql = fs.readFileSync(file, 'utf8');
    await sequelize.query(sql);
    logger.info('[SchemaSync] Applied %s', path.basename(file));
  }
}

function collectModelTableNames(app) {
  if (!app.model?.models) return [];
  return Object.values(app.model.models).map((model) => {
    const tableName = model.getTableName();
    return typeof tableName === 'string' ? tableName : tableName.tableName;
  });
}

async function listUserTables(sequelize) {
  const [rows] = await sequelize.query(`
    SELECT table_name AS name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  return rows.map((r) => r.name);
}

async function dropOrphanTables(sequelize, expectedTables, logger) {
  const expected = new Set(expectedTables);
  const dbTables = await listUserTables(sequelize);
  for (const table of dbTables) {
    if (expected.has(table) || SYSTEM_TABLES.has(table)) continue;
    await sequelize.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    logger.warn('[SchemaSync] Dropped orphan table: %s', table);
  }
}

async function findByName(Model, name) {
  if (!name) return null;
  return Model.findOne({ where: { name } });
}

async function seedDemoNovels(app) {
  const { Novel, GenreCategory, GenreSubcategory, LengthCategory, AudienceCategory, UpdatePace, ThemeCategory } = app.model;
  const count = await Novel.count();
  if (count > 0) return;

  for (const item of SEED_NOVELS) {
    const category = await findByName(GenreCategory, item.genre);
    const subcategory = category
      ? await GenreSubcategory.findOne({ where: { parent_id: category.id, name: item.sub } })
      : null;
    const length = await findByName(LengthCategory, item.length);
    const audience = await findByName(AudienceCategory, item.audience);
    const pace = await findByName(UpdatePace, item.pace);
    const novel = await Novel.create({
      title: item.title,
      genre: item.genre,
      novel_type: item.length,
      progress_status: item.progress_status,
      progress_percent: item.progress_percent,
      summary: item.summary,
      author_name: item.author_name,
      status: item.status,
      genre_category_id: category?.id || null,
      genre_subcategory_id: subcategory?.id || null,
      length_id: length?.id || null,
      audience_id: audience?.id || null,
      update_pace_id: pace?.id || null,
      target_audience: item.audience,
      update_cadence: item.pace,
    });
    const themes = [];
    for (const themeName of item.themes) {
      const theme = await findByName(ThemeCategory, themeName);
      if (theme) themes.push(theme);
    }
    if (themes.length) await novel.setThemes(themes);
  }
  app.logger.info('[SchemaSync] inserted %d seed novels', SEED_NOVELS.length);
}

async function backfillNovelEnumIds(app) {
  const { Novel, GenreCategory, GenreSubcategory, LengthCategory, AudienceCategory, UpdatePace } = app.model;
  const novels = await Novel.findAll();
  let count = 0;
  for (const novel of novels) {
    const patch = {};
    if (!novel.genre_category_id && novel.genre) {
      const cat = await GenreCategory.findOne({ where: { name: novel.genre } });
      if (cat) patch.genre_category_id = cat.id;
    }
    if (!novel.genre_subcategory_id && novel.genre_category_id) {
      const sub = await GenreSubcategory.findOne({
        where: { parent_id: novel.genre_category_id, name: novel.genre_subcategory || '' },
      });
      if (sub) patch.genre_subcategory_id = sub.id;
    }
    if (!novel.length_id && novel.novel_type) {
      const length = await LengthCategory.findOne({ where: { name: novel.novel_type } });
      if (length) patch.length_id = length.id;
    }
    if (!novel.audience_id && novel.target_audience) {
      const audience = await AudienceCategory.findOne({ where: { name: novel.target_audience } });
      if (audience) patch.audience_id = audience.id;
    }
    if (!novel.update_pace_id && novel.update_cadence) {
      const pace = await UpdatePace.findOne({ where: { name: novel.update_cadence } });
      if (pace) patch.update_pace_id = pace.id;
    }
    if (Object.keys(patch).length) {
      await novel.update(patch);
      count += 1;
    }
  }
  if (count) app.logger.info('[SchemaSync] backfilled enum ids for %d novels', count);
}

async function syncSchemaOnStartup(app) {
  const logger = app.logger;
  const sequelize = app.model;
  if (!sequelize) {
    logger.warn('[SchemaSync] Sequelize unavailable, skip');
    return;
  }

  const dbDir = resolveDatabaseDir(app);
  if (dbDir) {
    await runSqlBootstrap(sequelize, dbDir, logger);
  } else {
    logger.warn('[SchemaSync] database/init.sql not found under %s', app.baseDir);
  }

  await sequelize.sync({ alter: true });
  logger.info('[SchemaSync] Sequelize sync completed');

  await dropOrphanTables(sequelize, collectModelTableNames(app), logger);
  await seedNovelEnums(app);
  await seedDemoNovels(app);
  await backfillNovelEnumIds(app);
}

module.exports = { syncSchemaOnStartup };
