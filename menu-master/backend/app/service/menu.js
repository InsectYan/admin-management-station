'use strict';

const Service = require('egg').Service;

const MENU_TREE_KEY = 'menus:tree';
const MENU_ROOT_KEY = 'menus:root';
const SUBAPP_MAP_KEY = 'subapps:map';

class MenuService extends Service {
  async listAll() {
    const { app } = this;
    const cached = await app.cache.get(MENU_TREE_KEY);
    if (cached) return cached;

    const { ctx } = this;
    const items = await ctx.model.MenuItem.findAll({
      order: [[ 'parent_id', 'ASC NULLS FIRST' ], [ 'order', 'ASC' ], [ 'id', 'ASC' ]],
      raw: true,
    });
    const tree = this.buildTree(items);
    const enriched = await this.enrichMenus(tree);
    await app.cache.set(MENU_TREE_KEY, enriched, app.config.cache.menuTtl);
    return enriched;
  }

  async listRoot() {
    const { app } = this;
    const cached = await app.cache.get(MENU_ROOT_KEY);
    if (cached) return cached;

    const { ctx } = this;
    const roots = await ctx.model.MenuItem.findAll({
      where: {
        parent_id: null,
        status: 'enabled',
      },
      order: [[ 'order', 'ASC' ], [ 'id', 'ASC' ]],
      raw: true,
    });
    const enriched = await this.enrichMenus(roots);
    await app.cache.set(MENU_ROOT_KEY, enriched, app.config.cache.menuTtl);
    return enriched;
  }

  async createMenu(payload) {
    const { ctx } = this;
    const menu = await ctx.model.MenuItem.create(payload);
    await this.invalidateMenuCache();
    return menu;
  }

  async updateMenu(id, payload) {
    const { ctx } = this;
    const menu = await ctx.model.MenuItem.findByPk(id);
    if (!menu) {
      const err = new Error('菜单不存在');
      err.status = 404;
      throw err;
    }
    const updated = await menu.update(payload);
    await this.invalidateMenuCache();
    return updated;
  }

  async deleteMenu(id) {
    const { ctx } = this;
    const menu = await ctx.model.MenuItem.findByPk(id);
    if (!menu) {
      const err = new Error('菜单不存在');
      err.status = 404;
      throw err;
    }
    const childCount = await ctx.model.MenuItem.count({ where: { parent_id: id } });
    if (childCount > 0) {
      const err = new Error('请先删除子菜单');
      err.status = 400;
      throw err;
    }
    await menu.destroy();
    await this.invalidateMenuCache();
  }

  async invalidateMenuCache() {
    const { app } = this;
    await app.cache.del(MENU_TREE_KEY);
    await app.cache.del(MENU_ROOT_KEY);
  }

  async getSubappMap() {
    const { app, ctx } = this;
    const cached = await app.cache.get(SUBAPP_MAP_KEY);
    if (cached) return cached;

    try {
      const rows = await ctx.model.SubappRegistry.findAll({
        where: { status: 'enabled' },
        raw: true,
      });
      const map = {};
      rows.forEach(row => {
        map[row.microapp_name] = this.resolveSubappMeta(row);
      });
      await app.cache.set(SUBAPP_MAP_KEY, map, app.config.cache.subappTtl);
      return map;
    } catch (err) {
      app.logger.warn('[menu] subapp_registry 不可用，跳过子应用元数据:', err.message);
      return {};
    }
  }

  resolveSubappMeta(row) {
    const { app } = this;
    const envKey = app.config.subappEntryEnv[row.microapp_name]
      || `SUBAPP_${String(row.app_key).toUpperCase().replace(/-/g, '_')}_ENTRY`;
    const envEntry = envKey ? process.env[envKey] : null;
    const isProd = process.env.NODE_ENV === 'production';
    const entry = envEntry || (isProd && row.entry_prod ? row.entry_prod : row.entry_dev);

    return {
      microapp_name: row.microapp_name,
      app_key: row.app_key,
      display_name: row.display_name,
      entry,
      entry_dev: row.entry_dev,
      entry_prod: row.entry_prod,
      vite_port: row.vite_port,
      api_port: row.api_port,
      agent_port: row.agent_port,
      status: row.status,
    };
  }

  async enrichMenus(menus) {
    const subappMap = await this.getSubappMap();
    return menus.map(menu => this.enrichMenuItem(menu, subappMap));
  }

  enrichMenuItem(menu, subappMap) {
    const subapp = subappMap[menu.microapp_name] || null;
    const enriched = {
      ...menu,
      subapp,
      entry: subapp?.entry || null,
      active_rule: `/media/${menu.route_prefix}`,
      basename: `/media/${menu.route_prefix}`,
    };

    if (menu.children?.length) {
      enriched.children = menu.children.map(child => this.enrichMenuItem(child, subappMap));
    }

    return enriched;
  }

  buildTree(items) {
    const map = new Map();
    const tree = [];

    items.forEach(item => {
      map.set(item.id, { ...item, children: [] });
    });

    map.forEach(node => {
      if (node.parent_id && map.has(node.parent_id)) {
        map.get(node.parent_id).children.push(node);
      } else if (!node.parent_id) {
        tree.push(node);
      }
    });

    return tree;
  }
}

module.exports = MenuService;
