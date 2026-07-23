// 聖靈果 — 主程式（畫面切換、遊戲流程、進度/經驗值/連續天數）
(function () {
  const $ = (sel) => document.querySelector(sel);
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const OT_COUNT = 39;
  const MAX_HEARTS = 5; // 愛心上限（跨關卡共用；答錯扣一顆，用完可讀經回血或等時間回復）
  const HEART_REGEN_MS = 60 * 60 * 1000; // 每小時自動回復 1 顆（多鄰國式）
  const heartStr = (h) => '❤️'.repeat(Math.max(0, h)) + '🖤'.repeat(Math.max(0, MAX_HEARTS - h));
  // 依時間補回應得的愛心（滿了就不跑計時；只有真的回了血才存檔）
  function refreshHearts() {
    if (typeof state.hearts !== 'number') { state.hearts = MAX_HEARTS; state.heartsTs = Date.now(); return; }
    if (state.hearts >= MAX_HEARTS) { state.hearts = MAX_HEARTS; state.heartsTs = Date.now(); return; }
    const ts = state.heartsTs || Date.now();
    const regen = Math.floor((Date.now() - ts) / HEART_REGEN_MS);
    if (regen > 0) {
      state.hearts = Math.min(MAX_HEARTS, state.hearts + regen);
      state.heartsTs = state.hearts >= MAX_HEARTS ? Date.now() : ts + regen * HEART_REGEN_MS; // 保留未滿一小時的餘數
      store.save(state);
    }
  }
  function loseHeart() {
    if (state.hearts >= MAX_HEARTS) state.heartsTs = Date.now(); // 從滿的掉下來才開始計時
    state.hearts = Math.max(0, (state.hearts ?? MAX_HEARTS) - 1);
    store.save(state);
  }
  function gainHeart(n = 1) { // 讀經回血
    if (state.hearts >= MAX_HEARTS) state.heartsTs = Date.now();
    state.hearts = Math.min(MAX_HEARTS, (state.hearts ?? 0) + n);
    if (state.hearts >= MAX_HEARTS) state.heartsTs = Date.now();
    store.save(state);
  }
  function heartRegenText() { // 「下一顆還要多久」
    if (state.hearts >= MAX_HEARTS) return '';
    let remain = HEART_REGEN_MS - (Date.now() - (state.heartsTs || Date.now()));
    remain = Math.max(0, Math.min(HEART_REGEN_MS, remain));
    const m = Math.floor(remain / 60000), s = Math.floor((remain % 60000) / 1000);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  function updateHeartUi() {
    const b = $('#stat-hearts b'); if (b) b.textContent = state.hearts;
    const rg = $('#heart-regen'); if (rg) rg.textContent = state.hearts >= MAX_HEARTS ? '' : heartRegenText();
    const lh = $('#lesson-hearts'); if (lh) lh.textContent = heartStr(state.hearts);
    const rr = $('#revive-regen'); if (rr) rr.textContent = state.hearts >= MAX_HEARTS ? '' : `或等 ${heartRegenText()} 就自動回復一顆 ❤️`;
  }
  const BOOK_EMOJI = {
    GEN: '🌍', EXO: '🌊', LEV: '🕯️', NUM: '🏕️', DEU: '📜', JOS: '🎺', JDG: '⚔️', RUT: '🌾',
    '1SA': '👑', '2SA': '🏰', '1KI': '🏛️', '2KI': '🔥', '1CH': '📖', '2CH': '📖', EZR: '🧱',
    NEH: '🧱', EST: '👸', JOB: '🌪️', PSA: '🎵', PRO: '💡', ECC: '⏳', SNG: '🌹', ISA: '🕊️',
    JER: '💧', LAM: '😢', EZK: '👁️', DAN: '🦁', HOS: '💔', JOL: '🦗', AMO: '⚖️', OBA: '⛰️',
    JON: '🐋', MIC: '🌄', NAM: '🌊', HAB: '❓', ZEP: '🔎', HAG: '🏗️', ZEC: '🐎', MAL: '✉️',
    MAT: '👑', MRK: '🦁', LUK: '🩺', JHN: '🦅', ACT: '🔥', ROM: '⚖️', '1CO': '💌', '2CO': '💌',
    GAL: '🕊️', EPH: '🛡️', PHP: '😊', COL: '👔', '1TH': '⏰', '2TH': '⏰', '1TI': '🧑‍🏫',
    '2TI': '🏃', TIT: '🏝️', PHM: '🤝', HEB: '⛪', JAS: '🪞', '1PE': '🪨', '2PE': '🪨',
    '1JN': '❤️', '2JN': '💌', '3JN': '💌', JUD: '🛡️', REV: '🌅',
  };

  // ===== 場景與夥伴 =====
  const SCENES = {
    // theme = 手機狀態列（瀏覽器頂端）顏色，用各場景的淺色調，不再是刺眼的主綠色
    meadow: { name: '青草地', emoji: '🌿', decor: ['🌾', '🌼', '🐑', '🦋', '🌻'], theme: '#e6f8ea' },
    galilee: { name: '加利利海', emoji: '🌊', decor: ['⛵', '🐟', '🌊', '🕊️', '🐚'], theme: '#e6f2fd' },
    desert: { name: '曠野日出', emoji: '🏜️', decor: ['🌵', '🐫', '☀️', '⛺', '🦂'], theme: '#fdf4dc' },
    night: { name: '星夜應許', emoji: '🌌', decor: ['⭐', '🌙', '✨', '☁️', '💫'], theme: '#211d4d' },
    jerusalem: { name: '耶路撒冷', emoji: '🏛️', decor: ['🏛️', '🫒', '🎺', '🕊️', '🌟'], theme: '#f2edf8', lock: 'top3' },
    bethlehem: { name: '伯利恆', emoji: '🌟', decor: ['🌟', '👶', '🐑', '🕯️', '🎁'], theme: '#fbeeed', lock: 'top3' },
    olive_mount: { name: '橄欖山', emoji: '🫒', decor: ['🫒', '🌿', '🕊️', '⛰️', '🙏'], theme: '#eef2e0', lock: 'top3' },
    wedding_feast: { name: '娶親宴席', emoji: '💒', decor: ['💍', '💒', '👰', '🤵', '🕊️', '🍷', '🌹', '🎉'], theme: '#fbe4ea', lock: 'top1' },
  };
  const MASCOTS = {
    dove: { name: '小鴿子', emoji: '🕊️', verse: '「鴿子嘴裏叼着一個新擰下來的橄欖葉子」— 創世記 8:11' },
    fish: { name: '小魚', emoji: '🐟', verse: '「我們這裏只有五個餅、兩條魚」— 馬太福音 14:17' },
    hippo: { name: '小河馬', emoji: '🦛', verse: '「你且觀看河馬…牠的氣力在腰間」— 約伯記 40:15-16' },
    ant: { name: '小螞蟻', emoji: '🐜', verse: '「懶惰人哪，你去察看螞蟻的動作就可得智慧」— 箴言 6:6' },
    lion: { name: '小獅子', emoji: '🦁', verse: '「看哪，猶大支派中的獅子…他已得勝」— 啟示錄 5:5', lock: 'top3' },
    lamb: { name: '小羊', emoji: '🐑', verse: '「看哪，神的羔羊，除去世人罪孽的！」— 約翰福音 1:29', lock: 'top3' },
    donkey: { name: '小驢駒', emoji: '🫏', verse: '「看哪，你的王來到你這裏，是溫柔的，又騎着驢，就是騎着驢駒子」— 馬太福音 21:5', lock: 'top3' },
    eagle: { name: '超帥老鷹', emoji: '🦅', verse: '「他們必如鷹展翅上騰；他們奔跑卻不困倦」— 以賽亞書 40:31', lock: 'top1', crown: true },
  };

  // ===== 進度資料（localStorage，Step 3 會改接雲端）=====
  const store = {
    load() {
      try { return JSON.parse(localStorage.getItem('bibleduo') || '{}'); }
      catch { return {}; }
    },
    save(d) {
      localStorage.setItem('bibleduo', JSON.stringify(d));
      CloudSync.save(d); // 有登入就同步到雲端（沒登入時是空操作）
    },
  };
  let state = Object.assign({ xp: 0, streak: 0, lastPlay: '', done: {}, scene: 'meadow', mascot: 'dove', nickname: '', weekXp: 0, weekKey: '', muted: false, review: [], puzzles: { beatitudes: [] }, hearts: MAX_HEARTS, heartsTs: Date.now(), lastWeekXp: 0, lastWeekKey: '', milestones: {}, admBump: 0 }, store.load());
  if (!state.puzzles) state.puzzles = { beatitudes: [] }; // 舊存檔補欄位
  if (!state.stats) state.stats = {}; // 各種計數器（衝刺最高分、翻牌次數、複習次數、朗讀成功數…），徽章用
  if (!state.minigames) state.minigames = {}; // 書卷故事小遊戲通關紀錄 { gameId: true }
  if (!state.friends) state.friends = []; // 好友 uid 清單（雲端同步取聯集）
  // review: 錯題間隔複習佇列 [{key, q, book, due, stage}]；答錯隔天到期，答對依 1→3→7 天延後，對滿三次畢業移除
  // done: { MRK: [1,2,3] } 已完成章

  const mascot = () => MASCOTS[state.mascot] || MASCOTS.dove;

  // ===== 上週排名獎勵：前三名解鎖進階夥伴/場景、冠軍再解鎖頂級款 =====
  let rankReward = { rank: 0 }; // 我在「上週」排行榜的名次（0 = 沒上榜或未登入）
  function canUseReward(item) {
    if (!item || !item.lock) return true;
    if (item.lock === 'top1') return rankReward.rank === 1;
    return rankReward.rank >= 1 && rankReward.rank <= 3; // top3
  }
  const lockHint = (item) => item.lock === 'top1' ? '上週排行榜冠軍' : '上週排行榜前三名';
  async function refreshRankReward() {
    rankReward.rank = 0;
    if (CloudSync.isLoggedIn()) {
      try {
        const rows = await CloudSync.fetchLastWeekTop(lastWeekKeyOf());
        const my = CloudSync.uid();
        const idx = rows.findIndex((r) => r.uid === my);
        rankReward.rank = idx >= 0 ? idx + 1 : 0;
      } catch (e) { console.warn('上週排名載入失敗', e); }
    }
    applyRewardLocks();
  }
  // 目前選用的夥伴/場景若已不符資格（掉出前三名/未登入），退回預設，避免鎖著卻還在套用
  function applyRewardLocks() {
    let changed = false;
    if (!canUseReward(SCENES[state.scene])) { state.scene = 'meadow'; changed = true; }
    if (!canUseReward(MASCOTS[state.mascot])) { state.mascot = 'dove'; changed = true; }
    if (changed) { store.save(state); applyScene(); }
    if (!document.querySelector('#custom-panel').classList.contains('hidden')) renderCustomPanel();
  }

  // ===== 場景套用與飄浮裝飾 =====
  function applyScene() {
    const scene = SCENES[state.scene] ? state.scene : 'meadow';
    document.documentElement.dataset.scene = scene;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = SCENES[scene].theme; // 手機狀態列顏色跟著場景走
    const decor = document.querySelector('#decor');
    decor.innerHTML = '';
    const items = SCENES[scene].decor;
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('span');
      s.className = 'decor-item';
      s.textContent = items[i % items.length];
      s.style.left = `${(i * 37 + 8) % 92}%`;
      s.style.top = `${(i * 23 + 12) % 85}%`;
      s.style.animationDelay = `${(i * 0.9) % 6}s`;
      s.style.fontSize = `${1.1 + (i % 3) * 0.5}rem`;
      decor.appendChild(s);
    }
    const hm = document.querySelector('#home-mascot');
    hm.textContent = mascot().emoji;
    hm.dataset.mascot = state.mascot; // 讓超帥老鷹能戴皇冠（CSS ::after）
  }

  // ===== 打扮面板 =====
  function renderCustomPanel() {
    const buildChip = (key, item, isActive, onPick) => {
      const locked = !canUseReward(item);
      const chip = document.createElement('button');
      chip.className = 'pick-chip' + (isActive ? ' active' : '') + (locked ? ' locked' : '');
      chip.innerHTML = `<span class="p-emoji${item.crown ? ' crowned' : ''}">${item.emoji}</span><span class="p-name">${item.name}</span>`
        + (locked ? `<span class="p-lock">🔒 ${lockHint(item)}</span>` : '');
      chip.onclick = locked
        ? () => alert(`「${item.name}」是${lockHint(item)}的專屬獎勵——衝上排行榜就能解鎖！`)
        : onPick;
      return chip;
    };
    const sceneRow = document.querySelector('#scene-row');
    sceneRow.innerHTML = '';
    for (const [key, sc] of Object.entries(SCENES)) {
      sceneRow.appendChild(buildChip(key, sc, state.scene === key,
        () => { state.scene = key; store.save(state); applyScene(); renderCustomPanel(); }));
    }
    const mascotRow = document.querySelector('#mascot-row');
    mascotRow.innerHTML = '';
    for (const [key, m] of Object.entries(MASCOTS)) {
      mascotRow.appendChild(buildChip(key, m, state.mascot === key,
        () => { state.mascot = key; store.save(state); applyScene(); renderCustomPanel(); }));
    }
    document.querySelector('#mascot-verse').textContent = mascot().verse;
  }
  function toggleCustomPanel() {
    document.querySelector('#custom-panel').classList.toggle('hidden');
    renderCustomPanel();
  }
  document.querySelector('#btn-custom').onclick = toggleCustomPanel;

  // ===== 彩帶（完美通關）=====
  function throwConfetti() {
    const pieces = ['🎉', '⭐', '✨', '🎊', mascot().emoji];
    for (let i = 0; i < 24; i++) {
      const c = document.createElement('span');
      c.className = 'confetti';
      c.textContent = pieces[i % pieces.length];
      c.style.left = `${Math.random() * 96}%`;
      c.style.animationDuration = `${1.6 + Math.random() * 1.6}s`;
      c.style.animationDelay = `${Math.random() * 0.5}s`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 4000);
    }
  }

  // 日期一律用本地時區（台灣晚上若用 UTC 會差一天）
  const pad = (n) => String(n).padStart(2, '0');
  const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function today() { return localDate(new Date()); }
  const addDaysStr = (n) => localDate(new Date(Date.now() + n * 86400000));
  function weekKeyOf() { // 本週週一的日期，當作「這一週」的鑰匙
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return localDate(d);
  }
  function lastWeekKeyOf() { // 上週週一的日期（前三名獎勵判定用）
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7);
    return localDate(d);
  }
  function ensureWeek() { // 跨週時歸零本週經驗值與本週章數（排行榜＋好友週任務用）
    const wk = weekKeyOf();
    if (state.weekKey !== wk) {
      // 保留「剛結束那一週」的分數，供上週排名獎勵判定
      if (state.weekKey) { state.lastWeekXp = state.weekXp || 0; state.lastWeekKey = state.weekKey; }
      state.weekKey = wk; state.weekXp = 0; state.weekCh = 0;
    }
  }
  function bumpStreak() {
    const t = today();
    if (state.lastPlay === t) return;
    const y = localDate(new Date(Date.now() - 86400000));
    state.streak = state.lastPlay === y ? state.streak + 1 : 1;
    state.lastPlay = t;
  }
  function renderTopbar() {
    $('#stat-streak b').textContent = state.streak;
    $('#stat-xp b').textContent = state.xp;
    updateHeartUi(); // 愛心跨關卡共用，一律讀 state.hearts（含回復倒數）
  }

  // ===== 音效（簡單合成音）=====
  let audioCtx = null;
  function beep(freqs, dur = 0.12) {
    if (state.muted) return; // 靜音開關
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      freqs.forEach((f, i) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.frequency.value = f; o.type = 'sine';
        g.gain.setValueAtTime(0.18, audioCtx.currentTime + i * dur);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (i + 1) * dur);
        o.connect(g).connect(audioCtx.destination);
        o.start(audioCtx.currentTime + i * dur); o.stop(audioCtx.currentTime + (i + 1) * dur);
      });
    } catch { /* 靜音也不影響遊戲 */ }
  }
  const sndGood = () => beep([660, 880]);
  const sndBad = () => beep([330, 220], 0.15);
  const sndWin = () => beep([523, 659, 784, 1047], 0.14);
  // 靜音開關（在關卡畫面右上，偏好記在本機）
  function renderMute() { $('#btn-mute').textContent = state.muted ? '🔇' : '🔊'; }
  $('#btn-mute').onclick = () => {
    state.muted = !state.muted;
    store.save(state);
    renderMute();
    if (!state.muted) sndGood(); // 開回音效時給個聲音確認
  };

  // ===== 資料載入 =====
  let bookIndex = null;
  const bookCache = {};
  async function loadIndex() {
    const res = await fetch('data/index.json');
    if (!res.ok) throw new Error('index ' + res.status);
    bookIndex = (await res.json()).books;
  }
  async function loadBook(id) {
    if (!bookCache[id]) {
      const res = await fetch(`data/books/${id}.json`);
      if (!res.ok) throw new Error(id + ' ' + res.status);
      bookCache[id] = await res.json();
    }
    return bookCache[id];
  }

  // 理解題題庫（尚未生成的書卷會回傳 null，遊戲照常只出熟讀題）
  const compCache = {};
  async function loadComp(id) {
    if (!(id in compCache)) {
      try {
        const res = await fetch(`data/comprehension/${id}.json`);
        compCache[id] = res.ok ? await res.json() : null;
      } catch { compCache[id] = null; }
    }
    return compCache[id];
  }
  const shuffleArr = (a) => a.slice().sort(() => Math.random() - 0.5);

  // ===== 畫面切換 =====
  function show(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
    $(id).classList.remove('hidden');
    // 場景/夥伴只在首頁能選，所以 🎨 鈕只在首頁出現，避免其他畫面按了沒反應
    $('#btn-custom').classList.toggle('hidden', id !== '#screen-books');
    window.scrollTo(0, 0);
  }

  // ===== 畫面 1：書卷地圖 =====
  let currentTab = 'nt';
  function renderBooks() {
    const grid = $('#book-grid');
    grid.innerHTML = '';
    const list = currentTab === 'ot' ? bookIndex.slice(0, OT_COUNT) : bookIndex.slice(OT_COUNT);
    for (const b of list) {
      const doneCh = (state.done[b.id] || []).length;
      const tile = document.createElement('button');
      tile.className = 'book-tile' + (doneCh >= b.chapters ? ' done' : '');
      tile.innerHTML = `<div class="b-emoji">${BOOK_EMOJI[b.id] || '📖'}</div>
        <div class="b-name">${b.name}</div>
        <div class="b-prog">${doneCh}/${b.chapters} 章</div>
        <div class="b-bar"><i style="width:${Math.round((doneCh / b.chapters) * 100)}%"></i></div>`;
      tile.onclick = () => openBook(b.id);
      grid.appendChild(tile);
    }
    renderReviewBanner(); // 首頁同步刷新「今日複習」橫幅
    // 八福拼圖、約拿冒險的進度顯示改到各自書卷的章節頁（bookFeatureNode）
    const best = (state.stats && state.stats.sprintBest) || 0;
    $('#sprint-best').textContent = best ? `最佳 ${best} 分` : '60 秒限時挑戰';
    $('#badge-count').textContent = `${earnedBadges().length}/${BADGES.length}`;
  }
  for (const tab of document.querySelectorAll('.tab')) {
    tab.onclick = () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      renderBooks();
    };
  }

  // ===== 畫面 2：章節路徑 =====
  let currentBook = null;
  async function openBook(id) {
    let book;
    try { book = await loadBook(id); }
    catch (e) {
      console.warn('載入經文失敗', e);
      alert('網路不穩，經文載入失敗了。請檢查網路後再點一次。');
      return;
    }
    currentBook = book;
    $('#chapter-title').textContent = currentBook.name;
    // 小遊戲改「放在路徑上」：每讀 10 章一個里程碑小遊戲、每卷最後一個招牌小遊戲
    // （2026-07-19 Burger 指示；圓形節點但明顯跟每章不同）
    const done = state.done[id] || [];
    const total = currentBook.chapters.length;
    const doneCount = done.length;
    $('#book-feature-slot').innerHTML = ''; // 小遊戲已移到路徑上，slot 不再使用
    const path = $('#chapter-path');
    path.innerHTML = '';
    const maxUnlocked = doneCount ? Math.max(...done) + 1 : 1;
    let msIdx = [...id].reduce((a, ch) => a + ch.charCodeAt(0), 0); // 不同書卷的里程碑從不同遊戲起頭
    for (let c = 1; c <= total; c++) {
      const isDone = done.includes(c);
      const locked = c > maxUnlocked;
      const node = document.createElement('button');
      node.className = 'chapter-node' + (isDone ? ' done' : locked ? ' locked' : c === maxUnlocked ? ' next' : '');
      node.innerHTML = `<div>${isDone ? '⭐' : locked ? '🔒' : c}</div><div class="n-label">第 ${c} 章</div>`;
      if (!locked) node.onclick = () => startLesson(c);
      path.appendChild(node);
      if (c % 10 === 0 && c < total) path.appendChild(makeMilestoneNode(id, c, msIdx++, doneCount)); // 每 10 章
    }
    const sig = makeSignatureNode(id, total, doneCount); // 每卷最後的招牌小遊戲
    if (sig) path.appendChild(sig);
    show('#screen-chapters');
  }
  // 路徑上「每 10 章」的里程碑小遊戲節點（圓形、繽紛，跟每章明顯不同）
  function makeMilestoneNode(bookId, pos, idx, doneCount) {
    const g = MILESTONE_GAMES[((idx % MILESTONE_GAMES.length) + MILESTONE_GAMES.length) % MILESTONE_GAMES.length];
    const unlocked = doneCount >= pos;
    const cleared = milestoneCleared(bookId, pos);
    const node = document.createElement('button');
    node.className = 'mg-node' + (cleared ? ' cleared' : unlocked ? ' next' : ' locked');
    node.innerHTML = `<div class="mg-ico">${unlocked ? (cleared ? '⭐' : g.emoji) : '🔒'}</div><div class="mg-label">${unlocked ? '小遊戲' : `讀完${pos}章`}</div>`;
    node.onclick = unlocked
      ? () => startMilestone(bookId, pos, idx)
      : () => alert(`讀完 ${pos} 章就會解鎖這個路上小遊戲！繼續加油～`);
    return node;
  }
  // 每卷最後的「招牌小遊戲」節點（讀完全卷才解鎖；比里程碑更大更華麗）
  function makeSignatureNode(bookId, total, doneCount) {
    const sig = bookSignature(bookId);
    if (!sig) return null;
    const unlocked = doneCount >= total;
    const node = document.createElement('button');
    node.className = 'mg-node sig-node' + (sig.cleared ? ' cleared' : unlocked ? ' next' : ' locked');
    node.innerHTML = `<div class="mg-ico">${unlocked ? (sig.cleared ? '👑' : sig.emoji) : '🔒'}</div><div class="mg-label">${unlocked ? '招牌關' : '全卷解鎖'}</div>`;
    node.onclick = unlocked
      ? sig.launch
      : () => alert(`這是${currentBook.name}的招牌小遊戲——讀完全卷 ${total} 章就能解鎖！\n目前 ${doneCount}/${total} 章，加油！`);
    return node;
  }
  // 判斷某書卷的招牌小遊戲（特例：GEN 挪亞、JON 約拿、MAT 八福；其餘走 MINIGAMES/ACTION_GAMES）
  function bookSignature(id) {
    if (id === 'GEN') return { emoji: '🚢', launch: () => startNoah(), cleared: !!((state.minigames || {}).noah) };
    if (id === 'JON') return { emoji: '🐋', launch: () => openStoryList(), cleared: (((state.story || {}).JON) || []).length >= 4 };
    if (id === 'MAT') return { emoji: '🧩', launch: () => { renderPuzzle(); show('#screen-puzzle'); }, cleared: (((state.puzzles || {}).beatitudes) || []).length >= 8 };
    for (const [gid, cfg] of Object.entries(MINIGAMES)) if (cfg.book === id) {
      return { emoji: cfg.emoji, launch: () => (ACTION_GAMES[gid] ? ACTION_GAMES[gid]() : startMinigame(gid)), cleared: !!((state.minigames || {})[gid]) };
    }
    return null;
  }
  // 產生某書卷頂端的「專屬玩法」入口清單（可有多個）
  function bookFeatures(id) {
    const nodes = [];
    if (id === 'MAT') {
      const got = ((state.puzzles && state.puzzles.beatitudes) || []).length;
      const btn = document.createElement('button');
      btn.className = 'book-feature';
      btn.innerHTML = `<span class="bf-emoji">🧩</span><span class="bf-text"><b>天國八福拼圖</b><small>${got === 8 ? '已完成 ✨ 點我看金句卡' : `馬太 5:3-10・已收集 ${got}/8`}</small></span><span class="bf-arrow">›</span>`;
      btn.onclick = () => { renderPuzzle(); show('#screen-puzzle'); };
      nodes.push(btn);
    }
    if (id === 'JON') {
      const sDone = ((state.story && state.story.JON) || []).length;
      const btn = document.createElement('button');
      btn.className = 'book-feature';
      btn.innerHTML = `<span class="bf-emoji">🐋</span><span class="bf-text"><b>約拿冒險（故事模式）</b><small>${sDone >= 4 ? '已完結，可重播 ⭐' : sDone ? `進度 ${sDone}/4 章` : '跟著先知走一趟！'}</small></span><span class="bf-arrow">›</span>`;
      btn.onclick = () => openStoryList();
      nodes.push(btn);
    }
    if (id === 'GEN') {
      const won = (state.minigames || {}).noah;
      const btn = document.createElement('button');
      btn.className = 'book-feature mg-card';
      btn.innerHTML = `<span class="bf-emoji">🚢</span><span class="bf-text"><b>挪亞方舟</b><small>${won ? '已通關 ⭐ 可重玩' : '創 7-8・動物翻牌配對'}</small></span><span class="bf-arrow">›</span>`;
      btn.onclick = () => startNoah();
      nodes.push(btn);
    }
    // 書卷故事小遊戲：任何 book 對應此 id 的遊戲都自動出現（加設定即長出入口）
    for (const [gid, cfg] of Object.entries(MINIGAMES)) {
      if (cfg.book !== id) continue;
      const won = (state.minigames || {})[gid];
      const btn = document.createElement('button');
      btn.className = 'book-feature mg-card';
      btn.innerHTML = `<span class="bf-emoji">${cfg.emoji}</span><span class="bf-text"><b>${cfg.title}</b><small>${won ? '已通關 ⭐ 可重玩' : (cfg.tag || '小遊戲・答題對決')}</small></span><span class="bf-arrow">›</span>`;
      btn.onclick = () => (ACTION_GAMES[gid] ? ACTION_GAMES[gid]() : startMinigame(gid)); // 有 2.0 動作版就開新版
      nodes.push(btn);
    }
    return nodes;
  }
  $('#btn-back-books').onclick = () => { renderBooks(); show('#screen-books'); };
  $('#btn-home').onclick = () => {
    stopSprintTimer(); sprint = null; flip = null; mg = null; noah = null; endActionState(); // 從小遊戲直接回家要停計時器/清狀態（含動作遊戲的 rAF/麥克風）
    lesson = null; renderTopbar(); renderBooks(); show('#screen-books');
  };

  // ===== 畫面 3：關卡 =====
  let lesson = null;
  async function startLesson(chapterNum) {
    refreshHearts();
    if (state.hearts <= 0) { // 愛心用完：讀完這一章回一顆再開始（或等每小時自動回復）
      offerRevive(chapterNum, () => startLesson(chapterNum), () => {});
      return;
    }
    const qs = QuestionFactory.generateLesson(currentBook, chapterNum);
    if (qs.length < 2) { alert('這一章太短，暫時無法出題，先挑別章吧！'); return; }
    // 有理解題的章節：中段插一題、結尾放一題
    const comp = await loadComp(currentBook.id);
    const cqs = (comp && comp.questions && comp.questions[String(chapterNum)]) || [];
    const compQs = cqs.slice(0, 2).map((c) => ({
      type: 'comp', ref: c.basis, q: c.q, answer: c.answer, basis: c.basis,
      options: shuffleArr(c.options),
    }));
    if (compQs[0]) qs.splice(Math.floor(qs.length / 2), 0, compQs[0]);
    if (compQs[1]) qs.push(compQs[1]);
    lesson = { chapterNum, qs, i: 0, wrong: 0, xp: 0, wrongQs: [], inRetest: false, awarded: false }; // 愛心改用 state.hearts（跨關卡共用）
    refreshFriendBonus(); // 背景刷新組隊加成，結算時用最新值（失敗就沿用快取）
    renderTopbar();
    show('#screen-lesson');
    renderQuestion();
  }
  $('#btn-quit').onclick = () => {
    // 錯題複習/間隔複習/拼圖離開不會白打；正式輪離開才會失去進度
    const isReview = lesson && lesson.isReview;
    const isPuzzle = lesson && lesson.isPuzzle;
    const msg = isPuzzle
      ? '要先離開拼圖挑戰嗎？（不會有任何損失）'
      : isReview
        ? '要先離開複習嗎？已答的進度會保留。'
        : (lesson && lesson.inRetest)
          ? '過關成績已經保存了！要跳過剩下的錯題複習嗎?'
          : '確定要離開嗎？這一關的進度不會保留。';
    if (confirm(msg)) {
      lesson = null; renderTopbar();
      if (isPuzzle) { renderPuzzle(); show('#screen-puzzle'); return; }
      if (isReview || !currentBook) { renderBooks(); renderReviewBanner(); show('#screen-books'); return; }
      show('#screen-chapters'); openBook(currentBook.id);
    }
  };

  let currentAnswerGetter = null; // 回傳 {ok, correctText} 或 null（尚未作答完）

  function renderQuestion() {
    const q = lesson.qs[lesson.i];
    $('#lesson-progress').style.width = `${(lesson.i / lesson.qs.length) * 100}%`;
    $('#lesson-hearts').textContent = heartStr(state.hearts);
    $('#btn-check').disabled = true;
    $('#feedback-bar').classList.add('hidden');
    $('#btn-check').classList.remove('hidden');
    $('#lesson-bottom').classList.remove('hidden'); // 顯示「確定」列（緊貼選項下方）
    const rb = $('#btn-report');
    rb.disabled = false;
    rb.textContent = '🚩 回報這題';
    const area = $('#question-area');
    area.innerHTML = '';
    if (q.type === 'fill') renderFill(q, area);
    if (q.type === 'order') renderOrder(q, area);
    if (q.type === 'match') renderMatch(q, area);
    if (q.type === 'next') renderNext(q, area);
    if (q.type === 'comp') renderComp(q, area);
    if (q.type === 'tf') renderTF(q, area);
    if (q.type === 'typefill') renderTypeFill(q, area);
    if (q.type === 'read') renderRead(q, area);
    if (lesson.inRetest || lesson.isReview || lesson.isPuzzle) { // 複習/拼圖：題目上方掛個提示徽章
      const badge = document.createElement('div');
      badge.className = 'retest-badge';
      badge.textContent = lesson.isPuzzle
        ? `🧩 拼圖挑戰：${BEATITUDES[lesson.puzzleIdx].label} · 答錯不扣愛心`
        : lesson.isReview ? '📅 今日複習 · 答對記憶升級，答錯不扣愛心' : '🔁 錯題複習中 · 答錯不扣愛心';
      area.prepend(badge);
    }
  }

  // --- 題型 1 & 4：選擇題共用 ---
  function renderChoices(q, area, titleHTML) {
    area.innerHTML = titleHTML;
    const box = document.createElement('div');
    box.className = 'choices';
    let selected = null;
    for (const opt of q.options) {
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.textContent = opt;
      btn.onclick = () => {
        box.querySelectorAll('.choice').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selected = { text: opt, el: btn };
        $('#btn-check').disabled = false;
      };
      box.appendChild(btn);
    }
    area.appendChild(box);
    currentAnswerGetter = () => {
      if (!selected) return null;
      const ok = selected.text === q.answer;
      selected.el.classList.add(ok ? 'correct' : 'wrong');
      if (!ok) box.querySelectorAll('.choice').forEach(b => { if (b.textContent === q.answer) b.classList.add('correct'); });
      return { ok, correctText: q.answer, note: q.basis ? `📖 ${q.basis}` : '' };
    };
  }
  function renderComp(q, area) {
    renderChoices(q, area, `
      <div class="q-type">💡 讀懂了嗎</div>
      <div class="q-ref">${q.ref}</div>
      <div class="q-title">${q.q}</div>`);
  }
  function renderFill(q, area) {
    renderChoices(q, area, `
      <div class="q-type">📝 經文填空</div>
      <div class="q-ref">${q.ref}</div>
      <div class="q-passage">${q.display.replace('____', '<span class="blank">？</span>')}</div>`);
  }
  function renderNext(q, area) {
    renderChoices(q, area, `
      <div class="q-type">🔗 接下句</div>
      <div class="q-ref">${q.ref}</div>
      <div class="q-passage">${q.head}<span class="blank">……</span></div>`);
  }

  // --- 題型 5：是非題 ---
  function renderTF(q, area) {
    area.innerHTML = `
      <div class="q-type">⭕❌ 是非題：這句經文正確嗎？</div>
      <div class="q-ref">${q.ref}</div>
      <div class="q-passage">${escapeHtml(q.statement)}</div>`;
    const row = document.createElement('div');
    row.className = 'tf-row';
    let selected = null;
    for (const val of [true, false]) {
      const btn = document.createElement('button');
      btn.className = 'tf-btn';
      btn.innerHTML = val ? '⭕<span>正確</span>' : '❌<span>有錯</span>';
      btn.onclick = () => {
        row.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selected = { val, el: btn };
        $('#btn-check').disabled = false;
      };
      row.appendChild(btn);
    }
    area.appendChild(row);
    currentAnswerGetter = () => {
      if (!selected) return null;
      const ok = selected.val === q.answer;
      selected.el.classList.add(ok ? 'correct' : 'wrong');
      return {
        ok,
        correctText: q.answer ? '⭕ 這句是正確的' : '❌ 這句被改過了',
        note: q.answer === false ? `原文：${q.original}` : '',
      };
    };
  }

  // --- 題型 7：開口讀經 ---
  // 比對前先只留中文字（標點、空白、數字都不計較），再算編輯距離相似度
  function normalizeCJK(s) { return String(s).replace(/[^一-鿿㐀-䶿]/g, ''); }
  function similarity(a, b) {
    a = normalizeCJK(a); b = normalizeCJK(b);
    if (!a.length || !b.length) return 0;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return 1 - prev[b.length] / Math.max(a.length, b.length);
  }
  function renderRead(q, area) {
    area.innerHTML = `
      <div class="q-type">🎤 開口讀經：大聲唸出這節經文</div>
      <div class="q-ref">${q.ref}</div>
      <div class="q-passage no-copy" id="read-passage">${escapeHtml(q.text)}</div>
      <div class="read-box" id="read-box"></div>`;
    $('#lesson-bottom').classList.add('hidden'); // 自動判分，不用確定鈕
    currentAnswerGetter = () => null;
    const box = $('#read-box');

    // 防作弊：正解經文禁止選取/複製/剪下/右鍵，避免打字模式時被反白複製去刷相似度
    const passage = $('#read-passage');
    ['copy', 'cut', 'contextmenu', 'selectstart', 'dragstart'].forEach(ev =>
      passage.addEventListener(ev, e => e.preventDefault()));

    // 打字備援：環境不便朗讀、不支援語音、或權限被拒時
    function typingMode(msg) {
      box.innerHTML = msg ? `<p class="read-status">${escapeHtml(msg)}</p>` : '';
      const tip = document.createElement('p');
      tip.className = 'read-status';
      tip.textContent = '把上面這節經文照著打一遍（標點可省略）：';
      const input = document.createElement('textarea');
      input.className = 'type-input read-textarea';
      input.rows = 3;
      input.placeholder = '在這裡輸入經文…';
      // 防作弊：禁止貼上，逼使用者真的一字一字打
      ['paste', 'drop'].forEach(ev => input.addEventListener(ev, e => e.preventDefault()));
      const btn = document.createElement('button');
      btn.className = 'big-btn';
      btn.textContent = '送出';
      btn.disabled = true;
      input.oninput = () => { btn.disabled = !input.value.trim(); };
      btn.onclick = () => {
        const sim = similarity(input.value, q.text);
        input.disabled = true; btn.disabled = true;
        if (sim >= 0.9) checkAnswer(true, null, `抄寫完成！相似度 ${Math.round(sim * 100)}%`);
        else checkAnswer(false, q.text, '（朗讀操練不扣愛心）');
      };
      box.append(tip, input, btn);
      input.focus();
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { typingMode('這台裝置不支援語音辨識，改用打字模式：'); return; }

    box.innerHTML = `
      <button class="mic-btn" id="btn-mic" title="開始朗讀">🎤</button>
      <p class="read-status" id="read-status">點麥克風，大聲唸出上面的經文！</p>
      <button class="ghost-btn" id="btn-read-type">⌨️ 環境不方便唸？改用打字</button>`;
    $('#btn-read-type').onclick = () => typingMode();
    const micBtn = $('#btn-mic');
    const status = $('#read-status');
    let rec = null, listening = false;
    micBtn.onclick = () => {
      if (listening) { try { rec.stop(); } catch { /* 已停止 */ } return; }
      rec = new SR();
      rec.lang = 'zh-TW';
      rec.interimResults = false;
      rec.maxAlternatives = 5;
      rec.onresult = (e) => {
        const alts = [...e.results[0]].map(a => a.transcript);
        let best = 0, bestText = alts[0] || '';
        for (const t of alts) { const s = similarity(t, q.text); if (s > best) { best = s; bestText = t; } }
        if (best >= 0.5) { // 朗讀相似度門檻：2026-07-16 使用者回饋從 0.65 調降，念個大概就過
          checkAnswer(true, null, `辨識到「${bestText}」，相似度 ${Math.round(best * 100)}%`);
        } else {
          status.textContent = `聽到「${bestText || '（沒聽清楚）'}」，相似度 ${Math.round(best * 100)}%——再唸一次試試！`;
        }
      };
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          typingMode('麥克風權限沒開（或這台裝置不支援），改用打字模式：');
        } else {
          status.textContent = '沒聽清楚或網路不穩——再點一次麥克風，不行就改用打字。';
        }
      };
      rec.onend = () => { listening = false; micBtn.classList.remove('listening'); };
      try {
        rec.start();
        listening = true;
        micBtn.classList.add('listening');
        status.textContent = '👂 聽你唸…（唸完會自動辨識）';
      } catch { typingMode('語音服務啟動失敗，改用打字模式：'); }
    };
  }

  // --- 題型 6：打字填空 ---
  function renderTypeFill(q, area) {
    area.innerHTML = `
      <div class="q-type">⌨️ 打字填空（提示：${q.answer.length} 個字）</div>
      <div class="q-ref">${q.ref}</div>
      <div class="q-passage">${q.display.replace('____', '<span class="blank">？</span>')}</div>`;
    const input = document.createElement('input');
    input.className = 'type-input';
    input.type = 'text';
    input.autocomplete = 'off';
    input.placeholder = `輸入 ${q.answer.length} 個字`;
    input.maxLength = q.answer.length + 2;
    input.oninput = () => { $('#btn-check').disabled = !input.value.trim(); };
    input.onkeydown = (e) => { if (e.key === 'Enter' && input.value.trim() && !$('#btn-check').disabled) $('#btn-check').click(); };
    area.appendChild(input);
    currentAnswerGetter = () => {
      const val = input.value.trim();
      if (!val) return null;
      const ok = val === q.answer;
      input.classList.add(ok ? 'correct' : 'wrong');
      input.disabled = true;
      return { ok, correctText: q.answer };
    };
  }

  // --- 題型 2：排順序（按住把手拖曳排序）---
  function renderOrder(q, area) {
    area.innerHTML = `
      <div class="q-type">🧩 把經文排回正確順序</div>
      <div class="q-ref">${q.ref}</div>
      <div class="q-hint">按住卡片上下拖曳，把句子排成正確順序，排好按「確定」。</div>
      <div class="sort-list" id="sort-list"></div>`;
    const list = $('#sort-list');
    for (const piece of q.pieces) {
      const row = document.createElement('div');
      row.className = 'sort-item';
      const handle = document.createElement('span');
      handle.className = 'sort-handle';
      handle.textContent = '⠿';
      const text = document.createElement('span');
      text.className = 'sort-text';
      text.textContent = piece;
      row.append(handle, text);
      list.appendChild(row);
    }
    // 指標事件拖曳（手機觸控與滑鼠通吃）；整張卡都能拖，⠿ 只是視覺提示
    let drag = null;
    list.addEventListener('pointerdown', (e) => {
      const item = e.target.closest('.sort-item');
      if (!item) return;
      e.preventDefault();
      try { item.setPointerCapture(e.pointerId); } catch { /* 測試環境的合成事件沒有真 pointerId */ }
      drag = { item, y: e.clientY };
      item.classList.add('dragging');
    });
    list.addEventListener('pointermove', (e) => {
      if (!drag) return;
      e.preventDefault();
      const { item } = drag;
      item.style.transform = `translateY(${e.clientY - drag.y}px)`;
      // 越過鄰近卡片的「中線」才交換位置（往下拖要過下面那張的中線、往上同理）
      const center = item.getBoundingClientRect().top + item.offsetHeight / 2;
      for (const sib of [...list.children]) {
        if (sib === item) continue;
        const r = sib.getBoundingClientRect();
        if (center <= r.top || center >= r.bottom) continue;
        const sibIsBelow = !!(item.compareDocumentPosition(sib) & Node.DOCUMENT_POSITION_FOLLOWING);
        if (sibIsBelow && center > r.top + r.height / 2) {
          list.insertBefore(item, sib.nextSibling);
        } else if (!sibIsBelow && center < r.top + r.height / 2) {
          list.insertBefore(item, sib);
        } else {
          break; // 還沒過中線，先不動
        }
        drag.y = e.clientY; // 換位後重設基準，卡片跟著手指繼續走
        item.style.transform = '';
        break;
      }
    });
    const endDrag = () => {
      if (!drag) return;
      drag.item.style.transform = '';
      drag.item.classList.remove('dragging');
      drag = null;
      $('#btn-check').disabled = false; // 動過就能按確定
    };
    list.addEventListener('pointerup', endDrag);
    list.addEventListener('pointercancel', endDrag);
    currentAnswerGetter = () => {
      const order = [...list.querySelectorAll('.sort-text')].map(el => el.textContent);
      const ok = order.join('') === q.answer.join('');
      return { ok, correctText: q.answer.join('') };
    };
  }

  // --- 題型 3：配對 ---
  function renderMatch(q, area) {
    area.innerHTML = `
      <div class="q-type">🃏 上下句配對</div>
      <div class="q-ref">${q.ref}</div>
      <div class="q-hint">點左邊的「上句」，再點右邊對應的「下句」，把 4 對經文配起來。</div>`;
    const wrap = document.createElement('div');
    wrap.className = 'pairs-2col';
    const colL = document.createElement('div'); colL.className = 'pair-col';
    const colR = document.createElement('div'); colR.className = 'pair-col';
    colL.innerHTML = '<div class="pair-head">上句</div>';
    colR.innerHTML = '<div class="pair-head">下句</div>';
    const items = [];
    q.pairs.forEach((p, i) => {
      items.push({ text: p.left, key: i, side: 'L' });
      items.push({ text: p.right, key: i, side: 'R' });
    });
    let mistakes = 0, matched = 0, sel = null;
    const lefts = items.filter(x => x.side === 'L').sort(() => Math.random() - 0.5);
    const rights = items.filter(x => x.side === 'R').sort(() => Math.random() - 0.5);
    function makeBtn(it) {
      const btn = document.createElement('button');
      btn.className = 'pair-btn';
      btn.textContent = it.text;
      btn.onclick = () => {
        if (btn.classList.contains('matched')) return;
        if (!sel) { sel = { it, btn }; btn.classList.add('selected'); return; }
        if (sel.btn === btn) { btn.classList.remove('selected'); sel = null; return; }
        // 同一側再點另一張＝換選（不算配錯，2026-07-17 Burger 回饋）
        if (sel.it.side === it.side) {
          sel.btn.classList.remove('selected');
          sel = { it, btn }; btn.classList.add('selected');
          return;
        }
        if (sel.it.key === it.key && sel.it.side !== it.side) {
          sel.btn.classList.add('matched'); btn.classList.add('matched');
          sel.btn.classList.remove('selected');
          matched++;
          sndGood();
          if (matched === 4) { $('#btn-check').disabled = false; checkAnswer(mistakes === 0 ? true : 'soft'); }
        } else {
          mistakes++;
          btn.classList.add('shake'); sel.btn.classList.add('shake');
          sndBad();
          const a = sel.btn, b = btn;
          setTimeout(() => { a.classList.remove('shake', 'selected'); b.classList.remove('shake'); }, 350);
        }
        sel = null;
      };
      return btn;
    }
    lefts.forEach((it) => colL.appendChild(makeBtn(it)));
    rights.forEach((it) => colR.appendChild(makeBtn(it)));
    wrap.append(colL, colR);
    area.appendChild(wrap);
    currentAnswerGetter = () => null; // 配對題自動判定，不用確定鈕
    $('#lesson-bottom').classList.add('hidden');
  }

  // ===== 判分與回饋 =====
  $('#btn-check').onclick = () => {
    const result = currentAnswerGetter && currentAnswerGetter();
    if (!result) return;
    checkAnswer(result.ok, result.correctText, result.note);
  };
  function checkAnswer(ok, correctText, note) {
    const q = lesson.qs[lesson.i];
    const fb = $('#feedback-bar');
    fb.classList.remove('hidden', 'good', 'bad');
    const noteHtml = note ? `<br><small>${escapeHtml(note)}</small>` : '';
    if (ok === true) {
      fb.classList.add('good');
      $('#feedback-text').innerHTML = `<span class="fb-mascot">${mascot().emoji}</span><span>${pickPraise()}${noteHtml}</span>`;
      if (lesson.isReview) { // 間隔複習答對：進下一階段
        bumpReviewItem(lesson.reviewItems[lesson.i], true);
        lesson.reviewCorrect++;
        store.save(state);
      } else if (lesson.isPuzzle) {
        lesson.puzzleCorrect = true; // 拼圖：獎勵在 winPuzzle 一次發
      } else if (!lesson.inRetest) {
        lesson.xp += 10; // 錯題再測驗不重複給經驗值
      }
      if (q.type === 'read') state.stats.readOk = (state.stats.readOk || 0) + 1; // 朗讀徽章計數
      sndGood();
    } else if (ok === 'soft') { // 配對題有配錯但完成
      fb.classList.add('good');
      $('#feedback-text').innerHTML = `<span class="fb-mascot">${mascot().emoji}</span><span>完成配對！（中途有配錯，這題不加分）</span>`;
    } else {
      fb.classList.add('bad');
      const retestNote = lesson.isPuzzle ? '（拼圖挑戰不扣愛心）' : (lesson.inRetest || lesson.isReview) ? '（複習不扣愛心）' : '';
      $('#feedback-text').innerHTML = `<span class="fb-mascot">💭</span><span>正確答案：${escapeHtml(correctText)}${escapeHtml(retestNote)}${noteHtml}</span>`;
      sndBad();
      if (lesson.isReview) { // 間隔複習答錯：退回明天再考
        bumpReviewItem(lesson.reviewItems[lesson.i], false);
        store.save(state);
      } else if (!lesson.inRetest && !lesson.isPuzzle && q.type !== 'read') { // 正式輪答錯：扣愛心（跨關卡共用）、記下錯題供之後複習（朗讀操練、拼圖除外）
        loseHeart();
        lesson.wrong++;
        lesson.wrongQs.push(q);
        renderTopbar();
        $('#lesson-hearts').textContent = heartStr(state.hearts);
      }
    }
    $('#lesson-bottom').classList.add('hidden'); // 收起「確定」列，改由回饋條顯示「繼續」
  }
  const PRAISES = ['太棒了！', '答對了！🎉', '哇，你是讀經高手！', '正確！繼續保持！', '阿們，就是這句！'];
  function pickPraise() { return PRAISES[Math.floor(Math.random() * PRAISES.length)]; }

  function advanceLesson() {
    lesson.i++;
    if (lesson.i >= lesson.qs.length) {
      if (lesson.isPuzzle) { winPuzzle(); return; } // 拼圖單題挑戰結束
      if (lesson.isReview) { winReview(); return; } // 間隔複習結束
      // 正式輪跑完、且有答錯的題目 → 先記錄過關成績，再進錯題複習（複習中途離開也不會白打）
      if (!lesson.inRetest && lesson.wrongQs.length) { awardWin(); startRetest(); return; }
      winLesson(); return;
    }
    renderQuestion();
  }
  $('#btn-next').onclick = () => {
    if (state.hearts <= 0) { offerRevive(lesson.chapterNum, advanceLesson, failLesson); return; } // 愛心用完：先給讀經回血的機會
    advanceLesson();
  };

  // ===== 錯題再測驗：正式輪結束後把答錯的題目再練一次（答錯不扣愛心）=====
  function startRetest() {
    lesson.inRetest = true;
    lesson.qs = lesson.wrongQs.slice();
    lesson.i = 0;
    renderTopbar(); // 過關成績剛記帳完，讓經驗值立即反映在狀態列
    $('#retest-sub').textContent = `過關成績已保存！把剛才答錯的 ${lesson.qs.length} 題再練一次，答錯不扣愛心。`;
    $('#feedback-bar').classList.add('hidden');
    $('#retest-overlay').classList.remove('hidden');
  }
  $('#btn-retest-start').onclick = () => {
    $('#retest-overlay').classList.add('hidden');
    renderQuestion();
  };

  // ===== 讀經回血：愛心用完時讀完該章 +1 愛心（跨關卡共用；也可等每小時自動回復）=====
  let reviveCtx = null; // { onRead, onQuit }：讀完/放棄各自要做的事
  function offerRevive(chapterNum, onRead, onQuit) {
    reviveCtx = { onRead, onQuit };
    const verses = currentBook.chapters[chapterNum - 1] || [];
    const box = $('#revive-passage');
    box.innerHTML = `<h4>${escapeHtml(currentBook.name)} 第 ${chapterNum} 章</h4>` +
      verses.map((v, i) => `<p class="rv-verse"><b>${i + 1}</b> ${escapeHtml(v)}</p>`).join('');
    const readBtn = $('#btn-revive-read');
    readBtn.disabled = true;
    // 捲到底（或內容短到不需捲動）就解鎖按鈕，確保真的讀過
    const check = () => {
      if (box.scrollTop + box.clientHeight >= box.scrollHeight - 8) readBtn.disabled = false;
    };
    box.onscroll = check;
    updateHeartUi(); // 顯示「或等 X 自動回復一顆」
    $('#revive-overlay').classList.remove('hidden');
    box.scrollTop = 0; // 顯示後才重設，避免同章重複回血時保留舊捲動位置卡在底部
    setTimeout(check, 1500); // 短章不需捲動時自動解鎖
  }
  $('#btn-revive-read').onclick = () => {
    $('#revive-overlay').classList.add('hidden');
    gainHeart(1);
    renderTopbar();
    const cb = reviveCtx && reviveCtx.onRead; reviveCtx = null;
    if (cb) cb();
  };
  $('#btn-revive-quit').onclick = () => {
    $('#revive-overlay').classList.add('hidden');
    const cb = reviveCtx && reviveCtx.onQuit; reviveCtx = null;
    if (cb) cb();
  };

  // ===== 結算 =====
  // 過關記帳（只做一次）：發經驗值、記完成章、更新連續天數。與結算畫面分開，
  // 這樣進錯題複習前就能先保存成績，複習中途離開也不會白打。
  function awardWin() {
    if (lesson.awarded) return;
    lesson.awarded = true;
    lesson.perfect = lesson.wrong === 0;
    const bonus = lesson.perfect ? 20 : 0;
    const base = lesson.xp + bonus;
    // 好友組隊加成：只加在章節過關與錯題複習（小遊戲/衝刺不加，防刷分）
    lesson.friendPct = friendBonus.pct || 0;
    lesson.friendXp = Math.round(base * lesson.friendPct / 100);
    lesson.gained = base + lesson.friendXp;
    state.xp += lesson.gained;
    ensureWeek();
    state.weekXp += lesson.gained;
    state.weekCh = (state.weekCh || 0) + 1; // 本週完成章數（好友週任務進度）
    bumpStreak();
    const done = state.done[currentBook.id] || (state.done[currentBook.id] = []);
    if (!done.includes(lesson.chapterNum)) done.push(lesson.chapterNum);
    queueReview(); // 答錯的題排進間隔複習佇列
    store.save(state);
    refreshFriendBonus(); // 我的週任務進度剛變了，背景重算加成（下一關生效）
  }
  // ===== 錯題間隔複習（SRS）=====
  const reviewKey = (q) => q.type + '|' + (q.ref || '') + '|' + (Array.isArray(q.answer) ? q.answer.join('') : String(q.answer));
  function queueReview() {
    if (!lesson.wrongQs.length) return;
    const review = state.review || (state.review = []);
    for (const q of lesson.wrongQs) {
      const key = reviewKey(q);
      if (review.some(r => r.key === key)) continue;
      review.push({ key, q, book: currentBook.id, due: addDaysStr(1), stage: 0 });
    }
    while (review.length > 50) review.shift(); // 佇列上限，太舊的先淘汰
  }
  function dueReviews() {
    const t = today();
    return (state.review || []).filter(r => r.due <= t);
  }
  // 答對進下一階段（1→3→7 天後再考），對滿三次畢業移除；答錯退回明天再考
  function bumpReviewItem(item, ok) {
    if (ok) {
      item.stage = (item.stage || 0) + 1;
      if (item.stage >= 3) state.review = state.review.filter(r => r.key !== item.key);
      else item.due = addDaysStr([1, 3, 7][item.stage]);
    } else {
      item.stage = 0;
      item.due = addDaysStr(1);
    }
  }
  function renderReviewBanner() {
    const banner = $('#review-banner');
    if (!banner) return;
    const n = dueReviews().length;
    banner.classList.toggle('hidden', n === 0);
    if (n) $('#review-count').textContent = n;
  }
  // ===== 天國八福拼圖（太 5:3-10，一片一福）=====
  const BEATITUDES = [
    { label: '虛心的人', emoji: '🙇', vi: 2 },
    { label: '哀慟的人', emoji: '😢', vi: 3 },
    { label: '溫柔的人', emoji: '🕊️', vi: 4 },
    { label: '飢渴慕義的人', emoji: '🍞', vi: 5 },
    { label: '憐恤人的人', emoji: '💗', vi: 6 },
    { label: '清心的人', emoji: '💎', vi: 7 },
    { label: '使人和睦的人', emoji: '🤝', vi: 8 },
    { label: '為義受逼迫的人', emoji: '👑', vi: 9 },
  ];
  const puzzleGot = () => state.puzzles.beatitudes;
  function renderPuzzle() {
    const got = puzzleGot();
    const grid = $('#puzzle-grid');
    grid.innerHTML = '';
    BEATITUDES.forEach((b, i) => {
      const tile = document.createElement('button');
      const owned = got.includes(i);
      tile.className = 'pz-tile' + (owned ? ' owned' : '');
      tile.innerHTML = owned
        ? `<span class="pz-tile-emoji">${b.emoji}</span><span class="pz-tile-label">${b.label}</span><span class="pz-tile-sub">有福了！</span>`
        : `<span class="pz-tile-emoji">🔒</span><span class="pz-tile-label">第 ${i + 1} 福</span><span class="pz-tile-sub">點我挑戰</span>`;
      if (!owned) tile.onclick = () => startPuzzleQuestion(i);
      grid.appendChild(tile);
    });
    // 集滿：顯示完整八福金句卡
    const doneBox = $('#puzzle-complete');
    if (got.length === BEATITUDES.length) {
      $('#puzzle-hint').classList.add('hidden');
      grid.classList.add('hidden');
      doneBox.classList.remove('hidden');
      doneBox.innerHTML = `
        <div class="bcard">
          <div class="bcard-title">✨ 天國八福 ✨</div>
          <div class="bcard-ref">馬太福音 5:3-10</div>
          ${BEATITUDES.map((b, i) => `<div class="bcard-row"><span>${b.emoji}</span><span>${escapeHtml(bookVerse(i))}</span></div>`).join('')}
          <div class="bcard-foot">🧩 拼圖完成！這八句話是天國子民的樣子</div>
        </div>`;
    } else {
      $('#puzzle-hint').classList.remove('hidden');
      grid.classList.remove('hidden');
      doneBox.classList.add('hidden');
    }
  }
  // 八福經文（拼圖完成卡用；MAT 已載入時直接取，未載入用精簡版標籤）
  function bookVerse(i) {
    const mat = bookCache['MAT'];
    return mat ? mat.chapters[4][BEATITUDES[i].vi] : `${BEATITUDES[i].label}有福了！`;
  }
  async function startPuzzleQuestion(i) {
    let book;
    try { book = await loadBook('MAT'); }
    catch { alert('網路不穩，載入經文失敗了，請再試一次。'); return; }
    const q = QuestionFactory.generateVerseQuestion(book, 5, BEATITUDES[i].vi);
    if (!q) { alert('這一福暫時出不了題，先挑別片吧！'); return; }
    currentBook = book;
    lesson = {
      chapterNum: 5, qs: [q], i: 0, hearts: MAX_HEARTS, wrong: 0, xp: 0,
      wrongQs: [], inRetest: false, awarded: true, // 拼圖不走過關記帳
      isPuzzle: true, puzzleIdx: i, puzzleCorrect: false,
    };
    renderTopbar();
    show('#screen-lesson');
    renderQuestion();
  }
  function winPuzzle() {
    const i = lesson.puzzleIdx;
    const b = BEATITUDES[i];
    if (lesson.puzzleCorrect) {
      const got = puzzleGot();
      if (!got.includes(i)) got.push(i);
      state.xp += 20;
      ensureWeek();
      state.weekXp += 20;
      bumpStreak();
      store.save(state);
      sndWin();
      if (got.length === BEATITUDES.length) throwConfetti();
    }
    const got = puzzleGot();
    $('#result-box').innerHTML = lesson.puzzleCorrect ? `
      <div class="r-emoji">${b.emoji}🧩</div>
      <h2>獲得拼圖！</h2>
      <p>「${b.label}有福了！」</p>
      <div class="result-stats">
        <div class="r-stat">＋20<span>經驗值</span></div>
        <div class="r-stat">${got.length}/8<span>已收集</span></div>
      </div>
      <button class="big-btn" id="btn-continue">${got.length === 8 ? '看完整八福卡 🎉' : '繼續拼圖'}</button>` : `
      <div class="r-emoji">${mascot().emoji}💭</div>
      <h2>差一點！</h2>
      <p>沒關係，拼圖挑戰不扣愛心，再試一次就好！</p>
      <button class="big-btn" id="btn-continue">再挑戰</button>`;
    $('#btn-continue').onclick = () => { lesson = null; renderTopbar(); renderPuzzle(); show('#screen-puzzle'); };
    lessonEndCommon();
  }
  // 八福拼圖從馬太福音章節頁進入，返回也回馬太
  $('#btn-back-puzzle').onclick = () => openBook('MAT');

  // ===== ⚡金句衝刺（60 秒限時連答）=====
  let sprint = null;
  function pickPlayedBookId() {
    const played = Object.keys(state.done).filter(id => (state.done[id] || []).length);
    return played.length ? played[Math.floor(Math.random() * played.length)] : 'MAT';
  }
  async function startSprint() {
    let book;
    try { book = await loadBook(pickPlayedBookId()); }
    catch { alert('網路不穩，載入經文失敗了，請再試一次。'); return; }
    // 從隨機章節湊一批「點選就能答」的快答題
    const qs = [];
    let guard = 0;
    while (qs.length < 40 && guard++ < 30) {
      const ch = 1 + Math.floor(Math.random() * book.chapters.length);
      for (const q of QuestionFactory.generateLesson(book, ch, 8)) {
        if (['fill', 'tf', 'next'].includes(q.type)) qs.push(q);
      }
    }
    if (qs.length < 10) { alert('這卷書湊不出快答題，先多闖幾關再來！'); return; }
    sprint = { qs: shuffleArr(qs), i: 0, score: 0, combo: 0, bestCombo: 0, correct: 0, total: 0, timeLeft: 60, timer: null, answered: false };
    show('#screen-sprint');
    $('#sprint-time').textContent = '60';
    $('#sprint-timer-fill').style.width = '100%';
    renderSprintQ();
    sprint.timer = setInterval(() => {
      if (!sprint) return;
      sprint.timeLeft--;
      $('#sprint-time').textContent = sprint.timeLeft;
      $('#sprint-timer-fill').style.width = `${(sprint.timeLeft / 60) * 100}%`;
      if (sprint.timeLeft <= 0) endSprint();
    }, 1000);
  }
  function stopSprintTimer() { if (sprint && sprint.timer) clearInterval(sprint.timer); }
  function renderSprintQ() {
    const q = sprint.qs[sprint.i % sprint.qs.length];
    $('#sprint-score').textContent = sprint.score;
    $('#sprint-combo').textContent = sprint.combo > 1 ? `🔥 連對 x${sprint.combo}` : '';
    let stem = '';
    if (q.type === 'fill') stem = q.display.replace('____', '<span class="blank">？</span>');
    if (q.type === 'next') stem = `${q.head}<span class="blank">……</span>`;
    if (q.type === 'tf') stem = escapeHtml(q.statement);
    const area = $('#sprint-area');
    area.innerHTML = `<div class="q-ref">${q.ref}</div><div class="q-passage sprint-passage">${stem}</div>`;
    const box = document.createElement('div');
    box.className = q.type === 'tf' ? 'tf-row' : 'choices';
    const opts = q.type === 'tf'
      ? [{ label: '⭕ 正確', val: true }, { label: '❌ 有錯', val: false }]
      : q.options.map(o => ({ label: o, val: o }));
    const btns = [];
    for (const o of opts) {
      const btn = document.createElement('button');
      btn.className = q.type === 'tf' ? 'tf-btn tf-mini' : 'choice';
      btn.textContent = o.label;
      btn.onclick = () => answerSprint(q, o, btn, btns, opts);
      btns.push(btn);
      box.appendChild(btn);
    }
    area.appendChild(box);
  }
  function answerSprint(q, opt, btn, btns, opts) {
    if (!sprint || sprint.answered) return;
    sprint.answered = true;
    sprint.total++;
    const ok = opt.val === q.answer;
    btn.classList.add(ok ? 'correct' : 'wrong');
    if (ok) {
      sprint.combo++;
      sprint.correct++;
      sprint.bestCombo = Math.max(sprint.bestCombo, sprint.combo);
      sprint.score += 10 + Math.min(10, (sprint.combo - 1) * 2); // 連對加成，單題最多 20 分
      sndGood();
    } else {
      sprint.combo = 0;
      const rightIdx = opts.findIndex(o => o.val === q.answer);
      if (rightIdx >= 0) btns[rightIdx].classList.add('correct');
      sndBad();
    }
    setTimeout(() => {
      if (!sprint) return;
      sprint.answered = false;
      sprint.i++;
      renderSprintQ();
    }, ok ? 350 : 900);
  }
  function endSprint() {
    stopSprintTimer();
    const s = sprint;
    sprint = null;
    const gained = Math.min(40, s.correct * 2); // 封頂避免刷分
    state.xp += gained;
    ensureWeek();
    state.weekXp += gained;
    bumpStreak();
    state.stats.sprintPlays = (state.stats.sprintPlays || 0) + 1;
    const newBest = s.score > (state.stats.sprintBest || 0);
    if (newBest) state.stats.sprintBest = s.score;
    store.save(state);
    sndWin();
    if (newBest && s.score > 0) throwConfetti();
    $('#result-box').innerHTML = `
      <div class="r-emoji">⚡${newBest && s.score > 0 ? '🏆' : ''}</div>
      <h2>衝刺結束！</h2>
      <p>${newBest && s.score > 0 ? '新紀錄！' : `最佳紀錄 ${state.stats.sprintBest || 0} 分`}</p>
      <div class="result-stats">
        <div class="r-stat">${s.score}<span>本場分數</span></div>
        <div class="r-stat">${s.correct}/${s.total}<span>答對題數</span></div>
        <div class="r-stat">🔥${s.bestCombo}<span>最長連對</span></div>
      </div>
      <div class="result-stats"><div class="r-stat">＋${gained}<span>經驗值</span></div></div>
      <button class="big-btn" id="btn-sprint-again">再衝一次 ⚡</button>
      <button class="ghost-btn" id="btn-continue">回首頁</button>`;
    $('#btn-sprint-again').onclick = () => startSprint();
    $('#btn-continue').onclick = () => { renderTopbar(); renderBooks(); show('#screen-books'); };
    renderTopbar();
    show('#screen-result');
  }
  $('#btn-sprint').onclick = () => startSprint();
  $('#btn-sprint-quit').onclick = () => { stopSprintTimer(); sprint = null; renderBooks(); show('#screen-books'); };

  // ===== 🃏經文翻牌（上下句配對記憶）=====
  let flip = null;
  async function startFlip() {
    let book;
    try { book = await loadBook(pickPlayedBookId()); }
    catch { alert('網路不穩，載入經文失敗了，請再試一次。'); return; }
    let pairs = null, ref = '';
    for (let t = 0; t < 15 && !pairs; t++) {
      const ch = 1 + Math.floor(Math.random() * book.chapters.length);
      const p = QuestionFactory.generatePairs(book, ch, 6);
      if (p.length === 6) { pairs = p; ref = `（${book.name} ${ch} 章）`; }
    }
    if (!pairs) { alert('這卷書湊不出牌組，再點一次換一卷試試！'); return; }
    const cards = [];
    pairs.forEach((p, i) => {
      cards.push({ key: i, text: p.left });
      cards.push({ key: i, text: p.right });
    });
    flip = { cards: shuffleArr(cards), matched: 0, moves: 0, sel: null, lock: false, ref };
    renderFlip();
    show('#screen-flip');
  }
  function renderFlip() {
    $('#flip-ref').textContent = flip.ref;
    $('#flip-moves').textContent = flip.moves;
    const grid = $('#flip-grid');
    grid.innerHTML = '';
    flip.cards.forEach((c) => {
      const card = document.createElement('button');
      card.className = 'flip-card';
      card.innerHTML = `<span class="flip-inner"><span class="flip-face flip-front">📖</span><span class="flip-face flip-back"></span></span>`;
      card.querySelector('.flip-back').textContent = c.text;
      card.onclick = () => flipCard(c, card);
      grid.appendChild(card);
    });
  }
  function flipCard(c, el) {
    if (!flip || flip.lock || el.classList.contains('open') || el.classList.contains('done')) return;
    el.classList.add('open');
    if (!flip.sel) { flip.sel = { c, el }; return; }
    flip.moves++;
    $('#flip-moves').textContent = flip.moves;
    const a = flip.sel;
    flip.sel = null;
    if (a.c.key === c.key) { // 配對成功
      a.el.classList.add('done'); el.classList.add('done');
      flip.matched++;
      sndGood();
      if (flip.matched === 6) setTimeout(endFlip, 500);
    } else {
      flip.lock = true;
      sndBad();
      setTimeout(() => { a.el.classList.remove('open'); el.classList.remove('open'); flip.lock = false; }, 750);
    }
  }
  function endFlip() {
    const moves = flip.moves;
    flip = null;
    const gained = 20;
    state.xp += gained;
    ensureWeek();
    state.weekXp += gained;
    bumpStreak();
    state.stats.flipWins = (state.stats.flipWins || 0) + 1;
    store.save(state);
    sndWin();
    $('#result-box').innerHTML = `
      <div class="r-emoji">🃏🎉</div>
      <h2>全部配對完成！</h2>
      <p>${moves <= 9 ? '記憶力驚人！' : '經文又更熟了一點！'}</p>
      <div class="result-stats">
        <div class="r-stat">${moves}<span>使用步數</span></div>
        <div class="r-stat">＋${gained}<span>經驗值</span></div>
      </div>
      <button class="big-btn" id="btn-flip-again">再玩一局 🃏</button>
      <button class="ghost-btn" id="btn-continue">回首頁</button>`;
    $('#btn-flip-again').onclick = () => startFlip();
    $('#btn-continue').onclick = () => { renderTopbar(); renderBooks(); show('#screen-books'); };
    renderTopbar();
    show('#screen-result');
  }
  $('#btn-flip').onclick = () => startFlip();
  $('#btn-back-flip').onclick = () => { flip = null; renderBooks(); show('#screen-books'); };

  // ===== 🚢 挪亞方舟（複用翻牌：動物兩兩配對送上方舟 → 鴿子橄欖葉 → 彩虹立約）=====
  const NOAH_ANIMALS = ['🦁', '🐘', '🐫', '🦒', '🐄', '🐑', '🐐', '🦓', '🐅', '🦌', '🐒', '🐖'];
  const NOAH_BONUS = [
    { q: '潔淨的畜類，挪亞要帶幾公幾母上方舟？', options: ['七公七母', '一公一母', '兩公兩母', '三公三母'], answer: '七公七母', basis: '創 7:2' },
    { q: '洪水的大雨下了多久？', options: ['四十晝夜', '七晝夜', '一百天', '一年'], answer: '四十晝夜', basis: '創 7:12' },
    { q: '鴿子回到方舟時，嘴裏叼着甚麼？', options: ['新擰下的橄欖葉子', '一根麥穗', '一朵雲彩', '一條小魚'], answer: '新擰下的橄欖葉子', basis: '創 8:11' },
    { q: '神把虹放在雲彩中，作為與地立約的甚麼？', options: ['記號', '禮物', '賞賜', '命令'], answer: '記號', basis: '創 9:13' },
  ];
  let noah = null; // { cards, matched, pairs, moves, sel, lock, bonus, phase }
  function startNoah() {
    const animals = shuffleArr([...NOAH_ANIMALS]).slice(0, 8);
    const cards = [];
    animals.forEach((a, i) => { cards.push({ key: i, emoji: a }); cards.push({ key: i, emoji: a }); });
    noah = {
      cards: shuffleArr(cards), matched: 0, pairs: animals.length,
      moves: 0, sel: null, lock: false,
      bonus: NOAH_BONUS[Math.floor(Math.random() * NOAH_BONUS.length)], phase: 'match',
    };
    $('#noah-hint').textContent = '翻牌找出成對的動物，兩兩送上方舟！全部配對就開船。';
    renderNoahBoard();
    show('#screen-noah');
  }
  function renderNoahBoard() {
    $('#noah-moves').textContent = noah.moves;
    const grid = $('#noah-grid');
    grid.className = 'flip-grid';
    grid.innerHTML = '';
    noah.cards.forEach((c) => {
      const card = document.createElement('button');
      card.className = 'flip-card';
      card.innerHTML = `<span class="flip-inner"><span class="flip-face flip-front">🚢</span><span class="flip-face flip-back"></span></span>`;
      card.querySelector('.flip-back').textContent = c.emoji;
      card.onclick = () => noahFlip(c, card);
      grid.appendChild(card);
    });
  }
  function noahFlip(c, el) {
    if (!noah || noah.lock || noah.phase !== 'match' || el.classList.contains('open') || el.classList.contains('done')) return;
    el.classList.add('open');
    if (!noah.sel) { noah.sel = { c, el }; return; }
    noah.moves++;
    $('#noah-moves').textContent = noah.moves;
    const a = noah.sel;
    noah.sel = null;
    if (a.c.key === c.key) {
      a.el.classList.add('done'); el.classList.add('done');
      noah.matched++;
      sndGood();
      if (noah.matched === noah.pairs) setTimeout(noahBonus, 500);
    } else {
      noah.lock = true;
      sndBad();
      setTimeout(() => { a.el.classList.remove('open'); el.classList.remove('open'); noah.lock = false; }, 750);
    }
  }
  function noahBonus() {
    noah.phase = 'quiz';
    const q = noah.bonus;
    $('#noah-hint').textContent = '🕊️ 動物都上船了！開船前，回答一題航行日誌：';
    const grid = $('#noah-grid');
    grid.className = '';
    grid.innerHTML = `<div class="q-title">${escapeHtml(q.q)}</div>`;
    const box = document.createElement('div');
    box.className = 'choices';
    const btns = [];
    for (const o of shuffleArr(q.options)) {
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.textContent = o;
      btn.onclick = () => {
        if (noah.phase !== 'quiz') return;
        noah.phase = 'done';
        const ok = o === q.answer;
        btn.classList.add(ok ? 'correct' : 'wrong');
        if (!ok) { const ri = btns.findIndex(b => b.textContent === q.answer); if (ri >= 0) btns[ri].classList.add('correct'); sndBad(); }
        else sndGood();
        setTimeout(() => endNoah(ok), ok ? 600 : 1100);
      };
      btns.push(btn);
      box.appendChild(btn);
    }
    grid.appendChild(box);
  }
  function endNoah(bonusOk) {
    const moves = noah.moves;
    noah = null;
    const first = !state.minigames.noah;
    const gained = first ? 60 : 10; // 2026-07-18 小遊戲經驗加倍（原 30/5）
    if (first) state.minigames.noah = true;
    state.xp += gained;
    ensureWeek();
    state.weekXp += gained;
    bumpStreak();
    store.save(state);
    sndWin();
    throwConfetti();
    $('#result-box').innerHTML = `
      <div class="r-emoji">🕊️🫒🌈</div>
      <h2>水退了，彩虹掛在天上！</h2>
      <p>動物兩兩上了方舟，洪水過後鴿子叼回新擰下的橄欖葉子——地上的水退了。神把虹放在雲中，作與地立約的記號：不再用洪水毀滅凡有血肉的了。</p>
      <div class="result-stats">
        <div class="r-stat">${moves}<span>配對步數</span></div>
        <div class="r-stat">＋${gained}<span>經驗值${first ? '' : '（重玩）'}</span></div>
      </div>
      <button class="big-btn" id="btn-noah-again">再玩一次 🚢</button>
      <button class="ghost-btn" id="btn-continue">回書卷</button>`;
    $('#btn-noah-again').onclick = () => startNoah();
    $('#btn-continue').onclick = () => { renderTopbar(); openBook('GEN'); };
    renderTopbar();
    show('#screen-result');
  }
  $('#btn-back-noah').onclick = () => {
    if (confirm('要離開挪亞方舟嗎？（不會有任何損失）')) { noah = null; openBook('GEN'); }
  };

  // ===== 🎮 動作小遊戲 2.0（每款不同操作；有 2.0 版的故事，入口自動改開新版）=====
  const ACTION_GAMES = {}; // gameId → 啟動函數
  let action = null;       // { book, state, cleanup }
  function startAction(title, book, cleanup) {
    action = { book, cleanup: cleanup || null };
    $('#action-title').textContent = title;
    show('#screen-action');
    return $('#action-area');
  }
  function endActionState() {
    if (action && action.cleanup) { try { action.cleanup(); } catch (e) { /* 清理失敗不擋流程 */ } }
    action = null;
  }
  $('#btn-action-quit').onclick = () => {
    if (!confirm('要離開這個小遊戲嗎？（不會有任何損失）')) return;
    const bk = action && action.book;
    endActionState();
    if (bk) openBook(bk); else { renderBooks(); show('#screen-books'); }
  };
  function winAction(id, book, win, again) {
    endActionState();
    const first = !state.minigames[id];
    const gained = first ? 60 : 10; // 2026-07-18 小遊戲經驗加倍（原 30/5）
    if (first) state.minigames[id] = true;
    state.xp += gained;
    ensureWeek();
    state.weekXp += gained;
    bumpStreak();
    store.save(state);
    sndWin();
    throwConfetti();
    $('#result-box').innerHTML = `
      <div class="r-emoji">${win.emoji || '🎉'}</div>
      <h2>${win.title || '獲勝！'}</h2>
      <p>${win.text}</p>
      <div class="result-stats"><div class="r-stat">＋${gained}<span>經驗值${first ? '' : '（重玩）'}</span></div></div>
      <button class="big-btn" id="btn-act-again">再玩一次</button>
      <button class="ghost-btn" id="btn-continue">回書卷</button>`;
    $('#btn-act-again').onclick = again;
    $('#btn-continue').onclick = () => { renderTopbar(); openBook(book); };
    renderTopbar();
    show('#screen-result');
  }
  function loseAction(book, text, again) {
    endActionState();
    sndBad();
    $('#result-box').innerHTML = `
      <div class="r-emoji">${mascot().emoji}💭</div>
      <h2>差一點！</h2>
      <p>${text}</p>
      <button class="big-btn" id="btn-act-again">再挑戰</button>
      <button class="ghost-btn" id="btn-continue">回書卷</button>`;
    $('#btn-act-again').onclick = again;
    $('#btn-continue').onclick = () => { renderTopbar(); openBook(book); };
    renderTopbar();
    show('#screen-result');
  }

  // —— 🗿 大衛甩石：開場 1 題 → 快速連點蓄力 → 準星晃進額頭區的瞬間放手 ——
  ACTION_GAMES.david = function startDavid2() {
    const S = { phase: 'quiz', stones: 5, dist: 4, power: 0, marker: 0, dir: 1, zoneHalf: 0, raf: 0, easier: false };
    const area = startAction('🗿 大衛甩石', '1SA', () => cancelAnimationFrame(S.raf));
    action.state = S;
    const NEED = () => (S.easier ? 80 : 100);
    const q = MINIGAMES.david.manualQs[Math.floor(Math.random() * MINIGAMES.david.manualQs.length)];
    area.innerHTML = `
      <div class="q-title">${escapeHtml(q.q)}</div>
      <div class="choices" id="dv-quiz"></div>
      <p class="fr-tip">答對＝出手更沉穩（蓄力需求 -20%）；答錯也能玩，放心！</p>`;
    const box = $('#dv-quiz');
    const btns = [];
    for (const o of shuffleArr(q.options)) {
      const b = document.createElement('button');
      b.className = 'choice';
      b.textContent = o;
      b.onclick = () => {
        if (S.phase !== 'quiz') return;
        S.phase = 'quizdone';
        const ok = o === q.answer;
        b.classList.add(ok ? 'correct' : 'wrong');
        if (!ok) { const ri = btns.findIndex((x) => x.textContent === q.answer); if (ri >= 0) btns[ri].classList.add('correct'); }
        S.easier = ok;
        if (ok) sndGood(); else sndBad();
        setTimeout(renderThrow, ok ? 450 : 950);
      };
      btns.push(b);
      box.appendChild(b);
    }
    function renderThrow() {
      S.phase = 'charge'; S.power = 0;
      area.innerHTML = `
        <div class="dv-foe" id="dv-foe">⚔️</div>
        <div class="act-row"><span>逼近</span><div class="act-track"><div class="act-fill act-foe" id="dv-dist"></div></div><span>🪨×<b id="dv-stones">${S.stones}</b></span></div>
        <div class="act-row"><span>蓄力</span><div class="act-track"><div class="act-fill" id="dv-power"></div></div></div>
        <div class="dv-aim hidden" id="dv-aim"><div class="dv-zone" id="dv-zone"></div><div class="dv-marker" id="dv-marker"></div></div>
        <button class="big-btn act-tap" id="dv-btn">🌀 快速連點蓄力！</button>
        <p class="fr-tip" id="dv-hint">連點把甩石索轉起來——蓄滿後，看準時機放手！</p>`;
      updateFoe();
      $('#dv-btn').onclick = () => {
        if (S.phase === 'charge') {
          S.power = Math.min(NEED(), S.power + 9);
          if (S.power >= NEED()) startAim(); // 門檻判定不只靠動畫幀，點擊當下也檢查
        } else if (S.phase === 'aim') release();
      };
      loop();
    }
    function updateFoe() {
      $('#dv-foe').style.fontSize = `${2 + (4 - S.dist) * 0.8}rem`;
      $('#dv-dist').style.width = `${((4 - S.dist) / 4) * 100}%`;
      const st = $('#dv-stones'); if (st) st.textContent = S.stones;
    }
    function loop() {
      cancelAnimationFrame(S.raf);
      const step = () => {
        if (S.phase === 'charge') {
          S.power = Math.max(0, S.power - 0.45); // 不點就洩力，逼你快點
          const el = $('#dv-power'); if (el) el.style.width = `${(S.power / NEED()) * 100}%`;
          if (S.power >= NEED()) startAim();
        } else if (S.phase === 'aim') {
          S.marker += S.dir * (1.5 + S.dist * 0.4);
          if (S.marker >= 100) { S.marker = 100; S.dir = -1; }
          if (S.marker <= 0) { S.marker = 0; S.dir = 1; }
          const el = $('#dv-marker'); if (el) el.style.left = `${S.marker}%`;
        }
        S.raf = requestAnimationFrame(step);
      };
      S.raf = requestAnimationFrame(step);
    }
    function startAim() {
      S.phase = 'aim'; S.marker = 0; S.dir = 1;
      S.zoneHalf = 9 + (4 - S.dist) * 5; // 巨人越近、額頭目標越大（越好中）
      $('#dv-aim').classList.remove('hidden');
      const zone = $('#dv-zone');
      zone.style.left = `${50 - S.zoneHalf}%`;
      zone.style.width = `${S.zoneHalf * 2}%`;
      $('#dv-btn').textContent = '🎯 放手！';
      $('#dv-hint').textContent = '橘色準星掃進綠色「額頭區」的瞬間按下去！';
    }
    function release() {
      if (Math.abs(S.marker - 50) <= S.zoneHalf) {
        winAction('david', '1SA', { emoji: '🎯', title: '正中額頭！', text: '「你來攻擊我是靠著刀槍，我來攻擊你是靠著萬軍之耶和華的名。」——石子命中，巨人面伏於地！（撒上 17:45,49）' }, ACTION_GAMES.david);
        return;
      }
      S.stones--; S.dist--;
      sndBad();
      if (S.stones <= 0 || S.dist <= 0) {
        loseAction('1SA', S.stones <= 0 ? '五顆石子都甩完了——回溪邊再撿五顆光滑的石子，重新來過！' : '歌利亞衝到面前了！別怕，這場仗是屬耶和華的——再試一次！', ACTION_GAMES.david);
        return;
      }
      S.phase = 'charge'; S.power = 0;
      $('#dv-aim').classList.add('hidden');
      $('#dv-btn').textContent = '🌀 快速連點蓄力！';
      $('#dv-hint').textContent = '沒中！石子少一顆、巨人又近一步——再蓄力！';
      updateFoe();
    }
  };

  // —— 🎺 耶利哥七圈：手指繞城畫七個圈 → 大聲呼喊（麥克風音量；備援連點）——
  ACTION_GAMES.jericho = function startJericho2() {
    const S = { phase: 'circle', laps: 0, acc: 0, lastAng: null, raf: 0, stream: null, shout: 0, holdMs: 0 };
    const area = startAction('🎺 耶利哥七圈', 'JOS', () => {
      cancelAnimationFrame(S.raf);
      if (S.stream) S.stream.getTracks().forEach((t) => t.stop());
    });
    action.state = S;
    area.innerHTML = `
      <p class="act-hint">頭六日一天繞一圈、第七日繞七圈——現在，手指繞著城<b>畫七個圈</b>！</p>
      <div class="jr-stage" id="jr-stage"><div class="jr-city" id="jr-city">🏰</div><div class="jr-laps" id="jr-laps">0/7 圈</div></div>`;
    const stage = $('#jr-stage');
    const angOf = (e) => {
      const r = stage.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    };
    let drawing = false;
    stage.onpointerdown = (e) => { if (S.phase !== 'circle') return; drawing = true; S.lastAng = angOf(e); };
    stage.onpointerup = () => { drawing = false; };
    stage.onpointermove = (e) => {
      if (!drawing || S.phase !== 'circle') return;
      const a = angOf(e);
      let d = a - S.lastAng;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      S.lastAng = a;
      if (Math.abs(d) > 60) return; // 座標跳點忽略
      S.acc += Math.abs(d);
      if (S.acc >= 360) {
        S.acc -= 360;
        S.laps++;
        sndGood();
        $('#jr-laps').textContent = `${S.laps}/7 圈`;
        const c = $('#jr-city');
        c.classList.remove('jr-shake'); void c.offsetWidth; c.classList.add('jr-shake');
        if (S.laps >= 7) startShout();
      }
    };
    function startShout() {
      S.phase = 'shout';
      area.innerHTML = `
        <p class="act-hint">🎺 第七圈繞完，祭司吹角——<b>現在對著手機大聲呼喊！</b></p>
        <div class="jr-stage jr-small"><div class="jr-city">🏰</div></div>
        <div class="act-row"><span>🗣️ 呼喊</span><div class="act-track"><div class="act-fill" id="jr-vol"></div></div></div>
        <p class="fr-tip" id="jr-mic-hint">會先詢問麥克風權限；不方便出聲也可以改用連點。</p>
        <button class="ghost-btn" id="jr-tap-mode">🖐️ 改用連點呼喊</button>`;
      $('#jr-tap-mode').onclick = tapMode;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { tapMode(); return; }
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        if (S.phase !== 'shout') { stream.getTracks().forEach((t) => t.stop()); return; }
        S.stream = stream;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Uint8Array(an.fftSize);
        const TH = 0.11;   // 音量門檻（0~1）：對手機正常喊即可過，可調
        const HOLD = 700;  // 需持續的毫秒數
        let last = performance.now();
        const step = (now) => {
          if (S.phase !== 'shout') return;
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
          const rms = Math.sqrt(sum / buf.length);
          if (rms >= TH) S.holdMs += now - last; else S.holdMs = Math.max(0, S.holdMs - (now - last) * 0.6);
          last = now;
          const el = $('#jr-vol');
          if (el) el.style.width = `${Math.min(100, (Math.min(rms, TH) / TH) * 55 + (S.holdMs / HOLD) * 45)}%`;
          if (S.holdMs >= HOLD) { collapse(); return; }
          S.raf = requestAnimationFrame(step);
        };
        S.raf = requestAnimationFrame(step);
      }).catch(() => {
        const h = $('#jr-mic-hint');
        if (h) h.textContent = '沒拿到麥克風權限——沒關係，改用連點呼喊！';
        tapMode();
      });
    }
    function tapMode() {
      if (S.phase !== 'shout') return;
      S.phase = 'tap';
      S.shout = 0;
      cancelAnimationFrame(S.raf);
      if (S.stream) { S.stream.getTracks().forEach((t) => t.stop()); S.stream = null; }
      area.innerHTML = `
        <p class="act-hint">🗣️ <b>快速連點，同心大聲呼喊！</b></p>
        <div class="act-row"><span>呼喊聲</span><div class="act-track"><div class="act-fill" id="jr-vol"></div></div></div>
        <button class="big-btn act-tap" id="jr-shout-btn">🗣️ 呼喊！呼喊！</button>`;
      $('#jr-shout-btn').onclick = () => {
        if (S.phase !== 'tap') return;
        S.shout = Math.min(100, S.shout + 8);
        if (S.shout >= 100) collapse();
      };
      const step = () => {
        if (S.phase !== 'tap') return;
        S.shout = Math.max(0, S.shout - 0.5);
        const el = $('#jr-vol'); if (el) el.style.width = `${S.shout}%`;
        S.raf = requestAnimationFrame(step);
      };
      S.raf = requestAnimationFrame(step);
    }
    function collapse() {
      S.phase = 'done';
      winAction('jericho', 'JOS', { emoji: '🧱', title: '城牆應聲塌陷！', text: '百姓呼喊、祭司吹角，城牆就塌陷，各人往前直上，將城奪取！（書 6:20）不是靠刀劍——是靠信心與順服。' }, ACTION_GAMES.jericho);
    }
  };

  // —— 🍞 掰餅接籃：拖籃子接住掉落的餅魚，餵飽五千（石頭別接！）——
  ACTION_GAMES.loaves = function startLoaves2() {
    const GOAL = 5000, DUSK_MS = 75000; // 天黑前餵飽五千
    const S = { phase: 'play', fed: 0, dusk: 0, basketX: 50, items: [], spawnMs: 0, raf: 0 };
    const area = startAction('🍞 掰餅接籃', 'JHN', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>🍽️ 餵飽</span><div class="act-track"><div class="act-fill" id="lv-fed"></div></div><b id="lv-count">0</b></div>
      <div class="act-row"><span>🌆 天色</span><div class="act-track"><div class="act-fill act-foe" id="lv-dusk"></div></div></div>
      <div class="lv-stage" id="lv-stage">
        <div class="lv-hands">🙏🍞</div>
        <div class="lv-basket" id="lv-basket">🧺</div>
      </div>
      <p class="fr-tip">左右拖動接住 🍞🥖🐟 分給群眾；🪨 石頭不能吃，別接！</p>`;
    const stage = $('#lv-stage');
    const moveBasket = (e) => {
      const r = stage.getBoundingClientRect();
      S.basketX = Math.max(6, Math.min(94, ((e.clientX - r.left) / r.width) * 100));
      $('#lv-basket').style.left = `${S.basketX}%`;
    };
    stage.onpointerdown = moveBasket;
    stage.onpointermove = (e) => { if (e.buttons || e.pressure > 0) moveBasket(e); };
    const KINDS = [
      { emoji: '🍞', feed: 250, w: 3 }, { emoji: '🥖', feed: 250, w: 2 },
      { emoji: '🐟', feed: 400, w: 2 }, { emoji: '🪨', feed: -300, w: 2 },
    ];
    function spawn() {
      const pool = [];
      for (const k of KINDS) for (let i = 0; i < k.w; i++) pool.push(k);
      const k = pool[Math.floor(Math.random() * pool.length)];
      const el = document.createElement('div');
      el.className = 'lv-item';
      el.textContent = k.emoji;
      stage.appendChild(el);
      S.items.push({ k, el, x: 8 + Math.random() * 84, y: 8 });
    }
    S.tick = (dt) => { // 遊戲迴圈本體：rAF 驅動；測試可手動逐格推進
      if (S.phase !== 'play') return;
      S.dusk += dt;
      S.spawnMs += dt;
      if (S.spawnMs >= 850) { S.spawnMs = 0; spawn(); }
      for (let i = S.items.length - 1; i >= 0; i--) {
        const it = S.items[i];
        it.y += dt * 0.045; // 掉落速度（%/ms）
        it.el.style.left = `${it.x}%`;
        it.el.style.top = `${it.y}%`;
        if (it.y >= 82) { // 到籃子高度：判定接到沒
          if (Math.abs(it.x - S.basketX) <= 11) {
            S.fed = Math.max(0, S.fed + it.k.feed);
            if (it.k.feed > 0) sndGood(); else { sndBad(); stage.classList.remove('jr-shake'); void stage.offsetWidth; stage.classList.add('jr-shake'); }
          }
          it.el.remove();
          S.items.splice(i, 1);
        }
      }
      $('#lv-fed').style.width = `${Math.min(100, (S.fed / GOAL) * 100)}%`;
      $('#lv-count').textContent = S.fed;
      $('#lv-dusk').style.width = `${Math.min(100, (S.dusk / DUSK_MS) * 100)}%`;
      if (S.fed >= GOAL) {
        S.phase = 'done';
        winAction('loaves', 'JHN', { emoji: '🧺', title: '五千人都吃飽了！', text: '一個孩童的五個大麥餅、兩條魚，經耶穌祝謝擘開——眾人都吃飽了，剩下的零碎還裝滿十二個籃子！（約 6:11-13）' }, ACTION_GAMES.loaves);
        return;
      }
      if (S.dusk >= DUSK_MS) {
        S.phase = 'done';
        loseAction('JHN', `天色暗了，還差 ${GOAL - S.fed} 人沒吃飽——別忘了，在耶穌手中五個餅也夠用，再試一次！`, ACTION_GAMES.loaves);
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last)); // 單幀上限 50ms，切回前景不會瞬間跳關
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— ⛵ 穩住船身：按左/右舷平衡船身撐過風浪 → 呼求耶穌，瞬間平靜 ——
  ACTION_GAMES.storm = function startStorm2() {
    const SURVIVE_MS = 30000, CAPSIZE = 45; // 撐 30 秒；傾斜超過 45° 翻船
    const S = { phase: 'play', t: 0, angle: 0, vel: 0, wind: 0, windMs: 0, input: 0, raf: 0 };
    const area = startAction('⛵ 穩住船身', 'MRK', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>⏱️ 撐住</span><div class="act-track"><div class="act-fill" id="st-time"></div></div></div>
      <div class="st-stage"><div class="st-sea">🌊🌊🌊</div><div class="st-boat" id="st-boat">⛵</div><div class="st-wind" id="st-wind"></div></div>
      <div class="st-btns">
        <button class="big-btn act-tap" id="st-left">◀️ 壓左舷</button>
        <button class="big-btn act-tap" id="st-right">壓右舷 ▶️</button>
      </div>
      <p class="fr-tip">風把船吹向哪邊，就按住另一邊壓回來，別讓船翻了！</p>`;
    const hold = (id, val) => {
      const b = $(id);
      b.onpointerdown = (e) => { e.preventDefault(); S.input = val; };
      b.onpointerup = () => { if (S.input === val) S.input = 0; };
      b.onpointerleave = () => { if (S.input === val) S.input = 0; };
    };
    hold('#st-left', -1);
    hold('#st-right', 1);
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      S.t += dt;
      S.windMs -= dt;
      if (S.windMs <= 0) { // 風向每 1~2 秒變一次，越晚越猛
        S.windMs = 1000 + Math.random() * 1000;
        const force = 12 + (S.t / SURVIVE_MS) * 22; // 風力上限 34 < 玩家的 48，壓得回來；但放著不管必翻
        S.wind = (Math.random() < 0.5 ? -1 : 1) * force;
        $('#st-wind').textContent = S.wind < 0 ? '💨⬅️' : '➡️💨';
      }
      const f = dt / 16.7; // 換算成「幀當量」，物理不受幀率/節流影響
      S.vel += (S.wind + S.input * 48) * 0.0167 * f;
      S.vel -= S.angle * 0.006 * f;        // 微量自扶正力（緩衝用，擋不住中後期的風）
      S.vel *= Math.pow(0.97, f);          // 阻尼（依時間縮放）
      S.vel = Math.max(-30, Math.min(30, S.vel));
      S.angle += S.vel * 0.0667 * f;
      $('#st-boat').style.transform = `rotate(${S.angle}deg)`;
      $('#st-time').style.width = `${Math.min(100, (S.t / SURVIVE_MS) * 100)}%`;
      if (Math.abs(S.angle) >= CAPSIZE) {
        S.phase = 'done';
        loseAction('MRK', '船翻了！別怕——「為甚麼膽怯？你們還沒有信心嗎？」耶穌就在船上，再撐一次！', ACTION_GAMES.storm);
        return;
      }
      if (S.t >= SURVIVE_MS) {
        S.phase = 'call';
        $('#st-wind').textContent = '🌊🌊🌊';
        const btns = $('#action-area').querySelector('.st-btns');
        btns.innerHTML = `<button class="big-btn" id="st-call">🙏 呼求耶穌！</button>`;
        $('#st-call').onclick = () => {
          S.phase = 'done';
          winAction('storm', 'MRK', { emoji: '🌅', title: '住了吧！靜了吧！', text: '你拼命撐住了整場風浪——但真正平靜風浪的，是耶穌的一句話。「風就止住，大大地平靜了。」（可 4:39）連風和海也聽從祂！' }, ACTION_GAMES.storm);
        };
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🌊 分海快走：先撥開海水，再左右交替點腳印快走過乾地（法老追兵在後）——
  ACTION_GAMES.redsea = function startRedsea2() {
    const CHASE_MS = 30000; // 追兵抵達的時間
    const S = { phase: 'part', partPx: 0, lastX: null, run: 0, next: 'L', chase: 0, raf: 0 };
    const area = startAction('🌊 分海快走', 'EXO', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <p class="act-hint">摩西向海伸杖——<b>左右來回撥動海水</b>，把海分開！</p>
      <div class="rs-stage" id="rs-stage"><span class="rs-sea" id="rs-left">🌊🌊</span><span id="rs-staff">🪄</span><span class="rs-sea" id="rs-right">🌊🌊</span></div>
      <div class="act-row"><span>分開</span><div class="act-track"><div class="act-fill" id="rs-part"></div></div></div>`;
    const stage = $('#rs-stage');
    stage.onpointerdown = (e) => { if (S.phase === 'part') S.lastX = e.clientX; };
    stage.onpointerup = () => { S.lastX = null; };
    stage.onpointermove = (e) => {
      if (S.phase !== 'part' || S.lastX === null) return;
      S.partPx += Math.min(40, Math.abs(e.clientX - S.lastX)); // 單次位移上限，防跳點
      S.lastX = e.clientX;
      const pct = Math.min(100, (S.partPx / 420) * 100);
      $('#rs-part').style.width = `${pct}%`;
      $('#rs-left').style.transform = `translateX(-${pct * 0.5}px)`;
      $('#rs-right').style.transform = `translateX(${pct * 0.5}px)`;
      if (S.partPx >= 420) startRun();
    };
    function startRun() {
      S.phase = 'run';
      area.innerHTML = `
        <p class="act-hint">海分開了！<b>左右交替踏步</b>，趕快走過乾地——追兵來了！</p>
        <div class="act-row"><span>🏇 追兵</span><div class="act-track"><div class="act-fill act-foe" id="rs-chase"></div></div></div>
        <div class="act-row"><span>🚶 過海</span><div class="act-track"><div class="act-fill" id="rs-run"></div></div></div>
        <div class="st-btns">
          <button class="big-btn act-tap" id="rs-l">👣 左腳</button>
          <button class="big-btn act-tap" id="rs-r">右腳 👣</button>
        </div>
        <p class="fr-tip" id="rs-hint">要「左、右、左、右」輪流點，同一隻腳連點是走不動的！</p>`;
      const stepBtn = (side) => {
        if (S.phase !== 'run') return;
        if (S.next !== side) { $('#rs-hint').textContent = '同一隻腳連點走不動——換另一隻腳！'; return; }
        S.next = side === 'L' ? 'R' : 'L';
        S.run = Math.min(100, S.run + 2.5);
        $('#rs-run').style.width = `${S.run}%`;
        if (S.run >= 100) {
          S.phase = 'done';
          winAction('redsea', 'EXO', { emoji: '🌊', title: '走過乾地，追兵全沒！', text: '以色列人下海中走乾地，水在左右作了牆垣；水一回流，法老的全軍連一個也沒有剩下！（出 14:22,28）' }, ACTION_GAMES.redsea);
        }
      };
      $('#rs-l').onclick = () => stepBtn('L');
      $('#rs-r').onclick = () => stepBtn('R');
      loop();
    }
    S.tick = (dt) => {
      if (S.phase !== 'run') return;
      S.chase += dt;
      const el = $('#rs-chase'); if (el) el.style.width = `${Math.min(100, (S.chase / CHASE_MS) * 100)}%`;
      if (S.chase >= CHASE_MS) {
        S.phase = 'done';
        loseAction('EXO', '被法老的車輛馬兵追上了！「不要懼怕，只管站住——耶和華必為你們爭戰。」再走一次！', ACTION_GAMES.redsea);
      }
    };
    function loop() {
      let last = performance.now();
      const step = (now) => {
        if (!action || action.state !== S) return;
        S.tick(Math.min(50, now - last));
        last = now;
        if (S.phase === 'run') S.raf = requestAnimationFrame(step);
      };
      S.raf = requestAnimationFrame(step);
    }
  };

  // —— 🚶 躡腳出監：守衛打瞌睡才能長按前進，醒著就要放手（紅綠燈潛行）——
  ACTION_GAMES.peter_prison = function startPeter2() {
    const DAWN_MS = 90000; // 天亮倒數
    const CHECKPOINTS = [0, 34, 67]; // 第一層、第二層、臨街鐵門
    const S = { phase: 'play', prog: 0, guard: 'sleep', guardMs: 2200, hold: false, dawn: 0, caught: 0, raf: 0 };
    const area = startAction('🚶 躡腳出監', 'ACT', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <p class="act-hint">天使拍醒彼得，鐵鍊脫落——<b>守衛打瞌睡時長按前進</b>，睜眼前快放手！</p>
      <div class="pp-guard"><span id="pp-guard-emoji">😴</span><span id="pp-guard-text">守衛睡著了…</span></div>
      <div class="act-row"><span>🌅 天亮</span><div class="act-track"><div class="act-fill act-foe" id="pp-dawn"></div></div></div>
      <div class="act-row"><span>🚶 逃出</span><div class="act-track"><div class="act-fill" id="pp-prog"></div></div></div>
      <p class="fr-tip" id="pp-stage-text">第一層監牢…</p>
      <button class="big-btn act-tap" id="pp-btn">🤫 長按躡腳前進</button>`;
    const btn = $('#pp-btn');
    btn.onpointerdown = (e) => { e.preventDefault(); S.hold = true; };
    btn.onpointerup = () => { S.hold = false; };
    btn.onpointerleave = () => { S.hold = false; };
    const stageText = () => (S.prog < 34 ? '第一層監牢…' : S.prog < 67 ? '第二層監牢…' : '快到臨街的鐵門了！');
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      S.dawn += dt;
      S.guardMs -= dt;
      if (S.guardMs <= 0) { // 守衛狀態機：睡 → 快醒（預告）→ 醒 → 睡
        if (S.guard === 'sleep') { S.guard = 'warn'; S.guardMs = 700; $('#pp-guard-emoji').textContent = '🥱'; $('#pp-guard-text').textContent = '守衛動了一下！'; }
        else if (S.guard === 'warn') { S.guard = 'awake'; S.guardMs = 900 + Math.random() * 900; $('#pp-guard-emoji').textContent = '👁️'; $('#pp-guard-text').textContent = '守衛醒著——別動！'; }
        else { S.guard = 'sleep'; S.guardMs = 1500 + Math.random() * 1500; $('#pp-guard-emoji').textContent = '😴'; $('#pp-guard-text').textContent = '守衛睡著了…'; }
      }
      if (S.hold) {
        if (S.guard === 'awake') { // 被發現：退回上一個檢查點
          S.caught++;
          sndBad();
          S.prog = [...CHECKPOINTS].reverse().find((c) => c <= S.prog) || 0;
          S.hold = false;
          $('#pp-guard-text').textContent = '被看到了！退回上個檢查點，禱告再來…';
        } else {
          S.prog = Math.min(100, S.prog + dt * 0.012);
        }
      }
      $('#pp-prog').style.width = `${S.prog}%`;
      $('#pp-dawn').style.width = `${Math.min(100, (S.dawn / DAWN_MS) * 100)}%`;
      $('#pp-stage-text').textContent = stageText();
      if (S.prog >= 100) {
        S.phase = 'done';
        winAction('peter_prison', 'ACT', { emoji: '🔓', title: '鐵門自己開了！', text: '過了第一層第二層監牢，臨街的鐵門自己開了——彼得出來，才知道不是異象：主真的差天使救他脫離希律的手！（徒 12:10-11）教會的禱告，神都聽見了。' }, ACTION_GAMES.peter_prison);
        return;
      }
      if (S.dawn >= DAWN_MS) {
        S.phase = 'done';
        loseAction('ACT', '天亮了，還沒走出監牢——別灰心，教會還在為你切切禱告，再來一次！', ACTION_GAMES.peter_prison);
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🔥 堅立不拜：長按「站立」堅持到底，抗住各種要你鬆手的干擾 ——
  ACTION_GAMES.furnace = function startFurnace2() {
    const STAND_MS = 20000; // 需累計站立 20 秒
    const TAUNTS = ['📯 樂聲響起——所有人都拜下去了…', '你也放手跟著拜吧？', '🔥 王下令：窯要燒熱七倍！', '「即或不然……」', '再撐一下，快天亮了！'];
    const S = { phase: 'play', stand: 0, kneel: 0, hold: false, tauntMs: 2600, ti: 0, raf: 0 };
    const area = startAction('🔥 堅立不拜', 'DAN', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <p class="act-hint">金像立起、樂聲響起——<b>長按「站立」，手不放、膝不彎！</b></p>
      <div class="fn-crowd" id="fn-crowd">🧍🧍🧍🧍🧍🧍</div>
      <p class="act-hint fn-taunt" id="fn-taunt">📯 樂聲響起…</p>
      <div class="act-row"><span>🧎 下拜</span><div class="act-track"><div class="act-fill act-foe" id="fn-kneel"></div></div></div>
      <div class="act-row"><span>🧍 堅立</span><div class="act-track"><div class="act-fill" id="fn-stand"></div></div></div>
      <button class="big-btn act-tap" id="fn-btn">🧍 按住不放＝堅立不拜</button>`;
    const btn = $('#fn-btn');
    btn.onpointerdown = (e) => { e.preventDefault(); S.hold = true; };
    btn.onpointerup = () => { S.hold = false; };
    btn.onpointerleave = () => { S.hold = false; };
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      S.tauntMs -= dt;
      if (S.tauntMs <= 0) { // 干擾輪播：換嘲諷詞＋群眾逐排拜下＋畫面搖一下
        S.tauntMs = 2200 + Math.random() * 1200;
        S.ti++;
        $('#fn-taunt').textContent = TAUNTS[S.ti % TAUNTS.length];
        const bowed = Math.min(6, Math.floor((S.stand / STAND_MS) * 7));
        $('#fn-crowd').textContent = '🙇'.repeat(bowed) + '🧍'.repeat(6 - bowed);
        const a = $('#action-area');
        a.classList.remove('jr-shake'); void a.offsetWidth; a.classList.add('jr-shake');
      }
      if (S.hold) {
        S.stand += dt;
        S.kneel = Math.max(0, S.kneel - dt * 0.4);
      } else {
        S.kneel += dt; // 放手就開始往下跪，約 4 秒跪滿
      }
      $('#fn-stand').style.width = `${Math.min(100, (S.stand / STAND_MS) * 100)}%`;
      $('#fn-kneel').style.width = `${Math.min(100, (S.kneel / 4000) * 100)}%`;
      if (S.stand >= STAND_MS) {
        S.phase = 'done';
        winAction('furnace', 'DAN', { emoji: '🔥', title: '火中有第四個人！', text: '他們被扔進烈火的窯——王卻看見四個人在火中遊行，毫無傷損，第四個的相貌好像神子！頭髮沒燒焦、衣裳沒變色、連火燎的氣味也沒有。（但 3:25,27）' }, ACTION_GAMES.furnace);
        return;
      }
      if (S.kneel >= 4000) {
        S.phase = 'done';
        loseAction('DAN', '手一鬆，膝蓋就彎了——「即或不然，我們也決不事奉你的神像。」深呼吸，再堅立一次！', ACTION_GAMES.furnace);
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🍇 結出聖靈果：指針擺盪，在「甘霖區」的瞬間點擊澆灌，結出九樣果子 ——
  ACTION_GAMES.fruit_spirit = function startFruit() {
    const FRUITS = ['仁愛', '喜樂', '和平', '忍耐', '恩慈', '良善', '信實', '溫柔', '節制']; // 加 5:22-23
    const S = { phase: 'play', got: 0, thorns: 0, marker: 0, dir: 1, raf: 0 };
    const area = startAction('🍇 結出聖靈果', 'GAL', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <p class="act-hint">指針掃進藍色「甘霖區」的瞬間按下 💧——澆灌得時，果子就一樣一樣結出來！</p>
      <div class="fg-tree" id="fg-tree">🌳</div>
      <div class="fg-fruits" id="fg-fruits">${FRUITS.map((f) => `<span class="fg-fruit" data-f="${f}">🔒<small>${f}</small></span>`).join('')}</div>
      <div class="act-row"><span>🥀 荊棘</span><div class="act-track"><div class="act-fill act-foe" id="fg-thorn"></div></div></div>
      <div class="dv-aim"><div class="dv-zone fg-zone" id="fg-zone"></div><div class="dv-marker" id="fg-marker"></div></div>
      <button class="big-btn act-tap" id="fg-btn">💧 澆灌！</button>`;
    const zoneHalf = () => 13 - S.got * 0.7; // 越後面的果子，甘霖區越窄
    const placeZone = () => {
      const z = $('#fg-zone');
      z.style.left = `${50 - zoneHalf()}%`;
      z.style.width = `${zoneHalf() * 2}%`;
    };
    placeZone();
    $('#fg-btn').onclick = () => {
      if (S.phase !== 'play') return;
      if (Math.abs(S.marker - 50) <= zoneHalf()) {
        const el = document.querySelectorAll('#fg-fruits .fg-fruit')[S.got];
        el.innerHTML = `🍇<small>${el.dataset.f}</small>`;
        el.classList.add('fg-got');
        S.got++;
        sndGood();
        $('#fg-tree').textContent = S.got >= 6 ? '🌳🍇' : '🌳';
        if (S.got >= FRUITS.length) {
          S.phase = 'done';
          winAction('fruit_spirit', 'GAL', MINIGAMES.fruit_spirit.win, ACTION_GAMES.fruit_spirit);
          return;
        }
        placeZone();
      } else {
        S.thorns++;
        sndBad();
        $('#fg-thorn').style.width = `${(S.thorns / 3) * 100}%`;
        if (S.thorns >= 3) {
          S.phase = 'done';
          loseAction('GAL', MINIGAMES.fruit_spirit.lose.text, ACTION_GAMES.fruit_spirit);
        }
      }
    };
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      const f = dt / 16.7;
      S.marker += S.dir * (1.7 + S.got * 0.22) * f; // 每結一樣果子，指針就快一點
      if (S.marker >= 100) { S.marker = 100; S.dir = -1; }
      if (S.marker <= 0) { S.marker = 0; S.dir = 1; }
      const el = $('#fg-marker'); if (el) el.style.left = `${S.marker}%`;
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🦊 擒拿小狐狸：葡萄園打地鼠——狐狸冒頭就點，牠咬到葡萄前擒住牠 ——
  ACTION_GAMES.foxes = function startFoxes() {
    const GOAL = 10, GRAPES = 5;
    const S = { phase: 'play', caught: 0, grapes: GRAPES, spawnMs: 900, cells: [], raf: 0 };
    const area = startAction('🦊 擒拿小狐狸', 'SNG', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>🧺 擒住</span><div class="act-track"><div class="act-fill" id="fx-bar"></div></div><b id="fx-count">0/${GOAL}</b></div>
      <div class="act-row"><span>🍇 葡萄</span><b id="fx-grapes">${'🍇'.repeat(GRAPES)}</b></div>
      <div class="fx-grid" id="fx-grid">${Array.from({ length: 9 }, (_, i) => `<button class="fx-cell act-tap" data-i="${i}">🌿</button>`).join('')}</div>
      <p class="fr-tip">狐狸 🦊 從葡萄叢冒出來就趕快點！放著不管，牠會咬走一串葡萄。</p>`;
    const cells = [...document.querySelectorAll('.fx-cell')];
    S.cells = cells.map(() => null); // 每格：null 或 { ttl }
    cells.forEach((c, i) => {
      c.onclick = () => {
        if (S.phase !== 'play' || !S.cells[i]) return;
        S.cells[i] = null;
        c.textContent = '💥';
        setTimeout(() => { if (c.textContent === '💥') c.textContent = '🌿'; }, 260);
        S.caught++;
        sndGood();
        $('#fx-count').textContent = `${S.caught}/${GOAL}`;
        $('#fx-bar').style.width = `${(S.caught / GOAL) * 100}%`;
        if (S.caught >= GOAL) {
          S.phase = 'done';
          winAction('foxes', 'SNG', MINIGAMES.foxes.win, ACTION_GAMES.foxes);
        }
      };
    });
    let sinceSpawn = 0;
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      sinceSpawn += dt;
      const interval = Math.max(560, 900 - S.caught * 35); // 抓越多、狐狸冒得越快
      if (sinceSpawn >= interval) {
        sinceSpawn = 0;
        const empty = S.cells.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
        if (empty.length) {
          const i = empty[Math.floor(Math.random() * empty.length)];
          S.cells[i] = { ttl: Math.max(750, 1350 - S.caught * 60) }; // 越後面探頭越短
          cells[i].textContent = '🦊';
        }
      }
      for (let i = 0; i < S.cells.length; i++) {
        const v = S.cells[i];
        if (!v) continue;
        v.ttl -= dt;
        if (v.ttl <= 0) { // 沒抓到：狐狸咬走一串葡萄
          S.cells[i] = null;
          cells[i].textContent = '🌿';
          S.grapes--;
          sndBad();
          $('#fx-grapes').textContent = '🍇'.repeat(Math.max(0, S.grapes)) || '…';
          if (S.grapes <= 0) {
            S.phase = 'done';
            loseAction('SNG', MINIGAMES.foxes.lose.text, ACTION_GAMES.foxes);
            return;
          }
        }
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🦅 如鷹展翅：點擊振翅上騰，穿過疲乏烏雲之間的氣流缺口，飛越 8 程 ——
  ACTION_GAMES.eagle = function startEagle() {
    const GOAL = 8, EAGLE_X = 22; // 老鷹固定在畫面 22% 位置
    const S = { phase: 'ready', y: 50, vel: 0, passed: 0, clouds: [], spawnX: 0, raf: 0 };
    const area = startAction('🦅 如鷹展翅', 'ISA', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>🦅 上騰</span><div class="act-track"><div class="act-fill" id="eg-bar"></div></div><b id="eg-count">0/${GOAL}</b></div>
      <div class="eg-stage act-tap" id="eg-stage">
        <div class="eg-eagle" id="eg-eagle">🦅</div>
        <div class="eg-msg" id="eg-msg">點一下開始！</div>
      </div>
      <p class="fr-tip">點畫面振翅往上、放著會下滑——從疲乏烏雲 ☁️ 之間的氣流缺口穿過去！</p>`;
    const stage = $('#eg-stage');
    stage.onpointerdown = (e) => {
      e.preventDefault();
      if (S.phase === 'ready') { S.phase = 'play'; S.spawnX = 40; $('#eg-msg').textContent = ''; run(); }
      if (S.phase !== 'play') return;
      S.vel = -1.6; // 振翅：向上一撲（一撲約升 15% 高——比雲縫容差小，逼近時輕點就能穿過）
    };
    function makeCloud() {
      const gapTop = 16 + Math.random() * 40; // 缺口上緣 16~56%
      const gapH = 38; // 缺口高度（好飛）
      const top = document.createElement('div');
      top.className = 'eg-cloud';
      top.style.top = '0';
      top.style.height = `${gapTop}%`;
      const bot = document.createElement('div');
      bot.className = 'eg-cloud';
      bot.style.top = `${gapTop + gapH}%`;
      bot.style.height = `${100 - gapTop - gapH}%`;
      stage.append(top, bot);
      S.clouds.push({ x: 104, gapTop, gapH, top, bot, passed: false });
    }
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      const f = dt / 16.7;
      S.vel = Math.min(2.8, S.vel + 0.085 * f); // 重力（疲乏往下拉）
      S.y += S.vel * f;
      if (S.y <= 2) { S.y = 2; S.vel = 0; }
      S.spawnX -= 0.62 * f;
      if (S.spawnX <= 0) { S.spawnX = 56; makeCloud(); } // 每 56% 距離一組烏雲
      for (let i = S.clouds.length - 1; i >= 0; i--) {
        const c = S.clouds[i];
        c.x -= 0.62 * f;
        c.top.style.left = `${c.x}%`;
        c.bot.style.left = `${c.x}%`;
        if (!c.passed && c.x + 12 < EAGLE_X - 5) { // 整朵雲完全離開老鷹身位才算通過
          c.passed = true;
          S.passed++;
          sndGood();
          $('#eg-count').textContent = `${S.passed}/${GOAL}`;
          $('#eg-bar').style.width = `${(S.passed / GOAL) * 100}%`;
          if (S.passed >= GOAL) {
            S.phase = 'done';
            winAction('eagle', 'ISA', MINIGAMES.eagle.win, ACTION_GAMES.eagle);
            return;
          }
        }
        const hitX = !c.passed && c.x < EAGLE_X + 5 && c.x + 12 > EAGLE_X - 5;
        if (hitX && (S.y < c.gapTop + 3 || S.y > c.gapTop + c.gapH - 3)) {
          S.phase = 'done';
          loseAction('ISA', MINIGAMES.eagle.lose.text, ACTION_GAMES.eagle);
          return;
        }
        if (c.x < -14) { c.top.remove(); c.bot.remove(); S.clouds.splice(i, 1); }
      }
      if (S.y >= 98) {
        S.phase = 'done';
        loseAction('ISA', MINIGAMES.eagle.lose.text, ACTION_GAMES.eagle);
        return;
      }
      $('#eg-eagle').style.top = `${S.y}%`;
    };
    function run() {
      let last = performance.now();
      const step = (now) => {
        if (!action || action.state !== S) return;
        S.tick(Math.min(50, now - last));
        last = now;
        if (S.phase === 'play') S.raf = requestAnimationFrame(step);
      };
      S.raf = requestAnimationFrame(step);
    }
  };

  // —— 🐑 牧人的杖：三條路，幽谷石牆一排排逼近，左右移動跟上牧人開的路 ——
  ACTION_GAMES.psalm_shepherd = function startShepherd() {
    const GOAL = 10;
    const S = { phase: 'play', lane: 1, passed: 0, stumbles: 0, gates: [], sinceGate: 1200, raf: 0 };
    const area = startAction('🐑 牧人的杖', 'PSA', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>🐑 走過</span><div class="act-track"><div class="act-fill" id="ps-bar"></div></div><b id="ps-count">0/${GOAL}</b></div>
      <div class="act-row"><span>💚 平安</span><b id="ps-hearts">💚💚💚</b></div>
      <div class="ps-stage" id="ps-stage"><div class="ps-shepherd">🧑‍🌾</div><div class="ps-lamb" id="ps-lamb">🐑</div></div>
      <div class="st-btns">
        <button class="big-btn act-tap" id="ps-left">◀️ 往左</button>
        <button class="big-btn act-tap" id="ps-right">往右 ▶️</button>
      </div>
      <p class="fr-tip">幽谷的石牆一排排過來——看好缺口在哪條路，把小羊移過去跟上牧人！</p>`;
    const stage = $('#ps-stage');
    const laneX = (l) => 16.5 + l * 33.5;
    const setLane = (d) => {
      if (S.phase !== 'play') return;
      S.lane = Math.max(0, Math.min(2, S.lane + d));
      $('#ps-lamb').style.left = `${laneX(S.lane)}%`;
    };
    $('#ps-left').onclick = () => setLane(-1);
    $('#ps-right').onclick = () => setLane(1);
    $('#ps-lamb').style.left = `${laneX(1)}%`;
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      const f = dt / 16.7;
      S.sinceGate += dt;
      const interval = Math.max(1300, 2100 - S.passed * 80);
      if (S.sinceGate >= interval) {
        S.sinceGate = 0;
        const open = Math.floor(Math.random() * 3);
        const el = document.createElement('div');
        el.className = 'ps-gate';
        el.innerHTML = [0, 1, 2].map((l) => `<span>${l === open ? '' : '🪨'}</span>`).join('');
        stage.appendChild(el);
        S.gates.push({ open, y: -8, el, judged: false });
      }
      for (let i = S.gates.length - 1; i >= 0; i--) {
        const g = S.gates[i];
        g.y += (0.55 + S.passed * 0.03) * f;
        g.el.style.top = `${g.y}%`;
        if (!g.judged && g.y >= 78) { // 到小羊那一排：判定
          g.judged = true;
          if (S.lane === g.open) {
            S.passed++;
            sndGood();
            $('#ps-count').textContent = `${S.passed}/${GOAL}`;
            $('#ps-bar').style.width = `${(S.passed / GOAL) * 100}%`;
            if (S.passed >= GOAL) {
              S.phase = 'done';
              winAction('psalm_shepherd', 'PSA', MINIGAMES.psalm_shepherd.win, ACTION_GAMES.psalm_shepherd);
              return;
            }
          } else {
            S.stumbles++;
            sndBad();
            stage.classList.remove('jr-shake'); void stage.offsetWidth; stage.classList.add('jr-shake');
            $('#ps-hearts').textContent = '💚'.repeat(Math.max(0, 3 - S.stumbles)) || '…';
            if (S.stumbles >= 3) {
              S.phase = 'done';
              loseAction('PSA', MINIGAMES.psalm_shepherd.lose.text, ACTION_GAMES.psalm_shepherd);
              return;
            }
          }
        }
        if (g.y > 104) { g.el.remove(); S.gates.splice(i, 1); }
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🏛️ 智慧建屋：柱子左右滑動，時機點擊對齊疊上去，鑿成七根柱子 ——
  ACTION_GAMES.wisdom_house = function startWisdom() {
    const GOAL = 7;
    const S = { phase: 'play', placed: 0, misses: 0, x: 10, dir: 1, stackX: 50, raf: 0 };
    const area = startAction('🏛️ 智慧建屋', 'PRO', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>🏛️ 柱子</span><div class="act-track"><div class="act-fill" id="wh-bar"></div></div><b id="wh-count">0/${GOAL}</b></div>
      <div class="wh-stage" id="wh-stage"><div class="wh-mover" id="wh-mover">🏛️</div><div class="wh-base" id="wh-base">🧱🧱🧱</div></div>
      <button class="big-btn act-tap" id="wh-btn">⬇️ 放下柱子！</button>
      <p class="fr-tip">柱子左右滑動——對準下面的地基再放！歪兩次，房子就塌了。（箴 9:1）</p>`;
    const tol = () => 13 - S.placed * 0.9; // 越高越要準
    $('#wh-btn').onclick = () => {
      if (S.phase !== 'play') return;
      if (Math.abs(S.x - S.stackX) <= tol()) {
        S.stackX = S.x;
        S.placed++;
        sndGood();
        const p = document.createElement('div');
        p.className = 'wh-pillar';
        p.textContent = '🏛️';
        p.style.left = `${S.x}%`;
        p.style.bottom = `${26 + (S.placed - 1) * 34}px`;
        $('#wh-stage').appendChild(p);
        $('#wh-count').textContent = `${S.placed}/${GOAL}`;
        $('#wh-bar').style.width = `${(S.placed / GOAL) * 100}%`;
        if (S.placed >= GOAL) {
          S.phase = 'done';
          winAction('wisdom_house', 'PRO', MINIGAMES.wisdom_house.win, ACTION_GAMES.wisdom_house);
        }
      } else {
        S.misses++;
        sndBad();
        const st = $('#wh-stage');
        st.classList.remove('jr-shake'); void st.offsetWidth; st.classList.add('jr-shake');
        if (S.misses >= 2) {
          S.phase = 'done';
          loseAction('PRO', MINIGAMES.wisdom_house.lose.text, ACTION_GAMES.wisdom_house);
        }
      }
    };
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      const f = dt / 16.7;
      S.x += S.dir * (1.15 + S.placed * 0.16) * f;
      if (S.x >= 90) { S.x = 90; S.dir = -1; }
      if (S.x <= 10) { S.x = 10; S.dir = 1; }
      const el = $('#wh-mover'); if (el) el.style.left = `${S.x}%`;
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🏺 窯匠的手：按住塑形、力度計上升，在「合用區」內放手，塑好底座/瓶身/瓶口 ——
  ACTION_GAMES.potter_hands = function startPotter() {
    const PARTS = ['底座', '瓶身', '瓶口'];
    const S = { phase: 'play', part: 0, fails: 0, gauge: 0, holding: false, band: [58, 80], raf: 0 };
    const area = startAction('🏺 窯匠的手', 'JER', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="pt-pot" id="pt-pot">🟤</div>
      <p class="act-hint" id="pt-part">正在塑「底座」——按住轉輪，力度進到綠色「合用區」再放手！</p>
      <div class="act-row"><span>💪 力度</span><div class="pt-gauge"><div class="pt-band" id="pt-band"></div><div class="act-fill pt-fill" id="pt-fill"></div></div></div>
      <div class="act-row"><span>💔 失手</span><b id="pt-fails">—</b></div>
      <button class="big-btn act-tap" id="pt-btn">🌀 按住塑形</button>`;
    const newBand = () => {
      const lo = 52 + Math.random() * 24;
      S.band = [lo, lo + 20];
      const b = $('#pt-band');
      b.style.left = `${S.band[0]}%`;
      b.style.width = '20%';
    };
    newBand();
    const fail = (why) => {
      S.fails++;
      sndBad();
      $('#pt-fails').textContent = '💔'.repeat(S.fails);
      $('#pt-part').textContent = `${why}——泥壞了？窯匠用這泥另作！再塑「${PARTS[S.part]}」`;
      S.gauge = 0;
      if (S.fails >= 3) {
        S.phase = 'done';
        loseAction('JER', MINIGAMES.potter_hands.lose.text, ACTION_GAMES.potter_hands);
      }
    };
    const btn = $('#pt-btn');
    btn.onpointerdown = (e) => { e.preventDefault(); if (S.phase === 'play') { S.holding = true; } };
    const release = () => {
      if (S.phase !== 'play' || !S.holding) return;
      S.holding = false;
      if (S.gauge >= S.band[0] && S.gauge <= S.band[1]) {
        S.part++;
        sndGood();
        $('#pt-pot').textContent = ['🟤', '⚱️', '🏺'][S.part] || '🏺';
        if (S.part >= PARTS.length) {
          S.phase = 'done';
          winAction('potter_hands', 'JER', MINIGAMES.potter_hands.win, ACTION_GAMES.potter_hands);
          return;
        }
        $('#pt-part').textContent = `成了！接著塑「${PARTS[S.part]}」——按住，進合用區再放手！`;
        S.gauge = 0;
        newBand();
      } else {
        fail(S.gauge < S.band[0] ? '力道不夠' : '轉過頭了');
      }
    };
    btn.onpointerup = release;
    btn.onpointerleave = release;
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      const f = dt / 16.7;
      if (S.holding) {
        S.gauge += (1.05 + S.part * 0.25) * f;
        if (S.gauge > 100) { S.holding = false; fail('轉過頭了'); }
      } else {
        S.gauge = Math.max(0, S.gauge - 0.8 * f); // 放著會慢慢鬆掉
      }
      const el = $('#pt-fill'); if (el) el.style.width = `${Math.min(100, S.gauge)}%`;
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🌾 蝗蟲退散：蝗蟲從右邊飛進來，手指掃過趕走牠們，守住五束麥子 ——
  ACTION_GAMES.joel_locusts = function startLocusts() {
    const GOAL = 18;
    const S = { phase: 'play', swept: 0, wheat: 5, bugs: [], sinceSpawn: 0, raf: 0 };
    const area = startAction('🌾 蝗蟲退散', 'JOL', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>🧹 趕走</span><div class="act-track"><div class="act-fill" id="jl-bar"></div></div><b id="jl-count">0/${GOAL}</b></div>
      <div class="jl-stage" id="jl-stage"><div class="jl-wheat" id="jl-wheat">🌾🌾🌾🌾🌾</div></div>
      <p class="fr-tip">手指在畫面上掃過蝗蟲 🦗 把牠們趕走——牠們飛到左邊就會吃掉一束麥子！</p>`;
    const stage = $('#jl-stage');
    const sweep = (e) => {
      if (S.phase !== 'play') return;
      const r = stage.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * 100;
      const py = ((e.clientY - r.top) / r.height) * 100;
      for (let i = S.bugs.length - 1; i >= 0; i--) {
        const b = S.bugs[i];
        if (Math.abs(b.x - px) < 13 && Math.abs(b.y - py) < 13) {
          b.el.remove();
          S.bugs.splice(i, 1);
          S.swept++;
          sndGood();
          $('#jl-count').textContent = `${S.swept}/${GOAL}`;
          $('#jl-bar').style.width = `${(S.swept / GOAL) * 100}%`;
          if (S.swept >= GOAL) {
            S.phase = 'done';
            winAction('joel_locusts', 'JOL', MINIGAMES.joel_locusts.win, ACTION_GAMES.joel_locusts);
            return;
          }
        }
      }
    };
    stage.onpointerdown = sweep;
    stage.onpointermove = (e) => { if (e.buttons || e.pressure > 0) sweep(e); };
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      const f = dt / 16.7;
      S.sinceSpawn += dt;
      const interval = Math.max(520, 950 - S.swept * 24);
      if (S.sinceSpawn >= interval) {
        S.sinceSpawn = 0;
        const el = document.createElement('div');
        el.className = 'jl-bug';
        el.textContent = '🦗';
        stage.appendChild(el);
        S.bugs.push({ x: 102, y: 12 + Math.random() * 76, el });
      }
      for (let i = S.bugs.length - 1; i >= 0; i--) {
        const b = S.bugs[i];
        b.x -= (0.42 + S.swept * 0.012) * f;
        b.el.style.left = `${b.x}%`;
        b.el.style.top = `${b.y}%`;
        if (b.x <= 6) { // 飛到麥田：吃掉一束
          b.el.remove();
          S.bugs.splice(i, 1);
          S.wheat--;
          sndBad();
          $('#jl-wheat').textContent = '🌾'.repeat(Math.max(0, S.wheat)) || '…';
          if (S.wheat <= 0) {
            S.phase = 'done';
            loseAction('JOL', MINIGAMES.joel_locusts.lose.text, ACTION_GAMES.joel_locusts);
            return;
          }
        }
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🕎 七燈點亮：金燈臺的燈按順序亮起，記住順序照樣點回去（記憶序列）——
  ACTION_GAMES.zech_lamps = function startLamps() {
    const S = { phase: 'show', round: 2, seq: [], input: 0, misses: 0, timers: [] };
    const area = startAction('🕎 七燈點亮', 'ZEC', () => S.timers.forEach(clearTimeout));
    action.state = S;
    area.innerHTML = `
      <p class="act-hint" id="zl-hint">純金燈臺上有七盞燈（亞 4:2）——燈按順序亮起，記住順序，照樣點回去！</p>
      <div class="zl-row" id="zl-row">${Array.from({ length: 7 }, (_, i) => `<button class="zl-lamp act-tap" data-i="${i}">🕯️</button>`).join('')}</div>
      <div class="act-row"><span>🕎 順序</span><div class="act-track"><div class="act-fill" id="zl-bar"></div></div><b id="zl-round">2/7</b></div>
      <div class="act-row"><span>💔 失誤</span><b id="zl-miss">—</b></div>`;
    const lamps = [...document.querySelectorAll('.zl-lamp')];
    const flash = (i, ms) => {
      lamps[i].textContent = '🔥';
      lamps[i].classList.add('zl-on');
      S.timers.push(setTimeout(() => { lamps[i].textContent = '🕯️'; lamps[i].classList.remove('zl-on'); }, ms));
    };
    S.showSeq = () => {
      S.phase = 'show';
      S.input = 0;
      S.seq = Array.from({ length: S.round }, () => Math.floor(Math.random() * 7));
      $('#zl-hint').textContent = '看好燈亮的順序…';
      S.seq.forEach((l, idx) => S.timers.push(setTimeout(() => {
        flash(l, 420);
        if (idx === S.seq.length - 1) S.timers.push(setTimeout(() => { S.phase = 'input'; $('#zl-hint').textContent = '換你了！照剛才的順序點燈！'; }, 520));
      }, 620 * idx + 400)));
    };
    lamps.forEach((b, i) => {
      b.onclick = () => {
        if (S.phase !== 'input') return;
        if (i === S.seq[S.input]) {
          flash(i, 300);
          S.input++;
          if (S.input >= S.seq.length) { // 這一輪答完
            sndGood();
            if (S.round >= 7) {
              S.phase = 'done';
              winAction('zech_lamps', 'ZEC', MINIGAMES.zech_lamps.win, ACTION_GAMES.zech_lamps);
              return;
            }
            S.round++;
            $('#zl-round').textContent = `${S.round}/7`;
            $('#zl-bar').style.width = `${((S.round - 2) / 5) * 100}%`;
            $('#zl-hint').textContent = '亮了！下一輪更長，看好…';
            S.phase = 'show';
            S.timers.push(setTimeout(S.showSeq, 900));
          }
        } else {
          S.misses++;
          sndBad();
          $('#zl-miss').textContent = '💔'.repeat(S.misses);
          if (S.misses >= 3) {
            S.phase = 'done';
            loseAction('ZEC', MINIGAMES.zech_lamps.lose.text, ACTION_GAMES.zech_lamps);
            return;
          }
          $('#zl-hint').textContent = '點錯了——同一輪再看一次！';
          S.phase = 'show';
          S.timers.push(setTimeout(S.showSeq, 900));
        }
      };
    });
    S.timers.push(setTimeout(S.showSeq, 600));
  };

  // —— 🗼 守望樓上：異象一閃即逝——顯現的瞬間立刻點擊抄下來（反應速度）——
  ACTION_GAMES.hab_watch = function startWatch() {
    const GOAL = 6;
    const S = { phase: 'wait', round: 0, misses: 0, t: 0, waitMs: 1500 + Math.random() * 1500, windowMs: 900, raf: 0 };
    const area = startAction('🗼 守望樓上', 'HAB', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>📜 抄下</span><div class="act-track"><div class="act-fill" id="hw-bar"></div></div><b id="hw-count">0/${GOAL}</b></div>
      <div class="act-row"><span>💔 失誤</span><b id="hw-miss">—</b></div>
      <div class="hw-stage act-tap" id="hw-stage"><div class="hw-icon" id="hw-icon">🌫️</div><div class="hw-text" id="hw-text">站在守望所，等候異象…</div></div>
      <p class="fr-tip">耐心等——「✨ 異象顯現」的瞬間立刻點擊，把默示明明地寫在版上！太早點會嚇跑異象。（哈 2:1-2）</p>`;
    const miss = (why) => {
      S.misses++;
      sndBad();
      $('#hw-miss').textContent = '💔'.repeat(S.misses);
      $('#hw-icon').textContent = '🌫️';
      $('#hw-text').textContent = `${why}——再守候…`;
      if (S.misses >= 3) {
        S.phase = 'done';
        loseAction('HAB', MINIGAMES.hab_watch.lose.text, ACTION_GAMES.hab_watch);
        return;
      }
      S.phase = 'wait';
      S.t = 0;
      S.waitMs = 1500 + Math.random() * 1800;
    };
    $('#hw-stage').onpointerdown = (e) => {
      e.preventDefault();
      if (S.phase === 'wait') { miss('太急了！異象還沒顯現'); return; }
      if (S.phase !== 'flash') return;
      S.round++;
      sndGood();
      $('#hw-count').textContent = `${S.round}/${GOAL}`;
      $('#hw-bar').style.width = `${(S.round / GOAL) * 100}%`;
      if (S.round >= GOAL) {
        S.phase = 'done';
        winAction('hab_watch', 'HAB', MINIGAMES.hab_watch.win, ACTION_GAMES.hab_watch);
        return;
      }
      $('#hw-icon').textContent = '🌫️';
      $('#hw-text').textContent = '抄下來了！繼續守候下一個異象…';
      S.phase = 'wait';
      S.t = 0;
      S.waitMs = 1500 + Math.random() * 1800;
      S.windowMs = Math.max(500, 900 - S.round * 70); // 越後面閃得越快
    };
    S.tick = (dt) => {
      if (S.phase === 'wait') {
        S.t += dt;
        if (S.t >= S.waitMs) {
          S.phase = 'flash';
          S.t = 0;
          $('#hw-icon').textContent = '✨';
          $('#hw-text').textContent = '異象顯現！快抄下來！';
        }
      } else if (S.phase === 'flash') {
        S.t += dt;
        if (S.t >= S.windowMs) miss('異象一閃就過了');
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase !== 'done') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🛡️ 穿上全副軍裝：點裝備、再點正確部位穿上，六件到齊（配對穿戴）——
  ACTION_GAMES.armor_god = function startArmor() {
    const ARMOR = [
      { n: '真理的帶子', e: '🎗️', slot: '腰' },
      { n: '公義的護心鏡', e: '🦺', slot: '胸' },
      { n: '平安福音的鞋', e: '👟', slot: '腳' },
      { n: '信德的藤牌', e: '🛡️', slot: '左手' },
      { n: '救恩的頭盔', e: '🪖', slot: '頭' },
      { n: '聖靈的寶劍', e: '🗡️', slot: '右手' },
    ];
    const SLOTS = ['頭', '胸', '腰', '左手', '右手', '腳'];
    const S = { phase: 'play', worn: 0, misses: 0, sel: null };
    const area = startAction('🛡️ 穿上全副軍裝', 'EPH', null);
    action.state = S;
    area.innerHTML = `
      <p class="act-hint" id="am-hint">先點下面的裝備，再點士兵身上正確的部位穿上！（弗 6:11-17）</p>
      <div class="am-body" id="am-body">${SLOTS.map((s) => `<button class="am-slot act-tap" data-s="${s}">${s}</button>`).join('')}</div>
      <div class="am-items" id="am-items">${shuffleArr(ARMOR.map((_, i) => i)).map((i) => `<button class="am-item act-tap" data-i="${i}">${ARMOR[i].e}<small>${ARMOR[i].n}</small></button>`).join('')}</div>
      <div class="act-row"><span>🔥 火箭</span><div class="act-track"><div class="act-fill act-foe" id="am-foe"></div></div></div>`;
    document.querySelectorAll('.am-item').forEach((b) => {
      b.onclick = () => {
        if (S.phase !== 'play' || b.disabled) return;
        document.querySelectorAll('.am-item').forEach((x) => x.classList.remove('selected'));
        b.classList.add('selected');
        S.sel = Number(b.dataset.i);
        $('#am-hint').textContent = `拿著「${ARMOR[S.sel].n}」——要穿在哪裡？`;
      };
    });
    document.querySelectorAll('.am-slot').forEach((b) => {
      b.onclick = () => {
        if (S.phase !== 'play' || S.sel === null || b.classList.contains('am-worn')) return;
        const it = ARMOR[S.sel];
        if (b.dataset.s === it.slot) {
          b.textContent = it.e;
          b.classList.add('am-worn');
          const card = document.querySelector(`.am-item[data-i="${S.sel}"]`);
          card.disabled = true; card.classList.remove('selected'); card.style.opacity = .3;
          S.sel = null;
          S.worn++;
          sndGood();
          $('#am-hint').textContent = S.worn >= 6 ? '' : '穿上了！繼續拿下一件。';
          if (S.worn >= 6) {
            S.phase = 'done';
            winAction('armor_god', 'EPH', MINIGAMES.armor_god.win, ACTION_GAMES.armor_god);
          }
        } else {
          S.misses++;
          sndBad();
          $('#am-foe').style.width = `${(S.misses / 3) * 100}%`;
          $('#am-hint').textContent = `「${it.n}」不是穿在${b.dataset.s}——再想想！`;
          const body = $('#am-body');
          body.classList.remove('jr-shake'); void body.offsetWidth; body.classList.add('jr-shake');
          if (S.misses >= 3) {
            S.phase = 'done';
            loseAction('EPH', MINIGAMES.armor_god.lose.text, ACTION_GAMES.armor_god);
          }
        }
      };
    });
  };

  // —— 🏃 向著標竿直跑：障礙逼近，時機起跳越過，一路跑到標竿（跨欄跑者）——
  ACTION_GAMES.php_race = function startRace() {
    const GOAL = 12, JUMP_MS = 680;
    const S = { phase: 'play', passed: 0, hits: 0, jumpT: -1, obs: [], sinceObs: 900, raf: 0 };
    const area = startAction('🏃 向著標竿直跑', 'PHP', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>🏁 路程</span><div class="act-track"><div class="act-fill" id="rc-bar"></div></div><b id="rc-count">0/${GOAL}</b></div>
      <div class="act-row"><span>💚 體力</span><b id="rc-hearts">💚💚💚</b></div>
      <div class="rc-stage act-tap" id="rc-stage"><div class="rc-runner" id="rc-runner">🏃</div><div class="rc-flag">🏁</div></div>
      <p class="fr-tip">點畫面起跳，越過迎面而來的障礙——忘記背後，努力面前，向著標竿直跑！（腓 3:13-14）</p>`;
    const stage = $('#rc-stage');
    stage.onpointerdown = (e) => { e.preventDefault(); if (S.phase === 'play' && S.jumpT < 0) S.jumpT = 0; };
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      const f = dt / 16.7;
      if (S.jumpT >= 0) {
        S.jumpT += dt;
        if (S.jumpT >= JUMP_MS) S.jumpT = -1;
      }
      const jumpY = S.jumpT >= 0 ? Math.sin((S.jumpT / JUMP_MS) * Math.PI) * 40 : 0;
      $('#rc-runner').style.bottom = `${10 + jumpY}%`;
      S.sinceObs += dt;
      const interval = Math.max(950, 1600 - S.passed * 55);
      if (S.sinceObs >= interval) {
        S.sinceObs = 0;
        const el = document.createElement('div');
        el.className = 'rc-obs';
        el.textContent = ['🪨', '🚧', '🌵'][Math.floor(Math.random() * 3)];
        stage.appendChild(el);
        S.obs.push({ x: 104, el, done: false });
      }
      for (let i = S.obs.length - 1; i >= 0; i--) {
        const o = S.obs[i];
        o.x -= (0.62 + S.passed * 0.02) * f;
        o.el.style.left = `${o.x}%`;
        if (!o.done && o.x < 23 && o.x > 13) { // 與跑者重疊：看有沒有跳起來
          if (jumpY < 15) {
            o.done = true;
            S.hits++;
            sndBad();
            stage.classList.remove('jr-shake'); void stage.offsetWidth; stage.classList.add('jr-shake');
            $('#rc-hearts').textContent = '💚'.repeat(Math.max(0, 3 - S.hits)) || '…';
            if (S.hits >= 3) {
              S.phase = 'done';
              loseAction('PHP', MINIGAMES.php_race.lose.text, ACTION_GAMES.php_race);
              return;
            }
          }
        }
        if (!o.done && o.x <= 13) {
          o.done = true;
          S.passed++;
          sndGood();
          $('#rc-count').textContent = `${S.passed}/${GOAL}`;
          $('#rc-bar').style.width = `${(S.passed / GOAL) * 100}%`;
          if (S.passed >= GOAL) {
            S.phase = 'done';
            winAction('php_race', 'PHP', MINIGAMES.php_race.win, ACTION_GAMES.php_race);
            return;
          }
        }
        if (o.x < -10) { o.el.remove(); S.obs.splice(i, 1); }
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🛡️ 抵擋吼獅：獅子從左/中/右撲來，撲擊瞬間舉起正確方向的盾牌（方向格擋）——
  ACTION_GAMES.peter_lion = function startLion() {
    const GOAL = 7, DIRS = ['左', '中', '右'];
    const S = { phase: 'crouch', blocked: 0, misses: 0, dir: 1, t: 0, crouchMs: 1400, windowMs: 850, raf: 0 };
    const area = startAction('🛡️ 抵擋吼獅', '1PE', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>🛡️ 擋下</span><div class="act-track"><div class="act-fill" id="ln-bar"></div></div><b id="ln-count">0/${GOAL}</b></div>
      <div class="act-row"><span>💔 失手</span><b id="ln-miss">—</b></div>
      <div class="ln-stage" id="ln-stage"><div class="ln-lion" id="ln-lion">🦁</div><div class="ln-text" id="ln-text">獅子在暗處徘徊…</div></div>
      <div class="st-btns">
        <button class="big-btn act-tap" data-d="0">◀️🛡️</button>
        <button class="big-btn act-tap" data-d="1">🛡️</button>
        <button class="big-btn act-tap" data-d="2">🛡️▶️</button>
      </div>
      <p class="fr-tip">看獅子從哪個方向蹲低——「撲上來了！」的瞬間，按那個方向的盾牌！太早按會露出破綻。（彼前 5:8-9）</p>`;
    const newRound = () => {
      S.phase = 'crouch';
      S.t = 0;
      S.dir = Math.floor(Math.random() * 3);
      S.crouchMs = 1000 + Math.random() * 1400;
      S.windowMs = Math.max(520, 850 - S.blocked * 45);
      $('#ln-lion').style.left = `${[18, 50, 82][S.dir]}%`;
      $('#ln-lion').style.fontSize = '2.4rem';
      $('#ln-text').textContent = `獅子在${DIRS[S.dir]}邊蹲低了…等牠撲上來再舉盾！`;
    };
    const miss = (why) => {
      S.misses++;
      sndBad();
      $('#ln-miss').textContent = '💔'.repeat(S.misses);
      if (S.misses >= 3) {
        S.phase = 'done';
        loseAction('1PE', MINIGAMES.peter_lion.lose.text, ACTION_GAMES.peter_lion);
        return;
      }
      $('#ln-text').textContent = `${why}——再站穩！`;
      newRound();
    };
    document.querySelectorAll('#screen-action .st-btns .big-btn, #action-area .st-btns .big-btn').forEach((b) => {
      b.onclick = () => {
        if (S.phase === 'crouch') { miss('太早舉盾，露出破綻'); return; }
        if (S.phase !== 'pounce') return;
        if (Number(b.dataset.d) === S.dir) {
          S.blocked++;
          sndGood();
          $('#ln-count').textContent = `${S.blocked}/${GOAL}`;
          $('#ln-bar').style.width = `${(S.blocked / GOAL) * 100}%`;
          if (S.blocked >= GOAL) {
            S.phase = 'done';
            winAction('peter_lion', '1PE', MINIGAMES.peter_lion.win, ACTION_GAMES.peter_lion);
            return;
          }
          $('#ln-text').textContent = '擋下來了！牠退回暗處…';
          newRound();
        } else {
          miss('舉錯邊了，獅子擦身而過');
        }
      };
    });
    S.tick = (dt) => {
      if (S.phase === 'crouch') {
        S.t += dt;
        if (S.t >= S.crouchMs) {
          S.phase = 'pounce';
          S.t = 0;
          $('#ln-lion').style.fontSize = '3.6rem';
          $('#ln-text').textContent = `🦁 從${DIRS[S.dir]}邊撲上來了！舉盾！`;
        }
      } else if (S.phase === 'pounce') {
        S.t += dt;
        if (S.t >= S.windowMs) miss('沒擋住這一撲');
      }
    };
    newRound();
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase !== 'done') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🪜 屬靈八階梯：把彼後 1:5-7 的八樣美德，按階梯順序點出來（順序挑戰）——
  ACTION_GAMES.peter_ladder = function startLadder() {
    const STEPS = ['信心', '德行', '知識', '節制', '忍耐', '虔敬', '愛弟兄的心', '愛眾人的心'];
    const S = { phase: 'play', at: 0, misses: 0 };
    const area = startAction('🪜 屬靈八階梯', '2PE', null);
    action.state = S;
    area.innerHTML = `
      <p class="act-hint" id="ld-hint">「有了信心，又要加上德行……」把八樣美德照階梯順序點出來！（彼後 1:5-7）</p>
      <div class="act-row"><span>🪜 爬到</span><div class="act-track"><div class="act-fill" id="ld-bar"></div></div><b id="ld-count">0/8</b></div>
      <div class="act-row"><span>💔 失誤</span><b id="ld-miss">—</b></div>
      <div class="ld-grid" id="ld-grid">${shuffleArr(STEPS.map((_, i) => i)).map((i) => `<button class="ld-card act-tap" data-i="${i}">${STEPS[i]}</button>`).join('')}</div>`;
    document.querySelectorAll('.ld-card').forEach((b) => {
      b.onclick = () => {
        if (S.phase !== 'play' || b.classList.contains('ld-done')) return;
        const i = Number(b.dataset.i);
        if (i === S.at) {
          b.classList.add('ld-done');
          b.textContent = `${S.at + 1}. ${STEPS[i]}`;
          S.at++;
          sndGood();
          $('#ld-count').textContent = `${S.at}/8`;
          $('#ld-bar').style.width = `${(S.at / 8) * 100}%`;
          $('#ld-hint').textContent = S.at >= 8 ? '' : `有了${STEPS[S.at - 1]}，又要加上……？`;
          if (S.at >= 8) {
            S.phase = 'done';
            winAction('peter_ladder', '2PE', MINIGAMES.peter_ladder.win, ACTION_GAMES.peter_ladder);
          }
        } else {
          S.misses++;
          sndBad();
          $('#ld-miss').textContent = '💔'.repeat(S.misses);
          $('#ld-hint').textContent = `還沒到「${STEPS[i]}」——想想：有了${S.at ? STEPS[S.at - 1] : '殷勤'}，接著加上甚麼？`;
          if (S.misses >= 3) {
            S.phase = 'done';
            loseAction('2PE', MINIGAMES.peter_ladder.lose.text, ACTION_GAMES.peter_ladder);
          }
        }
      };
    });
  };

  // —— 💡 神就是光：手指擦開迷霧，讓光照亮整段經文（限時擦亮）——
  ACTION_GAMES.john_light = function startLight() {
    const COLS = 8, ROWS = 8, LIMIT_MS = 30000;
    const S = { phase: 'play', cleared: 0, total: COLS * ROWS, t: 0, raf: 0 };
    const area = startAction('💡 神就是光', '1JN', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>🌘 天亮前</span><div class="act-track"><div class="act-fill act-foe" id="lt-time"></div></div></div>
      <div class="lt-stage" id="lt-stage">
        <div class="lt-verse">「神就是光，<br>在他毫無黑暗。」<br><small>約翰一書 1:5</small></div>
        <div class="lt-fog" id="lt-fog">${Array.from({ length: COLS * ROWS }, (_, i) => `<span class="lt-tile" data-i="${i}"></span>`).join('')}</div>
      </div>
      <p class="fr-tip">手指掃過畫面，把黑暗一格一格擦掉——讓整節經文亮出來！</p>`;
    const stage = $('#lt-stage');
    const tiles = [...document.querySelectorAll('.lt-tile')];
    const wipe = (e) => {
      if (S.phase !== 'play') return;
      const r = stage.getBoundingClientRect();
      const cx = Math.floor(((e.clientX - r.left) / r.width) * COLS);
      const cy = Math.floor(((e.clientY - r.top) / r.height) * ROWS);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
        const t = tiles[y * COLS + x];
        if (!t.classList.contains('lt-clear')) {
          t.classList.add('lt-clear');
          S.cleared++;
        }
      }
      if (S.cleared >= S.total) {
        S.phase = 'done';
        sndGood();
        winAction('john_light', '1JN', MINIGAMES.john_light.win, ACTION_GAMES.john_light);
      }
    };
    stage.onpointerdown = wipe;
    stage.onpointermove = (e) => { if (e.buttons || e.pressure > 0) wipe(e); };
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      S.t += dt;
      $('#lt-time').style.width = `${Math.min(100, (S.t / LIMIT_MS) * 100)}%`;
      if (S.t >= LIMIT_MS) {
        S.phase = 'done';
        loseAction('1JN', MINIGAMES.john_light.lose.text, ACTION_GAMES.john_light);
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🌠 尋找七星：夜空裡藏了七顆 ⭐（七教會的使者），限時全部找出來（尋物）——
  ACTION_GAMES.rev_stars = function startStars() {
    const GOAL = 7, LIMIT_MS = 45000, DECOYS = ['🌟', '✨', '💫', '🌙'];
    const S = { phase: 'play', found: 0, t: 0, raf: 0 };
    const area = startAction('🌠 尋找七星', 'REV', () => cancelAnimationFrame(S.raf));
    action.state = S;
    let sky = '';
    const spots = shuffleArr(Array.from({ length: 35 }, (_, i) => i));
    for (let k = 0; k < 35; k++) {
      const isStar = spots.indexOf(k) < GOAL;
      const x = 6 + Math.random() * 88, y = 6 + Math.random() * 86;
      sky += `<button class="rv-obj act-tap${isStar ? ' rv-star' : ''}" style="left:${x}%;top:${y}%">${isStar ? '⭐' : DECOYS[Math.floor(Math.random() * DECOYS.length)]}</button>`;
    }
    area.innerHTML = `
      <div class="act-row"><span>⭐ 找到</span><div class="act-track"><div class="act-fill" id="rv-bar"></div></div><b id="rv-count">0/${GOAL}</b></div>
      <div class="act-row"><span>⏳ 時間</span><div class="act-track"><div class="act-fill act-foe" id="rv-time"></div></div></div>
      <div class="rv-stage" id="rv-stage">${sky}</div>
      <p class="fr-tip">七星就是七個教會的使者（啟 1:20）——只找 ⭐，別被 🌟✨💫 騙了！點錯會扣 3 秒。</p>`;
    document.querySelectorAll('.rv-obj').forEach((b) => {
      b.onclick = () => {
        if (S.phase !== 'play') return;
        if (b.classList.contains('rv-star')) {
          if (b.classList.contains('rv-got')) return;
          b.classList.add('rv-got');
          b.textContent = '✅';
          S.found++;
          sndGood();
          $('#rv-count').textContent = `${S.found}/${GOAL}`;
          $('#rv-bar').style.width = `${(S.found / GOAL) * 100}%`;
          if (S.found >= GOAL) {
            S.phase = 'done';
            winAction('rev_stars', 'REV', MINIGAMES.rev_stars.win, ACTION_GAMES.rev_stars);
          }
        } else {
          S.t += 3000; // 點錯扣 3 秒
          sndBad();
          const st = $('#rv-stage');
          st.classList.remove('jr-shake'); void st.offsetWidth; st.classList.add('jr-shake');
        }
      };
    });
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      S.t += dt;
      $('#rv-time').style.width = `${Math.min(100, (S.t / LIMIT_MS) * 100)}%`;
      if (S.t >= LIMIT_MS) {
        S.phase = 'done';
        loseAction('REV', MINIGAMES.rev_stars.lose.text, ACTION_GAMES.rev_stars);
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🕊️ 潔與不潔：動物一隻隻出現，限時往左（潔淨）或往右（不潔）快分（利 11）——
  ACTION_GAMES.atonement = function startCleanSort() {
    const ITEMS = shuffleArr([
      { e: '🐂', n: '牛（分蹄倒嚼）', clean: true }, { e: '🐑', n: '綿羊', clean: true },
      { e: '🐐', n: '山羊', clean: true }, { e: '🐟', n: '有翅有鱗的魚', clean: true },
      { e: '🦗', n: '蝗蟲（利 11:22 可吃！）', clean: true }, { e: '🦌', n: '鹿', clean: true },
      { e: '🐖', n: '豬（分蹄不倒嚼）', clean: false }, { e: '🐫', n: '駱駝（倒嚼不分蹄）', clean: false },
      { e: '🐇', n: '兔子（倒嚼不分蹄）', clean: false }, { e: '🦅', n: '鵰', clean: false },
      { e: '🦇', n: '蝙蝠', clean: false }, { e: '🦈', n: '無鱗的水族', clean: false },
    ]);
    const S = { phase: 'play', idx: 0, wrong: 0, t: 0, limit: 4200, raf: 0 };
    const area = startAction('🕊️ 潔與不潔', 'LEV', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>📋 分完</span><div class="act-track"><div class="act-fill" id="cs-bar"></div></div><b id="cs-count">0/${ITEMS.length}</b></div>
      <div class="act-row"><span>💔 分錯</span><b id="cs-miss">—</b></div>
      <div class="cs-stage" id="cs-stage">
        <div class="cs-zone cs-left">✅ 潔淨<br><small>往左滑</small></div>
        <div class="cs-zone cs-right">🚫 不潔<br><small>往右滑</small></div>
        <div class="cs-card" id="cs-card"></div>
        <div class="cs-timer"><div class="act-fill act-foe" id="cs-time"></div></div>
      </div>
      <p class="fr-tip">照利未記 11 章的條例快手分類：可吃的滑左邊、不可吃的滑右邊——猶豫太久也算錯！</p>`;
    const showCard = () => {
      const it = ITEMS[S.idx];
      $('#cs-card').innerHTML = `<span class="cs-emoji">${it.e}</span><small>${it.n}</small>`;
      $('#cs-card').style.transform = 'translate(-50%, -50%)';
      S.t = 0;
    };
    S.answer = (goLeft) => {
      if (S.phase !== 'play') return;
      const it = ITEMS[S.idx];
      const ok = goLeft === it.clean; // 左＝潔淨
      $('#cs-card').style.transform = `translate(${goLeft ? '-160%' : '60%'}, -50%) rotate(${goLeft ? -18 : 18}deg)`;
      if (ok) sndGood();
      else {
        S.wrong++;
        sndBad();
        $('#cs-miss').textContent = '💔'.repeat(S.wrong);
        if (S.wrong >= 3) {
          S.phase = 'done';
          loseAction('LEV', MINIGAMES.atonement.lose.text, ACTION_GAMES.atonement);
          return;
        }
      }
      S.idx++;
      $('#cs-count').textContent = `${S.idx}/${ITEMS.length}`;
      $('#cs-bar').style.width = `${(S.idx / ITEMS.length) * 100}%`;
      if (S.idx >= ITEMS.length) {
        S.phase = 'done';
        winAction('atonement', 'LEV', MINIGAMES.atonement.win, ACTION_GAMES.atonement);
        return;
      }
      setTimeout(() => { if (S.phase === 'play') showCard(); }, 180);
    };
    const stage = $('#cs-stage');
    let downX = null;
    stage.onpointerdown = (e) => { downX = e.clientX; };
    stage.onpointerup = (e) => {
      if (downX === null) return;
      const dx = e.clientX - downX;
      downX = null;
      if (Math.abs(dx) >= 40) S.answer(dx < 0);
    };
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      S.t += dt;
      const el = $('#cs-time'); if (el) el.style.width = `${Math.min(100, (S.t / S.limit) * 100)}%`;
      if (S.t >= S.limit) S.answer(!ITEMS[S.idx].clean); // 超時＝分錯
    };
    showCard();
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 💚 金句拼回來：整句經文亮相幾秒 → 打散 → 憑記憶照原順序點回來（申 6:5、30:19）——
  ACTION_GAMES.choose_life = function startVersePuzzle() {
    const ROUNDS = [
      { ref: '申命記 6:5', chips: ['你要盡心、', '盡性、', '盡力', '愛耶和華', '你的神。'] },
      { ref: '申命記 30:19', chips: ['所以你要', '揀選生命，', '使你和', '你的後裔', '都得存活。'] },
    ];
    const S = { phase: 'show', round: 0, at: 0, misses: 0, timers: [] };
    const area = startAction('💚 金句拼回來', 'DEU', () => S.timers.forEach(clearTimeout));
    action.state = S;
    area.innerHTML = `
      <p class="act-hint" id="vp-hint"></p>
      <div class="q-passage" id="vp-verse"></div>
      <div class="vp-grid" id="vp-grid"></div>
      <div class="act-row"><span>💔 失誤</span><b id="vp-miss">—</b></div>`;
    const startRound = () => {
      const r = ROUNDS[S.round];
      S.phase = 'show';
      S.at = 0;
      $('#vp-hint').textContent = `第 ${S.round + 1} 句（${r.ref}）——記住這句話：`;
      $('#vp-verse').textContent = r.chips.join('');
      $('#vp-grid').innerHTML = '';
      S.timers.push(setTimeout(() => {
        S.phase = 'input';
        $('#vp-verse').textContent = '？？？';
        $('#vp-hint').textContent = '打散了！照原本的順序把金句點回來：';
        const grid = $('#vp-grid');
        for (const i of shuffleArr(r.chips.map((_, k) => k))) {
          const b = document.createElement('button');
          b.className = 'vp-chip act-tap';
          b.textContent = r.chips[i];
          b.onclick = () => {
            if (S.phase !== 'input' || b.classList.contains('vp-done')) return;
            if (i === S.at) {
              b.classList.add('vp-done');
              S.at++;
              $('#vp-verse').textContent = r.chips.slice(0, S.at).join('');
              sndGood();
              if (S.at >= r.chips.length) {
                S.round++;
                if (S.round >= ROUNDS.length) {
                  S.phase = 'done';
                  winAction('choose_life', 'DEU', MINIGAMES.choose_life.win, ACTION_GAMES.choose_life);
                  return;
                }
                S.timers.push(setTimeout(startRound, 900));
              }
            } else {
              S.misses++;
              sndBad();
              $('#vp-miss').textContent = '💔'.repeat(S.misses);
              if (S.misses >= 3) {
                S.phase = 'done';
                loseAction('DEU', MINIGAMES.choose_life.lose.text, ACTION_GAMES.choose_life);
              }
            }
          };
          grid.appendChild(b);
        }
      }, 3500));
    };
    startRound();
  };

  // —— 🎁 一筆畫獻材料：手指一筆不斷，把建殿材料全部連起來，避開「私心」的坑（代上 29:2）——
  ACTION_GAMES.david_offering = function startOneStroke() {
    const NODES = [
      { e: '💰', n: '金', x: 18, y: 18 }, { e: '🥈', n: '銀', x: 74, y: 14 },
      { e: '🟤', n: '銅', x: 46, y: 36 }, { e: '⚙️', n: '鐵', x: 14, y: 58 },
      { e: '🪵', n: '木', x: 82, y: 52 }, { e: '💎', n: '寶石', x: 30, y: 82 }, { e: '🏵️', n: '漢白玉', x: 68, y: 84 },
    ];
    const HAZARDS = [{ x: 48, y: 62 }, { x: 44, y: 12 }];
    const S = { phase: 'play', got: new Set(), tries: 3, drawing: false };
    const area = startAction('🎁 一筆畫獻材料', '1CH', null);
    action.state = S;
    area.innerHTML = `
      <p class="act-hint">手指按住不放，<b>一筆</b>把七樣建殿材料全部連起來——避開 🕳️ 私心的坑，中途放手就要重畫！</p>
      <div class="os-stage" id="os-stage">
        ${NODES.map((n, i) => `<div class="os-node" data-i="${i}" style="left:${n.x}%;top:${n.y}%">${n.e}<small>${n.n}</small></div>`).join('')}
        ${HAZARDS.map((h) => `<div class="os-hole" style="left:${h.x}%;top:${h.y}%">🕳️</div>`).join('')}
      </div>
      <div class="act-row"><span>✏️ 機會</span><b id="os-tries">✏️✏️✏️</b></div>`;
    const stage = $('#os-stage');
    const fail = (why) => {
      S.tries--;
      sndBad();
      $('#os-tries').textContent = '✏️'.repeat(Math.max(0, S.tries)) || '…';
      S.got.clear();
      document.querySelectorAll('.os-node').forEach((n) => n.classList.remove('os-got'));
      if (S.tries <= 0) {
        S.phase = 'done';
        loseAction('1CH', MINIGAMES.david_offering.lose.text, ACTION_GAMES.david_offering);
      }
    };
    const hitTest = (e) => {
      if (!S.drawing || S.phase !== 'play') return;
      const r = stage.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * 100;
      const py = ((e.clientY - r.top) / r.height) * 100;
      for (const h of HAZARDS) {
        if (Math.abs(h.x - px) < 8 && Math.abs(h.y - py) < 8) { S.drawing = false; fail('碰到私心的坑'); return; }
      }
      NODES.forEach((n, i) => {
        if (!S.got.has(i) && Math.abs(n.x - px) < 9 && Math.abs(n.y - py) < 9) {
          S.got.add(i);
          sndGood();
          document.querySelector(`.os-node[data-i="${i}"]`).classList.add('os-got');
          if (S.got.size >= NODES.length) {
            S.phase = 'done';
            winAction('david_offering', '1CH', MINIGAMES.david_offering.win, ACTION_GAMES.david_offering);
          }
        }
      });
    };
    stage.onpointerdown = (e) => { S.drawing = true; hitTest(e); };
    stage.onpointermove = hitTest;
    stage.onpointerup = () => {
      if (!S.drawing) return;
      S.drawing = false;
      if (S.phase === 'play' && S.got.size > 0 && S.got.size < NODES.length) fail('中途放手了');
    };
  };

  // —— 🧱 聖殿拼圖：把建材拖到剪影上正確的位置，蓋回聖殿（拉 3-6）——
  ACTION_GAMES.ezra_temple = function startTemplePuzzle() {
    const PIECES = [
      { e: '🪨', n: '根基', x: 50, y: 86 }, { e: '🧱', n: '牆', x: 26, y: 62 },
      { e: '🏛️', n: '柱', x: 74, y: 62 }, { e: '🚪', n: '門', x: 50, y: 60 }, { e: '🔺', n: '殿頂', x: 50, y: 22 },
    ];
    const S = { phase: 'play', placed: 0, misses: 0, drag: null };
    const area = startAction('🧱 聖殿拼圖', 'EZR', null);
    action.state = S;
    area.innerHTML = `
      <p class="act-hint">把下面的建材<b>拖</b>到聖殿剪影上正確的位置——放錯 3 次仇敵就得逞了！</p>
      <div class="tp-stage" id="tp-stage">
        ${PIECES.map((p, i) => `<div class="tp-slot" data-i="${i}" style="left:${p.x}%;top:${p.y}%">${p.n}</div>`).join('')}
      </div>
      <div class="tp-tray" id="tp-tray">
        ${shuffleArr(PIECES.map((_, i) => i)).map((i) => `<button class="tp-piece act-tap" data-i="${i}">${PIECES[i].e}<small>${PIECES[i].n}</small></button>`).join('')}
      </div>
      <div class="act-row"><span>😈 攔阻</span><div class="act-track"><div class="act-fill act-foe" id="tp-foe"></div></div></div>`;
    const stage = $('#tp-stage');
    document.querySelectorAll('.tp-piece').forEach((btn) => {
      btn.onpointerdown = (e) => {
        if (S.phase !== 'play' || btn.disabled) return;
        e.preventDefault();
        S.drag = { i: Number(btn.dataset.i), btn };
        btn.classList.add('selected');
      };
    });
    const drop = (e) => {
      if (!S.drag || S.phase !== 'play') return;
      const d = S.drag;
      S.drag = null;
      d.btn.classList.remove('selected');
      const r = stage.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * 100;
      const py = ((e.clientY - r.top) / r.height) * 100;
      if (px < -5 || px > 105 || py < -5 || py > 105) return; // 放回原處不算錯
      const target = PIECES[d.i];
      if (Math.abs(target.x - px) < 16 && Math.abs(target.y - py) < 15) {
        const slot = document.querySelector(`.tp-slot[data-i="${d.i}"]`);
        slot.textContent = target.e;
        slot.classList.add('tp-done');
        d.btn.disabled = true;
        d.btn.style.opacity = .25;
        S.placed++;
        sndGood();
        if (S.placed >= PIECES.length) {
          S.phase = 'done';
          winAction('ezra_temple', 'EZR', MINIGAMES.ezra_temple.win, ACTION_GAMES.ezra_temple);
        }
      } else {
        S.misses++;
        sndBad();
        $('#tp-foe').style.width = `${(S.misses / 3) * 100}%`;
        stage.classList.remove('jr-shake'); void stage.offsetWidth; stage.classList.add('jr-shake');
        if (S.misses >= 3) {
          S.phase = 'done';
          loseAction('EZR', MINIGAMES.ezra_temple.lose.text, ACTION_GAMES.ezra_temple);
        }
      }
    };
    area.onpointerup = drop;
  };

  // —— ☀️ 凡事都有定時：指針繞著「時節轉盤」轉，轉到題目要的時節就按（傳 3）——
  ACTION_GAMES.ecc_sun = function startSeasonWheel() {
    const SECTORS = [
      { e: '🌱', n: '栽種' }, { e: '😄', n: '笑' }, { e: '💃', n: '跳舞' }, { e: '🔍', n: '尋找' },
      { e: '🤫', n: '靜默' }, { e: '🗣️', n: '言語' }, { e: '🧵', n: '縫補' }, { e: '😢', n: '哭' },
    ];
    const GOAL = 6;
    const S = { phase: 'play', hits: 0, misses: 0, ang: 0, target: 0, raf: 0 };
    const area = startAction('☀️ 凡事都有定時', 'ECC', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <p class="act-hint" id="sw-hint"></p>
      <div class="sw-wheel" id="sw-wheel">
        ${SECTORS.map((s, i) => { const a = i * 45 - 90; return `<div class="sw-sector" data-i="${i}" style="transform:translate(-50%,-50%) rotate(${a}deg) translate(96px) rotate(${-a}deg)">${s.e}<small>${s.n}</small></div>`; }).join('')}
        <div class="sw-needle" id="sw-needle">🕰️</div>
      </div>
      <div class="act-row"><span>⏳ 命中</span><div class="act-track"><div class="act-fill" id="sw-bar"></div></div><b id="sw-count">0/${GOAL}</b></div>
      <div class="act-row"><span>💔 失手</span><b id="sw-miss">—</b></div>
      <button class="big-btn act-tap" id="sw-btn">⏱️ 就是現在！</button>`;
    const newTarget = () => {
      S.target = Math.floor(Math.random() * 8);
      $('#sw-hint').innerHTML = `「凡事都有定期」——指針轉到 <b>${SECTORS[S.target].e} ${SECTORS[S.target].n}有時</b> 的瞬間按下去！`;
      document.querySelectorAll('.sw-sector').forEach((el, i) => el.classList.toggle('sw-target', i === S.target));
    };
    newTarget();
    $('#sw-btn').onclick = () => {
      if (S.phase !== 'play') return;
      const sector = Math.round((((S.ang % 360) + 360) % 360) / 45) % 8;
      if (sector === S.target) {
        S.hits++;
        sndGood();
        $('#sw-count').textContent = `${S.hits}/${GOAL}`;
        $('#sw-bar').style.width = `${(S.hits / GOAL) * 100}%`;
        if (S.hits >= GOAL) {
          S.phase = 'done';
          winAction('ecc_sun', 'ECC', MINIGAMES.ecc_sun.win, ACTION_GAMES.ecc_sun);
          return;
        }
        newTarget();
      } else {
        S.misses++;
        sndBad();
        $('#sw-miss').textContent = '💔'.repeat(S.misses);
        if (S.misses >= 3) {
          S.phase = 'done';
          loseAction('ECC', MINIGAMES.ecc_sun.lose.text, ACTION_GAMES.ecc_sun);
        }
      }
    };
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      S.ang += (2.1 + S.hits * 0.35) * (dt / 16.7);
      const el = $('#sw-needle'); if (el) el.style.transform = `translate(-50%, -100%) rotate(${S.ang}deg)`;
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🌅 守夜打更：光圈一波波收縮，縮到銅鑼上的瞬間敲下去，撐到天亮（哀 3:22-23）——
  ACTION_GAMES.lam_mercies = function startNightWatch() {
    const GOAL = 12;
    const S = { phase: 'play', beats: 0, misses: 0, t: 0, interval: 1000, tapped: false, raf: 0 };
    const area = startAction('🌅 守夜打更', 'LAM', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>🌙 更次</span><div class="act-track"><div class="act-fill" id="nw-bar"></div></div><b id="nw-count">0/${GOAL}</b></div>
      <div class="act-row"><span>💔 亂拍</span><b id="nw-miss">—</b></div>
      <div class="nw-stage act-tap" id="nw-stage"><div class="nw-ring" id="nw-ring"></div><div class="nw-gong">🔔</div></div>
      <p class="fr-tip">黑夜漫長，更夫要照著拍子敲更——光圈縮到銅鑼上的瞬間點下去！打滿 ${GOAL} 更就天亮了。（哀 3:22-23）</p>`;
    $('#nw-stage').onpointerdown = (e) => {
      e.preventDefault();
      if (S.phase !== 'play' || S.tapped) return;
      S.tapped = true;
      const p = S.t / S.interval;
      if (p >= 0.72) { // 光圈貼近銅鑼才算準
        S.beats++;
        sndGood();
        $('#nw-count').textContent = `${S.beats}/${GOAL}`;
        $('#nw-bar').style.width = `${(S.beats / GOAL) * 100}%`;
        if (S.beats >= GOAL) {
          S.phase = 'done';
          winAction('lam_mercies', 'LAM', MINIGAMES.lam_mercies.win, ACTION_GAMES.lam_mercies);
        }
      } else {
        S.misses++;
        sndBad();
        $('#nw-miss').textContent = '💔'.repeat(S.misses);
        if (S.misses >= 3) {
          S.phase = 'done';
          loseAction('LAM', MINIGAMES.lam_mercies.lose.text, ACTION_GAMES.lam_mercies);
        }
      }
    };
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      S.t += dt;
      if (S.t >= S.interval) { // 一拍結束：這拍沒敲＝漏拍
        if (!S.tapped) {
          S.misses++;
          sndBad();
          $('#nw-miss').textContent = '💔'.repeat(S.misses);
          if (S.misses >= 3) {
            S.phase = 'done';
            loseAction('LAM', MINIGAMES.lam_mercies.lose.text, ACTION_GAMES.lam_mercies);
            return;
          }
        }
        S.t = 0;
        S.tapped = false;
        S.interval = Math.max(700, 1000 - S.beats * 25);
      }
      const ring = $('#nw-ring');
      if (ring) {
        const sc = 2.4 - 1.4 * Math.min(1, S.t / S.interval);
        ring.style.transform = `translate(-50%, -50%) scale(${sc})`;
        ring.style.opacity = S.t / S.interval > 0.6 ? '1' : '.45';
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 💗 慈繩愛索：點擊旋轉管線，把「愛」一路接回「家」（何 11:4）——
  ACTION_GAMES.hosea_love = function startLoveLink() {
    // 路徑（2 列 × 4 行）：💗 → r0c0 ─ → r0c1 ┐ → r1c1 └ → r1c2 ─ → r1c3 ─ → 🏠
    // glyph 為 rot=0 時的樣子；sym=2 表示直線轉 180° 等價
    const TILES = [
      { r: 0, c: 0, glyph: '━', target: 0, sym: 2 },
      { r: 0, c: 1, glyph: '┓', target: 0, sym: 4 },
      { r: 1, c: 1, glyph: '┗', target: 0, sym: 4 },
      { r: 1, c: 2, glyph: '━', target: 0, sym: 2 },
      { r: 1, c: 3, glyph: '━', target: 0, sym: 2 },
    ];
    const LIMIT_MS = 45000;
    const S = { phase: 'play', t: 0, rots: TILES.map(() => 1 + Math.floor(Math.random() * 3)), raf: 0 };
    const area = startAction('💗 慈繩愛索', 'HOS', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <p class="act-hint">點方塊會旋轉——把繩索一段段接通，讓「愛」牽回「家」！（我用慈繩愛索牽引他們，何 11:4）</p>
      <div class="lk-stage" id="lk-stage">
        <div class="lk-end" style="left:2%;top:25%">💗</div>
        ${TILES.map((t, i) => `<button class="lk-tile act-tap" data-i="${i}" style="left:${14 + t.c * 20}%;top:${t.r * 50 + 8}%"><span>${t.glyph}</span></button>`).join('')}
        <div class="lk-end" style="left:92%;top:75%">🏠</div>
      </div>
      <div class="act-row"><span>⏳ 時間</span><div class="act-track"><div class="act-fill act-foe" id="lk-time"></div></div></div>`;
    const render = () => {
      document.querySelectorAll('.lk-tile span').forEach((el, i) => {
        el.style.transform = `rotate(${S.rots[i] * 90}deg)`;
        el.parentElement.classList.toggle('lk-ok', S.rots[i] % TILES[i].sym === TILES[i].target);
      });
    };
    render();
    document.querySelectorAll('.lk-tile').forEach((b) => {
      b.onclick = () => {
        if (S.phase !== 'play') return;
        const i = Number(b.dataset.i);
        S.rots[i] = (S.rots[i] + 1) % 4;
        render();
        if (TILES.every((t, k) => S.rots[k] % t.sym === t.target)) {
          S.phase = 'done';
          sndGood();
          winAction('hosea_love', 'HOS', MINIGAMES.hosea_love.win, ACTION_GAMES.hosea_love);
        }
      };
    });
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      S.t += dt;
      $('#lk-time').style.width = `${Math.min(100, (S.t / LIMIT_MS) * 100)}%`;
      if (S.t >= LIMIT_MS) {
        S.phase = 'done';
        loseAction('HOS', MINIGAMES.hosea_love.lose.text, ACTION_GAMES.hosea_love);
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🏞️ 敲通公義河道：連續敲擊把堵住河道的巨石敲碎，旱季結束前讓江河滔滔（摩 5:24）——
  ACTION_GAMES.amos_river = function startRiverRocks() {
    const ROCKS = 8, HITS = 4, LIMIT_MS = 45000;
    const S = { phase: 'play', broken: 0, t: 0, hp: [], raf: 0 };
    const area = startAction('🏞️ 敲通公義河道', 'AMO', () => cancelAnimationFrame(S.raf));
    action.state = S;
    let html = '';
    for (let i = 0; i < ROCKS; i++) {
      const x = 12 + (i % 4) * 24 + Math.random() * 6;
      const y = 18 + Math.floor(i / 4) * 42 + Math.random() * 10;
      html += `<button class="rr-rock act-tap" data-i="${i}" style="left:${x}%;top:${y}%">🪨</button>`;
      S.hp.push(HITS);
    }
    area.innerHTML = `
      <div class="act-row"><span>⛏️ 敲碎</span><div class="act-track"><div class="act-fill" id="rr-bar"></div></div><b id="rr-count">0/${ROCKS}</b></div>
      <div class="act-row"><span>🌵 旱季</span><div class="act-track"><div class="act-fill act-foe" id="rr-time"></div></div></div>
      <div class="rr-stage" id="rr-stage">${html}<div class="rr-water" id="rr-water">🌊</div></div>
      <p class="fr-tip">河道被不義的巨石堵住了——每顆石頭敲 ${HITS} 下就碎！旱季結束前全部敲通，公義就如江河滔滔。（摩 5:24）</p>`;
    document.querySelectorAll('.rr-rock').forEach((b) => {
      b.onclick = () => {
        if (S.phase !== 'play') return;
        const i = Number(b.dataset.i);
        if (S.hp[i] <= 0) return;
        S.hp[i]--;
        b.style.transform = `translate(-50%,-50%) scale(${0.55 + (S.hp[i] / HITS) * 0.45})`;
        if (S.hp[i] === 1) b.textContent = '🪨💥';
        if (S.hp[i] <= 0) {
          b.textContent = '💦';
          b.disabled = true;
          S.broken++;
          sndGood();
          $('#rr-count').textContent = `${S.broken}/${ROCKS}`;
          $('#rr-bar').style.width = `${(S.broken / ROCKS) * 100}%`;
          $('#rr-water').style.width = `${(S.broken / ROCKS) * 100}%`;
          if (S.broken >= ROCKS) {
            S.phase = 'done';
            winAction('amos_river', 'AMO', MINIGAMES.amos_river.win, ACTION_GAMES.amos_river);
          }
        }
      };
    });
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      S.t += dt;
      $('#rr-time').style.width = `${Math.min(100, (S.t / LIMIT_MS) * 100)}%`;
      if (S.t >= LIMIT_MS) {
        S.phase = 'done';
        loseAction('AMO', MINIGAMES.amos_river.lose.text, ACTION_GAMES.amos_river);
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— ⛰️ 驕傲必墜：以東的高牆崩塌，左右移動閃開墜落的碎石，站穩到底（俄 3-4）——
  ACTION_GAMES.obadiah_pride = function startDodge() {
    const GOAL = 15, LANES = [14, 32, 50, 68, 86];
    const S = { phase: 'play', dodged: 0, hits: 0, lane: 2, rocks: [], sinceRock: 600, raf: 0 };
    const area = startAction('⛰️ 驕傲必墜', 'OBA', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>🪨 躲過</span><div class="act-track"><div class="act-fill" id="dg-bar"></div></div><b id="dg-count">0/${GOAL}</b></div>
      <div class="act-row"><span>💚 平安</span><b id="dg-hearts">💚💚💚</b></div>
      <div class="dg-stage" id="dg-stage"><div class="dg-player" id="dg-player">🧍</div></div>
      <div class="st-btns">
        <button class="big-btn act-tap" id="dg-left">◀️ 往左</button>
        <button class="big-btn act-tap" id="dg-right">往右 ▶️</button>
      </div>
      <p class="fr-tip">「你雖如大鷹高飛……我必從那裏拉下你來」——驕傲的高牆塌了，看準落點左右閃避！（俄 4）</p>`;
    const setLane = (d) => {
      if (S.phase !== 'play') return;
      S.lane = Math.max(0, Math.min(4, S.lane + d));
      $('#dg-player').style.left = `${LANES[S.lane]}%`;
    };
    $('#dg-left').onclick = () => setLane(-1);
    $('#dg-right').onclick = () => setLane(1);
    $('#dg-player').style.left = `${LANES[2]}%`;
    const stage = $('#dg-stage');
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      const f = dt / 16.7;
      S.sinceRock += dt;
      const interval = Math.max(650, 1100 - S.dodged * 28);
      if (S.sinceRock >= interval) {
        S.sinceRock = 0;
        const lane = Math.random() < 0.55 ? S.lane : Math.floor(Math.random() * 5); // 過半瞄準玩家
        const el = document.createElement('div');
        el.className = 'dg-rock';
        el.textContent = '🪨';
        el.style.left = `${LANES[lane]}%`;
        stage.appendChild(el);
        S.rocks.push({ lane, y: -8, el, judged: false });
      }
      for (let i = S.rocks.length - 1; i >= 0; i--) {
        const g = S.rocks[i];
        g.y += (0.72 + S.dodged * 0.02) * f;
        g.el.style.top = `${g.y}%`;
        if (!g.judged && g.y >= 80) {
          g.judged = true;
          if (g.lane === S.lane) {
            S.hits++;
            sndBad();
            stage.classList.remove('jr-shake'); void stage.offsetWidth; stage.classList.add('jr-shake');
            $('#dg-hearts').textContent = '💚'.repeat(Math.max(0, 3 - S.hits)) || '…';
            if (S.hits >= 3) {
              S.phase = 'done';
              loseAction('OBA', MINIGAMES.obadiah_pride.lose.text, ACTION_GAMES.obadiah_pride);
              return;
            }
          } else {
            S.dodged++;
            sndGood();
            $('#dg-count').textContent = `${S.dodged}/${GOAL}`;
            $('#dg-bar').style.width = `${(S.dodged / GOAL) * 100}%`;
            if (S.dodged >= GOAL) {
              S.phase = 'done';
              winAction('obadiah_pride', 'OBA', MINIGAMES.obadiah_pride.win, ACTION_GAMES.obadiah_pride);
              return;
            }
          }
        }
        if (g.y > 104) { g.el.remove(); S.rocks.splice(i, 1); }
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— ⚖️ 與神同行三重奏：公義/憐憫/謙卑三軌音符落下，落到判定線時按對應鍵（彌 6:8）——
  ACTION_GAMES.micah_walk = function startTrioLanes() {
    const GOAL = 15, LANES = [{ e: '⚖️', n: '公義' }, { e: '💗', n: '憐憫' }, { e: '🙇', n: '謙卑' }];
    const S = { phase: 'play', hit: 0, misses: 0, notes: [], sinceNote: 700, raf: 0 };
    const area = startAction('⚖️ 與神同行三重奏', 'MIC', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>🎵 接住</span><div class="act-track"><div class="act-fill" id="tl-bar"></div></div><b id="tl-count">0/${GOAL}</b></div>
      <div class="act-row"><span>💔 漏接</span><b id="tl-miss">—</b></div>
      <div class="tl-stage" id="tl-stage"><div class="tl-line"></div></div>
      <div class="st-btns">
        ${LANES.map((l, i) => `<button class="big-btn act-tap" data-l="${i}">${l.e}<br><small>${l.n}</small></button>`).join('')}
      </div>
      <p class="fr-tip">行公義、好憐憫、存謙卑的心——音符落到白線的瞬間，按下同一軌的鍵！（彌 6:8）</p>`;
    const stage = $('#tl-stage');
    const laneX = (l) => 20 + l * 30;
    document.querySelectorAll('#action-area .st-btns .big-btn').forEach((b) => {
      b.onclick = () => {
        if (S.phase !== 'play') return;
        const l = Number(b.dataset.l);
        const note = S.notes.find((n) => !n.judged && n.lane === l && n.y >= 68 && n.y <= 92);
        if (note) {
          note.judged = true;
          note.el.textContent = '✨';
          setTimeout(() => note.el.remove(), 200);
          S.hit++;
          sndGood();
          $('#tl-count').textContent = `${S.hit}/${GOAL}`;
          $('#tl-bar').style.width = `${(S.hit / GOAL) * 100}%`;
          if (S.hit >= GOAL) {
            S.phase = 'done';
            winAction('micah_walk', 'MIC', MINIGAMES.micah_walk.win, ACTION_GAMES.micah_walk);
          }
        }
      };
    });
    const miss = () => {
      S.misses++;
      sndBad();
      $('#tl-miss').textContent = '💔'.repeat(S.misses);
      if (S.misses >= 4) {
        S.phase = 'done';
        loseAction('MIC', MINIGAMES.micah_walk.lose.text, ACTION_GAMES.micah_walk);
      }
    };
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      const f = dt / 16.7;
      S.sinceNote += dt;
      const interval = Math.max(820, 1350 - S.hit * 32);
      if (S.sinceNote >= interval) {
        S.sinceNote = 0;
        const lane = Math.floor(Math.random() * 3);
        const el = document.createElement('div');
        el.className = 'tl-note';
        el.textContent = LANES[lane].e;
        el.style.left = `${laneX(lane)}%`;
        stage.appendChild(el);
        S.notes.push({ lane, y: -8, el, judged: false });
      }
      for (let i = S.notes.length - 1; i >= 0; i--) {
        const n = S.notes[i];
        n.y += (0.55 + S.hit * 0.014) * f;
        n.el.style.top = `${n.y}%`;
        if (!n.judged && n.y > 92) { n.judged = true; n.el.remove(); S.notes.splice(i, 1); miss(); continue; }
        if (n.y > 104) { n.el.remove(); S.notes.splice(i, 1); }
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🏰 保障開門：來的是投靠的人就開門、是風暴碎片就緊閉，救進 8 個人（鴻 1:7）——
  ACTION_GAMES.nahum_refuge = function startGatekeeper() {
    const GOAL = 8, PEOPLE = ['🧎', '🙍', '👵', '🧒'], DEBRIS = ['🌪️', '🪨', '🔥'];
    const S = { phase: 'play', saved: 0, misses: 0, cur: null, x: 104, doorOpen: false, raf: 0 };
    const area = startAction('🏰 保障開門', 'NAM', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>🏰 救進</span><div class="act-track"><div class="act-fill" id="gk-bar"></div></div><b id="gk-count">0/${GOAL}</b></div>
      <div class="act-row"><span>💔 失誤</span><b id="gk-miss">—</b></div>
      <div class="gk-stage" id="gk-stage"><div class="gk-door" id="gk-door">🚪</div><div class="gk-comer" id="gk-comer"></div></div>
      <button class="big-btn act-tap" id="gk-btn">🔓 按住開門</button>
      <p class="fr-tip">「耶和華認得那些投靠他的人」——是人就開門收留、是風暴碎片就緊閉大門！（鴻 1:7）</p>`;
    const newComer = () => {
      const isPerson = Math.random() < 0.55;
      S.cur = { isPerson, e: isPerson ? PEOPLE[Math.floor(Math.random() * PEOPLE.length)] : DEBRIS[Math.floor(Math.random() * DEBRIS.length)] };
      S.x = 104;
      $('#gk-comer').textContent = S.cur.e;
    };
    newComer();
    const btn = $('#gk-btn');
    btn.onpointerdown = (e) => { e.preventDefault(); S.doorOpen = true; $('#gk-door').textContent = '🔓'; };
    const shut = () => { S.doorOpen = false; $('#gk-door').textContent = '🚪'; };
    btn.onpointerup = shut;
    btn.onpointerleave = shut;
    const miss = (why) => {
      S.misses++;
      sndBad();
      $('#gk-miss').textContent = '💔'.repeat(S.misses);
      if (S.misses >= 3) {
        S.phase = 'done';
        loseAction('NAM', MINIGAMES.nahum_refuge.lose.text, ACTION_GAMES.nahum_refuge);
        return;
      }
      newComer();
    };
    S.tick = (dt) => {
      if (S.phase !== 'play' || !S.cur) return;
      const f = dt / 16.7;
      S.x -= (0.55 + S.saved * 0.05) * f;
      $('#gk-comer').style.left = `${S.x}%`;
      if (S.x <= 16) { // 到門口：看門開著沒
        if (S.cur.isPerson === S.doorOpen) {
          if (S.cur.isPerson) {
            S.saved++;
            sndGood();
            $('#gk-count').textContent = `${S.saved}/${GOAL}`;
            $('#gk-bar').style.width = `${(S.saved / GOAL) * 100}%`;
            if (S.saved >= GOAL) {
              S.phase = 'done';
              winAction('nahum_refuge', 'NAM', MINIGAMES.nahum_refuge.win, ACTION_GAMES.nahum_refuge);
              return;
            }
          } else sndGood(); // 碎片撞上緊閉的門＝擋下
          newComer();
        } else {
          miss(S.cur.isPerson ? '門關著，投靠的人進不來' : '門開著，風暴打進保障');
        }
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🎵 跟著祂的歌聲：歌聲的旋律線流過來，手指貼著線走，唱滿整首歌（番 3:17）——
  ACTION_GAMES.zeph_song = function startTraceSong() {
    const NEED_MS = 12000, TOL = 15; // 貼線累計 12 秒；容差 ±15%
    const S = { phase: 'play', on: 0, t: 0, py: null, raf: 0 };
    const area = startAction('🎵 跟著祂的歌聲', 'ZEP', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>🎶 同唱</span><div class="act-track"><div class="act-fill" id="ts-bar"></div></div></div>
      <div class="ts-stage" id="ts-stage"><div class="ts-dot" id="ts-dot">🎵</div><div class="ts-finger" id="ts-finger">👆</div></div>
      <p class="fr-tip">「祂必因你喜樂而歡呼」——手指按住畫面，跟著流動的音符上下移動，貼著歌聲走！（番 3:17）</p>`;
    const stage = $('#ts-stage');
    stage.onpointerdown = (e) => { track(e); };
    stage.onpointermove = (e) => { if (e.buttons || e.pressure > 0) track(e); };
    stage.onpointerup = () => { S.py = null; $('#ts-finger').style.opacity = '.3'; };
    const track = (e) => {
      const r = stage.getBoundingClientRect();
      S.py = ((e.clientY - r.top) / r.height) * 100;
      const fg = $('#ts-finger');
      fg.style.top = `${S.py}%`;
      fg.style.opacity = '1';
    };
    const lineY = (t) => 50 + Math.sin(t / 900) * 26 + Math.sin(t / 2300) * 10; // 起伏的旋律線
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      S.t += dt;
      const y = lineY(S.t);
      $('#ts-dot').style.top = `${y}%`;
      if (S.py !== null && Math.abs(S.py - y) <= TOL) {
        S.on += dt;
        $('#ts-bar').style.width = `${Math.min(100, (S.on / NEED_MS) * 100)}%`;
        if (S.on >= NEED_MS) {
          S.phase = 'done';
          winAction('zeph_song', 'ZEP', MINIGAMES.zeph_song.win, ACTION_GAMES.zeph_song);
          return;
        }
      }
      if (S.t >= 40000) { // 40 秒還沒唱滿＝跟丟了
        S.phase = 'done';
        loseAction('ZEP', MINIGAMES.zeph_song.lose.text, ACTION_GAMES.zeph_song);
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🔨 上山拋木：往上一甩把木料拋進殿的框架，框架會左右移動（該 1:8）——
  ACTION_GAMES.haggai_build = function startLogToss() {
    const GOAL = 6, LIMIT_MS = 60000;
    const S = { phase: 'play', landed: 0, t: 0, frameX: 50, frameDir: 1, log: null, downAt: null, raf: 0 };
    const area = startAction('🔨 上山拋木', 'HAG', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>🪵 拋進</span><div class="act-track"><div class="act-fill" id="lg-bar"></div></div><b id="lg-count">0/${GOAL}</b></div>
      <div class="act-row"><span>🌧️ 冬雨</span><div class="act-track"><div class="act-fill act-foe" id="lg-time"></div></div></div>
      <div class="lg-stage" id="lg-stage">
        <div class="lg-frame" id="lg-frame">🏗️</div>
        <div class="lg-log" id="lg-log">🪵</div>
      </div>
      <p class="fr-tip">「你們要上山取木料，建造這殿」——按住木料往上一甩！甩的方向決定落點，把 ${GOAL} 根拋進移動的框架。（該 1:8）</p>`;
    const stage = $('#lg-stage');
    stage.onpointerdown = (e) => {
      if (S.phase !== 'play' || S.log) return;
      const r = stage.getBoundingClientRect();
      S.downAt = { x: e.clientX, y: e.clientY, r };
    };
    stage.onpointerup = (e) => {
      if (S.phase !== 'play' || !S.downAt || S.log) return;
      const d = S.downAt;
      S.downAt = null;
      const dy = d.y - e.clientY;
      if (dy < 30) return; // 要往上甩才算
      const dx = e.clientX - d.x;
      const targetX = 50 + (dx / d.r.width) * 160; // 甩的橫向幅度決定落點
      S.log = { x: 50, y: 86, tx: Math.max(6, Math.min(94, targetX)), vy: -4.2 };
    };
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      const f = dt / 16.7;
      S.t += dt;
      $('#lg-time').style.width = `${Math.min(100, (S.t / LIMIT_MS) * 100)}%`;
      if (S.t >= LIMIT_MS) {
        S.phase = 'done';
        loseAction('HAG', MINIGAMES.haggai_build.lose.text, ACTION_GAMES.haggai_build);
        return;
      }
      S.frameX += S.frameDir * 0.25 * f;
      if (S.frameX >= 82) { S.frameX = 82; S.frameDir = -1; }
      if (S.frameX <= 18) { S.frameX = 18; S.frameDir = 1; }
      $('#lg-frame').style.left = `${S.frameX}%`;
      const log = $('#lg-log');
      if (S.log) {
        S.log.vy += 0.12 * f; // 重力
        S.log.y += S.log.vy * f;
        S.log.x += (S.log.tx - S.log.x) * 0.06 * f; // 逐漸飄向瞄準的落點
        log.style.left = `${S.log.x}%`;
        log.style.top = `${S.log.y}%`;
        if (S.log.vy > 0 && S.log.y >= 16 && S.log.y <= 26) { // 到框架高度：判定
          if (Math.abs(S.log.x - S.frameX) <= 10) {
            S.landed++;
            sndGood();
            $('#lg-count').textContent = `${S.landed}/${GOAL}`;
            $('#lg-bar').style.width = `${(S.landed / GOAL) * 100}%`;
            S.log = null;
            log.style.left = '50%';
            log.style.top = '86%';
            if (S.landed >= GOAL) {
              S.phase = 'done';
              winAction('haggai_build', 'HAG', MINIGAMES.haggai_build.win, ACTION_GAMES.haggai_build);
              return;
            }
            return;
          }
        }
        if (S.log.y > 92) { // 掉回地上
          sndBad();
          S.log = null;
          log.style.left = '50%';
          log.style.top = '86%';
        }
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— ⛓️ 衝破阻隔：七道牆（羅 8:35）擋在你和神的愛之間，照箭頭方向快滑撕開 ——
  ACTION_GAMES.rom_love = function startBreakWalls() {
    const WALLS = ['患難', '困苦', '逼迫', '飢餓', '赤身露體', '危險', '刀劍']; // 羅 8:35 七樣
    const ARROWS = [{ e: '⬆️', dx: 0, dy: -1 }, { e: '⬇️', dx: 0, dy: 1 }, { e: '⬅️', dx: -1, dy: 0 }, { e: '➡️', dx: 1, dy: 0 }];
    const S = { phase: 'play', at: 0, misses: 0, arrow: 0, t: 0, limit: 3200, raf: 0 };
    const area = startAction('⛓️ 衝破阻隔', 'ROM', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>💪 衝破</span><div class="act-track"><div class="act-fill" id="bw-bar"></div></div><b id="bw-count">0/${WALLS.length}</b></div>
      <div class="act-row"><span>💔 失手</span><b id="bw-miss">—</b></div>
      <div class="bw-stage" id="bw-stage"><div class="bw-wall" id="bw-wall"></div><div class="bw-arrow" id="bw-arrow"></div><div class="bw-timer"><div class="act-fill act-foe" id="bw-time"></div></div></div>
      <p class="fr-tip">「誰能使我們與基督的愛隔絕呢？」——每道牆出現時，照箭頭方向<b>快滑</b>撕開它！（羅 8:35-37）</p>`;
    const newWall = () => {
      S.arrow = Math.floor(Math.random() * 4);
      S.t = 0;
      S.limit = Math.max(1900, 3200 - S.at * 200);
      $('#bw-wall').textContent = `🧱 ${WALLS[S.at]}`;
      $('#bw-arrow').textContent = ARROWS[S.arrow].e;
    };
    newWall();
    const miss = (why) => {
      S.misses++;
      sndBad();
      $('#bw-miss').textContent = '💔'.repeat(S.misses);
      if (S.misses >= 3) {
        S.phase = 'done';
        loseAction('ROM', MINIGAMES.rom_love.lose.text, ACTION_GAMES.rom_love);
        return;
      }
      newWall();
    };
    S.swipe = (dx, dy) => {
      if (S.phase !== 'play') return;
      const a = ARROWS[S.arrow];
      const ok = (a.dx !== 0 && Math.sign(dx) === a.dx && Math.abs(dx) > Math.abs(dy)) ||
                 (a.dy !== 0 && Math.sign(dy) === a.dy && Math.abs(dy) > Math.abs(dx));
      if (ok) {
        S.at++;
        sndGood();
        $('#bw-count').textContent = `${S.at}/${WALLS.length}`;
        $('#bw-bar').style.width = `${(S.at / WALLS.length) * 100}%`;
        if (S.at >= WALLS.length) {
          S.phase = 'done';
          winAction('rom_love', 'ROM', MINIGAMES.rom_love.win, ACTION_GAMES.rom_love);
          return;
        }
        newWall();
      } else miss('滑錯方向');
    };
    const stage = $('#bw-stage');
    let down = null;
    stage.onpointerdown = (e) => { down = { x: e.clientX, y: e.clientY }; };
    stage.onpointerup = (e) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down = null;
      if (Math.abs(dx) >= 30 || Math.abs(dy) >= 30) S.swipe(dx, dy);
    };
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      S.t += dt;
      const el = $('#bw-time'); if (el) el.style.width = `${Math.min(100, (S.t / S.limit) * 100)}%`;
      if (S.t >= S.limit) miss('猶豫太久，牆更厚了');
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 💞 有愛才算數：是「愛的樣子」就點、是鳴鑼響鈸就忍住不點（林前 13）——
  ACTION_GAMES.cor_love = function startGoNoGo() {
    const LOVE = ['恆久忍耐', '有恩慈', '不嫉妒', '不自誇', '凡事包容', '凡事相信', '凡事盼望', '凡事忍耐', '只喜歡真理'];
    const NOISE = ['🔔 鳴的鑼', '🥁 響的鈸', '張狂', '自誇', '輕易發怒', '計算人的惡'];
    const GOAL = 12;
    const S = { phase: 'play', got: 0, misses: 0, cur: null, t: 0, limit: 1900, raf: 0 };
    const area = startAction('💞 有愛才算數', '1CO', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>💞 收集</span><div class="act-track"><div class="act-fill" id="gn-bar"></div></div><b id="gn-count">0/${GOAL}</b></div>
      <div class="act-row"><span>💔 失誤</span><b id="gn-miss">—</b></div>
      <div class="gn-stage act-tap" id="gn-stage"><div class="gn-chip" id="gn-chip"></div></div>
      <p class="fr-tip">出現「愛的樣子」就快點收下；跳出 🔔 鳴鑼 🥁 響鈸這些「沒有愛的」就<b>忍住別點</b>，讓它自己消失！（林前 13）</p>`;
    const newChip = () => {
      const isLove = Math.random() < 0.6;
      S.cur = { isLove, done: false };
      S.t = 0;
      S.limit = Math.max(1150, 1900 - S.got * 65);
      const chip = $('#gn-chip');
      chip.textContent = isLove ? `💞 ${LOVE[Math.floor(Math.random() * LOVE.length)]}` : NOISE[Math.floor(Math.random() * NOISE.length)];
      chip.className = 'gn-chip' + (isLove ? ' gn-love' : ' gn-noise');
    };
    newChip();
    const miss = () => {
      S.misses++;
      sndBad();
      $('#gn-miss').textContent = '💔'.repeat(S.misses);
      if (S.misses >= 3) {
        S.phase = 'done';
        loseAction('1CO', MINIGAMES.cor_love.lose.text, ACTION_GAMES.cor_love);
        return;
      }
      newChip();
    };
    const gain = () => {
      S.got++;
      sndGood();
      $('#gn-count').textContent = `${S.got}/${GOAL}`;
      $('#gn-bar').style.width = `${(S.got / GOAL) * 100}%`;
      if (S.got >= GOAL) {
        S.phase = 'done';
        winAction('cor_love', '1CO', MINIGAMES.cor_love.win, ACTION_GAMES.cor_love);
        return;
      }
      newChip();
    };
    $('#gn-stage').onpointerdown = (e) => {
      e.preventDefault();
      if (S.phase !== 'play' || !S.cur || S.cur.done) return;
      S.cur.done = true;
      if (S.cur.isLove) gain(); else miss(); // 點到鑼鈸＝失誤
    };
    S.tick = (dt) => {
      if (S.phase !== 'play' || !S.cur || S.cur.done) return;
      S.t += dt;
      if (S.t >= S.limit) {
        S.cur.done = true;
        if (S.cur.isLove) miss(); // 愛的樣子沒收到＝失誤
        else { sndGood(); newChip(); } // 鑼鈸自己消失＝忍住成功
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 😊 三樣不斷：喜樂/禱告/謝恩三個錶會一直流失，輪流補滿撐 30 秒（帖前 5:16-18）——
  ACTION_GAMES.thes_joy = function startThreeMeters() {
    const SURVIVE_MS = 30000;
    const M = [{ e: '😊', n: '喜樂' }, { e: '🙏', n: '禱告' }, { e: '🙌', n: '謝恩' }];
    const S = { phase: 'play', t: 0, v: [80, 80, 80], raf: 0 };
    const area = startAction('😊 三樣不斷', '1TH', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>⏱️ 撐住</span><div class="act-track"><div class="act-fill" id="tm-time"></div></div></div>
      ${M.map((m, i) => `<div class="act-row"><span>${m.e} ${m.n}</span><div class="act-track"><div class="act-fill" id="tm-${i}"></div></div></div>`).join('')}
      <div class="st-btns">
        ${M.map((m, i) => `<button class="big-btn act-tap" data-m="${i}">${m.e}<br><small>${m.n}</small></button>`).join('')}
      </div>
      <p class="fr-tip">「要常常喜樂，不住的禱告，凡事謝恩」——三條都會一直流失，看哪條快見底就補哪條，一條歸零就前功盡棄！</p>`;
    document.querySelectorAll('#action-area .st-btns .big-btn').forEach((b) => {
      b.onclick = () => {
        if (S.phase !== 'play') return;
        const i = Number(b.dataset.m);
        S.v[i] = Math.min(100, S.v[i] + 26);
        sndGood();
      };
    });
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      const f = dt / 16.7;
      S.t += dt;
      const drain = 0.28 + (S.t / SURVIVE_MS) * 0.34; // 越後面流失越快
      for (let i = 0; i < 3; i++) {
        S.v[i] -= drain * (0.8 + i * 0.18) * f; // 三條速度略不同，逼你轉頭顧
        const el = $(`#tm-${i}`); if (el) el.style.width = `${Math.max(0, S.v[i])}%`;
        if (S.v[i] <= 0) {
          S.phase = 'done';
          loseAction('1TH', MINIGAMES.thes_joy.lose.text, ACTION_GAMES.thes_joy);
          return;
        }
      }
      $('#tm-time').style.width = `${Math.min(100, (S.t / SURVIVE_MS) * 100)}%`;
      if (S.t >= SURVIVE_MS) {
        S.phase = 'done';
        winAction('thes_joy', '1TH', MINIGAMES.thes_joy.win, ACTION_GAMES.thes_joy);
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🏆 三段接力：打仗（連點）→ 跑路（左右交替）→ 守道（長按到底），一口氣完成（提後 4:7）——
  ACTION_GAMES.tim_fight = function startMedley() {
    const S = { phase: 'fight', power: 0, step: 0, lastFoot: null, hold: 0, holdFail: 0, raf: 0, holding: false };
    const area = startAction('🏆 三段接力', '2TI', () => cancelAnimationFrame(S.raf));
    action.state = S;
    const render = () => {
      if (S.phase === 'fight') {
        area.innerHTML = `
          <p class="act-hint">第一段：<b>那美好的仗</b>——快速連點出拳，把鬥志條打滿！</p>
          <div class="act-row"><span>🥊 鬥志</span><div class="act-track"><div class="act-fill" id="md-bar"></div></div></div>
          <button class="big-btn act-tap" id="md-btn">🥊 出拳！</button>`;
        $('#md-btn').onclick = () => {
          if (S.phase !== 'fight') return;
          S.power = Math.min(100, S.power + 7);
          if (S.power >= 100) { S.phase = 'run'; sndGood(); render(); }
        };
      } else if (S.phase === 'run') {
        area.innerHTML = `
          <p class="act-hint">第二段：<b>當跑的路</b>——左右腳交替點，跑滿 20 步！（同腳連點無效）</p>
          <div class="act-row"><span>🏃 步數</span><div class="act-track"><div class="act-fill" id="md-bar"></div></div><b id="md-count">0/20</b></div>
          <div class="st-btns">
            <button class="big-btn act-tap" id="md-l">🦶 左腳</button>
            <button class="big-btn act-tap" id="md-r">右腳 🦶</button>
          </div>`;
        const stepFoot = (foot) => {
          if (S.phase !== 'run' || S.lastFoot === foot) return;
          S.lastFoot = foot;
          S.step++;
          $('#md-count').textContent = `${S.step}/20`;
          $('#md-bar').style.width = `${(S.step / 20) * 100}%`;
          if (S.step >= 20) { S.phase = 'keep'; sndGood(); render(); }
        };
        $('#md-l').onclick = () => stepFoot('L');
        $('#md-r').onclick = () => stepFoot('R');
      } else if (S.phase === 'keep') {
        area.innerHTML = `
          <p class="act-hint">最後一段：<b>所信的道</b>——按住不放守滿 8 秒！世界會誘惑你鬆手，別上當。</p>
          <div class="act-row"><span>🛡️ 持守</span><div class="act-track"><div class="act-fill" id="md-bar"></div></div></div>
          <p class="act-hint" id="md-tempt" style="color:#ff4b4b"></p>
          <button class="big-btn act-tap" id="md-btn">🙏 按住守道</button>`;
        const btn = $('#md-btn');
        btn.onpointerdown = (e) => { e.preventDefault(); S.holding = true; };
        const rel = () => {
          if (S.phase !== 'keep' || !S.holding) return;
          S.holding = false;
          S.hold = 0;
          S.holdFail++;
          sndBad();
          $('#md-tempt').textContent = S.holdFail >= 3 ? '' : '鬆手了！重新按住，從頭守起…';
          if (S.holdFail >= 3) {
            S.phase = 'done';
            loseAction('2TI', MINIGAMES.tim_fight.lose.text, ACTION_GAMES.tim_fight);
          }
        };
        btn.onpointerup = rel;
        btn.onpointerleave = rel;
      }
    };
    render();
    const TEMPTS = ['💰 底馬貪愛現今的世界…', '🛋️ 休息一下沒關係吧？', '🌆 大家都鬆手了喔…'];
    S.tick = (dt) => {
      if (S.phase === 'fight') {
        S.power = Math.max(0, S.power - 0.5 * (dt / 16.7)); // 不打就洩氣
        const el = $('#md-bar'); if (el) el.style.width = `${S.power}%`;
      } else if (S.phase === 'keep' && S.holding) {
        S.hold += dt;
        const el = $('#md-bar'); if (el) el.style.width = `${Math.min(100, (S.hold / 8000) * 100)}%`;
        const t = $('#md-tempt'); if (t) t.textContent = TEMPTS[Math.floor(S.hold / 2700) % TEMPTS.length];
        if (S.hold >= 8000) {
          S.phase = 'done';
          winAction('tim_fight', '2TI', MINIGAMES.tim_fight.win, ACTION_GAMES.tim_fight);
        }
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase !== 'done') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— ☁️ 信心之橋：橋是「未見之事」——走到邊緣的瞬間點一下，腳下的橋板就顯出來（來 11:1）——
  ACTION_GAMES.faith_cloud = function startFaithBridge() {
    const GOAL = 10;
    const S = { phase: 'play', tile: 0, misses: 0, x: 6, raf: 0 };
    const area = startAction('☁️ 信心之橋', 'HEB', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>🌉 橋板</span><div class="act-track"><div class="act-fill" id="fb-bar"></div></div><b id="fb-count">0/${GOAL}</b></div>
      <div class="act-row"><span>💔 踏空</span><b id="fb-miss">—</b></div>
      <div class="fb-stage act-tap" id="fb-stage">
        <div class="fb-walker" id="fb-walker">🚶</div>
        ${Array.from({ length: GOAL }, (_, i) => `<div class="fb-tile" data-i="${i}" style="left:${14 + i * 8.6}%"></div>`).join('')}
      </div>
      <p class="fr-tip">「信就是所望之事的實底，是未見之事的確據」——橋板是看不見的！走到虛線邊緣的瞬間點一下，板子就在腳下顯出來。（來 11:1）</p>`;
    const stage = $('#fb-stage');
    stage.onpointerdown = (e) => {
      e.preventDefault();
      if (S.phase !== 'play') return;
      const edge = 14 + S.tile * 8.6; // 下一塊橋板的位置
      if (Math.abs(S.x - (edge - 4)) <= 3.2) { // 在邊緣的時機窗內
        const t = document.querySelector(`.fb-tile[data-i="${S.tile}"]`);
        t.classList.add('fb-solid');
        S.tile++;
        sndGood();
        $('#fb-count').textContent = `${S.tile}/${GOAL}`;
        $('#fb-bar').style.width = `${(S.tile / GOAL) * 100}%`;
        if (S.tile >= GOAL) {
          S.phase = 'done';
          winAction('faith_cloud', 'HEB', MINIGAMES.faith_cloud.win, ACTION_GAMES.faith_cloud);
        }
      } else {
        S.misses++;
        sndBad();
        $('#fb-miss').textContent = '💔'.repeat(S.misses);
        if (S.misses >= 3) {
          S.phase = 'done';
          loseAction('HEB', MINIGAMES.faith_cloud.lose.text, ACTION_GAMES.faith_cloud);
        }
      }
    };
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      const f = dt / 16.7;
      S.x += (0.24 + S.tile * 0.012) * f;
      const edge = 14 + S.tile * 8.6;
      if (S.x >= edge) { // 沒點就走過頭＝踏空
        S.x = Math.max(6, edge - 9);
        S.misses++;
        sndBad();
        $('#fb-miss').textContent = '💔'.repeat(S.misses);
        if (S.misses >= 3) {
          S.phase = 'done';
          loseAction('HEB', MINIGAMES.faith_cloud.lose.text, ACTION_GAMES.faith_cloud);
          return;
        }
      }
      $('#fb-walker').style.left = `${S.x}%`;
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— ⚓ 小舵大船：按住左/右舷連續操舵，沿著蜿蜒的水道開 30 秒（雅 3:4）——
  ACTION_GAMES.tongue_helm = function startHelm() {
    const SURVIVE_MS = 30000, HALF = 13; // 水道半寬
    const S = { phase: 'play', t: 0, x: 50, input: 0, raf: 0 };
    const area = startAction('⚓ 小舵大船', 'JAS', () => cancelAnimationFrame(S.raf));
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>⛵ 航程</span><div class="act-track"><div class="act-fill" id="hm-time"></div></div></div>
      <div class="hm-stage" id="hm-stage"><div class="hm-l" id="hm-l"></div><div class="hm-r" id="hm-r"></div><div class="hm-ship" id="hm-ship">⛵</div></div>
      <div class="st-btns">
        <button class="big-btn act-tap" id="hm-left">◀️ 轉左舵</button>
        <button class="big-btn act-tap" id="hm-right">轉右舵 ▶️</button>
      </div>
      <p class="fr-tip">「船隻雖然甚大……只用小小的舵」——水道會左彎右拐，按住舵鈕跟著走，撞岸就翻船！（雅 3:4）</p>`;
    const hold = (id, val) => {
      const b = $(id);
      b.onpointerdown = (e) => { e.preventDefault(); S.input = val; };
      b.onpointerup = () => { if (S.input === val) S.input = 0; };
      b.onpointerleave = () => { if (S.input === val) S.input = 0; };
    };
    hold('#hm-left', -1);
    hold('#hm-right', 1);
    const centerAt = (t) => 50 + Math.sin(t / 1600) * 22 + Math.sin(t / 3900) * 9; // 蜿蜒水道
    S.tick = (dt) => {
      if (S.phase !== 'play') return;
      const f = dt / 16.7;
      S.t += dt;
      S.x += S.input * 0.55 * f;
      const c = centerAt(S.t);
      $('#hm-l').style.width = `${Math.max(0, c - HALF)}%`;
      $('#hm-r').style.width = `${Math.max(0, 100 - (c + HALF))}%`;
      $('#hm-ship').style.left = `${S.x}%`;
      $('#hm-time').style.width = `${Math.min(100, (S.t / SURVIVE_MS) * 100)}%`;
      if (S.x < c - HALF || S.x > c + HALF) {
        S.phase = 'done';
        loseAction('JAS', MINIGAMES.tongue_helm.lose.text, ACTION_GAMES.tongue_helm);
        return;
      }
      if (S.t >= SURVIVE_MS) {
        S.phase = 'done';
        winAction('tongue_helm', 'JAS', MINIGAMES.tongue_helm.win, ACTION_GAMES.tongue_helm);
      }
    };
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last));
      last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };

  // —— 🏠 回家的路：帶阿尼西母走出迷宮回到腓利門家，步數有限（門 10-16）——
  ACTION_GAMES.philemon_home = function startMaze() {
    const N = 7;
    // DFS 產生迷宮：cells[r][c] = { top,right,bottom,left } 牆
    const cells = Array.from({ length: N }, () => Array.from({ length: N }, () => ({ t: 1, r: 1, b: 1, l: 1, seen: false })));
    const stack = [[0, 0]];
    cells[0][0].seen = true;
    while (stack.length) {
      const [r, c] = stack[stack.length - 1];
      const opts = [[r - 1, c, 't', 'b'], [r + 1, c, 'b', 't'], [r, c - 1, 'l', 'r'], [r, c + 1, 'r', 'l']]
        .filter(([nr, nc]) => nr >= 0 && nr < N && nc >= 0 && nc < N && !cells[nr][nc].seen);
      if (!opts.length) { stack.pop(); continue; }
      const [nr, nc, w1, w2] = opts[Math.floor(Math.random() * opts.length)];
      cells[r][c][w1] = 0;
      cells[nr][nc][w2] = 0;
      cells[nr][nc].seen = true;
      stack.push([nr, nc]);
    }
    // BFS 算最短路徑，步數上限＝最短＋8（保證每局都有解、又不會太鬆）
    const dist = Array.from({ length: N }, () => Array(N).fill(-1));
    dist[0][0] = 0;
    const q = [[0, 0]];
    while (q.length) {
      const [r, c] = q.shift();
      for (const [nr, nc, w] of [[r - 1, c, 't'], [r + 1, c, 'b'], [r, c - 1, 'l'], [r, c + 1, 'r']]) {
        if (nr < 0 || nr >= N || nc < 0 || nc >= N || cells[r][c][w] || dist[nr][nc] >= 0) continue;
        dist[nr][nc] = dist[r][c] + 1;
        q.push([nr, nc]);
      }
    }
    const STEPS = dist[N - 1][N - 1] + 8;
    const S = { phase: 'play', r: 0, c: 0, left: STEPS };
    const area = startAction('🏠 回家的路', 'PHM', null);
    action.state = S;
    area.innerHTML = `
      <div class="act-row"><span>👣 剩餘步數</span><b id="mz-steps">${STEPS}</b></div>
      <div class="mz-grid" id="mz-grid">${cells.map((row, r) => row.map((cell, c) =>
        `<div class="mz-cell" data-r="${r}" data-c="${c}" style="border-top-width:${cell.t ? 2 : 0}px;border-right-width:${cell.r ? 2 : 0}px;border-bottom-width:${cell.b ? 2 : 0}px;border-left-width:${cell.l ? 2 : 0}px">${r === N - 1 && c === N - 1 ? '🏠' : ''}</div>`).join('')).join('')}</div>
      <div class="mz-btns">
        <button class="big-btn act-tap" data-d="t">⬆️</button>
        <div><button class="big-btn act-tap" data-d="l">⬅️</button><button class="big-btn act-tap" data-d="b">⬇️</button><button class="big-btn act-tap" data-d="r">➡️</button></div>
      </div>
      <p class="fr-tip">「不再是奴僕，乃是親愛的兄弟」——在步數用完前，帶阿尼西母 🚶 走出迷宮、回到腓利門的家！</p>`;
    const draw = () => {
      document.querySelectorAll('.mz-cell').forEach((el) => { if (el.textContent === '🚶') el.textContent = ''; });
      const target = document.querySelector(`.mz-cell[data-r="${S.r}"][data-c="${S.c}"]`);
      if (!(S.r === N - 1 && S.c === N - 1)) target.textContent = '🚶';
    };
    draw();
    document.querySelectorAll('.mz-btns .big-btn').forEach((b) => {
      b.onclick = () => {
        if (S.phase !== 'play') return;
        const d = b.dataset.d;
        const cell = cells[S.r][S.c];
        if (cell[d]) { sndBad(); return; } // 撞牆不扣步數，只提示
        if (d === 't') S.r--;
        if (d === 'b') S.r++;
        if (d === 'l') S.c--;
        if (d === 'r') S.c++;
        S.left--;
        $('#mz-steps').textContent = S.left;
        draw();
        if (S.r === N - 1 && S.c === N - 1) {
          S.phase = 'done';
          sndGood();
          winAction('philemon_home', 'PHM', MINIGAMES.philemon_home.win, ACTION_GAMES.philemon_home);
          return;
        }
        if (S.left <= 0) {
          S.phase = 'done';
          loseAction('PHM', MINIGAMES.philemon_home.lose.text, ACTION_GAMES.philemon_home);
        }
      };
    });
  };

  // ===== 🏁 路徑里程碑小遊戲（每讀 10 章解鎖一關；通用、用該卷已讀章節出題，6 款機制各不同）=====
  let milestone = null; // { bookId, pos, idx, again }
  function milestoneCleared(bookId, pos) { return (((state.milestones || {})[bookId]) || []).includes(pos); }
  function msPickChapters(book, doneChs, n) {
    const cands = doneChs.filter((c) => (book.chapters[c - 1] || []).length >= 4);
    return shuffleArr(cands.length ? cands : doneChs.slice()).slice(0, n);
  }
  function msSplitClauses(text) { return text.split(/(?<=[，。；：？！])/).filter((s) => s.trim()); }
  // 蒐集指定題型的題目（generateVerseQuestion 隨機出 fill/tf/next/typefill，這裡篩要的那種）
  function msCollect(book, doneChs, type, n) {
    const out = []; let guard = 0;
    while (out.length < n && guard++ < 150) {
      const c = doneChs[Math.floor(Math.random() * doneChs.length)];
      const verses = book.chapters[c - 1] || [];
      if (!verses.length) continue;
      const q = QuestionFactory.generateVerseQuestion(book, c, Math.floor(Math.random() * verses.length));
      if (q && q.type === type && !out.some((x) => x.ref === q.ref && x.answer === q.answer)) out.push(q);
    }
    return out;
  }
  function winMilestone() {
    const { bookId, pos, again } = milestone;
    endActionState();
    if (!state.milestones) state.milestones = {};
    const arr = state.milestones[bookId] || (state.milestones[bookId] = []);
    const first = !arr.includes(pos);
    if (first) arr.push(pos);
    const gained = first ? 20 : 5;
    state.xp += gained; ensureWeek(); state.weekXp += gained; bumpStreak();
    store.save(state); sndWin(); throwConfetti();
    $('#result-box').innerHTML = `
      <div class="r-emoji">🏁⭐</div>
      <h2>里程碑達成！</h2>
      <p>讀了這麼多章，實力大增——繼續往下一段路前進！</p>
      <div class="result-stats"><div class="r-stat">＋${gained}<span>經驗值${first ? '' : '（重玩）'}</span></div></div>
      <button class="big-btn" id="btn-ms-again">再玩一次</button>
      <button class="ghost-btn" id="btn-continue">回路徑</button>`;
    $('#btn-ms-again').onclick = again;
    $('#btn-continue').onclick = () => { renderTopbar(); openBook(bookId); };
    renderTopbar(); show('#screen-result');
  }
  function loseMilestone() {
    const { bookId, again } = milestone;
    endActionState(); sndBad();
    $('#result-box').innerHTML = `
      <div class="r-emoji">${mascot().emoji}💭</div>
      <h2>差一點！</h2>
      <p>這是加分關卡，不會有任何損失——再挑戰一次就好！</p>
      <button class="big-btn" id="btn-ms-again">再挑戰</button>
      <button class="ghost-btn" id="btn-continue">回路徑</button>`;
    $('#btn-ms-again').onclick = again;
    $('#btn-continue').onclick = () => { renderTopbar(); openBook(bookId); };
    renderTopbar(); show('#screen-result');
  }
  function startMilestone(bookId, pos, idx) {
    const g = MILESTONE_GAMES[((idx % MILESTONE_GAMES.length) + MILESTONE_GAMES.length) % MILESTONE_GAMES.length];
    const doneChs = (state.done[bookId] || []).slice().sort((a, b) => a - b);
    milestone = { bookId, pos, idx, again: () => startMilestone(bookId, pos, idx) };
    g.run(currentBook, doneChs);
  }
  function msDrive(S) { // rAF 驅動；測試可用 S.tick 手動逐格推進
    let last = performance.now();
    const step = (now) => {
      if (!action || action.state !== S) return;
      S.tick(Math.min(50, now - last)); last = now;
      if (S.phase === 'play') S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  }
  function msRenderQuiz(container, q, onAnswer) { // 快答題（fill/next 四選一、tf 兩鈕）
    const stem = q.type === 'fill' ? q.display.replace('____', '<span class="blank">？</span>')
      : q.type === 'next' ? `${escapeHtml(q.head)}<span class="blank">……</span>`
      : '這句經文正確嗎？<br>' + escapeHtml(q.statement);
    container.innerHTML = `<div class="q-ref">${q.ref || ''}</div><div class="q-passage sprint-passage">${stem}</div>`;
    const box = document.createElement('div');
    box.className = q.type === 'tf' ? 'tf-row' : 'choices';
    const opts = q.type === 'tf' ? [{ label: '⭕ 正確', val: true }, { label: '❌ 有錯', val: false }] : shuffleArr(q.options).map((o) => ({ label: o, val: o }));
    for (const o of opts) {
      const b = document.createElement('button');
      b.className = q.type === 'tf' ? 'tf-btn tf-mini' : 'choice';
      b.textContent = o.label;
      b.onclick = () => onAnswer(o.val === q.answer);
      box.appendChild(b);
    }
    container.appendChild(box);
  }

  const MILESTONE_GAMES = [
    // ⚡ 極速問答：限時內答對 8 題（四選一／是非混合）
    { emoji: '⚡', title: '極速問答', run(book, doneChs) {
      const NEED = 8, LIMIT = 45000;
      const S = { phase: 'play', correct: 0, t: 0, qs: [], qi: 0, raf: 0 };
      const area = startAction('⚡ 極速問答', book.id, () => cancelAnimationFrame(S.raf));
      action.state = S;
      for (const c of msPickChapters(book, doneChs, 6)) S.qs.push(...QuestionFactory.generateQuickQuestions(book, c, 5));
      S.qs = shuffleArr(S.qs);
      area.innerHTML = `
        <div class="act-row"><span>✅ 答對</span><div class="act-track"><div class="act-fill" id="mq-bar"></div></div><b id="mq-count">0/${NEED}</b></div>
        <div class="act-row"><span>⏱️ 時間</span><div class="act-track"><div class="act-fill act-foe" id="mq-time"></div></div></div>
        <div id="mq-area"></div>
        <p class="fr-tip">限時 45 秒，答對 ${NEED} 題就過關——答錯不扣分，快答下一題！</p>`;
      const nextQ = () => {
        if (S.qi >= S.qs.length) { S.qi = 0; S.qs = shuffleArr(S.qs); }
        const q = S.qs[S.qi++];
        if (!q) { S.phase = 'done'; loseMilestone(); return; }
        msRenderQuiz($('#mq-area'), q, (ok) => {
          if (S.phase !== 'play') return;
          if (ok) { S.correct++; sndGood(); $('#mq-count').textContent = `${S.correct}/${NEED}`; $('#mq-bar').style.width = `${S.correct / NEED * 100}%`;
            if (S.correct >= NEED) { S.phase = 'done'; winMilestone(); return; } }
          else sndBad();
          nextQ();
        });
      };
      nextQ();
      S.tick = (dt) => { if (S.phase !== 'play') return; S.t += dt; $('#mq-time').style.width = `${Math.min(100, S.t / LIMIT * 100)}%`; if (S.t >= LIMIT) { S.phase = 'done'; loseMilestone(); } };
      msDrive(S);
    } },
    // ⭕❌ 是非快判：限時內答對 10 題是非
    { emoji: '⭕', title: '是非快判', run(book, doneChs) {
      const NEED = 10, LIMIT = 40000;
      const S = { phase: 'play', correct: 0, t: 0, qs: [], qi: 0, raf: 0 };
      const area = startAction('⭕❌ 是非快判', book.id, () => cancelAnimationFrame(S.raf));
      action.state = S;
      for (const c of msPickChapters(book, doneChs, 8)) for (const q of QuestionFactory.generateQuickQuestions(book, c, 8)) if (q.type === 'tf') S.qs.push(q);
      S.qs = shuffleArr(S.qs);
      area.innerHTML = `
        <div class="act-row"><span>✅ 答對</span><div class="act-track"><div class="act-fill" id="mt-bar"></div></div><b id="mt-count">0/${NEED}</b></div>
        <div class="act-row"><span>⏱️ 時間</span><div class="act-track"><div class="act-fill act-foe" id="mt-time"></div></div></div>
        <div id="mt-area"></div>
        <p class="fr-tip">限時 40 秒，判斷經文對錯——答對 ${NEED} 句就過關！</p>`;
      const nextQ = () => {
        if (!S.qs.length) { S.phase = 'done'; loseMilestone(); return; }
        if (S.qi >= S.qs.length) { S.qi = 0; S.qs = shuffleArr(S.qs); }
        msRenderQuiz($('#mt-area'), S.qs[S.qi++], (ok) => {
          if (S.phase !== 'play') return;
          if (ok) { S.correct++; sndGood(); $('#mt-count').textContent = `${S.correct}/${NEED}`; $('#mt-bar').style.width = `${S.correct / NEED * 100}%`;
            if (S.correct >= NEED) { S.phase = 'done'; winMilestone(); return; } }
          else sndBad();
          nextQ();
        });
      };
      nextQ();
      S.tick = (dt) => { if (S.phase !== 'play') return; S.t += dt; $('#mt-time').style.width = `${Math.min(100, S.t / LIMIT * 100)}%`; if (S.t >= LIMIT) { S.phase = 'done'; loseMilestone(); } };
      msDrive(S);
    } },
    // ⌨️ 打字快填：連續填對 5 個缺字（打字），3 次錯過就失敗
    { emoji: '⌨️', title: '打字快填', run(book, doneChs) {
      const NEED = 5;
      const S = { phase: 'play', done: 0, miss: 0, qs: msCollect(book, doneChs, 'typefill', NEED + 3), qi: 0 };
      const area = startAction('⌨️ 打字快填', book.id, null);
      action.state = S;
      area.innerHTML = `
        <div class="act-row"><span>✍️ 填對</span><div class="act-track"><div class="act-fill" id="mf-bar"></div></div><b id="mf-count">0/${NEED}</b></div>
        <div class="act-row"><span>💔 填錯</span><b id="mf-miss">—</b></div>
        <div id="mf-area"></div>`;
      const nextQ = () => {
        const q = S.qs[S.qi++];
        if (!q) { S.phase = 'done'; (S.done >= NEED ? winMilestone : loseMilestone)(); return; }
        const a = $('#mf-area');
        a.innerHTML = `<div class="q-ref">${q.ref || ''}</div>
          <div class="q-passage">${escapeHtml(q.display)}</div>
          <input class="ms-type-input" id="mf-in" inputmode="text" placeholder="打出缺的字…" autocomplete="off">
          <button class="big-btn" id="mf-go">送出</button>
          <p class="fr-tip">缺 ${q.answer.length} 個字，把它打出來！</p>`;
        const inp = $('#mf-in');
        setTimeout(() => inp.focus(), 50);
        const submit = () => {
          if (S.phase !== 'play') return;
          const val = inp.value.replace(/[^一-鿿㐀-䶿]/g, '');
          if (val === q.answer) {
            S.done++; sndGood();
            $('#mf-count').textContent = `${S.done}/${NEED}`; $('#mf-bar').style.width = `${S.done / NEED * 100}%`;
            if (S.done >= NEED) { S.phase = 'done'; winMilestone(); return; }
          } else {
            S.miss++; sndBad(); $('#mf-miss').textContent = '💔'.repeat(S.miss);
            if (S.miss >= 3) { S.phase = 'done'; loseMilestone(); return; }
          }
          nextQ();
        };
        $('#mf-go').onclick = submit;
        inp.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
      };
      nextQ();
    } },
    // 🔀 語塊排序：把打散的經文語塊「依序點回來」，做對 3 節；3 次點錯就失敗
    { emoji: '🔀', title: '語塊排序', run(book, doneChs) {
      const NEED = 3;
      const S = { phase: 'play', done: 0, miss: 0, verses: [] };
      const area = startAction('🔀 語塊排序', book.id, null);
      action.state = S;
      // 蒐集 3~5 個語塊、且各塊不重複的節
      let guard = 0;
      while (S.verses.length < NEED + 2 && guard++ < 200) {
        const c = doneChs[Math.floor(Math.random() * doneChs.length)];
        const vs = book.chapters[c - 1] || [];
        const vi = Math.floor(Math.random() * vs.length);
        if (!vs[vi] || /[〔〕]/.test(vs[vi])) continue;
        const cl = msSplitClauses(vs[vi]);
        if (cl.length >= 3 && cl.length <= 5 && new Set(cl).size === cl.length && !S.verses.some((v) => v.ref === `${book.name} ${c}:${vi + 1}`)) {
          S.verses.push({ ref: `${book.name} ${c}:${vi + 1}`, clauses: cl });
        }
      }
      area.innerHTML = `
        <div class="act-row"><span>🧩 排好</span><div class="act-track"><div class="act-fill" id="mo-bar"></div></div><b id="mo-count">0/${NEED}</b></div>
        <div class="act-row"><span>💔 排錯</span><b id="mo-miss">—</b></div>
        <div id="mo-area"></div>
        <p class="fr-tip">照經文原本的順序，把語塊一塊一塊點回來！</p>`;
      let vIdx = 0;
      const renderVerse = () => {
        const v = S.verses[vIdx++];
        if (!v) { S.phase = 'done'; (S.done >= NEED ? winMilestone : loseMilestone)(); return; }
        S.cur = v; // 測試用
        let at = 0;
        const a = $('#mo-area');
        a.innerHTML = `<div class="q-ref">${v.ref}</div><div class="ms-order-slot" id="mo-slot"></div><div class="ms-order" id="mo-pool"></div>`;
        const pool = $('#mo-pool'), slot = $('#mo-slot');
        for (const cl of shuffleArr(v.clauses)) {
          const b = document.createElement('button');
          b.className = 'ms-order-chip'; b.textContent = cl;
          b.onclick = () => {
            if (S.phase !== 'play' || b.disabled) return;
            if (cl === v.clauses[at]) {
              at++; b.disabled = true; b.classList.add('used');
              slot.textContent = v.clauses.slice(0, at).join('');
              sndGood();
              if (at >= v.clauses.length) {
                S.done++; $('#mo-count').textContent = `${S.done}/${NEED}`; $('#mo-bar').style.width = `${S.done / NEED * 100}%`;
                if (S.done >= NEED) { S.phase = 'done'; winMilestone(); return; }
                setTimeout(renderVerse, 500);
              }
            } else {
              S.miss++; sndBad(); $('#mo-miss').textContent = '💔'.repeat(S.miss);
              b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
              if (S.miss >= 3) { S.phase = 'done'; loseMilestone(); }
            }
          };
          pool.appendChild(b);
        }
      };
      renderVerse();
    } },
    // 🃏 翻牌配對：把 6 對上下句翻牌配起來（記憶），60 秒內完成
    { emoji: '🃏', title: '翻牌配對', run(book, doneChs) {
      const LIMIT = 60000;
      const S = { phase: 'play', matched: 0, sel: null, lock: false, t: 0, pairs: 0, raf: 0 };
      const area = startAction('🃏 翻牌配對', book.id, () => cancelAnimationFrame(S.raf));
      action.state = S;
      let pairs = [];
      for (const c of shuffleArr(doneChs)) { pairs = QuestionFactory.generatePairs(book, c, 6); if (pairs.length >= 4) break; }
      S.pairs = pairs.length;
      if (!S.pairs) { S.phase = 'done'; loseMilestone(); return; }
      const cards = shuffleArr(pairs.flatMap((p, i) => [{ key: i, text: p.left }, { key: i, text: p.right }]));
      S.cards = cards; // 測試用（不顯示於畫面）
      area.innerHTML = `
        <div class="act-row"><span>🃏 配對</span><div class="act-track"><div class="act-fill" id="mm-bar"></div></div><b id="mm-count">0/${S.pairs}</b></div>
        <div class="act-row"><span>⏱️ 時間</span><div class="act-track"><div class="act-fill act-foe" id="mm-time"></div></div></div>
        <div class="ms-flip" id="mm-grid"></div>
        <p class="fr-tip">翻開兩張，把「上句」和「下句」配成一對！限時 60 秒。</p>`;
      const grid = $('#mm-grid');
      cards.forEach((c) => {
        const card = document.createElement('button');
        card.className = 'ms-card';
        card.innerHTML = `<span class="ms-card-in"><span class="ms-face ms-front">📜</span><span class="ms-face ms-back">${escapeHtml(c.text)}</span></span>`;
        card.onclick = () => {
          if (S.phase !== 'play' || S.lock || card.classList.contains('open') || card.classList.contains('done')) return;
          card.classList.add('open');
          if (!S.sel) { S.sel = { c, card }; return; }
          const a = S.sel; S.sel = null;
          if (a.c.key === c.key && a.card !== card) {
            a.card.classList.add('done'); card.classList.add('done'); S.matched++; sndGood();
            $('#mm-count').textContent = `${S.matched}/${S.pairs}`; $('#mm-bar').style.width = `${S.matched / S.pairs * 100}%`;
            if (S.matched >= S.pairs) { S.phase = 'done'; winMilestone(); }
          } else {
            S.lock = true; sndBad();
            setTimeout(() => { a.card.classList.remove('open'); card.classList.remove('open'); S.lock = false; }, 700);
          }
        };
        grid.appendChild(card);
      });
      S.tick = (dt) => { if (S.phase !== 'play') return; S.t += dt; $('#mm-time').style.width = `${Math.min(100, S.t / LIMIT * 100)}%`; if (S.t >= LIMIT) { S.phase = 'done'; loseMilestone(); } };
      msDrive(S);
    } },
    // 🎯 準心打靶：準星左右擺盪，掃進綠色靶心的瞬間按下，命中 6 次；靶心越來越窄，3 次落空失敗
    { emoji: '🎯', title: '準心打靶', run(book, doneChs) {
      const NEED = 6;
      const S = { phase: 'play', hit: 0, miss: 0, marker: 0, dir: 1, raf: 0 };
      const area = startAction('🎯 準心打靶', book.id, () => cancelAnimationFrame(S.raf));
      action.state = S;
      area.innerHTML = `
        <div class="act-row"><span>🎯 命中</span><div class="act-track"><div class="act-fill" id="ma-bar"></div></div><b id="ma-count">0/${NEED}</b></div>
        <div class="act-row"><span>💔 落空</span><b id="ma-miss">—</b></div>
        <div class="dv-aim" style="height:34px"><div class="dv-zone" id="ma-zone"></div><div class="dv-marker" id="ma-marker"></div></div>
        <button class="big-btn act-tap" id="ma-btn">🎯 放手命中！</button>
        <p class="fr-tip">橘色準星掃進綠色靶心的瞬間按下去——命中 ${NEED} 次就過關，越後面靶心越窄！</p>`;
      const zoneHalf = () => Math.max(6, 15 - S.hit * 1.6);
      const placeZone = () => { const z = $('#ma-zone'); z.style.left = `${50 - zoneHalf()}%`; z.style.width = `${zoneHalf() * 2}%`; };
      placeZone();
      $('#ma-btn').onclick = () => {
        if (S.phase !== 'play') return;
        if (Math.abs(S.marker - 50) <= zoneHalf()) {
          S.hit++; sndGood(); $('#ma-count').textContent = `${S.hit}/${NEED}`; $('#ma-bar').style.width = `${S.hit / NEED * 100}%`;
          if (S.hit >= NEED) { S.phase = 'done'; winMilestone(); return; }
          placeZone();
        } else {
          S.miss++; sndBad(); $('#ma-miss').textContent = '💔'.repeat(S.miss);
          if (S.miss >= 3) { S.phase = 'done'; loseMilestone(); }
        }
      };
      S.tick = (dt) => {
        if (S.phase !== 'play') return;
        S.marker += S.dir * (1.8 + S.hit * 0.3) * (dt / 16.7);
        if (S.marker >= 100) { S.marker = 100; S.dir = -1; }
        if (S.marker <= 0) { S.marker = 0; S.dir = 1; }
        const el = $('#ma-marker'); if (el) el.style.left = `${S.marker}%`;
      };
      msDrive(S);
    } },
  ];

  // ===== 📖 書卷故事小遊戲（對決引擎：答對推進我方、答錯讓威脅逼近，先滿者定勝負）=====
  // 加一款遊戲＝在這裡加一份設定，章節頁入口與雲端同步都會自動長出來
  const MINIGAMES = {
    david: {
      book: '1SA', ch: 17, emoji: '🗿', title: '大衛擊殺歌利亞', tag: '撒上 17・連點甩石',
      myEmoji: '🪨', myName: '大衛的石子', myGoal: 5,
      foeEmoji: '⚔️', foeName: '歌利亞', foeGoal: 5,
      hitText: '🎯 石子甩出，命中！', missText: '😰 歌利亞又逼近一步…',
      win: { emoji: '🎯', title: '正中額頭！', text: '第五顆石子用機弦甩去，正中歌利亞的額，巨人面伏於地——大衛手中卻沒有刀！' },
      lose: { text: '別怕，這場仗是屬耶和華的！再撿五顆光滑石子重來。' },
      manualQs: [
        { q: '大衛在溪中挑選了幾塊光滑石子？', options: ['五塊', '三塊', '七塊', '十塊'], answer: '五塊', basis: '撒上 17:40' },
        { q: '歌利亞的身高是多少？', options: ['六肘零一虎口', '三肘', '一丈', '兩肘'], answer: '六肘零一虎口', basis: '撒上 17:4' },
        { q: '大衛說他靠什麼來攻擊歌利亞？', options: ['萬軍之耶和華的名', '刀槍和銅戟', '自己的勇氣', '掃羅王的盔甲'], answer: '萬軍之耶和華的名', basis: '撒上 17:45' },
        { q: '石子打中了歌利亞的哪裡？', options: ['額', '胸膛', '手臂', '腳跟'], answer: '額', basis: '撒上 17:49' },
        { q: '大衛打死歌利亞時，手中有沒有刀？', options: ['手中沒有刀', '一把長劍', '一支長槍', '一把短刀'], answer: '手中沒有刀', basis: '撒上 17:50' },
      ],
    },
    furnace: {
      book: 'DAN', ch: 3, emoji: '🔥', title: '火窯三友', tag: '但 3・堅立不拜',
      myEmoji: '🙏', myName: '第四個人的同在', myGoal: 5,
      foeEmoji: '🔥', foeName: '窯溫升高', foeGoal: 5,
      hitText: '🙏 火中有第四個人同行，護住他們！', missText: '🔥 窯又燒得更旺了…',
      win: { emoji: '🔥', title: '毫髮無傷走出火窯！', text: '三人從火中出來，頭髮沒燒焦、衣裳沒變色、也沒有火燎的氣味——因為第四個人與他們同在！' },
      lose: { text: '「即或不然」，他們的心志也不改變——你也再進一次火窯，重新來過！' },
      manualQs: [
        { q: '王吩咐把窯燒熱，比尋常更加幾倍？', options: ['七倍', '三倍', '十倍', '兩倍'], answer: '七倍', basis: '但 3:19' },
        { q: '王在火中看見有幾個人在遊行？', options: ['四個', '三個', '五個', '兩個'], answer: '四個', basis: '但 3:25' },
        { q: '那第四個人的相貌好像誰？', options: ['神子', '天使', '先知', '巴比倫王'], answer: '神子', basis: '但 3:25' },
        { q: '三友說「即或不然」，也決不敬拜什麼？', options: ['王所立的金像', '天上的星辰', '外邦的偶像', '巴力的祭壇'], answer: '王所立的金像', basis: '但 3:18' },
        { q: '三人從火裡出來，身上有沒有火燎的氣味？', options: ['沒有火燎的氣味', '頭髮燒焦了', '衣裳燒破了', '手臂受傷了'], answer: '沒有火燎的氣味', basis: '但 3:27' },
      ],
    },
    daniel_lions: {
      book: 'DAN', ch: 6, emoji: '🦁', title: '但以理在獅子坑', tag: '但 6・答題對決',
      myEmoji: '😇', myName: '天使封住獅子的口', myGoal: 5,
      foeEmoji: '🌙', foeName: '長夜漸深', foeGoal: 5,
      hitText: '😇 天使封住獅子的口！', missText: '🌙 夜更深了，坑裡傳來低吼…',
      win: { emoji: '🦁', title: '毫髮無傷！', text: '天亮了，王急忙到坑邊呼叫。但以理竟身上毫無傷損，因為信靠他的神——王大喜，把他從坑裡繫上來！' },
      lose: { text: '天還沒亮，別灰心——但以理一日三次向神禱告，你也再禱告一次重來！' },
      manualQs: [
        { q: '但以理一日幾次雙膝跪下禱告？', options: ['三次', '一次', '七次', '兩次'], answer: '三次', basis: '但 6:10' },
        { q: '王的禁令規定三十日內只能向誰祈求？', options: ['只能向王', '只能向耶和華', '只能向天使', '只能向偶像'], answer: '只能向王', basis: '但 6:7' },
        { q: '但以理禱告時，樓上的窗戶開向哪座城？', options: ['耶路撒冷', '巴比倫', '尼尼微', '伯特利'], answer: '耶路撒冷', basis: '但 6:10' },
        { q: '神差遣誰封住獅子的口？', options: ['使者（天使）', '先知', '王的軍兵', '但以理自己'], answer: '使者（天使）', basis: '但 6:22' },
        { q: '但以理從坑裡上來時，身上如何？', options: ['毫無傷損', '受了輕傷', '一隻手受傷', '多處被咬'], answer: '毫無傷損', basis: '但 6:23' },
      ],
    },
    elijah: {
      book: '1KI', ch: 18, emoji: '⚡', title: '以利亞 PK 巴力先知', tag: '王上 18・答題對決',
      myEmoji: '🔥', myName: '以利亞獻祭禱告', myGoal: 5,
      foeEmoji: '📢', foeName: '巴力先知狂喊', foeGoal: 5,
      hitText: '🔥 又前進一步：修壇、倒水、禱告！', missText: '📢 巴力先知從早喊到午，甚至用刀自割…',
      win: { emoji: '⚡', title: '耶和華降下火來！', text: '耶和華的火降下，燒盡燔祭、木柴、石頭、塵土，連溝裡的水也燒乾了！眾民俯伏喊著：耶和華是神！耶和華是神！' },
      lose: { text: '巴力始終不回應——別急，把柴上再倒滿四桶水，讓神的大能更顯明，重來一次！' },
      manualQs: [
        { q: '巴力的先知有多少人？', options: ['四百五十個', '四百個', '三百個', '一千個'], answer: '四百五十個', basis: '王上 18:22' },
        { q: '以利亞照支派的數目，取了幾塊石頭修壇？', options: ['十二塊', '七塊', '十塊', '五塊'], answer: '十二塊', basis: '王上 18:31' },
        { q: '以利亞叫人把水倒在燔祭和柴上，共倒了幾次？', options: ['三次', '一次', '四次', '七次'], answer: '三次', basis: '王上 18:33-34' },
        { q: '耶和華降火，連什麼也燒乾了？', options: ['溝裡的水', '旁邊的樹', '天上的雲', '遠處的海'], answer: '溝裡的水', basis: '王上 18:38' },
        { q: '眾民看見火降下，俯伏說什麼？', options: ['耶和華是神！', '巴力是神！', '以利亞是神！', '王是神！'], answer: '耶和華是神！', basis: '王上 18:39' },
      ],
    },
    redsea: {
      book: 'EXO', ch: 14, emoji: '🌊', title: '過紅海', tag: '出 14・撥海快走',
      myEmoji: '🚶', myName: '走過分開的乾地', myGoal: 5,
      foeEmoji: '🏇', foeName: '法老的追兵', foeGoal: 5,
      hitText: '🌊 海水又分開一步，往前走上乾地！', missText: '🏇 法老的車輛馬兵又追近了…',
      win: { emoji: '🌊', title: '全軍覆沒，一個也不剩！', text: '以色列人在海中走乾地，水在左右作了牆垣；等追兵下海，水就回流淹沒車輛馬兵——法老的全軍，連一個也沒有剩下！' },
      lose: { text: '「不要懼怕，只管站住！耶和華必為你們爭戰。」再向海伸一次杖，重新來過！' },
      manualQs: [
        { q: '摩西怎樣把紅海的水分開？', options: ['向海伸杖', '用手推開海水', '搬開海邊的大石', '吹響號角'], answer: '向海伸杖', basis: '出 14:16' },
        { q: '耶和華用甚麼使海水一夜退去？', options: ['大東風', '大地震', '一場暴雨', '天上降火'], answer: '大東風', basis: '出 14:21' },
        { q: '以色列人下海走乾地時，水在他們左右作了甚麼？', options: ['牆垣', '大霧', '漩渦', '冰山'], answer: '牆垣', basis: '出 14:22' },
        { q: '跟著以色列人下海的法老全軍，剩下幾個？', options: ['一個也沒有剩下', '剩下一半', '只剩法老一人', '剩下車輛馬兵'], answer: '一個也沒有剩下', basis: '出 14:28' },
        { q: '摩西對百姓說，耶和華必為你們做甚麼？', options: ['爭戰', '開路', '降雨', '造船'], answer: '爭戰', basis: '出 14:14' },
      ],
    },
    jericho: {
      book: 'JOS', ch: 6, emoji: '🎺', title: '耶利哥城牆', tag: '書 6・畫圈吶喊',
      myEmoji: '🎺', myName: '繞城的圈數', myGoal: 7,
      foeEmoji: '😨', foeName: '百姓信心動搖', foeGoal: 5,
      hitText: '🎺 又繞了一圈，腳步不停！', missText: '😨 城裡傳來嘲笑，有人信心動搖了…',
      win: { emoji: '🏙️', title: '城牆應聲塌陷！', text: '第七圈繞完，祭司吹角、百姓大聲呼喊——耶利哥的城牆便塌陷，各人往前直上，把城奪取了！' },
      lose: { text: '照耶和華的吩咐，明天再來繞一次——祂已把這城交在你手中了，重新開始！' },
      manualQs: [
        { q: '頭六日，以色列人一天繞耶利哥城幾次？', options: ['一次', '兩次', '三次', '七次'], answer: '一次', basis: '書 6:3' },
        { q: '到了第七日，他們要繞城幾次？', options: ['七次', '一次', '三次', '十二次'], answer: '七次', basis: '書 6:4' },
        { q: '走在約櫃前的七個祭司拿著甚麼？', options: ['七個羊角', '七枝號筒', '七個火把', '七面旌旗'], answer: '七個羊角', basis: '書 6:4' },
        { q: '百姓聽見甚麼之後，城牆就塌陷了？', options: ['角聲和大聲呼喊', '一陣大地震', '天上的雷轟', '攻城的撞錘'], answer: '角聲和大聲呼喊', basis: '書 6:20' },
        { q: '城被攻取時，誰和她全家得以存活？', options: ['妓女喇合', '約書亞的妻子', '祭司的女兒', '城主的家人'], answer: '妓女喇合', basis: '書 6:17' },
      ],
    },
    loaves: {
      book: 'JHN', ch: 6, emoji: '🍞', title: '五餅二魚', tag: '約 6・拖籃接餅',
      myEmoji: '🍞', myName: '餵飽的人數', myGoal: 5,
      foeEmoji: '🌆', foeName: '天色漸晚、群眾飢餓', foeGoal: 5,
      hitText: '🍞 餅越掰越多，又餵飽了一千人！', missText: '🌆 天色更晚了，群眾更餓了…',
      win: { emoji: '🧺', title: '五千人都吃飽了！', text: '一個孩童的五餅二魚，經耶穌祝謝分開，五千人都吃飽了——剩下的零碎還裝滿了十二個籃子！' },
      lose: { text: '別忘了，在耶穌手中五個餅也夠用——把餅再遞上去，再試一次！' },
      manualQs: [
        { q: '這五個餅和兩條魚原是誰帶來的？', options: ['一個孩童', '門徒腓力', '門徒安得烈', '一位財主'], answer: '一個孩童', basis: '約 6:9' },
        { q: '孩童帶來的食物是甚麼？', options: ['五個大麥餅和兩條魚', '五條魚和兩個餅', '七個餅和三條魚', '十二個餅'], answer: '五個大麥餅和兩條魚', basis: '約 6:9' },
        { q: '坐下吃飯的人數約有多少？', options: ['約五千', '約三千', '約一千', '約一萬'], answer: '約五千', basis: '約 6:10' },
        { q: '眾人吃飽後，剩下的零碎裝滿了幾個籃子？', options: ['十二個', '七個', '五個', '三個'], answer: '十二個', basis: '約 6:13' },
        { q: '把孩童帶來的餅告訴耶穌的安得烈，是誰的兄弟？', options: ['西門彼得', '雅各', '約翰', '腓力'], answer: '西門彼得', basis: '約 6:8' },
      ],
    },
    gideon: {
      book: 'JDG', ch: 7, emoji: '⚔️', title: '基甸與三百勇士', tag: '士 7・答題對決',
      myEmoji: '📯', myName: '三百勇士的角聲', myGoal: 5,
      foeEmoji: '🦗', foeName: '米甸大軍', foeGoal: 5,
      hitText: '📯 三百人吹角、火把齊亮，敵營亂竄！', missText: '🦗 米甸人多如蝗蟲，又逼近了…',
      win: { emoji: '⚔️', title: '三百人得勝！', text: '三百人吹角、打破瓶子、高舉火把，喊著「耶和華和基甸的刀！」——耶和華使全營的人自相擊殺，米甸大軍潰逃！' },
      lose: { text: '得勝不是靠人多，是靠耶和華——回到水邊再挑三百勇士，重新來過！' },
      manualQs: [
        { q: '基甸用舔水的方式揀選，最後剩下多少勇士？', options: ['三百人', '三萬二千人', '一萬人', '七百人'], answer: '三百人', basis: '士 7:7' },
        { q: '三百勇士手裏拿著角，瓶子裏藏著甚麼？', options: ['火把', '刀劍', '石子', '糧食'], answer: '火把', basis: '士 7:16' },
        { q: '他們吹角、打破瓶子時，喊的口號是甚麼？', options: ['耶和華和基甸的刀！', '為耶和華爭戰！', '米甸必敗亡！', '以色列得勝！'], answer: '耶和華和基甸的刀！', basis: '士 7:20' },
        { q: '米甸和東方的大軍，人數多得像甚麼？', options: ['如同蝗蟲那樣多', '如同海浪', '如同天上星辰', '如同樹上葉子'], answer: '如同蝗蟲那樣多', basis: '士 7:12' },
        { q: '耶和華使米甸全營怎樣潰敗？', options: ['用刀互相擊殺', '被大水淹沒', '被火燒盡', '四散逃回家'], answer: '用刀互相擊殺', basis: '士 7:22' },
      ],
    },
    storm: {
      book: 'MRK', ch: 4, emoji: '⛵', title: '耶穌平靜風浪', tag: '可 4・平衡穩船',
      myEmoji: '🙏', myName: '向耶穌呼求的信心', myGoal: 5,
      foeEmoji: '🌊', foeName: '暴風大浪', foeGoal: 5,
      hitText: '🙏 定睛在耶穌身上，心就安穩！', missText: '🌊 波浪打入船內，船快滿了水…',
      win: { emoji: '⛵', title: '風就止住，大大平靜！', text: '耶穌醒了，斥責風、向海說「住了吧！靜了吧！」——風就止住，海就大大地平靜了。連風和海都聽從他！' },
      lose: { text: '「為甚麼膽怯？你們還沒有信心嗎？」別怕，耶穌就在船上——再向他呼求一次！' },
      manualQs: [
        { q: '暴風大浪來的時候，耶穌在船上做甚麼？', options: ['在船尾枕著枕頭睡覺', '站在船頭禱告', '幫門徒划槳', '正在數點糧食'], answer: '在船尾枕著枕頭睡覺', basis: '可 4:38' },
        { q: '耶穌向風和海說了哪句話？', options: ['住了吧！靜了吧！', '平安！平安！', '快快退去！', '起來，行走！'], answer: '住了吧！靜了吧！', basis: '可 4:39' },
        { q: '耶穌斥責風之後，海變得怎樣？', options: ['大大地平靜了', '掀起更大的浪', '結成了冰', '分成兩半'], answer: '大大地平靜了', basis: '可 4:39' },
        { q: '風浪平靜後，耶穌問門徒甚麼？', options: ['為甚麼膽怯？還沒有信心嗎？', '你們餓了嗎？', '要往哪裡去？', '是誰摸了我？'], answer: '為甚麼膽怯？還沒有信心嗎？', basis: '可 4:40' },
        { q: '門徒大大懼怕，彼此議論說甚麼？', options: ['連風和海也聽從他', '這是先知以利亞', '我們得救了', '該往加利利去'], answer: '連風和海也聽從他', basis: '可 4:41' },
      ],
    },
    esther: {
      book: 'EST', ch: 4, emoji: '👑', title: '以斯帖為同胞挺身', tag: '斯 4・答題對決',
      myEmoji: '🙏', myName: '禁食禱告的勇氣', myGoal: 5,
      foeEmoji: '📜', foeName: '滅族的詔令', foeGoal: 5,
      hitText: '🙏 三日禁食後，以斯帖挺身向前！', missText: '📜 滅族的日子又逼近了…',
      win: { emoji: '👑', title: '王向她伸出金杖！', text: '「我若死就死吧！」以斯帖冒死進去見王，王向她伸出金杖——猶大人終得拯救，哈曼反被掛在自己立的木架上！' },
      lose: { text: '「焉知你得了王后的位分，不是為現今的機會嗎？」再招聚同胞禁食禱告，重新來過！' },
      manualQs: [
        { q: '末底改知道滅族的事後，穿上甚麼在城中痛哭哀號？', options: ['麻衣', '錦袍', '祭司袍', '王的朝服'], answer: '麻衣', basis: '斯 4:1' },
        { q: '不蒙宣召擅自進內院見王的人，會怎樣？', options: ['必被治死', '被罰重款', '逐出王宮', '關進監牢'], answer: '必被治死', basis: '斯 4:11' },
        { q: '除非王向他伸出甚麼，擅入的人才得存活？', options: ['金杖', '令牌', '印戒', '詔書'], answer: '金杖', basis: '斯 4:11' },
        { q: '以斯帖請書珊城的猶大人為她禁食幾晝夜？', options: ['三晝三夜', '一晝一夜', '七晝七夜', '四十晝夜'], answer: '三晝三夜', basis: '斯 4:16' },
        { q: '以斯帖下定決心進去見王，說了哪句話？', options: ['我若死就死吧！', '願神憐憫我', '一切交託在神手中', '我必然得勝'], answer: '我若死就死吧！', basis: '斯 4:16' },
      ],
    },
    peter_prison: {
      book: 'ACT', ch: 12, emoji: '⛓️', title: '彼得被天使救出監牢', tag: '徒 12・躡腳潛行',
      myEmoji: '😇', myName: '教會的禱告與天使', myGoal: 5,
      foeEmoji: '⛓️', foeName: '鐵鍊與四班兵丁', foeGoal: 5,
      hitText: '😇 天使一拍，鐵鍊脫落，鐵門自開！', missText: '⛓️ 守衛森嚴，鐵鍊又緊了…',
      win: { emoji: '🔓', title: '鐵門自己開了！', text: '天使拍醒彼得，鐵鍊就從他手上脫落；過了兩層監牢，臨街的鐵門自己開了——彼得被救出希律的手，走到了街上！' },
      lose: { text: '別灰心，教會還在為你切切地禱告——神必差天使來，再試一次！' },
      manualQs: [
        { q: '希律拿了彼得，交給幾班兵丁看守？', options: ['四班兵丁', '兩班兵丁', '一隊祭司', '十個守衛'], answer: '四班兵丁', basis: '徒 12:4' },
        { q: '彼得被囚在監裏時，教會為他做甚麼？', options: ['切切地禱告神', '湊錢要贖他', '上告羅馬皇帝', '逃離耶路撒冷'], answer: '切切地禱告神', basis: '徒 12:5' },
        { q: '天使拍醒彼得，他手上的甚麼就脫落了？', options: ['鐵鍊', '麻繩', '腳鐐', '囚衣'], answer: '鐵鍊', basis: '徒 12:7' },
        { q: '過了兩層監牢，臨街的鐵門怎麼樣了？', options: ['自己開了', '被彼得撞開', '天使砸開', '守衛打開'], answer: '自己開了', basis: '徒 12:10' },
        { q: '彼得敲門，認出他聲音的使女叫甚麼名字？', options: ['羅大', '馬利亞', '大比大', '呂底亞'], answer: '羅大', basis: '徒 12:13-14' },
      ],
    },
    naaman: {
      book: '2KI', ch: 5, emoji: '💧', title: '乃縵洗七次得潔淨', tag: '王下 5・洗七次',
      myEmoji: '💧', myName: '順服下約旦河', myGoal: 7,
      foeEmoji: '😤', foeName: '驕傲不肯下水', foeGoal: 5,
      hitText: '💧 放下驕傲，又下水洗了一回！', missText: '😤 「大馬色的河豈不更好？」他又氣忿忿轉身…',
      win: { emoji: '✨', title: '肉復原像小孩子的肉！', text: '乃縵照神人的話，在約旦河裏沐浴七回——大痲瘋就潔淨了，他的肉復原好像小孩子的肉！原來神要的，是單純的順服。' },
      lose: { text: '「先知若吩咐你作一件大事，你豈不作嗎？何況只是去沐浴」——別讓驕傲攔阻你，再下水一次！' },
      manualQs: [
        { q: '乃縵是大能的勇士，只是身上長了甚麼？', options: ['大痲瘋', '毒瘡', '瞎了眼', '瘸了腿'], answer: '大痲瘋', basis: '王下 5:1' },
        { q: '先知以利沙叫乃縵去哪條河裏沐浴？', options: ['約旦河', '大馬色的亞罷拿河', '埃及的尼羅河', '基順河'], answer: '約旦河', basis: '王下 5:10' },
        { q: '以利沙吩咐乃縵在河裏沐浴幾回？', options: ['七回', '三回', '一回', '十回'], answer: '七回', basis: '王下 5:10' },
        { q: '乃縵起先發怒，是因為覺得哪裡的河更好？', options: ['大馬色的河', '加利利海', '死海', '約帕的海'], answer: '大馬色的河', basis: '王下 5:12' },
        { q: '是誰勸乃縵放下驕傲、照先知的話去做？', options: ['他的僕人', '亞蘭王', '以色列王', '他的妻子'], answer: '他的僕人', basis: '王下 5:13' },
      ],
    },
    empty_tomb: {
      book: 'LUK', ch: 24, emoji: '🌅', title: '空墳墓・耶穌復活', tag: '路 24・答題對決',
      myEmoji: '🌅', myName: '尋見復活的主', myGoal: 5,
      foeEmoji: '🪦', foeName: '死亡的權勢', foeGoal: 5,
      hitText: '🌅 又想起主的話——祂說過要復活！', missText: '🪦 婦女們驚怕，將臉伏地…',
      win: { emoji: '✝️', title: '祂不在這裡，已經復活了！', text: '婦女清早到墳墓，看見石頭滾開、身體不見了；天使說：「為甚麼在死人中找活人呢？他不在這裡，已經復活了！」死亡再也關不住祂！' },
      lose: { text: '別在憂傷中停留——「當記念他還在加利利的時候怎樣告訴你們」，祂必復活！再想一次！' },
      manualQs: [
        { q: '七日的頭一日清早，婦女帶著所預備的甚麼來到墳墓？', options: ['香料', '鮮花', '餅和酒', '燈油'], answer: '香料', basis: '路 24:1' },
        { q: '婦女來到墳墓，看見墓門的石頭怎樣了？', options: ['已經滾開了', '仍然封著', '裂成兩半', '被兵丁把守'], answer: '已經滾開了', basis: '路 24:2' },
        { q: '她們進了墳墓，發現甚麼？', options: ['不見主耶穌的身體', '有天兵把守', '身體還在', '裡面一片黑暗'], answer: '不見主耶穌的身體', basis: '路 24:3' },
        { q: '兩個衣服放光的人對婦女說了哪句話？', options: ['為甚麼在死人中找活人呢？', '不要害怕，只要信', '你們的信救了你們', '平安歸與你們'], answer: '為甚麼在死人中找活人呢？', basis: '路 24:5' },
        { q: '天使提醒婦女，主曾在哪裡預先告訴門徒要復活？', options: ['加利利', '耶路撒冷', '伯利恆', '拿撒勒'], answer: '加利利', basis: '路 24:6' },
      ],
    },
    bronze_serpent: {
      book: 'NUM', ch: 21, emoji: '🐍', title: '摩西舉銅蛇', tag: '民 21・答題對決',
      myEmoji: '🙏', myName: '抬頭仰望銅蛇', myGoal: 5,
      foeEmoji: '🐍', foeName: '火蛇的咬傷', foeGoal: 5,
      hitText: '🙏 一抬頭望向銅蛇，就活過來了！', missText: '🐍 火蛇又咬了一口，毒性蔓延…',
      win: { emoji: '🐍', title: '一望就活了！', text: '摩西把銅蛇掛在杆子上；凡被蛇咬的，一望這銅蛇就活了！（主耶穌說：摩西在曠野怎樣舉蛇，人子也必照樣被舉起來——約 3:14）' },
      lose: { text: '別低頭盯著傷口——抬起頭，望向那掛在杆子上的銅蛇，你就必得活！再試一次！' },
      manualQs: [
        { q: '百姓在曠野向神和摩西怨讟，抱怨沒有糧、也沒有甚麼？', options: ['水', '肉', '帳棚', '金子'], answer: '水', basis: '民 21:5' },
        { q: '耶和華使甚麼進入百姓中間咬他們？', options: ['火蛇', '蝗蟲', '獅子', '冰雹'], answer: '火蛇', basis: '民 21:6' },
        { q: '耶和華吩咐摩西製造一條蛇，掛在甚麼上面？', options: ['杆子上', '祭壇上', '帳幕門口', '石堆上'], answer: '杆子上', basis: '民 21:8' },
        { q: '摩西製造的那條蛇，是用甚麼做的？', options: ['銅', '金', '木頭', '泥土'], answer: '銅', basis: '民 21:9' },
        { q: '被蛇咬的人只要怎樣做，就必得活？', options: ['一望這銅蛇', '喝下藥水', '獻上祭物', '逃出營外'], answer: '一望這銅蛇', basis: '民 21:9' },
      ],
    },
    nehemiah: {
      book: 'NEH', ch: 4, emoji: '🧱', title: '尼希米重建城牆', tag: '尼 4・答題對決',
      myEmoji: '🧱', myName: '重建城牆的進度', myGoal: 5,
      foeEmoji: '😈', foeName: '仇敵的攪擾', foeGoal: 5,
      hitText: '🧱 一手做工一手拿兵器，城牆又高一截！', missText: '😈 參巴拉譏誚、仇敵同謀來攻擊…',
      win: { emoji: '🏛️', title: '五十二天，城牆修完了！', text: '任憑仇敵譏誚攻擊，眾人一手做工、一手拿兵器、晝夜趕工——城牆只用五十二天就修完了，因為「我們的神必為我們爭戰」！' },
      lose: { text: '別被譏誚嚇退——「不要怕他們！當記念主是大而可畏的」，重整旗鼓再來過！' },
      manualQs: [
        { q: '參巴拉聽見猶大人修造城牆，就怎樣？', options: ['發怒嗤笑', '前來幫忙', '送禮祝賀', '假裝不知'], answer: '發怒嗤笑', basis: '尼 4:1' },
        { q: '多比雅譏笑說，甚麼上去也必跐倒他們的石牆？', options: ['狐狸', '野狼', '山羊', '老鼠'], answer: '狐狸', basis: '尼 4:3' },
        { q: '修造城牆的人怎樣一邊防備仇敵？', options: ['一手作工一手拿兵器', '停工躲藏', '只顧高築圍籬', '日夜點火示警'], answer: '一手作工一手拿兵器', basis: '尼 4:17' },
        { q: '尼希米說，聽見甚麼聲音就要聚集？', options: ['角聲', '鐘聲', '鼓聲', '號哭聲'], answer: '角聲', basis: '尼 4:20' },
        { q: '耶路撒冷的城牆最後共修了幾天完工？', options: ['五十二天', '四十天', '一百天', '七天'], answer: '五十二天', basis: '尼 6:15' },
      ],
    },
    jehoshaphat: {
      book: '2CH', ch: 20, emoji: '🎶', title: '約沙法唱詩退敵', tag: '代下 20・答題對決',
      myEmoji: '🎶', myName: '走在軍前的讚美', myGoal: 5,
      foeEmoji: '⚔️', foeName: '三國聯軍', foeGoal: 5,
      hitText: '🎶 「他的慈愛永遠長存！」讚美一起，敵陣就亂！', missText: '⚔️ 三國大軍壓境，猶大人心生懼怕…',
      win: { emoji: '🎶', title: '讚美中得了勝！', text: '眾人一唱歌讚美耶和華，耶和華就派伏兵擊殺三國聯軍，敵人自相擊殺——猶大人不用爭戰，只擺陣站著，就看見了神的拯救！' },
      lose: { text: '「勝敗不在乎你們，乃在乎神」——把眼目單單仰望祂，再讚美一次！' },
      manualQs: [
        { q: '大軍來攻，約沙法懼怕之後做了甚麼？', options: ['定意尋求耶和華、宣告禁食', '立刻招兵買馬', '逃往埃及', '向敵人求和'], answer: '定意尋求耶和華、宣告禁食', basis: '代下 20:3' },
        { q: '約沙法禱告說：我們無力抵擋，只把眼目怎樣？', options: ['單仰望神', '轉向盟友', '倚靠城牆', '求告偶像'], answer: '單仰望神', basis: '代下 20:12' },
        { q: '神藉先知說，這場仗的勝敗在乎誰？', options: ['在乎神', '在乎軍隊多寡', '在乎王的智慧', '在乎城牆堅固'], answer: '在乎神', basis: '代下 20:15' },
        { q: '神吩咐他們這次不要爭戰，只要怎樣？', options: ['擺陣站著看神拯救', '主動出擊', '連夜撤退', '築壘防守'], answer: '擺陣站著看神拯救', basis: '代下 20:17' },
        { q: '約沙法設立甚麼人，走在軍隊前面？', options: ['歌唱讚美的人', '弓箭手', '騎兵', '抬約櫃的祭司'], answer: '歌唱讚美的人', basis: '代下 20:21' },
      ],
    },
    dry_bones: {
      book: 'EZK', ch: 37, emoji: '🦴', title: '以西結與枯骨復生', tag: '結 37・答題對決',
      myEmoji: '💨', myName: '神的氣息進入枯骨', myGoal: 5,
      foeEmoji: '🦴', foeName: '極其枯乾的骸骨', foeGoal: 5,
      hitText: '💨 氣息一進入，骨頭就聯絡、有筋有肉！', missText: '🦴 「我們的骨頭枯乾了，指望失去了…」',
      win: { emoji: '🦴', title: '骸骨活了，成為極大的軍隊！', text: '以西結遵命說預言，氣息就進入骸骨——骨與骨聯絡、有筋有肉、皮遮蔽，一站起來竟成為極大的軍隊！神能叫枯乾的以色列全家重新得生。' },
      lose: { text: '再遵命說預言——「我必使氣息進入你們裡面，你們就要活了」，別放棄，再試一次！' },
      manualQs: [
        { q: '耶和華的靈帶以西結到平原，那裡遍滿甚麼？', options: ['骸骨', '荊棘', '帳棚', '羊群'], answer: '骸骨', basis: '結 37:1' },
        { q: '平原上的骸骨甚多，而且怎樣？', options: ['極其枯乾', '濕潤發亮', '剛剛死去', '半埋土中'], answer: '極其枯乾', basis: '結 37:2' },
        { q: '神問以西結：這些骸骨能怎樣？', options: ['能復活嗎', '能站立嗎', '能說話嗎', '能數算嗎'], answer: '能復活嗎', basis: '結 37:3' },
        { q: '以西結一說預言，有響聲地震，骨頭怎樣？', options: ['骨與骨互相聯絡', '化為塵土', '燃燒起來', '沉入地裡'], answer: '骨與骨互相聯絡', basis: '結 37:7' },
        { q: '神說這些骸骨就是誰？', options: ['以色列全家', '埃及的軍隊', '外邦列國', '已死的先知'], answer: '以色列全家', basis: '結 37:11' },
      ],
    },
    ruth: {
      book: 'RUT', ch: 1, emoji: '🌾', title: '路得的忠心與救贖', tag: '得 1・答題對決',
      myEmoji: '🌾', myName: '路得的忠心與殷勤', myGoal: 5,
      foeEmoji: '🥀', foeName: '饑荒與喪親的困苦', foeGoal: 5,
      hitText: '🌾 忠心跟隨、殷勤拾穗，恩典就臨到！', missText: '🥀 饑荒喪親，前路一片愁苦…',
      win: { emoji: '🌾', title: '至近的親屬救贖了她！', text: '路得忠心跟隨拿俄米、殷勤在波阿斯田裡拾穗；波阿斯這位至近的親屬娶了她，生下俄備得——就是大衛王的祖父！神的救贖臨到外邦女子路得。' },
      lose: { text: '「你的神就是我的神」——像路得一樣忠心跟隨到底，恩典必不落空，再試一次！' },
      manualQs: [
        { q: '路得表明忠心，對拿俄米說的是哪一句？', options: ['你的神就是我的神', '我要回我本族去', '從此你我相離', '我另尋出路'], answer: '你的神就是我的神', basis: '得 1:16' },
        { q: '路得去田間做甚麼，養活自己和婆婆？', options: ['拾取麥穗', '牧放羊群', '織布販賣', '挑水打柴'], answer: '拾取麥穗', basis: '得 2:2' },
        { q: '路得恰巧到了誰的那塊田裡拾穗？', options: ['波阿斯', '以利米勒', '拿俄米', '俄備得'], answer: '波阿斯', basis: '得 2:3' },
        { q: '波阿斯娶了路得，她生的兒子取名叫甚麼？', options: ['俄備得', '耶西', '瑪倫', '基連'], answer: '俄備得', basis: '得 4:17' },
        { q: '路得生的俄備得，是哪位以色列王的祖父？', options: ['大衛', '掃羅', '所羅門', '約沙法'], answer: '大衛', basis: '得 4:17' },
      ],
    },
    job: {
      book: 'JOB', ch: 1, emoji: '🌪️', title: '約伯苦難中持守信心', tag: '伯 1・答題對決',
      myEmoji: '🙏', myName: '持守敬畏與信心', myGoal: 5,
      foeEmoji: '🌪️', foeName: '撒但的試探與苦難', foeGoal: 5,
      hitText: '🙏 「賞賜收取都是耶和華」——約伯持守敬畏！', missText: '🌪️ 災禍接連而來，一切都失去了…',
      win: { emoji: '🙌', title: '從苦境轉回，加倍賜福！', text: '約伯在一切苦難中並不以口犯罪，持守敬畏神；他為朋友禱告後，耶和華使他從苦境轉回，賜福比先前加倍！' },
      lose: { text: '「難道我們從神手裡得福，不也受禍嗎？」在患難中持守信心——別放棄，再試一次！' },
      manualQs: [
        { q: '烏斯地的約伯，是個怎樣的人？', options: ['完全正直、敬畏神', '富而驕傲', '詭詐貪心', '懶惰度日'], answer: '完全正直、敬畏神', basis: '伯 1:1' },
        { q: '約伯失去一切仍說「賞賜、收取都是耶和華」，接著稱甚麼是應當稱頌的？', options: ['耶和華的名', '自己的義', '天使的手', '命運的安排'], answer: '耶和華的名', basis: '伯 1:21' },
        { q: '妻子勸他棄掉神，約伯回答：從神手裡得福，不也怎樣？', options: ['受禍', '得賞', '免災', '享福'], answer: '受禍', basis: '伯 2:10' },
        { q: '在這一切的事上，約伯有沒有以口犯罪？', options: ['並不以口犯罪', '埋怨了神', '咒詛了神', '責備了神'], answer: '並不以口犯罪', basis: '伯 2:10' },
        { q: '約伯為朋友禱告後，耶和華賜給他的比從前怎樣？', options: ['加倍', '減半', '相同', '全數收回'], answer: '加倍', basis: '伯 42:10' },
      ],
    },
    david_ark: {
      book: '2SA', ch: 6, emoji: '🕺', title: '大衛迎約櫃跳舞', tag: '撒下 6・答題對決',
      myEmoji: '🕺', myName: '歡呼跳舞迎約櫃', myGoal: 5,
      foeEmoji: '⚠️', foeName: '搬運的攔阻與輕視', foeGoal: 5,
      hitText: '🕺 大衛在耶和華面前極力跳舞，約櫃又近了大衛城！', missText: '⚠️ 牛失前蹄、有人輕視——路上滿是攔阻…',
      win: { emoji: '🕺', title: '約櫃歡然進了大衛城！', text: '大衛穿細麻布以弗得，在耶和華面前極力跳舞；以色列全家歡呼吹角，把約櫃抬進大衛城！大衛說：我在耶和華面前跳舞，就算更卑微也甘心。' },
      lose: { text: '要按神的法度來到祂面前——別怕別人輕視，重整心思再來一次，把約櫃迎進城！' },
      manualQs: [
        { q: '起初大衛他們用甚麼運送神的約櫃？', options: ['新車', '肩膀扛抬', '木筏', '駱駝'], answer: '新車', basis: '撒下 6:3' },
        { q: '牛失前蹄時，烏撒做了甚麼，以致被神擊殺？', options: ['伸手扶住約櫃', '逃跑躲避', '大聲呼喊', '鞭打牛群'], answer: '伸手扶住約櫃', basis: '撒下 6:6-7' },
        { q: '大衛穿著細麻布的以弗得，在耶和華面前做甚麼？', options: ['極力跳舞', '俯伏禱告', '獻上燔祭', '高聲讀律法'], answer: '極力跳舞', basis: '撒下 6:14' },
        { q: '約櫃抬上來時，以色列全家怎樣慶賀？', options: ['歡呼吹角', '默然肅立', '撒灰痛哭', '各自回家'], answer: '歡呼吹角', basis: '撒下 6:15' },
        { q: '誰從窗戶看見大衛跳舞，心裡就輕視他？', options: ['米甲', '拔示巴', '亞比該', '拿俄米'], answer: '米甲', basis: '撒下 6:16' },
      ],
    },
    lazarus: {
      book: 'JHN', ch: 11, emoji: '⚰️', title: '拉撒路復活', tag: '約 11・答題對決',
      myEmoji: '🗣️', myName: '耶穌呼喚：出來！', myGoal: 5,
      foeEmoji: '⚰️', foeName: '四天的死亡與墳墓', foeGoal: 5,
      hitText: '🗣️ 「復活在我，生命也在我！」死亡攔不住主的話！', missText: '⚰️ 「他現在必是臭了，死了已經四天了…」',
      win: { emoji: '🙌', title: '拉撒路出來了！', text: '耶穌大聲呼叫：「拉撒路出來！」那死了四天的人就手腳裹著布走出墳墓——耶穌說：復活在我，生命也在我！信祂的人雖然死了，也必復活。' },
      lose: { text: '「你若信，就必看見神的榮耀」——把石頭挪開、抬起信心，再呼求一次！' },
      manualQs: [
        { q: '耶穌到的時候，拉撒路在墳墓裡已經幾天了？', options: ['四天', '一天', '三天', '七天'], answer: '四天', basis: '約 11:17' },
        { q: '耶穌對馬大說：復活在我，還有甚麼也在我？', options: ['生命', '智慧', '平安', '公義'], answer: '生命', basis: '約 11:25' },
        { q: '在墳墓前，耶穌流露了甚麼？', options: ['耶穌哭了', '耶穌笑了', '耶穌發怒', '耶穌沉默離開'], answer: '耶穌哭了', basis: '約 11:35' },
        { q: '耶穌吩咐把墳墓口的甚麼挪開？', options: ['石頭', '木門', '帳幔', '泥土'], answer: '石頭', basis: '約 11:39' },
        { q: '耶穌大聲呼叫哪句話，拉撒路就出來了？', options: ['拉撒路出來！', '起來行走！', '平安了吧！', '你的信救了你！'], answer: '拉撒路出來！', basis: '約 11:43' },
      ],
    },
    // ===== 第 1 波「每卷都有小遊戲」（2026-07-18）：3 款動作＋8 款對決 =====
    fruit_spirit: {
      book: 'GAL', ch: 5, emoji: '🍇', title: '結出聖靈果', tag: '加 5・澆灌時機',
      myEmoji: '🍇', myName: '聖靈的果子', myGoal: 9,
      foeEmoji: '🥀', foeName: '情慾的荊棘', foeGoal: 3,
      hitText: '💧 澆灌得時，又結出一樣果子！', missText: '🥀 荊棘悄悄長出來了…',
      win: { emoji: '🍇', title: '九樣果子都結出來了！', text: '聖靈所結的果子，就是仁愛、喜樂、和平、忍耐、恩慈、良善、信實、溫柔、節制——這樣的事，沒有律法禁止！（加 5:22-23）' },
      lose: { text: '荊棘擋住了果子——「我們行善，不可喪志；若不灰心，到了時候就要收成。」再種一次！（加 6:9）' },
      manualQs: [
        { q: '聖靈所結的果子共有幾樣？', options: ['九樣', '七樣', '十樣', '十二樣'], answer: '九樣', basis: '加 5:22-23' },
        { q: '下列哪一個是聖靈所結的果子？', options: ['溫柔', '驕傲', '嫉妒', '惱怒'], answer: '溫柔', basis: '加 5:23' },
        { q: '聖靈果子的第一樣是甚麼？', options: ['仁愛', '喜樂', '和平', '忍耐'], answer: '仁愛', basis: '加 5:22' },
        { q: '「我們行善，不可＿＿；若不灰心，到了時候就要收成」？', options: ['喪志', '休息', '出聲', '遲延'], answer: '喪志', basis: '加 6:9' },
        { q: '「現在活着的不再是我，乃是＿＿在我裏面活着」？', options: ['基督', '律法', '天使', '摩西'], answer: '基督', basis: '加 2:20' },
      ],
    },
    foxes: {
      book: 'SNG', ch: 2, emoji: '🦊', title: '擒拿小狐狸', tag: '歌 2・葡萄園打地鼠',
      myEmoji: '🍇', myName: '看守葡萄園', myGoal: 10,
      foeEmoji: '🦊', foeName: '小狐狸偷吃', foeGoal: 5,
      hitText: '🍇 擒住一隻，葡萄花保住了！', missText: '🦊 小狐狸溜進來咬了一串…',
      win: { emoji: '🍇', title: '葡萄園守住了！', text: '「要給我們擒拿狐狸，就是毀壞葡萄園的小狐狸，因為我們的葡萄正在開花。」小事忠心看守，花期就能結果！（歌 2:15）' },
      lose: { text: '狐狸吃掉太多葡萄了——別灰心，葡萄還會再開花，回去再守一輪！' },
      manualQs: [
        { q: '雅歌說毀壞葡萄園的是甚麼動物？', options: ['小狐狸', '小獅子', '野豬', '蝗蟲'], answer: '小狐狸', basis: '歌 2:15' },
        { q: '要擒拿小狐狸，因為葡萄正在做甚麼？', options: ['正在開花', '已經熟透', '正被收成', '正在發芽'], answer: '正在開花', basis: '歌 2:15' },
        { q: '「良人屬我，我也屬他」，他在哪裡牧放群羊？', options: ['百合花中', '青草地上', '溪水旁邊', '山谷裡面'], answer: '百合花中', basis: '歌 2:16' },
        { q: '「愛情，眾水不能＿＿，大水也不能淹沒」？', options: ['息滅', '沖走', '替代', '搖動'], answer: '息滅', basis: '歌 8:7' },
        { q: '書拉密女為甚麼被日頭曬黑？', options: ['被派看守葡萄園', '在海邊玩耍', '出門牧放羊群', '下田收割麥子'], answer: '被派看守葡萄園', basis: '歌 1:6' },
      ],
    },
    eagle: {
      book: 'ISA', ch: 40, emoji: '🦅', title: '如鷹展翅', tag: '賽 40・點擊上騰',
      myEmoji: '🦅', myName: '展翅上騰', myGoal: 8,
      foeEmoji: '☁️', foeName: '疲乏困倦', foeGoal: 3,
      hitText: '🦅 從新得力，又飛越一程！', missText: '☁️ 疲乏的烏雲攏過來了…',
      win: { emoji: '🦅', title: '如鷹展翅上騰！', text: '「但那等候耶和華的必從新得力。他們必如鷹展翅上騰；他們奔跑卻不困倦，行走卻不疲乏。」（賽 40:31）' },
      lose: { text: '翅膀沉了下來——等候耶和華的必從新得力，深呼吸，再飛一次！' },
      manualQs: [
        { q: '等候耶和華的必從新得力，必如甚麼展翅上騰？', options: ['鷹', '鴿子', '麻雀', '白鶴'], answer: '鷹', basis: '賽 40:31' },
        { q: '「他們奔跑卻不＿＿，行走卻不疲乏」？', options: ['困倦', '跌倒', '停止', '回頭'], answer: '困倦', basis: '賽 40:31' },
        { q: '「草必枯乾，花必凋殘」，惟有甚麼永遠立定？', options: ['神的話', '高山', '星宿', '江河'], answer: '神的話', basis: '賽 40:8' },
        { q: '以賽亞聽見主說「我可以差遣誰呢」，他怎麼回應？', options: ['我在這裏，請差遣我', '請差遣別人去', '容我先回家', '我口舌笨拙'], answer: '我在這裏，請差遣我', basis: '賽 6:8' },
        { q: '「因有一嬰孩為我們而生」，政權必擔在他的哪裡？', options: ['肩頭上', '手掌中', '冠冕上', '寶座上'], answer: '肩頭上', basis: '賽 9:6' },
      ],
    },
    ezra_temple: {
      book: 'EZR', ch: 3, emoji: '🏗️', title: '聖殿拼圖', tag: '拉 3-6・拖放建材',
      myEmoji: '🏗️', myName: '聖殿一層層立起', myGoal: 5,
      foeEmoji: '😈', foeName: '仇敵擾亂攔阻', foeGoal: 5,
      hitText: '🏗️ 又立起一層，眾民大聲讚美！', missText: '😈 那地的民使他們的手發軟…',
      win: { emoji: '🎉', title: '這殿修成了！', text: '從立根基時的歡呼讚美，到大利烏王第六年亞達月初三——這殿修成了！他本為善，他向以色列人永發慈愛。（拉 3:11、6:15）' },
      lose: { text: '手發軟了嗎？想想先知哈該和撒迦利亞的勸勉——神的殿值得再拿起工具，重來一次！' },
      manualQs: [
        { q: '降旨讓猶大人回耶路撒冷重建聖殿的波斯王是誰？', options: ['古列', '大利烏', '亞哈隨魯', '尼布甲尼撒'], answer: '古列', basis: '拉 1:2-3' },
        { q: '聖殿根基立定時，眾民做了甚麼？', options: ['大聲呼喊讚美耶和華', '安靜地各自回家', '害怕得四散逃跑', '立刻蓋上屋頂'], answer: '大聲呼喊讚美耶和華', basis: '拉 3:11' },
        { q: '那地的民怎樣攔阻建殿的工程？', options: ['使他們的手發軟、擾亂他們', '送上禮物幫忙', '一起唱詩讚美', '借他們建殿工具'], answer: '使他們的手發軟、擾亂他們', basis: '拉 4:4' },
        { q: '奉神的名勸勉猶大人繼續建殿的兩位先知是誰？', options: ['哈該和撒迦利亞', '以賽亞和耶利米', '約珥和阿摩司', '拿單和迦得'], answer: '哈該和撒迦利亞', basis: '拉 5:1' },
        { q: '這殿在哪位王的年間修成？', options: ['大利烏王', '古列王', '所羅門王', '希西家王'], answer: '大利烏王', basis: '拉 6:15' },
      ],
    },
    micah_walk: {
      book: 'MIC', ch: 6, emoji: '⚖️', title: '與神同行三重奏', tag: '彌 6・三軌音符',
      myEmoji: '👣', myName: '與神同行的腳步', myGoal: 5,
      foeEmoji: '🌀', foeName: '世界的歪路', foeGoal: 5,
      hitText: '👣 行公義、好憐憫，又走穩一步！', missText: '🌀 歪路的風又吹過來了…',
      win: { emoji: '⚖️', title: '與神同行！', text: '「世人哪，耶和華已指示你何為善。他向你所要的是甚麼呢？只要你行公義，好憐憫，存謙卑的心，與你的神同行。」（彌 6:8）' },
      lose: { text: '走岔了嗎？神要的不是千千的公羊，是你的心——回到起點，再走一次！' },
      manualQs: [
        { q: '耶和華向你所要的三樣：行公義、好憐憫，還有甚麼？', options: ['存謙卑的心與神同行', '多多獻上祭物', '天天禁食禱告', '嚴守安息日'], answer: '存謙卑的心與神同行', basis: '彌 6:8' },
        { q: '將來必有一位掌權者，從猶大的哪座小城出來？', options: ['伯利恆', '耶路撒冷', '拿撒勒', '伯特利'], answer: '伯利恆', basis: '彌 5:2' },
        { q: '神要將我們的一切罪投於哪裡？', options: ['深海', '曠野', '火中', '深坑'], answer: '深海', basis: '彌 7:19' },
        { q: '「他們要將刀打成＿＿，把槍打成鐮刀」？', options: ['犁頭', '鋤頭', '盾牌', '釘子'], answer: '犁頭', basis: '彌 4:3' },
        { q: '那位從伯利恆出來的掌權者，根源從何時就有？', options: ['從亙古、從太初', '從大衛年間', '從出埃及時', '從被擄歸回後'], answer: '從亙古、從太初', basis: '彌 5:2' },
      ],
    },
    malachi_window: {
      book: 'MAL', ch: 3, emoji: '🪟', title: '敞開天窗', tag: '瑪 3・答題對決',
      myEmoji: '🌾', myName: '倉庫滿了糧', myGoal: 5,
      foeEmoji: '🦗', foeName: '吞噬者毀壞土產', foeGoal: 5,
      hitText: '🌾 十分之一全然送入，倉庫又滿一層！', missText: '🦗 吞噬者在田間出沒…',
      win: { emoji: '🪟', title: '天上的窗戶敞開了！', text: '「你們要將當納的十分之一全然送入倉庫……以此試試我，是否為你們敞開天上的窗戶，傾福與你們，甚至無處可容。」（瑪 3:10）' },
      lose: { text: '田間被吞噬者攪擾了——神說「以此試試我」，鼓起信心，再獻上一次！' },
      manualQs: [
        { q: '要將當納的十分之一全然送入哪裡？', options: ['倉庫', '聖殿門口', '祭壇上面', '城門口'], answer: '倉庫', basis: '瑪 3:10' },
        { q: '神應許敞開甚麼，傾福與你們甚至無處可容？', options: ['天上的窗戶', '地上的江河', '榮耀的雲彩', '城裡的大門'], answer: '天上的窗戶', basis: '瑪 3:10' },
        { q: '神說必為你們斥責甚麼，不容牠毀壞土產？', options: ['蝗蟲（吞噬者）', '野獸', '暴風', '仇敵'], answer: '蝗蟲（吞噬者）', basis: '瑪 3:11' },
        { q: '向敬畏神名的人，必有甚麼出現、其光線有醫治之能？', options: ['公義的日頭', '明亮的晨星', '七色的彩虹', '榮耀的雲柱'], answer: '公義的日頭', basis: '瑪 4:2' },
        { q: '「我要差遣我的使者，在我前面＿＿」？', options: ['預備道路', '吹角報信', '築起高臺', '點亮明燈'], answer: '預備道路', basis: '瑪 3:1' },
      ],
    },
    zeph_song: {
      book: 'ZEP', ch: 3, emoji: '🎵', title: '跟著祂的歌聲', tag: '番 3・描線跟隨',
      myEmoji: '🎵', myName: '神的歌聲環繞', myGoal: 5,
      foeEmoji: '🌫️', foeName: '大日的陰霾', foeGoal: 5,
      hitText: '🎵 祂在你中間，因你喜樂而歡呼！', missText: '🌫️ 陰霾罩下來，聽不見歌聲了…',
      win: { emoji: '🎵', title: '祂因你喜樂而歡呼！', text: '「耶和華你的神是施行拯救、大有能力的主。他在你中間必因你歡欣喜樂，默然愛你，且因你喜樂而歡呼。」（番 3:17）' },
      lose: { text: '先別急——「當尋求耶和華」，安靜下來，再聽一次那首為你唱的歌！' },
      manualQs: [
        { q: '耶和華在你中間，必因你怎樣？', options: ['歡欣喜樂', '憂愁歎息', '沉默不語', '轉身離開'], answer: '歡欣喜樂', basis: '番 3:17' },
        { q: '「默然愛你，且因你喜樂而＿＿」？', options: ['歡呼', '流淚', '歎息', '靜坐'], answer: '歡呼', basis: '番 3:17' },
        { q: '耶和華你的神是施行拯救、大有甚麼的主？', options: ['能力', '財富', '軍隊', '宮殿'], answer: '能力', basis: '番 3:17' },
        { q: '謙卑人當尋求甚麼，或者在耶和華發怒的日子可以隱藏？', options: ['公義謙卑', '金銀財寶', '高牆堅城', '快馬車輛'], answer: '公義謙卑', basis: '番 2:3' },
        { q: '那時神必使萬民用甚麼求告耶和華的名？', options: ['清潔的言語', '各國的方言', '大聲的呼喊', '古老的詩歌'], answer: '清潔的言語', basis: '番 3:9' },
      ],
    },
    nahum_refuge: {
      book: 'NAM', ch: 1, emoji: '🏰', title: '保障開門', tag: '鴻 1・開門辨識',
      myEmoji: '🏰', myName: '投靠祂的保障', myGoal: 5,
      foeEmoji: '🌪️', foeName: '患難的風暴', foeGoal: 5,
      hitText: '🏰 又往保障裡躲進一步，祂認得你！', missText: '🌪️ 風暴呼嘯，越來越近…',
      win: { emoji: '🏰', title: '祂認得投靠祂的人！', text: '「耶和華本為善，在患難的日子為人的保障，並且認得那些投靠他的人。」（鴻 1:7）' },
      lose: { text: '風暴太猛了嗎？記住——祂乘旋風和暴風而來，風暴也在祂腳下。再跑進保障一次！' },
      manualQs: [
        { q: '「耶和華本為善，在患難的日子為人的＿＿」？', options: ['保障', '燈塔', '影子', '帳棚'], answer: '保障', basis: '鴻 1:7' },
        { q: '耶和華認得哪些人？', options: ['投靠他的人', '富足的人', '有學問的人', '強壯的人'], answer: '投靠他的人', basis: '鴻 1:7' },
        { q: '耶和華不輕易發怒，他乘甚麼而來？', options: ['旋風和暴風', '火車和火馬', '白雲和寶座', '大鷹的翅膀'], answer: '旋風和暴風', basis: '鴻 1:3' },
        { q: '雲彩是他腳下的甚麼？', options: ['塵土', '地毯', '枕頭', '道路'], answer: '塵土', basis: '鴻 1:3' },
        { q: '「有報好信傳平安之人的腳登山」，他傳的是甚麼？', options: ['平安', '戰爭', '饑荒', '審判'], answer: '平安', basis: '鴻 1:15' },
      ],
    },
    obadiah_pride: {
      book: 'OBA', ch: 1, emoji: '⛰️', title: '驕傲必墜', tag: '俄・左右閃避',
      myEmoji: '⛰️', myName: '在錫安山站穩', myGoal: 5,
      foeEmoji: '🦅', foeName: '以東的驕傲高飛', foeGoal: 5,
      hitText: '⛰️ 謙卑站穩，錫安必有逃脫的人！', missText: '🦅 以東又往星宿之間搭窩…',
      win: { emoji: '⛰️', title: '謙卑的人站住了！', text: '「你雖如大鷹高飛，在星宿之間搭窩，我必從那裏拉下你來。」在錫安山必有逃脫的人，那山也必成聖！（俄 4、17）' },
      lose: { text: '被驕傲的氣勢壓住了嗎？「你因狂傲自欺」說的是以東不是你——穩住腳步，再站一次！' },
      manualQs: [
        { q: '俄巴底亞書責備的以東人，住在哪裡而心高氣傲？', options: ['山穴中、居所在高處', '海島的港口', '平原的大城', '大河的兩岸'], answer: '山穴中、居所在高處', basis: '俄 3' },
        { q: '「你雖如大鷹高飛，在＿＿之間搭窩，我必從那裏拉下你來」？', options: ['星宿', '雲彩', '山頂', '樹梢'], answer: '星宿', basis: '俄 4' },
        { q: '使以東心裏自欺的是甚麼？', options: ['狂傲', '財寶', '朋友', '謊言'], answer: '狂傲', basis: '俄 3' },
        { q: '在哪座山必有逃脫的人，那山也必成聖？', options: ['錫安山', '西奈山', '迦密山', '何烈山'], answer: '錫安山', basis: '俄 17' },
        { q: '「你怎樣行，他也必照樣向你行」，報應必歸到哪裡？', options: ['你頭上', '你腳下', '你手中', '你家中'], answer: '你頭上', basis: '俄 15' },
      ],
    },
    amos_river: {
      book: 'AMO', ch: 5, emoji: '🏞️', title: '敲通公義河道', tag: '摩 5・敲石開河',
      myEmoji: '🌊', myName: '公義如江河湧流', myGoal: 5,
      foeEmoji: '🪨', foeName: '不義的土石堵塞', foeGoal: 5,
      hitText: '🌊 河道通了，公平如大水滾滾！', missText: '🪨 不義的土石又堵住河道…',
      win: { emoji: '🏞️', title: '江河滔滔！', text: '「惟願公平如大水滾滾，使公義如江河滔滔。」神要的不是熱鬧的節期，是流進生活每個角落的公義！（摩 5:24）' },
      lose: { text: '河道被堵住了——先知阿摩司本是牧人，神照樣用他。捲起袖子，再疏通一次！' },
      manualQs: [
        { q: '「惟願公平如大水滾滾，使公義如＿＿滔滔」？', options: ['江河', '瀑布', '海浪', '湧泉'], answer: '江河', basis: '摩 5:24' },
        { q: '阿摩司說自己原本的職業是甚麼？', options: ['牧人，又修理桑樹', '祭司', '文士', '漁夫'], answer: '牧人，又修理桑樹', basis: '摩 7:14' },
        { q: '主耶和華若不將奧祕指示誰，就一無所行？', options: ['他的僕人眾先知', '列國的君王', '聰明的智者', '天上的使者'], answer: '他的僕人眾先知', basis: '摩 3:7' },
        { q: '神說將來要降的饑荒，人飢餓不是因無餅，是因甚麼？', options: ['不聽耶和華的話', '田地歉收', '仇敵搶奪', '河水乾涸'], answer: '不聽耶和華的話', basis: '摩 8:11' },
        { q: '阿摩司說「我原不是先知，也不是」甚麼？', options: ['先知的門徒', '牧人', '農夫', '以色列人'], answer: '先知的門徒', basis: '摩 7:14' },
      ],
    },
    hosea_love: {
      book: 'HOS', ch: 3, emoji: '💗', title: '慈繩愛索', tag: '何 11・旋轉接繩',
      myEmoji: '💗', myName: '慈繩愛索牽引', myGoal: 5,
      foeEmoji: '🌫️', foeName: '越走越遠的心', foeGoal: 5,
      hitText: '💗 慈繩愛索又牽近一步！', missText: '🌫️ 那顆心又往遠處飄去…',
      win: { emoji: '💗', title: '用愛贖回來了！', text: '「我用慈繩愛索牽引他們……我必醫治他們背道的病，甘心愛他們。」何西阿用銀子把妻子買回家，神也這樣把我們贖回來！（何 11:4、14:4）' },
      lose: { text: '那顆心走遠了嗎？神的愛沒有放棄——「我們務要認識耶和華，竭力追求認識他」，再追一次！' },
      manualQs: [
        { q: '何西阿用多少銀子買回妻子歸自己？', options: ['十五舍客勒', '三十舍客勒', '十舍客勒', '五十舍客勒'], answer: '十五舍客勒', basis: '何 3:2' },
        { q: '神說「我用慈繩＿＿牽引他們」？', options: ['愛索', '鐵鏈', '韁繩', '漁網'], answer: '愛索', basis: '何 11:4' },
        { q: '「我必醫治他們＿＿的病，甘心愛他們」？', options: ['背道', '眼睛', '手腳', '心口'], answer: '背道', basis: '何 14:4' },
        { q: '「他出現確如晨光，必臨到我們像甘雨」，還像甚麼？', options: ['滋潤田地的春雨', '夏日的烈陽', '冬天的初雪', '晚間的涼風'], answer: '滋潤田地的春雨', basis: '何 6:3' },
        { q: '「我們務要認識耶和華」，要怎樣追求認識他？', options: ['竭力', '慢慢', '偶爾', '靠別人'], answer: '竭力', basis: '何 6:3' },
      ],
    },
    // ===== 第 2 波（2026-07-18）：4 款動作＋6 款對決 =====
    psalm_shepherd: {
      book: 'PSA', ch: 23, emoji: '🐑', title: '牧人的杖', tag: '詩 23・幽谷跟隨',
      myEmoji: '🐑', myName: '緊跟牧人', myGoal: 5,
      foeEmoji: '🌑', foeName: '死蔭的幽谷', foeGoal: 5,
      hitText: '🐑 有你的杖你的竿安慰我，又走穩一步！', missText: '🌑 幽谷的影子罩過來了…',
      win: { emoji: '🐑', title: '走過死蔭的幽谷！', text: '「我雖然行過死蔭的幽谷，也不怕遭害，因為你與我同在；你的杖，你的竿，都安慰我。」（詩 23:4）' },
      lose: { text: '小羊跌倒了嗎？牧人沒有走遠——「耶和華是我的牧者」，起來再跟一次！' },
      manualQs: [
        { q: '「耶和華是我的牧者」，我必不至怎樣？', options: ['缺乏', '跌倒', '迷路', '生病'], answer: '缺乏', basis: '詩 23:1' },
        { q: '他使我躺臥在哪裡？', options: ['青草地上', '高山上', '帳棚裡', '磐石上'], answer: '青草地上', basis: '詩 23:2' },
        { q: '行過死蔭的幽谷也不怕遭害，因為甚麼？', options: ['你與我同在', '我夠勇敢', '有人陪我', '路程很短'], answer: '你與我同在', basis: '詩 23:4' },
        { q: '「你的杖，你的竿」，都怎樣我？', options: ['安慰', '責打', '攔阻', '催促'], answer: '安慰', basis: '詩 23:4' },
        { q: '在我敵人面前，神為我擺設甚麼？', options: ['筵席', '高牆', '軍隊', '帳幕'], answer: '筵席', basis: '詩 23:5' },
      ],
    },
    wisdom_house: {
      book: 'PRO', ch: 9, emoji: '🏛️', title: '智慧建屋', tag: '箴 9・時機疊柱',
      myEmoji: '🏛️', myName: '鑿成七根柱子', myGoal: 7,
      foeEmoji: '🌪️', foeName: '愚昧的搖晃', foeGoal: 2,
      hitText: '🏛️ 又立穩一根柱子！', missText: '🌪️ 柱子歪了，房子在搖…',
      win: { emoji: '🏛️', title: '七根柱子立穩了！', text: '「智慧建造房屋，鑿成七根柱子。」敬畏耶和華是智慧的開端，一根一根穩穩地立在祂話語上！（箴 9:1、9:10）' },
      lose: { text: '房子塌了——不倚靠自己的聰明，專心仰賴耶和華，重新起造！（箴 3:5）' },
      manualQs: [
        { q: '智慧建造房屋，鑿成幾根柱子？', options: ['七根', '十根', '四根', '十二根'], answer: '七根', basis: '箴 9:1' },
        { q: '甚麼是智慧的開端？', options: ['敬畏耶和華', '飽讀詩書', '年高德劭', '家財萬貫'], answer: '敬畏耶和華', basis: '箴 9:10' },
        { q: '「你要專心仰賴耶和華」，不可倚靠甚麼？', options: ['自己的聰明', '父母的話', '朋友的話', '王的命令'], answer: '自己的聰明', basis: '箴 3:5' },
        { q: '「喜樂的心乃是良藥」，憂傷的靈使甚麼枯乾？', options: ['骨頭', '花草', '井水', '樹木'], answer: '骨頭', basis: '箴 17:22' },
        { q: '教養孩童使他走當行的道，到老會怎樣？', options: ['也不偏離', '也會忘記', '自己選路', '不再需要'], answer: '也不偏離', basis: '箴 22:6' },
      ],
    },
    potter_hands: {
      book: 'JER', ch: 18, emoji: '🏺', title: '窯匠的手', tag: '耶 18・按住拉坯',
      myEmoji: '🏺', myName: '塑成合用的器皿', myGoal: 3,
      foeEmoji: '💔', foeName: '走樣的泥', foeGoal: 3,
      hitText: '🏺 在窯匠手中，又塑好一段！', missText: '💔 泥在轉輪上走樣了…',
      win: { emoji: '🏺', title: '成了合用的器皿！', text: '「泥在窯匠的手中怎樣，你們在我的手中也怎樣。」就算作壞了，他也用這泥另作——你永遠有重新被塑造的機會！（耶 18:4,6）' },
      lose: { text: '泥壞了？別怕——窯匠看怎樣好，就怎樣作。把泥放回轉輪，再來一次！' },
      manualQs: [
        { q: '耶利米下到窯匠家，正遇見他做甚麼？', options: ['轉輪作器皿', '燒火烤窯', '挑水和泥', '雕刻石頭'], answer: '轉輪作器皿', basis: '耶 18:3' },
        { q: '器皿在窯匠手中作壞了，窯匠怎麼辦？', options: ['用這泥另作別的器皿', '把泥丟掉不要', '大發脾氣休息', '換一塊新的泥'], answer: '用這泥另作別的器皿', basis: '耶 18:4' },
        { q: '神說以色列家在祂手中，像甚麼？', options: ['泥在窯匠的手中', '劍在勇士手中', '筆在文士手中', '琴在樂師手中'], answer: '泥在窯匠的手中', basis: '耶 18:6' },
        { q: '神向我們所懷的，是甚麼意念？', options: ['賜平安的意念', '降災禍的意念', '觀望的意念', '隱藏的意念'], answer: '賜平安的意念', basis: '耶 29:11' },
        { q: '「你未出母胎」，神已經怎樣待你？', options: ['分別你為聖', '給你起名字', '賜你財富', '立你作王'], answer: '分別你為聖', basis: '耶 1:5' },
      ],
    },
    joel_locusts: {
      book: 'JOL', ch: 2, emoji: '🌻', title: '蝗蟲退散', tag: '珥 2・滑掃蝗蟲',
      myEmoji: '🌾', myName: '守住田地', myGoal: 5,
      foeEmoji: '🦗', foeName: '蝗蟲大軍', foeGoal: 5,
      hitText: '🌾 趕走一群，麥子保住了！', missText: '🦗 蝗蟲又啃掉一片…',
      win: { emoji: '🌻', title: '田地復甦了！', text: '「蝗蟲那些年所吃的，我要補還你們。」神不只趕走蝗蟲，還把失去的年歲補回來！（珥 2:25）' },
      lose: { text: '麥田被吃光了嗎？神說「我要補還你們」——撕裂心腸歸向祂，再守一次！（珥 2:13）' },
      manualQs: [
        { q: '神應許要補還甚麼？', options: ['蝗蟲那些年所吃的', '被偷走的金銀', '倒塌的房屋', '失散的牛羊'], answer: '蝗蟲那些年所吃的', basis: '珥 2:25' },
        { q: '「我要將我的靈澆灌」誰？', options: ['凡有血氣的', '只有先知', '只有祭司', '只有君王'], answer: '凡有血氣的', basis: '珥 2:28' },
        { q: '神的靈澆灌後，老年人要作甚麼？', options: ['異夢', '新歌', '講道', '筵席'], answer: '異夢', basis: '珥 2:28' },
        { q: '「你們要撕裂＿＿，不撕裂衣服」？', options: ['心腸', '書卷', '帳棚', '地土'], answer: '心腸', basis: '珥 2:13' },
        { q: '「剪蟲剩下的」，誰來吃？', options: ['蝗蟲', '蝻子', '螞蚱', '野狗'], answer: '蝗蟲', basis: '珥 1:4' },
      ],
    },
    atonement: {
      book: 'LEV', ch: 16, emoji: '🕊️', title: '潔與不潔', tag: '利 11・左右快分',
      myEmoji: '🕊️', myName: '得潔淨的路', myGoal: 5,
      foeEmoji: '⚖️', foeName: '罪的重擔', foeGoal: 5,
      hitText: '🕊️ 罪被挪去，又輕省一步！', missText: '⚖️ 罪的重擔還壓在肩上…',
      win: { emoji: '🕊️', title: '分得又快又準！', text: '「你們要成為聖潔，因為我是聖潔的。」利未記的條例在教一件事：神的子民連日常生活都跟別人不一樣！（利 11:44）' },
      lose: { text: '分錯了嗎？記口訣：走獸要「分蹄又倒嚼」、水族要「有翅又有鱗」——再分一次！（利 11:3,9）' },
      manualQs: [
        { q: '贖罪日這日要為你們贖罪，使你們怎樣？', options: ['潔淨', '富足', '強壯', '快樂'], answer: '潔淨', basis: '利 16:30' },
        { q: '大祭司兩手按在羊頭上做甚麼？', options: ['承認以色列人諸般的罪孽', '為羊群祝福', '量羊的重量', '給羊做記號'], answer: '承認以色列人諸般的罪孽', basis: '利 16:21' },
        { q: '那隻擔當罪孽的羊，被送到哪裡？', options: ['曠野無人之地', '聖殿的院子', '城門口', '約旦河邊'], answer: '曠野無人之地', basis: '利 16:22' },
        { q: '「要愛人如己」這句話，最早寫在哪卷書？', options: ['利未記', '申命記', '馬太福音', '羅馬書'], answer: '利未記', basis: '利 19:18' },
        { q: '「你們要成為聖潔」，因為甚麼？', options: ['我耶和華是聖潔的', '天使是聖潔的', '祭司是聖潔的', '聖殿是聖潔的'], answer: '我耶和華是聖潔的', basis: '利 11:44' },
      ],
    },
    choose_life: {
      book: 'DEU', ch: 30, emoji: '💚', title: '金句拼回來', tag: '申 6・記憶拼句',
      myEmoji: '💚', myName: '揀選生命的路', myGoal: 5,
      foeEmoji: '🥀', foeName: '忘記神的路', foeGoal: 5,
      hitText: '💚 記住祂的話，又選對一步！', missText: '🥀 心又飄向忘記神的路…',
      win: { emoji: '💚', title: '揀選了生命！', text: '「我將生死、禍福陳明在你面前，所以你要揀選生命，使你和你的後裔都得存活。」（申 30:19）' },
      lose: { text: '選岔路了嗎？神的話今日仍陳明在你面前——回頭，再選一次生命！' },
      manualQs: [
        { q: '神將生死禍福陳明在你面前，要你揀選甚麼？', options: ['生命', '財富', '土地', '長壽'], answer: '生命', basis: '申 30:19' },
        { q: '「以色列啊，你要聽！」耶和華我們神是怎樣的主？', options: ['獨一的', '眾多的', '遙遠的', '隱藏的'], answer: '獨一的', basis: '申 6:4' },
        { q: '要怎樣愛耶和華你的神？', options: ['盡心、盡性、盡力', '每週奉獻一次', '獻上牛羊祭物', '大聲唱詩讚美'], answer: '盡心、盡性、盡力', basis: '申 6:5' },
        { q: '「人活着不是單靠食物」，乃是靠甚麼？', options: ['耶和華口裏所出的一切話', '曠野降下的嗎哪', '勇氣和恆心', '家人和朋友'], answer: '耶和華口裏所出的一切話', basis: '申 8:3' },
        { q: '「當剛強壯膽」，因為耶和華必不怎樣？', options: ['撇下你，也不丟棄你', '責備你的軟弱', '考驗你的信心', '離開會幕'], answer: '撇下你，也不丟棄你', basis: '申 31:6' },
      ],
    },
    david_offering: {
      book: '1CH', ch: 29, emoji: '🎁', title: '一筆畫獻材料', tag: '代上 29・一筆連線',
      myEmoji: '🎁', myName: '樂意的奉獻', myGoal: 5,
      foeEmoji: '⏳', foeName: '捨不得的心', foeGoal: 5,
      hitText: '🎁 誠心樂意，又獻上一份！', missText: '⏳ 手又縮回去了…',
      win: { emoji: '🎁', title: '誠心樂意獻上！', text: '「我算甚麼，我的民算甚麼，竟能如此樂意奉獻？因為萬物都從你而來，我們把從你而得的獻給你。」（代上 29:14）' },
      lose: { text: '捨不得嗎？想想大衛：連自己積蓄的金銀都獻上了——因為萬物本來就從神而來。再獻一次！' },
      manualQs: [
        { q: '大衛因愛慕神的殿，把甚麼也獻上建殿？', options: ['自己積蓄的金銀', '王冠和寶座', '戰爭的擄物', '百姓的稅收'], answer: '自己積蓄的金銀', basis: '代上 29:3' },
        { q: '百姓怎樣獻給耶和華，大衛就大大歡喜？', options: ['誠心樂意', '勉強交差', '互相比較', '怕受責罰'], answer: '誠心樂意', basis: '代上 29:9' },
        { q: '「尊大、能力、榮耀、強勝、威嚴」都是誰的？', options: ['耶和華的', '大衛的', '所羅門的', '以色列的'], answer: '耶和華的', basis: '代上 29:11' },
        { q: '大衛說「我們把從你而得的獻給你」，因為萬物都從哪裡來？', options: ['從神而來', '從地裡長出', '從列國進貢', '從祖先留下'], answer: '從神而來', basis: '代上 29:14' },
        { q: '「應當稱謝耶和華」，因他本為善，他的甚麼永遠長存？', options: ['慈愛', '國度', '城牆', '約櫃'], answer: '慈愛', basis: '代上 16:34' },
      ],
    },
    ecc_sun: {
      book: 'ECC', ch: 12, emoji: '☀️', title: '凡事都有定時', tag: '傳 3・定時轉盤',
      myEmoji: '☀️', myName: '敬畏神的智慧', myGoal: 5,
      foeEmoji: '🌫️', foeName: '虛空的捕風', foeGoal: 5,
      hitText: '☀️ 看見日光之上的答案了！', missText: '🌫️ 虛空的虛空，都是捕風…',
      win: { emoji: '☀️', title: '抓住神的時候！', text: '「凡事都有定期，天下萬務都有定時。」神造萬物，各按其時成為美好——你抓住了每一個時候！（傳 3:1,11）' },
      lose: { text: '按錯時候了嗎？「凡事都有定期」——不急，等指針轉到對的時節，再按一次！' },
      manualQs: [
        { q: '傳道書的總意：敬畏神，還有甚麼？', options: ['謹守他的誡命', '多積攢財寶', '及時行樂', '遠離人群'], answer: '謹守他的誡命', basis: '傳 12:13' },
        { q: '「凡事都有定期」，天下萬務都有甚麼？', options: ['定時', '代價', '盡頭', '主人'], answer: '定時', basis: '傳 3:1' },
        { q: '神造萬物各按其時成為美好，又將甚麼安置在世人心裡？', options: ['永遠（永生）', '憂愁', '聰明', '夢想'], answer: '永遠（永生）', basis: '傳 3:11' },
        { q: '「三股合成的繩子」怎樣？', options: ['不容易折斷', '最為美觀', '可以賣錢', '容易編成'], answer: '不容易折斷', basis: '傳 4:12' },
        { q: '當趁着年幼記念誰？', options: ['造你的主', '你的老師', '你的朋友', '你自己'], answer: '造你的主', basis: '傳 12:1' },
      ],
    },
    lam_mercies: {
      book: 'LAM', ch: 3, emoji: '🌅', title: '守夜打更', tag: '哀 3・節拍敲更',
      myEmoji: '🌅', myName: '數算祂的慈愛', myGoal: 5,
      foeEmoji: '🌧️', foeName: '黑夜的眼淚', foeGoal: 5,
      hitText: '🌅 又數算到一樣慈愛，天快亮了！', missText: '🌧️ 眼淚在黑夜裡流…',
      win: { emoji: '🌅', title: '每早晨都是新的！', text: '「我們不至消滅，是出於耶和華諸般的慈愛……每早晨，這都是新的；你的誠實極其廣大！」（哀 3:22-23）' },
      lose: { text: '夜還很長嗎？記住——哀歌的中心不是眼淚，是「每早晨都是新的」。等天亮，再數一次！' },
      manualQs: [
        { q: '我們不至消滅，是出於耶和華的甚麼？', options: ['諸般的慈愛', '嚴厲的管教', '精準的計算', '短暫的忍耐'], answer: '諸般的慈愛', basis: '哀 3:22' },
        { q: '「每早晨，這都是新的」，是在讚嘆神的甚麼極其廣大？', options: ['誠實', '怒氣', '財富', '軍隊'], answer: '誠實', basis: '哀 3:23' },
        { q: '「耶和華是我的分」，因此我要怎樣？', options: ['仰望他', '離開他', '試探他', '躲避他'], answer: '仰望他', basis: '哀 3:24' },
        { q: '耶和華必施恩給誰？', options: ['等候他、心裏尋求他的人', '最強壯的人', '最富有的人', '最聰明的人'], answer: '等候他、心裏尋求他的人', basis: '哀 3:25' },
        { q: '人仰望耶和華，怎樣等候他的救恩是好的？', options: ['靜默', '急躁', '喧嚷', '憂愁'], answer: '靜默', basis: '哀 3:26' },
      ],
    },
    haggai_build: {
      book: 'HAG', ch: 1, emoji: '🔨', title: '上山拋木', tag: '該 1・甩擲投料',
      myEmoji: '🔨', myName: '上山取木建殿', myGoal: 5,
      foeEmoji: '🏠', foeName: '只顧自己的房屋', foeGoal: 5,
      hitText: '🔨 又搬上一根木料，神因此喜樂！', missText: '🏠 心又飄回自己的天花板房屋…',
      win: { emoji: '🔨', title: '神的殿動工了！', text: '「你們要上山取木料，建造這殿，我就因此喜樂，且得榮耀。」這殿後來的榮耀，必大過先前的榮耀！（該 1:8、2:9）' },
      lose: { text: '又只顧自己的房子了嗎？「你們要省察自己的行為」——放下手邊的，先建神的殿，再來一次！' },
      manualQs: [
        { q: '神責備百姓：這殿仍然荒涼，你們自己還住甚麼？', options: ['天花板的房屋', '帳棚', '山洞', '城樓'], answer: '天花板的房屋', basis: '該 1:4' },
        { q: '神要百姓上山取甚麼來建殿？', options: ['木料', '石頭', '金子', '磚塊'], answer: '木料', basis: '該 1:8' },
        { q: '這殿後來的榮耀，比先前如何？', options: ['必大過先前', '稍微遜色', '完全一樣', '無人知道'], answer: '必大過先前', basis: '該 2:9' },
        { q: '百姓只顧自己的結果：得工錢的，把工錢裝在哪裡？', options: ['破漏的囊中', '堅固的倉庫', '換成了田地', '腰間的錢袋'], answer: '破漏的囊中', basis: '該 1:6' },
        { q: '神說在這地方必賜下甚麼？', options: ['平安', '糧食', '雨水', '君王'], answer: '平安', basis: '該 2:9' },
      ],
    },
    // ===== 第 3 波（2026-07-18）：2 款動作＋10 款對決（保羅書信）=====
    zech_lamps: {
      book: 'ZEC', ch: 4, emoji: '🕎', title: '七燈點亮', tag: '亞 4・記憶序列',
      myEmoji: '🕎', myName: '金燈臺的七燈', myGoal: 7,
      foeEmoji: '⛰️', foeName: '大山的攔阻', foeGoal: 3,
      hitText: '🕎 燈又亮了一輪！', missText: '⛰️ 大山的影子壓過來…',
      win: { emoji: '🕎', title: '七燈全亮了！', text: '「不是倚靠勢力，不是倚靠才能，乃是倚靠我的靈方能成事。」大山哪，你算甚麼呢？在所羅巴伯面前，你必成為平地！（亞 4:6-7）' },
      lose: { text: '順序亂了嗎？誰藐視這日的事為小呢——深呼吸，倚靠祂的靈再點一次！（亞 4:10）' },
      manualQs: [
        { q: '撒迦利亞看見純金燈臺上有幾盞燈？', options: ['七盞', '五盞', '十盞', '十二盞'], answer: '七盞', basis: '亞 4:2' },
        { q: '「不是倚靠勢力，不是倚靠才能」，乃是倚靠甚麼？', options: ['耶和華的靈', '眾人的手', '君王的命令', '金銀的力量'], answer: '耶和華的靈', basis: '亞 4:6' },
        { q: '大山在所羅巴伯面前，必成為甚麼？', options: ['平地', '深谷', '花園', '道路'], answer: '平地', basis: '亞 4:7' },
        { q: '「這七眼乃是耶和華的眼睛」，作甚麼？', options: ['遍察全地', '數算星辰', '看守聖殿', '監督工人'], answer: '遍察全地', basis: '亞 4:10' },
        { q: '「看哪，你的王來到」，他謙謙和和地騎着甚麼？', options: ['驢駒', '白馬', '駱駝', '戰車'], answer: '驢駒', basis: '亞 9:9' },
      ],
    },
    hab_watch: {
      book: 'HAB', ch: 2, emoji: '🗼', title: '守望樓上', tag: '哈 2・反應快抄',
      myEmoji: '📜', myName: '抄下的默示', myGoal: 6,
      foeEmoji: '🌫️', foeName: '一閃即逝的異象', foeGoal: 3,
      hitText: '📜 抄下來了，明明地寫在版上！', missText: '🌫️ 異象一閃就過了…',
      win: { emoji: '🗼', title: '默示都寫在版上了！', text: '「將這默示明明的寫在版上，使讀的人容易讀。」等候不落空——惟義人因信得生！（哈 2:2,4）' },
      lose: { text: '沒抄到嗎？哈巴谷也等了又等——「雖然無花果樹不發旺……然而我要因耶和華歡欣」。回守望樓，再等一次！（哈 3:17-18）' },
      manualQs: [
        { q: '哈巴谷說「我要站在守望所」，立在哪裡觀看？', options: ['望樓上', '城門口', '山頂上', '祭壇旁'], answer: '望樓上', basis: '哈 2:1' },
        { q: '神要哈巴谷把默示怎樣寫在版上？', options: ['明明地寫', '偷偷地寫', '簡短地寫', '華麗地寫'], answer: '明明地寫', basis: '哈 2:2' },
        { q: '「惟義人因＿得生」？', options: ['信', '行', '善', '智'], answer: '信', basis: '哈 2:4' },
        { q: '雖然無花果樹不發旺、田地不出糧食，哈巴谷仍要怎樣？', options: ['因耶和華歡欣', '傷心地離開', '大聲地抱怨', '默默地忍受'], answer: '因耶和華歡欣', basis: '哈 3:17-18' },
        { q: '主耶和華使哈巴谷的腳快如甚麼？', options: ['母鹿的蹄', '雄鷹的翅', '駿馬的腿', '獅子的爪'], answer: '母鹿的蹄', basis: '哈 3:19' },
      ],
    },
    rom_love: {
      book: 'ROM', ch: 8, emoji: '⛓️', title: '衝破阻隔', tag: '羅 8・方向快滑',
      myEmoji: '💪', myName: '得勝有餘', myGoal: 5,
      foeEmoji: '⚔️', foeName: '患難逼迫刀劍', foeGoal: 5,
      hitText: '💪 靠着愛我們的主，又勝一場！', missText: '⚔️ 患難、困苦、逼迫圍上來了…',
      win: { emoji: '⛓️', title: '甚麼都不能隔絕！', text: '「無論是死，是生……都不能叫我們與神的愛隔絕；這愛是在我們的主基督耶穌裏的。」（羅 8:38-39）' },
      lose: { text: '被圍住了嗎？記住——「靠着愛我們的主，在這一切的事上已經得勝有餘了」。再戰一場！（羅 8:37）' },
      manualQs: [
        { q: '靠着愛我們的主，我們在這一切的事上已經怎樣？', options: ['得勝有餘', '勉強撐住', '略佔上風', '不分勝負'], answer: '得勝有餘', basis: '羅 8:37' },
        { q: '是高處的、是低處的，都不能叫我們與甚麼隔絕？', options: ['神的愛', '教會生活', '屬靈恩賜', '天上獎賞'], answer: '神的愛', basis: '羅 8:39' },
        { q: '「世人都犯了罪」，虧缺了甚麼？', options: ['神的榮耀', '律法標準', '天使見證', '先祖名聲'], answer: '神的榮耀', basis: '羅 3:23' },
        { q: '罪的工價乃是死；神的恩賜乃是甚麼？', options: ['永生', '平安', '健康', '財富'], answer: '永生', basis: '羅 6:23' },
        { q: '「不要效法這個世界」，只要怎樣？', options: ['心意更新而變化', '離群獨自安靜', '嚴守各樣規條', '週週禁食禱告'], answer: '心意更新而變化', basis: '羅 12:2' },
      ],
    },
    cor_love: {
      book: '1CO', ch: 13, emoji: '💞', title: '有愛才算數', tag: '林前 13・眼明手快',
      myEmoji: '💞', myName: '愛的真諦', myGoal: 5,
      foeEmoji: '🥁', foeName: '鳴的鑼響的鈸', foeGoal: 5,
      hitText: '💞 又活出一句愛的真諦！', missText: '🥁 沒有愛，只剩鑼鈸的噪音…',
      win: { emoji: '💞', title: '愛是永不止息！', text: '「如今常存的有信，有望，有愛，這三樣，其中最大的是愛。」（林前 13:13）' },
      lose: { text: '只剩下響聲了嗎？「我若能說萬人的方言……卻沒有愛，我就成了鳴的鑼」。回到愛，再來一次！' },
      manualQs: [
        { q: '「愛是恆久忍耐，又有」甚麼？', options: ['恩慈', '聰明', '膽量', '口才'], answer: '恩慈', basis: '林前 13:4' },
        { q: '「愛是永不」怎樣？', options: ['止息', '改變', '失敗', '後悔'], answer: '止息', basis: '林前 13:8' },
        { q: '如今常存的有信、有望、有愛，其中最大的是？', options: ['愛', '信', '望', '恩賜'], answer: '愛', basis: '林前 13:13' },
        { q: '我若能說萬人的方言卻沒有愛，就成了甚麼？', options: ['鳴的鑼、響的鈸', '無字的書卷', '無油的燈臺', '斷了絃的琴'], answer: '鳴的鑼、響的鈸', basis: '林前 13:1' },
        { q: '神必不叫你們受試探過於所能受的，總要給你們開甚麼？', options: ['一條出路', '一扇天窗', '一座橋樑', '一條捷徑'], answer: '一條出路', basis: '林前 10:13' },
      ],
    },
    clay_jar: {
      book: '2CO', ch: 4, emoji: '🫙', title: '瓦器裡的寶貝', tag: '林後 4・答題對決',
      myEmoji: '💎', myName: '寶貝的光發出', myGoal: 5,
      foeEmoji: '🗡️', foeName: '四面受敵', foeGoal: 5,
      hitText: '💎 瓦器裡的光又透出來了！', missText: '🗡️ 四面受敵，壓力逼近…',
      win: { emoji: '🫙', title: '莫大的能力是出於神！', text: '「我們有這寶貝放在瓦器裏，要顯明這莫大的能力是出於神，不是出於我們。」四面受敵，卻不被困住！（林後 4:7-8）' },
      lose: { text: '瓦器裂了嗎？別忘了——「我的恩典彀你用的，我的能力是在人的軟弱上顯得完全」。再站起來！（林後 12:9）' },
      manualQs: [
        { q: '「我們有這寶貝」放在哪裡？', options: ['瓦器裡', '金櫃裡', '聖殿裡', '心版上'], answer: '瓦器裡', basis: '林後 4:7' },
        { q: '寶貝放在瓦器裡，要顯明莫大的能力出於誰？', options: ['出於神', '出於我們', '出於使徒', '出於教會'], answer: '出於神', basis: '林後 4:7' },
        { q: '「四面受敵，卻不」怎樣？', options: ['被困住', '退後', '流淚', '爭辯'], answer: '被困住', basis: '林後 4:8' },
        { q: '若有人在基督裡，他就是甚麼？', options: ['新造的人', '完美的人', '自由的人', '剛強的人'], answer: '新造的人', basis: '林後 5:17' },
        { q: '主的能力在哪裡顯得完全？', options: ['人的軟弱上', '人的剛強上', '人的聰明上', '人的財富上'], answer: '人的軟弱上', basis: '林後 12:9' },
      ],
    },
    col_new: {
      book: 'COL', ch: 3, emoji: '👕', title: '穿上新人', tag: '西 3・答題對決',
      myEmoji: '👕', myName: '穿上新人的美德', myGoal: 5,
      foeEmoji: '🧥', foeName: '舊人的舊行為', foeGoal: 5,
      hitText: '👕 又穿上一件新人的美德！', missText: '🧥 舊衣服又披回身上了…',
      win: { emoji: '👕', title: '穿上新人了！', text: '「要存憐憫、恩慈、謙虛、溫柔、忍耐的心……在這一切之外，要存着愛心，愛心就是聯絡全德的。」（西 3:12,14）' },
      lose: { text: '又披上舊衣了嗎？「你們要思念上面的事」——把舊的脫掉，再穿一次新的！（西 3:2）' },
      manualQs: [
        { q: '神的選民要穿上憐憫、恩慈、謙虛、溫柔和甚麼的心？', options: ['忍耐', '勇敢', '聰明', '熱情'], answer: '忍耐', basis: '西 3:12' },
        { q: '「主怎樣饒恕了你們，你們也要怎樣」？', options: ['饒恕人', '要求人', '提醒人', '遠離人'], answer: '饒恕人', basis: '西 3:13' },
        { q: '甚麼是「聯絡全德的」？', options: ['愛心', '知識', '口才', '恆心'], answer: '愛心', basis: '西 3:14' },
        { q: '「無論作甚麼，都要從心裏作」，像是給誰作的？', options: ['給主作的', '給人作的', '給自己作的', '給老闆作的'], answer: '給主作的', basis: '西 3:23' },
        { q: '你們要思念哪裡的事？', options: ['上面的事', '地上的事', '過去的事', '別人的事'], answer: '上面的事', basis: '西 3:2' },
      ],
    },
    thes_joy: {
      book: '1TH', ch: 5, emoji: '😊', title: '三樣不斷', tag: '帖前 5・三錶維持',
      myEmoji: '😊', myName: '喜樂・禱告・謝恩', myGoal: 5,
      foeEmoji: '🌧️', foeName: '消滅聖靈感動的冷淡', foeGoal: 5,
      hitText: '😊 喜樂、禱告、謝恩，又點亮一盞！', missText: '🌧️ 心慢慢冷下來了…',
      win: { emoji: '😊', title: '這是神向你所定的旨意！', text: '「要常常喜樂，不住的禱告，凡事謝恩；因為這是神在基督耶穌裏向你們所定的旨意。」（帖前 5:16-18）' },
      lose: { text: '心冷掉了嗎？神的旨意只有三件：喜樂、禱告、謝恩——從其中一件重新開始！' },
      manualQs: [
        { q: '「要常常」怎樣？', options: ['喜樂', '歎息', '比較', '憂慮'], answer: '喜樂', basis: '帖前 5:16' },
        { q: '「不住的」做甚麼？', options: ['禱告', '工作', '唱歌', '走動'], answer: '禱告', basis: '帖前 5:17' },
        { q: '「凡事」怎樣？', options: ['謝恩', '小心', '懷疑', '計較'], answer: '謝恩', basis: '帖前 5:18' },
        { q: '主再來時，誰必先復活？', options: ['在基督裏死了的人', '還活着的人', '眾天使', '眾先知'], answer: '在基督裏死了的人', basis: '帖前 4:16' },
        { q: '主的日子來到，好像甚麼一樣？', options: ['夜間的賊', '清晨的光', '午後的雨', '遠方的雷'], answer: '夜間的賊', basis: '帖前 5:2' },
      ],
    },
    thes_good: {
      book: '2TH', ch: 3, emoji: '✊', title: '行善不喪志', tag: '帖後 3・答題對決',
      myEmoji: '✊', myName: '安靜做工堅持行善', myGoal: 5,
      foeEmoji: '🛋️', foeName: '懶散與謠言', foeGoal: 5,
      hitText: '✊ 不動搖，又做成一件善工！', missText: '🛋️ 懶散和謠言又擾亂人心…',
      win: { emoji: '✊', title: '行善不喪志！', text: '「弟兄們，你們行善不可喪志。」願賜平安的主，隨時隨事親自給你們平安！（帖後 3:13,16）' },
      lose: { text: '快喪志了嗎？保羅說得直接：安靜做工、堅守教訓——站穩，再做一件善事！' },
      manualQs: [
        { q: '「弟兄們，你們行善不可」怎樣？', options: ['喪志', '張揚', '比較', '遲延'], answer: '喪志', basis: '帖後 3:13' },
        { q: '「若有人不肯作工」，就不可怎樣？', options: ['吃飯', '睡覺', '聚會', '說話'], answer: '吃飯', basis: '帖後 3:10' },
        { q: '願賜平安的主，怎樣親自給你們平安？', options: ['隨時隨事', '偶爾一次', '在聚會中', '在安息日'], answer: '隨時隨事', basis: '帖後 3:16' },
        { q: '凡所領受的教訓，都要怎樣？', options: ['堅守', '更新', '挑選', '存疑'], answer: '堅守', basis: '帖後 2:15' },
        { q: '教訓「不拘是我們口傳的，是」甚麼？', options: ['信上寫的', '石版刻的', '歌中唱的', '夢中見的'], answer: '信上寫的', basis: '帖後 2:15' },
      ],
    },
    tim_example: {
      book: '1TI', ch: 4, emoji: '✨', title: '年輕人的榜樣', tag: '提前 4・答題對決',
      myEmoji: '✨', myName: '五樣榜樣立起來', myGoal: 5,
      foeEmoji: '🙄', foeName: '被人小看的眼光', foeGoal: 5,
      hitText: '✨ 又立起一樣榜樣，誰敢小看！', missText: '🙄 輕看的眼光又飄過來…',
      win: { emoji: '✨', title: '不可叫人小看你年輕！', text: '「總要在言語、行為、愛心、信心、清潔上，都作信徒的榜樣。」年輕不是被小看的理由，是作榜樣的舞台！（提前 4:12）' },
      lose: { text: '被眼光壓住了嗎？年輕人的底氣不是年紀，是榜樣——從言語開始，再立一次！' },
      manualQs: [
        { q: '「不可叫人小看你」甚麼？', options: ['年輕', '貧窮', '矮小', '口拙'], answer: '年輕', basis: '提前 4:12' },
        { q: '要在言語、行為、愛心、信心和甚麼上作榜樣？', options: ['清潔', '奉獻', '知識', '服事'], answer: '清潔', basis: '提前 4:12' },
        { q: '「敬虔加上」甚麼「便是大利了」？', options: ['知足的心', '豐厚的財', '眾人的讚', '長久的壽'], answer: '知足的心', basis: '提前 6:6' },
        { q: '「你要為真道打那美好的仗」，持定甚麼？', options: ['永生', '冠冕', '產業', '名聲'], answer: '永生', basis: '提前 6:12' },
        { q: '「基督耶穌降世」，為要拯救誰？', options: ['罪人', '義人', '智者', '君王'], answer: '罪人', basis: '提前 1:15' },
      ],
    },
    tim_fight: {
      book: '2TI', ch: 4, emoji: '🏆', title: '三段接力', tag: '提後 4・連點交替長按',
      myEmoji: '🏆', myName: '打仗・跑路・守道', myGoal: 5,
      foeEmoji: '🌆', foeName: '貪愛現今的世界', foeGoal: 5,
      hitText: '🏆 又撐過一程，冠冕在前面！', missText: '🌆 世界的霓虹又在招手…',
      win: { emoji: '🏆', title: '當跑的路跑盡了！', text: '「那美好的仗我已經打過了，當跑的路我已經跑盡了，所信的道我已經守住了。從此以後，有公義的冠冕為我存留。」（提後 4:7-8）' },
      lose: { text: '腳步慢下來了嗎？神賜的不是膽怯的心，乃是剛強、仁愛、謹守的心——再跑一程！（提後 1:7）' },
      manualQs: [
        { q: '「那美好的仗我已經打過了」，當跑的路怎樣了？', options: ['已經跑盡了', '還在跑', '剛剛起跑', '跑了一半'], answer: '已經跑盡了', basis: '提後 4:7' },
        { q: '從此以後，有甚麼冠冕為保羅存留？', options: ['公義的冠冕', '金子的冠冕', '荊棘的冠冕', '生命的冠冕'], answer: '公義的冠冕', basis: '提後 4:8' },
        { q: '聖經都是神所默示的，於教訓、督責、使人歸正、和甚麼都有益？', options: ['教導人學義', '賺取財富', '贏得辯論', '預測未來'], answer: '教導人學義', basis: '提後 3:16' },
        { q: '神賜給我們的，不是膽怯的心，乃是甚麼的心？', options: ['剛強、仁愛、謹守', '聰明、機警、迅速', '安靜、溫和、退讓', '火熱、大膽、直率'], answer: '剛強、仁愛、謹守', basis: '提後 1:7' },
        { q: '當竭力作無愧的工人，按着正意怎樣？', options: ['分解真理的道', '管理教會事務', '監督眾人行為', '累積屬靈知識'], answer: '分解真理的道', basis: '提後 2:15' },
      ],
    },
    titus_good: {
      book: 'TIT', ch: 2, emoji: '❤️‍🔥', title: '熱心為善', tag: '多 2・答題對決',
      myEmoji: '❤️‍🔥', myName: '善行的果子', myGoal: 5,
      foeEmoji: '🗯️', foeName: '無益的辯論', foeGoal: 5,
      hitText: '❤️‍🔥 又結出一個善行的果子！', missText: '🗯️ 空談和辯論又浪費了一天…',
      win: { emoji: '❤️‍🔥', title: '特作自己的子民，熱心為善！', text: '「他為我們捨了自己，要贖我們脫離一切罪惡，又潔淨我們，特作自己的子民，熱心為善。」（多 2:14）' },
      lose: { text: '被空談纏住了嗎？信神的人要「留心作正經事業」——放下辯論，去做一件實在的善事！（多 3:8）' },
      manualQs: [
        { q: '基督贖我們、潔淨我們，特作自己的子民，對甚麼熱心？', options: ['為善', '聚會', '辯論', '禁食'], answer: '為善', basis: '多 2:14' },
        { q: '已信神的人要留心作甚麼？', options: ['正經事業（行善）', '買賣生意', '言語爭辯', '家譜考究'], answer: '正經事業（行善）', basis: '多 3:8' },
        { q: '神救了我們，並不是因我們自己所行的義，乃是照祂的甚麼？', options: ['憐憫', '公平', '計劃', '試驗'], answer: '憐憫', basis: '多 3:5' },
        { q: '藉着甚麼的洗和聖靈的更新救了我們？', options: ['重生', '悔改', '潔淨', '歸入'], answer: '重生', basis: '多 3:5' },
        { q: '神救眾人的甚麼已經顯明出來？', options: ['恩典', '審判', '律法', '榮耀'], answer: '恩典', basis: '多 2:11' },
      ],
    },
    philemon_home: {
      book: 'PHM', ch: 1, emoji: '🏠', title: '回家的路', tag: '門・迷宮尋路',
      myEmoji: '🏠', myName: '阿尼西母回家的路', myGoal: 5,
      foeEmoji: '⛓️', foeName: '過去的虧欠', foeGoal: 5,
      hitText: '🏠 又走近家門一步！', missText: '⛓️ 過去的虧欠又拉住他…',
      win: { emoji: '🏠', title: '不再是奴僕，是親愛的兄弟！', text: '「他從前與你沒有益處，但如今與你我都有益處……不再是奴僕，乃是高過奴僕，是親愛的兄弟。」（門 11,16）' },
      lose: { text: '走不回去嗎？聽保羅說：「他若虧負你，或欠你甚麼，都歸在我的賬上。」——恩典開路，再走一次！（門 18）' },
      manualQs: [
        { q: '保羅「在捆鎖中所生的兒子」叫甚麼名字？', options: ['阿尼西母', '提摩太', '提多', '以巴弗'], answer: '阿尼西母', basis: '門 10' },
        { q: '「阿尼西母」這名字是甚麼意思？', options: ['有益處', '蒙愛的', '得勝的', '忠心的'], answer: '有益處', basis: '門 10' },
        { q: '保羅說阿尼西母回去，不再是奴僕，乃是甚麼？', options: ['親愛的兄弟', '尊貴的客人', '自由的工人', '同工的使者'], answer: '親愛的兄弟', basis: '門 16' },
        { q: '「他若虧負你，或欠你甚麼」，保羅說怎麼辦？', options: ['都歸在我的賬上', '分期慢慢償還', '一筆勾銷不提', '由教會來代還'], answer: '都歸在我的賬上', basis: '門 18' },
        { q: '阿尼西母從前與你沒有益處，如今呢？', options: ['與你我都有益處', '仍然沒有用處', '只對保羅有益', '只對主人有益'], answer: '與你我都有益處', basis: '門 11' },
      ],
    },
    // ===== 第 4 波（2026-07-18）＝66 卷全覆蓋：6 款動作＋5 款對決 =====
    armor_god: {
      book: 'EPH', ch: 6, emoji: '🛡️', title: '穿上全副軍裝', tag: '弗 6・穿戴配對',
      myEmoji: '🛡️', myName: '六件軍裝到齊', myGoal: 6,
      foeEmoji: '🔥', foeName: '惡者的火箭', foeGoal: 3,
      hitText: '🛡️ 又穿上一件，站得更穩！', missText: '🔥 火箭擦過，破綻露出來了…',
      win: { emoji: '🛡️', title: '全副軍裝穿上了！', text: '「要穿戴神所賜的全副軍裝，就能抵擋魔鬼的詭計。」真理束腰、公義護胸、福音的鞋、信德的藤牌、救恩的頭盔、聖靈的寶劍——站穩了！（弗 6:11-17）' },
      lose: { text: '裝備穿錯了位置——沒關係，一件一件來：先用真理當作帶子束腰。再穿一次！（弗 6:14）' },
      manualQs: [
        { q: '穿戴全副軍裝，就能抵擋誰的詭計？', options: ['魔鬼', '仇人', '外邦人', '野獸'], answer: '魔鬼', basis: '弗 6:11' },
        { q: '用甚麼當作帶子束腰？', options: ['真理', '公義', '信德', '救恩'], answer: '真理', basis: '弗 6:14' },
        { q: '信德當作藤牌，可以滅盡那惡者一切的甚麼？', options: ['火箭', '長矛', '巨石', '繩索'], answer: '火箭', basis: '弗 6:16' },
        { q: '聖靈的寶劍就是甚麼？', options: ['神的道', '人的口才', '教會傳統', '天使命令'], answer: '神的道', basis: '弗 6:17' },
        { q: '「你們得救是本乎恩，也因着」甚麼？', options: ['信', '行為', '律法', '奉獻'], answer: '信', basis: '弗 2:8' },
      ],
    },
    php_race: {
      book: 'PHP', ch: 3, emoji: '🏃', title: '向著標竿直跑', tag: '腓 3・跨欄跑者',
      myEmoji: '🏃', myName: '努力面前的路程', myGoal: 12,
      foeEmoji: '🪨', foeName: '絆腳的攔阻', foeGoal: 3,
      hitText: '🏃 跳過去了，繼續向前！', missText: '🪨 絆了一下，別回頭看…',
      win: { emoji: '🏆', title: '跑到標竿了！', text: '「忘記背後，努力面前的，向着標竿直跑，要得神在基督耶穌裏從上面召我來得的獎賞。」（腓 3:13-14）' },
      lose: { text: '摔倒了嗎？「我靠着那加給我力量的，凡事都能作」——爬起來，再跑一次！（腓 4:13）' },
      manualQs: [
        { q: '保羅說「我只有一件事」：忘記背後、怎樣？', options: ['努力面前', '回顧過去', '原地休息', '等待指示'], answer: '努力面前', basis: '腓 3:13' },
        { q: '「向着標竿直跑」，要得甚麼？', options: ['神從上面召我來得的獎賞', '眾人的掌聲', '金銀的冠冕', '長壽與平安'], answer: '神從上面召我來得的獎賞', basis: '腓 3:14' },
        { q: '「你們要靠主常常＿＿。我再說，你們要＿＿」？', options: ['喜樂', '儆醒', '謙卑', '忍耐'], answer: '喜樂', basis: '腓 4:4' },
        { q: '「我靠着那加給我力量的」，怎樣？', options: ['凡事都能作', '偶爾能成功', '不再有軟弱', '百戰又百勝'], answer: '凡事都能作', basis: '腓 4:13' },
        { q: '應當一無掛慮，凡事藉着甚麼將所要的告訴神？', options: ['禱告、祈求和感謝', '眼淚和歎息', '禁食和苦行', '奉獻和勞力'], answer: '禱告、祈求和感謝', basis: '腓 4:6' },
      ],
    },
    peter_lion: {
      book: '1PE', ch: 5, emoji: '🛡️', title: '抵擋吼獅', tag: '彼前 5・方向格擋',
      myEmoji: '🛡️', myName: '堅固的信心', myGoal: 7,
      foeEmoji: '🦁', foeName: '遍地遊行的吼獅', foeGoal: 3,
      hitText: '🛡️ 用堅固的信心擋下這一撲！', missText: '🦁 吼叫聲更近了…',
      win: { emoji: '🛡️', title: '站穩抵擋到底！', text: '「務要謹守，儆醒……你們要用堅固的信心抵擋他。」暫受苦難之後，神必要親自成全、堅固你們，賜力量給你們！（彼前 5:8-10）' },
      lose: { text: '被撲倒了嗎？「將一切的憂慮卸給神，因為他顧念你們」——深呼吸，舉盾再戰！（彼前 5:7）' },
      manualQs: [
        { q: '仇敵魔鬼如同甚麼，遍地遊行？', options: ['吼叫的獅子', '狡猾的狐狸', '盤旋的老鷹', '隱藏的毒蛇'], answer: '吼叫的獅子', basis: '彼前 5:8' },
        { q: '要用甚麼抵擋魔鬼？', options: ['堅固的信心', '鋒利的刀劍', '高大的城牆', '眾多的同伴'], answer: '堅固的信心', basis: '彼前 5:9' },
        { q: '「將一切的憂慮卸給神」，因為甚麼？', options: ['他顧念你們', '憂慮沒有用', '別人也一樣', '時間會沖淡'], answer: '他顧念你們', basis: '彼前 5:7' },
        { q: '你們是被揀選的族類，是有君尊的甚麼？', options: ['祭司', '君王', '先知', '勇士'], answer: '祭司', basis: '彼前 2:9' },
        { q: '暫受苦難之後，神必要親自怎樣你們？', options: ['成全、堅固、賜力量', '責備、管教、試驗', '隱藏、遮蓋、保密', '升高、加冠、賜國'], answer: '成全、堅固、賜力量', basis: '彼前 5:10' },
      ],
    },
    peter_ladder: {
      book: '2PE', ch: 1, emoji: '🪜', title: '屬靈八階梯', tag: '彼後 1・順序挑戰',
      myEmoji: '🪜', myName: '八樣美德的階梯', myGoal: 8,
      foeEmoji: '😴', foeName: '閒懶不結果子', foeGoal: 3,
      hitText: '🪜 又爬上一階！', missText: '😴 順序亂了，腳步滑了一下…',
      win: { emoji: '🪜', title: '八階全部爬上去了！', text: '「有了信心，又要加上德行……」你們若充充足足的有這幾樣，就必不至於閒懶不結果子了！（彼後 1:5-8）' },
      lose: { text: '滑下來了嗎？階梯還在：信心、德行、知識、節制、忍耐、虔敬、愛弟兄、愛眾人——分外殷勤，再爬一次！' },
      manualQs: [
        { q: '有了信心，又要加上甚麼？', options: ['德行', '知識', '節制', '忍耐'], answer: '德行', basis: '彼後 1:5' },
        { q: '有了忍耐，又要加上甚麼？', options: ['虔敬', '愛心', '信心', '謙卑'], answer: '虔敬', basis: '彼後 1:6' },
        { q: '八樣階梯的最後一階是甚麼？', options: ['愛眾人的心', '愛弟兄的心', '虔敬', '節制'], answer: '愛眾人的心', basis: '彼後 1:7' },
        { q: '充充足足有這幾樣，就必不至於怎樣？', options: ['閒懶不結果子', '遭遇苦難', '被人輕看', '缺乏財物'], answer: '閒懶不結果子', basis: '彼後 1:8' },
        { q: '主不願有一人沉淪，乃願人人都怎樣？', options: ['悔改', '富足', '聰明', '長壽'], answer: '悔改', basis: '彼後 3:9' },
      ],
    },
    john_light: {
      book: '1JN', ch: 1, emoji: '💡', title: '神就是光', tag: '約一 1・擦亮迷霧',
      myEmoji: '💡', myName: '光照進來', myGoal: 5,
      foeEmoji: '🌑', foeName: '黑暗', foeGoal: 5,
      hitText: '💡 又亮了一片！', missText: '🌑 黑暗還籠罩着…',
      win: { emoji: '💡', title: '整片都亮了！', text: '「神就是光，在他毫無黑暗。」那在你們裏面的，比那在世界上的更大！（約一 1:5、4:4）' },
      lose: { text: '天亮前沒擦完嗎？光一直都在，只等你動手——再擦一次！' },
      manualQs: [
        { q: '「神就是光」，在祂毫無甚麼？', options: ['黑暗', '憂愁', '疲倦', '隱藏'], answer: '黑暗', basis: '約一 1:5' },
        { q: '我們若認自己的罪，神必要怎樣？', options: ['赦免我們的罪、洗淨不義', '記錄我們的過犯', '暫時不追究', '要求先補償'], answer: '赦免我們的罪、洗淨不義', basis: '約一 1:9' },
        { q: '「那在你們裏面的」，比那在世界上的怎樣？', options: ['更大', '一樣', '更小', '更快'], answer: '更大', basis: '約一 4:4' },
        { q: '「我們愛」，因為甚麼？', options: ['神先愛我們', '愛使人快樂', '人人都需要', '律法的要求'], answer: '神先愛我們', basis: '約一 4:19' },
        { q: '父賜給我們何等的慈愛，使我們得稱為甚麼？', options: ['神的兒女', '神的僕人', '神的朋友', '神的選民'], answer: '神的兒女', basis: '約一 3:1' },
      ],
    },
    rev_stars: {
      book: 'REV', ch: 1, emoji: '🌠', title: '尋找七星', tag: '啟 1・夜空尋物',
      myEmoji: '⭐', myName: '找齊七星', myGoal: 7,
      foeEmoji: '⏳', foeName: '時間流逝', foeGoal: 3,
      hitText: '⭐ 找到一顆星！', missText: '⏳ 時間一分一秒過去…',
      win: { emoji: '🌠', title: '七星全找到了！', text: '「那七星就是七個教會的使者，七燈臺就是七個教會。」祂是阿拉法，是俄梅戛；是首先的，也是末後的！（啟 1:20、22:13）' },
      lose: { text: '星星還藏在夜空裡——「務要至死忠心，我就賜給你那生命的冠冕」。睜大眼睛，再找一次！（啟 2:10）' },
      manualQs: [
        { q: '主右手中的七星是甚麼？', options: ['七個教會的使者', '七位天使長', '七個國度', '七樣恩賜'], answer: '七個教會的使者', basis: '啟 1:20' },
        { q: '「務要至死忠心」，我就賜給你甚麼？', options: ['生命的冠冕', '公義的冠冕', '榮耀的寶座', '永遠的基業'], answer: '生命的冠冕', basis: '啟 2:10' },
        { q: '「看哪，我站在門外」做甚麼？', options: ['叩門', '守望', '唱歌', '呼喊'], answer: '叩門', basis: '啟 3:20' },
        { q: '新天新地裡，神要擦去他們一切的甚麼？', options: ['眼淚', '罪孽', '記憶', '疾病'], answer: '眼淚', basis: '啟 21:4' },
        { q: '「我是阿拉法，我是俄梅戛」，意思是？', options: ['首先的和末後的', '東方和西方', '光明和真理', '君王和祭司'], answer: '首先的和末後的', basis: '啟 22:13' },
      ],
    },
    faith_cloud: {
      book: 'HEB', ch: 12, emoji: '☁️', title: '信心之橋', tag: '來 11・看不見的橋',
      myEmoji: '☁️', myName: '雲彩般的見證人', myGoal: 5,
      foeEmoji: '🎒', foeName: '容易纏累的重擔', foeGoal: 5,
      hitText: '☁️ 又一位見證人為你加油！', missText: '🎒 重擔又纏上來了…',
      win: { emoji: '☁️', title: '仰望耶穌，跑完路程！', text: '「我們既有這許多的見證人，如同雲彩圍着我們，就當放下各樣的重擔……仰望為我們信心創始成終的耶穌。」（來 12:1-2）' },
      lose: { text: '被重擔纏住了嗎？把它放下——雲彩般的見證人都在為你加油。再跑一段！' },
      manualQs: [
        { q: '信就是所望之事的實底，是未見之事的甚麼？', options: ['確據', '幻影', '開端', '影兒'], answer: '確據', basis: '來 11:1' },
        { q: '許多見證人如同甚麼圍着我們？', options: ['雲彩', '城牆', '軍隊', '星宿'], answer: '雲彩', basis: '來 12:1' },
        { q: '奔跑路程時，當仰望誰？', options: ['為我們信心創始成終的耶穌', '前面的跑者', '場邊的觀眾', '自己的腳步'], answer: '為我們信心創始成終的耶穌', basis: '來 12:2' },
        { q: '耶穌基督昨日、今日、一直到永遠，怎樣？', options: ['是一樣的', '不斷改變', '漸漸長大', '越來越遠'], answer: '是一樣的', basis: '來 13:8' },
        { q: '神的道比一切兩刃的劍怎樣？', options: ['更快', '更重', '更長', '更亮'], answer: '更快', basis: '來 4:12' },
      ],
    },
    tongue_helm: {
      book: 'JAS', ch: 3, emoji: '⚓', title: '小舵大船', tag: '雅 3・連續掌舵',
      myEmoji: '⚓', myName: '掌穩小小的舵', myGoal: 5,
      foeEmoji: '🔥', foeName: '點著樹林的小火', foeGoal: 5,
      hitText: '⚓ 舵掌穩了，大船轉向！', missText: '🔥 小火又竄出一個火星…',
      win: { emoji: '⚓', title: '舌頭勒住了！', text: '「船隻雖然甚大……只用小小的舵，就隨着掌舵的意思轉動。」最小的火能點着最大的樹林——但你掌住舵了！（雅 3:4-5）' },
      lose: { text: '火燒起來了嗎？先安靜下來——行道的人從管住舌頭開始。再掌一次舵！（雅 1:22）' },
      manualQs: [
        { q: '船隻雖大，只用甚麼就能隨掌舵的意思轉動？', options: ['小小的舵', '巨大的帆', '粗壯的錨', '眾多水手'], answer: '小小的舵', basis: '雅 3:4' },
        { q: '「最小的火」能點着甚麼？', options: ['最大的樹林', '小小的燈', '一堆柴火', '家中的爐'], answer: '最大的樹林', basis: '雅 3:5' },
        { q: '「只是你們要行道」，不要單單怎樣？', options: ['聽道', '讀經', '唱詩', '聚會'], answer: '聽道', basis: '雅 1:22' },
        { q: '缺少智慧的，應當怎麼辦？', options: ['求那厚賜與眾人的神', '去問有學問的人', '多讀幾本書', '等年紀大一點'], answer: '求那厚賜與眾人的神', basis: '雅 1:5' },
        { q: '「你們親近神」，神就必怎樣？', options: ['親近你們', '考驗你們', '遠遠觀看', '差天使來'], answer: '親近你們', basis: '雅 4:8' },
      ],
    },
    walk_truth: {
      book: '2JN', ch: 1, emoji: '🚪', title: '守住真理', tag: '約二・答題對決',
      myEmoji: '🚪', myName: '在真理和愛中行走', myGoal: 5,
      foeEmoji: '🎭', foeName: '迷惑人的敲門', foeGoal: 5,
      hitText: '🚪 認出真理，門守住了！', missText: '🎭 迷惑人的又在門外徘徊…',
      win: { emoji: '🚪', title: '真理和愛都守住了！', text: '「我們若照他的命令行，這就是愛。」在真理中行走、在愛中彼此相待——門守住了！（約二 6）' },
      lose: { text: '差點被迷惑了嗎？分辨的鑰匙很簡單：認耶穌基督是成了肉身來的。站穩，再守一次！（約二 7）' },
      manualQs: [
        { q: '約翰見對方的兒女怎樣行，就甚歡喜？', options: ['遵行真理', '賺錢養家', '征戰得勝', '多才多藝'], answer: '遵行真理', basis: '約二 4' },
        { q: '「我們大家要彼此相愛」，這是新命令嗎？', options: ['是從起初所受的命令', '是全新的命令', '是暫時的建議', '是猶太的傳統'], answer: '是從起初所受的命令', basis: '約二 5' },
        { q: '「我們若照他的命令行」，這就是甚麼？', options: ['愛', '律法', '重擔', '儀式'], answer: '愛', basis: '約二 6' },
        { q: '迷惑人的不認耶穌基督是怎樣來的？', options: ['成了肉身來的', '從天使中來的', '從先知中來的', '從君王中來的'], answer: '成了肉身來的', basis: '約二 7' },
        { q: '那不認耶穌基督成了肉身來的，稱為甚麼？', options: ['敵基督的', '失迷的羊', '小信的人', '旁觀的人'], answer: '敵基督的', basis: '約二 7' },
      ],
    },
    gaius_love: {
      book: '3JN', ch: 1, emoji: '🤝', title: '愛心接待', tag: '約三・答題對決',
      myEmoji: '🤝', myName: '像該猶一樣接待', myGoal: 5,
      foeEmoji: '🚫', foeName: '丟特腓拒人門外', foeGoal: 5,
      hitText: '🤝 門開了，客旅得着款待！', missText: '🚫 丟特腓又把人擋在門外…',
      win: { emoji: '🤝', title: '忠心的接待！', text: '「親愛的兄弟啊，凡你向作客旅之弟兄所行的都是忠心的。」不要效法惡，只要效法善——行善的屬乎神！（約三 5,11）' },
      lose: { text: '門被關上了嗎？學該猶，別學丟特腓——把門打開，再接待一次！' },
      manualQs: [
        { q: '約翰說沒有比聽見甚麼更大的喜樂？', options: ['兒女們按真理而行', '教會奉獻增加', '仇敵全都消失', '自己健康長壽'], answer: '兒女們按真理而行', basis: '約三 4' },
        { q: '該猶向作客旅之弟兄所行的，都是怎樣的？', options: ['忠心的', '勉強的', '炫耀的', '隨便的'], answer: '忠心的', basis: '約三 5' },
        { q: '在教會中好為首、不接待約翰他們的人是誰？', options: ['丟特腓', '底馬', '亞歷山大', '許米乃'], answer: '丟特腓', basis: '約三 9' },
        { q: '「不要效法惡」，只要效法甚麼？', options: ['善', '強者', '傳統', '多數'], answer: '善', basis: '約三 11' },
        { q: '行善的屬乎誰？', options: ['屬乎神', '屬乎自己', '屬乎教會', '屬乎眾人'], answer: '屬乎神', basis: '約三 11' },
      ],
    },
    keep_faith: {
      book: 'JUD', ch: 1, emoji: '🏯', title: '真道堡壘', tag: '猶・答題對決',
      myEmoji: '🏯', myName: '在真道上造就自己', myGoal: 5,
      foeEmoji: '🕳️', foeName: '偷着進來的人', foeGoal: 5,
      hitText: '🏯 堡壘又加固一層！', missText: '🕳️ 有人偷偷挖牆腳…',
      win: { emoji: '🏯', title: '真道守住了！', text: '「要在至聖的真道上造就自己，在聖靈裏禱告，保守自己常在神的愛中。」那能保守你們不失腳的，是我們的救主獨一的神！（猶 20-21,24）' },
      lose: { text: '牆被挖鬆了嗎？回到根基：真道上造就自己、聖靈裡禱告、常在神的愛中——再築一次！' },
      manualQs: [
        { q: '要在甚麼上造就自己？', options: ['至聖的真道', '古老的傳統', '眾人的稱讚', '豐富的知識'], answer: '至聖的真道', basis: '猶 20' },
        { q: '要保守自己常在哪裡？', options: ['神的愛中', '安全的家中', '人群之中', '聖殿之中'], answer: '神的愛中', basis: '猶 21' },
        { q: '「有些人你們要從」哪裡「搶出來」？', options: ['火中', '水中', '坑中', '獄中'], answer: '火中', basis: '猶 23' },
        { q: '誰能保守你們不失腳？', options: ['我們的救主獨一的神', '謹慎的自己', '屬靈的同伴', '教會的領袖'], answer: '我們的救主獨一的神', basis: '猶 24' },
        { q: '搶救人的時候，要存怎樣的心憐憫他們？', options: ['懼怕的心', '驕傲的心', '輕鬆的心', '論斷的心'], answer: '懼怕的心', basis: '猶 23' },
      ],
    },
  };

  let mg = null; // { id, cfg, qs, i, my, foe, answered }
  async function startMinigame(id) {
    const cfg = MINIGAMES[id];
    let book;
    try { book = await loadBook(cfg.book); }
    catch { alert('網路不穩，載入經文失敗了，請再試一次。'); return; }
    const chLabel = `${book.name} ${cfg.ch} 章`;
    const manual = (cfg.manualQs || []).map(m => ({ type: 'manual', ref: chLabel, ...m }));
    const auto = QuestionFactory.generateQuickQuestions(book, cfg.ch, 10);
    const pool = shuffleArr([...manual, ...auto]);
    if (pool.length < cfg.myGoal + 1) { alert('這款遊戲暫時湊不出題目，稍後再試！'); return; }
    mg = { id, cfg, qs: pool, i: 0, my: 0, foe: 0, answered: false };
    $('#mg-title').textContent = `${cfg.emoji} ${cfg.title}`;
    $('#mg-my-emoji').textContent = cfg.myEmoji;
    $('#mg-my-name').textContent = cfg.myName;
    $('#mg-foe-emoji').textContent = cfg.foeEmoji;
    $('#mg-foe-name').textContent = cfg.foeName;
    setMgScene(`目標：答對 ${cfg.myGoal} 題就獲勝！答錯會讓${cfg.foeName}逼近。`);
    updateMgBars();
    show('#screen-minigame');
    renderMgQuestion();
  }
  function updateMgBars() {
    if (!mg) return;
    $('#mg-my-fill').style.width = `${(mg.my / mg.cfg.myGoal) * 100}%`;
    $('#mg-foe-fill').style.width = `${(mg.foe / mg.cfg.foeGoal) * 100}%`;
    $('#mg-my-count').textContent = `${mg.my}/${mg.cfg.myGoal}`;
    $('#mg-foe-count').textContent = `${mg.foe}/${mg.cfg.foeGoal}`;
  }
  function setMgScene(text) { $('#mg-scene').textContent = text; }
  function renderMgQuestion() {
    const q = mg.qs[mg.i % mg.qs.length];
    let stem = '';
    if (q.type === 'fill') stem = q.display.replace('____', '<span class="blank">？</span>');
    else if (q.type === 'next') stem = `${q.head}<span class="blank">……</span>`;
    else if (q.type === 'tf') stem = '這句經文正確嗎？<br>' + escapeHtml(q.statement);
    else stem = escapeHtml(q.q); // manual
    const area = $('#mg-area');
    area.innerHTML = `<div class="q-ref">${q.ref || ''}</div><div class="q-passage sprint-passage">${stem}</div>`;
    const box = document.createElement('div');
    box.className = q.type === 'tf' ? 'tf-row' : 'choices';
    const opts = q.type === 'tf'
      ? [{ label: '⭕ 正確', val: true }, { label: '❌ 有錯', val: false }]
      : shuffleArr(q.options).map(o => ({ label: o, val: o }));
    const btns = [];
    for (const o of opts) {
      const btn = document.createElement('button');
      btn.className = q.type === 'tf' ? 'tf-btn tf-mini' : 'choice';
      btn.textContent = o.label;
      btn.onclick = () => answerMg(q, o, btn, btns, opts);
      btns.push(btn);
      box.appendChild(btn);
    }
    area.appendChild(box);
  }
  function answerMg(q, opt, btn, btns, opts) {
    if (!mg || mg.answered) return;
    mg.answered = true;
    const ok = opt.val === q.answer;
    btn.classList.add(ok ? 'correct' : 'wrong');
    if (ok) { mg.my++; sndGood(); setMgScene(mg.cfg.hitText); }
    else {
      const ri = opts.findIndex(o => o.val === q.answer);
      if (ri >= 0) btns[ri].classList.add('correct');
      mg.foe++; sndBad(); setMgScene(mg.cfg.missText);
    }
    updateMgBars();
    setTimeout(() => {
      if (!mg) return;
      if (mg.my >= mg.cfg.myGoal) { winMinigame(); return; }
      if (mg.foe >= mg.cfg.foeGoal) { loseMinigame(); return; }
      mg.answered = false; mg.i++; renderMgQuestion();
    }, ok ? 500 : 950);
  }
  function winMinigame() {
    const cfg = mg.cfg, id = mg.id;
    mg = null;
    const first = !state.minigames[id];
    const gained = first ? 60 : 10; // 2026-07-18 小遊戲經驗加倍（原 30/5）
    if (first) state.minigames[id] = true;
    state.xp += gained;
    ensureWeek();
    state.weekXp += gained;
    bumpStreak();
    store.save(state);
    sndWin();
    throwConfetti();
    $('#result-box').innerHTML = `
      <div class="r-emoji">${cfg.win.emoji || '🎉'}</div>
      <h2>${cfg.win.title || '獲勝！'}</h2>
      <p>${cfg.win.text}</p>
      <div class="result-stats"><div class="r-stat">＋${gained}<span>經驗值${first ? '' : '（重玩）'}</span></div></div>
      <button class="big-btn" id="btn-mg-again">再玩一次</button>
      <button class="ghost-btn" id="btn-continue">回書卷</button>`;
    $('#btn-mg-again').onclick = () => startMinigame(id);
    $('#btn-continue').onclick = () => { renderTopbar(); openBook(cfg.book); };
    renderTopbar();
    show('#screen-result');
  }
  function loseMinigame() {
    const cfg = mg.cfg, id = mg.id;
    mg = null;
    sndBad();
    $('#result-box').innerHTML = `
      <div class="r-emoji">${mascot().emoji}💭</div>
      <h2>差一點！</h2>
      <p>${cfg.lose.text}</p>
      <button class="big-btn" id="btn-mg-again">再挑戰</button>
      <button class="ghost-btn" id="btn-continue">回書卷</button>`;
    $('#btn-mg-again').onclick = () => startMinigame(id);
    $('#btn-continue').onclick = () => { renderTopbar(); openBook(cfg.book); };
    renderTopbar();
    show('#screen-result');
  }
  $('#btn-mg-quit').onclick = () => {
    if (confirm('要離開這款小遊戲嗎？（不會有任何損失）')) {
      const bk = mg && mg.cfg.book;
      mg = null;
      if (bk) openBook(bk); else { renderBooks(); show('#screen-books'); }
    }
  };

  // ===== 🏅成就徽章 =====
  const countBooksDone = (s) => !bookIndex ? 0 : bookIndex.filter(b => (s.done[b.id] || []).length >= b.chapters).length;
  const BADGES = [
    { emoji: '🌱', name: '起步', desc: '完成第一章', test: s => Object.values(s.done || {}).some(a => a.length > 0) },
    { emoji: '🔥', name: '三日之火', desc: '連續 3 天讀經', test: s => s.streak >= 3 },
    { emoji: '🎇', name: '七日恆心', desc: '連續 7 天讀經', test: s => s.streak >= 7 },
    { emoji: '🌋', name: '烈焰不熄', desc: '連續 30 天讀經', test: s => s.streak >= 30 },
    { emoji: '⭐', name: '起星', desc: '累積 500 經驗值', test: s => s.xp >= 500 },
    { emoji: '🌟', name: '星光燦爛', desc: '累積 2,000 經驗值', test: s => s.xp >= 2000 },
    { emoji: '💫', name: '滿天星斗', desc: '累積 10,000 經驗值', test: s => s.xp >= 10000 },
    { emoji: '📖', name: '讀完一卷', desc: '完成一整卷書', test: s => countBooksDone(s) >= 1 },
    { emoji: '📚', name: '五卷達人', desc: '完成 5 卷書', test: s => countBooksDone(s) >= 5 },
    { emoji: '🧩', name: '八福收藏家', desc: '集滿天國八福拼圖', test: s => ((s.puzzles || {}).beatitudes || []).length >= 8 },
    { emoji: '⚡', name: '衝刺高手', desc: '金句衝刺單場 100 分', test: s => ((s.stats || {}).sprintBest || 0) >= 100 },
    { emoji: '🃏', name: '記憶王', desc: '完成 3 局經文翻牌', test: s => ((s.stats || {}).flipWins || 0) >= 3 },
    { emoji: '📅', name: '複習達人', desc: '完成 10 次錯題複習', test: s => ((s.stats || {}).reviewsDone || 0) >= 10 },
    { emoji: '🎤', name: '朗讀勇士', desc: '開口讀經成功 20 次', test: s => ((s.stats || {}).readOk || 0) >= 20 },
    { emoji: '🐋', name: '約拿同行者', desc: '完成約拿冒險全 4 章', test: s => (((s.story || {}).JON) || []).length >= 4 },
    { emoji: '🗿', name: '巨人殺手', desc: '通關「大衛擊殺歌利亞」', test: s => !!((s.minigames || {}).david) },
    { emoji: '🦁', name: '獅子坑的信心', desc: '通關「但以理在獅子坑」', test: s => !!((s.minigames || {}).daniel_lions) },
    { emoji: '🔥', name: '火窯不燒', desc: '通關「火窯三友」', test: s => !!((s.minigames || {}).furnace) },
    { emoji: '⚡', name: '迦密山的火', desc: '通關「以利亞 PK 巴力先知」', test: s => !!((s.minigames || {}).elijah) },
    { emoji: '🌊', name: '分海先鋒', desc: '通關「過紅海」', test: s => !!((s.minigames || {}).redsea) },
    { emoji: '🎺', name: '繞城得勝', desc: '通關「耶利哥城牆」', test: s => !!((s.minigames || {}).jericho) },
    { emoji: '🍞', name: '分餅的手', desc: '通關「五餅二魚」', test: s => !!((s.minigames || {}).loaves) },
    { emoji: '🌈', name: '立約的彩虹', desc: '通關「挪亞方舟」', test: s => !!((s.minigames || {}).noah) },
    { emoji: '⚔️', name: '三百精兵', desc: '通關「基甸與三百勇士」', test: s => !!((s.minigames || {}).gideon) },
    { emoji: '⛵', name: '風浪也聽從', desc: '通關「耶穌平靜風浪」', test: s => !!((s.minigames || {}).storm) },
    { emoji: '👑', name: '挺身的王后', desc: '通關「以斯帖為同胞挺身」', test: s => !!((s.minigames || {}).esther) },
    { emoji: '🔓', name: '鐵門自開', desc: '通關「彼得被天使救出監牢」', test: s => !!((s.minigames || {}).peter_prison) },
    { emoji: '💧', name: '單純的順服', desc: '通關「乃縵洗七次得潔淨」', test: s => !!((s.minigames || {}).naaman) },
    { emoji: '✝️', name: '空墳墓的清晨', desc: '通關「空墳墓・耶穌復活」', test: s => !!((s.minigames || {}).empty_tomb) },
    { emoji: '🐍', name: '一望得生', desc: '通關「摩西舉銅蛇」', test: s => !!((s.minigames || {}).bronze_serpent) },
    { emoji: '🧱', name: '重建的城牆', desc: '通關「尼希米重建城牆」', test: s => !!((s.minigames || {}).nehemiah) },
    { emoji: '🎶', name: '讚美得勝', desc: '通關「約沙法唱詩退敵」', test: s => !!((s.minigames || {}).jehoshaphat) },
    { emoji: '🦴', name: '枯骨復生', desc: '通關「以西結與枯骨復生」', test: s => !!((s.minigames || {}).dry_bones) },
    { emoji: '🌾', name: '忠心的路得', desc: '通關「路得的忠心與救贖」', test: s => !!((s.minigames || {}).ruth) },
    { emoji: '💪', name: '苦難中站立', desc: '通關「約伯苦難中持守信心」', test: s => !!((s.minigames || {}).job) },
    { emoji: '🕺', name: '在主前跳舞', desc: '通關「大衛迎約櫃跳舞」', test: s => !!((s.minigames || {}).david_ark) },
    { emoji: '🌿', name: '死裡復活', desc: '通關「拉撒路復活」', test: s => !!((s.minigames || {}).lazarus) },
    { emoji: '🍇', name: '聖靈果滿枝', desc: '通關「結出聖靈果」', test: s => !!((s.minigames || {}).fruit_spirit) },
    { emoji: '🦊', name: '葡萄園守衛', desc: '通關「擒拿小狐狸」', test: s => !!((s.minigames || {}).foxes) },
    { emoji: '🦅', name: '展翅上騰', desc: '通關「如鷹展翅」', test: s => !!((s.minigames || {}).eagle) },
    { emoji: '🏗️', name: '殿基立定', desc: '通關「重建聖殿」', test: s => !!((s.minigames || {}).ezra_temple) },
    { emoji: '⚖️', name: '與神同行', desc: '通關「三樣功課」', test: s => !!((s.minigames || {}).micah_walk) },
    { emoji: '🪟', name: '敞開天窗', desc: '通關「敞開天窗」', test: s => !!((s.minigames || {}).malachi_window) },
    { emoji: '🎵', name: '被愛歌唱', desc: '通關「祂為你歌唱」', test: s => !!((s.minigames || {}).zeph_song) },
    { emoji: '🏰', name: '患難保障', desc: '通關「患難日的保障」', test: s => !!((s.minigames || {}).nahum_refuge) },
    { emoji: '⛰️', name: '謙卑站立', desc: '通關「驕傲必墜」', test: s => !!((s.minigames || {}).obadiah_pride) },
    { emoji: '🏞️', name: '公義江河', desc: '通關「公義江河」', test: s => !!((s.minigames || {}).amos_river) },
    { emoji: '💗', name: '愛的贖回', desc: '通關「愛的贖回」', test: s => !!((s.minigames || {}).hosea_love) },
    { emoji: '🐑', name: '跟隨好牧人', desc: '通關「牧人的杖」', test: s => !!((s.minigames || {}).psalm_shepherd) },
    { emoji: '🏛️', name: '七柱之家', desc: '通關「智慧建屋」', test: s => !!((s.minigames || {}).wisdom_house) },
    { emoji: '🏺', name: '合用的器皿', desc: '通關「窯匠的手」', test: s => !!((s.minigames || {}).potter_hands) },
    { emoji: '🌻', name: '補還的年歲', desc: '通關「蝗蟲退散」', test: s => !!((s.minigames || {}).joel_locusts) },
    { emoji: '🕊️', name: '得潔淨的日子', desc: '通關「贖罪日」', test: s => !!((s.minigames || {}).atonement) },
    { emoji: '💚', name: '揀選生命', desc: '通關「揀選生命」', test: s => !!((s.minigames || {}).choose_life) },
    { emoji: '🎁', name: '樂意的奉獻', desc: '通關「為聖殿獻上」', test: s => !!((s.minigames || {}).david_offering) },
    { emoji: '☀️', name: '日光之上', desc: '通關「日光之上」', test: s => !!((s.minigames || {}).ecc_sun) },
    { emoji: '🌅', name: '每晨新恩', desc: '通關「每早晨都是新的」', test: s => !!((s.minigames || {}).lam_mercies) },
    { emoji: '🔨', name: '先建神的殿', desc: '通關「先建神的殿」', test: s => !!((s.minigames || {}).haggai_build) },
    { emoji: '🕎', name: '七燈全亮', desc: '通關「七燈點亮」', test: s => !!((s.minigames || {}).zech_lamps) },
    { emoji: '🗼', name: '守望得默示', desc: '通關「守望樓上」', test: s => !!((s.minigames || {}).hab_watch) },
    { emoji: '⛓️', name: '不能隔絕', desc: '通關「不能隔絕的愛」', test: s => !!((s.minigames || {}).rom_love) },
    { emoji: '💞', name: '愛的詩篇', desc: '通關「愛是永不止息」', test: s => !!((s.minigames || {}).cor_love) },
    { emoji: '🫙', name: '瓦器藏寶', desc: '通關「瓦器裡的寶貝」', test: s => !!((s.minigames || {}).clay_jar) },
    { emoji: '👕', name: '穿上新人', desc: '通關「穿上新人」', test: s => !!((s.minigames || {}).col_new) },
    { emoji: '😊', name: '三件旨意', desc: '通關「常常喜樂」', test: s => !!((s.minigames || {}).thes_joy) },
    { emoji: '✊', name: '行善不喪志', desc: '通關「行善不喪志」', test: s => !!((s.minigames || {}).thes_good) },
    { emoji: '✨', name: '年輕的榜樣', desc: '通關「年輕人的榜樣」', test: s => !!((s.minigames || {}).tim_example) },
    { emoji: '🏆', name: '美好的仗', desc: '通關「打那美好的仗」', test: s => !!((s.minigames || {}).tim_fight) },
    { emoji: '❤️‍🔥', name: '熱心為善', desc: '通關「熱心為善」', test: s => !!((s.minigames || {}).titus_good) },
    { emoji: '🏠', name: '恩典的家書', desc: '通關「回家的路」', test: s => !!((s.minigames || {}).philemon_home) },
    { emoji: '🪖', name: '全副軍裝', desc: '通關「穿上全副軍裝」', test: s => !!((s.minigames || {}).armor_god) },
    { emoji: '🏃', name: '向標竿直跑', desc: '通關「向著標竿直跑」', test: s => !!((s.minigames || {}).php_race) },
    { emoji: '🛡️', name: '信心的盾牌', desc: '通關「抵擋吼獅」', test: s => !!((s.minigames || {}).peter_lion) },
    { emoji: '🪜', name: '八階全登', desc: '通關「屬靈八階梯」', test: s => !!((s.minigames || {}).peter_ladder) },
    { emoji: '💡', name: '毫無黑暗', desc: '通關「神就是光」', test: s => !!((s.minigames || {}).john_light) },
    { emoji: '🌠', name: '七星在手', desc: '通關「尋找七星」', test: s => !!((s.minigames || {}).rev_stars) },
    { emoji: '☁️', name: '雲彩見證', desc: '通關「信心的雲彩」', test: s => !!((s.minigames || {}).faith_cloud) },
    { emoji: '⚓', name: '掌穩舌舵', desc: '通關「勒住舌頭」', test: s => !!((s.minigames || {}).tongue_helm) },
    { emoji: '🚪', name: '真理守門', desc: '通關「守住真理」', test: s => !!((s.minigames || {}).walk_truth) },
    { emoji: '🤝', name: '該猶的門', desc: '通關「愛心接待」', test: s => !!((s.minigames || {}).gaius_love) },
    { emoji: '🏯', name: '真道堡壘', desc: '通關「真道堡壘」', test: s => !!((s.minigames || {}).keep_faith) },
  ];
  const earnedBadges = () => BADGES.filter(b => b.test(state));
  function renderBadges() {
    const grid = $('#badge-grid');
    grid.innerHTML = '';
    for (const b of BADGES) {
      const got = b.test(state);
      const tile = document.createElement('div');
      tile.className = 'badge-tile' + (got ? ' got' : '');
      tile.innerHTML = `<span class="badge-emoji">${got ? b.emoji : '🔒'}</span>
        <span class="badge-name">${b.name}</span>
        <span class="badge-desc">${b.desc}</span>`;
      grid.appendChild(tile);
    }
  }
  $('#btn-badges').onclick = () => { renderBadges(); show('#screen-badges'); };
  $('#btn-back-badges').onclick = () => { renderBooks(); show('#screen-books'); };

  // ===== 🐋 約拿冒險（故事模式）=====
  let story = null;      // { ch, i }：進行中的章與場景進度
  let storyData = null;  // data/story/JON.json 的內容
  async function loadStory() {
    if (!storyData) {
      const res = await fetch('data/story/JON.json');
      if (!res.ok) throw new Error('story ' + res.status);
      storyData = await res.json();
    }
    return storyData;
  }
  const storyDone = () => (state.story && state.story.JON) || [];
  async function openStoryList() {
    try { await loadStory(); }
    catch (e) { console.warn('故事載入失敗', e); alert('網路不穩，故事載入失敗了，請再試一次。'); return; }
    const list = $('#story-chapters');
    list.innerHTML = '';
    const done = storyDone();
    storyData.chapters.forEach((c, i) => {
      const unlocked = i === 0 || done.includes(i - 1);
      const node = document.createElement('button');
      node.className = 'story-ch' + (done.includes(i) ? ' done' : unlocked ? '' : ' locked');
      node.innerHTML = `<span class="story-ch-emoji">${done.includes(i) ? '⭐' : unlocked ? c.emoji : '🔒'}</span>
        <span class="story-ch-name">第 ${i + 1} 章・${c.title}</span>
        <span class="story-ch-sub">${done.includes(i) ? '已完成，可重播' : unlocked ? '點我開始' : '完成上一章解鎖'}</span>`;
      if (unlocked) node.onclick = () => startStoryCh(i);
      list.appendChild(node);
    });
    show('#screen-story-list');
  }
  function startStoryCh(i) {
    story = { ch: i, i: 0 };
    $('#story-title').textContent = `第 ${i + 1} 章・${storyData.chapters[i].title}`;
    $('#story-bg').textContent = '';
    $('#story-loc').textContent = '';
    show('#screen-story');
    renderScene();
  }
  function renderScene() {
    const scenes = storyData.chapters[story.ch].scenes;
    if (story.i >= scenes.length) { endStoryCh(); return; }
    const s = scenes[story.i];
    const box = $('#story-box');
    const advance = () => { box.onclick = null; story.i++; renderScene(); };
    if (s.t === 'bg') { // 換場景（不佔一步）
      $('#story-bg').textContent = s.bg;
      $('#story-loc').textContent = s.label || '';
      story.i++;
      renderScene();
      return;
    }
    if (s.t === 'narr') {
      box.innerHTML = `<p class="story-narr">${escapeHtml(s.text)}</p><p class="story-tap">▼ 點一下繼續</p>`;
      box.onclick = advance;
    } else if (s.t === 'say') {
      box.innerHTML = `<div class="story-who">${s.emoji} ${escapeHtml(s.who)}</div>
        <p class="story-say">${escapeHtml(s.text)}</p><p class="story-tap">▼ 點一下繼續</p>`;
      box.onclick = advance;
    } else if (s.t === 'choice') { // 抉擇：沒有對錯，回一句回應
      box.onclick = null;
      box.innerHTML = `<p class="story-narr">🤔 ${escapeHtml(s.q)}</p>`;
      const wrap = document.createElement('div');
      wrap.className = 'story-opts';
      s.opts.forEach((o) => {
        const b = document.createElement('button');
        b.className = 'choice';
        b.textContent = o.text;
        b.onclick = () => {
          box.innerHTML = `<p class="story-narr">💬 ${escapeHtml(o.reply)}</p><p class="story-tap">▼ 點一下繼續</p>`;
          box.onclick = advance;
        };
        wrap.appendChild(b);
      });
      box.appendChild(wrap);
    } else if (s.t === 'q') { // 小考驗：答錯不懲罰，看完正解繼續
      box.onclick = null;
      box.innerHTML = `<p class="story-narr">📖 小考驗：${escapeHtml(s.q)}</p>`;
      const wrap = document.createElement('div');
      wrap.className = 'story-opts';
      shuffleArr(s.opts).forEach((optText) => {
        const b = document.createElement('button');
        b.className = 'choice';
        b.textContent = optText;
        b.onclick = () => {
          const ok = optText === s.answer;
          wrap.querySelectorAll('.choice').forEach((x) => {
            x.disabled = true;
            if (x.textContent === s.answer) x.classList.add('correct');
          });
          if (!ok) b.classList.add('wrong');
          (ok ? sndGood : sndBad)();
          const p = document.createElement('p');
          p.className = 'story-narr';
          p.textContent = (ok ? pickPraise() : `正確答案：${s.answer}`) + (s.basis ? `　📖 ${s.basis}` : '');
          box.appendChild(p);
          const tap = document.createElement('p');
          tap.className = 'story-tap';
          tap.textContent = '▼ 點一下繼續';
          box.appendChild(tap);
          box.onclick = advance;
        };
        wrap.appendChild(b);
      });
      box.appendChild(wrap);
    }
  }
  function endStoryCh() {
    const chIdx = story.ch;
    story = null;
    if (!state.story) state.story = {};
    const done = state.story.JON || (state.story.JON = []);
    const first = !done.includes(chIdx);
    if (first) {
      done.push(chIdx);
      state.xp += 60; // 2026-07-18 約拿故事經驗加倍（原 30）
      ensureWeek();
      state.weekXp += 60;
      bumpStreak();
      store.save(state);
      sndWin();
    }
    const all = done.length === storyData.chapters.length;
    if (first && all) throwConfetti();
    $('#result-box').innerHTML = `
      <div class="r-emoji">🐋${all ? '🏆' : '⭐'}</div>
      <h2>${all ? '約拿冒險完結！' : `第 ${chIdx + 1} 章完成！`}</h2>
      <p>${all ? '神的愛比我們想的更寬！' : '故事還沒完，繼續往下走…'}</p>
      ${first ? '<div class="result-stats"><div class="r-stat">＋60<span>經驗值</span></div></div>' : '<p class="board-hint">（重播章節不重複給經驗值）</p>'}
      <button class="big-btn" id="btn-continue">${all ? '回故事選單' : '下一章 →'}</button>
      <button class="ghost-btn" id="btn-story-home">回首頁</button>`;
    $('#btn-continue').onclick = () => {
      renderTopbar();
      if (!all && chIdx + 1 < storyData.chapters.length) { startStoryCh(chIdx + 1); return; }
      openStoryList();
    };
    $('#btn-story-home').onclick = () => { renderTopbar(); renderBooks(); show('#screen-books'); };
    renderTopbar();
    show('#screen-result');
  }
  // 約拿冒險從約拿書章節頁進入，返回也回約拿書
  $('#btn-back-story').onclick = () => openBook('JON');
  $('#btn-story-quit').onclick = () => {
    if (confirm('要離開故事嗎？這一章要從頭開始喔。')) { story = null; openStoryList(); }
  };

  $('#btn-review-start').onclick = () => startReviewLesson();
  function startReviewLesson() {
    const due = dueReviews().slice(0, 10);
    if (!due.length) return;
    lesson = {
      chapterNum: 0, qs: due.map(r => r.q), i: 0, hearts: MAX_HEARTS,
      wrong: 0, xp: 0, wrongQs: [], inRetest: false, awarded: true, // awarded=true：複習不走過關記帳
      isReview: true, reviewItems: due, reviewCorrect: 0,
    };
    renderTopbar();
    show('#screen-lesson');
    renderQuestion();
  }
  function winReview() {
    const base = (lesson.reviewCorrect || 0) * 5;
    const pct = friendBonus.pct || 0; // 組隊加成也適用錯題複習
    const gained = base + Math.round(base * pct / 100);
    state.xp += gained;
    ensureWeek();
    state.weekXp += gained;
    bumpStreak();
    state.stats.reviewsDone = (state.stats.reviewsDone || 0) + 1; // 徽章計數
    store.save(state);
    sndWin();
    const left = dueReviews().length;
    const xpNote = pct && gained > base ? `（每對一題 +5，含👥組隊 +${pct}%）` : '（每對一題 +5）';
    $('#result-box').innerHTML = `
      <div class="r-emoji">${mascot().emoji}📅</div>
      <h2>複習完成！</h2>
      <p>錯題複習過，記憶才會變長期的！</p>
      <div class="result-stats">
        <div class="r-stat">＋${gained}<span>經驗值${xpNote}</span></div>
        <div class="r-stat">${left}<span>今日還剩複習題</span></div>
      </div>
      <button class="big-btn" id="btn-continue">${left ? '繼續複習' : '回首頁'}</button>`;
    $('#btn-continue').onclick = () => {
      lesson = null; renderTopbar();
      if (left) { startReviewLesson(); return; }
      renderBooks(); renderReviewBanner(); show('#screen-books');
    };
    lessonEndCommon();
  }
  function winLesson() {
    awardWin();
    sndWin();
    if (lesson.perfect) throwConfetti();
    const notes = [];
    if (lesson.perfect) notes.push('完美 +20');
    if (lesson.friendXp) notes.push(`👥組隊 +${lesson.friendPct}%`);
    const xpNote = notes.length ? `（含${notes.join('、')}）` : '';
    $('#result-box').innerHTML = `
      <div class="r-emoji">${mascot().emoji}${lesson.perfect ? '🏆' : '🎉'}</div>
      <h2>${lesson.perfect ? '完美通關！' : '過關！'}</h2>
      <p>${currentBook.name} 第 ${lesson.chapterNum} 章</p>
      ${lesson.inRetest ? '<p class="retest-done">🔁 已完成錯題複習</p>' : ''}
      <div class="result-stats">
        <div class="r-stat">＋${lesson.gained}<span>經驗值${xpNote}</span></div>
        <div class="r-stat">🔥 ${state.streak}<span>連續天數</span></div>
      </div>
      <button class="big-btn" id="btn-continue">繼續</button>`;
    // 過關後跳排行榜：馬上看到自己的名次爬升；從排行榜返回會回到剛剛的章節路徑
    $('#btn-continue').onclick = () => {
      boardReturnTo = currentBook.id;
      lesson = null;
      renderTopbar();
      show('#screen-board');
      $('#board-list').innerHTML = '<p class="board-hint">⭐ 成績同步中…</p>';
      setTimeout(renderBoard, 1200); // 等雲端寫入完成再抓榜，避免看到舊分數
    };
    lessonEndCommon();
  }
  function failLesson() {
    $('#result-box').innerHTML = `
      <div class="r-emoji">${mascot().emoji}💔</div>
      <h2>愛心用完了</h2>
      <p>沒關係，讀經不是比賽，${mascot().name}陪你再試一次！</p>
      <div class="result-stats">
        <div class="r-stat">${lesson.qs.length} 題中的第 ${lesson.i + 1} 題<span>這次走到</span></div>
      </div>
      <button class="big-btn" id="btn-retry">再挑戰一次</button>`;
    const ch = lesson.chapterNum;
    $('#btn-retry').onclick = () => startLesson(ch);
    lessonEndCommon();
  }
  function lessonEndCommon() {
    renderTopbar();
    show('#screen-result');
  }

  // ===== 帳號與雲端同步 =====
  let currentUser = null;

  // 本機與雲端進度合併：完成章取聯集、經驗值與連續天數取較高者、外觀以雲端為準
  // 愛心：把某份存檔「換算到現在」應有的愛心與計時錨點（不改動原物件）
  function effHearts(s) {
    let h = typeof s.hearts === 'number' ? s.hearts : MAX_HEARTS;
    let ts = s.heartsTs || Date.now();
    if (h < MAX_HEARTS) {
      const regen = Math.floor((Date.now() - ts) / HEART_REGEN_MS);
      if (regen > 0) { h = Math.min(MAX_HEARTS, h + regen); ts = h >= MAX_HEARTS ? Date.now() : ts + regen * HEART_REGEN_MS; }
    } else ts = Date.now();
    return { hearts: h, heartsTs: ts };
  }
  function mergeStates(local, cloud) {
    if (!cloud) return local;
    const done = {};
    for (const k of new Set([...Object.keys(local.done || {}), ...Object.keys(cloud.done || {})])) {
      done[k] = [...new Set([...(local.done?.[k] || []), ...(cloud.done?.[k] || [])])].sort((a, b) => a - b);
    }
    // 本週經驗值：只認「本週」的分數取較高者，避免換裝置登入時被新裝置的 0 分蓋掉
    const wk = weekKeyOf();
    const localWeek = local.weekKey === wk ? (local.weekXp || 0) : 0;
    const cloudWeek = cloud.weekKey === wk ? (cloud.weekXp || 0) : 0;
    const localCh = local.weekKey === wk ? (local.weekCh || 0) : 0;
    const cloudCh = cloud.weekKey === wk ? (cloud.weekCh || 0) : 0;
    // 管理員強制校正：當雲端 admBump 比本機大，代表 Burger 在後台調過分數（含「調低」）
    // → 分數改成「以雲端為準」而非取較大值，否則本機的舊高分會把調低的結果又拉回去
    const adminOverride = (cloud.admBump || 0) > (local.admBump || 0);
    return {
      admBump: Math.max(local.admBump || 0, cloud.admBump || 0),
      xp: adminOverride ? (cloud.xp || 0) : Math.max(local.xp || 0, cloud.xp || 0),
      streak: adminOverride ? (cloud.streak || 0) : Math.max(local.streak || 0, cloud.streak || 0),
      lastPlay: (local.lastPlay || '') > (cloud.lastPlay || '') ? local.lastPlay : (cloud.lastPlay || ''),
      done,
      scene: cloud.scene || local.scene,
      mascot: cloud.mascot || local.mascot,
      nickname: cloud.nickname || local.nickname || '', // 換裝置時保留自己取的排行榜名字
      weekKey: wk,
      weekXp: adminOverride ? cloudWeek : Math.max(localWeek, cloudWeek),
      weekCh: Math.max(localCh, cloudCh),
      // 上週分數：取「上週鑰匙較新」那份（跨裝置時保留真正上週的成績）
      ...((local.lastWeekKey || '') >= (cloud.lastWeekKey || '')
        ? { lastWeekKey: local.lastWeekKey || '', lastWeekXp: local.lastWeekXp || 0 }
        : { lastWeekKey: cloud.lastWeekKey || '', lastWeekXp: cloud.lastWeekXp || 0 }),
      review: mergeReview(local.review, cloud.review),
      puzzles: { beatitudes: [...new Set([...(local.puzzles?.beatitudes || []), ...(cloud.puzzles?.beatitudes || [])])] },
      stats: mergeStats(local.stats, cloud.stats),
      story: { JON: [...new Set([...((local.story || {}).JON || []), ...((cloud.story || {}).JON || [])])] },
      minigames: Object.assign({}, cloud.minigames, local.minigames), // 任一裝置通關就算通關
      milestones: (() => { // 路徑里程碑：每卷各取聯集
        const out = {};
        for (const k of new Set([...Object.keys(local.milestones || {}), ...Object.keys(cloud.milestones || {})])) {
          out[k] = [...new Set([...((local.milestones || {})[k] || []), ...((cloud.milestones || {})[k] || [])])].sort((a, b) => a - b);
        }
        return out;
      })(),
      friends: [...new Set([...(local.friends || []), ...(cloud.friends || [])])], // 好友清單取聯集
      // 愛心：兩邊各算到「現在」，取較多者（不苛扣跨裝置玩家）
      // 但雲端沒存過愛心（舊資料/從沒同步）時只信本機，否則登出再登入會被假的滿血蓋回 5 顆
      ...(() => {
        const a = effHearts(local);
        if (typeof cloud.hearts !== 'number') return a;
        const b = effHearts(cloud);
        return a.hearts >= b.hearts ? a : b;
      })(),
    };
  }
  // 計數器合併：每個欄位取較大值（兩邊各玩各的都不吃虧）
  function mergeStats(local, cloud) {
    const out = { ...(cloud || {}) };
    for (const [k, v] of Object.entries(local || {})) {
      out[k] = Math.max(out[k] || 0, v || 0);
    }
    return out;
  }
  // 複習佇列合併：以雲端為主，補上雲端沒有的本機錯題
  function mergeReview(local, cloud) {
    const merged = [...(cloud || [])];
    for (const r of (local || [])) {
      if (!merged.some(c => c.key === r.key)) merged.push(r);
    }
    return merged.slice(-50);
  }

  function renderUserUi() {
    const btn = $('#btn-user');
    const banner = $('#login-banner');
    if (currentUser) {
      btn.innerHTML = currentUser.photo
        ? `<img src="${currentUser.photo}" alt="頭像" style="width:26px;height:26px;border-radius:50%;vertical-align:middle;">`
        : '😊';
      btn.title = `${currentUser.name}（點擊可登出）`;
      banner.classList.add('hidden');
    } else {
      btn.textContent = '👤';
      btn.title = '登入 / 帳號';
      banner.classList.remove('hidden');
    }
  }
  $('#btn-user').onclick = () => {
    if (!currentUser) { CloudSync.login(); return; }
    if (confirm(`要登出 ${currentUser.name} 嗎？\n（進度已存在雲端，登出後本機仍可離線遊玩）`)) CloudSync.logout();
  };
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'btn-login-banner') CloudSync.login();
  });

  CloudSync.init((userInfo, cloudState) => {
    currentUser = userInfo;
    if (userInfo) {
      state = Object.assign(state, mergeStates(state, cloudState));
      store.save(state); // 合併結果回寫本機＋雲端
      applyScene();
    }
    renderUserUi();
    renderTopbar();
    if (bookIndex) renderBooks();
    syncFriendInbox(); // 好友邀請背景同步＋首頁好友格提示
    refreshRankReward(); // 登入後算上週名次，解鎖對應的夥伴/場景
  });

  // ===== 排行榜 =====
  let boardMode = 'week';
  let boardReturnTo = null; // 過關跳進排行榜時記住書卷 ID，返回時回章節路徑而不是首頁
  async function renderBoard() {
    const list = $('#board-list');
    list.innerHTML = '<p class="board-hint">載入中…</p>';
    let rows = [];
    let pendingOut = new Set(); // 我已送出、對方還沒回覆的邀請（排行榜顯示「等待中」，2026-07-17 Burger 回饋）
    const reqP = CloudSync.isLoggedIn() ? CloudSync.fetchRequests().catch(() => null) : Promise.resolve(null);
    try { rows = await CloudSync.fetchBoard(boardMode, weekKeyOf()); }
    catch (e) { console.warn('排行榜載入失敗', e); list.innerHTML = '<p class="board-hint">排行榜載入失敗，請檢查網路後再試。</p>'; return; }
    const req = await reqP; // 邀請清單抓失敗不影響排行榜，只是不顯示等待標記
    if (req) pendingOut = new Set(req.outgoing.map((r) => r.to));
    list.innerHTML = '';
    if (!rows.length) {
      list.innerHTML = '<p class="board-hint">榜上還空無一人——快去闖一關搶頭香！</p>';
    } else {
      const my = CloudSync.uid();
      const medals = ['🥇', '🥈', '🥉'];
      rows.forEach((r, i) => {
        const row = document.createElement('div');
        const isMe = r.uid === my;
        row.className = 'board-row' + (isMe ? ' me' : '');
        const m = MASCOTS[r.mascot] || MASCOTS.dove;
        const canAdd = !isMe && CloudSync.isLoggedIn() && !(state.friends || []).includes(r.uid); // 排行榜直接加好友（2026-07-16 回饋）
        const waiting = canAdd && pendingOut.has(r.uid); // 已邀請過→顯示等待中，不再給 ➕
        const frCell = !canAdd ? '' : waiting
          ? '<span class="b-waitfr" title="邀請已送出，等待對方同意">⏳等待中</span>'
          : '<button class="b-addfr" title="加好友">➕</button>';
        row.innerHTML = `<span class="b-rank">${medals[i] || i + 1}</span>
          <span class="b-mascot">${m.emoji}</span>
          <span class="b-nick">${escapeHtml(r.nick || '無名小卒')}${isMe ? ' <span class="b-editme">✏️改名</span>' : ''}</span>
          <span class="b-xp">⭐ ${boardMode === 'week' ? (r.weekXp || 0) : (r.xp || 0)}</span>${frCell}`;
        if (isMe) row.onclick = openNameEditor; // 點自己那一列即可改名
        const addBtn = row.querySelector('.b-addfr');
        if (addBtn) addBtn.onclick = async (e) => {
          e.stopPropagation();
          addBtn.disabled = true; addBtn.textContent = '…';
          try {
            await CloudSync.sendFriendRequest(r.uid, state.nickname || (currentUser && currentUser.name) || '', r.nick || '');
            addBtn.textContent = '⏳等待中';
          } catch (err) { console.warn('排行榜加好友失敗', err); addBtn.disabled = false; addBtn.textContent = '➕'; alert('網路不穩，請再試一次。'); }
        };
        list.appendChild(row);
      });
    }
    if (!CloudSync.isLoggedIn()) {
      const p = document.createElement('p');
      p.className = 'board-hint';
      p.textContent = '登入後過關，你的名字就會出現在榜上！';
      list.appendChild(p);
    } else {
      const p = document.createElement('p');
      p.className = 'board-hint';
      p.innerHTML = '想換個名字？點右上角 ✏️、或點你自己那一列就能改。';
      list.appendChild(p);
    }
  }
  $('#btn-board').onclick = () => { boardReturnTo = null; show('#screen-board'); renderBoard(); };
  $('#btn-back-board').onclick = () => {
    if (boardReturnTo) { const id = boardReturnTo; boardReturnTo = null; openBook(id); return; }
    renderBooks(); show('#screen-books');
  };
  for (const tab of document.querySelectorAll('[data-board]')) {
    tab.onclick = () => {
      document.querySelectorAll('[data-board]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      boardMode = tab.dataset.board;
      renderBoard();
    };
  }
  // ===== 排行榜顯示名字（App 內輸入視窗，取代瀏覽器跳出框）=====
  function openNameEditor() {
    if (!CloudSync.isLoggedIn()) { alert('先登入才能設定排行榜名字喔！'); return; }
    const input = $('#name-input');
    input.value = state.nickname || (currentUser && currentUser.name) || '';
    $('#name-overlay').classList.remove('hidden');
    setTimeout(() => { input.focus(); input.select(); }, 60);
  }
  $('#btn-nickname').onclick = openNameEditor;
  $('#btn-name-cancel').onclick = () => $('#name-overlay').classList.add('hidden');
  $('#btn-name-save').onclick = async () => {
    const nick = $('#name-input').value.trim().slice(0, 12);
    if (!nick) { alert('暱稱不能是空白的喔！'); return; }
    // 暱稱唯一：登入者改名要先到登記簿佔位，被別人用了就換一個（好友搜尋才不會搞混）
    if (CloudSync.isLoggedIn() && nick !== state.nickname) {
      const btn = $('#btn-name-save');
      btn.disabled = true; btn.textContent = '檢查中…';
      let ok = false;
      try { ok = await CloudSync.claimNickname(nick, state.nickname || ''); }
      catch (e) { console.warn('暱稱登記失敗', e); btn.disabled = false; btn.textContent = '儲存'; alert('網路不穩，暱稱沒改成功，請再試一次。'); return; }
      btn.disabled = false; btn.textContent = '儲存';
      if (!ok) { alert('這個暱稱已經有人用了，換一個吧！'); return; }
    }
    state.nickname = nick;
    store.save(state);
    $('#name-overlay').classList.add('hidden');
    $('#board-list').innerHTML = '<p class="board-hint">名字已更新，同步中…</p>';
    setTimeout(renderBoard, 1500); // 等雲端寫入完成再刷新
  };
  $('#name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-name-save').click(); });

  // ===== 👥 好友系統（Phase 1：好友碼、邀請/同意、好友清單）=====
  // 「對方已同意」的邀請收尾：把對方補進我的好友清單，然後刪掉邀請文件
  async function processAcceptedRequests(accepted) {
    let changed = false;
    for (const r of accepted) {
      if (!state.friends.includes(r.to)) { state.friends.push(r.to); changed = true; }
      CloudSync.removeRequest(r.id);
    }
    if (changed) store.save(state);
  }
  // 登入後背景同步：收尾已同意的邀請＋更新首頁好友格的提示文字
  async function syncFriendInbox() {
    if (!CloudSync.isLoggedIn()) { $('#friends-hint').textContent = '揪團一起讀經'; $('#friends-dot').classList.add('hidden'); return; }
    try {
      const req = await CloudSync.fetchRequests();
      await processAcceptedRequests(req.accepted);
      const n = req.incoming.length;
      $('#friends-hint').textContent = n ? `🔔 ${n} 個邀請待處理` : (state.friends.length ? `${state.friends.length} 位好友` : '揪團一起讀經');
      $('#friends-dot').classList.toggle('hidden', !n); // 頂列 👥 的紅點：有邀請待處理才亮
      await refreshFriendBonus();
    } catch (e) { console.warn('好友同步失敗', e); }
  }
  // --- 組隊經驗加成（Phase 2＋Phase 3）---
  // 固定好友：本週有 ≥1 位好友也有玩 → +20%；我＋至少 2 位好友都完成週任務（各 3 章）→ +30%（取代 20%）
  // 隨機夥伴（報名制）：全組都完成週任務 → 再疊 +20%；合計上限 50%
  // 加成只套用「章節過關」與「錯題複習」的經驗值，小遊戲/衝刺不加（防刷）
  const QUEST_CH = 3; // 週任務門檻：本週完成 3 章
  const BONUS_CAP = 50;
  let friendBonus = { pct: 0, teamPct: 0, partnerPct: 0, active: 0, questMates: 0, meQuest: false, profiles: [], match: { joined: false, waiting: false, partners: [] } };
  // 配對：照報名順序兩兩成對（週中有新人報名，已成形的組不會被打散）；
  // 單數時最後一位暫併入前一組成三人，等下一位報名再獨立成對
  function matchGroupOf(entries, myUid) {
    const groups = [];
    for (let i = 0; i + 1 < entries.length; i += 2) groups.push([entries[i], entries[i + 1]]);
    if (entries.length % 2 === 1) {
      const tail = entries[entries.length - 1];
      if (groups.length) groups[groups.length - 1].push(tail);
      else groups.push([tail]); // 全池只有一人：獨自等待
    }
    return groups.find((g) => g.some((e) => e.uid === myUid)) || null;
  }
  async function refreshFriendBonus() {
    if (!CloudSync.isLoggedIn()) {
      friendBonus = { pct: 0, teamPct: 0, partnerPct: 0, active: 0, questMates: 0, meQuest: false, profiles: [], match: { joined: false, waiting: false, partners: [] } };
      return friendBonus;
    }
    try {
      const wk = weekKeyOf();
      const meQuest = state.weekKey === wk && (state.weekCh || 0) >= QUEST_CH;
      // 固定好友的組隊加成
      let teamPct = 0, active = [], questMates = [], profiles = [];
      if ((state.friends || []).length) {
        profiles = await CloudSync.fetchProfiles(state.friends);
        active = profiles.filter((p) => p.weekKey === wk && (p.weekXp || 0) > 0);
        questMates = profiles.filter((p) => p.weekKey === wk && (p.weekCh || 0) >= QUEST_CH);
        if (active.length >= 1) teamPct = 20;
        if (meQuest && questMates.length >= 2) teamPct = 30; // 三人小隊全數達標
      }
      // 每週隨機夥伴的疊加
      let partnerPct = 0;
      const match = { joined: false, waiting: false, partners: [] };
      const entries = await CloudSync.fetchMatchEntries(wk);
      const g = matchGroupOf(entries, CloudSync.uid());
      if (g) {
        match.joined = true;
        const partnerUids = g.filter((e) => e.uid !== CloudSync.uid()).map((e) => e.uid);
        if (!partnerUids.length) match.waiting = true;
        else {
          const pp = await CloudSync.fetchProfiles(partnerUids);
          match.partners = partnerUids.map((u) => {
            const p = pp.find((x) => x.uid === u) || {};
            const entry = g.find((e) => e.uid === u) || {};
            const ch = p.weekKey === wk ? (p.weekCh || 0) : 0;
            return { uid: u, nick: p.nick || entry.nick || '無名小卒', mascot: p.mascot || entry.mascot || 'dove', weekCh: ch, done: ch >= QUEST_CH };
          });
          if (meQuest && match.partners.every((p) => p.done)) partnerPct = 20; // 全組達標，大家都 +20%
        }
      }
      friendBonus = {
        pct: Math.min(BONUS_CAP, teamPct + partnerPct), teamPct, partnerPct,
        active: active.length, questMates: questMates.length, meQuest, profiles, match,
      };
    } catch (e) { console.warn('好友加成計算失敗（先用舊值）', e); }
    return friendBonus;
  }
  async function renderFriends() {
    const body = $('#friends-body');
    if (!CloudSync.isLoggedIn()) {
      body.innerHTML = `<div class="fr-card fr-center">
        <p>加好友要先用 Google 登入，<br>好友和進度都會存在雲端。</p>
        <button class="big-btn" id="btn-friends-login">用 Google 登入</button></div>`;
      $('#btn-friends-login').onclick = () => CloudSync.login();
      return;
    }
    body.innerHTML = '<p class="board-hint">載入中…</p>';
    let req, profiles;
    try {
      req = await CloudSync.fetchRequests();
      await processAcceptedRequests(req.accepted);
      await refreshFriendBonus(); // 同一次抓取供加成計算＋清單顯示
      profiles = friendBonus.profiles;
    } catch (e) {
      console.warn('好友資料載入失敗', e);
      body.innerHTML = '<p class="board-hint">好友資料載入失敗，請檢查網路後再試。</p>';
      return;
    }
    body.innerHTML = '';
    // --- 本週加成狀態（有好友或已報名配對才顯示）---
    ensureWeek();
    const fb = friendBonus;
    const myCh = state.weekCh || 0;
    const myQuestText = `${Math.min(myCh, QUEST_CH)}/${QUEST_CH} 章${myCh >= QUEST_CH ? ' ✅' : ''}`;
    if (state.friends.length || fb.match.joined) {
      const status = document.createElement('div');
      status.className = 'fr-card fr-bonus' + (fb.pct ? ' on' : '');
      const teamHint = !state.friends.length ? ''
        : fb.teamPct >= 30 ? ''
        : fb.teamPct === 20 ? `想升級 +30%：你完成 ${QUEST_CH} 章（目前 ${myQuestText}），且至少 2 位好友也完成（目前 ${fb.questMates} 位）`
        : '只要有一位好友本週玩過任一關，你們都 +20%！';
      status.innerHTML = `<h3 class="fr-h">🤝 本週加成合計：<b class="fr-pct">${fb.pct ? `+${fb.pct}%` : '尚未啟動'}</b>${fb.pct >= BONUS_CAP ? '（已達上限）' : ''}</h3>
        <p class="fr-tip">固定好友組隊：+${fb.teamPct}%（本週有玩 ${fb.active} 位・達標 ${fb.questMates} 位）</p>
        <p class="fr-tip">隨機夥伴任務：+${fb.partnerPct}%${fb.match.joined ? '' : '（尚未報名）'}・我的週任務：${myQuestText}</p>
        ${teamHint ? `<p class="fr-tip">💡 ${teamHint}</p>` : ''}`;
      body.appendChild(status);
    }
    // --- 🎲 每週隨機夥伴（報名制）---
    const mc = document.createElement('div');
    mc.className = 'fr-card fr-match';
    if (!fb.match.joined) {
      mc.innerHTML = `<h3 class="fr-h">🎲 每週隨機夥伴</h3>
        <p class="fr-tip">報名後系統會把你和另一位報名者配成一組；兩人本週各完成 ${QUEST_CH} 章，雙方經驗加成都 +20%（可與好友組隊疊加，上限 ${BONUS_CAP}%）。每週一重新配對。</p>
        <button class="big-btn" id="btn-match-join">參加本週配對</button>`;
    } else if (fb.match.waiting) {
      mc.innerHTML = `<h3 class="fr-h">🎲 每週隨機夥伴：已報名 ⏳</h3>
        <p class="fr-tip">等下一位夥伴加入就自動配對——揪身邊的人也來報名吧！</p>
        <button class="ghost-btn" id="btn-match-leave">取消報名</button>`;
    } else {
      const rows = fb.match.partners.map((p) => {
        const m = MASCOTS[p.mascot] || MASCOTS.dove;
        return `<div class="fr-friend-row"><span class="b-mascot">${m.emoji}</span>
          <span class="fr-name">${escapeHtml(p.nick)}</span>
          <span class="fr-week">📖${p.weekCh}/${QUEST_CH}章${p.done ? '✅' : ''}</span></div>`;
      }).join('');
      const allDone = fb.partnerPct > 0;
      const hint = allDone
        ? '🎉 全組達標，本週 +20% 已解鎖！'
        : `全組（含你）本週各完成 ${QUEST_CH} 章就 +20%。我的進度：${myQuestText}`;
      mc.innerHTML = `<h3 class="fr-h">🎲 本週隨機夥伴${fb.match.partners.length > 1 ? '（三人組）' : ''}</h3>
        ${rows}<p class="fr-tip">${hint}</p>`;
    }
    body.appendChild(mc);
    const joinBtn = $('#btn-match-join');
    if (joinBtn) joinBtn.onclick = async () => {
      joinBtn.disabled = true;
      try { await CloudSync.joinMatch(weekKeyOf(), state.nickname || (currentUser && currentUser.name) || '', state.mascot); }
      catch (e) { console.warn('報名失敗', e); alert('網路不穩，報名沒成功，請再試一次。'); }
      renderFriends();
    };
    const leaveBtn = $('#btn-match-leave');
    if (leaveBtn) leaveBtn.onclick = async () => {
      leaveBtn.disabled = true;
      await CloudSync.leaveMatch(weekKeyOf());
      renderFriends();
    };
    // --- 我的好友碼＋加好友 ---
    const card = document.createElement('div');
    card.className = 'fr-card fr-addcard';
    card.innerHTML = `
      <div class="fr-code-row"><span>我的好友碼</span><b id="fr-mycode">${CloudSync.myFriendCode()}</b><button id="btn-copy-code">複製</button></div>
      <p class="fr-tip">把好友碼傳給朋友，或在下面輸入對方的好友碼／暱稱：</p>
      <div class="fr-add-row"><input id="fr-add-input" maxlength="20" placeholder="好友碼（T-XXXXXX）或暱稱"><button id="btn-fr-add" class="big-btn">加好友</button></div>`;
    body.appendChild(card);
    $('#btn-copy-code').onclick = async () => {
      const code = CloudSync.myFriendCode();
      try { await navigator.clipboard.writeText(code); $('#btn-copy-code').textContent = '已複製✓'; }
      catch { prompt('手動複製你的好友碼：', code); }
      setTimeout(() => { const b = $('#btn-copy-code'); if (b) b.textContent = '複製'; }, 1500);
    };
    $('#btn-fr-add').onclick = addFriendFlow;
    $('#fr-add-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') addFriendFlow(); });
    // --- 收到的邀請 ---
    if (req.incoming.length) {
      const sec = document.createElement('div');
      sec.className = 'fr-card fr-inc';
      sec.innerHTML = `<h3 class="fr-h">🔔 收到的邀請</h3>`;
      for (const r of req.incoming) {
        const row = document.createElement('div');
        row.className = 'fr-req-row';
        row.innerHTML = `<span class="fr-name">${escapeHtml(r.fromNick || '無名小卒')}</span>
          <button class="fr-ok">同意</button><button class="fr-no">婉拒</button>`;
        row.querySelector('.fr-ok').onclick = async () => {
          try {
            if (!state.friends.includes(r.from)) { state.friends.push(r.from); store.save(state); }
            await CloudSync.answerRequest(r.id, true);
          } catch (e) { console.warn('同意邀請失敗', e); alert('網路不穩，請再試一次。'); }
          renderFriends();
        };
        row.querySelector('.fr-no').onclick = async () => {
          await CloudSync.removeRequest(r.id); // 婉拒＝直接刪除邀請，對方可再邀
          renderFriends();
        };
        sec.appendChild(row);
      }
      body.appendChild(sec);
    }
    // --- 等待對方同意 ---
    if (req.outgoing.length) {
      const sec = document.createElement('div');
      sec.className = 'fr-card fr-out';
      sec.innerHTML = `<h3 class="fr-h">⏳ 等待對方同意</h3>` + req.outgoing.map((r) =>
        `<div class="fr-req-row"><span class="fr-name fr-dim">等待「${escapeHtml(r.toNick || '好友')}」回應中…</span><button class="fr-no" data-rid="${r.id}">取消</button></div>`).join('');
      sec.querySelectorAll('.fr-no').forEach((b) => {
        b.onclick = async () => { await CloudSync.removeRequest(b.dataset.rid); renderFriends(); };
      });
      body.appendChild(sec);
    }
    // --- 好友清單 ---
    const list = document.createElement('div');
    list.className = 'fr-card fr-list';
    list.innerHTML = `<h3 class="fr-h">💛 我的好友（${profiles.length}）</h3>`;
    if (!profiles.length) {
      list.innerHTML += '<p class="fr-tip">還沒有好友——把上面的好友碼傳到小組群組吧！</p>';
    } else {
      const wk = weekKeyOf();
      for (const p of profiles.sort((a, b) => (b.weekKey === wk ? b.weekXp || 0 : 0) - (a.weekKey === wk ? a.weekXp || 0 : 0))) {
        const m = MASCOTS[p.mascot] || MASCOTS.dove;
        const wxp = p.weekKey === wk ? (p.weekXp || 0) : 0;
        const wch = p.weekKey === wk ? (p.weekCh || 0) : 0;
        const row = document.createElement('div');
        row.className = 'fr-friend-row';
        row.innerHTML = `<span class="b-mascot">${m.emoji}</span>
          <span class="fr-name">${escapeHtml(p.nick || '無名小卒')}</span>
          <span class="fr-week">${wxp ? `本週 ⭐${wxp}・📖${wch}章${wch >= QUEST_CH ? '✅' : ''}` : '本週還沒玩'}</span>
          <button class="fr-x" title="移除好友">✕</button>`;
        row.querySelector('.fr-x').onclick = () => {
          if (!confirm(`要把 ${p.nick || '這位好友'} 從好友清單移除嗎？`)) return;
          state.friends = state.friends.filter((u) => u !== p.uid);
          store.save(state);
          renderFriends();
        };
        list.appendChild(row);
      }
    }
    body.appendChild(list);
    // --- ✨ 本週推薦好友 ---
    const reco = await pickRecommend(req);
    if (reco) {
      const rm = MASCOTS[reco.mascot] || MASCOTS.dove;
      const wxp = reco.weekKey === weekKeyOf() ? (reco.weekXp || 0) : 0;
      const rc = document.createElement('div');
      rc.className = 'fr-card fr-reco';
      rc.innerHTML = `<h3 class="fr-h">✨ 本週推薦好友</h3>
        <div class="fr-friend-row"><span class="b-mascot">${rm.emoji}</span>
          <span class="fr-name">${escapeHtml(reco.nick || '無名小卒')}</span>
          <span class="fr-week">${wxp ? `本週 ⭐${wxp}` : `累積 ⭐${reco.xp || 0}`}</span>
          <button class="fr-ok" id="btn-reco-add">加好友</button></div>
        <p class="fr-tip">每週一系統換一位推薦——認識新同伴，一起讀經更有勁！</p>`;
      body.appendChild(rc);
      rc.querySelector('#btn-reco-add').onclick = async () => {
        const b = rc.querySelector('#btn-reco-add');
        b.disabled = true; b.textContent = '送出中…';
        try {
          await CloudSync.sendFriendRequest(reco.uid, state.nickname || (currentUser && currentUser.name) || '', reco.nick || '');
          alert(`已送出邀請給「${reco.nick || '對方'}」，等對方同意就成為好友！`);
        } catch (e) { console.warn('推薦加好友失敗', e); alert('網路不穩，請再試一次。'); }
        renderFriends();
      };
    }
    // 版面順序（Burger 指定好友清單放最上）：清單 → 收到的邀請 → 加成狀態 → 隨機夥伴 → 等待中 → 推薦 → 加好友
    for (const sel of ['.fr-list', '.fr-inc', '.fr-bonus', '.fr-match', '.fr-out', '.fr-reco', '.fr-addcard']) {
      const n = body.querySelector(sel);
      if (n) body.appendChild(n); // appendChild 會把既有節點搬到最後，事件不會掉
    }
  }
  // ✨ 每週推薦好友：從排行榜活躍玩家挑一位（排除自己/好友/已互發邀請者）
  // 種子＝週次＋我的 uid → 整週固定同一位、下週自動換、每人看到的都不同
  async function pickRecommend(req) {
    const wk = weekKeyOf();
    let pool = [];
    try {
      const [wkRows, totRows] = await Promise.all([CloudSync.fetchBoard('week', wk), CloudSync.fetchBoard('total')]);
      const seen = {};
      for (const r of [...wkRows, ...totRows]) { if (r.uid && !seen[r.uid]) { seen[r.uid] = true; pool.push(r); } }
    } catch (e) { console.warn('推薦好友載入失敗', e); return null; }
    const excl = new Set([CloudSync.uid(), ...(state.friends || []), ...req.outgoing.map((r) => r.to), ...req.incoming.map((r) => r.from)]);
    pool = pool.filter((p) => !excl.has(p.uid));
    if (!pool.length) return null;
    const h = (s) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 131 + s.charCodeAt(i)) >>> 0; return x; };
    const me = CloudSync.uid();
    pool.sort((a, b) => h(wk + '|' + me + '|' + a.uid) - h(wk + '|' + me + '|' + b.uid));
    return pool[0];
  }
  async function addFriendFlow() {
    const input = $('#fr-add-input');
    const v = input.value.trim();
    if (!v) return;
    const btn = $('#btn-fr-add');
    btn.disabled = true; btn.textContent = '搜尋中…';
    try {
      const target = /^t-/i.test(v) ? await CloudSync.findByCode(v) : await CloudSync.findByNick(v);
      if (!target) { alert('找不到這個人，確認好友碼或暱稱有沒有打錯（對方要至少玩過一關才找得到）。'); return; }
      if (target.uid === CloudSync.uid()) { alert('這是你自己的代碼啦 😄'); return; }
      if (state.friends.includes(target.uid)) { alert(`${target.nick} 已經是你的好友了！`); return; }
      await CloudSync.sendFriendRequest(target.uid, state.nickname || (currentUser && currentUser.name) || '', target.nick);
      input.value = '';
      alert(`已送出邀請給「${target.nick}」，等對方同意就成為好友！`);
      renderFriends();
    } catch (e) {
      console.warn('加好友失敗', e);
      alert('網路不穩或服務忙碌，請再試一次。');
    } finally {
      btn.disabled = false; btn.textContent = '加好友';
    }
  }
  $('#btn-friends').onclick = () => { show('#screen-friends'); renderFriends(); };
  $('#btn-friends-top').onclick = () => { show('#screen-friends'); renderFriends(); }; // 頂列 👥 也能進好友頁
  $('#btn-back-friends').onclick = () => { syncFriendInbox(); renderBooks(); show('#screen-books'); };

  // ===== 回報題目 =====
  $('#btn-report').onclick = async () => {
    if (!CloudSync.isLoggedIn()) { alert('先登入才能回報題目喔！'); return; }
    const q = lesson && lesson.qs[lesson.i];
    if (!q) return;
    const note = prompt('這題哪裡怪怪的？（可留空直接送出）', '');
    if (note === null) return;
    const btn = $('#btn-report');
    btn.disabled = true;
    btn.textContent = '回報中…';
    try {
      await CloudSync.sendReport({
        book: (lesson.isReview ? (lesson.reviewItems[lesson.i] || {}).book : currentBook && currentBook.id) || '',
        chapter: lesson.chapterNum,
        type: q.type,
        ref: q.ref || '',
        question: (q.q || q.display || q.head || q.statement || q.text || (q.pieces || []).join('／') || '').slice(0, 200),
        answer: (Array.isArray(q.answer) ? q.answer.join('') : (q.answer || '')).slice(0, 200),
        note: note.trim().slice(0, 300),
      });
      btn.textContent = '✅ 已回報，謝謝你！';
    } catch (e) {
      console.warn('回報失敗', e);
      btn.textContent = '🚩 回報失敗，稍後再試';
      btn.disabled = false;
    }
  };

  // 測試用鉤子（自動化驗證流程時讀取關卡狀態）
  // 只在本機開發環境掛載，避免正式站被使用者從 console 一鍵讀寫遊戲狀態（防作弊 Tier 1.5）
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    window.__bd = { get lesson() { return lesson; }, get state() { return state; }, get sprint() { return sprint; }, get flip() { return flip; }, get mg() { return mg; }, get action() { return action; }, get rankReward() { return rankReward; }, get milestone() { return milestone; }, get MILESTONE_GAMES() { return MILESTONE_GAMES; }, startMilestone, mergeStates, renderBoard, renderQuestion, renderCustomPanel, refreshRankReward, applyRewardLocks, similarity };
  }

  // ===== 啟動 =====
  (async function init() {
    applyScene();
    renderCustomPanel(); // 打扮面板首頁預設展開，先把場景/夥伴選項渲染出來
    renderMute();
    $('#home-mascot').onclick = toggleCustomPanel;
    try { await loadIndex(); }
    catch (e) { // 網路不穩時給白話提示＋重試鈕，不要留白畫面
      console.warn('載入書卷目錄失敗', e);
      $('#book-grid').innerHTML = `
        <div class="net-error">
          <div class="ne-emoji">📡</div>
          <p>網路好像不太穩，書卷目錄載入失敗了。</p>
          <button class="big-btn" id="btn-retry-load">重新載入</button>
        </div>`;
      $('#btn-retry-load').onclick = () => location.reload();
      renderTopbar();
      return;
    }
    refreshHearts(); // 冷啟動先補回離線期間該回的愛心
    ensureWeek(); // 跨週先保存上週分數（供排名獎勵判定）
    refreshRankReward(); // 未登入＝rank 0，會把鎖住的夥伴/場景退回預設
    renderTopbar();
    renderBooks();
    // 每秒：回復到期的愛心＋更新「下一顆」倒數（回滿前才會真的存檔，不會每秒寫入）
    setInterval(() => { refreshHearts(); updateHeartUi(); }, 1000);
  })();
})();
