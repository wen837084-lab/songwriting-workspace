# Desktop Step 7 — Native polish verification

> 范围：system titlebar、window state、single instance、keyboard / IME / accessibility、external navigation、startup flash / focus / theme / reduced motion。  
> 不包含：自绘标题栏、tray、自动更新、文件关联、全局快捷键或后续发布功能。

## 1. 原生窗口与生命周期契约

- `main` 使用 Tauri 系统标题栏（`decorations: true`），保留系统最小化、最大化/缩放、关闭与窗口阴影；没有实现 HTML 伪标题栏。
- `tauri-plugin-window-state` 只恢复 `SIZE | POSITION | MAXIMIZED | FULLSCREEN`。不会恢复隐藏状态或 decorations，避免上次异常退出后窗口不可见或丢失系统标题栏。
- Window State 在 Single Instance 之后注册。第二次启动仍只显示、取消最小化并聚焦既有 `main` 窗口。
- macOS Dock `Reopen` 事件会重新显示并聚焦主窗口。
- 主窗口配置为初始隐藏；只有主页面 `PageLoadEvent::Finished` 后才显示并获取焦点，以避免空白 WebView 启动闪烁。
- 首次启动仍以配置尺寸居中；后续启动由插件恢复上次有效位置与尺寸。Tauri Window State 会处理不同 DPI/显示器下的恢复约束，但多显示器边缘情况仍需在目标平台实测。

## 2. 外部导航策略

主 WebView 只允许：

- `tauri://localhost`；
- 打包后的 `http(s)://tauri.localhost`；
- debug 构建的精确 `http://localhost:3000`。

`http`、`https`、`mailto` 与 `tel` 外部地址由系统默认应用打开，并取消主 WebView 导航。`file`、`data`、`javascript` 和其他未声明 scheme 直接阻止。该策略在 Rust 层执行，不给前端开放通用 shell、filesystem 或 opener 权限。

## 3. Keyboard、IME 与 accessibility

- 保留系统标题栏及系统窗口快捷键，不用 Web 层重写 Alt+F4、Command+W、最小化、最大化和窗口拖动。
- WebView 开启系统缩放快捷键，键盘用户可使用平台缩放操作；现有 UI 保留 `:focus-visible` 焦点环与语义化 button/link/form 控件。
- 新增“跳到主要内容”键盘入口，目标容器可程序化聚焦。
- 未新增会在 `keydown`、`beforeinput` 或 `composition*` 中改写文本的全局监听器；拼音、日文、韩文 IME 继续交给系统 WebView 原生输入链路。
- 桌面 chrome 使用系统字体栈；button / disclosure 不使用网页式手形 cursor。
- 增加 `forced-colors` 与 `prefers-contrast` 的基础兼容，但 Narrator / VoiceOver 完整走查必须在真实原生窗口完成。

## 4. Theme 与 reduced motion

- 页面声明 `color-scheme: light dark`，主题随系统 `prefers-color-scheme` 切换；没有新增持久化的应用内主题偏好。
- Light / Dark 的启动背景色与页面主题色均在首次样式计算前声明，窗口又在页面完成加载前保持隐藏，以减少启动与主题切换闪烁。
- `prefers-reduced-motion: reduce` 会关闭非必要 animation、transition 与 smooth scrolling。
- `prefers-contrast: more` 提高分隔线强度，Windows forced-colors 模式保留可见焦点轮廓。

## 5. 自动化验证

Rust 单元测试覆盖：

- 应用自身 production / development URL 留在主 WebView；
- Web、邮件与电话链接被分类为系统外部导航；
- `file`、`data` 与 `javascript` scheme 被阻止。

项目质量门禁应执行：

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
pnpm desktop:build
```

本次 Windows 验证结果：

| 检查 | 结果 |
| --- | --- |
| Tauri 项目审计 | 通过，0 failure；7 个 warning 均为本阶段不适用或既有文件规模提示 |
| `pnpm typecheck` | 通过 |
| `pnpm lint` | 通过 |
| `pnpm test` | 通过，99/99 |
| `pnpm build` | 通过 |
| `pnpm build:desktop` | 通过 |
| `cargo fmt --check` | 通过 |
| `cargo clippy --all-targets --all-features -- -D warnings` | 通过 |
| `cargo test` | 通过，3/3 Rust 导航策略测试 |
| `pnpm desktop:build` | 通过，生成 Windows x64 exe、MSI、NSIS |

有限原生进程验收：

- release 窗口标题为 `Songwriting Workspace`，窗口可见、位于前台且进程 `Responding: true`；
- 第二次启动后同一路径进程数保持 1，第二进程立即退出；
- 向系统标题栏发送正常 Close 后进程以 exit code 0 退出；
- `.window-state.json` 已写入 `main` 的尺寸、位置、最大化与全屏状态；
- 测试结束后没有留下运行中的 release 进程。

构建产物 SHA-256：

| 产物 | SHA-256 |
| --- | --- |
| `songwriting-workspace.exe` | `600E4B5CEF6AFD4B357CD9B8C31BFBBB32D77190B9D88CE893D5D3FFF80E8B5E` |
| `Songwriting Workspace_0.1.0_x64_en-US.msi` | `ED1D8E7E17F0C1440A2383D78F13353CA0B97AF2F7E9717611F81CC5FBF928F6` |
| `Songwriting Workspace_0.1.0_x64-setup.exe` | `548FC7CC1DB4270A584B83A3387764F53CAD463C3EA3AE35C6BCA4BC755151C4` |

## 6. 必须补做的原生人工验收

自动化和浏览器预览不能证明以下原生行为。发布前需在 Windows 与 macOS 分别完成：

1. 冷启动、深色冷启动均无白/黑闪，窗口显示后立即可接收键盘输入。
2. 调整位置、尺寸、最大化/全屏后完整退出并重启；断开第二显示器后窗口仍在可见工作区。
3. 最小化已有窗口后连续启动两次，人工确认已有窗口被取消最小化并获得前台键盘焦点（进程级单实例已自动验证）。
4. 系统标题栏拖动、最小化、最大化/缩放、关闭与平台快捷键行为正常。
5. 用拼音、日文假名、韩文输入法在所有主要文本框中输入、选词、回车与取消组合，候选窗位于光标附近且不会提前提交。
6. 只用键盘完成主要 Project 流程；用 Narrator / VoiceOver 检查名称、状态、焦点顺序与动态错误提示。
7. 点击 HTTPS / mailto / tel 测试链接，确认由系统应用打开且主窗口路由不变；尝试未允许 scheme，确认无反应。
8. 运行中切换系统 Light / Dark、High Contrast / forced colors 与 Reduce Motion，确认内容可读、焦点可见且没有非必要动画。

## 7. 已知限制

- 当前执行环境只能编译和自动检查 Windows 目标；macOS Dock Reopen、系统 zoom 行为与 VoiceOver 需要 macOS 设备验证。
- Window State 是本地机器状态，不跨设备同步。
- 没有加入自定义主题选择器；本 Step 的 theme 定义为跟随系统。
- 没有加入新窗口、原生对话框、系统通知、文件关联或自动更新，这些不属于 Desktop Step 7。
