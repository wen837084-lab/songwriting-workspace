import type { ProjectStage } from "../../domain/project/project";

export const GARAGEBAND_PRACTICE_STAGES = [
  "Melody",
  "Rhythm",
  "Harmony",
  "Arrangement",
  "Demo",
] as const;

export type GarageBandPracticeStage = (typeof GARAGEBAND_PRACTICE_STAGES)[number];

export interface GarageBandPracticeGuideContent {
  stage: GarageBandPracticeStage;
  label: string;
  title: string;
  intro: string;
  questionPrompt: string;
  goal: string;
  beforeOpen: readonly string[];
  inGarageBand: readonly string[];
  trySteps: readonly string[];
  listenFor: readonly string[];
  returnToWorkspace: readonly string[];
}

const PRACTICE_STAGE_BY_PROJECT_STAGE: Partial<Record<ProjectStage, GarageBandPracticeStage>> = {
  Melody: "Melody",
  Rhythm: "Rhythm",
  Harmony: "Harmony",
  Arrangement: "Arrangement",
  Review: "Demo",
};

const PRACTICE_GUIDES: Record<GarageBandPracticeStage, GarageBandPracticeGuideContent> = {
  Melody: {
    stage: "Melody",
    label: "Melody practice",
    title: "Hear your melodic idea in a stable test",
    intro: "Use an external listening pass to notice how your own melodic material behaves.",
    questionPrompt: "What do I want to notice about this melodic idea?",
    goal: "Hear how your own melodic idea behaves when the surrounding setup stays as stable as you can keep it.",
    beforeOpen: [
      "Choose one existing section or phrase to observe.",
      "Write one question in the context box before you leave this Workspace.",
      "Have your own lyrics or melodic material ready; this guide will not create material.",
    ],
    inGarageBand: [
      "Open GarageBand yourself and create a simple temporary project for this listening experiment.",
      "Manually set up the section and context you want to hear.",
      "Keep the setup stable except for the one variable named by your own question.",
      "Record or enter only material you created yourself.",
    ],
    trySteps: [
      "Make one pass using the current version of your own material.",
      "Make another pass after changing only the variable you chose to inspect.",
      "Name the passes for your own reference if useful; this guide does not choose a take.",
    ],
    listenFor: [
      "Where does the phrasing feel easier or harder to follow?",
      "Where does your attention or energy change?",
      "What did you notice when only one variable changed?",
    ],
    returnToWorkspace: [
      "Close GarageBand yourself when you have heard enough for this question.",
      "Write down what you heard in your own words before starting another test.",
      "Return here when ready; this guide does not save an experiment result.",
    ],
  },
  Rhythm: {
    stage: "Rhythm",
    label: "Rhythm practice",
    title: "Hear how your chosen timing carries the song",
    intro: "Use an external listening pass to inspect timing without asking the Workspace to choose a tempo.",
    questionPrompt: "What do I want to notice about the timing of this section?",
    goal: "Hear how the timing you chose changes how your existing material sits in the song.",
    beforeOpen: [
      "Choose the section or material whose timing you want to hear.",
      "Note the current BPM and time signature shown in the context panel.",
      "Write one question about timing, pulse, or space; do not ask the guide to choose a BPM.",
    ],
    inGarageBand: [
      "Open GarageBand yourself and manually set the BPM and time signature you want to test.",
      "Set up a short listening environment around your own existing material.",
      "Keep the material fixed while you inspect the timing question.",
      "Keep the BPM and time signature as manual choices in GarageBand; this Workspace does not alter them.",
    ],
    trySteps: [
      "Make a reference pass with the timing you currently chose.",
      "Make another pass using a timing change that you decide to investigate.",
      "Change one variable at a time so you can describe your own observation afterward.",
    ],
    listenFor: [
      "Where do words, notes, or pauses feel crowded or spacious?",
      "Does the pulse stay easy for you to feel across the section?",
      "What changed in your listening when the timing variable changed?",
    ],
    returnToWorkspace: [
      "Stop the external test yourself when the question has been heard clearly enough.",
      "Return with your own observation, not a score or an automatic recommendation.",
      "This guide leaves the BPM and any result unchanged in the Workspace.",
    ],
  },
  Harmony: {
    stage: "Harmony",
    label: "Harmony practice",
    title: "Listen to your own harmonic choices in context",
    intro: "Use an external listening pass to inspect the relationship between your material and your harmonic decisions.",
    questionPrompt: "What do I want to notice about the harmony in this section?",
    goal: "Listen to how your own harmonic material interacts with the selected section.",
    beforeOpen: [
      "Choose one section and the harmonic material you want to inspect.",
      "Review the current key and notes shown in the context panel.",
      "Write one listening question; the guide will not recommend chords or a progression.",
    ],
    inGarageBand: [
      "Open GarageBand yourself and manually set up the section you want to hear.",
      "Enter or play only harmonic material that you have chosen yourself.",
      "Keep the rest of the test stable while you listen to the relationship you are examining.",
      "GarageBand remains an external tool; nothing is read back into this Workspace.",
    ],
    trySteps: [
      "Make a reference pass with your current harmonic material.",
      "Make a second pass after one change that you intentionally choose to investigate.",
      "Keep a clear distinction between what you tried and what you noticed.",
    ],
    listenFor: [
      "How does the harmonic movement relate to the section's existing material?",
      "Where does the sense of tension, release, stability, or uncertainty change for you?",
      "What did the comparison help you hear about your own question?",
    ],
    returnToWorkspace: [
      "Close the external test yourself when you have enough to reflect on.",
      "Bring back your own words and decisions when you continue in the Workspace.",
      "This guide does not generate, select, or save harmonic material.",
    ],
  },
  Arrangement: {
    stage: "Arrangement",
    label: "Arrangement practice",
    title: "Compare space, density, and energy in context",
    intro: "Use an external listening pass to inspect an arrangement question without outsourcing the arrangement decision.",
    questionPrompt: "What do I want to notice about the shape of this arrangement?",
    goal: "Notice how changes in space, density, and energy affect your existing sections.",
    beforeOpen: [
      "Choose the section and arrangement dimension you want to observe.",
      "Review the current section and arrangement context shown here.",
      "Write one question in your own words; this guide will not choose parts or instruments.",
    ],
    inGarageBand: [
      "Open GarageBand yourself and manually build the smallest temporary test environment you need.",
      "Bring in only material and parts you chose for this test.",
      "Keep the comparison focused on one dimension, such as space, density, energy, or restraint.",
      "Make every arrangement decision yourself; the Workspace does not control GarageBand.",
    ],
    trySteps: [
      "Make a reference pass with the arrangement as you currently understand it.",
      "Make another pass after one contrast that you decide to test.",
      "Keep the section and listening question clear while you compare the passes.",
    ],
    listenFor: [
      "Does the section feel more open, smaller, denser, or more energetic to you?",
      "Where does the listener's attention appear to move?",
      "Which part of your question remains unanswered after listening?",
    ],
    returnToWorkspace: [
      "Stop and close the external test yourself when you have enough to reflect on.",
      "Return with your own observations and decisions; do not treat the guide as a ranking.",
      "No arrangement result or external project is saved by this guide.",
    ],
  },
  Demo: {
    stage: "Demo",
    label: "Demo practice",
    title: "Hear a small, self-directed demo pass",
    intro: "Use GarageBand as an external listening environment for one focused whole-song question.",
    questionPrompt: "What do I want to notice when I hear this song as a demo?",
    goal: "Hear how the decisions you made in the Workspace carry into a simple external listening pass.",
    beforeOpen: [
      "Choose the part of the song you need to hear as a demo.",
      "Write one question about the listener experience you want to inspect.",
      "Decide the smallest amount of your own material needed to answer that question.",
    ],
    inGarageBand: [
      "Open GarageBand yourself and manually build a temporary listening setup from your own material.",
      "Keep the test small enough that you can listen without losing the question.",
      "Use only choices you make yourself; this Workspace does not build or control the demo.",
      "Treat what you hear as information for your next decision, not as an automatic verdict.",
    ],
    trySteps: [
      "Listen once without stopping, keeping your written question in mind.",
      "Revisit only the moment or section connected to that question.",
      "If you compare passes, change only what you intentionally chose to inspect.",
    ],
    listenFor: [
      "What stands out before you start analyzing?",
      "Do you hear the relationship or contrast you wanted to inspect?",
      "What remains uncertain and needs your next creative decision?",
    ],
    returnToWorkspace: [
      "Close GarageBand yourself when this focused listening pass is complete.",
      "Return to the Workspace and continue from the question you wrote.",
      "This guide does not create a demo record, evaluate the song, or save a result.",
    ],
  },
};

export function getGarageBandPracticeStage(stage: ProjectStage): GarageBandPracticeStage | null {
  return PRACTICE_STAGE_BY_PROJECT_STAGE[stage] ?? null;
}

export function getGarageBandPracticeGuide(
  stage: GarageBandPracticeStage,
): GarageBandPracticeGuideContent {
  return PRACTICE_GUIDES[stage];
}
