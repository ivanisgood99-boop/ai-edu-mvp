/* 108課綱・南一版高一上課程資料模組（與教學引擎分離，可獨立擴充） */
(function () {
  "use strict";

  var CURRICULUM_DATA = {
    version: "108-nani-g10s1-v1",
    chapters: [
      {
        chapterId: "CH-1",
        chapterNumber: 1,
        title: "實數與指對數",
        curriculumRef: "108課綱 高中數學 A／普通型 數與式、指對數",
        textbookVersion: "南一版高一上（1-1 ～ 1-4）",
        themeClass: "galaxy-amber-nebula",
        finalAssessment: {
          id: "FINAL-CH-1",
          title: "實數與指對數・星系最終評量",
          unlockRule: "需完成本章所有 Level 的觀念學習與練習應用"
        },
        levels: [
          {
            levelId: "CH1-L1",
            levelNumber: 1,
            title: "實數系與有理化",
            concepts: ["有理數與無理數", "循環小數與分數", "根式化簡與分母有理化"],
            objectives: ["辨識實數分類與小數表示", "熟練根式運算與有理化技巧"],
            prerequisites: ["國中算術與平方根概念"],
            curriculumRef: "108課綱 實數系與根式運算",
            textbookVersion: "南一版高一上 1-1 實數",
            planetStyle: "planet-amber",
            lessons: ["實數包含有理數與無理數，數線上每一點皆對應唯一實數。", "分母含有根式時，常透過乘以共軛式進行有理化。"],
            stages: {
              "X-1": { label: "觀念學習", steps: ["1. 教材學習", "2. 引導問題", "3. 理解檢查"] },
              "X-2": { label: "練習應用", steps: ["1. 互動練習", "2. 個人化加強", "3. 學習總結"] }
            }
          },
          {
            levelId: "CH1-L2",
            levelNumber: 2,
            title: "絕對值與數線距離",
            concepts: ["絕對值幾何意義", "數線兩點距離", "絕對值方程式與不等式"],
            objectives: ["以距離觀點理解 |x - a|", "解基礎絕對值方程式與不等式"],
            prerequisites: ["CH1-L1 實數系與有理化"],
            curriculumRef: "108課綱 絕對值與不等式",
            textbookVersion: "南一版高一上 1-2 絕對值",
            planetStyle: "planet-cyan",
            lessons: ["|a - b| 表示數線上 a 與 b 兩點間的距離。", "|x - a| < r 代表與 a 的距離小於 r 的實數範圍。"],
            stages: {
              "X-1": { label: "觀念學習", steps: ["1. 教材學習", "2. 引導問題", "3. 理解檢查"] },
              "X-2": { label: "練習應用", steps: ["1. 互動練習", "2. 個人化加強", "3. 學習總結"] }
            }
          },
          {
            levelId: "CH1-L3",
            levelNumber: 3,
            title: "指數律與次方延伸",
            concepts: ["正整數次方", "零次方與負整數次方", "有理數指數與指數律"],
            objectives: ["整合正整數與零次方並延伸至有理數指數", "正確運用指數律化簡算式"],
            prerequisites: ["CH1-L1 實數系與有理化"],
            curriculumRef: "108課綱 指數定義與指數律",
            textbookVersion: "南一版高一上 1-3 指數",
            planetStyle: "planet-violet",
            lessons: ["底數不為 0 時 a^0 = 1；a^(-n) = 1 / a^n。", "在底數正數條件下，指數律可延伸至有理數次方。"],
            stages: {
              "X-1": { label: "觀念學習", steps: ["1. 教材學習", "2. 引導問題", "3. 理解檢查"] },
              "X-2": { label: "練習應用", steps: ["1. 互動練習", "2. 個人化加強", "3. 學習總結"] }
            }
          },
          {
            levelId: "CH1-L4",
            levelNumber: 4,
            title: "常用對數與科學記號",
            concepts: ["常用對數 log10", "對數運算律", "首數與尾數應用"],
            objectives: ["理解常用對數與指數的互換", "運用常用對數分析位數與首位數字"],
            prerequisites: ["CH1-L3 指數律與次方延伸"],
            curriculumRef: "108課綱 常用對數",
            textbookVersion: "南一版高一上 1-4 常用對數",
            planetStyle: "planet-emerald",
            lessons: ["當 a > 0 且 10^x = a 時，稱 x 為以 10 為底的常用對數，記為 log a。", "透過科學記號拆解位數與首位數字。"],
            stages: {
              "X-1": { label: "觀念學習", steps: ["1. 教材學習", "2. 引導問題", "3. 理解檢查"] },
              "X-2": { label: "練習應用", steps: ["1. 互動練習", "2. 個人化加強", "3. 學習總結"] }
            }
          }
        ]
      },
      {
        chapterId: "CH-2",
        chapterNumber: 2,
        title: "直線與圓",
        curriculumRef: "108課綱 直線方程式與圓方程式",
        textbookVersion: "南一版高一上（2-1 ～ 2-4）",
        themeClass: "galaxy-cyan-nebula",
        finalAssessment: {
          id: "FINAL-CH-2",
          title: "直線與圓・星系最終評量",
          unlockRule: "需完成本章所有 Level 的觀念學習與練習應用"
        },
        levels: [
          {
            levelId: "CH2-L1",
            levelNumber: 1,
            title: "坐標平面與直線斜率",
            concepts: ["兩點距離與分點公式", "直線斜率定義", "共線與傾斜程度"],
            objectives: ["計算坐標平面上兩點距離與分點", "由兩點坐標求出直線斜率"],
            prerequisites: ["CH1-L2 絕對值與數線距離"],
            curriculumRef: "108課綱 坐標與斜率",
            textbookVersion: "南一版高一上 2-1 直線方程式及其圖形",
            planetStyle: "planet-cyan",
            lessons: ["斜率 m = (y2 - y1) / (x2 - x1)（x1 ≠ x2），描述直線上升或下降的陡峭程度。"],
            stages: {
              "X-1": { label: "觀念學習", steps: ["1. 教材學習", "2. 引導問題", "3. 理解檢查"] },
              "X-2": { label: "練習應用", steps: ["1. 互動練習", "2. 個人化加強", "3. 學習總結"] }
            }
          },
          {
            levelId: "CH2-L2",
            levelNumber: 2,
            title: "直線方程式與圖形",
            concepts: ["點斜式與斜截式", "直線一般式", "平行與垂直關係"],
            objectives: ["依條件寫出直線方程式", "判斷兩直線平行或垂直"],
            prerequisites: ["CH2-L1 坐標平面與直線斜率"],
            curriculumRef: "108課綱 直線方程式",
            textbookVersion: "南一版高一上 2-1 直線方程式及其圖形",
            planetStyle: "planet-violet",
            lessons: ["點斜式：y - y0 = m(x - x0)；兩非鉛直線平行則斜率相等，垂直則斜率乘積為 -1。"],
            stages: {
              "X-1": { label: "觀念學習", steps: ["1. 教材學習", "2. 引導問題", "3. 理解檢查"] },
              "X-2": { label: "練習應用", steps: ["1. 互動練習", "2. 個人化加強", "3. 學習總結"] }
            }
          },
          {
            levelId: "CH2-L3",
            levelNumber: 3,
            title: "直線方程式的應用",
            concepts: ["點到直線距離", "平行線間距離", "二元一次不等式與區域"],
            objectives: ["計算點到直線的垂直距離", "判別點與直線的相對位置"],
            prerequisites: ["CH2-L2 直線方程式與圖形"],
            curriculumRef: "108課綱 點線距離與不等式圖解",
            textbookVersion: "南一版高一上 2-2 直線方程式的應用",
            planetStyle: "planet-amber",
            lessons: ["點 P(x0, y0) 到直線 ax + by + c = 0 的距離為 |ax0 + by0 + c| / sqrt(a^2 + b^2)。"],
            stages: {
              "X-1": { label: "觀念學習", steps: ["1. 教材學習", "2. 引導問題", "3. 理解檢查"] },
              "X-2": { label: "練習應用", steps: ["1. 互動練習", "2. 個人化加強", "3. 學習總結"] }
            }
          },
          {
            levelId: "CH2-L4",
            levelNumber: 4,
            title: "圓方程式與幾何特徵",
            concepts: ["圓的標準式", "圓的一般式與配方法", "點與圓的位置關係"],
            objectives: ["由圓心與半徑建立圓方程式", "由一般式配方求出圓心與半徑"],
            prerequisites: ["CH2-L1 坐標平面與直線斜率"],
            curriculumRef: "108課綱 圓方程式",
            textbookVersion: "南一版高一上 2-3 圓方程式",
            planetStyle: "planet-emerald",
            lessons: ["圓心 (h, k)、半徑 r 的圓方程式為 (x - h)^2 + (y - k)^2 = r^2。"],
            stages: {
              "X-1": { label: "觀念學習", steps: ["1. 教材學習", "2. 引導問題", "3. 理解檢查"] },
              "X-2": { label: "練習應用", steps: ["1. 互動練習", "2. 個人化加強", "3. 學習總結"] }
            }
          },
          {
            levelId: "CH2-L5",
            levelNumber: 5,
            title: "圓與直線的關係",
            concepts: ["圓心到直線距離與半徑比較", "相交、相切、不相交", "圓的切線概念"],
            objectives: ["利用圓心到直線距離判別圓與直線關係", "求過圓上一點或特定條件的切線"],
            prerequisites: ["CH2-L3 直線方程式的應用", "CH2-L4 圓方程式與幾何特徵"],
            curriculumRef: "108課綱 圓與直線的位置關係",
            textbookVersion: "南一版高一上 2-4 圓與直線的關係",
            planetStyle: "planet-violet",
            lessons: ["比較圓心到直線距離 d 與半徑 r：d < r 交兩點、d = r 相切、d > r 不相交。"],
            stages: {
              "X-1": { label: "觀念學習", steps: ["1. 教材學習", "2. 引導問題", "3. 理解檢查"] },
              "X-2": { label: "練習應用", steps: ["1. 互動練習", "2. 個人化加強", "3. 學習總結"] }
            }
          }
        ]
      },
      {
        chapterId: "CH-3",
        chapterNumber: 3,
        title: "多項式函數",
        curriculumRef: "108課綱 多項式運算、函數圖形與不等式",
        textbookVersion: "南一版高一上（3-1 ～ 3-3）",
        themeClass: "galaxy-violet-nebula",
        finalAssessment: {
          id: "FINAL-CH-3",
          title: "多項式函數・星系最終評量",
          unlockRule: "需完成本章所有 Level 的觀念學習與練習應用"
        },
        levels: [
          {
            levelId: "CH3-L1",
            levelNumber: 1,
            title: "多項式運算與除法定理",
            concepts: ["多項式除法與綜合除法", "餘式定理", "因式定理與一次因式檢驗法"],
            objectives: ["熟練除法算式與綜合除法", "運用餘式定理與因式定理求餘式或因式"],
            prerequisites: ["CH1-L3 指數律與次方延伸"],
            curriculumRef: "108課綱 多項式除法、餘式與因式定理",
            textbookVersion: "南一版高一上 3-1 多項式的運算與應用",
            planetStyle: "planet-violet",
            lessons: ["f(x) 除以 (x - a) 的餘式為 f(a)；f(a) = 0 是 (x - a) 為 f(x) 因式的充要條件。"],
            stages: {
              "X-1": { label: "觀念學習", steps: ["1. 教材學習", "2. 引導問題", "3. 理解檢查"] },
              "X-2": { label: "練習應用", steps: ["1. 互動練習", "2. 個人化加強", "3. 學習總結"] }
            }
          },
          {
            levelId: "CH3-L2",
            levelNumber: 2,
            title: "多項式函數與圖形特徵",
            concepts: ["二次函數配方法與極值", "三次函數對稱中心", "首項係數與函數值趨勢"],
            objectives: ["分析多項式函數圖形走向與對稱性", "連結函數值正負與圖形位置"],
            prerequisites: ["CH3-L1 多項式運算與除法定理"],
            curriculumRef: "108課綱 多項式函數及其圖形",
            textbookVersion: "南一版高一上 3-2 多項式函數及其圖形",
            planetStyle: "planet-cyan",
            lessons: ["三次函數 f(x) = ax^3 + bx^2 + cx + d（a ≠ 0）的圖形具有反曲點（對稱中心）。"],
            stages: {
              "X-1": { label: "觀念學習", steps: ["1. 教材學習", "2. 引導問題", "3. 理解檢查"] },
              "X-2": { label: "練習應用", steps: ["1. 互動練習", "2. 個人化加強", "3. 學習總結"] }
            }
          },
          {
            levelId: "CH3-L3",
            levelNumber: 3,
            title: "多項式不等式",
            concepts: ["因式分解與數線標根法", "重根與正負號變化", "高次不等式解集合"],
            objectives: ["以因式分解解多項式不等式", "正確判讀重根處是否變號"],
            prerequisites: ["CH3-L1 多項式運算與除法定理", "CH3-L2 多項式函數與圖形特徵"],
            curriculumRef: "108課綱 多項式不等式",
            textbookVersion: "南一版高一上 3-3 多項式不等式",
            planetStyle: "planet-amber",
            lessons: ["將多項式不等式化為與 0 比較並因式分解後，依各根大小在數線上分段判別正負。"],
            stages: {
              "X-1": { label: "觀念學習", steps: ["1. 教材學習", "2. 引導問題", "3. 理解檢查"] },
              "X-2": { label: "練習應用", steps: ["1. 互動練習", "2. 個人化加強", "3. 學習總結"] }
            }
          }
        ]
      }
    ]
  };

  window.CurriculumDataModule = CURRICULUM_DATA;
})();
