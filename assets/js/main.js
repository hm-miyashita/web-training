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

const PROGRESS_PREFIX = "webTrainingProgress";     // 進捗(受講者ごとに分ける)
const USER_KEY = "webTrainingUser";                // いま受講中の人
const LOG_KEY = "webTrainingLog";                  // 受講記録(「何月何日 名前」の配列)
const EXPORT_STATE_KEY = "webTrainingExportState"; // 自動ダウンロードの状態
const LAST_RECORD_DATE_KEY = "webTrainingLastRecordDate"; // 最後に記録した実日付
const LINES_PER_FILE = 200;                        // 1テキストあたりの行数上限

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
// 受講記録
//   ・「何月何日 名前」を1行として記録する
//   ・同じ日付+名前の行が既にあれば記録しない(重複防止)
//   ・毎日23:59(日付が変わる1分前)に、記録をテキストファイル
//     (kenshu-log-1.txt …)として自動ダウンロードする
//   ・1テキストは200行まで。超えたぶんは kenshu-log-2.txt … に分かれる
//   ・23:59にページが閉じていた場合は、次にページを開いたときに
//     未保存分をダウンロードする(取りこぼし防止)
// ============================================================

// ---- 記録の読み書き ----

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

// ---- 自動ダウンロード ----

function getExportState() {
  try {
    return JSON.parse(localStorage.getItem(EXPORT_STATE_KEY)) || { lastExportedCount: 0, lastExportDate: "" };
  } catch (e) {
    return { lastExportedCount: 0, lastExportDate: "" };
  }
}

function setExportState(state) {
  localStorage.setItem(EXPORT_STATE_KEY, JSON.stringify(state));
}

// 記録を200行ずつのテキストに分けてダウンロードする。
// fromCount(前回保存済みの行数)を渡すと、新しい行を含むファイルだけを保存する。
function downloadLogFiles(fromCount) {
  const lines = loadLog();
  if (lines.length === 0) return 0;

  const startFile = Math.floor(fromCount / LINES_PER_FILE); // 途中まで保存済みのファイルは最新版で保存し直す
  const totalFiles = Math.ceil(lines.length / LINES_PER_FILE);

  for (let f = startFile; f < totalFiles; f++) {
    const chunk = lines.slice(f * LINES_PER_FILE, (f + 1) * LINES_PER_FILE);
    const blob = new Blob([chunk.join("\n") + "\n"], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kenshu-log-" + (f + 1) + ".txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return totalFiles - startFile;
}

// 未保存の記録があればダウンロードして、保存済み状態を更新する
function autoExportIfNeeded() {
  const lines = loadLog();
  const state = getExportState();
  if (lines.length === 0 || lines.length <= state.lastExportedCount) {
    return false; // 新しい記録なし
  }
  downloadLogFiles(state.lastExportedCount);
  setExportState({ lastExportedCount: lines.length, lastExportDate: todayInputValue() });
  return true;
}

function setupAutoExport() {
  // ① 取りこぼし防止:前日以前の未保存記録があれば、いまダウンロードする
  const lastRecordDate = localStorage.getItem(LAST_RECORD_DATE_KEY);
  const state = getExportState();
  if (lastRecordDate && lastRecordDate < todayInputValue() &&
      loadLog().length > state.lastExportedCount) {
    autoExportIfNeeded();
  }

  // ② 毎日23:59(日付が変わる1分前)に自動ダウンロード
  function scheduleNext() {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0);
    if (target <= now) {
      target.setDate(target.getDate() + 1); // 今日の23:59を過ぎていたら明日の23:59
    }
    setTimeout(function () {
      autoExportIfNeeded();
      scheduleNext(); // 翌日ぶんを予約し直す
    }, target.getTime() - now.getTime());
  }
  scheduleNext();
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

  // 「開始/再開する」ボタン
  startBtn.addEventListener("click", function () {
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

    // 「何月何日 名前」の1行を記録(同じ日付+名前は重複させない)
    const line = toJpDate(dateValue) + " " + name;
    const log = loadLog();
    let recordMsg;
    if (log.indexOf(line) !== -1) {
      recordMsg = "(本日の記録は既にあるため、二重には記録していません)";
    } else {
      log.push(line);
      saveLog(log);
      localStorage.setItem(LAST_RECORD_DATE_KEY, todayInputValue());
      recordMsg = "を記録しました(テキストは毎日23:59に自動ダウンロードされます)";
    }

    // 途中再開の案内:最初の未完了の章へ誘導する
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
      "ようこそ、" + name + "さん!「" + line + "」" + recordMsg + "<br>" + resumeMsg;
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
  setupAutoExport();
  setupSidebar();
  setupDoneButton();
  refreshTopProgress();
  setupQuizzes();
  setupLiveEditors();
});
