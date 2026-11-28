'use strict';

module.exports = app => {
  const { STRING, TEXT, INTEGER, BOOLEAN } = app.Sequelize;
  return app.model.define('cartoon_project', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: STRING(200), allowNull: false },
    source_novel_id: { type: STRING(64), allowNull: true },
    visual_style: {
      type: STRING(64),
      allowNull: false,
      defaultValue: '',
      get() {
        const { styleClassOf } = require('../lib/cartoonMeta');
        const stored = String(this.getDataValue('visual_style') || '').trim();
        return styleClassOf(stored) ? '' : stored;
      },
    },
    style_layers: {
      type: TEXT,
      allowNull: false,
      defaultValue: '{}',
      get() {
        const { readStyleLayers, styleClassOf } = require('../lib/cartoonMeta');
        const layers = readStyleLayers(this.getDataValue('style_layers'));
        const stored = String(this.getDataValue('visual_style') || '').trim();
        const legacy = styleClassOf(stored);
        if (legacy && !layers[legacy.classKey]) layers[legacy.classKey] = legacy.value;
        return layers;
      },
      set(value) {
        const { readStyleLayers } = require('../lib/cartoonMeta');
        this.setDataValue('style_layers', JSON.stringify(readStyleLayers(value)));
      },
    },
    summary: { type: TEXT, allowNull: true },
    era_note: { type: TEXT, allowNull: false, defaultValue: '' },
    status: { type: STRING(32), allowNull: false, defaultValue: 'draft' },
    content_type: { type: STRING(32), allowNull: false, defaultValue: 'ai_comic' },
    package_id: { type: STRING(64), allowNull: true },
    package_version: { type: INTEGER, allowNull: true },
    pin_mode: { type: STRING(16), allowNull: false, defaultValue: 'required' },
    template_id: { type: STRING(64), allowNull: true },
    av_mode: { type: BOOLEAN, allowNull: false, defaultValue: false },
    topics: {
      type: TEXT,
      allowNull: false,
      defaultValue: '[]',
      get() {
        const { topicList } = require('../lib/topics');
        return topicList(this.getDataValue('topics'));
      },
      set(value) {
        const { topicList } = require('../lib/topics');
        this.setDataValue('topics', JSON.stringify(topicList(value)));
      },
    },
    deleted_at: { type: app.Sequelize.DATE, allowNull: true },
  }, { tableName: 'cartoon_projects' });
};
