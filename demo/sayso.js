// the same steps as the notebook: whisper small's listening half turns a recording into numbers,
// dynamic time warping compares it to every saved recording, and the confidence gate decides
// whether to speak or show the three closest saved words
import { AutoProcessor } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1";

const MODEL = "onnx-community/whisper-small";
const ENCODER_URL = `https://huggingface.co/${MODEL}/resolve/main/onnx/encoder_model_quantized.onnx`;
const RATE = 16000;
const FRAME_SAMPLES = 320; // whisper's listening half gives one set of numbers per 320 samples (20 ms)

let processor, encoder, gate;

// the encoder file is about 92 mb, so it is kept in the browser cache after the first visit
async function fetchCached(url, onProgress) {
  const cache = await caches.open("sayso-model");
  const hit = await cache.match(url);
  if (hit) return new Uint8Array(await hit.arrayBuffer());

  const res = await fetch(url);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    if (total) onProgress(got / total);
  }
  const bytes = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) { bytes.set(c, at); at += c.length; }
  await cache.put(url, new Response(bytes));
  return bytes;
}

export async function load(onProgress) {
  ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/";
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
  gate = await (await fetch("gate.json")).json();
  processor = await AutoProcessor.from_pretrained(MODEL);
  const bytes = await fetchCached(ENCODER_URL, onProgress);
  encoder = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
}

// silence at the start and end is cut the way librosa.effects.trim does it (30 db below the loudest part)
function trimSpan(x) {
  const frame = 2048, hop = 512, half = frame / 2;
  const n = Math.floor(x.length / hop) + 1;
  const rms = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * hop - half; j < i * hop + half; j++) if (j >= 0 && j < x.length) s += x[j] * x[j];
    rms[i] = Math.sqrt(s / frame);
  }
  const top = Math.max(...rms, 1e-10);
  const loud = [...rms].map((v, i) => (20 * Math.log10(Math.max(v, 1e-10) / top) > -30 ? i : -1)).filter((i) => i >= 0);
  if (!loud.length) return [0, x.length];
  return [loud[0] * hop, Math.min(x.length, (loud[loud.length - 1] + 1) * hop)];
}

// the speech part of the recording, shrunk to at most 200 steps by averaging neighbours
export async function toSequence(x) {
  const [a, b] = trimSpan(x);
  const { input_features } = await processor(x);
  const feeds = { [encoder.inputNames[0]]: new ort.Tensor("float32", input_features.data, input_features.dims) };
  const heard = (await encoder.run(feeds))[encoder.outputNames[0]];
  const width = heard.dims[2];

  const first = Math.min(Math.floor(a / FRAME_SAMPLES), 1498);
  const last = Math.max(first + 2, Math.min(1500, Math.ceil(b / FRAME_SAMPLES)));
  const len = last - first;
  const steps = Math.min(200, Math.max(1, Math.floor(len / 2)));
  const seq = [];
  for (let i = 0; i < steps; i++) {
    const s = Math.floor((i * len) / steps), e = Math.ceil(((i + 1) * len) / steps);
    const v = new Float32Array(width);
    for (let f = s; f < e; f++) {
      const off = (first + f) * width;
      for (let k = 0; k < width; k++) v[k] += heard.data[off + k];
    }
    for (let k = 0; k < width; k++) v[k] /= e - s;
    seq.push(v);
  }
  return seq;
}

// every frame is scaled by the mean and spread of this user's saved frames, then set to length 1,
// so the comparison measures direction (what the sound is like) and not loudness
function makePrep(saved) {
  const width = saved[0].seq[0].length;
  const mid = new Float32Array(width), spread = new Float32Array(width);
  let n = 0;
  for (const { seq } of saved) for (const v of seq) { n++; for (let k = 0; k < width; k++) mid[k] += v[k]; }
  for (let k = 0; k < width; k++) mid[k] /= n;
  for (const { seq } of saved) for (const v of seq) for (let k = 0; k < width; k++) spread[k] += (v[k] - mid[k]) ** 2;
  for (let k = 0; k < width; k++) spread[k] = Math.sqrt(spread[k] / n) + 1e-6;
  return (seq) => seq.map((v) => {
    const z = v.map((x, k) => (x - mid[k]) / spread[k]);
    const norm = Math.hypot(...z) || 1;
    return z.map((x) => x / norm);
  });
}

// dynamic time warping: lines the two recordings up step by step, start to finish, and averages the differences
function dtw(q, t) {
  const n = q.length, m = t.length;
  let prev = new Float32Array(m + 1).fill(Infinity);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    const row = new Float32Array(m + 1).fill(Infinity);
    for (let j = 1; j <= m; j++) {
      let dot = 0;
      const a = q[i - 1], b = t[j - 1];
      for (let k = 0; k < a.length; k++) dot += a[k] * b[k];
      row[j] = 1 - dot + Math.min(prev[j], row[j - 1], prev[j - 1]);
    }
    prev = row;
  }
  return prev[m] / (n + m);
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
function chance(model, clues) {
  let z = model.intercept;
  gate.clues.forEach((name, i) => { z += model.coef[i] * ((clues[name] - model.mean[i]) / model.scale[i]); });
  return sigmoid(z);
}

// the full decision for one new recording. saved is a list of { word, seq }
export async function predict(x, saved) {
  const seq = await toSequence(x);
  const prep = makePrep(saved);
  const q = prep(seq);
  const dists = saved.map((s) => dtw(q, prep(s.seq)));

  const words = [...new Set(saved.map((s) => s.word))];
  const perWord = words.map((w) => ({ word: w, d: Math.min(...dists.filter((_, i) => saved[i].word === w)) }))
    .sort((p, r) => p.d - r.d);
  const pick = perWord[0];
  const pickDists = dists.filter((_, i) => saved[i].word === pick.word);
  const clues = {
    best: pick.d,
    gap: perWord.length > 1 ? perWord[1].d - pick.d : 1,
    agree: pickDists.reduce((s, d) => s + d, 0) / pickDists.length - pick.d,
    dur: x.length / RATE,
    loud: Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length),
  };

  const sure = chance(gate.speak, clues);
  let action = "speak";
  if (sure < gate.speak.cutoff) action = "show3";
  return { action, sure, bar: gate.speak.cutoff, top3: perWord.slice(0, 3), seq, clues };
}
