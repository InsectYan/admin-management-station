# 设计文档分析与缺陷检测

## 分析步骤

1. **识别应用类型**
   - 含「主应用」「菜单系统」「Qiankun 基座」→ 主应用
   - 含「子应用」「微前端集成」「basename」→ 子应用

2. **提取模块清单**

   | 提取项 | 来源章节关键词 |
   |-------|--------------|
   | 页面/视图 | 交互流程、页面组件、views |
   | API 端点 | API 接口、Controller、RESTful |
   | 数据表 | 数据库设计、CREATE TABLE |
   | 微前端 | microapp_name、route_prefix、activeRule |
   | 状态/通信 | IPC、事件总线、全局状态 |

3. **生成技术栈映射**

   ```
   模块名 → [front-end | back-end | database | qiankun] → 设计文档章节号
   ```

4. **确定依赖顺序**

   ```
   database → back-end → front-end → qiankun 联调
   ```

## 缺陷检测清单

### 数据库

- [ ] 每张业务表有 `id`、`created_at`、`updated_at`
- [ ] 外键字段命名 `{table}_id`，有 REFERENCES 约束
- [ ] 频繁查询字段有索引说明
- [ ] JSONB 字段有 GIN 索引（若需 JSON 查询）

### API

- [ ] 每个端点有 HTTP 方法、路径、请求/响应结构
- [ ] 写操作有鉴权/权限说明
- [ ] 响应格式与 Egg 规范一致（`code/message/data`）

### 微前端

- [ ] 一级菜单 ↔ 子应用映射明确（`microapp_name`）
- [ ] `route_prefix` 与 `activeRule`、`basename` 一致
- [ ] 子应用 entry URL（开发/生产）有说明
- [ ] 生命周期钩子（bootstrap/mount/unmount）有描述

### 前端

- [ ] 页面清单与路由对应
- [ ] API 基址与环境变量（`VITE_API_BASE`、`VITE_DEV_PORT`）有定义
- [ ] 子应用独立运行与嵌入模式的 basename 策略

### 端口与多应用隔离

- [ ] 已在 [应用端口与命名注册表](../../docs-project/应用端口与命名注册表.md) 登记或核对 `app_key`
- [ ] API 端口、Vite dev 端口、Docker 映射端口互不冲突
- [ ] 各 BFF 使用独立 `POSTGRES_DB`，未与其他应用混连
- [ ] Qiankun `entry` 使用子应用 dev 端口，非主应用 API 端口

## 缺陷报告格式

写入 `error/report.md`：

```markdown
# 设计缺陷报告

| 类型 | 描述 | 位置 | 建议 |
|------|------|------|------|
| missing_field | 缺少 updated_at | novels 表 | 添加 TIMESTAMP 字段 |
| missing_schema | 缺少请求体定义 | POST /api/menus | 补充 JSON Schema |
```

## 任务目录模板

```
tasks/{模块名}/
  README.md
    - 设计文档引用（文件 + 章节）
    - 验收标准
    - 依赖任务
    - 适用规范（.cursor/rules/ 文件名）
  front-end/    # 可选
  back-end/     # 可选
  database/     # 可选
```
