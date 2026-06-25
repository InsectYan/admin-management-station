# novel-sub 模块索引

设计文档：[`小说管理页面子应用设计.MD`](../../../docs-project/小说管理页面子应用设计.MD)

| 模块 | 技术栈 | 设计文档章节（关键词） | 实现目录 |
|------|--------|----------------------|----------|
| 小说列表 | front-end + back-end | NovelListPage、GET /api/novels | `views/NovelListPage.vue`、`backend/app/` |
| 小说创建 | front-end + back-end | NovelCreationPage、POST /api/novels | `views/NovelCreationPage.vue` |
| 小说详情 | front-end + back-end | NovelDetailPage、PUT/DELETE | `views/NovelDetailPage.vue` |
| 数据模型 | database + back-end | novels、chapters、users | `database/init.sql`、`app/model/` |
| Qiankun 接入 | front-end | 微前端、生命周期 | `main.js`、`apiConfig.js` |

## 端口（app_key=novel）

| 用途 | 值 |
|------|-----|
| API | 7002 |
| Vite | 5174 |
| PG 宿主机 | 5433 |
| 库名 | `novel_db` |
| microapp_name | `novel-app` |

完整表见 [应用端口与命名注册表](../../../docs-project/应用端口与命名注册表.md)。

## API 清单（摘自设计文档）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/novels` | 列表 + 筛选 + 分页 |
| POST | `/api/novels` | 创建 |
| PUT | `/api/novels/:id` | 更新 |
| DELETE | `/api/novels/:id` | 删除 |

实现细节以设计文档最新章节为准；冲突时以设计文档为准并更新本表。
