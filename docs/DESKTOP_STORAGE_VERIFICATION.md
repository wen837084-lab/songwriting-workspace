# Desktop Step 4 — Storage verification

> 验证日期：2026-09-21  
> 平台：Windows 11 / Tauri 2 / WebView2  
> 范围：只验证现有 `localStorage` schema v15、IndexedDB 音频 Blob、桌面生命周期与迁移决策；不迁移到 filesystem 或 SQLite。

## 1. 当前持久化契约

| 数据 | 存储 | 版本/作用域 |
| --- | --- | --- |
| Workspace、Project、Learning 与结构化歌曲数据 | WebView `localStorage` | `schemaVersion: 15`；Project 数据按 `projectId` 分 key |
| Melody 录音二进制 | WebView `IndexedDB` | 数据库 `songwriting-workspace-audio` v1；Blob 按 `audioAssetId` 保存，并以 `projectId`、`[projectId, sectionId]` 建索引 |
| Melody Take 元数据 | `localStorage` 中的 Project | 只保存 `audioAssetId` 与展示元数据，不把 Blob/Base64 写入 `localStorage` |

桌面版继续复用浏览器存储边界。没有加入 filesystem、SQLite、云数据库或新的原生数据桥。

## 2. 自动化验证

`pnpm test` 覆盖以下 Desktop Step 4 场景：

- 新建并更新 schema v15 Project 后，以新的 Repository 实例模拟完整重启，数据仍可读取。
- 既有 v1–v14 数据按顺序迁移到 v15；v14→v15 保留 Project 数据并补齐 Review。
- 高于当前版本的 schema 拒绝写回，避免旧客户端损坏未来数据。
- IndexedDB 保存真实 `Blob`，以新的 Repository 实例重新打开后，Blob 内容与 MIME type 保持一致。
- IndexedDB 的 Project/Section 索引可读取；错误 `projectId` 被拒绝；按 Project 删除会清理资产。
- 数据库收到 `versionchange` 时主动关闭旧连接，避免后续 IndexedDB 升级被当前窗口阻塞。

## 3. 重启、升级与安装位置

桌面数据目录由固定 Tauri identifier `com.songwritingworkspace.desktop` 确定，不以 exe 或安装目录作为数据根。Windows 当前目录为：

```text
%LOCALAPPDATA%\com.songwritingworkspace.desktop\EBWebView
```

因此以下配置属于持久化兼容契约，发布后不能随意改变：

- `tauri.conf.json > identifier`
- 主 WebView label `main`
- `useHttpsScheme` 的当前默认值（未配置，即 `false`）
- IndexedDB database/store/index 名称
- `localStorage` key 前缀

只要这些值保持稳定，重启、覆盖升级以及把同一构建复制到另一安装位置时，都会继续使用同一 WebView 数据目录。改变 identifier 或 `useHttpsScheme` 会形成新的存储位置，必须被视为数据迁移事件。

本次 Windows 原生发布验证结果：

- `pnpm desktop:build` 成功生成 freshly built x64 MSI 与 NSIS bundle。
- release exe 可启动、关闭并再次启动；WebView 数据仍位于同一个 app-specific 目录。
- 将同一 release exe 复制到 `C:\Users\Public\SongwritingWorkspaceRelocated` 后作为主实例启动，仍读取同一个数据目录，且其中 schema v15 记录可见；验证后已删除临时副本。
- 从 release 路径运行主实例，再从 relocated 路径启动第二份 exe，进程数保持为 1；第二个进程退出，首个进程继续运行。
- 重新构建桌面 bundle 后，之前由桌面版创建的 schema v15 数据仍位于相同目录，没有因 build output 或 exe 路径变化而形成新 profile。

本次没有两个不同产品版本号的已发布安装包，因此没有声称完成正式的“旧版 installer → 新版 installer”升级演练。数据层升级由 v1–v15 迁移测试覆盖；正式发布前仍需用两个实际版本的签名安装包补做一次 installer upgrade 验收。

本次构建产物 SHA-256：

| 产物 | SHA-256 |
| --- | --- |
| `Songwriting Workspace_0.1.0_x64_en-US.msi` | `41BAA07B6369454B63DAAB0668E4401BA0A72D3A8D5AD566F8593FB55AA2396F` |
| `Songwriting Workspace_0.1.0_x64-setup.exe` | `0A652EADE84A762ED924A6CF33DA4758DCDDFA601D93088A4F41D7E6BF3ECC85` |
| `songwriting-workspace.exe` | `5B04CA2F758B7EF80C2CED8F6CDF83F9B98094161C0F4E00AC361AC3FC6EBDCE` |

## 4. 单实例

桌面壳首个注册 `tauri-plugin-single-instance`。第二次启动不会创建第二个可写 WebView；它会显示、取消最小化并聚焦已有的 `main` 窗口。这样可避免两个进程同时修改同一组 `localStorage` / IndexedDB 数据。

## 5. 既有 Web 用户迁移决定

**决定：有真实数据的既有 Web 用户需要一次性迁移；Desktop Step 4 不执行隐式迁移。**

原因：普通浏览器站点按其 HTTPS/localhost origin 保存数据；Tauri 桌面版使用自己的 WebView origin 与 app-specific data directory。安装桌面版不会自动获得浏览器 origin 下的 `localStorage` 或 IndexedDB。

当前仓库没有已记录的公开 Web 部署地址，也没有可验证的生产用户数据源，因此本 Step 不新增未经需求确认的导出/导入功能。发布给既有 Web 用户前，应单独定义一个明确 Phase，提供用户主动触发、可验证、可回滚的一次性导出/导入流程，同时迁移结构化 schema v15 与音频 Blob。不能尝试直接扫描浏览器 profile。

若桌面版只面向从未在 Web 版保存过数据的新用户，则无需迁移。

## 6. 已知限制

- `localStorage` 与 IndexedDB 仍属于 WebView 本地数据，不等同于备份；清除应用数据会丢失内容。
- 当前没有跨设备同步、自动备份或灾难恢复。
- 本 Step 不改变 schema 版本；结构化 schema 仍为 v15，IndexedDB 仍为 v1。
- macOS/Linux 的安装与升级行为需在对应平台实际打包后分别验证，不能由 Windows 结果代替。

## 7. 依据

- Tauri identifier 用于系统配置与 WebView 数据目录：<https://v2.tauri.app/reference/config/#identifier>
- Tauri 明确警告更改 `useHttpsScheme` 会改变 IndexedDB、cookie 与 localStorage 的位置：<https://v2.tauri.app/reference/config/#windowconfig>
- 官方 Single Instance 插件：<https://v2.tauri.app/plugin/single-instance/>
