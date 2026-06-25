# 设计文档分析与缺陷检测（novel-sub）

设计文档：[`docs-project/小说管理页面子应用设计.MD`](../../../docs-project/小说管理页面子应用设计.MD)

## 分析步骤

1. **确认应用类型**：子应用（Qiankun、`basename`、独立 BFF）

2. **提取模块清单**

   | 提取项 | 来源章节关键词 |
   |-------|--------------|
   | 页面/视图 | views、页面组件、路由 |
   | API | RESTful、Controller |
   | 数据表 | CREATE TABLE、数据库设计 |
   | 微前端 | microapp_name、route_prefix |

3. **技术栈映射**

   ```
   模块名 → [front-end | back-end | database] → 设计文档章节号
   ```

4. **依赖顺序**

   ```
   database → back-end → front-end → qiankun 联调
   ```

## 缺陷检测清单

### 数据库

- [ ] 每张业务表有 `id`、`created_at`、`updated_at`
- [ ] 外键 `{table}_id` + REFERENCES
- [ ] 频繁查询字段有索引
- [ ] JSONB 需查询时有 GIN 索引

### API

- [ ] 端点有方法、路径、请求/响应结构
- [ ] 写操作有鉴权说明
- [ ] 响应格式 `{ code, message, data }`

### 微前端

- [ ] `microapp_name`、`route_prefix` 与主库登记一致
- [ ] entry / basename 有说明
- [ ] 生命周期 hooks 有描述

### 前端

- [ ] 页面清单与路由对应
- [ ] `VITE_API_BASE`、`VITE_DEV_PORT` 有定义

### 端口

- [ ] 与 [应用端口与命名注册表](../../../docs-project/应用端口与命名注册表.md) 一致
- [ ] 独立 `POSTGRES_DB`，未与其他应用混连

## 缺陷报告

写入 `error/report.md`：

```markdown
# 设计缺陷报告

| 类型 | 描述 | 位置 | 建议 |
|------|------|------|------|
| missing_field | 缺少 updated_at | novels 表 | 添加 TIMESTAMP |
```

## 任务目录模板

```
tasks/{模块名}/
  README.md
  front-end/    # 可选
  back-end/     # 可选
  database/     # 可选
```
