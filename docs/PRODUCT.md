# Songwriting Workspace — 产品定义

> 本文从 `产品总需求.md` 提炼稳定的产品定义、原则与边界。原文件仍是完整需求来源；本文用于在开发过程中快速判断一个设计是否属于本产品。

## 1. 产品使命

Songwriting Workspace 是一个供创作者长期使用、可管理多首歌曲的独立歌曲创作工作台。它服务于从零开始学习写歌，以及已有素材但容易卡住的创作者。

产品追求的不是让用户尽快得到一首由系统完成的歌，而是帮助用户逐渐获得独立完成歌曲创作的能力。

最高原则：

> Guide the creator. Never become the creator.

所有可直接成为歌曲内容的创作材料与最终决定，都必须来自用户本人。

## 2. 核心价值

- 把一首歌从模糊想法推进到可持续修订的作品。
- 在一个 Workspace 中长期管理几十到上百首相互隔离的 Song Projects。
- 在用户需要时提供知识、练习、问题拆解与实验指导，而不代替创作。
- 保存用户自己的素材、决定、实验发现与版本历史。
- 让零基础用户知道当前只需做什么，同时允许有经验用户自由工作。

## 3. 产品心智模型

主线是创作，而不是课程：

```text
Workspace
  → Choose a Song Project
    → Current Creative Task
```

Learning、未来的 AI Coach 与 GarageBand Practice 都是按需辅助层，不能取代或阻塞这条主线。

## 4. 目标用户

- 完全没有歌曲创作经验的人。
- 有想法或素材，但不知道下一步做什么的人。
- 已经开始写歌，但经常在某个环节卡住的人。
- 希望系统学习歌词、旋律、节奏、和声、结构与编曲的人。
- 希望长期保存、发展和回看多首歌曲的人。

## 5. 核心体验原则

### 5.1 创作自主权

系统可以整理、解释、提问、记录、提示流程和提供练习；不能生成可直接放入歌曲的歌词、标题、Hook、旋律、完整和弦进行或编曲选择，也不能替用户挑选 Take、评价作品或给版本排名。

### 5.2 Create first, learn when needed

用户先创作，在遇到具体困难时主动打开 Learning。Learning 默认不占据主要创作界面，不要求用户完成课程后才能继续写歌。

### 5.3 单一注意力焦点

每个主要页面都应清楚回答：“What am I working on right now?” 同一时间只突出一个当前任务，避免同时展示完整教程、AI、Song Map、全部歌词与全部工具。

### 5.4 路径可引导但不可强制

Guided Mode 每次提供一个清晰任务；Free Mode 允许自由进入不同创作区域。用户可以从故事、短句、歌词、旋律、Beat、和弦、录音或编曲想法开始。

### 5.5 无 AI 也完整成立

AI 是未来可选能力，不是核心流程依赖。AI API 缺失、关闭或失败时，项目管理、创作流程、知识内容、练习、实验记录和版本管理仍应可用。

## 6. 产品层级

### Workspace Layer

属于创作者本人、可跨歌曲长期存在：

- Projects Dashboard
- Learning Library
- Skill Map
- Learning History
- App Settings、Theme、User Preferences
- Archived Projects 的索引与访问入口

### Song Project Layer

属于某一首歌，必须由 `projectId` 严格隔离：

- 基本信息、当前阶段、状态与项目备注
- Idea、Materials、Song Intent
- Lyrics、Melody、Rhythm、Harmony
- Song Structure、Arrangement
- GarageBand Experiment Logs
- Reflection、Learning Notes、Open Questions
- Versions 与用户选择的 Melody Takes

Workspace 可以知道“用户学过 Verse”，但不能让 Project A 的歌词、录音或其他歌曲数据出现在 Project B。

## 7. 创作旅程

完整能力蓝图包含：

```text
IDEA → EXPLORE → DEFINE → LYRICS → MELODY → RHYTHM
     → HARMONY → SONG STRUCTURE → ARRANGEMENT → REVIEW
     → VERSION / REVISION
```

这是导航地图，不是强制线性工作流。创作者可以跳过、返回或从不同入口开始。歌曲也没有客观的百分比完成度和唯一的“Finish”。

## 8. Learning 定义

Learning 属于辅助系统，分三层：

1. Quick Understanding：用 1–3 分钟解释概念及其用途。
2. Practice：用 5–10 分钟训练一项能力，但不代做当前歌曲。
3. Deeper Learning：提供更完整的知识内容。

Skill Map 是 Workspace-level 的学习足迹，只记录 `Seen`、`Practiced`、`Want to revisit`，不评分、不评级。

## 9. AI Coach 定义

AI 只允许在用户主动请求时作为：

- Songwriting Coach
- Learning Navigator
- Process Guide

它可以诊断流程障碍、解释概念、提出反思问题、推荐既有学习内容和练习，并把行动权交回用户。它不能成为 Songwriter、Composer 或 Arranger，也不能输出能直接插入歌曲的创作材料。

## 10. GarageBand 定义

GarageBand 是完全独立的 External Experiment Environment，不属于本产品，也不与本产品集成。

Workspace 只负责：定义一次实验要解决的问题、展示用户已有的上下文、给出观察维度，以及在用户返回后记录发现与决定。用户自行打开和操作 GarageBand。

## 11. 产品定位边界

本产品比 Notes / Notion 更理解歌曲创作过程，但比 GarageBand / Logic / Ableton 简单得多。

明确不做：

- Multitrack Audio Engine
- Piano Roll 或 Full MIDI Editor
- Mixer、Plugin System、Effects Chains、Audio Mastering
- 复杂 Recording Studio
- GarageBand API、控制、同步或工程读写
- 自动创作歌词、旋律、和弦、结构或编曲
- 作品质量评分、创作者评级、版本优劣排名

## 12. MVP 与阶段纪律

技术方向是 Next.js App Router、TypeScript、Tailwind CSS，并尽量减少依赖。第一阶段使用浏览器本地存储；暂不引入 Authentication、Cloud Database、Collaboration、Complex Backend 或 AI API。

MVP 是按 Phase 逐层交付的本地优先创作工作台，不是一次性实现完整蓝图。任何阶段只能实现当次明确指定的范围；当前 PHASE 0 只建立产品与架构文档，不实现功能。

## 13. 产品判断问题

每个新功能在进入实现前都应回答：

1. 它是在指导创作者，还是替创作者创作？
2. 它属于 Workspace 还是某个 `projectId`？
3. 没有 AI 时，这个流程是否仍可完整完成？
4. 它是否在把产品推向 DAW？
5. 它是否让当前任务更清楚，而不是增加注意力负担？
6. 它是否属于当前明确指定的 Phase？

