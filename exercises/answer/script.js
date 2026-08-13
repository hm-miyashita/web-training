// 解答例:演習5(JavaScript)
// すべて「三拍子」= ①要素を取る → ②イベントを待つ → ③変える

// ---- 演習5-1:「もっと見る」開閉UI(クラス切替パターン) ----
const moreBtn = document.querySelector("#more-btn");
const morePanel = document.querySelector("#more-panel");

moreBtn.addEventListener("click", function () {
  morePanel.classList.toggle("open");

  // 開閉状態に合わせてボタンの文字も切り替える(ちょい足し)
  if (morePanel.classList.contains("open")) {
    moreBtn.textContent = "閉じる ▲";
  } else {
    moreBtn.textContent = "もっと見る ▼";
  }
});

// ---- 演習5-2:時刻に応じてあいさつを変える ----
const greeting = document.querySelector("#greeting");
const hour = new Date().getHours();

if (hour < 12) {
  greeting.textContent = "おはようございます!今日も一日がんばりましょう☀️";
} else if (hour < 18) {
  greeting.textContent = "こんにちは!ご訪問ありがとうございます🌸";
} else {
  greeting.textContent = "こんばんは!夜もコツコツ勉強中です🌙";
}

// ---- 演習5-3(応用):いいねボタン ----
const likeBtn = document.querySelector("#like-btn");
const likeCount = document.querySelector("#like-count");
let count = 0; // 再代入するので let を使う(第5章参照)

likeBtn.addEventListener("click", function () {
  count = count + 1;
  likeCount.textContent = count;
});
