# Desktop Step 5 — Recording verification

> 验证日期：2026-09-21  
> 平台：Windows 11 / Tauri 2.11.6 / Wry 0.55.1 / WebView2 153.0.4234.48  
> 范围：麦克风权限、多个 Takes、重启播放、Project/Version 音频引用、Web Audio、最小化与后台行为。

## 1. 结论

Desktop Step 5 **尚未完成最终人工验收**。

已通过的部分：

- 当前源码成功生成 Windows x64 release exe、MSI 与 NSIS installer。
- 自动化测试验证多个 Takes 的 Project/Section 隔离、IndexedDB Blob 重开、Take/Section/Project 删除、Project 复制、Version 复制/删除/恢复时的音频引用生命周期。
- 浏览器对照运行验证 Web Audio 节拍器可启动、停止，并在刷新后回到停止状态；Chord Playground 可在用户手势后创建并恢复 `AudioContext`、播放和弦并更新页面状态。
- 原生 release 进程可关闭并重新启动，重启后的窗口可响应，并继续使用固定的 WebView profile。

未能宣称通过的部分：

- Tauri 原生窗口中的首次麦克风允许、拒绝，以及拒绝后的恢复。
- 在原生窗口中录制两个以上真实 Takes，并在完整进程重启后逐个播放。
- 在原生 UI 中删除/复制 Project 与 Version 后逐个播放相关录音。
- 原生窗口最小化期间的录音连续性、节拍器连续性，以及恢复窗口后的实际听感。

原因是本次执行环境只向 UI 控制器暴露浏览器面板，没有暴露正在运行且可响应的 Tauri 原生窗口；WebView2 麦克风权限弹窗也无法由该控制器观察或操作。未观察到的行为没有按推断记为通过。

## 2. 自动化验证

`pnpm test`：94/94 通过。

其中与本 Step 直接相关的聚焦测试为 7/7 通过：

- `Desktop Step 4 persists IndexedDB audio Blobs across repository restarts`
- `PHASE 7 multiple takes persist and stay isolated by section and project`
- `PHASE 7 take rename, notes, status, and delete update metadata and Blob storage`
- `PHASE 7 section and project delete clean owned audio without touching other projects`
- `PHASE 7 project duplicate remaps sections, takes, assets, and stays independent`
- `PHASE 17 audio references survive Take deletion, Version duplication, and project duplication`
- `PHASE 17 restore without a safety backup cleans audio no longer referenced`

覆盖到的引用规则：

- 删除当前 Take 后，如果已保存 Version 仍引用其 `audioAssetId`，Blob 保留。
- 删除最后一个引用该录音的 Version 后，Blob 删除。
- Duplicate Version 共享同一 Project 内的不可变录音引用；删除一个 Version 不影响另一个 Version。
- Duplicate Project 会生成新的 Project、Section、Take 与 `audioAssetId`，并复制独立 Blob；删除原 Project 不影响副本播放资产。
- 无安全备份恢复 Version 时，恢复后不再被当前 Project 或任一 Version 引用的 Blob 会被清理。

## 3. 权限检查

当前原生 WebView profile：

```text
%LOCALAPPDATA%\com.songwritingworkspace.desktop\EBWebView
```

检查时 `Default/Preferences` 中 `media_stream_mic` 为空，因此当前 profile 没有已持久化的麦克风允许或拒绝决定。

前端通过用户点击“录音”后调用：

```text
navigator.mediaDevices.getUserMedia({ audio: true })
```

拒绝会映射为明确的 `NotAllowedError` 提示，并保证不保存 Take。当前 Tauri/Wry 版本没有应用层 permission handler，首次请求由 WebView2 默认权限流程处理。

风险：应用目前没有“重新请求/打开权限设置”的恢复入口。若 WebView2 持久保存拒绝，后续点击可能直接再次返回 `NotAllowedError`；必须在原生窗口中实测恢复路径后才能关闭此项。

## 4. Web Audio 与后台行为

已验证浏览器对照行为：

- Rhythm 的 Web Audio 节拍器由用户手势启动，UI 从“开始”变为“停止”。
- 点击停止后会清理调度 timer、已调度 oscillator，并关闭 `AudioContext`。
- 页面刷新后播放状态为停止。
- Harmony 的和弦播放由用户手势启动，页面显示最近播放的和弦。
- Harmony 组件卸载时会停止 oscillator 并关闭 `AudioContext`。

代码审计发现：

- 录音组件卸载时会停止 `MediaRecorder` 和所有 `MediaStreamTrack`，并以失败标记阻止保存半截 Take。
- 最小化不会卸载 React 组件，所以当前设计倾向于让正在进行的录音继续，直到用户恢复窗口并点击停止。
- 当前没有 `visibilitychange`、窗口 focus/minimize 事件或后台节流补偿。
- 节拍器依赖 25ms `setInterval` 做 Web Audio look-ahead 调度；若 WebView2 在最小化/后台节流 timer，节拍可能中断或不均匀。该行为必须实际听测，不能只靠代码证明。

## 5. 原生构建与进程重启

`pnpm desktop:build` 成功。当前产物：

| 产物 | SHA-256 |
| --- | --- |
| `songwriting-workspace.exe` | `2B076688AD54D47D2AB0B3EFB614BAA447E5E23A0C49CFAE3FB89079D7E31418` |
| `Songwriting Workspace_0.1.0_x64_en-US.msi` | `C4FC30DDAA9CD62091EE8F53C98A33B60654D1DDAD86E8499CB409E657BED14C` |
| `Songwriting Workspace_0.1.0_x64-setup.exe` | `4330DF94DE563F6F3DBF1DAFFD85DCB776FA735581DA5FE44C585455E93499BD` |

原生 release 从 PID 26204 完整关闭后重新启动为 PID 12632；新窗口标题正确且 `Responding: true`。这验证了进程级重启，但由于没有可操作的原生窗口录制样本，不把它等同于“重启后播放通过”。

## 6. 必须补做的原生人工验收

使用上表对应的同一构建与专用测试 Project：

1. 首次点击“录音”，确认 WebView2 出现麦克风询问；选择允许，录制并停止，确认生成 Take 1 且可播放。
2. 清除该应用的麦克风决定或使用全新 profile，再次点击“录音”并拒绝；确认显示拒绝提示、Take 数量不变、没有空 Blob。
3. 按产品支持的恢复方式重新允许麦克风；确认无需删除 Project 即可再次录音。若只能清应用数据才能恢复，则判定失败。
4. 连续录制至少三个 Takes，逐个播放，确认名称、时长、Section 与音频不串线。
5. 保存包含所选 Take 的 Version，删除当前 Take，确认 Version 引用仍可恢复和播放。
6. Duplicate Version，删除其中一个 Version，确认另一个 Version 的录音仍可恢复；删除最后引用后确认资产被清理。
7. Duplicate Project，确认副本逐个播放正常；删除原 Project 后确认副本仍可播放。
8. 完整退出应用并重新启动，逐个播放当前 Takes 与 Version 恢复后的 Takes。
9. 录音中最小化 15 秒再恢复并停止，检查录音是否连续、时长是否合理、没有静音断层。
10. 节拍器运行中最小化 15 秒再恢复，听测节拍是否连续、是否出现突发补拍或明显漂移；Chord Playground 在恢复后重新点击是否可播放。

第 5–7 步包含删除测试数据。执行原生 UI 的最终“确认删除”前，应确认使用的是专用测试 Project，而不是用户的真实歌曲。

## 7. 质量门禁

| 检查 | 结果 |
| --- | --- |
| `pnpm typecheck` | 通过 |
| `pnpm lint` | 通过 |
| `pnpm test` | 通过，94/94 |
| `pnpm build` | 通过 |
| `pnpm desktop:build` | 通过；需在构建进程 PATH 中包含现有的 `C:\Users\15897\.cargo\bin` |

## 8. 当前建议

在发布前不要把 Desktop Step 5 标记为完成。优先补完第 6 节的原生人工验收；尤其是“拒绝后恢复”和“最小化期间节拍器”两项，它们目前既没有端到端证据，也没有应用层生命周期策略。
