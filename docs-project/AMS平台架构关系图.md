# admin-management-station 平台架构与关系图

> 更新：2026-07-02  
> 范围：主应用 `menu-master`、子应用聚合 `project-sub/`、外部 Agent 平台协作关系  
> 测试平台评分 → [项目评分与后续计划.md](../project-sub/testgen-sub/docs/项目评分与后续计划.md)

**图例**：<span style="color:#2563EB">■ 前端/浏览器</span> · <span style="color:#16A34A">■ BFF 服务</span> · <span style="color:#D97706">■ 数据库</span> · <span style="color:#9333EA">■ Agent</span> · <span style="color:#64748B">■ 子应用</span>

---

## 1. 两项目关系总览

`admin-management-station`（AMS）是**私人管理平台 monorepo**，采用 Qiankun 微前端架构。`testgen-sub` 不是独立仓库，而是内嵌于 `project-sub/testgen-sub/` 的自包含子应用。

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'fontSize':'20px'}}}%%
flowchart TB
    classDef mono fill:#1E3A8A,stroke:#1E40AF,stroke-width:2px,color:#fff
    classDef main fill:#DBEAFE,stroke:#2563EB,stroke-width:2px,color:#1E3A8A
    classDef sub fill:#DCFCE7,stroke:#16A34A,stroke-width:2px,color:#14532D
    classDef highlight fill:#FEF3C7,stroke:#D97706,stroke-width:3px,color:#78350F
    classDef agent fill:#F3E8FF,stroke:#9333EA,stroke-width:2px,color:#581C87

    AMS["admin-management-station<br/>monorepo"]:::mono
    AMS --> MM["menu-master<br/>基座 · :5100/:5200"]:::main
    AMS --> PS["project-sub/"]:::sub
    PS --> Novel["novel-sub<br/>:5101/:5201"]:::sub
    PS --> Testgen["testgen-sub ★<br/>:5102/:5202"]:::highlight
    AMS --> Docs["docs-project/"]:::main
    AMS --> Skills["skills/ Cursor 开发流程"]:::main

    Browser["浏览器 /media/testgen/*"]:::main
    Browser --> Testgen
    Testgen -->|"agentProxy"| Agent["agent-management-master :4001"]:::agent
    Agent --> Plugins["agent-management-sub/plugins/"]:::agent
```

| 维度 | admin-management-station | testgen-sub |
|------|------------------------|-------------|
| 定位 | 多应用聚合基座 | AI 测试平台业务子应用 |
| 物理关系 | 父仓库 | `project-sub/testgen-sub/` 子目录 |
| 前端端口 | 5100（基座） | 5102（独立 Vite） |
| BFF 端口 | 5200 | 5202 |
| 数据库 | `admin_platform` | `testgen_db` |
| 注册方式 | 扫描 `subapp.manifest.json` | 提供 manifest，由主应用 sync |
| Agent 能力 | 不内嵌 | 通过 BFF `agentProxy` 调外部平台 |

---

## 2. 系统架构交互图

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'fontSize':'20px','lineColor':'#64748B'}}}%%
flowchart TB
    classDef browser fill:#DBEAFE,stroke:#2563EB,stroke-width:2px,color:#1E3A8A
    classDef main fill:#EFF6FF,stroke:#2563EB,stroke-width:2px,color:#1E40AF
    classDef bff fill:#DCFCE7,stroke:#16A34A,stroke-width:2px,color:#14532D
    classDef db fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#78350F
    classDef sub fill:#E0E7FF,stroke:#6366F1,stroke-width:2px,color:#3730A3
    classDef agent fill:#F3E8FF,stroke:#9333EA,stroke-width:2px,color:#581C87

    UI["👤 用户界面"]:::browser

    subgraph AMS["admin-management-station"]
        subgraph Main["menu-master · :5100/:5200"]
            MF["Qiankun 基座<br/>MainLayout + AppSider"]:::main
            MainBFF["Egg BFF<br/>菜单 / LLM Profile"]:::bff
            MainDB[("PostgreSQL<br/>admin_platform")]:::db
        end

        subgraph SubApps["project-sub/"]
            Novel["novel-sub<br/>:5101/:5201"]:::sub
            Testgen["testgen-sub<br/>:5102/:5202"]:::sub
            NovelDB[("novel_db")]:::db
            TestgenDB[("testgen_db")]:::db
        end
    end

    subgraph AgentLayer["agent-management-master · :4001"]
        AM["Skill 路由 / LLM / Scheme"]:::agent
        Plugins["plugins/<br/>testgen-skill 等"]:::agent
    end

    UI --> MF
    MF -->|"/media/novel/*"| Novel
    MF -->|"/media/testgen/*"| Testgen
    MF --> MainBFF --> MainDB
    Novel --> NovelDB
    Testgen --> TestgenDB
    Testgen -->|"agentProxy"| AM --> Plugins
    Plugins -->|"internal API + Token"| Testgen

    style Main fill:#EFF6FF,stroke:#2563EB,stroke-width:2px
    style SubApps fill:#F0FDF4,stroke:#16A34A,stroke-width:2px
    style AgentLayer fill:#FAF5FF,stroke:#9333EA,stroke-width:2px
```

---

## 3. 微前端加载流程

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'fontSize':'20px','actorFontSize':'20px','noteFontSize':'18px','messageFontSize':'18px','actorBkg':'#DBEAFE','actorBorder':'#2563EB'}}}%%
sequenceDiagram
    autonumber
    participant U as 👤 用户
    participant M as 🖥 menu-master :5100
    participant B as ⚙ main BFF :5200
    participant Q as 🔗 Qiankun
    participant T as 📦 testgen 前端 :5102
    participant TB as ⚙ testgen BFF :5202

    U->>M: 访问 /media/testgen/projects
    M->>B: GET /api/menus
    B-->>M: 菜单含 testgen-app entry
    M->>Q: registerMicroApps(testgen-app)
    Q->>T: 加载 http://localhost:5102
    T-->>M: 挂载到 #subapp-container
    Note over T,TB: basename=/media/testgen<br/>API 独立指向 :5202
    U->>T: 操作测试平台页面
    T->>TB: /api/* 请求
    TB-->>T: 业务数据
```

**关键配置文件**

| 文件 | 作用 |
|------|------|
| `project-sub/testgen-sub/subapp.manifest.json` | 子应用注册元数据 |
| `menu-master/deploy/scripts/sync-subapps.mjs` | 启动时扫描 manifest 写入主库 |
| `menu-master/frontend/src/qiankun/config.js` | entry 映射 `testgen-app` |
| `testgen-sub/frontend/src/services/apiConfig.js` | 嵌入时 API 绝对 URL → 5202 |

---

## 4. 主应用前端页面与路由

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'fontSize':'20px'}}}%%
flowchart LR
    classDef main fill:#DBEAFE,stroke:#2563EB,stroke-width:2px,color:#1E3A8A
    classDef sub fill:#DCFCE7,stroke:#16A34A,stroke-width:2px,color:#14532D

    subgraph MainFrontend["menu-master 前端"]
        Home["/  HomeWelcome"]:::main
        Media["/media/:pathMatch*<br/>SubAppContainer"]:::main
    end

    subgraph SubRoutes["子应用路由 Qiankun 内"]
        NovelRoutes["/media/novel/novels..."]:::sub
        TestgenRoutes["/media/testgen/projects..."]:::sub
    end

    Home --> Media
    Media --> NovelRoutes
    Media --> TestgenRoutes
```

| 路由 | 组件 | 说明 |
|------|------|------|
| `/` | `HomeWelcome.vue` | 欢迎页 |
| `/media/:pathMatch(.*)*` | `SubAppContainer.vue` | Qiankun 子应用挂载点 |

**布局组件**：`MainLayout.vue` · `AppSider.vue` · `LlmProfileSelector.vue`

---

## 5. 主应用数据库表

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'fontSize':'20px'}}}%%
erDiagram
    menu_items ||--o{ menu_items : "parent_id"
    menu_items {
        int id PK
        string title
        string path
        string entry
        string microapp_name
        int parent_id FK
        int sort_order
        boolean enabled
    }
    subapp_registry {
        int id PK
        string app_key UK
        string microapp_name
        string display_name
        string route_prefix
        string entry_dev
        string entry_prod
        int vite_port
        int api_port
    }
```

| 表 | 用途 |
|----|------|
| `menu_items` | 树形侧栏菜单；子应用 sync 后自动写入一级入口 |
| `subapp_registry` | 子应用 entry、端口、路由前缀等注册信息 |

---

## 6. 主应用 API 结构

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'fontSize':'20px'}}}%%
flowchart LR
    classDef client fill:#DBEAFE,stroke:#2563EB,stroke-width:2px,color:#1E3A8A
    classDef route fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#78350F
    classDef svc fill:#DCFCE7,stroke:#16A34A,stroke-width:2px,color:#14532D

    Client["前端 / 外部"]:::client --> Router["router.js"]:::route
    Router --> Health["GET /api/health"]:::route
    Router --> Menu["/api/menus/*"]:::route
    Router --> LLM["GET /api/llm/profiles"]:::route

    Menu --> MenuSvc["service/menu.js"]:::svc
    Menu --> MenuItem["model/menu_item.js"]:::svc
    Menu --> SubappReg["model/subapp_registry.js"]:::svc
    LLM --> LlmSvc["service/llm.js"]:::svc
```

| API | 鉴权 | 说明 |
|-----|------|------|
| `GET /api/menus` | 公开 | 侧栏菜单树 |
| `POST/PUT/DELETE /api/menus` | admin JWT | 菜单 CRUD |
| `GET /api/llm/profiles` | 公开 | LLM 配置列表 |

---

## 7. 子应用对比

| 应用 | CLI | 前端 | BFF | PG | 业务域 |
|------|-----|:----:|:----:|-----|--------|
| novel-sub | `ams-novel` | 5101 | 5201 | 5301 / novel_db | 小说 CRUD |
| testgen-sub | `ams-testgen` | 5102 | 5202 | 5302 / testgen_db | 用例生成 + Fitness |

**自包含原则**：各应用自带 `deploy/docker-compose.yml`、独立 Postgres、独立 BFF；**不共享** frontend/backend 源码包。

---

## 8. 与 Agent 平台的三方协作

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'fontSize':'20px'}}}%%
flowchart LR
    classDef ams fill:#DCFCE7,stroke:#16A34A,stroke-width:2px,color:#14532D
    classDef agent fill:#F3E8FF,stroke:#9333EA,stroke-width:2px,color:#581C87

    subgraph AMSBox["admin-management-station"]
        TG["testgen-sub BFF :5202"]:::ams
    end

    subgraph AgentStack["Agent 栈 独立仓库"]
        Master["agent-management-master :4001"]:::agent
        Sub["agent-management-sub/plugins/"]:::agent
    end

    TG -->|"POST /api/skills/*/invoke"| Master
    Master --> Sub
    Sub -->|"GET/POST /api/internal/*"| TG
```

| 仓库 | 职责 |
|------|------|
| `admin-management-station` | UI + BFF + 业务 DB + 执行引擎 |
| `agent-management-master` | Skill 路由、LLM、Scheme 执行 |
| `agent-management-sub` | Skill 插件源码（testgen-skill 等） |

---

## 9. 开发 Skills（Cursor 流程，非运行时 Agent）

| Skill | 路径 | 用途 |
|-------|------|------|
| `main-app-developer` | `skills/main-app-developer/` | 主应用基座开发 |
| `sub-app-developer` | `skills/sub-app-developer/` | 子应用脚手架与 Qiankun 接入 |
| `novel-sub-developer` | `skills/project-developer/novel-sub/` | 小说子应用业务迭代 |
| `testgen-sub-developer` | `skills/project-developer/testgen-sub/` | 测试平台业务迭代 |

---

## 10. 启动与联调顺序

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'fontSize':'20px'}}}%%
flowchart TD
    classDef step fill:#DBEAFE,stroke:#2563EB,stroke-width:2px,color:#1E3A8A
    classDef final fill:#DCFCE7,stroke:#16A34A,stroke-width:3px,color:#14532D

    A["1️⃣ 启动 testgen<br/>ams-testgen local"]:::step
    B["2️⃣ 启动 Agent 平台<br/>agent-management-master :4001"]:::step
    C["3️⃣ 启动主应用<br/>ams-main local"]:::step
    D["4️⃣ 浏览器访问<br/>localhost:5100/media/testgen"]:::final

    A --> B --> C --> D
```

**端口注册表**：[`应用端口与命名注册表.md`](./应用端口与命名注册表.md)

---

## 11. 相关文档索引

| 文档 | 路径 |
|------|------|
| 仓库说明 | `README.md` |
| 主应用设计 | `docs-project/私人管理平台主应用设计.md` |
| 测试平台架构 | `project-sub/testgen-sub/docs/测试平台架构关系图.md` |
| **测试平台评分与计划** | `project-sub/testgen-sub/docs/项目评分与后续计划.md` |
| **测试平台文档索引** | `project-sub/testgen-sub/docs/README.md` |
| Agent Skill 说明 | `../agent-management-sub/README.md` |
| Agent 联调 | `project-sub/testgen-sub/docs/设计-Agent联调配置.md` |
