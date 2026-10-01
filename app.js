const APP_VERSION = "0.3";

const WORDS = [
  ["apple", "りんご"], ["book", "本"], ["school", "学校"], ["friend", "友達"],
  ["dog", "犬"], ["cat", "猫"], ["water", "水"], ["happy", "幸せな"],
  ["run", "走る"], ["eat", "食べる"], ["read", "読む"], ["write", "書く"],
  ["family", "家族"], ["teacher", "先生"], ["morning", "朝"], ["today", "今日"],
  ["library", "図書館"], ["beautiful", "美しい"], ["important", "重要な"], ["practice", "練習する"],
  ["study", "勉強する"], ["answer", "答え"], ["question", "質問"], ["easy", "簡単な"],
  ["difficult", "難しい"], ["small", "小さい"], ["big", "大きい"],
  ["home", "家"], ["play", "遊ぶ"], ["like", "好き"],
  ["want", "欲しい"], ["need", "必要とする"], ["help", "助ける"], ["speak", "話す"]
];

const state = {
  questions: [], index: 0, correct: 0, start: 0, locked: false
};

let audioContext = null;

const $ = id => document.getElementById(id);
const load = () => JSON.parse(localStorage.getItem("piepieEnglish") || '{"xp":0,"days":0,"games":0,"lastDate":""}');
const save = data => localStorage.setItem("piepieEnglish", JSON.stringify(data));

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function updateHome() {
  const d = load();
  $("xp").textContent = d.xp;
  $("days").textContent = d.days;
  $("games").textContent = d.games;
  $("streak").textContent = `🔥 ${d.days}日`;
}

function show(id) {
  document.querySelectorAll(".screen").forEach(x => x.classList.remove("active"));
  $(id).classList.add("active");
}

function shuffle(a) {
  return [...a].sort(() => Math.random() - 0.5);
}

function makeQuestions() {
  const unique = [...new Map(WORDS.map(x => [x[0], x])).values()];
  return shuffle(unique).slice(0, 10).map(x => ({en:x[0], ja:x[1]}));
}

function choicesFor(correctJa) {
  const uniqueJapanese = [...new Set(WORDS.map(x => x[1]))];
  const wrong = shuffle(uniqueJapanese.filter(x => x !== correctJa)).slice(0, 3);
  return shuffle([correctJa, ...wrong]);
}

function getAudioContext() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function beep(type) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  if (type === "correct") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.setValueAtTime(880, now + 0.07);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.19);
  } else if (type === "wrong") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.10, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.start(now);
    osc.stop(now + 0.17);
  } else {
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.06);
  }
}

function tapFeedback(type) {
  beep(type);
  // iOS Safariではnavigator.vibrateが使えないことが多いので、使える環境だけ静かに利用。
  if (navigator.vibrate) {
    navigator.vibrate(type === "wrong" ? [12, 20, 12] : 10);
  }
}

function startGame() {
  getAudioContext();
  state.questions = makeQuestions();
  state.index = 0; state.correct = 0; state.locked = false;
  state.start = performance.now();
  show("game");
  renderQuestion();
}

function renderQuestion() {
  const q = state.questions[state.index];
  $("progress").textContent = `${state.index+1} / ${state.questions.length}`;
  $("word").textContent = q.en;
  $("feedback").textContent = "";
  $("feedback").className = "feedback";

  const area = $("choices");
  area.innerHTML = "";
  choicesFor(q.ja).forEach(text => {
    const b = document.createElement("button");
    b.className = "choice";
    b.textContent = text;
    b.onclick = () => answer(b, text, q.ja);
    area.appendChild(b);
  });
}

function answer(button, selected, correct) {
  if (state.locked) return;
  state.locked = true;

  const ok = selected === correct;
  document.querySelectorAll(".choice").forEach(b => b.classList.add("disabled"));

  if (ok) {
    state.correct++;
    button.classList.add("correct");
    $("feedback").textContent = "✓ 正解！";
    $("feedback").className = "feedback good";
    tapFeedback("correct");
    setTimeout(next, 450);
  } else {
    button.classList.add("wrong");
    document.querySelectorAll(".choice").forEach(b => {
      if (b.textContent === correct) b.classList.add("correct");
    });
    $("feedback").textContent = `正解は「${correct}」`;
    $("feedback").className = "feedback bad";
    tapFeedback("wrong");
    setTimeout(next, 850);
  }
}

function next() {
  state.index++;
  state.locked = false;
  if (state.index >= state.questions.length) finish();
  else renderQuestion();
}

function finish() {
  const elapsed = (performance.now() - state.start) / 1000;
  const count = state.questions.length;
  const rate = Math.round(state.correct / count * 100);
  const xp = state.correct * 5;
  const d = load();
  const t = today();

  if (d.lastDate !== t) {
    d.days++;
    d.lastDate = t;
  }

  d.xp += xp;
  d.games++;
  save(d);

  $("resultCorrect").textContent = `${state.correct} / ${count}`;
  $("resultRate").textContent = `${rate}%`;
  $("resultTime").textContent = `${elapsed.toFixed(1)}秒`;
  $("resultXp").textContent = `+${xp}`;
  $("resultMessage").textContent =
    rate === 100 ? "PERFECT！ぴえぴえEnglish、絶好調。🦉" :
    rate >= 80 ? "いい感じ！今日の英語、ちゃんと積み上がりました。" :
    "まずは継続。間違えた単語は次の復習候補です。";

  updateHome();
  show("result");
}

$("startBtn").onclick = startGame;
$("againBtn").onclick = startGame;
$("homeBtn").onclick = () => { updateHome(); show("home"); };
$("quitBtn").onclick = () => { updateHome(); show("home"); };
updateHome();
