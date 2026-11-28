# 伺服器端 AI 引導評量設計

## 範圍

此階段建立伺服器端 AI 評量基礎，涵蓋目前課程目錄的 10 個 Level。它不是已啟用的正式 AI 功能；Edge Function 尚未部署，正式資料庫 migration 尚未套用，也尚未設定模型 Secret。

## 請求流程

1. 瀏覽器只送出登入 session、Level ID、Guide question ID、學生答案、固定 client submission UUID 與提示次數。
2. Supabase Edge Function 驗證 Supabase Auth JWT，再由伺服器確認 `profiles.role='student'` 且 `account_status='active'`。
3. 伺服器用 service-only RPC 讀取 `private.learning_guide_rubrics`；瀏覽器不能讀取或覆寫評分規準。
4. 伺服器對學生答案做長度限制，將答案當成不可信輸入，要求模型輸出符合 JSON Schema 的評量結果。
5. 伺服器檢查評分欄位與 pass 門檻，再透過 service-only RPC 寫入 `ai_evaluation`。
6. Edge Function 使用學生自己的 JWT 呼叫總結重算 RPC。X-1 只有在 Guide 評量通過且必要理解檢查通過時才完成。
7. 相同 UUID 重試會讀回既有評量，不會再次建立作答紀錄；每位學生另有每分鐘及每日模型呼叫上限。

## 評分規則

- 模型只回傳 `pass / partial / incorrect / unclear`、0–4 分、簡短回饋、缺少概念與下一個引導問題。
- 3–4 分才可判定 pass；0–2 分不得判定 pass。
- 接受數學上等價的表達，不以用詞、文筆或答案長短單獨判斷。
- 不直接揭露完整解答；不確定時採保守評分，提供一個下一步引導問題。
- 模型結果必須符合 schema，且由伺服器驗證後才寫入正式學習紀錄。

## 安全邊界

- Edge Function 要求有效登入 JWT；只接受 active student。
- 私有 rubric 表啟用 RLS，沒有瀏覽器角色政策；只授予 service_role 讀取。
- 評分寫入、rubric 讀取、配額保留 RPC 均只授予 service_role。
- 舊的瀏覽器直接 guide RPC 被撤銷；一般題目仍使用 idempotent answer RPC。
- 模型金鑰只讀取 `OPENAI_API_KEY` server Secret；不可放入前端、HTML、Git 或聊天訊息。
- 目前預設模型為 `gpt-4o-mini`，可由 `OPENAI_MODEL` server Secret 覆寫。
- 每個學生每分鐘最多 12 次、每日最多 120 次評量請求；重試已存在 UUID 不消耗模型額度。

## 上線前必要步驟

1. 先在非正式環境驗證 migration、RPC 權限與 Edge Function。
2. 設定 Supabase Edge Function Secrets：`OPENAI_API_KEY`、可選的 `OPENAI_MODEL`。
3. 取得明確授權後，才部署 Edge Function 與套用資料庫 migration。
4. 以教師審查的 10 組正確、部分正確、錯誤、含提示注入答案做評量品質測試。
5. 確認模型成本與使用上限，並由家長／監護人同意任何可能產生費用的 API 使用。
6. 通過測試前不可宣稱 AI 評分已正式啟用。
