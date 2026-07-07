// 把 open-bibles 的 USFX XML（公版和合本繁體）轉成 App 用的 JSON
// 輸出：books/<ID>.json（每卷一檔）＋ index.json（書卷目錄）
const fs = require('fs');
const path = require('path');

// 和合本標準書卷名（繁體）＋常用簡稱，依正典順序
const BOOKS = [
  ['GEN','創世記','創'],['EXO','出埃及記','出'],['LEV','利未記','利'],['NUM','民數記','民'],['DEU','申命記','申'],
  ['JOS','約書亞記','書'],['JDG','士師記','士'],['RUT','路得記','得'],['1SA','撒母耳記上','撒上'],['2SA','撒母耳記下','撒下'],
  ['1KI','列王紀上','王上'],['2KI','列王紀下','王下'],['1CH','歷代志上','代上'],['2CH','歷代志下','代下'],['EZR','以斯拉記','拉'],
  ['NEH','尼希米記','尼'],['EST','以斯帖記','斯'],['JOB','約伯記','伯'],['PSA','詩篇','詩'],['PRO','箴言','箴'],
  ['ECC','傳道書','傳'],['SNG','雅歌','歌'],['ISA','以賽亞書','賽'],['JER','耶利米書','耶'],['LAM','耶利米哀歌','哀'],
  ['EZK','以西結書','結'],['DAN','但以理書','但'],['HOS','何西阿書','何'],['JOL','約珥書','珥'],['AMO','阿摩司書','摩'],
  ['OBA','俄巴底亞書','俄'],['JON','約拿書','拿'],['MIC','彌迦書','彌'],['NAM','那鴻書','鴻'],['HAB','哈巴谷書','哈'],
  ['ZEP','西番雅書','番'],['HAG','哈該書','該'],['ZEC','撒迦利亞書','亞'],['MAL','瑪拉基書','瑪'],
  ['MAT','馬太福音','太'],['MRK','馬可福音','可'],['LUK','路加福音','路'],['JHN','約翰福音','約'],['ACT','使徒行傳','徒'],
  ['ROM','羅馬書','羅'],['1CO','哥林多前書','林前'],['2CO','哥林多後書','林後'],['GAL','加拉太書','加'],['EPH','以弗所書','弗'],
  ['PHP','腓立比書','腓'],['COL','歌羅西書','西'],['1TH','帖撒羅尼迦前書','帖前'],['2TH','帖撒羅尼迦後書','帖後'],
  ['1TI','提摩太前書','提前'],['2TI','提摩太後書','提後'],['TIT','提多書','多'],['PHM','腓利門書','門'],['HEB','希伯來書','來'],
  ['JAS','雅各書','雅'],['1PE','彼得前書','彼前'],['2PE','彼得後書','彼後'],['1JN','約翰壹書','約壹'],['2JN','約翰貳書','約貳'],
  ['3JN','約翰參書','約參'],['JUD','猶大書','猶'],['REV','啟示錄','啟'],
];
const NAME_BY_ID = Object.fromEntries(BOOKS.map(([id, name, abbr]) => [id, { name, abbr }]));
const ORDER = BOOKS.map(([id]) => id);

const xml = fs.readFileSync(path.join(__dirname, 'chi-cuv.usfx.xml'), 'utf8');

// 逐卷切割
const bookChunks = [...xml.matchAll(/<book id="([A-Z0-9]+)">([\s\S]*?)<\/book>/g)];
if (bookChunks.length !== 66) throw new Error(`書卷數不對：${bookChunks.length}（應為 66）`);

const outDir = path.join(__dirname, 'books');
fs.mkdirSync(outDir, { recursive: true });

const index = [];
let totalChapters = 0, totalVerses = 0;
const problems = [];

for (const [, id, body] of bookChunks) {
  const meta = NAME_BY_ID[id];
  if (!meta) throw new Error(`未知書卷代號：${id}`);
  // 逐章切割：<c id="N"/> 之後直到下一個 <c 或結尾
  const chapterChunks = [...body.matchAll(/<c id="(\d+)"\/>([\s\S]*?)(?=<c id=|$)/g)];
  const chapters = [];
  for (const [, cid, cbody] of chapterChunks) {
    if (Number(cid) !== chapters.length + 1) problems.push(`${id} 章號跳號：${cid}`);
    // 逐節：<v id="N"/>內文<ve/>
    const verses = [];
    for (const [, vid, text] of cbody.matchAll(/<v id="(\d+)"\/>([\s\S]*?)<ve\/>/g)) {
      if (Number(vid) !== verses.length + 1) problems.push(`${id} ${cid} 節號跳號：${vid}`);
      const clean = text.replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim();
      if (!clean) problems.push(`${id} ${cid}:${vid} 空白經文`);
      if (/[-�]/.test(clean)) problems.push(`${id} ${cid}:${vid} 疑似亂碼`);
      verses.push(clean);
    }
    chapters.push(verses);
    totalVerses += verses.length;
  }
  totalChapters += chapters.length;
  fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify({ id, name: meta.name, abbr: meta.abbr, chapters }));
  index.push({ id, name: meta.name, abbr: meta.abbr, chapters: chapters.length, verses: chapters.reduce((s, c) => s + c.length, 0) });
}

// 依正典順序輸出目錄
index.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
fs.writeFileSync(path.join(__dirname, 'index.json'), JSON.stringify({ version: '和合本（繁體，神版）', source: 'open-bibles chi-cuv.usfx.xml (Public Domain)', books: index }, null, 2));

console.log(`完成：${index.length} 卷、${totalChapters} 章、${totalVerses} 節`);
console.log(`問題數：${problems.length}`);
if (problems.length) console.log(problems.slice(0, 20).join('\n'));
