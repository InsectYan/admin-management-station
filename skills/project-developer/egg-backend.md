# Egg.js 后端工作流

> 编码规范：`.cursor/rules/egg-backend.mdc`

## 参考设计

- 主应用菜单 API：`docs-project/私人管理平台主应用设计.md` §3.5、§4.2
- 子应用业务 API：`docs-project/小说管理页面子应用设计.MD` §HTTP RESTful API

## 模块实现顺序

```
Model → Service → Controller → Router → Middleware（鉴权）
```

## 主应用：菜单模块

### API 清单

| 方法 | 路径 | 权限 | 说明 |
|-----|------|------|------|
| GET | `/api/menus` | 登录用户 | 全部菜单（树形） |
| GET | `/api/menus/root` | 登录用户 | 一级菜单 |
| POST | `/api/menus` | admin | 新增 |
| PUT | `/api/menus/:id` | admin | 更新 |
| DELETE | `/api/menus/:id` | admin | 删除 |

### 实现要点

- `app/model/Menu.js` 映射 `menu_items` 表
- `app/service/menu.js`：树形组装、`getRootMenus` 过滤 `parent_id IS NULL`
- `app/controller/menu.js`：统一 `{ code, message, data }` 响应
- 写操作：`egg-jwt` 验证 + RBAC（`role === 'admin'`）
- 可选：Redis 缓存菜单树

## 子应用：小说模块

### API 清单

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | `/api/novels` | 列表 + 筛选 + 分页 |
| POST | `/api/novels` | 创建 |
| PUT | `/api/novels/:id` | 更新 |
| DELETE | `/api/novels/:id` | 删除 |

### 实现要点

- DTO 校验：`egg-validate` 或手动校验请求体
- 创建/更新使用事务（小说 + 章节）
- JSONB 字段（`plot`、`draft`）通过 ORM 读写

## 配置

- `config/config.default.js`：PostgreSQL 连接、JWT secret、路由 prefix `/api`
- `config/plugin.js`：启用 `egg-jwt`、`egg-orm`
- `app.js`：时区 `Asia/Shanghai`

## 验收

- [ ] 所有端点响应格式一致
- [ ] 写接口无 token 或权限不足返回 401/403
- [ ] Service 含错误日志，Controller 不吞异常
- [ ] 与前端/子应用联调通过
