/* ============================================================
   0からのホームページ作成研修 共通JavaScript
   この教材で使っている「進捗管理」「クイズ」「ライブエディタ」は
   すべてこのファイルの素のJavaScript(ライブラリなし)で動いています。
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

const STORAGE_KEY = "webTrainingProgress";

// ---- 進捗の読み書き(localStorage:ブラウザにデータを保存する仕組み) ----

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

// ---- サイドバー:現在の章のハイライトと完了マーク ----

function setupSidebar() {
  const links = document.querySelectorAll(".sidebar ol a");
  const progress = loadProgress();
  const currentFile = location.pathname.split("/").pop();

  links.forEach(function (link) {
    const file = link.getAttribute("href").split("/").pop();
    if (file === currentFile) {
      link.classList.add("current");
    }
    if (progress[file]) {
      link.classList.add("done");
    }
  });
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

function setupTopPage() {
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
    label.textContent =
      "進捗:" + doneCount + " / " + CHAPTERS.length + " 章 完了(" + percent + "%)";
  }

  // 完了済みの章カードにマークを付ける
  document.querySelectorAll(".chapter-card").forEach(function (card) {
    const file = card.getAttribute("href").split("/").pop();
    if (progress[file]) {
      const mark = card.querySelector(".done-mark");
      if (mark) mark.textContent = "✔ 完了";
    }
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
  setupSidebar();
  setupDoneButton();
  setupTopPage();
  setupQuizzes();
  setupLiveEditors();
});
