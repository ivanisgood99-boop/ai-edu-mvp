# 1–5 基礎實作進度（2026-11-25）

本文件區分程式碼、資料庫、部署與驗收狀態；任何尚未通過真實帳號測試的功能都不標記為正式完成。

## 1. 帳號與資料安全

### 已準備
- 學生登入載入只信任 profiles 資料庫角色與 account_status。
- 新增舊版 answer_logs、student_progress、audit_logs 與兩張備份快照的封鎖遷移；不刪除任何資料。
- 新增 profile role/status 防自我提升保護。
- 新增 active admin / active teacher helper。
- 新增 profile admin select/update、教師只讀自己班級學生的政策。
- 資源、交易帳本、目錄、收藏、PK 與抽獎紀錄採本人／唯讀政策。
- 新增 SECURITY DEFINER search_path 固定與 anon 權限撤銷。
- 關閉舊版 apply_learning_action_reward(text,text) 的 anon／authenticated 執行權；該 RPC 接受前端自選獎勵代碼，現階段不應由瀏覽器直接觸發，僅保留 service_role 執行權。

### 尚未完成
- 兩筆新安全遷移尚未套用正式 Supabase；目前只在交易內連續執行並回滾。
- 需用第二個學生、教師與管理員測試身分完成實際 RLS 驗收。
- Supabase Security Advisor 需在遷移套用後重新檢查。

## 2. 學生端完整學習流程

### 已有
- Auth、學生首頁、學習地圖、Chapter/Level/X-1/X-2 路徑。
- 作答 RPC、private answer keys、伺服器端客觀題驗證、精熟度重算。
- 資源資料讀取與火箭補給 RPC。

### 尚未完成
- 真實瀏覽器註冊、登入、作答、刷新、登出再登入與跨帳號隔離。
- 全教材單元的完整內容品質審查。
- 引導題目前只保存 submitted，不是伺服器端可信 AI 語意評分。
- 跨裝置 E2E 與斷線重試測試。

## 3. 教師端

### 已新增前端與後端介面
- 教師申請 RPC：申請人由 auth.uid() 決定。
- 管理員審核 RPC：核准後才把 profile role 設為 teacher，並留下稽核紀錄。
- 教師建立班級 RPC：教師身分由 auth.uid() 決定，邀請碼由資料庫產生。
- 學生以邀請碼加入班級 RPC。
- 教師只可讀取自己班級、班級成員及所屬學生的學習統計。
- 前端頁面顯示班級、邀請碼、學生名單與完成關卡數。

### 尚未完成
- 安全遷移尚未正式套用；因此預覽端對資料庫的教師操作尚不能視為已啟用。
- 需教師帳號與學生帳號進行實際班級隔離測試。
- 教師端尚未有作業派發、課程進度設定、學習弱點報告匯出等功能。

## 4. 平台管理端

### 已新增
- 管理員專用資料讀取政策。
- 教師申請核准／退回 RPC。
- 帳號停用／恢復 RPC，寫入 platform_audit_logs。
- 管理介面顯示帳號、教師申請與最近稽核紀錄。
- 舊申請若沒有 applicant_id，禁止直接核准並要求人工核實。

### 尚未完成
- 目前正式資料庫只有一個已確認的 student profile，沒有可供實測的 admin profile。
- 管理員實際審核、停用、恢復及稽核紀錄的端到端測試尚未執行。
- 管理員角色授予流程仍須由可信任的初始管理者／service_role 操作，不能由一般使用者自行註冊取得。

## 5. 遊戲化基礎

### 已新增
- 五種資源各自顯示：學習點數、流星體力、火箭補給、星塵、寶石。
- 角色與造型目錄唯讀政策。
- 本人收藏／成就／PK／抽獎紀錄的唯讀政策。
- 角色與造型兌換 RPC：伺服器檢查價格、持有狀態與餘額，扣款、交易帳本與持有紀錄同交易完成。
- 角色與造型裝備 RPC：只能裝備本人持有物品。
- 前端星際收藏與資源中心。

### 尚未完成
- characters_catalog、skins_catalog、achievements 目前沒有目錄種子資料，因此商店與成就頁會顯示空狀態。
- PK 的題目池、配對、計分與結算規則尚未定義，僅保留本人紀錄讀取，不開放寫入。
- 星際探索的關卡與資料模型尚未定義。
- 機率型抽獎功能不在本輪實作範圍；不建立抽獎入口或新增抽獎玩法。
- 遊戲化功能需等安全遷移套用及帳號隔離測試通過後再啟用。

## 近期導覽與 Session 修正（2026-11-26）

- 導覽列現在依 Supabase profiles 的資料庫角色顯示可用頁面，不採信 localStorage 中的角色資訊。
- 教師班級資料表改為瀏覽器端唯讀；建立班級只能呼叫資料庫 RPC，由伺服器產生邀請碼，並撤銷直接寫入班級／入班序號的權限。
- 學生可透過安全的 membership helper 查看自己已加入的班級名稱；未加入的班級仍不可見。學生端收藏／資源中心已新增「我的班級」清單。
- 進入已保存的頁面前會重新查驗登入者角色；未登入、帳號停用或角色不符時，回到安全的登入／首頁路徑。
- 學生登入後重新顯示學習地圖與星際收藏入口；登出後清除前端角色狀態並恢復訪客導覽；訪客不會看到學習地圖或收藏入口。
- 教師與管理員頁面新增共用登出按鈕，避免非學生頁面沒有登出入口。
- E2E 測試計畫新增 NAV-01 至 NAV-05，涵蓋未登入、學生、教師、管理員導覽及教師／管理員登出。
- 六個應用 JavaScript 檔案及 index.html 的兩段 inline script 均通過本地語法解析檢查。
- 最新程式碼預覽已 READY，網址為 https://ai-edu-87wk14y6k-ivanisgood99-9815.vercel.app，對應程式提交 `4a0366e731b7aae132a6386fa930445fbb3faf57`（其後 PR head 僅新增 migration／文件提交）。
- 本次仍未完成真實瀏覽器登入測試；Vercel 預覽受 SSO 保護，且尚無專用教師／管理員測試帳號。

## 正式資料庫待處理的高優先級風險

- 本輪最後一次唯讀查核確認：正式 Supabase 的 `apply_learning_action_reward(text,text)` 目前仍授予 `anon` 與 `authenticated` EXECUTE 權限。函式本身會拒絕沒有 `auth.uid()` 的匿名呼叫；但已登入使用者仍可自行選擇獎勵代碼與參照值，函式並未驗證學習完成證據，因此存在自行觸發獎勵的風險。
- 正式 `answer_logs` 與 `teacher_applications` 目前各仍有 3 條舊的寬鬆政策。新 Migration 會移除這些政策並關閉舊 RPC 的瀏覽器執行權，但目前尚未套用，因此不能視為已修復。
- 這是正式環境的既存風險，不是本輪測試造成的；本輪沒有修改正式權限或刪除資料。需先完成相容性與真實帳號驗收，再由使用者明確授權套用安全 Migration。

## 本輪驗證

- 兩筆資料庫安全 migration 已在同一交易內連續執行，最後 ROLLBACK；SQL/DDL 沒有執行錯誤。
- 最新權限探針確認教師可透過 create_teacher_class RPC 建立班級，但直接 INSERT/UPDATE classes、直接 INSERT class_enrollments 及使用其序號皆無權限；學生仍可透過 join_class_by_invite_code RPC 加入。測試交易回滾後，班級列數仍為 0、測試帳號角色仍為 student、正式資料表舊政策仍維持原狀。
- 追加的班級可見範圍探針在同一回滾交易建立兩個班級，只讓學生加入其中一個；學生查詢只看見 1 個已加入班級，未加入班級不會洩漏。
- RPC 權限探針確認舊版自由選擇 action_code 的獎勵函式對 anon 與 authenticated 均不可執行；目前學生需要的體力同步與火箭補給 RPC 仍保留 authenticated 執行權。
- 教師申請 RPC 也以學生測試身分成功建立待審申請；整筆交易已回滾，正式 teacher_applications 筆數維持 3 筆。
- 交易回滾探針已模擬學生身分，確認本人 profile/resource 可讀、舊版 answer_logs 與備份快照無 SELECT 權限、學生無法直接 UPDATE 資源餘額。
- 交易回滾探針亦成功建立測試班級、用邀請碼加入班級，並確認學生自行把 role 改成 admin 會被阻擋；測試列已回滾。
- 這些是資料庫交易內測試，不等於真實瀏覽器 E2E。
- GitHub Actions run #79 的 JavaScript syntax job 通過；之後的最新六個 JS 檔案與兩段 inline script 亦重新解析成功。
- Vercel Preview 已自動部署開發分支，但專案有 SSO 保護；目前未完成真實瀏覽器視覺與帳號操作驗收。
- 正式 Supabase 尚未套用兩筆新 migration；正式資料未因本輪測試而改動。
- Supabase Security Advisor 目前仍反映正式資料庫的舊權限狀態（包括舊獎勵 RPC 與舊資料表政策）；因安全 migration 尚未套用，不能把分支中的修正視為正式環境已修復。套用後必須重新執行 Security Advisor。
- PR #3 保持 Draft，沒有合併或部署 GitHub Pages。


## 資源 RPC 安全補強（2026-11-27）

- 稽核發現舊版 `sync_student_stamina_and_rockets(p_tz)` 直接採用呼叫端傳入的時區計算每日火箭補給日期；登入者可在日期邊界嘗試切換時區，造成額外領取的風險。
- 新增於尚未套用的安全 migration：保留 `p_tz` 參數以維持舊前端 RPC 相容性，但伺服器固定使用 `Asia/Taipei` 計算每日 04:00 補給日，不再採信客戶端時區。
- 同一 migration 撤銷 `sync_student_stamina_and_rockets`、`use_rocket_supply` 的 PUBLIC／anon 執行權，只授權 authenticated；另撤銷 trigger function `guard_profile_update` 的一般 API 執行權。
- 兩筆安全 migration 再次於同一交易執行並 ROLLBACK；以 authenticated 測試身分傳入 `Pacific/Kiritimati`，函式仍回傳伺服器台北日期 `2026-11-27`。權限探針確認 anon=false、authenticated=true。測試交易已回滾，正式資源餘額及日期未變更。
- 以上是分支中的待部署修正；正式資料庫目前仍維持舊函式定義與舊權限，尚未修復。正式 migration 仍需相容性驗收及使用者明確授權。


## 課程來源與跨裝置進度修正（2026-11-28）

- 發現舊版學習地圖直接讀取 `curriculum-data.js`，但內容與教學引擎的實際 Level 不一致：地圖列出的章節／關卡數量可能多於或少於可執行的教學關卡。
- 學習地圖現在由 `TeachingEngineModule.chapters` 與 `TeachingEngineModule.levels` 產生，教學引擎成為實際課程關卡的單一執行來源；預設進入使用者先前指定的第二章「直線與圓」。
- 發現教學引擎原先以本機儲存的完成紀錄判斷 X-2 解鎖，登入另一台裝置時可能與資料庫已保存的 X-1 進度衝突。現在將 Supabase Auth UID 作為已登入使用者的本機進度命名空間，並合併伺服器 `learning_statistics` 的 X-1／X-2 完成狀態；不同 UID 不會共用伺服器解鎖狀態。
- 精熟度與關卡總結狀態會優先顯示伺服器計算結果；本機尚待同步的有效證據仍可保留在本機流程中，總結提交前仍會先 flush 作答同步佇列。
- 追加待部署 migration `20261128120000_require_active_student_for_learning_writes.sql`：`record_learning_answer` 與 `save_summary_and_recompute_level` 均在資料庫端要求 `auth.uid()` 對應的 profile 必須是 active student，避免停用帳號或教師／管理員直接呼叫學生學習寫入 RPC。
- 三筆待部署安全 migration 已在單一交易內連續執行並回滾；有效學生呼叫作答 RPC 成功，模擬 suspended profile 後，作答 RPC 與總結 RPC 均被拒絕。回滾後正式 profile 仍為 active、學習紀錄仍為 6 筆、學習統計仍為 2 筆，三筆待部署 migration 均未登記於正式 migration history。
- 新增 Node.js 自動化測試，驗證學習地圖與教學引擎 Level 清單一致、伺服器已保存 X-1 能解鎖跨裝置 X-2，以及不同帳號不會沿用他人的解鎖狀態。CI 首次執行時發現測試本身的跨 VM 陣列比較問題，已修正測試程式並等待重跑；不能把該次失敗描述為功能測試通過。


## 最新預覽與 CI（2026-11-28）

- 最新 PR head：`235e68e336b159062e62773128ca8705bd972db4`。
- 最新 Vercel Preview：READY，https://ai-edu-oc41uuwxu-ivanisgood99-9815.vercel.app；Vercel 專案啟用 SSO，尚未完成真實帳號瀏覽器 E2E。
- 最新 GitHub Actions run #146：JavaScript syntax 與 `node --test tests/*.test.js` 均成功。
- 最新 Netlify deploy preview：success。
- 已透過受保護預覽讀取 HTML、`student-home.js`、`teaching-engine.js` 與 `curriculum-data.js`，確認預覽提供新課程來源與伺服器進度程式碼；這不是互動瀏覽器 E2E。
