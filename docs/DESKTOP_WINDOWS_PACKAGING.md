# Desktop Step 8 — Windows packaging

> 验证日期：2026-09-21  
> 平台：Windows 11 x64 / Tauri 2.11 / WebView2 153  
> 范围：unsigned release exe、NSIS、可选 MSI、安装/升级/卸载与数据保留；不包含 signing、自动更新或发布流水线。

## 1. 交付结论

- `pnpm desktop:build` 是 Windows 的默认发布命令，生成 unsigned release `.exe` 与 NSIS setup。
- `pnpm desktop:build:msi` 按需只生成 MSI。
- `pnpm desktop:build:windows` 同时生成 NSIS 与 MSI，供完整 Windows 发布候选构建使用。
- NSIS 是普通用户的主安装包，使用 `currentUser`，不要求管理员权限，包含 English 与 Simplified Chinese installer UI。
- MSI 是按需提供的系统级部署格式；本次保留并显式固定既有 `UpgradeCode`，避免后续 MSI 版本形成不兼容的升级链。
- Windows 安装器继续使用 Tauri 的 `downloadBootstrapper` WebView2 策略。Windows 10/11 通常已有 WebView2；若目标机器没有运行时，安装需要网络。
- 本 Step 的构建明确使用 `--no-sign`。没有写入证书指纹、PFX、timestamp URL、CI secret、发布 token 或 release workflow。

## 2. 发布产物

构建目录位于 ASCII 路径 `C:\Users\Public\SongwritingWorkspaceBuild`，避免 WiX 处理当前 Unicode repository 路径时出现工具链兼容问题。

| 产物 | 用途 | SHA-256 |
| --- | --- | --- |
| `release\songwriting-workspace.exe` | release executable | `2857CBC9C402CBBFCC58F2A97DA3C43644F3D67C301B4A520514B1C80232AEC1` |
| `release\bundle\nsis\Songwriting Workspace_0.1.0_x64-setup.exe` | 主安装包 | `5CCE7ED05EB04E29B4489D0FD0A2076912FFA1DA87246DC249784DFB3EE9F6E0` |
| `release\bundle\msi\Songwriting Workspace_0.1.0_x64_en-US.msi` | 可选 MSI | `4185B09C7A825B74909B69559F458F73BA916AD97457E35BC2E50382E9698B84` |

三个文件的 Authenticode 状态均为 `NotSigned`，符合“最后才配置 signing 与发布流程”的要求。

MSI 元数据核验：

```text
ProductName=Songwriting Workspace
ProductVersion=0.1.0
UpgradeCode={B4CA202C-599B-56AD-A750-F8E17CCBBE24}
ALLUSERS=1
```

## 3. 安装生命周期验证

使用 `scripts/verify-windows-installation.ps1` 执行了真实 NSIS 生命周期：

1. 确认 Windows uninstall registry 中没有 `Songwriting Workspace`，且没有运行中的应用进程。
2. 静默安装仅用于升级基线的 unsigned `0.0.9` NSIS。
3. 从安装目录启动应用，确认窗口进程保持运行并可响应，再正常关闭。
4. 在固定数据目录 `%LOCALAPPDATA%\com.songwritingworkspace.desktop` 写入唯一临时数据标记。
5. 静默运行 `0.1.0` NSIS 覆盖升级，确认注册版本、installed exe、启动响应和数据标记均正确。
6. 静默卸载 `0.1.0`，确认 uninstall registry 与 installed exe 已移除。
7. 确认数据标记和 app data directory 在卸载后仍存在，证明 uninstaller 不删除用户数据。
8. 移除仅由验证脚本创建的临时标记，不删除应用数据目录。

结果：

| 检查 | 结果 |
| --- | --- |
| 无既有安装项开始 | 通过 |
| `0.0.9` 干净应用安装 | 通过 |
| installed app 启动/正常关闭 | 通过 |
| `0.0.9 → 0.1.0` 覆盖升级 | 通过 |
| 升级后数据保留 | 通过 |
| `0.1.0` 卸载 | 通过 |
| 卸载后用户数据保留 | 通过 |
| 测试后无安装项/运行进程/临时标记 | 通过 |

机器可读报告：

```text
C:\Users\Public\SongwritingWorkspacePackagingVerification.json
```

本次“干净安装”指当前 Windows 用户没有既有应用安装项的 clean application state。当前机器未启用 Windows Sandbox，因此不能把本结果描述为全新 Windows 镜像验证；正式公开发布前仍需在全新 Windows 11 VM 或实体机上人工复验 installer UI、WebView2 bootstrapper、Start Menu entry 与 SmartScreen 表现。

## 4. 可重复命令

生成主 release 与 NSIS：

```powershell
pnpm desktop:build
```

按需生成 MSI：

```powershell
pnpm desktop:build:msi
```

同时生成两种 installer：

```powershell
pnpm desktop:build:windows
```

升级演练使用低于当前版本的独立 target，不修改仓库版本：

```powershell
$env:SONGWRITING_BUILD_VERSION = "0.0.9"
$env:SONGWRITING_TAURI_TARGET_DIR = "C:\Users\Public\SongwritingWorkspaceBaselineBuild"
pnpm desktop:build
```

安装生命周期脚本需要显式提供基线和升级 installer；它会拒绝在已有同名安装项时开始，也不会清空 app data directory。

## 5. 质量门禁

| 检查 | 结果 |
| --- | --- |
| `pnpm typecheck` | 通过 |
| `pnpm lint` | 通过 |
| `pnpm test` | 通过，99/99 |
| `pnpm build` | 通过 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check` | 通过 |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | 通过 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 通过，3/3 |
| `pnpm desktop:build:windows` | 通过，release exe + NSIS + MSI |
| Authenticode 检查 | 三个产物均为预期的 `NotSigned` |

Rust linker 在当前中文 Windows 环境输出了一条“正在创建库”的 informational linker message；它不是 Clippy warning，构建和测试均成功。

## 6. Signing 与发布流程计划（未配置）

只有完成全新机器安装复验并取得正式 Windows code-signing certificate 后，才进入下一独立工作：

1. 确认发布主体、证书类型与证书保管方式。
2. 使用 Windows certificate store / 硬件或云签名服务，不把 PFX 或密码提交到 repository。
3. 为 app exe、NSIS setup 与 MSI 使用 SHA-256 和证书提供方的 RFC 3161 timestamp 服务。
4. 在隔离的 release job 中构建、签名、执行 `Get-AuthenticodeSignature`/`signtool verify`、生成 hash manifest。
5. 仅从受保护 tag 或人工批准的 release 触发上传；先发布 draft，再人工下载复验后公开。
6. 用两个真实签名版本再次执行 upgrade/uninstall/data-retention 验收。

本 Step 没有配置 GitHub Actions、Tauri updater、自动发布、release hosting 或 signing secret。

## 7. 已知限制与风险

- unsigned installer 会触发 Windows SmartScreen/Unknown Publisher 提示；这是 signing Phase 前的预期状态，不能用于公开分发。
- NSIS 的 WebView2 bootstrapper 在目标机器缺少 WebView2 时依赖网络；离线发行需在后续明确选择并评估 `offlineInstaller` 带来的约 127 MB 增量。
- MSI 当前为 per-machine 语义，通常需要管理员权限；普通用户默认应使用 NSIS current-user setup。
- 当前只验证 x64 Windows，不代表 ARM64、32-bit、Windows Server、macOS 或 Linux。
- installer 生命周期使用合成的 `0.0.9 → 0.1.0` 本地构建验证升级机制；正式发布仍需对两个真实签名发行版本复验。
- 卸载按产品要求保留本地创作数据。当前没有 UI 内“删除所有本地数据”功能，不应在 uninstaller 中擅自加入数据删除。

## 8. 依据

- Tauri Windows installer：<https://v2.tauri.app/distribute/windows-installer/>
- Tauri Windows code signing：<https://v2.tauri.app/distribute/sign/windows/>
- Tauri configuration reference：<https://v2.tauri.app/reference/config/>

