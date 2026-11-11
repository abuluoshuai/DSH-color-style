# DSH-color-style

为 DeepSeek Harness（DSH）Web GUI 提供的配色方案插件：把 Markdown 阅读器 [Tinta](https://github.com/oipoistar/tinta) 的十种阅读配色完整搬进主窗口。

## 功能

- **整个窗口背景跟随配色方案** —— 通过 `ctx.theme.overrideTokens` 覆盖整套 `--dsw-*` 设计令牌（窗口画布、侧栏、输入框、菜单、滚动条、气泡、diff 等），并额外注入一条 `html/body` 背景色兜底。
- **主窗口渲染的 Markdown 跟随配色方案** —— Markdown 容器、标题、链接、行内代码、引用块、代码块背景、Shiki 语法高亮（关键字/字符串/注释/数字/函数/类型/控制流）全部落在方案色上；对 CSS Module 哈希类名使用结构化选择器（`[class*="_markdown_"]`）兜底，不依赖构建哈希。
- **侧栏主区文字与图标跟随方案的标题色（H1）** —— 品牌区（鲸鱼标、deepseek 字标、HARNESS 徽章）、「新会话」按钮与主导航行（插件 / Plugin Hub / 自动化任务 / 待办 / ComfyUI / 更多）的文字与图标取方案的 `heading` 色；选择器按 `ui-sidebar` 的 SidebarRoot 类名后缀（`_logoRow`、`_brandMark`、`_newSession`、`_panelRow` 等） containment 匹配，不依赖构建哈希。工作区列表、页脚与设置区不受影响。
- **侧栏工作区与会话列表、会话头部、输入区跟随标题色** —— 在 `_railIn`（侧栏内容容器）、会话头部各结构行（面包屑 / 标题行 / 视图页签 / 右上角工具）与 `_composerSeat` / `_dock`（输入框工具行与状态胶囊条）上把 `--dsw-alias-label-*` 令牌局部重指向标题色：自定义属性沿级联生效，容器内所有读令牌的元素（会话行、时间戳、搜索框、权限 / 模型 chip、状态胶囊、第三方 dock 组件）自动跟随，弹层菜单传送到 body 之外不受影响。Windows 原生菜单条（应用 / 编辑）与系统窗口按钮为 OS 绘制，页面 CSS 无法触达。
- **设置页独立的「配色方案」页** —— 以 `settings.section` 贡献注册，在设置导航里有自己的入口和图标；页内以卡片预览（背景 + 标题色 + 强调色点 + 代码底色）展示十种方案：双列排布，左列为五个浅色方案，右列为按色系一一对应的五个深色方案（暖调纸卷↔余烬、樱色樱雪↔德古拉、蓝色冰原↔午夜、绿色草甸↔幽林、暮光↔深渊），点击即换，支持一键「恢复默认外观」。

## 界面预览

设置 → 配色方案 页：十个方案以固定双列排布，左列为五个浅色方案，右列为按色系一一对应的五个深色方案。

![配色方案设置页：左列浅色、右列深色的双列卡片](docs/settings-page.png)

每张卡片内是方案本身的实时预览：背景与边线取方案底色，「Aa」用方案的标题色，右侧五个圆点依次是强调色、链接色、字符串、函数与控制流的语法高亮色，底部横条为代码块底色。
当前选中的方案（截图中为「余烬」）带强调色描边；页面底部提供「恢复默认外观」一键退出方案层，回到 DSH 内置外观。

## 十种配色

| 方案 | 明暗 | 背景 | 主文字 | 强调色 |
| --- | --- | --- | --- | --- |
| 纸卷 Paper | 浅色 | `#F5F1E8` | `#3D3329` | `#B85A3C` |
| 樱雪 Sakura | 浅色 | `#FDF8F8` | `#404040` | `#C44569` |
| 冰原 Arctic | 浅色 | `#F7FAFC` | `#2D3748` | `#2B6CB0` |
| 草甸 Meadow | 浅色 | `#F7FAF7` | `#1A2F1A` | `#2F855A` |
| 暮光 Dusk | 浅色 | `#FFFBF5` | `#553C10` | `#A66A12` |
| 午夜 Midnight | 深色 | `#0D1B2A` | `#E0E1DD` | `#38C6E4` |
| 德古拉 Dracula | 深色 | `#282A36` | `#F8F8F2` | `#BD93F9` |
| 幽林 Forest | 深色 | `#0D1512` | `#B8C5B2` | `#68D391` |
| 余烬 Ember | 深色 | `#1A1614` | `#D4C5B9` | `#F1975A` |
| 深渊 Abyss | 深色 | `#000000` | `#EDEDED` | `#2EE6CF` |

色值逐字取自 [Tinta](https://github.com/oipoistar/tinta)（oipoistar/tinta）Markdown 阅读器的 `THEMES[]` 表（含 2026-08 语法色微调）。

## 透明度安全

插件**不注入任何覆盖层**：没有全屏遮罩、没有 `position: fixed` 层、不改 `pointer-events`。
背景只落在已存在的元素上（`html`/`body` 的 `background-color` 与设计令牌），不会挡住任何点击；
菜单/提示/弹层的填充保持原有的半透明合成（`alpha()` 计算），毛玻璃与悬浮层依旧可用。

## 安装

```sh
dsh plugin --profile web add dsh-color-style
```

装完刷新一次页面。下面的桌面 profile 手动链接方式适合本地开发。

## 安装（桌面 profile，本地开发）

1. 把本目录链接进 profile 的 `node_modules`（Windows 目录联接即可，无需管理员）：

   ```
   mklink /J "%DSH_PROFILE%\node_modules\dsh-color-style" "E:\DSH\插件开发\DSH-color-style"
   ```

2. 在 `profiles/desktop/package.json` 里加依赖与 bundle：

   ```json
   {
     "dependencies": { "dsh-color-style": "link:E:/DSH/插件开发/DSH-color-style" },
     "dsh": { "profile": { "bundles": [ "dsh-color-style" ] } }
   }
   ```

3. 重启 DSH。旧 tinta-themes 的选中记录会自动迁移到本插件。

## 选择持久化

选中的方案 id 存在浏览器 `localStorage`（`dsh.color-style.active`）。第三方主题 id 不进入 Host 设置 schema，
这是 dsh-client-ui-theme 文档明确的边界。选中某个方案后，该方案同时「拥有」外观的明暗模式：
如果外观被外部改走，插件会把模式拉回方案自身的明暗（上限 5 次，防止 Host 拒绝写入时打转）；
「恢复默认外观」会彻底退出方案层。

## 开发

```
npm run check   # 语法检查（node --check）
npm test        # 冒烟测试（stub 掉 window/document 与 theme/slots/locale 服务）
```

测试覆盖：启动即应用已选方案、令牌层与兜底样式表内容、旧 tinta 记录迁移、外观被外部翻转后的「粘性」拉回、
重置后的完全退出、设置页十张卡片渲染与点击选方案。

## 来源与致谢

十种配色方案提取自 **[Tinta](https://github.com/oipoistar/tinta)** —— 一款 Windows 桌面 Markdown 阅读器，
本插件的全部色值（背景 / 正文 / 标题 / 链接 / 行内代码 / 代码块 / 引用边线 / 语法高亮）均来自其 `src/themes.cpp` 的 `THEMES[]` 定义，逐字保留。
感谢原作者的配色设计。

## License

MIT