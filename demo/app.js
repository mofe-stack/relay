import { load, toSequence, predict } from "./relay.js";

const $ = (id) => document.getElementById(id);
const RATE = 16000;
const MAX_SECONDS = 6;

// saved holds every saved recording as { word, seq }. words keeps the order they were added in
const state = { saved: [], words: [], active: null, using: false, last: null, counts: { spoke: 0, show3: 0, silent: 0, learned: 0 } };

// ---------- recording ----------

let stream, recorder, chunks, levelTimer, stopTimer;

async function startRecording() {
  stream = stream || (await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false } }));
  chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.start();

  // a simple loudness bar so the user can see the mic is picking them up
  const ctx = new AudioContext();
  const meter = ctx.createAnalyser();
  ctx.createMediaStreamSource(stream).connect(meter);
  const buf = new Float32Array(meter.fftSize);
  levelTimer = setInterval(() => {
    meter.getFloatTimeDomainData(buf);
    const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
    $("level").style.width = `${Math.min(100, rms * 400)}%`;
  }, 60);
  recorder.onstop = () => ctx.close();
  stopTimer = setTimeout(() => toggleMic(), MAX_SECONDS * 1000);
}

// the recording is turned into 16,000 samples per second in one channel, the format whisper expects
async function stopRecording() {
  clearInterval(levelTimer);
  clearTimeout(stopTimer);
  $("level").style.width = "0%";
  const done = new Promise((r) => { recorder.addEventListener("stop", r, { once: true }); });
  recorder.stop();
  await done;
  const raw = await new Blob(chunks).arrayBuffer();
  const decoded = await new AudioContext().decodeAudioData(raw);
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * RATE), RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  return (await offline.startRendering()).getChannelData(0);
}

let recording = false, busy = false;

async function toggleMic() {
  if (busy) return;
  if (!recording) {
    if (!state.using && !state.active) return setLabel("pick or add a word first.");
    recording = true;
    $("mic").classList.add("on");
    setLabel(state.using ? "<strong>listening…</strong> press again when you're done" : `<strong>make your sound for "${state.active}"</strong> then press again`);
    await startRecording();
    return;
  }
  recording = false;
  busy = true;
  $("mic").classList.remove("on");
  $("mic").disabled = true;
  setLabel("thinking…");
  try {
    const x = await stopRecording();
    if (state.using) await useRecording(x);
    else await saveRecording(x);
  } catch (err) {
    setLabel(`something went wrong: ${err.message}`);
    console.error(err);
  }
  busy = false;
  $("mic").disabled = false;
}

// ---------- step 1: saving words ----------

async function saveRecording(x) {
  const seq = await toSequence(x);
  state.saved.push({ word: state.active, seq });
  const n = countOf(state.active);
  if (n >= 3) {
    const next = state.words.find((w) => countOf(w) < 3);
    state.active = next || null;
  }
  setLabel(n >= 3 ? `"${wordBefore(n)}" is saved.` : `saved ${n} of 3. make it again.`);
  render();
}

function wordBefore() { return state.saved[state.saved.length - 1].word; }
const countOf = (w) => state.saved.filter((s) => s.word === w).length;
const readyWords = () => state.words.filter((w) => countOf(w) >= 3);

function renderWords() {
  const list = $("words");
  list.innerHTML = "";
  for (const w of state.words) {
    const n = countOf(w);
    const li = document.createElement("li");
    li.className = w === state.active && !state.using ? "active" : "";
    li.innerHTML = `<span class="word"></span><span class="dots">${[0, 1, 2].map((i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>
      <span class="extra">${n > 3 ? `+${n - 3} learned` : ""}</span><button class="remove" type="button">remove</button>`;
    li.querySelector(".word").textContent = w;
    li.addEventListener("click", () => { state.using = false; state.active = w; setLabel(`press the mic and make your sound for "${w}".`); render(); });
    li.querySelector(".remove").addEventListener("click", (e) => {
      e.stopPropagation();
      state.words = state.words.filter((v) => v !== w);
      state.saved = state.saved.filter((s) => s.word !== w);
      if (state.active === w) state.active = null;
      render();
    });
    list.appendChild(li);
  }
}

$("add").addEventListener("submit", (e) => {
  e.preventDefault();
  const w = $("new-word").value.trim().toLowerCase();
  if (!w || state.words.includes(w)) return;
  state.words.push(w);
  state.active = w;
  state.using = false;
  $("new-word").value = "";
  setLabel(`press the mic and make your sound for "${w}".`);
  render();
});

$("use").addEventListener("click", () => {
  if (readyWords().length < 2) return setLabel("teach at least two words, three times each, first.");
  state.using = true;
  state.active = null;
  setLabel("press the mic and make one of your sounds.");
  render();
});

// ---------- step 2: using relay ----------

function speak(word) {
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(word));
}

async function useRecording(x) {
  // only fully saved words are used, the same as the notebook (three recordings each, plus any learned ones)
  const ready = new Set(readyWords());
  const r = await predict(x, state.saved.filter((s) => ready.has(s.word)));
  state.last = r;
  showSure(r);

  if (r.action === "speak") {
    state.counts.spoke++;
    showResult(r.top3[0].word, "speak", "relay was sure enough, so it said it out loud.");
    speak(r.top3[0].word);
    askChoices(`did you mean "${r.top3[0].word}"?`, [r.top3[0].word], true);
  } else if (r.action === "show3") {
    state.counts.show3++;
    showResult(r.top3.map((p) => p.word).join(" · "), "show3", "relay wasn't sure, so it shows the three closest saved words.");
    askChoices("which one did you mean?", r.top3.map((p) => p.word), false);
  } else {
    state.counts.silent++;
    showResult("…", "silent", "relay wasn't sure, so it stayed quiet. try again.");
    askChoices("pick the word you meant, so relay can learn it:", state.words.filter((w) => ready.has(w)), false);
  }
  setLabel("press the mic and make another sound.");
  render();
}

function showResult(text, kind, note) {
  $("result-word").textContent = text;
  $("result-word").className = `result-word ${kind}`;
  $("result-note").textContent = note;
}

function showSure(r) {
  $("sure").hidden = false;
  $("sure-fill").style.width = `${Math.round(r.sure * 100)}%`;
  $("sure-bar").style.left = `${r.bar * 100}%`;
  $("sure-text").textContent = `the gate's confidence score for "${r.top3[0].word}": ${r.sure.toFixed(2)}. relay speaks at ${r.bar.toFixed(2)} or higher.`;
}

// learning from feedback: a confirmed or corrected try is saved as one more recording of that word
function askChoices(question, words, confirm) {
  $("choices").hidden = false;
  $("choices-q").textContent = question;
  const row = $("choice-row");
  row.innerHTML = "";
  const add = (label, cls, fn) => {
    const b = document.createElement("button");
    b.className = `button ${cls}`;
    b.textContent = label;
    b.addEventListener("click", fn);
    row.appendChild(b);
  };
  if (confirm) {
    add("yes", "primary", () => learn(words[0]));
    add("no, pick another", "", () => askChoices("which one did you mean?", readyWords(), false));
  } else {
    for (const w of words) add(w, "", () => { if (state.last.action !== "speak") speak(w); learn(w); });
    add("none of these", "quiet", () => { $("choices").hidden = true; });
  }
}

function learn(word) {
  $("choices").hidden = true;
  if ($("learn").checked && state.last) {
    state.saved.push({ word, seq: state.last.seq });
    state.counts.learned++;
    setLabel(`learned one more recording of "${word}".`);
  }
  state.last = null;
  render();
}

// ---------- step 3: caregiver view ----------

function renderCounts() {
  const c = state.counts;
  const total = c.spoke + c.show3 + c.silent;
  const pct = (n) => (total ? ` (${Math.round((n / total) * 100)}%)` : "");
  $("counts").innerHTML = `
    <dt>tries</dt><dd>${total}</dd>
    <dt>spoke out loud</dt><dd>${c.spoke}${pct(c.spoke)}</dd>
    <dt>showed three words</dt><dd>${c.show3}${pct(c.show3)}</dd>
    <dt>stayed quiet</dt><dd>${c.silent}${pct(c.silent)}</dd>
    <dt>recordings learned from answers</dt><dd>${c.learned}</dd>`;
}

// ---------- page ----------

function setLabel(html) { $("mic-label").innerHTML = html; }

function render() {
  renderWords();
  renderCounts();
  $("mode").textContent = state.using ? "using relay" : state.active ? `saving "${state.active}"` : "";
  if (!state.using && readyWords().length < 2) {
    $("result-word").textContent = "waiting";
    $("result-word").className = "result-word idle";
    $("result-note").textContent = "teach at least two words first.";
  }
}

$("mic").addEventListener("click", toggleMic);

(async () => {
  render();
  try {
    await load((p) => { $("load-fill").style.width = `${Math.round(p * 100)}%`; setLabel(`loading the model… ${Math.round(p * 100)}%`); });
    $("load").hidden = true;
    $("mic").disabled = false;
    setLabel("add a word on the right, then press the mic.");
  } catch (err) {
    setLabel(`the model didn't load: ${err.message}`);
    console.error(err);
  }
})();
