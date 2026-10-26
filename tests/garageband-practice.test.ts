import assert from "node:assert/strict";
import test from "node:test";
import {
  GARAGEBAND_PRACTICE_STAGES,
  getGarageBandPracticeGuide,
  getGarageBandPracticeStage,
} from "../src/features/garageband/garageband-practice";

test("GarageBand guidance is available for the four creative stages and demo review", () => {
  assert.equal(getGarageBandPracticeStage("Melody"), "Melody");
  assert.equal(getGarageBandPracticeStage("Rhythm"), "Rhythm");
  assert.equal(getGarageBandPracticeStage("Harmony"), "Harmony");
  assert.equal(getGarageBandPracticeStage("Arrangement"), "Arrangement");
  assert.equal(getGarageBandPracticeStage("Review"), "Demo");
  assert.equal(getGarageBandPracticeStage("Lyrics"), null);
});

test("every practice guide contains the complete external listening flow", () => {
  for (const stage of GARAGEBAND_PRACTICE_STAGES) {
    const guide = getGarageBandPracticeGuide(stage);

    assert.equal(guide.stage, stage);
    assert.ok(guide.goal.length > 0);
    assert.ok(guide.questionPrompt.length > 0);
    assert.ok(guide.beforeOpen.length > 0);
    assert.ok(guide.inGarageBand.length > 0);
    assert.ok(guide.trySteps.length > 0);
    assert.ok(guide.listenFor.length > 0);
    assert.ok(guide.returnToWorkspace.length > 0);
  }
});
