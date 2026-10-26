import type { ProjectStage } from "../project/project";

export const LEARNING_TABS = [
  "quick-understanding",
  "practice",
  "deeper-learning",
] as const;

export type LearningTab = (typeof LEARNING_TABS)[number];
export type LearningEntryPoint = "stuck" | "need-to-learn";

export interface LearningLayer {
  title: string;
  summary: string;
  points: readonly string[];
}

export interface LearningStageContent {
  stage: ProjectStage;
  stageLabel: string;
  focus: string;
  stuckIntro: string;
  needToLearnIntro: string;
  quickUnderstanding: LearningLayer;
  practice: LearningLayer;
  deeperLearning: LearningLayer;
}

const stageContent: Record<ProjectStage, LearningStageContent> = {
  Idea: {
    stage: "Idea", stageLabel: "Idea / 想法",
    focus: "先留意一个起点，不急着把它变成歌曲。",
    stuckIntro: "你不需要一个完整概念。先留意一件吸引你注意的事。",
    needToLearnIntro: "简要了解留意一个想法与决定它意味着什么之间的区别。",
    quickUnderstanding: {
      title: "从注意开始",
      summary: "一个想法可以是故事、画面、声音、感受或问题。现在只需要收集已经出现的内容。",
      points: ["寻找一个你可以回看的具体内容。", "暂时把观察和解释分开。", "随着你对它了解更多，起点也可以改变。"],
    },
    practice: {
      title: "不塑形的观察",
      summary: "用这个 Project 之外的内容做一个简短观察练习。",
      points: ["选择一个与你当前歌曲无关的普通物件或地方。", "写下五个可以通过感官注意到的内容。", "标出一个你想继续看的细节；不要把它变成歌词。"],
    },
    deeperLearning: {
      title: "从冲动到素材",
      summary: "早期歌曲创作常常会在原始素材保持原样、暂不整理时变得更清楚。",
      points: ["具体细节会为之后的选择提供可处理的内容。", "素材集合中可能有矛盾；那是信息，不是问题。", "收集素材之后，再来澄清意义也可以。"],
    },
  },
  Explore: {
    stage: "Explore", stageLabel: "Explore / 探索",
    focus: "在塑造之前，收集并观察你自己的素材。",
    stuckIntro: "如果素材感觉太宽泛，选择一个小细节去观察，不要试图解决整首歌。",
    needToLearnIntro: "了解探索如何把模糊感受变成一组可使用的观察，而不是替你总结。",
    quickUnderstanding: {
      title: "先收集，再连接",
      summary: "探索是让你自己的原始素材变得可见的一种方式。不需要先有主题或最终方向。",
      points: ["收集场景、物件、声音、动作、词语和记忆。", "相比宽泛解释，优先记录你能想象或听见的细节。", "在选择之前，让多个可能的方向共存。"],
    },
    practice: {
      title: "五个具体观察",
      summary: "用与这首歌无关的记忆或地点练习留意细节。",
      points: ["选择一段独立的日常记忆，写下五个可以观察到的细节。", "加入一个声音、一个动作和一个由你选择的物件。", "标出让你好奇的细节；其他内容先保留，不做判断。"],
    },
    deeperLearning: {
      title: "具体素材会创造选择",
      summary: "探索不是为了产生更多文字，而是为了找到能支持后续选择的细节。",
      points: ["一个场景可以同时承载时间、地点、人物和变化。", "不同素材类型可以指向不同的创作入口。", "选择素材是你的决定，系统不应替你决定。"],
    },
  },
  Define: {
    stage: "Define", stageLabel: "Define / 定义",
    focus: "明确你希望这首歌承载或传达什么。",
    stuckIntro: "你可以先定义一个小的意图，不必决定歌曲可能拥有的全部意义。",
    needToLearnIntro: "这个阶段是为了让你更容易回到自己的关注点，而不是寻找一个正确主题。",
    quickUnderstanding: {
      title: "意图是一枚指南针",
      summary: "Song Intent 记录你在创作时想持续关注什么。它不会规定文字、旋律或结构。",
      points: ["用对你来说可使用的语言描述中心。", "留意你想放在身边的感受、画面、张力或问题。", "当你的理解改变时，意图也可以修改。"],
    },
    practice: {
      title: "选择一个关注点",
      summary: "用当前 Project 之外的虚构情境练习缩小注意范围。",
      points: ["写下三种关注同一个虚构情境的方式。", "圈出让你留下最清晰问题的版本。", "写一句这个关注点会帮助你注意什么；不要把它当作歌曲内容。"],
    },
    deeperLearning: {
      title: "关注，但不关闭可能性",
      summary: "有用的意图足够具体，可以引导注意；也足够开放，可以容纳发现。",
      points: ["一个核心画面可能比宽泛主题更容易行动。", "中心张力可以创造移动感，但不会规定结尾。", "Intent 是反思工具，不是检验成品质量的标准。"],
    },
  },
  Lyrics: {
    stage: "Lyrics", stageLabel: "Lyrics / 歌词",
    focus: "发展并整理你写下的文字。",
    stuckIntro: "回到一个 Section 需要完成的作用。不必一次解决所有 Section。",
    needToLearnIntro: "通过这份辅助理解 Section 的作用和具体观察，但不会得到可直接使用的句子。",
    quickUnderstanding: {
      title: "一个 Section 有自己的作用",
      summary: "Section 可以承载移动、信息、重复、对比或释放。它们的作用可以是个人化且灵活的。",
      points: ["问自己听众在这个 Section 中会遇到什么。", "留意什么发生了变化、出现了，或仍未解决。", "实际的句子由你自己写；指导只能帮助你检查作品。"],
    },
    practice: {
      title: "具体描述",
      summary: "练习让一个观察变得具体，但不要为这首歌写作。",
      points: ["用五个看得见、听得见或摸得到的细节描述一个你熟悉的房间。", "用一个真正可以观察到的细节替换一个宽泛描述。", "让练习与当前 Project 分开，再回看什么变得更清楚。"],
    },
    deeperLearning: {
      title: "信息、重复和变化",
      summary: "歌词可以通过添加信息、回到关注点、转换视角，或为听众留下空间来移动。",
      points: ["Verse 常常为场景或新信息留出空间。", "一个重复出现的 Section 可以从周围内容中获得新的意义。", "没有规定的 Section 顺序；由你选择并修改自己的结构。"],
    },
  },
  Melody: {
    stage: "Melody", stageLabel: "Melody / 旋律",
    focus: "探索并记录你自己的旋律想法。",
    stuckIntro: "把下一个实验变小：只改变一件由你选择的事，然后留意听到什么。",
    needToLearnIntro: "这份辅助解释观察旋律移动的方法，但不会生成旋律答案。",
    quickUnderstanding: {
      title: "旋律是在时间中的移动",
      summary: "可以通过走向、重复、空间、音域和节奏探索旋律。由你决定尝试什么，以及继续探索什么。",
      points: ["把尝试一个 Take 与决定它对你意味着什么分开。", "想对比实验时，一次只改变一个变量。", "用名称和备注记住自己的 Takes；对比它们，但不选出赢家。"],
    },
    practice: {
      title: "三个自己选择的旋律走向",
      summary: "用你为练习编出的中性句子，练习观察旋律形状。",
      points: ["先说一次你自己的中性句子，不要试图唱它。", "保持文字不变，尝试三个由你选择的不同形状。", "记录或描述发生了什么变化；不要自动把练习带入这首歌。"],
    },
    deeperLearning: {
      title: "对比实验，而不是赢家",
      summary: "旋律学习通过反复聆听，以及清楚记录各次尝试之间的变化而成长。",
      points: ["走向描述整体方向；节奏描述时间和时值。", "重复可以创造连续性，变化可以创造对比。", "由你自己的聆听决定什么有意思，或值得再看。"],
    },
  },
  Rhythm: {
    stage: "Rhythm", stageLabel: "Rhythm / 节奏",
    focus: "处理你选择的时值、律动和节奏感。",
    stuckIntro: "一次聆听一个时间问题：律动、间隔、时值，或一句话从哪里开始。",
    needToLearnIntro: "了解几种观察节奏的方法，同时把所有速度和时间决定留在你手中。",
    quickUnderstanding: {
      title: "节奏是被组织起来的时间",
      summary: "律动、速度、拍子、停顿和时值都可以用来描述时间。它们都不会规定歌曲应该使用什么。",
      points: ["律动是参考点；节奏是事件如何与它发生关系。", "停顿和延续的声音也是时间的一部分。", "BPM 是用来记录和回看的选择，不是 Workspace 的推荐。"],
    },
    practice: {
      title: "说出来并点击",
      summary: "用你自己的短句，在当前歌曲之外观察时间。",
      points: ["选择一个中性句子和一个由你为练习选择的律动。", "说三次，只改变间隔或留出停顿的位置。", "写下你对移动和顺畅程度的观察；让练习与歌曲分开。"],
    },
    deeperLearning: {
      title: "在不同尺度上观察时间",
      summary: "可以在整个 Section、一句话，或单个声音之间的关系中听到节奏感。",
      points: ["拍号是组织重复拍子的方式，不是创作评判。", "节拍器为实验提供稳定的参考。", "Tap Tempo 和备注帮助你记住选择和听到的内容。"],
    },
  },
  Harmony: {
    stage: "Harmony", stageLabel: "Harmony / 和声",
    focus: "记录并探索你自己的和声决定。",
    stuckIntro: "一次聆听一个和声时刻，在决定改变什么之前描述它的效果。",
    needToLearnIntro: "这是一套用于聆听和声的词汇，不是推荐和弦或和弦进行的来源。",
    quickUnderstanding: {
      title: "和声创造关系",
      summary: "可以通过一个 Key、Chord 或变化与另一个声音的关系来描述它。你的耳朵仍然是决定者。",
      points: ["用你自己的话留意稳定、移动、张力、释放、明亮、暗、或模糊。", "记录你弹奏的内容，以便回到这个实验。", "这里没有从情绪查和弦，也没有推荐的和弦进行。"],
    },
    practice: {
      title: "对比两个声音",
      summary: "练习聆听和声，但不要为这首歌构建答案。",
      points: ["选择两个你已经知道或可以弹奏的单独和弦。", "分别聆听，再用你自己的话描述对比。", "第二轮只改变一件事，并记录你的发现；不要把它变成和弦进行。"],
    },
    deeperLearning: {
      title: "使用聆听词汇",
      summary: "可以通过关系、期待、重复、对比和声部移动来学习和声。",
      points: ["Key 是音高和和弦关系的参考，不是情绪设置。", "和弦备注可以保留聆听观察，但不决定下一个和弦。", "对比你自己的实验，比询问一个最佳答案更有用。"],
    },
  },
  SongStructure: {
    stage: "SongStructure", stageLabel: "Song Structure / 歌曲结构",
    focus: "塑造你选择的段落、顺序和小节数。",
    stuckIntro: "观察下一个过渡的作用，不要先假设某种标准形式。",
    needToLearnIntro: "了解结构如何组织变化，同时把实际的 Map 留在你手中。",
    quickUnderstanding: {
      title: "结构是一组作用的序列",
      summary: "Song Map 让段落的顺序和关系变得可见，不要求一种统一形状。",
      points: ["问自己下一个 Section 改变、重复、揭示或释放了什么。", "Section 可以添加、删除、复制、重命名、重新排序或跳过。", "小节数是规划备注，不是质量衡量。"],
    },
    practice: {
      title: "绘制一个非歌曲流程",
      summary: "用普通且与 Project 分开的内容练习排序。",
      points: ["选择一个熟悉的流程，例如准备出门。", "把步骤写在不同卡片上，再尝试一种替代顺序。", "观察顺序如何改变注意力；不要把练习当作规定的歌曲结构。"],
    },
    deeperLearning: {
      title: "变化、回归和对比",
      summary: "听众常常通过重复出现和差异来定位自己，但每位创作者决定这些关系如何运作。",
      points: ["一次回归会因为之前发生的事而感觉不同。", "对比可以来自文字、旋律、节奏、和声、空间或你选择的其他维度。", "Map 是思考表面，不是完成歌曲的处方。"],
    },
  },
  Arrangement: {
    stage: "Arrangement", stageLabel: "Arrangement / 编曲",
    focus: "思考整首歌中的对比、空间、能量和质感。",
    stuckIntro: "在决定如何制作之前，先描述你想听到的变化。",
    needToLearnIntro: "使用编曲词汇比较可能性，但不会得到乐器或制作决定。",
    quickUnderstanding: {
      title: "编曲关注关系",
      summary: "可以通过规模、密度、空间、能量、动态和音区描述编曲。这些是观察维度，不是指令。",
      points: ["一次使用一个维度比较两个 Section。", "在自己的实验中问：什么应该更开放、更克制、更大或更小。", "在 Workspace 之外，由你自己选择声音和制作步骤。"],
    },
    practice: {
      title: "画出两条能量曲线",
      summary: "练习思考对比，但不要为当前歌曲选择编曲。",
      points: ["为一个虚构序列画两条五步能量线。", "标出每条线在哪里变得更开放、更密、更安静或更强烈。", "比较形状并说出你注意到的变化；不要指定乐器，也不要自动应用。"],
    },
    deeperLearning: {
      title: "让一个变量变得可观察",
      summary: "当你能描述什么变了、什么保持不变时，编曲实验会更容易听见。",
      points: ["空间关注各个元素彼此留下多少余地。", "密度关注同时发生了多少事情；能量和动态可以独立变化。", "Workspace 可以记录观察，但制作决定属于你。"],
    },
  },
  Review: {
    stage: "Review", stageLabel: "Review",
    focus: "Step back and notice what you want to revisit next.",
    stuckIntro: "Review is for noticing and choosing a next question, not for scoring or ranking the song.",
    needToLearnIntro: "Learn a reflective way to inspect your own work while keeping every creative judgment with you.",
    quickUnderstanding: {
      title: "Review without a verdict",
      summary: "A review can collect observations, open questions, and possible next experiments without deciding whether the song is good or finished.",
      points: ["Describe what is present before deciding what you want to revisit.", "Compare intentions and observations without turning them into a score.", "Choose one next question that helps you return to creating."],
    },
    practice: {
      title: "Observation and next question",
      summary: "Practice reflective listening or reading with a piece of your own work outside this project.",
      points: ["Write two neutral observations about what you notice.", "Write one question you would like to investigate next.", "Do not rate, rank, or rewrite the work as part of this exercise."],
    },
    deeperLearning: {
      title: "Reflection supports revision",
      summary: "Reflection is useful when it turns vague discomfort into a question you can explore, without removing your agency.",
      points: ["Specific observations are easier to revisit than broad judgments.", "A question can remain open while you make another experiment.", "Revision is a series of creator-led choices, not a pass/fail stage."],
    },
  },
};

export function getLearningStageContent(stage: ProjectStage): LearningStageContent {
  return stageContent[stage];
}

export function getAllLearningStageContent(): readonly LearningStageContent[] {
  return Object.values(stageContent);
}
