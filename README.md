# Momo 購物網爬蟲工具

這是一個用於爬取 Momo 購物網產品資料的工具，包含網頁介面和 Python 腳本兩種方式。

## 功能特點

- 搜尋 Momo 購物網產品
- 提取產品名稱、品牌、型號、價格和連結
- 匯出資料為 Excel 檔案
- 深色主題介面

## 使用方法

### 方法一：網頁介面（有限制）

由於 Momo 網站有防爬蟲保護，網頁版本可能無法正常運作。建議使用下方的 Python 腳本。

1. 啟動開發伺服器：
```bash
npm install
npm run dev
```

2. 開啟瀏覽器訪問 `http://localhost:3000`
3. 輸入搜尋關鍵字（例如：枕頭）
4. 點擊「開始抓取」

### 方法二：Python 腳本（推薦）

Python 腳本使用 Playwright 來處理動態 JavaScript 內容，能夠可靠地爬取 Momo 網站。

#### 安裝依賴

```bash
pip install playwright pandas openpyxl
playwright install chromium
```

#### 執行腳本

```bash
python scripts/momo_scraper.py "搜尋關鍵字" [最大結果數]
```

範例：
```bash
python scripts/momo_scraper.py "枕頭" 50
```

#### 輸出

腳本會：
1. 在終端機顯示 JSON 格式的資料
2. 自動儲存 Excel 檔案（檔名格式：`momo_關鍵字_日期時間.xlsx`）

## 技術架構

- **前端**：Next.js 16 + React 19 + Tailwind CSS v4
- **UI 元件**：shadcn/ui
- **資料處理**：
  - 網頁版：Cheerio (HTML 解析)
  - Python 版：Playwright (瀏覽器自動化)
- **Excel 匯出**：
  - 網頁版：xlsx (SheetJS)
  - Python 版：pandas + openpyxl

## 限制說明

Momo 購物網使用以下防護措施：
- JavaScript 動態渲染內容
- 防爬蟲機制（301 重定向、Cookie 驗證等）
- 可能有 IP 限制

因此，**強烈建議使用 Python 腳本**進行資料爬取，它能夠模擬真實瀏覽器環境，成功率更高。

## 專案結構

```
├── app/
│   ├── api/scrape/route.ts    # API 路由（嘗試使用 CORS 代理）
│   ├── page.tsx                # 主要介面
│   └── globals.css             # 全域樣式
├── scripts/
│   └── momo_scraper.py        # Python 爬蟲腳本（推薦）
├── components/ui/              # UI 元件
└── README.md                   # 說明文件
```

## 注意事項

1. 爬蟲使用請遵守網站的使用條款和 robots.txt
2. 請勿過度頻繁請求，避免對目標網站造成負擔
3. 僅供學習和個人使用，請勿用於商業用途
4. Python 腳本需要安裝 Chromium 瀏覽器（透過 Playwright 自動安裝）

## 授權

本專案僅供學習和研究使用。
