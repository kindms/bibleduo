// ============================================================
// 雲端同步：Google 登入 + Firestore 進度
// 與 QuizLive 共用同一個 Firebase 專案（quizlive-d8e26），
// 但資料存在獨立的 bibleduo_users 集合，互不干擾。
// 沒登入或斷線時，遊戲照常運作（進度存本機）。
// ============================================================
const CloudSync = (function () {
  const CONFIG = {
    apiKey: "AIzaSyAlyudP_neS2YQZVdaV1xvXSku_AtRXu9E",
    authDomain: "quizlive-d8e26.firebaseapp.com",
    projectId: "quizlive-d8e26",
  };
  const COLLECTION = "bibleduo_users";

  let auth = null, db = null, user = null;

  function available() { return typeof firebase !== "undefined" && firebase.initializeApp; }

  // cb(userInfo|null, cloudState|null)：登入狀態改變時通知主程式
  function init(cb) {
    if (!available()) { cb(null, null); return; }
    firebase.initializeApp(CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    auth.onAuthStateChanged(async (u) => {
      user = u;
      if (!u) { cb(null, null); return; }
      let cloud = null;
      try {
        const snap = await db.collection(COLLECTION).doc(u.uid).get();
        cloud = snap.exists ? snap.data() : null;
      } catch (e) { console.warn("讀取雲端進度失敗（先用本機進度）", e); }
      cb({ uid: u.uid, name: u.displayName || "", photo: u.photoURL || "" }, cloud);
    });
  }

  function login() {
    if (!auth) { alert("雲端服務尚未載入，請檢查網路後重新整理。"); return; }
    auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
      .catch((e) => { if (e.code !== "auth/popup-closed-by-user") alert("登入失敗：" + e.message); });
  }
  function logout() { if (auth) auth.signOut(); }

  // 存雲端（0.8 秒防抖，避免連續寫入）：個人進度＋排行榜分數一起更新
  const BOARD = "bibleduo_board";
  let timer = null;
  function save(state) {
    if (!user || !db) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const ts = firebase.firestore.FieldValue.serverTimestamp();
      db.collection(COLLECTION).doc(user.uid).set({
        xp: state.xp, streak: state.streak, lastPlay: state.lastPlay,
        done: state.done, scene: state.scene, mascot: state.mascot,
        nickname: state.nickname || "", weekXp: state.weekXp || 0, weekKey: state.weekKey || "", weekCh: state.weekCh || 0,
        lastWeekXp: state.lastWeekXp || 0, lastWeekKey: state.lastWeekKey || "",
        review: state.review || [],
        puzzles: state.puzzles || { beatitudes: [] },
        stats: state.stats || {},
        story: state.story || {},
        minigames: state.minigames || {},
        milestones: state.milestones || {},
        friends: state.friends || [],
        name: user.displayName || "",
        updatedAt: ts,
      }, { merge: true }).catch((e) => console.warn("寫入雲端失敗（本機已保存）", e));
      db.collection(BOARD).doc(user.uid).set({
        nick: state.nickname || user.displayName || "無名小卒",
        mascot: state.mascot || "dove",
        xp: state.xp || 0,
        weekXp: state.weekXp || 0,
        weekKey: state.weekKey || "",
        weekCh: state.weekCh || 0,
        lwXp: state.lastWeekXp || 0, lwKey: state.lastWeekKey || "", // 上週分數（前三名獎勵判定）
        streak: state.streak || 0,
        friendCode: codeOf(user.uid),
        friends: state.friends || [],
        updatedAt: ts,
      }).catch((e) => console.warn("寫入排行榜失敗", e));
    }, 800);
  }

  // 讀排行榜：mode = "week"（本週）或 "total"（總榜）
  async function fetchBoard(mode, weekKey) {
    if (!db) return [];
    if (mode === "total") {
      const qs = await withTimeout(db.collection(BOARD).orderBy("xp", "desc").limit(20).get());
      return qs.docs.map((d) => ({ uid: d.id, ...d.data() }));
    }
    // 本週榜：抓本週有分數的人，前端排序（教會規模的量級綽綽有餘）
    const qs = await withTimeout(db.collection(BOARD).where("weekKey", "==", weekKey).get());
    return qs.docs.map((d) => ({ uid: d.id, ...d.data() }))
      .filter((r) => (r.weekXp || 0) > 0)
      .sort((a, b) => (b.weekXp || 0) - (a.weekXp || 0))
      .slice(0, 20);
  }

  // 上週排行榜（前三名獎勵解鎖用）：合併「還沒開始本週的人（weekKey 仍是上週）」
  // 與「已跨週、把上週分數存進 lwXp 的人」，前端算名次。教會規模量級綽綽有餘。
  async function fetchLastWeekTop(lastWeekKey) {
    if (!db) return [];
    const [q1, q2] = await withTimeout(Promise.all([
      db.collection(BOARD).where("weekKey", "==", lastWeekKey).get(),
      db.collection(BOARD).where("lwKey", "==", lastWeekKey).get(),
    ]));
    const rows = [];
    q1.forEach((d) => { const x = d.data(); if ((x.weekXp || 0) > 0) rows.push({ uid: d.id, nick: x.nick, score: x.weekXp }); });
    q2.forEach((d) => { const x = d.data(); if ((x.lwXp || 0) > 0) rows.push({ uid: d.id, nick: x.nick, score: x.lwXp }); });
    // 同一人不會同時落在兩個查詢（weekKey 與 lwKey 不會都等於上週），但保險去重取較高分
    const best = {};
    for (const r of rows) if (!best[r.uid] || r.score > best[r.uid].score) best[r.uid] = r;
    return Object.values(best).sort((a, b) => b.score - a.score);
  }

  // 回報題目問題（登入者限定；Burger 從 Firebase 後台看 bibleduo_reports）
  async function sendReport(data) {
    if (!user || !db) throw new Error("not-logged-in");
    await db.collection("bibleduo_reports").add({
      ...data,
      by: user.displayName || "",
      uid: user.uid,
      at: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  // ===== 好友系統（Phase 1）=====
  // 好友碼：從 uid 決定性產生（同一帳號永遠同一組），存進排行榜文件供反查
  const REQUESTS = "bibleduo_requests";
  const NICKNAMES = "bibleduo_nicknames";
  // 雲端呼叫一律加逾時：網路不穩時 Firestore 可能懸著不回應，沒有上限就會「永遠轉圈圈」
  const withTimeout = (p, ms = 10000) =>
    Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("cloud-timeout")), ms))]);
  function codeOf(uid) {
    let h = 0;
    for (let i = 0; i < uid.length; i++) h = (h * 131 + uid.charCodeAt(i)) >>> 0;
    const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 去掉 0/O/1/I/L 避免唸錯
    let s = "";
    for (let i = 0; i < 6; i++) { s += chars[h % chars.length]; h = Math.floor(h / chars.length) ^ (h << 5) >>> 0; }
    return "T-" + s;
  }
  const myFriendCode = () => (user ? codeOf(user.uid) : "");

  // 用好友碼找人（回 {uid, nick} 或 null）
  async function findByCode(code) {
    if (!db) return null;
    const qs = await withTimeout(db.collection(BOARD).where("friendCode", "==", code.trim().toUpperCase()).limit(1).get());
    if (qs.empty) return null;
    const d = qs.docs[0];
    return { uid: d.id, nick: d.data().nick || "無名小卒" };
  }
  // 用暱稱找人：先查唯一暱稱登記簿，沒有再退回排行榜暱稱欄位（老用戶還沒登記）
  async function findByNick(nick) {
    if (!db) return null;
    const reg = await withTimeout(db.collection(NICKNAMES).doc(nick.trim()).get());
    if (reg.exists) {
      const uid = reg.data().uid;
      const b = await withTimeout(db.collection(BOARD).doc(uid).get());
      return { uid, nick: b.exists ? (b.data().nick || nick) : nick };
    }
    const qs = await withTimeout(db.collection(BOARD).where("nick", "==", nick.trim()).limit(1).get());
    if (qs.empty) return null;
    const d = qs.docs[0];
    return { uid: d.id, nick: d.data().nick };
  }
  // 送出好友邀請（文件 ID 用 from_to，天然防重複邀請）；toNick 給「等待中」清單顯示對方是誰
  async function sendFriendRequest(toUid, fromNick, toNick) {
    if (!user || !db) throw new Error("not-logged-in");
    await withTimeout(db.collection(REQUESTS).doc(`${user.uid}_${toUid}`).set({
      from: user.uid, to: toUid, fromNick: fromNick || "無名小卒", toNick: toNick || "",
      status: "pending", at: firebase.firestore.FieldValue.serverTimestamp(),
    }));
  }
  // 抓跟我有關的邀請：收到的待處理、我送出待回應、我送出已被同意（要收尾）
  async function fetchRequests() {
    if (!user || !db) return { incoming: [], outgoing: [], accepted: [] };
    const [inc, outP, outA] = await withTimeout(Promise.all([
      db.collection(REQUESTS).where("to", "==", user.uid).where("status", "==", "pending").get(),
      db.collection(REQUESTS).where("from", "==", user.uid).where("status", "==", "pending").get(),
      db.collection(REQUESTS).where("from", "==", user.uid).where("status", "==", "accepted").get(),
    ]));
    const rows = (qs) => qs.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { incoming: rows(inc), outgoing: rows(outP), accepted: rows(outA) };
  }
  async function answerRequest(id, accept) {
    if (!user || !db) throw new Error("not-logged-in");
    await withTimeout(db.collection(REQUESTS).doc(id).update({ status: accept ? "accepted" : "declined" }));
  }
  async function removeRequest(id) {
    if (!user || !db) return;
    await db.collection(REQUESTS).doc(id).delete().catch(() => {});
  }
  // 抓一批好友的排行榜資料（顯示本週進度用）
  async function fetchProfiles(uids) {
    if (!db || !uids.length) return [];
    const snaps = await withTimeout(Promise.all(uids.map((u) => db.collection(BOARD).doc(u).get())));
    return snaps.filter((s) => s.exists).map((s) => ({ uid: s.id, ...s.data() }));
  }
  // ===== 每週隨機夥伴（Phase 3）=====
  // 報名池 bibleduo_matchpool/{週鑰}/entries/{uid}；配對用「報名順序」兩兩成對，
  // 大家各自照同樣順序算，結果一致，不需要伺服器排程
  const MATCH = "bibleduo_matchpool";
  async function joinMatch(weekKey, nick, mascot) {
    if (!user || !db) throw new Error("not-logged-in");
    await withTimeout(db.collection(MATCH).doc(weekKey).collection("entries").doc(user.uid).set({
      nick: nick || "無名小卒", mascot: mascot || "dove",
      at: firebase.firestore.FieldValue.serverTimestamp(),
    }));
  }
  async function leaveMatch(weekKey) {
    if (!user || !db) return;
    await withTimeout(db.collection(MATCH).doc(weekKey).collection("entries").doc(user.uid).delete()).catch(() => {});
  }
  async function fetchMatchEntries(weekKey) {
    if (!db) return [];
    const qs = await withTimeout(db.collection(MATCH).doc(weekKey).collection("entries").orderBy("at", "asc").get());
    return qs.docs.map((d) => ({ uid: d.id, ...d.data() }));
  }

  // 暱稱唯一登記：成功回 true；被別人用了回 false
  async function claimNickname(nick, oldNick) {
    if (!user || !db) throw new Error("not-logged-in");
    const ref = db.collection(NICKNAMES).doc(nick);
    const snap = await withTimeout(ref.get());
    if (snap.exists && snap.data().uid !== user.uid) return false;
    if (!snap.exists) {
      try { await withTimeout(ref.set({ uid: user.uid })); }
      catch (e) {
        // 兩人「同時」搶同一個暱稱：後到的寫入會被安全規則擋下（permission-denied）
        // → 友善地視為「被別人用了」回 false，不拋錯、不讓畫面卡住（使用者回報的轉圈圈來源之一）
        if (e && (e.code === "permission-denied" || /permission/i.test(String(e)))) return false;
        throw e;
      }
    }
    if (oldNick && oldNick !== nick) {
      db.collection(NICKNAMES).doc(oldNick).delete().catch(() => {}); // 清舊名改背景執行：不等它，改名不會被這步卡住
    }
    return true;
  }

  return {
    init, login, logout, save, fetchBoard, fetchLastWeekTop, sendReport,
    myFriendCode, findByCode, findByNick, sendFriendRequest, fetchRequests, answerRequest, removeRequest, fetchProfiles, claimNickname,
    joinMatch, leaveMatch, fetchMatchEntries,
    isLoggedIn: () => !!user, uid: () => (user ? user.uid : null),
  };
})();
