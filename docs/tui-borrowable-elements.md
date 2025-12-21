# TUI 可借鉴元素分析

## 概述

通过对 Ouroboros Python TUI 的深入分析，识别出以下可用于 VS Code Extension 的设计元素和模式。

---

## 1. 视觉设计元素

### 1.1 Mystic Purple 主题色

| 颜色名称 | ANSI 码 | 用途 |
|:--------|:--------|:----|
| **Border** | `\x1b[95m` (Magenta) | 边框、蛇身 |
| **Prompt** | `\x1b[96m` (Cyan) | 提示符、蛇舌 |
| **Success** | `\x1b[92m` (Green) | 确认、提交成功 |
| **Warning** | `\x1b[93m` (Yellow) | 快捷键高亮 |
| **Error** | `\x1b[91m` (Red) | 取消、错误 |
| **Accent** | `\x1b[95m\x1b[1m` (Bold Magenta) | 强调 |
| **Dim** | `\x1b[90m` (Gray) | 辅助信息 |

**Extension CSS 转换：**
```css
:root {
  --ouroboros-border: #c792ea;
  --ouroboros-prompt: #89ddff;
  --ouroboros-success: #c3e88d;
  --ouroboros-warning: #ffcb6b;
  --ouroboros-error: #ff5370;
  --ouroboros-accent: #c792ea;
  --ouroboros-dim: #676e95;
}
```

### 1.2 Box Drawing 字符

```
╭──◎ OUROBOROS──────────────────╮  (rounded corners)
│ Content                        │
├────────────────────────────────┤  (separator)
│ ▸ Selected option              │  (selection indicator)
│   Normal option                │
╰── Ctrl+D: submit ─── Ln 1 ───╯  (status in border)
```

**Codicons 映射：**
- `▸` → `$(chevron-right)`
- `◎` → `$(circle-large)` 或自定义 SVG
- `↑/↓` → `$(arrow-up)` / `$(arrow-down)`
- `✓` → `$(check)`

---

## 2. 交互模式

### 2.1 六种运行模式 (from `ouroboros_input.py`)

| 模式 | 检测条件 | Extension Tool |
|:----|:--------|:--------------|
| `pipe` | stdin 是管道 | N/A (不适用) |
| `selection` | `--options` 参数 | `ouroboros_menu` |
| `menu` | header 包含编号选项 | `ouroboros_menu` |
| `header` | 有 header 无选项 | `ouroboros_ask` |
| `prompt` | 有 prompt 参数 | `ouroboros_ask` |
| `ccl` | 默认 | `ouroboros_ask` |

### 2.2 选择菜单导航 (from `selection_menu.py`)

| 按键 | 功能 |
|:-----|:-----|
| `↑/↓` | 上下移动 |
| `PgUp/PgDn` | 翻页 |
| `Home/End` | 跳转首尾 |
| `1-9` | 数字快速选择 |
| `Enter` | 确认选择 |

**Extension 实现：** Webview 中用 `<select>` 或自定义列表 + JS 键盘监听。

### 2.3 滚动指示器

```
↑ 3 more above
[visible content]
↓ 5 more below
```

**Extension 实现：** 在 Webview 列表顶部/底部显示 `$(chevron-up)` / `$(chevron-down)` + 数字。

---

## 3. 状态显示

### 3.1 Status Bar (from `status_bar.py`)

```
╰── Ctrl+D: submit ─────────────────── Ln 1, Col 5 ──╯
```

**包含信息：**
- Mode: `INPUT` / `PASTE` / `HISTORY` / `SEARCH`
- Hint: `Ctrl+D: submit`
- Cursor: `Ln X, Col Y`
- Scroll: `[1-5/10]`

**Extension 实现：** 在 Sidebar 底部或状态栏显示。

### 3.2 输入框头部 (from `input_box.py`)

```
╭──◎ INPUT──────────D:\project\path──╮
```

**包含信息：**
- 模式图标 (`◎` 或 `◇`)
- 模式标签 (`INPUT` 或自定义 header)
- 当前工作目录

---

## 4. 特殊功能

### 4.1 Badge 系统 (from `input_box.py`, `badge.py`)

| 原始文本 | 显示 Badge |
|:--------|:----------|
| `«/path/to/file.txt»` | `[ file.txt ]` |
| `‹PASTE:5›...‹/PASTE›` | `[ Pasted 5 Lines ]` |

**Extension 实现：** 在 Webview 中渲染为可点击的 pill/tag。

### 4.2 Paste 检测 (from `app.py`)

- 检测多字符快速输入（>5 events in buffer）
- 自动进入 PASTE 模式
- 创建 Paste Badge

**Extension 实现：** 通过 `paste` 事件检测，自动包装为 Badge。

### 4.3 Slash 命令 (from `app.py`)

- 输入 `/` 触发下拉菜单
- Tab 补全
- 支持 5 个命令：`/ouroboros`, `/spec`, `/implement`, `/init`, `/archive`

**Extension 实现：** 可能不需要，VS Code 已有 `@ouroboros` 语法。

### 4.4 History 导航 (from `app.py`)

- 首行使用 `↑/↓` 浏览历史
- `Ctrl+R` 反向搜索

**Extension 实现：** 保存历史到 `workspaceState`，Webview 支持历史浏览。

---

## 5. 退出动画

```typescript
// from app.py: show_goodbye_animation()
const goodbyeFrames = [
  "♾️  Goodbye...",
  "♾️  See you soon~",
  "🐍 The serpent rests..."
];
```

**Extension 实现：** 可选，作为 easter egg 在关闭 Sidebar 时显示。

---

## 6. 输出反馈 (from `output.py`)

```
╭─────────────────────────────────────────────────────────╮
│ [>] TRANSMITTED                                          │
├─────────────────────────────────────────────────────────┤
│ ✓ Transmitted 15 lines (423 chars) to Copilot           │
│                                                          │
│ [Preview truncated content...]                           │
╰─────────────────────────────────────────────────────────╯
```

**Extension 实现：** 在 Webview 中显示提交确认 + 内容预览。

---

## 7. 建议借鉴优先级

### 必须借鉴 (P0)

1. **Mystic Purple 主题色** → CSS 变量
2. **选择菜单导航** → Webview 列表交互
3. **Status Bar 信息格式** → Sidebar 底部状态
4. **OutputBox 反馈** → 提交确认视图

### 推荐借鉴 (P1)

5. **Badge 系统** → 文件/粘贴 pill 渲染
6. **滚动指示器** → 长列表视觉提示
7. **模式指示** → 明确当前状态

### 可选借鉴 (P2)

8. **退出动画** → Easter egg
9. **History 导航** → 历史浏览
10. **Box Drawing 风格** → 视觉一致性

---

## 8. 文件参考

| TUI 文件 | 可借鉴内容 |
|:--------|:----------|
| `theme.py` | 颜色定义 |
| `selection_menu.py` | 导航逻辑 |
| `status_bar.py` | 状态格式 |
| `input_box.py` | Badge 处理 |
| `output.py` | 反馈 UI |
| `app.py` | 模式切换 |
