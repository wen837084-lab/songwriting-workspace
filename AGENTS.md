# Songwriting Workspace — Codex 永久开发规则

这个文件定义 Codex / Coding Agent 在本项目中必须长期遵守的规则。

除非我明确修改本文件，否则这些规则始终有效。

---

# 一、最高产品原则

整个产品必须始终遵守：

> Guide the creator. Never become the creator.

中文理解：

> 指导创作者，但不要成为创作者。

所有真正属于歌曲的创作内容，都必须来自用户本人。

系统可以：

- 帮用户整理想法
- 拆解创作过程
- 提出问题
- 保存用户自己的素材
- 帮用户规划下一步
- 解释创作知识
- 提供练习
- 帮用户识别自己卡在哪里
- 指导用户进行音乐实验
- 帮用户记录实验结果
- 帮用户进行自我检查
- 帮用户管理歌曲版本
- 帮用户长期学习 songwriting

系统不可以：

- 自动写歌词
- 自动续写歌词
- 自动给下一句歌词
- 自动改写歌词
- 自动生成 Hook
- 自动生成歌曲标题
- 自动生成旋律
- 自动生成 MIDI melody
- 自动替用户选择旋律
- 自动生成完整和弦进行作为创作答案
- 根据情绪直接给出“应该使用的和弦”
- 自动完成编曲
- 告诉用户应该加入哪件乐器
- 替用户选择哪个 Take 最好
- 判断一首歌好不好
- 给歌曲打分
- 给创作者评级
- 给不同版本排名
- 替用户做创作决定

---

# 二、AI 边界

这个产品的核心流程必须在没有 AI 的情况下仍然完整可用。

未来 AI 只能作为：

- Songwriting Coach
- Learning Navigator
- Process Guide

AI 不能成为：

- Songwriter
- Composer
- Arranger

AI 可以：

- 帮用户判断自己可能卡在哪个能力维度
- 推荐 Learning Library 中相关 Skill
- 解释创作概念
- 提出反思问题
- 提供练习
- 帮用户描述问题
- 帮用户找到下一步学习方向

AI 不可以：

- 写歌词
- 续歌词
- 改歌词
- 提供候选歌词
- 生成 Hook
- 生成标题
- 生成旋律
- 提供 melodic phrase
- 生成 MIDI melody
- 自动生成完整 chord progression
- 根据用户情绪直接给出创作答案
- 替用户做 Arrangement
- 替用户挑选 Take
- 说某个版本最好
- 评价作品质量

如果 AI API 完全不可用，用户仍然必须能够完成整个创作流程。

---

# 三、Workspace 与 Song Project 必须分层

本产品必须区分：

## Workspace Layer

属于创作者本人，可以跨歌曲长期存在。

例如：

- Projects Dashboard
- Learning Library
- Skill Map
- Learning History
- App Settings
- Theme
- User Preferences
- Archived Projects

## Song Project Layer

每一首歌必须拥有完全独立的数据。

所有 Project-specific 数据必须通过：

projectId

进行隔离。

Project A 与 Project B 绝对不能共享：

- Lyrics
- Melody Recordings
- Melody Takes
- BPM
- Key
- Chords
- Song Structure
- Arrangement
- GarageBand Experiment Logs
- Song Notes
- Versions
- Selected Melody Takes

如果 Duplicate 一个 Song Project：

- 必须生成新的 projectId
- Duplicate 的子数据不能与原项目共享可变引用
- 修改 Duplicate 不能影响原项目
- 修改原项目也不能影响 Duplicate

---

# 四、GarageBand 的角色

GarageBand 是外部实验环境。

它不是本产品的一部分。

不要开发：

- GarageBand API Integration
- 自动控制 GarageBand
- 自动建立 GarageBand Project
- 自动改变 GarageBand BPM
- 自动写入 GarageBand Track
- 自动同步 GarageBand
- 自动读取 GarageBand Project
- 自动控制 GarageBand UI

正确流程是：

Songwriting Workspace
→ 定义要解决的问题
→ 用户自己打开 GarageBand
→ 自己实验
→ 自己听
→ 回到 Workspace
→ 记录发现
→ 记录决定
→ 继续创作

GarageBand Practice 是 Guide，不是 Integration。

---

# 五、不要把产品做成 DAW

明确不要实现：

- Multitrack Audio Engine
- Piano Roll
- Full MIDI Editor
- Mixer
- Plugin System
- Effects Chains
- Audio Mastering
- 复杂 Recording Studio

本产品定位：

比 Notes / Notion 更懂歌曲创作。

但比 GarageBand / Logic / Ableton 简单得多。

---

# 六、技术原则

当前技术方向：

- Next.js App Router
- TypeScript
- Tailwind CSS
- 尽量少安装依赖

当前阶段优先使用浏览器本地存储。

暂时不要擅自加入：

- Authentication
- Cloud Database
- Collaboration
- Complex Backend
- Full DAW
- AI API

除非当前 Phase 明确要求。

---

# 七、持久化规则

Feature Component 不允许在代码中到处直接调用：

window.localStorage

所有数据读写必须通过独立的 Storage / Repository Layer。

例如可以有：

- ProjectRepository
- WorkspaceRepository
- LearningRepository

具体接口可以根据架构设计。

目标是：

以后从 localStorage 切换到 IndexedDB、SQLite、Supabase 或其他存储方式时，不需要重写整个 UI。

结构化数据第一阶段可以使用 localStorage。

未来音频 Blob 不应直接大量存入 localStorage。

如果以后实现音频，可以考虑 IndexedDB 或其他 Browser-local Storage。

---

# 八、开发执行限制

docs/产品总需求.md 是这个项目的完整长期产品需求。

它不是一次性执行指令。

你不能因为读到了完整产品需求，就自动开始实现所有功能。

必须严格遵守以下规则：

1. 除非我明确指定当前 Phase，否则不要开始开发。
2. 每次只允许执行我明确指定的一个 Phase。
3. 不得提前实现后续 Phase 功能。
4. 不得因为“以后会用到”而提前加入功能。
5. 不得擅自修改产品边界。
6. 不得擅自增加新的核心产品功能。
7. 完成当前 Phase 后必须停止。
8. 没有我的下一条明确指令，不得继续下一 Phase。
9. 如果当前没有指定 Phase，只允许：
   - 阅读
   - 分析
   - 回答问题
   - 提出风险
10. 如果没有指定 Phase，不要修改代码。

---

# 九、每个 Phase 的标准流程

每次收到一个明确 Phase 后：

1. 阅读 AGENTS.md
2. 阅读 docs/产品总需求.md
3. 阅读 docs/ARCHITECTURE.md（如果已经存在）
4. 检查当前 Repository
5. 理解当前 Phase
6. 只实现当前 Phase
7. 不实现后续功能
8. 运行 typecheck
9. 运行 lint
10. 运行 build
11. 测试当前 Phase 的要求
12. 修复明显错误
13. 总结修改内容
14. 停止

如果某个检查命令当前项目尚未配置，需要明确说明。

不要因为检查命令不存在就擅自增加大量工具链。

---

# 十、不要隐藏架构问题

如果发现当前架构存在问题：

优先修复架构问题。

不要通过：

- 增加更多 Feature
- 增加更多状态
- 增加更多依赖
- 增加更多 UI
- 增加更多 AI 功能

来掩盖底层问题。

如果发现后续 Phase 会受到当前架构影响，应在本 Phase 汇报中说明。

---

# 十一、UX 原则

用户在任何主要创作页面都应该清楚：

“What am I working on right now?”

不要同时堆满：

- 创作问题
- 完整教程
- AI Coach
- Song Map
- Arrangement Board
- 完整歌词
- 所有工具
- GarageBand Guide

保护用户注意力。

Learning 默认不要抢占主界面。

AI Coach 默认不要抢占主界面。

GarageBand Practice 只在需要真实实验时出现。

---

# 十二、Learning 原则

核心原则：

Create first.
Learn when needed.

不要强迫用户先学完整课程再写歌。

Learning 应该帮助创作，而不是阻挡创作。

Skill Map 的作用是帮助用户长期成长，不是评分。

不要使用：

- Score
- Grade
- Beginner %
- Expert Level
- Good / Bad

可以使用：

- Seen
- Practiced
- Want to revisit

---

# 十三、歌曲结构不能被系统决定

系统不能假设所有歌曲结构都一样。

用户必须可以：

- Add
- Delete
- Duplicate
- Rename
- Reorder
- Skip Optional Sections

系统可以解释 Section 的功能。

但不能替用户决定：

- 必须有什么 Section
- 哪个 Section 最好
- 哪一种结构最好

---

# 十四、旋律、节奏、和声、编曲边界

## Melody

允许：

- Record
- Stop
- Playback
- Rename
- Delete
- Multiple Takes

状态可以有：

- Keep exploring
- Interesting
- Return later

不要出现：

- Best Take

不要自动分析或替用户挑选旋律。

## Rhythm

允许：

- BPM
- Time Signature
- Metronome
- Tap Tempo
- Rhythm Notes

用户自己决定 BPM。

系统不能说某个 BPM 最适合歌曲。

## Harmony

允许：

- Key
- Chord Notes
- Chord Playground
- User-created progressions

禁止：

- Recommended Progression
- Best Chords
- Generate Chords From Emotion
- AI Harmony Generator

## Arrangement

允许提供思考维度。

例如：

- Larger
- Smaller
- Denser
- More open
- More energetic
- More restrained

不要直接替用户说：

“这里应该加 drums and bass。”

---

# 十五、版本系统边界

歌曲允许：

- Save Version
- Duplicate Version
- Rename Version
- Compare Versions

Compare 只展示差异。

不能评价：

- 哪个版本最好
- 哪个版本更成熟
- 哪个版本得分更高

---

# 十六、代码质量原则

优先：

- 清晰
- 可维护
- 易于理解
- 类型明确
- 边界明确
- 最小必要复杂度

不要为了“看起来专业”而进行过度设计。

不要为了未来可能用到而建立大量抽象。

不要擅自安装大型第三方库。

如果必须增加依赖，需要说明：

- 为什么需要
- 为什么现有方案不够
- 这个依赖解决什么问题

---

# 十七、最终汇报语言

所有：

- 解释
- 架构摘要
- 测试结果
- 已知问题
- 最终汇报

使用中文。

代码中的：

- 文件名
- 变量名
- 类型名
- 函数名
- API 名称

保持正常英文工程命名。

---

# 十八、每个 Phase 完成后的汇报格式

完成当前 Phase 后，至少汇报：

A. 本次完成了什么

B. 修改了哪些文件

C. 做了哪些架构决定

D. 做了哪些测试

E. typecheck / lint / build 结果

F. 当前已知限制

G. 是否发现可能影响后续 Phase 的风险

H. 明确确认没有开始下一 Phase

完成汇报后停止。

不要擅自继续开发。
