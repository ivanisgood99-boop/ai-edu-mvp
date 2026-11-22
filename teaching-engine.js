/* 嚴格 Stage 線性解鎖順序：1-1 -> 1-2 -> 2-1 -> 2-2 -> 3-1 -> 3-2 ...（依 Chapter 內順序） */
  function getOrderedChapterStages(chapterId) {
    var chLvs = LEVELS.filter(function (l) { return l.chapterId === chapterId; })
      .sort(function (a, b) { return a.levelNumber - b.levelNumber; });
    var seq = [];
    chLvs.forEach(function (lv) {
      seq.push({
        key: lv.levelId + "::X-1",
        code: lv.levelNumber + "-1",
        stageCode: "X-1",
        levelId: lv.levelId,
        levelNumber: lv.levelNumber,
        levelTitle: lv.title,
        stageTitle: "觀念學習"
      });
      seq.push({
        key: lv.levelId + "::X-2",
        code: lv.levelNumber + "-2",
        stageCode: "X-2",
        levelId: lv.levelId,
        levelNumber: lv.levelNumber,
        levelTitle: lv.title,
        stageTitle: "刷題練習"
      });
    });
    return seq;
  }

  function isStageFormallyCompleted(ses, stageCode) {
    if (!ses || !Array.isArray(ses.logs)) return false;
    if (stageCode === "X-1") {
      // 必須通過引導問題且完成至少一題理解檢查，才算完成 Stage X-1
      var guidePassed = ses.logs.some(function (l) { return l.stageType === "guide" && l.isCorrect; });
      var checkPassed = ses.logs.some(function (l) { return l.stageType === "check" && l.isCorrect; });
      return Boolean(ses.stage1Completed && guidePassed && checkPassed);
    }
    if (stageCode === "X-2") {
      // 必須完成互動練習或個人化加強作答，才算完成 Stage X-2
      var pracOrRemPassed = ses.logs.some(function (l) {
        return (l.stageType === "practice" || l.stageType === "remedial") && l.isCorrect;
      });
      return Boolean(ses.stage2Completed && pracOrRemPassed);
    }
    return false;
  }

  function getStrictStageAccess(sid, levelId, stageCode) {
    var lv = LEVEL_MAP[levelId] || LEVELS[0];
    var seq = getOrderedChapterStages(lv.chapterId);
    var targetKey = lv.levelId + "::" + stageCode;
    var idx = seq.findIndex(function (item) { return item.key === targetKey; });
    var curSes = Repo.getSession(sid, lv.levelId);
    var completed = isStageFormallyCompleted(curSes, stageCode);

    if (idx <= 0) {
      return {
        allowed: true,
        completed: completed,
        status: completed ? "completed" : "available",
        statusText: completed
          ? "已完成 Stage " + seq[0].code + "｜" + seq[0].stageTitle + "（可重新查看）。"
          : "目前可進行 Stage " + seq[0].code + "｜" + seq[0].stageTitle + "。"
      };
    }

    var prev = seq[idx - 1];
    var prevSes = Repo.getSession(sid, prev.levelId);
    var prevDone = isStageFormallyCompleted(prevSes, prev.stageCode);

    if (!prevDone) {
      return {
        allowed: false,
        completed: false,
        status: "locked",
        statusText: "完成 Stage " + prev.code + "｜" + prev.stageTitle + "，才能解鎖 Stage " + seq[idx].code + "｜" + seq[idx].stageTitle + "。"
      };
    }

    return {
      allowed: true,
      completed: completed,
      status: completed ? "completed" : "available",
      statusText: completed
        ? "已完成 Stage " + seq[idx].code + "｜" + seq[idx].stageTitle + "（可重新查看）。"
        : "目前可進行 Stage " + seq[idx].code + "｜" + seq[idx].stageTitle + "。"
    };
  }
