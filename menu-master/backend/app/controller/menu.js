'use strict';

const Controller = require('egg').Controller;

class MenuController extends Controller {
  async index() {
    const { ctx } = this;
    try {
      const menus = await ctx.service.menu.listAll();
      ctx.body = { code: 200, message: 'success', data: menus };
    } catch (err) {
      ctx.app.logger.error('获取菜单失败:', err);
      ctx.status = 500;
      ctx.body = { code: 500, message: err.message || '获取菜单失败', data: null };
    }
  }

  async root() {
    const { ctx } = this;
    try {
      const menus = await ctx.service.menu.listRoot();
      ctx.body = { code: 200, message: 'success', data: menus };
    } catch (err) {
      ctx.app.logger.error('获取一级菜单失败:', err);
      ctx.status = 500;
      ctx.body = { code: 500, message: err.message || '获取一级菜单失败', data: null };
    }
  }

  async create() {
    const { ctx } = this;
    const { name, parent_id, route_prefix, microapp_name, status, order, icon } = ctx.request.body;

    if (!name || !route_prefix || !microapp_name) {
      ctx.status = 400;
      ctx.body = { code: 400, message: 'name、route_prefix、microapp_name 为必填项', data: null };
      return;
    }

    try {
      const menu = await ctx.service.menu.createMenu({
        name,
        parent_id: parent_id ?? null,
        route_prefix,
        microapp_name,
        status: status || 'enabled',
        order: order ?? 0,
        icon: icon || null,
      });
      ctx.body = { code: 200, message: 'success', data: menu };
    } catch (err) {
      ctx.app.logger.error('添加菜单失败:', err);
      ctx.status = 500;
      ctx.body = { code: 500, message: err.message || '添加菜单失败', data: null };
    }
  }

  async update() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const payload = ctx.request.body;

    try {
      const menu = await ctx.service.menu.updateMenu(id, payload);
      ctx.body = { code: 200, message: 'success', data: menu };
    } catch (err) {
      ctx.app.logger.error('更新菜单失败:', err);
      ctx.status = err.status || 500;
      ctx.body = { code: ctx.status, message: err.message || '更新菜单失败', data: null };
    }
  }

  async destroy() {
    const { ctx } = this;
    const id = Number(ctx.params.id);

    try {
      await ctx.service.menu.deleteMenu(id);
      ctx.body = { code: 200, message: 'success', data: null };
    } catch (err) {
      ctx.app.logger.error('删除菜单失败:', err);
      ctx.status = err.status || 500;
      ctx.body = { code: ctx.status, message: err.message || '删除菜单失败', data: null };
    }
  }
}

module.exports = MenuController;
