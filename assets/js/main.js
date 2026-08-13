/* ============================================================
   0からのホームページ作成研修 共通JavaScript
   この教材で使っている「受講記録」「進捗管理」「クイズ」
   「ライブエディタ」は、すべてこのファイルの素のJavaScript
   (ライブラリなし)で動いています。
   第5章を終えたら、ぜひこのコードも読んでみてください。
   ============================================================ */

// 全章のリスト。ファイル名と章タイトルをひとまとめに管理する
const CHAPTERS = [
  { file: "01-web-basics.html", title: "Webの仕組み" },
  { file: "02-html.html", title: "HTML基礎" },
  { file: "03-css.html", title: "CSS基礎" },
  { file: "04-layout.html", title: "レイアウトとレスポンシブ" },
  { file: "05-javascript.html", title: "JavaScript基礎" },
  { file: "06-practice.html", title: "総合演習" },
  { file: "07-publish.html", title: "GitHubで公開" },
  { file: "08-trends.html", title: "最新トレンド" },
];

const PROGRESS_PREFIX = "webTrainingProgress"; // 進捗(受講者ごとに分ける)
const USER_KEY = "webTrainingUser";            // いま受講中の人
const LOG_KEY = "webTrainingLog";              // 受講記録のブラウザ内ミラー
const LINES_PER_FILE = 500;                    // 1テキストあたりの行数上限

// ---- 受講者の読み書き ----

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch (e) {
    return null;
  }
}

function setUser(user) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

// ---- 進捗の読み書き(名前が登録されていれば、その人専用のキーで保存)----

function progressKey() {
  const user = getUser();
  if (user && user.name) {
    return PROGRESS_PREFIX + ":" + user.name;
  }
  return PROGRESS_PREFIX; // 名前未記入の匿名モード
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(progressKey())) || {};
  } catch (e) {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(progressKey(), JSON.stringify(progress));
}

// ============================================================
// 受講記録(テキストファイルへの記録)
//   ・「何月何日 名前」を1行として記録する
//   ・同じ日付+名前の行が既にあれば記録しない(重複防止)
//   ・1テキスト500行を超えたら kenshu-log-2.txt … と次のファイルへ
//   ・ファイル書き込みには File System Access API(Chrome/Edge)を
//     使用。保存先フォルダを一度指定すると、以降はそこに追記される。
//   ・未設定・非対応時はブラウザ内(localStorage)に記録し、
//     同じ形式のテキストをダウンロードで取り出せる。
// ============================================================

// ---- ブラウザ内ミラーの読み書き ----

function loadLog() {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveLog(lines) {
  localStorage.setItem(LOG_KEY, JSON.stringify(lines));
}

// ---- 保存先フォルダのハンドルを覚えておく(IndexedDB)----

function idbOpen() {
  return new Promise(function (resolve, reject) {
    const req = indexedDB.open("webTrainingDB", 1);
    req.onupgradeneeded = function () {
      req.result.createObjectStore("handles");
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}

async function idbGet(key) {
  const db = await idbOpen();
  return new Promise(function (resolve, reject) {
    const rq = db.transaction("handles").objectStore("handles").get(key);
    rq.onsuccess = function () { resolve(rq.result); };
    rq.onerror = function () { reject(rq.error); };
  });
}

async function idbSet(key, val) {
  const db = await idbOpen();
  return new Promise(function (resolve, reject) {
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").put(val, key);
    tx.oncomplete = function () { resolve(); };
    tx.onerror = function () { reject(tx.error); };
  });
}

// ---- 日付ユーティリティ ----

function todayInputValue() {
  const d = new Date();
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

// "2026-08-13" → "8月13日"
function toJpDate(inputValue) {
  const p = inputValue.split("-");
  return Number(p[1]) + "月" + Number(p[2]) + "日";
}

// ---- テキストファイルへの追記(500行でロールオーバー)----

async function appendLineToFolder(line) {
  const dir = await idbGet("logDir");
  if (!dir) {
    return { saved: false, reason: "保存先フォルダが未設定" };
  }

  let perm = await dir.queryPermission({ mode: "readwrite" });
  if (perm !== "granted") {
    perm = await dir.requestPermission({ mode: "readwrite" });
  }
  if (perm !== "granted") {
    return { saved: false, reason: "フォルダへのアクセスが許可されませんでした" };
  }

  // フォルダ内の kenshu-log-N.txt をすべて集める
  const files = [];
  for await (const entry of dir.values()) {
    if (entry.kind !== "file") continue;
    const m = entry.name.match(/^kenshu-log-(\d+)\.txt$/);
    if (m) files.push({ n: Number(m[1]), handle: entry });
  }
  files.sort(function (a, b) { return a.n - b.n; });

  // 全ファイルを走査して、同じ「日付 名前」の行がないか確認(重複防止)
  let lastN = 0;
  let lastHandle = null;
  let lastText = "";
  for (const f of files) {
    const text = await (await f.handle.getFile()).text();
    const exists = text.split(/\r?\n/).some(function (l) {
      return l.trim() === line;
    });
    if (exists) {
      return { saved: true, dup: true, file: "kenshu-log-" + f.n + ".txt" };
    }
    lastN = f.n;
    lastHandle = f.handle;
    lastText = text;
  }

  // 追記先を決める:最後のファイルが500行に達していたら次の番号を新規作成
  const lastLines = lastText.split(/\r?\n/).filter(function (l) {
    return l.trim() !== "";
  });
  let targetHandle = lastHandle;
  let targetName = "kenshu-log-" + lastN + ".txt";
  let baseText = lastText;

  if (!lastHandle || lastLines.length >= LINES_PER_FILE) {
    targetName = "kenshu-log-" + (lastN + 1) + ".txt";
    targetHandle = await dir.getFileHandle(targetName, { create: true });
    baseText = "";
  }

  if (baseText && !baseText.endsWith("\n")) {
    baseText += "\n";
  }

  const writable = await targetHandle.createWritable();
  await writable.write(baseText + line + "\n");
  await writable.close();

  return { saved: true, dup: false, file: targetName };
}

// ---- トップページ:受講記録UI ----

function setupAttendance() {
  const nameInput = document.querySelector("#att-name");
  const dateInput = document.querySelector("#att-date");
  const startBtn = document.querySelector("#att-start");
  const status = document.querySelector("#att-status");
  if (!nameInput || !startBtn) return; // トップページ以外では何もしない

  // 初期値:日付は今日、名前は前回の受講者
  dateInput.value = todayInputValue();
  const user = getUser();
  if (user && user.name) {
    nameInput.value = user.name;
  }

  const fsSupported = !!window.showDirectoryPicker;
  const folderBtn = document.querySelector("#att-folder");
  const folderStatus = document.querySelector("#att-folder-status");

  // 保存先フォルダの設定状態を表示
  if (fsSupported) {
    idbGet("logDir").then(function (dir) {
      if (dir && folderStatus) {
        folderStatus.textContent = "設定済み:「" + dir.name + "」フォルダに記録します";
      }
    }).catch(function () { /* 未設定のままでOK */ });
  } else if (folderStatus) {
    folderStatus.textContent =
      "このブラウザはファイル自動書き込みに未対応のため、記録はブラウザ内に保存されます。「記録テキストをダウンロード」で取り出してください。";
    if (folderBtn) folderBtn.style.display = "none";
  }

  // 保存先フォルダを選ぶ(管理者向け・最初に一度だけ)
  if (folderBtn && fsSupported) {
    folderBtn.addEventListener("click", async function () {
      try {
        const dir = await window.showDirectoryPicker({ mode: "readwrite" });
        await idbSet("logDir", dir);
        folderStatus.textContent = "設定済み:「" + dir.name + "」フォルダに記録します";
      } catch (e) {
        /* キャンセル時は何もしない */
      }
    });
  }

  // 記録テキストのダウンロード(ブラウザ内ミラーから、500行ずつに分割)
  const dlBtn = document.querySelector("#att-download");
  if (dlBtn) {
    dlBtn.addEventListener("click", function () {
      const lines = loadLog();
      if (lines.length === 0) {
        status.textContent = "まだ記録がありません。";
        return;
      }
      for (let i = 0; i < lines.length; i += LINES_PER_FILE) {
        const chunk = lines.slice(i, i + LINES_PER_FILE);
        const blob = new Blob([chunk.join("\n") + "\n"], { type: "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "kenshu-log-" + (Math.floor(i / LINES_PER_FILE) + 1) + ".txt";
        a.click();
        URL.revokeObjectURL(a.href);
      }
    });
  }

  // 「開始/再開する」ボタン
  startBtn.addEventListener("click", async function () {
    const name = nameInput.value.trim();
    const dateValue = dateInput.value || todayInputValue();

    // 名前が未記入 → 記録せず匿名モードで学習だけ可能にする
    if (!name) {
      setUser(null);
      refreshTopProgress();
      status.className = "att-status warn";
      status.textContent =
        "名前が未記入のため、受講記録は記録されません(学習は進められますが、進捗の引き継ぎもできません)。";
      return;
    }

    // 受講者として登録 → この人専用の進捗キーに切り替わる
    setUser({ name: name });
    refreshTopProgress();

    const line = toJpDate(dateValue) + " " + name;

    // ① ブラウザ内ミラーに記録(同じ日付+名前は重複させない)
    const log = loadLog();
    const dupInMirror = log.indexOf(line) !== -1;
    if (!dupInMirror) {
      log.push(line);
      saveLog(log);
    }

    // ② テキストファイルに記録(保存先フォルダ設定済みの場合)
    let fileMsg = "";
    if (fsSupported) {
      try {
        const result = await appendLineToFolder(line);
        if (result.saved && result.dup) {
          fileMsg = "(" + result.file + " に本日の記録が既にあるため追記しませんでした)";
        } else if (result.saved) {
          fileMsg = "(" + result.file + " に記録しました)";
        } else {
          fileMsg = "(" + result.reason + "のため、ブラウザ内にのみ記録しました)";
        }
      } catch (e) {
        fileMsg = "(ファイル書き込みに失敗したため、ブラウザ内にのみ記録しました)";
      }
    } else {
      fileMsg = "(ブラウザ内に記録しました。テキストはダウンロードで取り出せます)";
    }

    // ③ 途中再開の案内:最初の未完了の章へ誘導する
    const progress = loadProgress();
    const doneCount = CHAPTERS.filter(function (c) { return progress[c.file]; }).length;
    let resumeMsg;
    if (doneCount === 0) {
      resumeMsg = "第1章から始めましょう!";
    } else if (doneCount === CHAPTERS.length) {
      resumeMsg = "全章完了しています。おめでとうございます🌸";
    } else {
      const next = CHAPTERS.find(function (c) { return !progress[c.file]; });
      const idx = CHAPTERS.indexOf(next) + 1;
      resumeMsg =
        '前回の続き、第' + idx + '章「' + next.title + '」から再開できます → ' +
        '<a href="chapters/' + next.file + '"><strong>第' + idx + '章へ</strong></a>';
    }

    status.className = "att-status ok";
    status.innerHTML =
      "ようこそ、" + name + "さん!「" + line + "」" + fileMsg + "<br>" + resumeMsg;
  });
}

// ---- サイドバー:現在の章のハイライトと完了マーク ----

function setupSidebar() {
  const links = document.querySelectorAll(".sidebar ol a");
  const progress = loadProgress();
  const currentFile = location.pathname.split("/").pop();

  links.forEach(function (link) {
    const file = link.getAttribute("href").split("/").pop();
    link.classList.toggle("current", file === currentFile);
    link.classList.toggle("done", !!progress[file]);
  });

  // 受講者名をサイドバーに表示する
  const sidebar = document.querySelector(".sidebar");
  const user = getUser();
  if (sidebar && user && user.name && !sidebar.querySelector(".sidebar-user")) {
    const p = document.createElement("p");
    p.className = "sidebar-user";
    p.textContent = "受講者:" + user.name + " さん";
    sidebar.appendChild(p);
  }
}

// ---- 章の完了ボタン ----

function setupDoneButton() {
  const btn = document.querySelector(".btn-done");
  if (!btn) return;

  const file = location.pathname.split("/").pop();

  function render() {
    const progress = loadProgress();
    if (progress[file]) {
      btn.textContent = "✔ 完了済み(クリックで取り消し)";
      btn.classList.add("is-done");
    } else {
      btn.textContent = "この章を完了にする";
      btn.classList.remove("is-done");
    }
  }

  btn.addEventListener("click", function () {
    const progress = loadProgress();
    progress[file] = !progress[file];
    saveProgress(progress);
    render();
    setupSidebar(); // サイドバーのチェックも更新
  });

  render();
}

// ---- トップページ:進捗バーと章カードの完了表示 ----

function refreshTopProgress() {
  const bar = document.querySelector(".progress-bar");
  if (!bar) return;

  const progress = loadProgress();
  const doneCount = CHAPTERS.filter(function (c) {
    return progress[c.file];
  }).length;

  const percent = Math.round((doneCount / CHAPTERS.length) * 100);
  bar.style.width = percent + "%";

  const label = document.querySelector(".progress-label");
  if (label) {
    const user = getUser();
    const who = user && user.name ? user.name + "さんの" : "";
    label.textContent =
      who + "進捗:" + doneCount + " / " + CHAPTERS.length + " 章 完了(" + percent + "%)";
  }

  // 完了済みの章カードにマークを付ける
  document.querySelectorAll(".chapter-card").forEach(function (card) {
    const file = card.getAttribute("href").split("/").pop();
    const mark = card.querySelector(".done-mark");
    if (mark) mark.textContent = progress[file] ? "✔ 完了" : "";
  });
}

// ---- クイズ:答え合わせ ----

function setupQuizzes() {
  document.querySelectorAll(".quiz").forEach(function (quiz) {
    const btn = quiz.querySelector(".quiz-check");
    const result = quiz.querySelector(".quiz-result");
    if (!btn || !result) return;

    btn.addEventListener("click", function () {
      const name = btn.dataset.name;
      const answer = btn.dataset.answer;
      const explain = btn.dataset.explain || "";
      const checked = quiz.querySelector('input[name="' + name + '"]:checked');

      if (!checked) {
        result.className = "quiz-result ng";
        result.textContent = "選択肢を選んでから答え合わせしてね!";
        return;
      }

      if (checked.value === answer) {
        result.className = "quiz-result ok";
        result.textContent = "🌸 正解!" + explain;
      } else {
        result.className = "quiz-result ng";
        result.textContent = "残念、不正解…。" + explain;
      }
    });
  });
}

// ---- ライブエディタ:書いたコードを即プレビュー ----

function setupLiveEditors() {
  document.querySelectorAll(".live-editor").forEach(function (editor) {
    const textarea = editor.querySelector("textarea");
    const iframe = editor.querySelector("iframe");
    if (!textarea || !iframe) return;

    function render() {
      // srcdoc属性にHTMLを入れると、iframe内にそのまま描画される
      iframe.srcdoc =
        '<meta charset="UTF-8"><style>body{font-family:sans-serif;padding:12px;line-height:1.8;}</style>' +
        textarea.value;
    }

    textarea.addEventListener("input", render);
    render(); // 初期表示
  });
}

// ---- ページ読み込み完了後にすべてを初期化 ----

document.addEventListener("DOMContentLoaded", function () {
  setupAttendance();
  setupSidebar();
  setupDoneButton();
  refreshTopProgress();
  setupQuizzes();
  setupLiveEditors();
});
