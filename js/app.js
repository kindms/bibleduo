// 天行者 — 主程式（畫面切換、遊戲流程、進度/經驗值/連續天數）
(function () {
  const $ = (sel) => document.querySelector(sel);
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const OT_COUNT = 39;
  const MAX_HEARTS = 5; // 每關愛心數（答錯扣一顆，用完可讀經回血）
  const heartStr = (h) => '❤️'.repeat(h) + '🖤'.repeat(MAX_HEARTS - h);
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
  };
  const MASCOTS = {
    dove: { name: '小鴿子', emoji: '🕊️', verse: '「鴿子嘴裏叼着一個新擰下來的橄欖葉子」— 創世記 8:11' },
    fish: { name: '小魚', emoji: '🐟', verse: '「我們這裏只有五個餅、兩條魚」— 馬太福音 14:17' },
    hippo: { name: '小河馬', emoji: '🦛', verse: '「你且觀看河馬…牠的氣力在腰間」— 約伯記 40:15-16' },
    ant: { name: '小螞蟻', emoji: '🐜', verse: '「懶惰人哪，你去察看螞蟻的動作就可得智慧」— 箴言 6:6' },
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
  let state = Object.assign({ xp: 0, streak: 0, lastPlay: '', done: {}, scene: 'meadow', mascot: 'dove', nickname: '', weekXp: 0, weekKey: '', muted: false, review: [], puzzles: { beatitudes: [] } }, store.load());
  if (!state.puzzles) state.puzzles = { beatitudes: [] }; // 舊存檔補欄位
  if (!state.stats) state.stats = {}; // 各種計數器（衝刺最高分、翻牌次數、複習次數、朗讀成功數…），徽章用
  if (!state.minigames) state.minigames = {}; // 書卷故事小遊戲通關紀錄 { gameId: true }
  // review: 錯題間隔複習佇列 [{key, q, book, due, stage}]；答錯隔天到期，答對依 1→3→7 天延後，對滿三次畢業移除
  // done: { MRK: [1,2,3] } 已完成章

  const mascot = () => MASCOTS[state.mascot] || MASCOTS.dove;

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
    document.querySelector('#home-mascot').textContent = mascot().emoji;
  }

  // ===== 打扮面板 =====
  function renderCustomPanel() {
    const sceneRow = document.querySelector('#scene-row');
    sceneRow.innerHTML = '';
    for (const [key, sc] of Object.entries(SCENES)) {
      const chip = document.createElement('button');
      chip.className = 'pick-chip' + (state.scene === key ? ' active' : '');
      chip.innerHTML = `<span class="p-emoji">${sc.emoji}</span><span class="p-name">${sc.name}</span>`;
      chip.onclick = () => { state.scene = key; store.save(state); applyScene(); renderCustomPanel(); };
      sceneRow.appendChild(chip);
    }
    const mascotRow = document.querySelector('#mascot-row');
    mascotRow.innerHTML = '';
    for (const [key, m] of Object.entries(MASCOTS)) {
      const chip = document.createElement('button');
      chip.className = 'pick-chip' + (state.mascot === key ? ' active' : '');
      chip.innerHTML = `<span class="p-emoji">${m.emoji}</span><span class="p-name">${m.name}</span>`;
      chip.onclick = () => { state.mascot = key; store.save(state); applyScene(); renderCustomPanel(); };
      mascotRow.appendChild(chip);
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
  function ensureWeek() { // 跨週時歸零本週經驗值（Step 6 排行榜用）
    const wk = weekKeyOf();
    if (state.weekKey !== wk) { state.weekKey = wk; state.weekXp = 0; }
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
    $('#stat-hearts b').textContent = lesson ? lesson.hearts : MAX_HEARTS;
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
    // 書卷專屬玩法：八福拼圖放馬太、約拿冒險放約拿書、故事小遊戲放對應書卷，顯示在章節頁頂端
    const slot = $('#book-feature-slot');
    slot.innerHTML = '';
    for (const node of bookFeatures(id)) slot.appendChild(node);
    const path = $('#chapter-path');
    path.innerHTML = '';
    const done = state.done[id] || [];
    const maxUnlocked = done.length ? Math.max(...done) + 1 : 1;
    for (let c = 1; c <= currentBook.chapters.length; c++) {
      const node = document.createElement('button');
      const isDone = done.includes(c);
      const locked = c > maxUnlocked;
      node.className = 'chapter-node' + (isDone ? ' done' : locked ? ' locked' : c === maxUnlocked ? ' next' : '');
      node.innerHTML = `<div>${isDone ? '⭐' : locked ? '🔒' : c}</div><div class="n-label">第 ${c} 章</div>`;
      if (!locked) node.onclick = () => startLesson(c);
      path.appendChild(node);
    }
    show('#screen-chapters');
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
      btn.onclick = () => startMinigame(gid);
      nodes.push(btn);
    }
    return nodes;
  }
  $('#btn-back-books').onclick = () => { renderBooks(); show('#screen-books'); };
  $('#btn-home').onclick = () => {
    stopSprintTimer(); sprint = null; flip = null; mg = null; noah = null; // 從小遊戲直接回家要停計時器/清狀態
    lesson = null; renderTopbar(); renderBooks(); show('#screen-books');
  };

  // ===== 畫面 3：關卡 =====
  let lesson = null;
  async function startLesson(chapterNum) {
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
    lesson = { chapterNum, qs, i: 0, hearts: MAX_HEARTS, wrong: 0, xp: 0, wrongQs: [], inRetest: false, awarded: false };
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
    $('#lesson-hearts').textContent = heartStr(lesson.hearts);
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
      <div class="q-passage">${escapeHtml(q.text)}</div>
      <div class="read-box" id="read-box"></div>`;
    $('#lesson-bottom').classList.add('hidden'); // 自動判分，不用確定鈕
    currentAnswerGetter = () => null;
    const box = $('#read-box');

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
        if (best >= 0.65) {
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
      } else if (!lesson.inRetest && !lesson.isPuzzle && q.type !== 'read') { // 正式輪答錯：扣愛心、記下錯題供之後複習（朗讀操練、拼圖除外）
        lesson.hearts--;
        lesson.wrong++;
        lesson.wrongQs.push(q);
        renderTopbar();
        $('#lesson-hearts').textContent = heartStr(lesson.hearts);
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
    if (lesson.hearts <= 0) { offerRevive(); return; } // 愛心用完：先給讀經回血的機會
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

  // ===== 讀經回血：愛心用完時讀完本章 +1 愛心，繼續闖關 =====
  function offerRevive() {
    const verses = currentBook.chapters[lesson.chapterNum - 1] || [];
    const box = $('#revive-passage');
    box.innerHTML = `<h4>${escapeHtml(currentBook.name)} 第 ${lesson.chapterNum} 章</h4>` +
      verses.map((v, i) => `<p class="rv-verse"><b>${i + 1}</b> ${escapeHtml(v)}</p>`).join('');
    const readBtn = $('#btn-revive-read');
    readBtn.disabled = true;
    // 捲到底（或內容短到不需捲動）就解鎖按鈕，確保真的讀過
    const check = () => {
      if (box.scrollTop + box.clientHeight >= box.scrollHeight - 8) readBtn.disabled = false;
    };
    box.onscroll = check;
    $('#revive-overlay').classList.remove('hidden');
    box.scrollTop = 0; // 顯示後才重設，避免同章重複回血時保留舊捲動位置卡在底部
    setTimeout(check, 1500); // 短章不需捲動時自動解鎖
  }
  $('#btn-revive-read').onclick = () => {
    $('#revive-overlay').classList.add('hidden');
    lesson.hearts = Math.min(MAX_HEARTS, lesson.hearts + 1);
    renderTopbar();
    advanceLesson();
  };
  $('#btn-revive-quit').onclick = () => {
    $('#revive-overlay').classList.add('hidden');
    failLesson();
  };

  // ===== 結算 =====
  // 過關記帳（只做一次）：發經驗值、記完成章、更新連續天數。與結算畫面分開，
  // 這樣進錯題複習前就能先保存成績，複習中途離開也不會白打。
  function awardWin() {
    if (lesson.awarded) return;
    lesson.awarded = true;
    lesson.perfect = lesson.wrong === 0;
    const bonus = lesson.perfect ? 20 : 0;
    lesson.gained = lesson.xp + bonus;
    state.xp += lesson.gained;
    ensureWeek();
    state.weekXp += lesson.gained;
    bumpStreak();
    const done = state.done[currentBook.id] || (state.done[currentBook.id] = []);
    if (!done.includes(lesson.chapterNum)) done.push(lesson.chapterNum);
    queueReview(); // 答錯的題排進間隔複習佇列
    store.save(state);
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
    const gained = first ? 30 : 5;
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

  // ===== 📖 書卷故事小遊戲（對決引擎：答對推進我方、答錯讓威脅逼近，先滿者定勝負）=====
  // 加一款遊戲＝在這裡加一份設定，章節頁入口與雲端同步都會自動長出來
  const MINIGAMES = {
    david: {
      book: '1SA', ch: 17, emoji: '🗿', title: '大衛擊殺歌利亞', tag: '撒上 17・答題對決',
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
      book: 'DAN', ch: 3, emoji: '🔥', title: '火窯三友', tag: '但 3・答題對決',
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
      book: 'EXO', ch: 14, emoji: '🌊', title: '過紅海', tag: '出 14・答題對決',
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
      book: 'JOS', ch: 6, emoji: '🎺', title: '耶利哥城牆', tag: '書 6・繞城七圈',
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
      book: 'JHN', ch: 6, emoji: '🍞', title: '五餅二魚', tag: '約 6・餵飽五千',
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
    const gained = first ? 30 : 5;
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
      state.xp += 30;
      ensureWeek();
      state.weekXp += 30;
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
      ${first ? '<div class="result-stats"><div class="r-stat">＋30<span>經驗值</span></div></div>' : '<p class="board-hint">（重播章節不重複給經驗值）</p>'}
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
    const gained = (lesson.reviewCorrect || 0) * 5;
    state.xp += gained;
    ensureWeek();
    state.weekXp += gained;
    bumpStreak();
    state.stats.reviewsDone = (state.stats.reviewsDone || 0) + 1; // 徽章計數
    store.save(state);
    sndWin();
    const left = dueReviews().length;
    $('#result-box').innerHTML = `
      <div class="r-emoji">${mascot().emoji}📅</div>
      <h2>複習完成！</h2>
      <p>錯題複習過，記憶才會變長期的！</p>
      <div class="result-stats">
        <div class="r-stat">＋${gained}<span>經驗值（每對一題 +5）</span></div>
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
    $('#result-box').innerHTML = `
      <div class="r-emoji">${mascot().emoji}${lesson.perfect ? '🏆' : '🎉'}</div>
      <h2>${lesson.perfect ? '完美通關！' : '過關！'}</h2>
      <p>${currentBook.name} 第 ${lesson.chapterNum} 章</p>
      ${lesson.inRetest ? '<p class="retest-done">🔁 已完成錯題複習</p>' : ''}
      <div class="result-stats">
        <div class="r-stat">＋${lesson.gained}<span>經驗值${lesson.perfect ? '（含完美 +20）' : ''}</span></div>
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
    return {
      xp: Math.max(local.xp || 0, cloud.xp || 0),
      streak: Math.max(local.streak || 0, cloud.streak || 0),
      lastPlay: (local.lastPlay || '') > (cloud.lastPlay || '') ? local.lastPlay : (cloud.lastPlay || ''),
      done,
      scene: cloud.scene || local.scene,
      mascot: cloud.mascot || local.mascot,
      nickname: cloud.nickname || local.nickname || '', // 換裝置時保留自己取的排行榜名字
      weekKey: wk,
      weekXp: Math.max(localWeek, cloudWeek),
      review: mergeReview(local.review, cloud.review),
      puzzles: { beatitudes: [...new Set([...(local.puzzles?.beatitudes || []), ...(cloud.puzzles?.beatitudes || [])])] },
      stats: mergeStats(local.stats, cloud.stats),
      story: { JON: [...new Set([...((local.story || {}).JON || []), ...((cloud.story || {}).JON || [])])] },
      minigames: Object.assign({}, cloud.minigames, local.minigames), // 任一裝置通關就算通關
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
  });

  // ===== 排行榜 =====
  let boardMode = 'week';
  let boardReturnTo = null; // 過關跳進排行榜時記住書卷 ID，返回時回章節路徑而不是首頁
  async function renderBoard() {
    const list = $('#board-list');
    list.innerHTML = '<p class="board-hint">載入中…</p>';
    let rows = [];
    try { rows = await CloudSync.fetchBoard(boardMode, weekKeyOf()); }
    catch (e) { console.warn('排行榜載入失敗', e); list.innerHTML = '<p class="board-hint">排行榜載入失敗，請檢查網路後再試。</p>'; return; }
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
        row.innerHTML = `<span class="b-rank">${medals[i] || i + 1}</span>
          <span class="b-mascot">${m.emoji}</span>
          <span class="b-nick">${escapeHtml(r.nick || '無名小卒')}${isMe ? ' <span class="b-editme">✏️改名</span>' : ''}</span>
          <span class="b-xp">⭐ ${boardMode === 'week' ? (r.weekXp || 0) : (r.xp || 0)}</span>`;
        if (isMe) row.onclick = openNameEditor; // 點自己那一列即可改名
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
  $('#btn-name-save').onclick = () => {
    state.nickname = $('#name-input').value.trim().slice(0, 12);
    store.save(state);
    $('#name-overlay').classList.add('hidden');
    $('#board-list').innerHTML = '<p class="board-hint">名字已更新，同步中…</p>';
    setTimeout(renderBoard, 1500); // 等雲端寫入完成再刷新
  };
  $('#name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-name-save').click(); });

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
  window.__bd = { get lesson() { return lesson; }, get state() { return state; }, get sprint() { return sprint; }, get flip() { return flip; }, get mg() { return mg; }, mergeStates, renderBoard, renderQuestion, similarity };

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
    renderTopbar();
    renderBooks();
  })();
})();
