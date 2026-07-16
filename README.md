# 📖 聖靈果｜聖經版多鄰國

像多鄰國（Duolingo）一樣的遊戲化讀經 App：自由選書卷闖關，玩經文填空、排序、配對、接下句和理解題，累積經驗值與連續天數，把整本聖經讀進生命裡。

**線上遊玩**：https://kindms.github.io/bibleduo/

## 特色

- 📚 **全 66 卷書、1,189 章**都能闖關（和合本，公版）
- 🎮 五種題型：經文填空、排順序、上下句配對、接下句、理解題（附依據經節）
- 🔥 經驗值、連續天數、愛心、完美通關彩帶
- 🏞️ 四個場景：青草地、加利利海、曠野日出、星夜應許（深色）
- 🐾 四個夥伴：小鴿子、小魚、小河馬、小螞蟻（各有出處經文）
- ☁️ Google 登入，進度雲端同步，換手機不消失
- 🏆 本週／總榜排行榜，暱稱自訂
- 🚩 一鍵回報題目問題

## 技術

- 純前端 HTML/CSS/JS，無建置流程，GitHub Pages 託管
- Firebase Authentication（Google 登入）＋ Cloud Firestore（進度、排行榜、回報）
- 熟讀題由程式即時從經文生成（`js/questions.js`，中文斷詞用 `Intl.Segmenter`）
- 理解題預先生成存於 `data/comprehension/`（AI 生成、人工抽查）

## 資料來源

- 經文：和合本（繁體，神版），公版（Public Domain），取自 [open-bibles](https://github.com/seven1m/open-bibles) `chi-cuv.usfx.xml`
- 結構化資料：`data/books/*.json`（66 卷）＋ `data/index.json`（目錄）

## 目錄結構

```
bibleduo/
├── index.html            # 入口
├── css/style.css         # 樣式（四場景以 data-scene + CSS 變數切換）
├── js/app.js             # 主程式（畫面、遊戲流程、雲端同步、排行榜、回報）
├── js/questions.js       # 題目工廠（熟讀題即時生成）
├── js/cloud.js           # Firebase 登入與 Firestore 同步
├── data/books/           # 66 卷經文 JSON
├── data/comprehension/   # 理解題題庫（逐卷擴充中）
└── docs/                 # 理解題抽查清單
```
