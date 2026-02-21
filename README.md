# Mipun Frontend

`note_tool` 是 Note/Board 前端，使用 Next.js App Router，提供卡片管理、白板排版、卡片分享與關聯編輯能力。

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- `@uiw/react-md-editor` + `remark-gfm` + `rehype-sanitize`

## Prerequisites

1. Node.js 18+
2. 後端 API（`LineLanguageBot`）可連線

## Environment Variables

在專案根目錄建立 `.env.local`：

```env
NEXT_PUBLIC_API_BASE=http://localhost:3001
```

部署環境請改為正式 API，例如：

```env
NEXT_PUBLIC_API_BASE=https://linelanguagebot.onrender.com
```

`NODE_ENV` 正式環境請使用 `production`。

## Run Locally

```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Project Structure

- `app/`: 路由頁面（App Router）
  - `app/(app)/cards`: Card Box 與卡片詳情
  - `app/(app)/boards`: 白板列表與白板詳情
  - `app/shared-card`, `app/shared-board`: 分享頁面
- `components/`: UI 元件與 overlay
- `components/cards/`: 卡片操作相關共用元件
- `hooks/`: 前端共用 hooks（share/remove/actions/editor）
- `lib/`: API client 與共用 utilities
- `docs/`: 設計文件與工作紀錄

## Key Behaviors

1. 卡片操作統一由 `...` 選單提供：Share / Remove from board / Delete。
2. `Card Box` 列表不顯示 `...`，需點開卡片後再操作。
3. 白板中移除卡片後會即時更新畫面，不需手動刷新。

## Docs Index

- 設計文件：`docs/SDD.md`
- TODO：`docs/TODO.md`
- Work logs：
  - `docs/work_log_2026-02-08.md`
  - `docs/work_log_2026-02-15.md`
  - `docs/work_log_2026-02-20.md`

## Handoff Checklist

部署或交接前建議檢查：

1. `NEXT_PUBLIC_API_BASE` 是否正確
2. 登入與 token refresh 是否正常
3. Share / Remove / Delete 在卡片視圖可用
4. 白板卡片拖曳、調整寬度、移除後即時更新正常
