/* 第二階段：Chapter -> Level -> Stage 關卡架構與解鎖狀態機 */
(function () {
  "use strict";

  var CURRICULUM_CHAPTERS = {
    "CH-1": {
      chapterId: "CH-1",
      chapterNumber: 1,
      title: "數與式",
      curriculumTag: "108課綱・高一上",
      finalAssessmentId: "CH-1-FINAL",
      levels: [
        {
          levelId: "CH1-L1",
          chapterId: "CH-1",
          levelNumber: 1,
          title: "正整數次方",
          legacyNodeId: "M1-01",
          stages: [
            { stageId: "CH1-L1-S1", code: "1-1", category: "concept", title: "觀念學習", subSteps: ["教材學習", "引導問題", "理解檢查"] },
            { stageId: "CH1-L1-S2", code: "1-2", category: "practice", title: "刷題練習", subSteps: ["互動練習", "個人化加強", "學習總結"] }
          ]
        },
        {
          levelId: "CH1-L2",
          chapterId: "CH-1",
          levelNumber: 2,
          title: "零次方",
          legacyNodeId: "M1-02",
          stages: [
            { stageId: "CH1-L2-S1", code: "2-1", category: "concept", title: "觀念學習", subSteps: ["教材學習", "引導問題", "理解檢查"] },
            { stageId: "CH1-L2-S2", code: "2-2", category: "practice", title: "刷題練習", subSteps: ["互動練習", "個人化加強", "學習總結"] }
          ]
        }
      ]
    },
    "CH-2": {
      chapterId: "CH-2",
      chapterNumber: 2,
      title: "直線與圓",
      curriculumTag: "108課綱・高一上",
      finalAssessmentId: "CH-2-FINAL",
      levels: [
        {
          levelId: "CH2-L1",
          chapterId: "CH-2",
          levelNumber: 1,
          title: "坐標平面與點的關係",
          legacyNodeId: "LC-01",
          stages: [
            { stageId: "CH2-L1-S1", code: "1-1", category: "concept", title: "觀念學習", subSteps: ["教材學習", "引導問題", "理解檢查"] },
            { stageId: "CH2-L1-S2", code: "1-2", category: "practice", title: "刷題練習", subSteps: ["互動練習", "個人化加強", "學習總結"] }
          ]
        },
        {
          levelId: "CH2-L2",
          chapterId: "CH-2",
          levelNumber: 2,
          title: "直線的斜率",
          legacyNodeId: "LC-02",
          stages: [
            { stageId: "CH2-L2-S1", code: "2-1", category: "concept", title: "觀念學習", subSteps: ["教材學習", "引導問題", "理解檢查"] },
            { stageId: "CH2-L2-S2", code: "2-2", category: "practice", title: "刷題練習", subSteps: ["互動練習", "個人化加強", "學習總結"] }
          ]
        },
        {
          levelId: "CH2-L3",
          chapterId: "CH-2",
          levelNumber: 3,
          title: "直線方程式",
          legacyNodeId: "LC-03",
          stages: [
            { stageId: "CH2-L3-S1", code: "3-1", category: "concept", title: "觀念學習", subSteps: ["教材學習", "引導問題", "理解檢查"] },
            { stageId: "CH2-L3-S2", code: "3-2", category: "practice", title: "刷題練習", subSteps: ["互動練習", "個人化加強", "學習總結"] }
          ]
        },
        {
          levelId: "CH2-L4",
          chapterId: "CH-2",
          levelNumber: 4,
          title: "圓的基本概念與方程式",
          legacyNodeId: "LC-04",
          stages: [
            { stageId: "CH2-L4-S1", code: "4-1", category: "concept", title: "觀念學習", subSteps: ["教材學習", "引導問題", "理解檢查"] },
            { stageId: "CH2-L4-S2", code: "4-2", category: "practice", title: "刷題練習", subSteps: ["互動練習", "個人化加強", "學習總結"] }
          ]
        },
        {
          levelId: "CH2-L5",
          chapterId: "CH-2",
          levelNumber: 5,
          title: "直線與圓的位置關係",
          legacyNodeId: "LC-05",
          stages: [
            { stageId: "CH2-L5-S1", code: "5-1", category: "concept", title: "觀念學習", subSteps: ["教材學習", "引導問題", "理解檢查"] },
            { stageId: "CH2-L5-S2", code: "5-2", category: "practice", title: "刷題練習", subSteps: ["互動練習", "個人化加強", "學習總結"] }
          ]
        },
        {
          levelId: "CH2-L6",
          chapterId: "CH-2",
          levelNumber: 6,
          title: "直線與圓的綜合應用",
          legacyNodeId: "LC-06",
          stages: [
            { stageId: "CH2-L6-S1", code: "6-1", category: "concept", title: "觀念學習", subSteps: ["教材學習", "引導問題", "理解檢查"] },
            { stageId: "CH2-L6-S2", code: "6-2", category: "practice", title: "刷題練習", subSteps: ["互動練習", "個人化加強", "學習總結"] }
          ]
        }
      ]
    },
    "CH-3": {
      chapterId: "CH-3",
      chapterNumber: 3,
      title: "多項式",
      curriculumTag: "108課綱・高一上",
      finalAssessmentId: "CH-3-FINAL",
      levels: [
        {
          levelId: "CH3-L1",
          chapterId: "CH-3",
          levelNumber: 1,
          title: "多項式的定義與四則運算",
          legacyNodeId: "PY-01",
          stages: [
            { stageId: "CH3-L1-S1", code: "1-1", category: "concept", title: "觀念學習", subSteps: ["教材學習", "引導問題", "理解檢查"] },
            { stageId: "CH3-L1-S2", code: "1-2", category: "practice", title: "刷題練習", subSteps: ["互動練習", "個人化加強", "學習總結"] }
          ]
        },
        {
          levelId: "CH3-L2",
          chapterId: "CH-3",
          levelNumber: 2,
          title: "除法原理、餘式定理與因式定理",
          legacyNodeId: "PY-02",
          stages: [
            { stageId: "CH3-L2-S1", code: "2-1", category: "concept", title: "觀念學習", subSteps: ["教材學習", "引導問題", "理解檢查"] },
            { stageId: "CH3-L2-S2", code: "2-2", category: "practice", title: "刷題練習", subSteps: ["互動練習", "個人化加強", "學習總結"] }
          ]
        }
      ]
    }
  };

  function evaluateChapterUnlockState(chapterId, completedStageMap) {
    var ch = CURRICULUM_CHAPTERS[chapterId];
    if (!ch) return { unlockedFinalAssessment: false, completedLevelsCount: 0, totalLevelsCount: 0 };
    var doneMap = completedStageMap || {};
    var completedLevels = 0;

    var levelStatuses = ch.levels.map(function (lvl) {
      var s1Done = Boolean(doneMap[lvl.stages[0].stageId]);
      var s2Done = Boolean(doneMap[lvl.stages[1].stageId]);
      var levelCompleted = s1Done && s2Done;
      if (levelCompleted) completedLevels += 1;
      return {
        levelId: lvl.levelId,
        title: lvl.title,
        stage1Completed: s1Done,
        stage2Unlocked: s1Done,
        stage2Completed: s2Done,
        levelCompleted: levelCompleted
      };
    });

    return {
      chapterId: ch.chapterId,
      completedLevelsCount: completedLevels,
      totalLevelsCount: ch.levels.length,
      allLevelsCompleted: completedLevels === ch.levels.length,
      unlockedFinalAssessment: completedLevels === ch.levels.length,
      levels: levelStatuses
    };
  }

  window.CurriculumHierarchyModule = {
    chapters: CURRICULUM_CHAPTERS,
    evaluateChapterUnlockState: evaluateChapterUnlockState
  };
})();
