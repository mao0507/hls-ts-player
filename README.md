# HLS Loop Player

本地迴圈播放器，將多個 MPEG-TS（`.ts`）影片片段依序串接並無縫迴圈播放。  
支援「替換點」機制：在播放途中動態切換特定片段的內容（手動訊號 或 隨機模式）。

---

## 目錄

1. [功能特色](#功能特色)
2. [技術架構](#技術架構)
3. [檔案結構](#檔案結構)
4. [環境需求](#環境需求)
5. [啟動方式](#啟動方式)
6. [使用教學](#使用教學)
7. [替換點詳解](#替換點詳解)
8. [播放引擎原理](#播放引擎原理)
9. [Service Worker（sw.js）](#service-worker)
10. [伺服器（server.js）](#伺服器)
11. [已知限制](#已知限制)

---

## 功能特色

| 功能 | 說明 |
|------|------|
| 多片段迴圈 | 多個 `.ts` 片段依序播放，播完自動從頭 |
| 本地上傳 | 拖曳或點擊上傳 `.ts` 檔案，不需上傳至伺服器 |
| 遠端 URL | 支援填入 HTTP URL 作為片段來源 |
| 自動探測時長 | 上傳後自動用 hls.js 解析 `.ts` 實際時長 |
| 替換點（手動） | 指定片段為替換點，在本輪播到前按訊號按鈕決定播哪個候選 |
| 替換點（隨機） | 替換點每次播放時自動隨機抽取候選 |
| 無縫銜接 | 透過 mux.js 重排時間軸，片段之間無音訊斷點 |
| 進度顯示 | 影片下方顯示當前片段進度條及片段軌道 |
| 事件記錄 | 介面底部顯示完整播放事件 log |

---

## 技術架構

```
瀏覽器
├── Vue 2（UI 框架，本地複本）
├── hls.js 1.5.7（片段時長探測，本地複本）
├── mux.js（MPEG-TS → fMP4 轉封裝，本地複本）
└── MediaSource Extensions API（無縫串流播放）

Node.js（本地靜態檔案伺服器）
└── server.js（HTTP，port 3000）

Service Worker（sw.js）
└── 攔截 /_hls_fake_.m3u8，動態產生 HLS playlist（備用架構）
```

### 播放資料流

```
.ts 檔案 / URL
    ↓  fetch()
ArrayBuffer（MPEG-TS）
    ↓  mux.js Transmuxer
fMP4 fragments（含 init segment）
    ↓  SourceBuffer.appendBuffer()
MediaSource → <video>
```

---

## 檔案結構

```
hls-player/
├── index.html      # 前端全部邏輯（Vue 2 SPA）
├── server.js       # Node.js 靜態檔案伺服器
├── sw.js           # Service Worker（HLS playlist 動態產生）
├── vue.min.js      # Vue 2 本地複本
├── hls.min.js      # hls.js 本地複本（片段時長探測）
├── mux.min.js      # mux.js 本地複本（TS→fMP4 轉封裝）
├── package.json    # npm 設定（name, version, engines）
├── 啟動.bat        # Windows 一鍵啟動腳本
├── 啟動.sh         # Mac/Linux 一鍵啟動腳本
└── README.md       # 本文件
```

你可以在根目錄下建立任意子資料夾放置 `.ts` 檔案，例如：

```
hls-player/
└── videos/
    ├── intro.ts
    ├── loop_a.ts
    ├── loop_b.ts
    └── special.ts
```

---

## 環境需求

- **Node.js** >= 14（只用於本地靜態伺服器，無任何 npm 依賴）
- 前端函式庫（Vue、hls.js、mux.js）皆為本地檔案，不需連外網
- **瀏覽器**：支援 MediaSource Extensions 的現代瀏覽器（Chrome、Edge、Firefox）
  - Safari 需另行確認 MSE 支援狀況
- **必須**透過 `http://localhost:3000` 開啟，不可直接用 `file://` 協定（Service Worker 及 fetch 限制）

---

## 啟動方式

### Windows

直接雙擊 `啟動.bat`，瀏覽器會自動開啟。

### Mac / Linux

```bash
chmod +x 啟動.sh
./啟動.sh
```

### 手動啟動

```bash
node server.js
```

然後在瀏覽器開啟：**http://localhost:3000**

---

## 使用教學

### 1. 設定片段

介面預設有 5 個片段（A、B、C、D、E），D 預設為替換點。

每個片段可設定：

| 欄位 | 說明 |
|------|------|
| 名稱 | 顯示在片段軌道和 log 的標籤 |
| 來源（URL） | 填入 `.ts` 檔案的 HTTP URL |
| 來源（本地） | 點擊或拖曳上傳本地 `.ts` 檔 |
| 秒數 | 播放時長（自動探測，可手動覆蓋，精度至小數點後 4 位） |
| 替換點 | 勾選後此片段成為替換點（見下方說明） |

### 2. 新增 / 刪除片段

- 點「＋ 新增片段」：在尾端新增（名稱自動遞增 A、B、C...）
- 點片段右側「✕」：刪除該片段（至少需保留 1 個）

### 3. 開始播放

所有片段設定來源後，點「▶ 開始播放」。

播放中：
- 片段設定欄位全部鎖定，無法修改
- 影片下方顯示片段軌道（目前播放的片段高亮）
- 狀態列顯示「播放中」、目前片段名稱、已迴圈次數

### 4. 停止

點「■ 停止」，播放完全停止並釋放所有資源（Blob URL、MediaSource、SourceBuffer）。

---

## 替換點詳解

替換點讓你在播放序列中插入一個「可替換」的片段。每次迴圈到達替換點時，播放器根據模式決定播哪個候選。

### 設定替換點

1. 勾選片段右側的「替換點」checkbox
2. 下方展開候選清單，預設有「預設」（候選一）和「候選2」
3. 為每個候選設定來源（URL 或本地檔案）和時長
4. 點「＋ 新增候選」可增加更多候選

### 手動模式（預設）

- 替換點的上方會出現「替換點訊號控制」面板
- 播放器播到替換點**之前**，點擊對應按鈕選擇本輪要播哪個候選
- 若在到達替換點前未選，自動播「預設」（候選一）
- 每輪結束後訊號自動清除，下一輪重新選擇

```
訊號面板按鈕顏色：
  ① 預設    → 綠色（badge-green）
  ② 候選二  → 橘色（badge-orange）
  ③ 候選三  → 橘色
  ...
```

### 隨機模式

- 勾選替換點內的「🎲 隨機模式」
- 每次播到替換點時，自動從所有候選中隨機抽取一個
- 不需要手動按訊號按鈕
- Log 會顯示每次抽到的候選名稱（紫色）

---

## 播放引擎原理

### MediaSource Extensions（MSE）

播放器**不使用 HLS 協定**直接播放，而是透過 MSE API 把 fMP4 片段直接推送到瀏覽器的 `SourceBuffer`：

```
initMse()
  → 建立 MediaSource 物件
  → 取得 Object URL 指派給 <video>.src
  → 等待 sourceopen 事件

ensureSourceBuffer()
  → addSourceBuffer('video/mp4; codecs="avc1.4d401f, mp4a.40.2"')
  → mode = 'segments'
```

### mux.js 轉封裝

每個 `.ts` 片段在推送前，先用 mux.js 的 `Transmuxer` 轉為 fMP4：

```javascript
const tx = new mux.mp4.Transmuxer({ keepOriginalTimestamps: false })
tx.on('data', s => parts.push(s))
tx.push(new Uint8Array(tsBuf))
tx.flush()
```

- `keepOriginalTimestamps: false`：讓 mux.js 從 0 開始重排 PTS/DTS
- 每個片段的 `timestampOffset` 設為目前 `timelineEnd`，確保時間軸連續
- 第一個片段的 `initSegment`（含 codec 初始化資訊）只寫入一次

### 預緩衝策略

```
啟動時：預先緩衝前 2 個片段再開始播放
播放中：維持 video.currentTime 前方 12 秒的緩衝
觸發條件：video ontimeupdate 事件（每 ~250ms）
```

`ensureBuffer()` 核心邏輯：

```
ahead = timelineEnd - currentTime
if ahead > 8  → 不補
if ahead < 12 → 繼續 append 直到 ahead >= 12
```

### 片段時間軸追蹤

`segTimeline[]` 陣列記錄每個片段在 MSE 時間軸上的位置：

```javascript
{ start: 0,    end: 6.0,  entry: { label: 'A', segIndex: 0 } }
{ start: 6.0,  end: 12.0, entry: { label: 'B', segIndex: 1 } }
{ start: 12.0, end: 18.0, entry: { label: 'C', segIndex: 2 } }
...
```

`trackSegmentUi()` 在每次 `timeupdate` 時，用 `video.currentTime` 查找當前所在片段，更新 UI 高亮顯示。

### 迴圈計數與訊號清除

每次 `nextSchedIndex` 回到 0（且不是第一次）時視為「新的一輪」：

```javascript
const isLoopStart = segIndex === 0 && playSeq > 0 && playSeq % n === 0
```

新一輪開始時：
1. `loopCount++`
2. 所有替換點的手動訊號清為 `null`（等待本輪新選擇）
3. Log 輸出「── 第 N 輪 ──」

### 本地檔案處理

本地 `.ts` 每次 fetch 前建立新的 `Object URL`（因為 `blob:` URL 不支援加 query string 防快取）：

```javascript
const url = URL.createObjectURL(entry.file)
this._blobBySeq[seq] = url   // 記錄，append 後立即 revoke
```

片段 append 完成後立即 `URL.revokeObjectURL()`，防止記憶體洩漏。

### 片段時長探測

上傳 `.ts` 後，會用 hls.js 建立一個臨時的 HLS playlist 解析實際時長（比 `video.duration` 準確）：

```
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:600
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:600.000,
blob:...（實際 ts 的 Blob URL）
```

監聽 `FRAG_PARSED` 事件取得 `frag.start + frag.duration`，逾時 10 秒則放棄。

---

## Service Worker

`sw.js` 攔截 `/_hls_fake_.m3u8` 的 fetch 請求，動態產生 HLS playlist 回應。

這是一個**備用架構**（舊版設計遺留），目前主要播放流程已全面改用 MSE 直接推送，不再依賴此 playlist。

sw.js 支援的 message 事件：

| 訊息類型 | 說明 |
|---------|------|
| `APPEND_SEGMENT` | 新增片段到 playlist（最多保留 10 個） |
| `RESET` | 清空所有片段，重置 baseSeq |

`server.js` 回應 `/_hls_fake_.m3u8` 時傳回空 playlist，作為 SW 尚未啟動時的 fallback，避免 hls.js 解析錯誤。

---

## 伺服器

`server.js` 是純 Node.js `http` 模組實作的靜態檔案伺服器（無任何 npm 依賴）。

### 支援的 MIME 類型

| 副檔名 | MIME Type |
|--------|-----------|
| `.html` | `text/html; charset=utf-8` |
| `.js` | `application/javascript` |
| `.css` | `text/css` |
| `.ts` | `video/mp2t` |
| `.m3u8` | `application/vnd.apple.mpegurl` |
| `.png` / `.jpg` | `image/png` / `image/jpeg` |
| `.svg` | `image/svg+xml` |

### 安全機制

- 只允許 `GET` / `HEAD` 方法，其他回 405
- 防止目錄跳脫（path traversal）：確認解析後的路徑必須在 `ROOT` 目錄內，否則回 403
- 所有靜態回應加上 `Cache-Control: no-cache`
- 加上 `Service-Worker-Allowed: /` header，允許 SW 攔截根路徑以下的所有請求

### 特殊路徑

| 路徑 | 行為 |
|------|------|
| `/` | 轉向 `/index.html` |
| `/_hls_fake_.m3u8` | 回傳空 HLS playlist（SW fallback） |

### 監聽位址

`127.0.0.1:3000`（只接受本機連線，不對外開放）

---

## 已知限制

1. **必須使用 localhost**：Service Worker、`fetch()` blob URL、MediaSource 都要求安全上下文（`https://` 或 `localhost`），直接用 `file://` 開啟會失敗。

2. **僅支援 MPEG-TS（`.ts`）**：播放引擎使用 mux.js 轉封裝，只接受 MPEG-TS 容器格式。不支援 `.mp4`、`.mov` 等格式。

3. **編碼限制**：mux.js 支援 H.264 視訊 + AAC 音訊。不支援 H.265（HEVC）。

4. **播放中不可修改**：開始播放後所有片段設定鎖定，需先停止才能修改。

5. **替換點訊號時機**：手動模式的訊號必須在該替換點被排程（append）**之前**送出。由於播放器會預先緩衝 12 秒，若片段時長較短，需要提早選擇。

6. **記憶體累積**：長時間播放時，`segTimeline[]` 陣列會持續增長（不會清理舊紀錄）。若迴圈非常多次可能影響查找效能，但一般使用不影響。
