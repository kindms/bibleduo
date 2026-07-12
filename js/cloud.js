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
        nickname: state.nickname || "", weekXp: state.weekXp || 0, weekKey: state.weekKey || "",
        review: state.review || [],
        puzzles: state.puzzles || { beatitudes: [] },
        stats: state.stats || {},
        story: state.story || {},
        minigames: state.minigames || {},
        name: user.displayName || "",
        updatedAt: ts,
      }, { merge: true }).catch((e) => console.warn("寫入雲端失敗（本機已保存）", e));
      db.collection(BOARD).doc(user.uid).set({
        nick: state.nickname || user.displayName || "無名小卒",
        mascot: state.mascot || "dove",
        xp: state.xp || 0,
        weekXp: state.weekXp || 0,
        weekKey: state.weekKey || "",
        streak: state.streak || 0,
        updatedAt: ts,
      }).catch((e) => console.warn("寫入排行榜失敗", e));
    }, 800);
  }

  // 讀排行榜：mode = "week"（本週）或 "total"（總榜）
  async function fetchBoard(mode, weekKey) {
    if (!db) return [];
    if (mode === "total") {
      const qs = await db.collection(BOARD).orderBy("xp", "desc").limit(20).get();
      return qs.docs.map((d) => ({ uid: d.id, ...d.data() }));
    }
    // 本週榜：抓本週有分數的人，前端排序（教會規模的量級綽綽有餘）
    const qs = await db.collection(BOARD).where("weekKey", "==", weekKey).get();
    return qs.docs.map((d) => ({ uid: d.id, ...d.data() }))
      .filter((r) => (r.weekXp || 0) > 0)
      .sort((a, b) => (b.weekXp || 0) - (a.weekXp || 0))
      .slice(0, 20);
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

  return { init, login, logout, save, fetchBoard, sendReport, isLoggedIn: () => !!user, uid: () => (user ? user.uid : null) };
})();
