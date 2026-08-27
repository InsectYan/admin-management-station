# 清新森林风 — 可行样式规范（v3）

> **定位**：管理后台里的「清新森林」——叶绿为主、表面半透明、各页底部勾勒不同自然景观。  
> **不是**：厚虚线描边、金紫渐变、羊皮纸/符文全铺、Element 默认蓝。

旧版文档中的纹理 URL、魔法阵导航、水晶柱图表、琥珀金主色等方案**一律废弃**，以本文与 `frontend/src/styles/variables.css` 为唯一事实来源。

---

## 0. 设计原则（先读）

| 原则 | 做法 | 禁止 |
|------|------|------|
| 绿为主 | 主色、链接、激活态、进度均用清新叶绿 | 琥珀金当主色；靛蓝/魔法紫当背景；Element `#409eff` |
| 背景要淡 | 页面浅灰绿；卡片/按钮用半透明白，让景观透出 | 饱和 `#228B22` 大块底；米黄羊皮纸大面积铺 |
| 边框要细 | `1px solid` + 低透明度绿 | `2px dashed` 金色；全站虚线框 |
| 景观勾勒 | 各页底部低透明度 SVG 线稿（草甸 / 林木 / 湖畔） | 高饱和风景插画、全屏纹理、抢正文对比度 |
| 渐变要弱 | 仅作「雾感」洗色（同色相、极低对比） | 45° 金→黄、紫→蓝径向「魔法」渐变 |
| 光效要静 | Focus 用淡绿描边环；悬停轻微提亮 | 常驻 `box-shadow` 金色光晕、无限闪烁 |
| 装饰要少 | 左侧 2～3px 色条、步骤圆点即可 | 符文边框、藤蔓背景图、每块都贴纹 |

**一句话**：奇幻感来自**色相与留白**，不是来自描边粗细和渐变数量。

---

## 1. 色彩令牌

### 1.1 主色与语义

| 角色 | Token | 色值 | 用途 |
|------|--------|------|------|
| 主色 | `--novel-color-primary` | `#2F8A5B` | 主按钮、链接、步骤激活、关键强调 |
| 主色悬停 | `--novel-color-primary-hover` | `#3A9D6A` | hover |
| 主色浅底 | `--novel-color-primary-muted` | `rgba(47,138,91,.10)` | 标签底、选中行、弱强调块 |
| 成功 | `--novel-color-success` | `#2F8A5B` | 与主色对齐 |
| 警告 | `--novel-color-warning` | `#B8953A` | 仅告警/待处理（稀疏） |
| 危险 | `--novel-color-danger` | `#B85C5C` | 删除、错误 |
| 信息/雾青 | `--novel-color-moon` | `#6D8A82` | 次要状态、时间轴 |

**点缀琥珀金** `#B8953A`：只允许出现在「完成勾选 / 稀有徽章」等 1～2 处，**禁止**做边框色、禁止铺渐变。

**已删除**：魔法紫 `#4B0082`、森林饱和绿 `#228B22`、羊皮纸黄 `#F5DEB3` 作大面积底。

### 1.2 表面与文字

| 角色 | Token | 色值 | 用途 |
|------|--------|------|------|
| 页面底 | `--novel-color-bg` | `#F3F8F4` | 内容区背景 |
| 卡片面 | `--novel-color-surface` | `rgba(255,255,255,.62)` | 表单卡、列表卡（透景观） |
| 抬升面 | `--novel-color-surface-elevated` | `rgba(255,255,255,.82)` | 弹层、粘性头 |
| 玻璃面 | `--novel-color-glass` | `rgba(255,255,255,.42)` | 默认按钮、次级面板 |
| 柔和纸感 | `--novel-color-mist` | `rgba(240,247,242,.72)` | 步骤条底、次级面板 |
| 深墨 | `--novel-color-deep` | `#1F3D2C` | 标题 |
| 正文 | `--novel-color-text` | `#2C4336` | 正文 |
| 次文 | `--novel-color-text-secondary` | `#5C6B62` | 说明 |
| 弱文 | `--novel-color-text-muted` | `#8A968E` | 占位、hint |

兼容别名：`--novel-color-parchment` → 映射到 `--novel-color-mist`（旧类名可暂不改）。

### 1.3 边框 / 圆角 / 阴影

```text
--novel-border-subtle:  1px solid rgba(61, 107, 79, 0.12)
--novel-border-default: 1px solid rgba(61, 107, 79, 0.20)
--novel-border-strong:  1px solid rgba(61, 107, 79, 0.32)

--novel-radius-sm:   6px
--novel-radius-base: 10px

--novel-shadow-soft: 0 1px 2px rgba(42,58,48,.05), 0 6px 20px rgba(61,107,79,.05)
--novel-shadow-focus: 0 0 0 3px rgba(61,107,79,.16)
```

兼容：`--novel-border-gold`、`--novel-shadow-glow` **改为**上述 default / focus 的别名，避免组件漏改崩溃；新代码勿再使用「gold/glow」语义命名。

### 1.4 允许的「渐变」（雾洗）

```css
/* 页头 / 向导标题区：几乎看不见的绿雾 */
--novel-gradient-hero: linear-gradient(
  165deg,
  #E8F0EA 0%,
  #F4F7F4 42%,
  #FBFCFA 100%
);

/* 步骤条底：极淡同色相 */
--novel-gradient-steps: linear-gradient(
  90deg,
  rgba(61, 107, 79, 0.07),
  rgba(109, 138, 130, 0.05)
);

/* 主按钮：实色优先；若用渐变仅允许同色相 8% 以内明度差 */
--novel-gradient-btn: linear-gradient(180deg, #4F8463, #3D6B4F);
```

禁止：`radial-gradient(紫→蓝)`、`linear-gradient(金→黄)`、深棕 `#2E2B23` 表头大渐变。

---

## 2. 组件用法速查

### 2.1 页面壳

- 内容区背景：`--novel-color-bg`
- 标题：`--novel-color-deep`，字重 600～700，**无**重 `text-shadow`
- 副标题：`--novel-color-text-secondary`，14px

### 2.2 卡片 / 表单区

```css
.panel {
  background: var(--novel-color-surface);
  border: var(--novel-border-subtle);
  border-radius: var(--novel-radius-base);
  box-shadow: var(--novel-shadow-soft); /* 可选；勿叠 glow */
  padding: 20px;
}
```

需要分区时用 **左侧色条**，不用整圈虚线：

```css
.accent-block {
  border-left: 3px solid var(--novel-color-primary);
  background: var(--novel-color-primary-muted);
  padding: 12px 14px;
}
```

### 2.3 输入框

- 底：`#FFFFFF` 或 `--novel-color-surface-elevated`
- 边：`--novel-border-default`（实线）
- Focus：`--novel-shadow-focus`，边框加深到 `--novel-border-strong`
- Label：`--novel-color-text`，字重 500（**勿用紫色 label**）

### 2.4 按钮

| 类型 | 样式 |
|------|------|
| Primary | 叶绿雾 `rgba(47,138,91,.22)` + 深绿字 + 细绿边；hover 略加深 |
| Default | 玻璃白 `rgba(255,255,255,.42)` + 细绿边 + 深绿字 |
| Plain | 更淡的绿雾底，仍可读 |
| 禁止 | 金黄 45° 渐变底、Element 默认蓝、木质纹理图、2px 金虚线 |

### 2.5 步骤条（创作向导）

- 容器：`--novel-color-mist` + `--novel-gradient-steps`（极淡）+ `--novel-border-subtle`
- 未激活：透明底 + 次文色
- 激活 / 已完成：白面 + `--novel-border-strong` + 主色序号圆
- **取消** 紫径向底、常驻 `novel-glow` 闪烁；激活仅用实色圆点即可

### 2.6 表格 / 列表

- 表头：`--novel-color-mist`，文字 `--novel-color-deep`（勿深棕渐变）
- 行分隔：`1px solid rgba(61,107,79,.08)`
- 斑马纹（可选）：`rgba(61,107,79,.03)`

---

## 3. 动效（克制）

允许：

- 步骤切换：`opacity` + 轻微 `translateY(4px)`，≤ 0.3s
- Focus / hover：颜色与阴影过渡 0.2s

禁止：

- 无限 `brightness` 脉冲（旧 `novel-glow`）
- 藤蔓生长、落叶、精灵环绕等叙事动画（后台场景不合适）

`prefers-reduced-motion: reduce` 时关闭动画。

---

## 4. Element Plus 覆写约定

- 所有覆写挂在 `.novel-sub-root` 下，不污染主应用。
- Primary 映射到 `--novel-color-primary`（绿），不是金。
- Success / Info 与森林绿、雾青对齐；Danger 用柔和红，避免荧光。

实现文件：

- `frontend/src/styles/variables.css` — 令牌
- `frontend/src/styles/element-override.css` — 输入/按钮/表格
- `frontend/src/styles/forest-motion.css` — 仅保留淡入
- `frontend/src/styles/landscapes.css` — 分页面景观勾勒

---

## 6. 分页面自然景观

内容区底部用**低透明度线稿 SVG**勾勒景观，不参与点击、不盖正文。由 `MainLayout` 按路由名切换 class。

| 页面 | 路由 | class | 景观 |
|------|------|-------|------|
| 小说列表 | `novel-list` | `novel-scene--meadow` | 林间草甸（远丘 + 疏林 + 草叶） |
| 创建向导 | `novel-create` | `novel-scene--grove` | 晨雾远山 / 林木 |
| 小说详情 | `novel-detail` | `novel-scene--lake` | 湖畔倒影 + 芦苇 |

资源：`frontend/src/assets/decorations/scene-*.svg`。描边色与主色同相，整体透明度约 16～22%，**禁止**改成高饱和插画。

---

## 7. 反模式清单（Code Review 用）

若 PR 中出现下列任一项，直接打回：

1. `2px dashed` + 金色 / `#d4a017` 边框大面积使用  
2. `linear-gradient(..., #ffd700)` 或紫蓝 `radial-gradient` 作区块底  
3. `box-shadow: 0 0 10px rgba(212, 160, 23, …)` 常驻光晕  
4. Label / 标题使用 `#4b0082`  
5. 背景使用饱和 `#228b22` 或深蓝 `#2B1F4F`（与 `docs-project/创建小说页.md` 旧方案冲突，以本文为准）  
6. 为「奇幻」引入未落地的纹理 PNG / border-image 符文  

7. 使用 Element 默认蓝 `#409eff` 作侧栏、封面占位或激活色  

---

## 8. 与历史文档的关系

| 文档 | 状态 |
|------|------|
| 本文 + `variables.css` | **现行** |
| `docs/create.md` 中深蓝紫渐变、符文导航、火焰进度条 | 视觉描述作废；布局结构可参考 |
| `docs-project/创建小说页.md` 深蓝+金方案 | 作废；流程步骤结构可参考 |
| 下文「附录」中旧组件伪代码 | 仅作考古，勿照抄 |

---

## 附录 A — 令牌落地

以 `frontend/src/styles/variables.css` 为准。核心摘录：

```css
.novel-sub-root {
  --novel-color-primary: #2f8a5b;
  --novel-color-primary-hover: #3a9d6a;
  --novel-color-primary-muted: rgba(47, 138, 91, 0.1);
  --novel-color-bg: #f3f8f4;
  --novel-color-surface: rgba(255, 255, 255, 0.62);
  --novel-color-glass: rgba(255, 255, 255, 0.42);
  --novel-color-deep: #1f3d2c;
  --novel-border-default: 1px solid rgba(47, 138, 91, 0.2);
}
```

## 附录 B — 旧规范摘要（勿用）

旧 v1 曾定义：主色琥珀金 `#D4A017`、魔法紫、`2px dashed` 金边、紫蓝径向步骤底、木质按钮纹理、羊皮纸全铺、符文/精灵/火焰动效。实现后表现为「粗线条 + 无脑渐变」，与「清新森林、绿为主、表面透明」目标相反，故整章废弃。
