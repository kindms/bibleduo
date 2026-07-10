// 天路闖關 — 主程式（畫面切換、遊戲流程、進度/經驗值/連續天數）
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
    meadow: { name: '青草地', emoji: '🌿', decor: ['🌾', '🌼', '🐑', '🦋', '🌻'] },
    galilee: { name: '加利利海', emoji: '🌊', decor: ['⛵', '🐟', '🌊', '🕊️', '🐚'] },
    desert: { name: '曠野日出', emoji: '🏜️', decor: ['🌵', '🐫', '☀️', '⛺', '🦂'] },
    night: { name: '星夜應許', emoji: '🌌', decor: ['⭐', '🌙', '✨', '☁️', '💫'] },
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
  let state = Object.assign({ xp: 0, streak: 0, lastPlay: '', done: {}, scene: 'meadow', mascot: 'dove', nickname: '', weekXp: 0, weekKey: '', muted: false }, store.load());
  // done: { MRK: [1,2,3] } 已完成章

  const mascot = () => MASCOTS[state.mascot] || MASCOTS.dove;

  // ===== 場景套用與飄浮裝飾 =====
  function applyScene() {
    const scene = SCENES[state.scene] ? state.scene : 'meadow';
    document.documentElement.dataset.scene = scene;
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
  $('#btn-back-books').onclick = () => { renderBooks(); show('#screen-books'); };
  $('#btn-home').onclick = () => { lesson = null; renderTopbar(); renderBooks(); show('#screen-books'); };

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
    // 錯題複習階段過關成績已經保存，離開不會白打；正式輪離開才會失去進度
    const msg = lesson && lesson.inRetest
      ? '過關成績已經保存了！要跳過剩下的錯題複習嗎?'
      : '確定要離開嗎？這一關的進度不會保留。';
    if (confirm(msg)) {
      lesson = null; renderTopbar(); show('#screen-chapters'); openBook(currentBook.id);
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
    if (lesson.inRetest) { // 複習輪：題目上方掛個提示徽章
      const badge = document.createElement('div');
      badge.className = 'retest-badge';
      badge.textContent = '🔁 錯題複習中 · 答錯不扣愛心';
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

  // --- 題型 2：排順序 ---
  function renderOrder(q, area) {
    area.innerHTML = `
      <div class="q-type">🧩 把經文排回正確順序</div>
      <div class="q-ref">${q.ref}</div>
      <div class="order-target" id="order-target"></div>`;
    const pool = document.createElement('div');
    pool.className = 'order-pool';
    const target = () => $('#order-target');
    const placed = [];
    for (const piece of q.pieces) {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = piece;
      chip.onclick = () => {
        if (chip.classList.contains('used')) return;
        chip.classList.add('used');
        const t = document.createElement('button');
        t.className = 'chip';
        t.textContent = piece;
        t.onclick = () => { // 從答案區移回
          t.remove();
          placed.splice(placed.indexOf(t), 1);
          chip.classList.remove('used');
          $('#btn-check').disabled = placed.length !== q.pieces.length;
        };
        target().appendChild(t);
        placed.push(t);
        $('#btn-check').disabled = placed.length !== q.pieces.length;
      };
      pool.appendChild(chip);
    }
    area.appendChild(pool);
    currentAnswerGetter = () => {
      if (placed.length !== q.pieces.length) return null;
      const ok = placed.map(t => t.textContent).join('') === q.answer.join('');
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
      if (!lesson.inRetest) lesson.xp += 10; // 複習輪不重複給經驗值
      sndGood();
    } else if (ok === 'soft') { // 配對題有配錯但完成
      fb.classList.add('good');
      $('#feedback-text').innerHTML = `<span class="fb-mascot">${mascot().emoji}</span><span>完成配對！（中途有配錯，這題不加分）</span>`;
    } else {
      fb.classList.add('bad');
      const retestNote = lesson.inRetest ? '（複習輪不扣愛心）' : '';
      $('#feedback-text').innerHTML = `<span class="fb-mascot">💭</span><span>正確答案：${escapeHtml(correctText)}${escapeHtml(retestNote)}${noteHtml}</span>`;
      sndBad();
      if (!lesson.inRetest) { // 正式輪答錯：扣愛心、記下錯題供之後複習
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
    store.save(state);
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
    $('#btn-continue').onclick = () => { lesson = null; renderTopbar(); openBook(currentBook.id); };
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
    };
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
  $('#btn-board').onclick = () => { show('#screen-board'); renderBoard(); };
  $('#btn-back-board').onclick = () => { renderBooks(); show('#screen-books'); };
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
        book: currentBook.id,
        chapter: lesson.chapterNum,
        type: q.type,
        ref: q.ref || '',
        question: (q.q || q.display || q.head || (q.pieces || []).join('／') || '').slice(0, 200),
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
  window.__bd = { get lesson() { return lesson; }, get state() { return state; }, mergeStates, renderBoard, renderQuestion };

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
