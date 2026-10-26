# Desktop Step 6 — AI architecture

## 1. 当前状态

Desktop Step 6 已完成代码与本机构建验证。仓库中没有远端部署绑定、生产 URL 或部署凭据，因此本次无法诚实地确认某个线上 backend 已部署；`src/app/api/ai-coach/route.ts` 是待部署的 secure backend 入口。

桌面安装包不包含 OpenAI API key，也不直接连接 OpenAI。远端 backend 继续复用：

- `AiCoachService`
- `OpenAiProvider` provider adapter
- `AI_COACH_SYSTEM_PROMPT` 与结构化输出 policy
- 请求和响应的领域校验

## 2. 信任边界

```text
Tauri WebView
  -> HTTPS NEXT_PUBLIC_AI_COACH_ENDPOINT
  -> Next.js /api/ai-coach
  -> AiCoachService
  -> OpenAiProvider
  -> OpenAI Responses API
```

- API key 只设置在远端 backend 的 `OPENAI_API_KEY`。
- 桌面端只得到公开 HTTPS endpoint。
- 桌面端没有配置 endpoint 时不会尝试相对 `/api/ai-coach`，而是直接显示既有 Learning / Skill Map / Reflection fallback。
- backend 和桌面端都会校验结构化响应；项目 ID 不匹配或越过创作边界的响应不会展示。

## 3. 远端环境变量

远端 backend 最低配置：

```text
OPENAI_API_KEY=<server-only secret>
AI_PROVIDER=openai
OPENAI_MODEL=gpt-5-mini
AI_PROVIDER_TIMEOUT_MS=15000
AI_COACH_ALLOWED_ORIGINS=https://web.example.com,http://tauri.localhost,tauri://localhost
AI_COACH_RATE_LIMIT=20
AI_COACH_RATE_WINDOW_MS=600000
```

`AI_COACH_ALLOWED_ORIGINS` 只接受逗号分隔的精确 origin，不接受通配符、路径、query、fragment 或带凭据的 URL。`http://tauri.localhost` 与 `tauri://localhost` 是桌面 WebView origin；浏览器生产站点必须使用 HTTPS。

部署平台必须：

1. 只公开 HTTPS。
2. 在可信反向代理处覆盖而不是追加客户端伪造的 `X-Forwarded-For`。
3. 在 edge / WAF 再配置一层分布式限流。仓库内限流器按运行实例生效，用于单实例保护，不能替代多实例全局配额。
4. 禁止将 request body、Authorization、API key、Project ID、Song Intent 或用户描述写入平台日志。
5. 健康检查不能调用模型或消耗配额。

## 4. 桌面构建配置

构建带 AI 的桌面安装包：

```powershell
$env:NEXT_PUBLIC_AI_COACH_ENDPOINT = "https://api.example.com/api/ai-coach"
pnpm desktop:build
```

构建脚本会验证 endpoint：生产地址必须是 HTTPS，且不能携带用户名、密码、query 或 fragment。它只把该 endpoint 的单一 origin 写入本次 Tauri 构建的 `connect-src`；基础 `tauri.conf.json` 仍不允许任意远端网络。

未设置 `NEXT_PUBLIC_AI_COACH_ENDPOINT` 也能正常构建和使用，AI Coach 会进入离线 fallback。

## 5. 安全配置

- CORS：只回显被 allowlist 接受的精确 origin；预检只允许 `POST, OPTIONS` 和 `Content-Type`。
- CSP：桌面基础 CSP 只允许本地资源和 Tauri IPC；有 endpoint 的构建只增加 endpoint origin。
- 请求大小：最多 8 KiB，同时检查声明长度与实际 UTF-8 byte length。
- 限流：默认每个客户端 10 分钟 20 次，返回 `429` 和 `Retry-After`。
- 超时：provider 默认 15 秒，桌面 client 默认 20 秒，确保服务端先结束。
- 日志：只记录随机 request ID、结果类别、耗时和 origin 是否通过；不记录 IP、项目内容、请求正文或 provider 错误文本。
- 响应：`Cache-Control: no-store`、`nosniff`、`no-referrer`，API 响应 CSP 为 `default-src 'none'`。

## 6. 发布前远端确认清单

拿到生产 URL 和部署权限后，仍必须完成以下外部确认：

- 未允许的 origin 得到 `403`，且响应没有 `Access-Control-Allow-Origin`。
- 两个 Tauri origin 和正式 Web origin 分别通过预检与 POST。
- 超过配额得到 `429` 和 `Retry-After`。
- OpenAI 超时、缺少 key、断网和无效响应均返回安全 fallback。
- 平台日志抽查不含 request body、Project ID、Song Intent、用户描述或密钥。
- 用实际生产 endpoint 构建安装包，并检查最终 CSP 只包含该 origin。

在这些生产检查完成前，不应把“remote backend 已上线”标记为已验收。

## 7. 本次本地验证结果

- 无 endpoint：remote client 不发请求并返回 fallback。
- endpoint 存在但网络不可达：返回 `unavailable` fallback，项目数据不变。
- client 超时：返回 `timeout` fallback。
- 同源 POST：`200`、`Cache-Control: no-store`，缺少 provider key 时返回安全 fallback。
- 未允许 origin：`403`，且没有 `Access-Control-Allow-Origin`。
- 合法预检：`204`，只允许 `POST, OPTIONS` 与 `Content-Type`。
- 无 endpoint 与带精确 HTTPS endpoint 两种 Tauri Windows 安装包均完成构建。
