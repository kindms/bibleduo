// 題目工廠：從一章經文自動生成熟讀型題目
// 題型：fill（經文填空）、order（排順序）、match（上下句配對）、next（接下句）
(function () {
  const PUNCT = /[，。；：？！、「」『』（）]/;
  const CJK = /^[一-鿿]+$/;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // 把一節經文依標點切成語塊（標點跟著前一塊）
  function splitClauses(text) {
    const parts = text.split(/(?<=[，。；：？！])/).filter(s => s.trim());
    return parts;
  }

  // 用瀏覽器內建中文斷詞，確保挖空的是「真正的詞」而不是跨詞碎片
  const STOP = new Set(['因為', '所以', '但是', '如此', '這樣', '甚麼', '什麼', '他們', '你們', '我們', '這些', '那些', '於是', '就是', '不是', '有人', '一個', '一切', '並且', '或者', '乃是', '自己', '若是', '凡事', '而且']);
  // 含虛詞／代名詞的字，出現就代表這是「他說、我在、就把、還不、我不是」這類碎片，不適合當填空答案或干擾選項
  const FUNC_CHARS = new Set([...'我你他她祂牠它們了的之其麼嗎呢吧罷就還尚且也乃並而若但卻雖這那所把將被則如此便故豈何焉矣哉']);
  // 是否為「有意義的實詞」：2~4 字、不在停用詞、且不含虛詞字
  function isContentWord(w) {
    if (w.length < 2 || w.length > 4) return false;
    if (STOP.has(w)) return false;
    for (const c of w) if (FUNC_CHARS.has(c)) return false;
    return true;
  }
  const segmenter = (typeof Intl !== 'undefined' && Intl.Segmenter)
    ? new Intl.Segmenter('zh-Hant', { granularity: 'word' })
    : null;
  function segmentWords(text) {
    if (!segmenter) return null;
    return [...segmenter.segment(text)]
      .filter(s => s.isWordLike)
      .map(s => s.segment)
      .filter(w => CJK.test(w));
  }
  function pickBlankWord(text) {
    const ws = segmentWords(text);
    if (!ws || !ws.length) return null;
    // 只挑「整節恰好出現一次」的實詞：出現兩次會讓答案留在題目裡露餡，
    // 也避免挖到別的詞內部（如挑「以色列」卻挖到「以色列人」的前三字）
    const good = ws.filter(w => isContentWord(w) && text.split(w).length === 2);
    if (!good.length) return null;
    // 偏好 2~3 字的實詞
    return pick(good);
  }

  // 收集全章可當干擾選項的詞（同長度的真正詞彙）
  function collectWords(verses, len) {
    const words = new Set();
    for (const v of verses) {
      const ws = segmentWords(v) || [];
      for (const w of ws) if (w.length === len && isContentWord(w)) words.add(w);
    }
    return [...words];
  }

  // 超短章（如詩篇 117 篇）章內湊不齊干擾選項時，用聖經常用詞補位
  const FALLBACK_WORDS = {
    2: ['恩典', '慈愛', '信心', '平安', '喜樂', '聖靈', '禱告', '讚美', '榮耀', '救恩', '智慧', '公義', '憐憫', '盼望', '誠實', '敬畏'],
    3: ['耶和華', '以色列', '受膏者', '拯救者', '守望者', '祭司長'],
  };

  // 題型 1：經文填空（四選一）
  function makeFill(book, ch, verses, vi) {
    const text = verses[vi];
    const word = pickBlankWord(text);
    if (!word) return null;
    let pool = collectWords(verses, word.length).filter(w => w !== word && !text.includes(w));
    if (pool.length < 3) {
      const extra = (FALLBACK_WORDS[word.length] || []).filter(w => w !== word && !text.includes(w) && !pool.includes(w));
      pool = pool.concat(extra);
    }
    if (pool.length < 3) return null;
    const options = shuffle([word, ...shuffle(pool).slice(0, 3)]);
    return {
      type: 'fill',
      ref: `${book.name} ${ch}:${vi + 1}`,
      display: text.replace(word, '____'),
      answer: word,
      options,
    };
  }

  // 題型 2：把經文語塊排回正確順序
  function makeOrder(book, ch, verses, vi) {
    // 含「〔或作：…〕」譯註的節切出來會很碎（甚至只剩引號），直接跳過
    if (/[〔〕]/.test(verses[vi])) return null;
    const clauses = splitClauses(verses[vi]);
    if (clauses.length < 3 || clauses.length > 7) return null;
    // 每個語塊都要有實際文字（至少 2 個中文字），排除像「」這種只有標點的碎塊
    if (clauses.some(c => (c.match(/[一-鿿]/g) || []).length < 2)) return null;
    // 全部語塊都不同才能判分
    if (new Set(clauses).size !== clauses.length) return null;
    let shuffled = shuffle(clauses);
    let guard = 0;
    while (shuffled.join('') === clauses.join('') && guard++ < 10) shuffled = shuffle(clauses);
    if (shuffled.join('') === clauses.join('')) return null;
    return {
      type: 'order',
      ref: `${book.name} ${ch}:${vi + 1}`,
      pieces: shuffled,
      answer: clauses,
    };
  }

  // 題型 3：上下句配對（4 對）
  function makeMatch(book, ch, verses, indices) {
    const pairs = [];
    for (const vi of indices) {
      const clauses = splitClauses(verses[vi]);
      if (clauses.length < 2) continue;
      const mid = Math.ceil(clauses.length / 2);
      pairs.push({ left: clauses.slice(0, mid).join(''), right: clauses.slice(mid).join(''), vi });
      if (pairs.length === 4) break;
    }
    if (pairs.length < 4) return null;
    // 左右半句都不能重複
    if (new Set(pairs.map(p => p.left)).size < 4 || new Set(pairs.map(p => p.right)).size < 4) return null;
    return {
      type: 'match',
      ref: `${book.name} ${ch} 章`,
      pairs,
    };
  }

  // 題型 4：接下句（給前半節，選正確的後半節）
  function makeNext(book, ch, verses, vi) {
    const clauses = splitClauses(verses[vi]);
    if (clauses.length < 2) return null;
    const mid = Math.ceil(clauses.length / 2);
    const head = clauses.slice(0, mid).join('');
    const tail = clauses.slice(mid).join('');
    if (tail.length < 4) return null;
    // 干擾：其他節的後半句
    const others = [];
    for (let i = 0; i < verses.length; i++) {
      if (i === vi) continue;
      const c = splitClauses(verses[i]);
      if (c.length < 2) continue;
      const t = c.slice(Math.ceil(c.length / 2)).join('');
      if (t.length >= 4 && t !== tail) others.push(t);
    }
    if (others.length < 3) return null;
    return {
      type: 'next',
      ref: `${book.name} ${ch}:${vi + 1}`,
      head,
      answer: tail,
      options: shuffle([tail, ...shuffle([...new Set(others)]).slice(0, 3)]),
    };
  }

  // 題型 5：是非題（這句經文正確嗎？一半機率把關鍵詞換成錯的）
  function makeTF(book, ch, verses, vi) {
    const text = verses[vi];
    if (text.length < 10) return null;
    const ref = `${book.name} ${ch}:${vi + 1}`;
    if (Math.random() < 0.5) {
      return { type: 'tf', ref, statement: text, answer: true, original: text };
    }
    const word = pickBlankWord(text);
    if (!word) return null;
    let pool = collectWords(verses, word.length).filter(w => w !== word && !text.includes(w));
    if (!pool.length) {
      pool = (FALLBACK_WORDS[word.length] || []).filter(w => w !== word && !text.includes(w));
    }
    if (!pool.length) return null;
    const wrong = pick(pool);
    return { type: 'tf', ref, statement: text.replace(word, wrong), answer: false, original: text };
  }

  // 題型 6：打字填空（不給選項，用鍵盤把詞打出來）
  function makeTypeFill(book, ch, verses, vi) {
    const text = verses[vi];
    const word = pickBlankWord(text);
    if (!word) return null;
    return {
      type: 'typefill',
      ref: `${book.name} ${ch}:${vi + 1}`,
      display: text.replace(word, '____'),
      answer: word,
    };
  }

  // 題型 7：開口讀經（挑 10~32 字的短節朗讀；語音辨識與比對在 app.js）
  function makeRead(book, ch, verses, vi) {
    const text = verses[vi];
    if (text.length < 10 || text.length > 32) return null;
    return { type: 'read', ref: `${book.name} ${ch}:${vi + 1}`, text };
  }

  // 產生一關的題目（預設 8 題，題型輪替；短章出不了某題型時自動換備用題型）
  function generateLesson(book, chapterNum, count = 8) {
    const verses = book.chapters[chapterNum - 1];
    const usable = verses.map((v, i) => i).filter(i => verses[i].length >= 8);
    const qs = [];
    const usedVi = new Set();
    const seen = new Set(); // 防止同一題出兩次
    const makers = ['fill', 'order', 'tf', 'next', 'match', 'typefill', 'read', 'fill'];

    function tryMake(kind) {
      if (kind === 'match') return makeMatch(book, chapterNum, verses, shuffle(usable));
      if (kind === 'read') { // 朗讀題直接從長度合適的節裡挑
        const cands = usable.filter(i => !usedVi.has(i) && verses[i].length >= 10 && verses[i].length <= 32);
        if (!cands.length) return null;
        const rvi = pick(cands);
        const rq = makeRead(book, chapterNum, verses, rvi);
        if (rq) usedVi.add(rvi);
        return rq;
      }
      const fresh = usable.filter(i => !usedVi.has(i));
      const vi = pick(fresh.length ? fresh : usable);
      if (vi === undefined) return null;
      let q = null;
      if (kind === 'fill') q = makeFill(book, chapterNum, verses, vi);
      if (kind === 'order') q = makeOrder(book, chapterNum, verses, vi);
      if (kind === 'next') q = makeNext(book, chapterNum, verses, vi);
      if (kind === 'tf') q = makeTF(book, chapterNum, verses, vi);
      if (kind === 'typefill') q = makeTypeFill(book, chapterNum, verses, vi);
      if (kind === 'read') q = makeRead(book, chapterNum, verses, vi);
      if (q) usedVi.add(vi);
      return q;
    }

    let tries = 0;
    while (qs.length < count && tries++ < 100) {
      const preferred = makers[qs.length % makers.length];
      const kinds = [preferred, ...['fill', 'order', 'next', 'match', 'tf', 'typefill', 'read'].filter(k => k !== preferred)];
      for (const kind of kinds) {
        const q = tryMake(kind);
        if (!q) continue;
        const key = q.type + '|' + q.ref + '|' + (q.answer ? (Array.isArray(q.answer) ? q.answer.join('') : q.answer) : '');
        if (seen.has(key)) continue;
        seen.add(key);
        qs.push(q);
        break;
      }
    }
    return qs;
  }

  // 針對指定經節出一題（拼圖挑戰用）：在四種題型中隨機挑一種能出的
  function generateVerseQuestion(book, chapterNum, verseIdx) {
    const verses = book.chapters[chapterNum - 1];
    for (const kind of shuffle(['fill', 'tf', 'next', 'typefill'])) {
      let q = null;
      if (kind === 'fill') q = makeFill(book, chapterNum, verses, verseIdx);
      if (kind === 'tf') q = makeTF(book, chapterNum, verses, verseIdx);
      if (kind === 'next') q = makeNext(book, chapterNum, verses, verseIdx);
      if (kind === 'typefill') q = makeTypeFill(book, chapterNum, verses, verseIdx);
      if (q) return q;
    }
    return null;
  }

  // 經文翻牌用：從一章抓 count 對「上句/下句」（長度限制讓卡片放得下）
  function generatePairs(book, chapterNum, count = 6) {
    const verses = book.chapters[chapterNum - 1];
    const pairs = [];
    const seenL = new Set(), seenR = new Set();
    for (const vi of shuffle(verses.map((v, i) => i))) {
      const clauses = splitClauses(verses[vi]);
      if (clauses.length < 2) continue;
      const mid = Math.ceil(clauses.length / 2);
      const left = clauses.slice(0, mid).join('');
      const right = clauses.slice(mid).join('');
      if (left.length < 4 || right.length < 4 || left.length > 18 || right.length > 18) continue;
      if (seenL.has(left) || seenR.has(right)) continue;
      seenL.add(left); seenR.add(right);
      pairs.push({ left, right });
      if (pairs.length === count) break;
    }
    return pairs;
  }

  // 小遊戲對決用：從指定章生成一批「點選就能答」的快答題（填空/是非/接下句）
  function generateQuickQuestions(book, chapterNum, count = 10) {
    const out = [];
    let guard = 0;
    while (out.length < count && guard++ < 8) {
      for (const q of generateLesson(book, chapterNum, 8)) {
        if (['fill', 'tf', 'next'].includes(q.type)) out.push(q);
        if (out.length >= count) break;
      }
    }
    return out;
  }

  window.QuestionFactory = { generateLesson, generateVerseQuestion, generatePairs, generateQuickQuestions };
})();
