Note Tool 前端（Next.js + React）。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open http://localhost:3000 with your browser to see the result.

## Design Doc

See `note_tool/docs/SDD.md`.

## Backend API

本專案需要連到 `LineLanguageBot` 後端：

1. 先啟動後端（建議用 `PORT=3001`）
2. 前端設定 API Base URL

在 `note_tool` 根目錄新增 `.env.local`：

```env
NEXT_PUBLIC_API_BASE=http://localhost:3001
```

部署時請改成正式網域，例如：

```env
NEXT_PUBLIC_API_BASE=https://linelanguagebot.onrender.com
```

## Work Log

See `note_tool/docs/work_log_2026-02-08.md`.

## Notes

- 需設定 `NEXT_PUBLIC_API_BASE` 才能登入與呼叫後端。
- 使用 `react-markdown` + `remark-gfm`，支援表格/核取方塊等語法。
