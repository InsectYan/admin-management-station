'use strict';

const Service = require('egg').Service;

class MenuService extends Service {
  async listAll() {
    const { ctx } = this;
    const items = await ctx.model.MenuItem.findAll({
      order: [[ 'parent_id', 'ASC NULLS FIRST' ], [ 'order', 'ASC' ], [ 'id', 'ASC' ]],
      raw: true,
    });
    return this.buildTree(items);
  }

  async listRoot() {
    const { ctx } = this;
    return ctx.model.MenuItem.findAll({
      where: {
        parent_id: null,
        status: 'enabled',
      },
      order: [[ 'order', 'ASC' ], [ 'id', 'ASC' ]],
      raw: true,
    });
  }

  async createMenu(payload) {
    const { ctx } = this;
    return ctx.model.MenuItem.create(payload);
  }

  async updateMenu(id, payload) {
    const { ctx } = this;
    const menu = await ctx.model.MenuItem.findByPk(id);
    if (!menu) {
      const err = new Error('菜单不存在');
      err.status = 404;
      throw err;
    }
    return menu.update(payload);
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
