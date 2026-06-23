# Egg.js 后端工作流

> 编码规范：`.cursor/rules/egg-backend.mdc`、`.cursor/rules/app-registry.mdc`

## 参考设计

- 主应用菜单 API：`docs-project/私人管理平台主应用设计.md` §3.5、§4.2
- 子应用业务 API：`docs-project/小说管理页面子应用设计.MD` §HTTP RESTful API

## 模块实现顺序

```
Model → Service → Controller → Router → Middleware（鉴权）
```

## 主应用：菜单模块（app_key=main）

- API **7001**，数据库 **`admin_platform`**
- 代码目录：`menu-master/backend/` 或 `apps/main-backend/`

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
- 菜单树：默认 `app/lib/cache.js` memory 缓存（见 `cache-local.mdc`）

## 子应用：小说模块（app_key=novel）

- API **7002**，数据库 **`novel_db`**

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

- `config/config.default.js`：`PORT` 读 `{APP_KEY}_PORT` 或 `process.env.PORT`；PostgreSQL 读 `{APP_KEY}_POSTGRES_DB`
- 主应用：`PORT=7001`，`POSTGRES_DB=admin_platform`
- 小说：`PORT=7002`，`POSTGRES_DB=novel_db`
- 详见 [`应用端口与命名注册表.md`](../../docs-project/应用端口与命名注册表.md)

## 验收

- [ ] 所有端点响应格式一致
- [ ] 写接口无 token 或权限不足返回 401/403
- [ ] Service 含错误日志，Controller 不吞异常
- [ ] 与前端/子应用联调通过
