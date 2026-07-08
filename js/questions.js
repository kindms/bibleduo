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
    const good = ws.filter(isContentWord);
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

  // 產生一關的題目（預設 8 題，題型輪替；短章出不了某題型時自動換備用題型）
  function generateLesson(book, chapterNum, count = 8) {
    const verses = book.chapters[chapterNum - 1];
    const usable = verses.map((v, i) => i).filter(i => verses[i].length >= 8);
    const qs = [];
    const usedVi = new Set();
    const seen = new Set(); // 防止同一題出兩次
    const makers = ['fill', 'order', 'next', 'fill', 'match', 'order', 'next', 'fill'];

    function tryMake(kind) {
      if (kind === 'match') return makeMatch(book, chapterNum, verses, shuffle(usable));
      const fresh = usable.filter(i => !usedVi.has(i));
      const vi = pick(fresh.length ? fresh : usable);
      if (vi === undefined) return null;
      let q = null;
      if (kind === 'fill') q = makeFill(book, chapterNum, verses, vi);
      if (kind === 'order') q = makeOrder(book, chapterNum, verses, vi);
      if (kind === 'next') q = makeNext(book, chapterNum, verses, vi);
      if (q) usedVi.add(vi);
      return q;
    }

    let tries = 0;
    while (qs.length < count && tries++ < 100) {
      const preferred = makers[qs.length % makers.length];
      const kinds = [preferred, ...['fill', 'order', 'next', 'match'].filter(k => k !== preferred)];
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

  window.QuestionFactory = { generateLesson };
})();
