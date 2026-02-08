# SDD — Note Tool Frontend (Cards + Boards)

**1. 目標**
1. 卡片 CRUD（Markdown）
2. 卡片可切換檢視/編輯
3. 側邊欄導覽（白板 / 卡片盒）
4. 卡片盒可搜尋（關鍵字 + 白板）
5. 白板內可新增卡片，新增後同步出現在卡片盒
6. 卡片展開方式可由使用者設定（Modal / 右側面板），設定需寫入 DB

**2. 使用者流程**
1. 登入後進入 `/boards`
2. 左側側邊欄顯示 `白板` 與 `卡片盒`
3. 卡片盒顯示全部卡片並支援搜尋
4. 點擊卡片以設定的展開方式顯示內容（Modal / 右側面板）
5. 進入白板後可直接新增卡片，新增成功後同步至卡片盒

**3. 頁面與元件**
1. `/cards`  
   搜尋列 + 卡片列表 + 新增
2. `/cards/[id]`  
   Markdown 檢視 / 編輯 / 分割預覽
3. `/boards`  
   白板列表（右下新增按鈕）
4. `/boards/[id]`  
   白板互動（拖曳、縮放、工具列）

元件清單：
1. `Sidebar`
2. `CardList`
3. `CardDetail`
4. `MarkdownViewer`（`react-markdown` + `remark-gfm`）
5. `MarkdownEditor`（`textarea`）
6. `BoardList`
7. `BoardCanvas`

**4. 卡片盒列表規格**
1. 顯示 `title` + `content` 摘要
2. 摘要字數固定（預設 120 字，可由使用者設定）
3. 點擊卡片以設定的展開方式顯示內容

**5. 展開方式設定（需寫入 DB）**
1. 預設值：`cardOpenMode = "modal"`
2. 可選值：`"modal"` 或 `"sidepanel"`
3. 其他可擴充設定：`cardPreviewLength`（摘要字數）
4. DB 欄位：`note_tool.users.settings JSONB`
5. 範例：
```json
{
  "cardOpenMode": "modal",
  "cardPreviewLength": 120,
  "theme": "light"
}
```

**6. Markdown 技術選擇（輕量/高效能）**
1. 檢視：`react-markdown` + `remark-gfm`
2. 編輯：`textarea`
3. 不使用大型 WYSIWYG 以維持效能與 bundle 小
4. 支援表格、引用、核取方塊、刪除線等 GFM 語法

**7. 白板互動規格**
1. 模式：`pan`（手形）/ `add`（新增）
2. `pan`：左鍵拖曳平移、滾輪縮放
3. `add`：左鍵新增、拖曳卡片、滾輪縮放、中鍵平移
4. 右下工具列按鈕可展開/收合

**8. UI 行為**
1. Modal / Sidepanel 的切換按鈕出現在卡片盒與白板頁面右上
2. Sidepanel 開啟時，內容區域自動留白避免被遮住
3. Modal / Sidepanel 不提供 split（split 只在全頁卡片）
4. 白板列表顯示卡片數目

**9. API 契約（既有 + 預期）**
1. Cards
2. `GET /note_tool/card`  
3. `POST /note_tool/card`
4. `PUT /note_tool/card/:cardId`
5. `DELETE /note_tool/card/:cardId`
6. User settings
7. `GET /note_tool/user/settings`
8. `PUT /note_tool/user/settings`
9. Boards
10. `GET /note_tool/board`
11. `POST /note_tool/board`
12. `GET /note_tool/board/:boardId`
13. `POST /note_tool/board/:boardId/cards`
14. `POST /note_tool/board/:boardId/cards/:cardId`
15. `PUT /note_tool/board/:boardId/cards/:cardId`
16. `DELETE /note_tool/board/:boardId/cards/:cardId`

**10. 狀態與資料流**
1. `CardsState`：`items`, `selectedId`, `query`, `boardId`
2. `BoardsState`：`items`, `selectedId`
3. `UserSettingsState`：`cardOpenMode`, `cardPreviewLength`

**11. 錯誤處理**
1. API 失敗顯示錯誤訊息
2. 未登入導向 `/auth/login`
3. 404 顯示「找不到卡片」

## TODO
1. 白板刪除功能
2. 卡片列表與白板內的摘要改為顯示 Markdown 編譯後的內容
