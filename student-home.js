var bS1 = document.getElementById("sh-enter-s1");
    if (bS1) {
      bS1.addEventListener("click", function () {
        var sidNow = getStudentName();
        var lvId = state.selectedLevelId || "CH2-L1";
        if (eng && eng.repository && typeof eng.repository.getSession === "function") {
          var ses1 = eng.repository.getSession(sidNow, lvId);
          ses1.stageCode = "X-1";
          if (!ses1.subStep || ses1.subStep > 3) ses1.subStep = 1;
          if (typeof eng.repository.saveAndSyncMastery === "function") {
            eng.repository.saveAndSyncMastery(ses1);
          }
        }
        if (typeof window.__openTeachingEngineForNode === "function") {
          window.__openTeachingEngineForNode(lvId, "X-1");
        }
      });
    }

    var bS2 = document.getElementById("sh-enter-s2");
    if (bS2) {
      bS2.addEventListener("click", function () {
        var sidNow = getStudentName();
        var lvId = state.selectedLevelId || "CH2-L1";
        if (eng && typeof eng.canAccessStage === "function") {
          var acc = eng.canAccessStage(sidNow, lvId, "X-2");
          if (acc && !acc.allowed) return;
        }
        if (eng && eng.repository && typeof eng.repository.getSession === "function") {
          var ses2 = eng.repository.getSession(sidNow, lvId);
          ses2.stageCode = "X-2";
          if (!ses2.subStep || ses2.subStep < 4) ses2.subStep = 4;
          if (typeof eng.repository.saveAndSyncMastery === "function") {
            eng.repository.saveAndSyncMastery(ses2);
          }
        }
        if (typeof window.__openTeachingEngineForNode === "function") {
          window.__openTeachingEngineForNode(lvId, "X-2");
        }
      });
    }

    var bFinal = document.getElementById("sh-open-final");
    if (bFinal && chComp && chComp.allCompleted) {
      bFinal.addEventListener("click", function () {
        var lastLv = chComp.levels[chComp.levels.length - 1];
        if (!lastLv) return;
        if (typeof window.__openTeachingEngineForNode === "function") {
          window.__openTeachingEngineForNode(lastLv.levelId, "X-2");
        }
      });
    }
