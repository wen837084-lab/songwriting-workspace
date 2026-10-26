# Songwriting Workspace — Architecture

> 状态：PHASE 0 架构基线。本文只定义边界与实现方向，不代表任何后续 Phase 已开始。

## 1. 架构目标与约束

架构优先保证以下不变量：

1. 所有歌曲专属数据都有明确的 `projectId` 归属，Project A 的数据绝不出现在 Project B。
2. Duplicate Project 必须生成新的 `projectId`，所有可变子数据必须深复制并获得必要的新实体 ID。
3. UI 与 Feature Component 不直接依赖 `window.localStorage`；读写统一经过 Repository 与 Storage Adapter。
4. 更换 localStorage、IndexedDB 或未来的远端实现时，主要 UI 与用例逻辑不需要重写。
5. 核心创作流程不依赖 AI；移除 AI 后产品仍完整可用。
6. GarageBand 始终是外部实验环境，不做 API、同步或 UI 控制。
7. 产品保持“创作工作台”定位，不演化为 DAW。
8. 当前只设计满足近期 Phase 的最小边界，不提前构建通用框架、后端或插件系统。

## 2. Information Architecture

### 2.1 顶层结构

```text
Songwriting Workspace
├── Projects
│   ├── Active Projects
│   └── Archived Projects
├── Learn
│   ├── Learning Library
│   └── Learning History
├── Skills
│   └── Skill Map
└── Settings
```

进入一首歌后：

```text
Song Project
├── Create
│   ├── Idea / Explore
│   ├── Define
│   ├── Lyrics
│   ├── Melody
│   ├── Rhythm
│   ├── Harmony
│   └── Structure / Arrangement
├── Song
│   ├── Song Map
│   └── Project Notes
├── Tools
│   └── Contextual tools for the current task
└── Review
    ├── Reflection
    ├── Experiments
    └── Versions
```

这些节点是长期信息架构，不表示需要同时展示或一次实现。主创作页面在任一时刻只突出一个 Current Creative Task。Learning、AI Coach 与 GarageBand Practice 均通过按需入口打开，默认不占据主任务区域。

### 2.2 桌面与移动端注意力结构

桌面可采用“Journey / Current Task / Context”的三层布局，但左右区域必须可收起，中心任务始终是视觉主角。移动端一次只显示一个主要任务，上下文通过独立面板进入，不能压缩长文本输入或录音操作空间。

## 3. Workspace Layer 与 Song Project Layer

### 3.1 关系

```text
Workspace (one local creator profile)
├── preferences
├── learning progress/history
├── project index
└── SongProject [0..n]
    └── all creative data scoped by projectId
```

Workspace 是容器和跨项目学习上下文；Song Project 是创作数据的聚合根。跨项目能力只允许引用非创作性、Workspace-level 信息，例如某项 Skill 是否看过。项目之间不得直接引用彼此的可变创作实体。

### 3.2 边界规则

- Workspace 保存项目索引、偏好与学习状态，不保存某首歌的歌词、录音、BPM 等内容。
- 所有项目用例必须显式接收 `projectId`，禁止依赖隐式“最后打开项目”来决定写入目标。
- 路由中的 `projectId` 只负责定位；Repository 返回的数据仍必须校验其内部归属。
- 删除或归档项目的行为只影响目标 `projectId`；归档不等于删除。
- Workspace-level Learning History 可以记录发生于哪个项目的可选来源引用，但不能复制该项目的创作内容。

## 4. Core Data Model

以下为领域模型草案，用于明确所有权与隔离，不是要求在当前阶段生成 TypeScript 类型或一次实现所有字段。

### 4.1 Workspace 数据

```text
WorkspaceState
├── workspaceId
├── preferences
│   ├── theme
│   └── defaultCreationMode
├── projectIndex[]
│   ├── projectId
│   ├── title
│   ├── status
│   ├── currentStage
│   ├── createdAt
│   └── updatedAt
├── skillProgress[]
│   ├── skillId
│   └── state: Seen | Practiced | WantToRevisit
└── learningHistory[]
```

`projectIndex` 只存 Dashboard 所需摘要，不作为歌曲内容的第二份真相。摘要更新应与项目写入由同一个应用用例协调，避免标题或时间不一致。

### 4.2 Song Project 聚合

```text
SongProject
├── projectId
├── title
├── createdAt / updatedAt
├── currentStage
├── status: Active | Archived
├── creationMode: Guided | Free
├── projectNote
├── idea
├── materials[]
├── songIntent
├── lyrics
│   └── sections[]
├── melody
│   ├── notes
│   └── takes[]
├── rhythm
├── harmony
├── songStructure[]
├── arrangement
├── garageBandExperiments[]
├── reflection
├── learningNotes[]
├── versions[]
└── openQuestions[]
```

项目内的子实体（如 `sectionId`、`takeId`、`experimentId`、`versionId`）必须拥有稳定 ID。即使子实体存储在项目聚合内部，涉及读写时仍应验证它属于当前 `projectId`。音频元数据与音频 Blob 分开保存，元数据通过 `audioAssetId` 引用 Blob。

### 4.3 数据所有权矩阵

| 数据 | 所属层 | 强制作用域 |
| --- | --- | --- |
| Theme / Preferences | Workspace | `workspaceId` |
| Skill Map / Learning History | Workspace | `workspaceId` |
| Project summary | Workspace index | `projectId` 引用 |
| Lyrics / Materials / Intent | Song Project | `projectId` |
| Melody Take metadata | Song Project | `projectId` + `takeId` |
| Audio Blob（未来） | Song Project asset | `projectId` + `audioAssetId` |
| BPM / Key / Chords | Song Project | `projectId` |
| Structure / Arrangement | Song Project | `projectId` |
| GarageBand experiment | Song Project | `projectId` + `experimentId` |
| Version snapshot | Song Project | `projectId` + `versionId` |

## 5. Multi-project Isolation Strategy

### 5.1 隔离原则

- `projectId` 由应用层统一生成，创建后不可变。
- Repository API 不提供“获取当前项目数据”的无参写入方法；读写始终显式传递 `projectId`。
- 项目数据以独立存储记录或独立 key 保存，不把所有项目作为一个可被任意组件整体改写的大对象。
- Feature state 在项目切换时按 `projectId` 重新加载，并清理上一项目的暂存状态。
- 子实体创建时写入所属 `projectId`；更新与删除使用复合归属检查。
- 缓存键、查询键和未来 IndexedDB 索引必须包含 `projectId`。
- 导入、迁移和恢复也必须验证项目归属，不能绕过 Repository。

### 5.2 建议的 Repository 契约

```text
ProjectRepository
  list(): ProjectSummary[]
  get(projectId): SongProject | null
  create(input): SongProject
  update(projectId, change): SongProject
  duplicate(sourceProjectId): SongProject
  rename(projectId, title): void
  archive(projectId): void
  delete(projectId): void

WorkspaceRepository
  getPreferences()
  updatePreferences(change)

LearningRepository
  getSkillProgress()
  updateSkillProgress(skillId, state)
  listHistory()
```

具体方法将在相应 Phase 根据真实用例收窄；此处不提前实现通用 ORM 或事件系统。

### 5.3 Duplicate Project 策略

Duplicate 是应用层的原子业务用例，不是 UI 中的浅拷贝：

1. 通过 `ProjectRepository.get(sourceProjectId)` 读取完整源项目。
2. 对结构化数据做深复制，禁止共享数组、对象或其他可变引用。
3. 生成新的 `projectId`、`createdAt` 与 `updatedAt`。
4. 对 `sectionId`、`takeId`、`experimentId`、`versionId` 等内部实体生成新 ID，并重写项目内部引用。
5. 未来若复制音频，创建独立的 Blob 记录或采用明确的不可变资产引用与引用计数方案；在该方案正式设计前，禁止假设 Blob 可安全共享。
6. 清理纯运行时状态，例如当前播放位置、未提交 UI 草稿或打开的面板。
7. 保存副本后重新读取并验证其所有权，再更新 Workspace 的项目索引。

最低测试不变量：修改副本任何嵌套数据不得改变原项目；删除任一项目不得破坏另一项目的数据或资产。

## 6. Persistence Architecture

### 6.1 分层

```text
UI / Feature Components
        ↓ commands and queries
Application Use Cases
        ↓ repository interfaces
Repositories
        ↓ serialized records
Storage Adapters
        ├── LocalStorageAdapter (first structured-data implementation)
        └── IndexedDB adapters (future audio / larger local data)
```

- UI 只调用用例或 Repository 暴露的领域操作，不拼接 storage key、不序列化数据。
- Repository 负责领域对象校验、默认值、归属检查、时间戳与复制规则。
- Storage Adapter 只处理底层 get/set/remove/list 与序列化错误，不包含产品决策。
- Schema migration 位于持久化边界，在数据进入领域层前完成。

不为“可能的云端”提前引入网络 Repository、同步协议或冲突解决系统；只保持接口边界，使未来替换成为局部工作。

### 6.2 localStorage 使用边界

第一阶段 localStorage 只存小型结构化 JSON：

- schema metadata
- Workspace preferences
- project index
- Song Project 的结构化内容
- Learning / Skill 状态

禁止存入：

- 大量或长时音频 Blob / Base64
- 缓存的 AI 响应作为项目事实
- 可由领域数据重建的大型派生数据
- 需要高频逐帧写入的状态

localStorage 是同步、容量有限且可能被用户清除的浏览器存储。因此写入应集中、可捕获 quota/parse 错误，并在 UI 中给出可恢复提示；不能暗示它等同于云备份。

建议 key 命名（实现时再冻结）：

```text
songwriting-workspace:meta
songwriting-workspace:workspace
songwriting-workspace:project-index
songwriting-workspace:project:<projectId>
songwriting-workspace:learning
```

### 6.3 Future IndexedDB Audio Storage

浏览器录音进入对应 Phase 后，音频 Blob 使用 IndexedDB 或等价的 browser-local binary storage：

```text
AudioAsset
├── audioAssetId
├── projectId
├── takeId
├── mimeType
├── size
├── createdAt
└── blob
```

Song Project 的 Take 只保存 `audioAssetId` 和展示元数据。读写、删除、复制都通过 `AudioAssetRepository`，并以 `projectId` 建索引。删除 Take 或 Project 时必须有明确的资产清理策略；在音频 Phase 前不提前实现。

### 6.4 Storage Schema Version

持久化根元数据包含单调递增的 `schemaVersion`：

```text
StorageMeta
├── schemaVersion
├── appDataCreatedAt
└── lastMigratedAt
```

`schemaVersion` 描述持久化结构，而不是产品版本。每次不兼容的数据结构变化只提升一次版本，并附带确定性的迁移函数与测试。

### 6.5 Future Migration Strategy

迁移采用逐版本、可测试的前向链：

```text
read raw data
→ validate version
→ migrate vN to vN+1 sequentially
→ validate current schema
→ expose domain data
```

规则：

- 迁移必须保持 `projectId` 和项目间边界。
- 迁移前先解析到未知/原始结构，不能直接假定当前类型。
- 不认识的未来版本停止写入并提示用户，避免旧客户端损坏数据。
- 迁移失败时保留原始数据，不用空默认值静默覆盖。
- 迁移与备份/导出能力在需要的 Phase 设计，不在 PHASE 0 编码。
- 从 localStorage 转向 IndexedDB 时由新 Adapter/迁移器接管，UI 和用例契约保持稳定。

## 7. Creation Journey Architecture

### 7.1 Journey 是导航状态，不是强制状态机

`currentStage` 表示用户当前聚焦位置，不代表完成百分比，也不限制可访问步骤。各创作模块保存自身数据状态；Journey 负责“下一步可做什么”的导航，不把创作锁进单一路径。

### 7.2 Guided Mode

- 面向零基础用户，每次只呈现一个问题或任务。
- 所有问题支持 Answer、Skip、Back、Add note。
- 指导只解释目标与观察角度，不给创作答案。
- 用户可随时切换阶段或切换到 Free Mode，已有数据不改变。

### 7.3 Free Mode

- 允许直接进入 Lyrics、Melody、Rhythm、Harmony、Arrangement 或 Song Map。
- 不要求补齐之前步骤，不把空字段解释为失败。
- 与 Guided Mode 共享同一份项目领域数据；模式只是导航和呈现偏好，不能维护两套歌曲副本。

### 7.4 多入口创作

新项目允许记录用户已拥有的起点类型，如故事、短句、歌词、旋律、Beat、和弦、录音、编曲想法或“什么都没有”。入口只决定初始引导，不决定歌曲结构或最终方向。

## 8. Learning Architecture

Learning 分为两个相互关联但所有权不同的部分：

- Learning Library：Workspace-level 的静态/策展知识与练习目录。
- Learning Progress：Workspace-level 的 `Seen`、`Practiced`、`WantToRevisit` 状态和历史。

创作页面只传递当前上下文标签（例如 `Lyrics / Verse`）来筛选相关内容，不把项目歌词或其他创作内容复制进 Learning 数据。Learning Panel 默认关闭，由用户通过“I’m stuck”或“What do I need to learn?”打开。

三层内容保持独立：Quick Understanding、Practice、Deeper Learning。Practice 训练能力，不能产生当前歌曲可直接采用的内容。Skill Map 只表达接触和复习意愿，不出现 Score、Grade 或能力等级。

## 9. Future AI Architecture

AI 不在 MVP 早期实现，并且直到 PHASE 14 才允许接入 API。未来建议作为可拔除的应用服务：

```text
Optional AI Coach UI
        ↓ explicit user request
CoachService interface
        ├── NoAI / unavailable result
        └── Future AI provider adapter
                ↓ policy validation
Structured coaching response
```

AI 不能成为 Repository 写入的必经环节，也不能决定项目状态。所有非 AI 的流程、静态 Learning 内容和手动记录能力必须独立存在。

建议输出字段：`bottleneckType`、简短可展示的 `reasoningSummary`、`suggestedSkill`、`reflectionQuestions`、`exercise`、`returnToCreationPrompt`。不保存或显示模型内部 chain-of-thought。

AI 边界必须在多层实施：

1. System policy：禁止生成可直接插入歌曲的创作内容。
2. 输入约束：只发送诊断所需的最小上下文，并由用户主动触发。
3. 结构化输出校验：只接受教练类字段。
4. 呈现层：不提供“一键应用到歌曲”。
5. 失败回退：展示相关 Learning 与人工反思路径，不阻塞创作。

## 10. GarageBand 的外部工具角色

GarageBand 不在系统边界内。不存在 GarageBand client、API adapter、同步服务、工程解析器或 UI automation。

唯一允许的交互模型是人工往返：

```text
Workspace 定义一个问题
→ 用户自行打开 GarageBand
→ 用户自行实验与聆听
→ 用户返回 Workspace
→ 用户记录 whatITried / whatINoticed / decision / nextQuestion
```

GarageBand Practice Guide 只是可阅读的实验计划。Experiment Log 是绑定 `projectId` 的用户记录。系统可以提示比较变量和聆听角度，但不能提供具体旋律、和弦或乐器选择。

## 11. 推荐项目文件夹结构

在开始对应 Phase 后，可按实际需要逐步建立，而不是在 PHASE 0 预建空目录：

```text
src/
├── app/                         # Next.js routes and route-level composition
│   ├── (workspace)/
│   └── projects/[projectId]/
├── features/                    # Phase-owned UI and use-case composition
│   ├── projects/
│   ├── creation-journey/
│   ├── learning/
│   └── ...
├── domain/                      # Stable domain types and pure rules
│   ├── workspace/
│   ├── project/
│   └── learning/
├── application/                 # Cross-feature use cases
│   ├── projects/
│   └── ports/                   # Repository interfaces
├── infrastructure/
│   └── persistence/
│       ├── local-storage/
│       ├── migrations/
│       └── indexed-db/          # Only when audio phase requires it
├── components/                  # Truly shared presentational components
└── lib/                         # Small framework utilities; no domain dumping ground

docs/
├── 产品总需求.md
├── PRODUCT.md
└── ARCHITECTURE.md
```

约束：

- Feature 不直接导入具体 storage adapter。
- `components/` 不承载领域状态或 Repository 调用。
- 不为每个概念建立一层抽象；只有出现真实边界时才增加目录或接口。
- AI、audio、GarageBand guidance 等目录只在对应 Phase 创建。

## 12. MVP Boundaries

MVP 的长期范围是一个 local-first、多项目、可独立完成歌曲创作流程的工作台；交付严格按需求中的 Phase 顺序推进。

PHASE 0 的实际交付仅包括：

- 产品定义文档。
- 信息架构、领域边界、隔离策略与持久化方案。
- 未来各能力的接口边界和明确禁区。

PHASE 0 不包括：

- Next.js 脚手架或任何正式产品代码。
- Projects Dashboard 或项目 CRUD。
- 创作 Journey UI、歌词、录音、节拍器、和弦、Song Map、编曲。
- Learning UI、AI API、GarageBand 流程、版本系统。
- Authentication、Cloud Database、Collaboration 或部署方案。

## 13. 不应该开发的功能

永久产品边界：

- 自动写、续写、改写歌词，生成标题、Hook 或候选创作内容。
- 自动生成或选择旋律、MIDI melody、完整和弦进行或编曲。
- 替用户挑选 Best Take，评价歌曲质量，给创作者或版本评分排名。
- GarageBand API Integration、控制、同步、工程创建或工程读取。
- Multitrack Audio Engine、Piano Roll、Full MIDI Editor、Mixer、Plugin System、Effects Chains、Mastering 或复杂录音棚。

当前阶段也不应开发：正式 UI、任何业务功能、AI、云端、认证、协作和不必要的依赖。

## 14. 主要架构风险

### 14.1 项目数据串线

风险来源是隐式 current project、共享全局表单状态、缺少归属验证或不含 `projectId` 的缓存键。缓解方式是显式作用域的 Repository API、切换项目时重载状态，以及贯穿创建/读取/更新/删除/复制的隔离测试。

### 14.2 Duplicate 浅拷贝与 ID 冲突

直接展开顶层对象会共享嵌套引用，复用子实体 ID 也会让未来资产或更新命中原项目。Duplicate 必须是集中用例，执行深复制、ID 映射与引用重写。

### 14.3 Workspace 摘要与项目实体不一致

如果 Dashboard 索引与项目分别被组件写入，会产生旧标题和错误更新时间。应由单一应用用例协调更新，并将项目实体视为内容真相。

### 14.4 localStorage 容量、同步与损坏风险

localStorage 不适合音频和高频写入，且可能被清除。结构化数据需集中序列化、错误可见、schema 可迁移；音频未来转入 IndexedDB。备份/导出属于后续明确范围，不在本阶段假设已解决。

### 14.5 Schema 演进破坏旧项目

直接改变 TypeScript 类型不会升级已有数据。持久化必须带 `schemaVersion`，每次结构变化提供迁移和旧数据测试，未知未来版本禁止写回。

### 14.6 Guided 与 Free Mode 形成两套数据

若两种模式分别保存内容，切换会丢失或冲突。两者必须共享同一领域模型，只改变导航和呈现。

### 14.7 Learning 或 AI 抢夺创作主线

把教学或聊天常驻主界面会让产品变成课程或 AI 创作器。它们必须按需开启、输出过程指导，并明确返回当前创作任务。

### 14.8 AI 越界成为共同作者

单靠提示词不足以保证边界。未来需要输入最小化、结构化输出、策略验证、无“一键应用”交互和无 AI 回退路径共同约束。

### 14.9 逐渐变成 DAW

录音、和弦试听与 Arrangement Matrix 容易扩张为音频制作系统。每个提案都应检查它是在帮助用户思考和记录，还是在制作、混音或自动完成音乐；后者拒绝进入产品。

### 14.10 过早抽象

在实际 Phase 前建立云同步、通用事件总线、插件架构或复杂状态框架会增加迁移成本。当前只冻结领域边界、Repository 方向和数据不变量，具体接口随最早真实用例实现。

## 15. 架构验收问题

进入每个后续 Phase 前后，都应至少验证：

- 当前读写是否显式绑定正确 `projectId`？
- Project B 初次打开是否为空，返回 Project A 是否完整？
- Duplicate 后所有可变数据与 ID 是否独立？
- 刷新后数据是否仍可读取，旧 schema 是否可迁移？
- 移除 AI 后，用户是否仍能继续当前任务？
- GarageBand 是否仍完全位于产品边界之外？
- 新能力是否在帮助思考、记录与学习，而非把产品变成 DAW？
- 本次实现是否严格停留在当前 Phase？

