"use strict";
/* =====================================================================
   HMWK 1 — Private key → Public key with elliptic-curve scalar multiplication
   Toy curve  y² = x³ + 7 (mod 17)  — same equation as Ethereum's secp256k1,
   but over a tiny field so that every point can be seen and counted.

   1. Curve arithmetic          (the actual homework: ~50 lines)
   2. Scalar multiplication
   3. Statistics toolkit         (χ², p-values, correlation, ACF)
   4. SHA-256                    (control group for the statistical tests)
   5. User interface
   ===================================================================== */

/* ---------- 1. Curve, field arithmetic, point addition ---------- */
const p = 17, a = 0, b = 7;            // y² = x³ + a·x + b  (mod p)
const O = null;                         // point at infinity = neutral element
const mod = n => ((n % p) + p) % p;
function inv(n) {                       // modular inverse (extended Euclid)
  let [r0, r1, s0, s1] = [mod(n), p, 1, 0];
  while (r1) { const q = Math.floor(r0 / r1); [r0, r1, s0, s1] = [r1, r0 - q * r1, s1, s0 - q * s1]; }
  return mod(s0);
}
const same = (P, Q) => P === Q || (!!P && !!Q && P[0] === Q[0] && P[1] === Q[1]);
const show = P => (P ? `(${P[0]}, ${P[1]})` : "O");

function addStep(P, Q) {                // P + Q  (also returns λ for the explanations)
  if (!P) return { R: Q, kind: "O + Q = Q" };
  if (!Q) return { R: P, kind: "P + O = P" };
  const [x1, y1] = P, [x2, y2] = Q;
  if (x1 === x2 && mod(y1 + y2) === 0) return { R: O, kind: "P + (−P) = O" };
  const dbl = same(P, Q);
  const lambda = dbl ? mod((3 * x1 * x1 + a) * inv(2 * y1))   // slope of the tangent
                     : mod((y2 - y1) * inv(x2 - x1));          // slope of the chord
  const x3 = mod(lambda * lambda - x1 - x2);
  const y3 = mod(lambda * (x1 - x3) - y1);
  return { R: [x3, y3], lambda, kind: dbl ? "doubling" : "addition" };
}
const add = (P, Q) => addStep(P, Q).R;

/* ---------- 2. Scalar multiplication  Q = kG ---------- */
function repeatedAddition(k, G) {       // G, 2G, 3G, …, kG   (k − 1 additions)
  const steps = [{ n: 1, R: G, op: "start" }];
  for (let n = 2, R = G; n <= k; n++) {
    const s = addStep(R, G); steps.push({ n, R: s.R, P: R, Q: G, s, op: "+G" }); R = s.R;
  }
  return steps;
}
function doubleAndAdd(k, G) {           // reads the bits of k: ~2·log₂k operations
  const steps = [], bits = k.toString(2); let R = O, n = 0;
  [...bits].forEach((bit, i) => {
    if (n) { const s = addStep(R, R); n *= 2; steps.push({ n, R: s.R, P: R, Q: R, s, op: "double", bit, bitIndex: i }); R = s.R; }
    if (bit === "1") { const s = addStep(R, G); n += 1; steps.push({ n, R: s.R, P: R, Q: G, s, op: n === 1 ? "start" : "+G", bit, bitIndex: i }); R = s.R; }
  });
  return steps;
}
const mul = (k, G) => { let R = O; for (let Q = G; k > 0; k = Math.floor(k / 2), Q = add(Q, Q)) if (k % 2) R = add(R, Q); return R; };

/* all points of the curve, the order of a point, and its cycle [O, G, 2G, …, (n−1)G] */
const POINTS = [];
for (let x = 0; x < p; x++) for (let y = 0; y < p; y++) if (mod(y * y - x ** 3 - a * x - b) === 0) POINTS.push([x, y]);
const order = G => { let n = 1; for (let R = G; R; R = add(R, G)) n++; return n; };
const cycle = G => { const T = [O]; for (let R = G; R; R = add(R, G)) T.push(R); return T; };   // kG = T[k mod n]

/* ---------- 3. Statistics toolkit ---------- */
const sum = v => v.reduce((s, t) => s + t, 0);
const mean = v => sum(v) / v.length;
const variance = v => { const m = mean(v); return sum(v.map(t => (t - m) ** 2)) / (v.length - 1); };
function pearson(u, v) {
  const mu = mean(u), mv = mean(v); let c = 0, su = 0, sv = 0;
  for (let i = 0; i < u.length; i++) { c += (u[i] - mu) * (v[i] - mv); su += (u[i] - mu) ** 2; sv += (v[i] - mv) ** 2; }
  return su > 0 && sv > 0 ? c / Math.sqrt(su * sv) : NaN;
}
function acf(seq, lag) {                // autocorrelation at a lag; null entries (point O) are skipped
  const vals = seq.filter(v => v !== null), m = mean(vals), v0 = sum(vals.map(t => (t - m) ** 2)) / vals.length;
  let c = 0, n = 0;
  for (let t = 0; t + lag < seq.length; t++) if (seq[t] !== null && seq[t + lag] !== null) { c += (seq[t] - m) * (seq[t + lag] - m); n++; }
  return n && v0 ? c / n / v0 : NaN;
}
function chiSquare(counts) {            // goodness of fit against the uniform distribution
  const N = sum(counts), E = N / counts.length;
  return N ? sum(counts.map(o => (o - E) ** 2 / E)) : 0;
}
function lnGamma(x) {                   // Lanczos approximation
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, t = x + 5.5, s = 1.000000000190015;
  t -= (x + 0.5) * Math.log(t);
  for (const ci of c) s += ci / ++y;
  return -t + Math.log(2.5066282746310005 * s / x);
}
function gammaQ(s, x) {                 // regularized upper incomplete gamma Q(s, x)
  if (x <= 0) return 1;
  const front = Math.exp(-x + s * Math.log(x) - lnGamma(s));
  if (x < s + 1) {                      // series
    let ap = s, del = 1 / s, tot = del;
    for (let i = 0; i < 1000 && Math.abs(del) > Math.abs(tot) * 1e-14; i++) { ap++; del *= x / ap; tot += del; }
    return 1 - tot * front;
  }
  let bb = x + 1 - s, c = 1e300, d = 1 / bb, h = d;   // continued fraction
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - s); bb += 2;
    d = an * d + bb; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = bb + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break;
  }
  return front * h;
}
const chiPValue = (chi, df) => (df > 0 ? gammaQ(df / 2, chi / 2) : NaN);       // P(χ²_df ≥ chi)
function chiCritical(df, alpha = 0.05) {                                         // χ² quantile by bisection
  let lo = 0, hi = df + 20 * Math.sqrt(2 * df) + 20;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (chiPValue(m, df) > alpha) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
const binom = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
const popcount = v => { let c = 0; for (; v; v &= v - 1) c++; return c; };
const enc = P => (P[0] << 5) | P[1];    // point → 10-bit number: x (5 bits) ‖ y (5 bits)
function mulberry32(seed) {             // small seeded PRNG, so the "random keys" design is reproducible
  return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- 4. SHA-256 (control group) ---------- */
const sha256 = (() => {
  const primes = []; for (let n = 2; primes.length < 64; n++) if (primes.every(q => n % q)) primes.push(n);
  const frac = v => ((v - Math.floor(v)) * 2 ** 32) >>> 0;
  const K = primes.map(q => frac(Math.cbrt(q))), H0 = primes.slice(0, 8).map(q => frac(Math.sqrt(q)));
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  return str => {
    const bytes = [...str].map(ch => ch.charCodeAt(0) & 255), bitLen = bytes.length * 8;   // keys are ASCII digits
    bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 255);
    const H = H0.slice(), W = new Array(64);
    for (let o = 0; o < bytes.length; o += 64) {
      for (let t = 0; t < 16; t++) W[t] = ((bytes[o + 4 * t] << 24) | (bytes[o + 4 * t + 1] << 16) | (bytes[o + 4 * t + 2] << 8) | bytes[o + 4 * t + 3]) >>> 0;
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3), s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
      }
      let [v0, v1, v2, v3, v4, v5, v6, v7] = H;
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(v4, 6) ^ rotr(v4, 11) ^ rotr(v4, 25), ch = (v4 & v5) ^ (~v4 & v6), t1 = (v7 + S1 + ch + K[t] + W[t]) >>> 0;
        const S0 = rotr(v0, 2) ^ rotr(v0, 13) ^ rotr(v0, 22), mj = (v0 & v1) ^ (v0 & v2) ^ (v1 & v2), t2 = (S0 + mj) >>> 0;
        v7 = v6; v6 = v5; v5 = v4; v4 = (v3 + t1) >>> 0; v3 = v2; v2 = v1; v1 = v0; v0 = (t1 + t2) >>> 0;
      }
      [v0, v1, v2, v3, v4, v5, v6, v7].forEach((v, i) => (H[i] = (H[i] + v) >>> 0));
    }
    return H;                           // eight 32-bit words
  };
})();
const hashCache = new Map();
const hash10 = k => { let h = hashCache.get(k); if (h === undefined) { h = sha256(String(k))[0] >>> 22; hashCache.set(k, h); } return h; };   // first 10 bits

if (typeof module !== "undefined") module.exports = { add, mul, order, cycle, POINTS, repeatedAddition, doubleAndAdd, show, sha256, hash10, chiPValue, chiCritical, acf, pearson };

/* =====================================================================
   5. User interface
   ===================================================================== */
if (typeof document !== "undefined") {
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (parent, tag, attrs = {}, text) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return parent.appendChild(e);
  };
  const f3 = v => (Number.isFinite(v) ? (Number.isInteger(v) ? String(v) : v.toFixed(3)) : "–");
  const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : "–");
  const fp = v => (!Number.isFinite(v) ? "–" : v < 0.001 ? "< 0.001" : v > 0.999 ? "> 0.999" : v.toFixed(3));
  const pEq = v => { const t = fp(v); return t.startsWith("<") || t.startsWith(">") ? `p ${t}` : `p = ${t}`; };
  const short = v => (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v >= 10 ? String(Math.round(v)) : Number.isInteger(v) ? String(v) : v.toFixed(2));

  const G = () => [1, 5];                // fixed example from the assignment
  const K = () => 6;
  const useRep = () => true;             // repeated addition: G, 2G, …, kG
  const steps = () => (useRep() ? repeatedAddition(K(), G()) : doubleAndAdd(K(), G()));

  /* ---------- small SVG chart kit (all colours come from CSS classes) ---------- */
  const CW = 360, CH = 160, ML = 34, MB = 24, MT = 10;
  const yAxis = (max, lo = 0) =>
    `<text class="axis yl" x="${ML - 5}" y="${MT + 4}">${short(max)}</text><text class="axis yl" x="${ML - 5}" y="${CH + 3}">${short(lo)}</text>` +
    `<line class="base" x1="${ML}" x2="${CW - 4}" y1="${CH}" y2="${CH}"/><line class="base" x1="${ML}" x2="${ML}" y1="${MT}" y2="${CH}"/>`;
  const legend = items => (items.length ? `<div class="clegend">${items.map(([cls, name]) => `<span><i class="sw ${cls}"></i>${name}</span>`).join("")}</div>` : "");
  const figure = (title, svg, leg = []) => `<figure><figcaption>${title}</figcaption>${svg}${legend(leg)}</figure>`;

  function barsChart(title, labels, series, opts = {}) {
    const n = labels.length, gw = (CW - ML - 6) / n, bw = Math.max((gw - 2) / series.length, 0.8);
    const vals = series.flatMap(s => s.values).concat(opts.ref != null ? [opts.ref] : [], opts.expected || []);
    const max = opts.max ?? (Math.max(...vals, 0) || 1), y = v => CH - (v / max) * (CH - MT);
    let s = `<svg viewBox="0 0 ${CW} ${CH + MB}" role="img" aria-label="${title}">` + yAxis(max);
    const every = Math.ceil(n / 18);
    labels.forEach((lab, i) => {
      series.forEach((se, j) => {
        const v = se.values[i] || 0;
        s += `<rect class="${se.cls}" x="${ML + 2 + i * gw + j * bw}" y="${y(v)}" width="${bw}" height="${CH - y(v)}"><title>${se.name ? se.name + " · " : ""}${lab}: ${f3(v)}</title></rect>`;
      });
      if (i % every === 0) s += `<text class="axis" x="${ML + 2 + i * gw + gw / 2}" y="${CH + 15}">${lab}</text>`;
    });
    if (opts.ref != null) s += `<line class="ref" x1="${ML}" x2="${CW - 4}" y1="${y(opts.ref)}" y2="${y(opts.ref)}"/>`;
    if (opts.expected) s += `<polyline class="expline" points="${opts.expected.map((v, i) => `${ML + 2 + i * gw + gw / 2},${y(v)}`).join(" ")}"/>` +
      opts.expected.map((v, i) => `<circle class="expdot" r="2.6" cx="${ML + 2 + i * gw + gw / 2}" cy="${y(v)}"/>`).join("");
    const leg = series.filter(s => s.name).map(s => [s.cls, s.name]).concat(opts.legendExtra || []);
    return figure(title, s + "</svg>", leg);
  }
  function lineChart(title, len, series, opts = {}) {
    const vals = series.flatMap(s => s.values).filter(Number.isFinite).concat(opts.hline != null ? [opts.hline] : []);
    const max = Math.min(opts.cap ?? Infinity, Math.max(...vals, 1)), x = i => ML + (i / Math.max(len - 1, 1)) * (CW - ML - 6), y = v => CH - (Math.min(v, max) / max) * (CH - MT);
    let s = `<svg viewBox="0 0 ${CW} ${CH + MB}" role="img" aria-label="${title}">` + yAxis(max);
    if (opts.hline != null) s += `<line class="ref" x1="${ML}" x2="${CW - 4}" y1="${y(opts.hline)}" y2="${y(opts.hline)}"/>`;
    series.forEach(se => {
      const pts = se.values.map((v, i) => (Number.isFinite(v) ? `${x(i).toFixed(1)},${y(v).toFixed(1)}` : null)).filter(Boolean);
      if (pts.length) s += `<polyline class="ln ${se.cls}" points="${pts.join(" ")}"/>`;
    });
    s += `<text class="axis" x="${ML + 8}" y="${CH + 15}">1</text><text class="axis" x="${CW - 18}" y="${CH + 15}">${len}</text>`;
    return figure(title, s + "</svg>", series.map(se => [se.cls, se.name]).concat(opts.legendExtra || []));
  }
  function signedBars(title, labels, series, band) {      // ACF plot: bars around 0, range −1 … 1
    const n = labels.length, gw = (CW - ML - 6) / n, bw = Math.max((gw - 2) / series.length, 0.8), mid = (CH + MT) / 2, y = v => mid - v * (CH - MT) / 2;
    let s = `<svg viewBox="0 0 ${CW} ${CH + MB}" role="img" aria-label="${title}">` +
      `<text class="axis yl" x="${ML - 5}" y="${MT + 4}">1</text><text class="axis yl" x="${ML - 5}" y="${mid + 3}">0</text><text class="axis yl" x="${ML - 5}" y="${CH + 3}">−1</text>` +
      `<line class="base" x1="${ML}" x2="${CW - 4}" y1="${mid}" y2="${mid}"/>` +
      `<rect class="band" x="${ML}" y="${y(band)}" width="${CW - ML - 4}" height="${y(-band) - y(band)}"/>`;
    const every = Math.ceil(n / 15);
    labels.forEach((lab, i) => {
      series.forEach((se, j) => {
        const v = Number.isFinite(se.values[i]) ? se.values[i] : 0;
        s += `<rect class="${se.cls}" x="${ML + 2 + i * gw + j * bw}" y="${Math.min(y(v), mid)}" width="${bw}" height="${Math.abs(y(v) - mid)}"><title>${se.name} · lag ${lab}: ${f3(v)}</title></rect>`;
      });
      if (i % every === 0) s += `<text class="axis" x="${ML + 2 + i * gw + gw / 2}" y="${CH + 15}">${lab}</text>`;
    });
    return figure(title, s + "</svg>", series.map(se => [se.cls, se.name]).concat([["bandsw", "95% band ±1.96/√N"]]));
  }
  function scatterChart(title, pts, xmax, ymax, cls = "dot") {
    const x = u => ML + (u / xmax) * (CW - ML - 6), y = v => CH - (v / ymax) * (CH - MT);
    let s = `<svg viewBox="0 0 ${CW} ${CH + MB}" role="img" aria-label="${title}">` + yAxis(ymax) +
      `<polyline class="poly" points="${pts.map(([u, v]) => `${x(u).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}"/>`;
    pts.forEach(([u, v]) => (s += `<circle class="${cls}" r="2.6" cx="${x(u).toFixed(1)}" cy="${y(v).toFixed(1)}"><title>k = ${u}: ${v}</title></circle>`));
    s += `<text class="axis" x="${ML + 8}" y="${CH + 15}">k = 1</text><text class="axis" x="${CW - 22}" y="${CH + 15}">k = ${xmax}</text>`;
    return figure(title, s + "</svg>");
  }

  /* ---------- 02: the idea ---------- */
  function renderIdea() {
    const g = G(), n = order(g), T = cycle(g), L = Math.max(3 * n, 12);
    const ks = Array.from({ length: L }, (_, i) => i + 1);
    $("ideaInt").innerHTML = scatterChart(`5 · k for k = 1 … ${L}`, ks.map(k => [k, 5 * k]), L, 5 * L, "dot s2");
    $("ideaEc").innerHTML = scatterChart(`x-coordinate of kG for k = 1 … ${L}`, ks.filter(k => T[k % n]).map(k => [k, T[k % n][0]]), L, p - 1, "dot");
  }

  /* ---------- 03: chord-and-tangent on the real curve ---------- */
  function drawRealCurve(mode) {
    const W = 360, H = 300, xmin = -2.3, xmax = 3.4, ymin = -7, ymax = 7;
    const X = x => ((x - xmin) / (xmax - xmin)) * W, Y = y => H - ((y - ymin) / (ymax - ymin)) * H;
    const fy = x => Math.sqrt(x ** 3 + 7), x0 = -Math.cbrt(7);
    const up = [], dn = [];
    for (let i = 0; i <= 200; i++) { const x = x0 + (i / 200) ** 2 * (xmax - x0), y = fy(x); if (Math.abs(y) <= ymax) { up.push(`${X(x).toFixed(1)},${Y(y).toFixed(1)}`); dn.unshift(`${X(x).toFixed(1)},${Y(-y).toFixed(1)}`); } }
    let P, Q, lam;
    if (mode === "dbl") { P = [1, fy(1)]; Q = P; lam = (3 * P[0] ** 2) / (2 * P[1]); }
    else { P = [-1.5, fy(-1.5)]; Q = [1, fy(1)]; lam = (Q[1] - P[1]) / (Q[0] - P[0]); }
    const x3 = lam * lam - P[0] - Q[0], yNeg = P[1] + lam * (x3 - P[0]), R = [x3, -yNeg];
    const lx1 = xmin, lx2 = xmax, ly = x => P[1] + lam * (x - P[0]);
    const pt = (Pt, cls, lab, dx = 8, dy = -8) => `<circle class="${cls}" cx="${X(Pt[0])}" cy="${Y(Pt[1])}" r="5.5"/><text class="lbl ${cls}-t" x="${X(Pt[0]) + dx}" y="${Y(Pt[1]) + dy}">${lab}</text>`;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Chord-and-tangent rule on the real curve">`;
    s += `<line class="axisline" x1="0" x2="${W}" y1="${Y(0)}" y2="${Y(0)}"/><line class="axisline" x1="${X(0)}" x2="${X(0)}" y1="0" y2="${H}"/>`;
    s += `<polyline class="curve" points="${dn.concat(up).join(" ")}"/>`;
    s += `<line class="chord" x1="${X(lx1)}" y1="${Y(ly(lx1))}" x2="${X(lx2)}" y2="${Y(ly(lx2))}"/>`;
    s += `<line class="reflect" x1="${X(x3)}" y1="${Y(yNeg)}" x2="${X(x3)}" y2="${Y(-yNeg)}"/>`;
    s += mode === "dbl" ? pt(P, "rp", "P") : pt(P, "rp", "P", -16, -10) + pt(Q, "rp", "Q");
    s += pt([x3, yNeg], "rn", "−R", 8, -8) + pt(R, "rr", mode === "dbl" ? "R = 2P" : "R = P + Q", 10, 16);
    s += `<text class="axis" x="${W - 6}" y="${Y(0) - 6}" style="text-anchor:end">x</text><text class="axis" x="${X(0) + 8}" y="12">y</text></svg>`;
    $("realCurve").innerHTML = s;
    const r = v => v.toFixed(2);
    $("rcText").innerHTML = mode === "dbl"
      ? `<b>Doubling P = (${r(P[0])}, ${r(P[1])})</b><br>1. Tangent at P, slope λ = 3x₁² / (2y₁) = ${r(lam)}<br>2. It meets the curve again at −R = (${r(x3)}, ${r(yNeg)})<br>3. Reflect: <b>2P = (${r(R[0])}, ${r(R[1])})</b><p class="mini">The tangent touches the curve at P (a “double” intersection), so P is used twice.</p>`
      : `<b>Adding P = (${r(P[0])}, ${r(P[1])}) and Q = (${r(Q[0])}, ${r(Q[1])})</b><br>1. Line through P and Q, slope λ = (y₂ − y₁)/(x₂ − x₁) = ${r(lam)}<br>2. Third intersection −R = (${r(x3)}, ${r(yNeg)})<br>   x₃ = λ² − x₁ − x₂<br>3. Reflect across the x-axis: <b>R = (${r(R[0])}, ${r(R[1])})</b><p class="mini">The reflection is what makes the operation well-behaved (associative), so that kG does not depend on the order of the additions.</p>`;
    $("rcAdd").setAttribute("aria-pressed", mode !== "dbl"); $("rcDbl").setAttribute("aria-pressed", mode === "dbl");
  }

  /* ---------- 04: step-by-step animation ---------- */
  const S = 440, M = 34, C = (S - M - 16) / (p - 1);
  const X = x => M + x * C, Y = y => S - M - y * C;
  let token = 0, currentStep = 0, labels;

  /* the same algorithm over the real numbers, for the geometric picture */
  const GR = [0.535, Math.sqrt(0.535 ** 3 + 7)];
  function addReal(P, Q) {
    const dbl = Math.abs(P[0] - Q[0]) < 1e-12 && Math.abs(P[1] - Q[1]) < 1e-12;
    const lambda = dbl ? (3 * P[0] ** 2) / (2 * P[1]) : (Q[1] - P[1]) / (Q[0] - P[0]);
    const x3 = lambda * lambda - P[0] - Q[0];
    return { R: [x3, lambda * (P[0] - x3) - P[1]], lambda, dbl };
  }
  function realSteps() {                 // mirrors repeatedAddition / doubleAndAdd step by step
    const k = K(), out = [];
    if (useRep()) {
      let R = GR; out.push({ R, n: 1, op: "start" });
      for (let n = 2; n <= k; n++) { const s = addReal(R, GR); out.push({ P: R, Q: GR, ...s, n, op: "+G" }); R = s.R; }
    } else {
      let R = null, n = 0;
      for (const bit of k.toString(2)) {
        if (n) { const s = addReal(R, R); n *= 2; out.push({ P: R, Q: R, ...s, n, op: "double" }); R = s.R; }
        if (bit === "1") {
          n += 1;
          if (!R) { R = GR; out.push({ R, n, op: "start" }); }
          else { const s = addReal(R, GR); out.push({ P: R, Q: GR, ...s, n, op: "+G" }); R = s.R; }
        }
      }
    }
    return out;
  }

  const RW = 440, RH = 400, BASE = { x0: -2.6, x1: 3.8, y0: -6.5, y1: 6.5 };
  let view = { ...BASE }, viewAnim = 0;
  function targetView(rs) {
    if (!rs || !rs.P) return { ...BASE };
    const pts = [rs.P, rs.Q, rs.R, [rs.R[0], -rs.R[1]], GR];
    const xmin = Math.min(...pts.map(q => q[0])), xmax = Math.max(...pts.map(q => q[0])), ym = Math.max(...pts.map(q => Math.abs(q[1])));
    const x1 = xmax > BASE.x1 - 0.4 ? xmax + 0.12 * (xmax - BASE.x0) : BASE.x1, ymax = ym > BASE.y1 - 0.6 ? ym * 1.12 : BASE.y1;
    return { x0: Math.min(BASE.x0, xmin - 0.4), x1, y0: -ymax, y1: ymax };
  }
  function niceStep(span) { const raw = span / 6, e = 10 ** Math.floor(Math.log10(raw)), f = raw / e; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e; }
  function drawReal(v, idx, rsAll) {
    const svg = $("realPlot"), sx = x => ((x - v.x0) / (v.x1 - v.x0)) * RW, sy = y => RH - ((y - v.y0) / (v.y1 - v.y0)) * RH;
    let s = "";
    const stx = niceStep(v.x1 - v.x0), sty = niceStep(v.y1 - v.y0);
    for (let x = Math.ceil(v.x0 / stx) * stx; x <= v.x1; x += stx) s += `<line class="grid" x1="${sx(x)}" x2="${sx(x)}" y1="0" y2="${RH}"/>` + (sx(x) > 30 && sx(x) < RW - 10 ? `<text class="tick" x="${sx(x) + 2}" y="${RH - 4}">${+x.toFixed(2)}</text>` : "");
    for (let y = Math.ceil(v.y0 / sty) * sty; y <= v.y1; y += sty) s += `<line class="grid" x1="0" x2="${RW}" y1="${sy(y)}" y2="${sy(y)}"/>${Math.abs(y) > 1e-9 && sy(y) > 10 && sy(y) < RH - 20 ? `<text class="tick" x="14" y="${sy(y) + 3}">${+y.toFixed(2)}</text>` : ""}`;
    s += `<line class="axisline" x1="0" x2="${RW}" y1="${sy(0)}" y2="${sy(0)}"/><line class="axisline" x1="${sx(0)}" x2="${sx(0)}" y1="0" y2="${RH}"/>`;
    const xs = -Math.cbrt(7), up = [], dn = [];
    for (let i = 0; i <= 260; i++) {
      const x = xs + (i / 260) ** 2 * (v.x1 - xs), y = Math.sqrt(Math.max(x ** 3 + 7, 0));
      up.push(`${sx(x).toFixed(1)},${sy(y).toFixed(1)}`); dn.unshift(`${sx(x).toFixed(1)},${sy(-y).toFixed(1)}`);
    }
    s += `<polyline class="curve" points="${dn.concat(up).join(" ")}"/>`;
    // previous results
    const seen = new Map();
    for (let i = 0; i < idx - 1; i++) {
      const r = rsAll[i].R, key = r[0].toFixed(3) + "," + r[1].toFixed(3);
      s += `<circle class="hit" cx="${sx(r[0])}" cy="${sy(r[1])}" r="4"/>`;
      seen.set(key, (seen.get(key) ? seen.get(key) + "," : "") + rsAll[i].n + "G");
    }
    seen.forEach((txt, key) => { const [x, y] = key.split(",").map(Number); s += `<text class="lbl" x="${sx(x) + 7}" y="${sy(y) + 14}">${txt}</text>`; });
    s += `<circle class="G" cx="${sx(GR[0])}" cy="${sy(GR[1])}" r="8"/><text class="lbl acc-t" x="${sx(GR[0]) - 20}" y="${sy(GR[1]) - 8}">G</text>`;
    const rs = rsAll[idx - 1];
    if (rs && rs.P) {
      const ly = x => rs.P[1] + rs.lambda * (x - rs.P[0]), m = [rs.R[0], -rs.R[1]];
      s += `<line class="chord${rs.dbl ? " tan" : ""}" x1="0" y1="${sy(ly(v.x0))}" x2="${RW}" y2="${sy(ly(v.x1))}"/>`;
      s += `<circle class="in" cx="${sx(rs.P[0])}" cy="${sy(rs.P[1])}" r="10"/>`;
      if (!rs.dbl) s += `<circle class="in" cx="${sx(rs.Q[0])}" cy="${sy(rs.Q[1])}" r="10"/>`;
      s += `<line class="reflect" x1="${sx(m[0])}" y1="${sy(m[1])}" x2="${sx(rs.R[0])}" y2="${sy(rs.R[1])}"/>`;
      s += `<circle class="neg" cx="${sx(m[0])}" cy="${sy(m[1])}" r="6"/><text class="lbl red" x="${sx(m[0]) + 9}" y="${sy(m[1]) - 7}">−R</text>`;
      s += `<circle class="Q" cx="${sx(rs.R[0])}" cy="${sy(rs.R[1])}" r="13"/><text class="lbl acc-t" x="${sx(rs.R[0]) + 15}" y="${sy(rs.R[1]) + 4}">${rs.n}G</text>`;
    } else if (rs) {
      s += `<circle class="Q" cx="${sx(rs.R[0])}" cy="${sy(rs.R[1])}" r="13"/>`;
    }
    svg.innerHTML = s;
    const zoom = (v.x1 - v.x0) / (BASE.x1 - BASE.x0);
    $("zoomNote").textContent = zoom > 1.05 ? `· zoomed out ×${zoom.toFixed(1)}` : "";
  }
  const raf = window.requestAnimationFrame ? f => window.requestAnimationFrame(f) : f => setTimeout(() => f(Date.now()), 16);
  function showReal(idx) {               // smooth zoom between views
    const rsAll = realSteps(), target = targetView(rsAll[idx - 1]), from = { ...view }, my = ++viewAnim, t0 = (window.performance ? performance.now() : Date.now());
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = now => {
      if (my !== viewAnim) return;
      const t = reduce ? 1 : Math.min(1, (now - t0) / 450), e = t * t * (3 - 2 * t);
      view = { x0: from.x0 + (target.x0 - from.x0) * e, x1: from.x1 + (target.x1 - from.x1) * e, y0: from.y0 + (target.y0 - from.y0) * e, y1: from.y1 + (target.y1 - from.y1) * e };
      drawReal(view, idx, rsAll);
      if (t < 1) raf(frame);
    };
    raf(frame);
  }

  function drawBase() {
    const svg = $("plot");
    svg.innerHTML = '<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z"/></marker></defs>';
    for (let i = 0; i < p; i++) {
      svgEl(svg, "line", { x1: X(i), y1: Y(0), x2: X(i), y2: Y(p - 1), class: "grid" });
      svgEl(svg, "line", { x1: X(0), y1: Y(i), x2: X(p - 1), y2: Y(i), class: "grid" });
      svgEl(svg, "text", { x: X(i), y: S - M + 18, class: "tick" }, i);
      svgEl(svg, "text", { x: M - 14, y: Y(i) + 4, class: "tick" }, i);
    }
    svgEl(svg, "line", { x1: X(0), y1: Y(p / 2), x2: X(p - 1), y2: Y(p / 2), class: "sym" });
    POINTS.forEach(P => svgEl(svg, "circle", { cx: X(P[0]), cy: Y(P[1]), r: 4, class: "pt" }));
    svgEl(svg, "g", { id: "trail" }); svgEl(svg, "g", { id: "live" });
    labels = new Map();
  }
  function label(P, txt) {              // one label per point, collecting all multiples that land there
    const key = show(P), old = labels.get(key);
    if (old) { old.textContent += "," + txt; return; }
    labels.set(key, svgEl($("trail"), "text", { x: X(P[0]) + 8, y: Y(P[1]) + 15, class: "lbl" }, txt));
  }
  function explain(s) {
    const t = s.s;
    if (s.op === "start") return `1G = G = ${show(s.R)}`;
    if (t.lambda === undefined) return `${t.kind} → ${show(t.R)}` + (t.R ? "" : "<br>The two points have the same x: the line is vertical and meets the curve only “at infinity”. The result is O, and the multiples of G start a new cycle.");
    const [x1, y1] = s.P, [x2, y2] = s.Q, [x3, y3] = t.R;
    let h = t.kind === "doubling"
      ? `λ = (3x₁² + a)·(2y₁)⁻¹ = (3·${x1}²)·(2·${y1})⁻¹ = ${mod(3 * x1 * x1)}·${inv(2 * y1)} ≡ <b>${t.lambda}</b>`
      : `λ = (y₂ − y₁)·(x₂ − x₁)⁻¹ = (${y2} − ${y1})·(${x2} − ${x1})⁻¹ = ${mod(y2 - y1)}·${inv(x2 - x1)} ≡ <b>${t.lambda}</b>`;
    h += `<br>x₃ = λ² − x₁ − x₂ = ${t.lambda}² − ${x1} − ${x2} ≡ <b>${x3}</b>`;
    h += `<br>y₃ = λ(x₁ − x₃) − y₁ = ${t.lambda}·(${x1} − ${x3}) − ${y1} ≡ <b>${y3}</b>   (mod 17)`;
    return h + `<br>Third point −R = (${x3}, ${mod(-y3)}), reflected: R = (${x3}, ${y3})`;
  }
  function renderStep(index) {
    const st = steps(), g = G(), n = order(g), T = cycle(g);
    currentStep = Math.max(0, Math.min(index, st.length));
    drawBase(); showReal(currentStep);
    const trail = $("trail"), live = $("live");
    svgEl(live, "circle", { cx: X(g[0]), cy: Y(g[1]), r: 8, class: "G" });
    svgEl(live, "text", { x: X(g[0]) - 22, y: Y(g[1]) - 8, class: "lbl acc-t" }, "G");
    for (let i = 0; i < currentStep; i++) {
      const s = st[i];
      if (!s.R) continue;
      if (s.P && i < currentStep - 1) svgEl(trail, "line", { x1: X(s.P[0]), y1: Y(s.P[1]), x2: X(s.R[0]), y2: Y(s.R[1]), class: "step" + (s.op === "double" ? " dbl" : ""), "marker-end": "url(#arr)" });
      svgEl(trail, "circle", { cx: X(s.R[0]), cy: Y(s.R[1]), r: 5, class: "hit" });
      label(s.R, s.n + "G");
    }
    const s = st[currentStep - 1];
    if (s) {
      if (s.P) svgEl(live, "circle", { cx: X(s.P[0]), cy: Y(s.P[1]), r: 11, class: "in" });
      if (s.P && s.Q && !same(s.P, s.Q)) svgEl(live, "circle", { cx: X(s.Q[0]), cy: Y(s.Q[1]), r: 11, class: "in" });
      if (s.P && s.R) {
        const m = [s.R[0], mod(-s.R[1])];
        svgEl(live, "line", { x1: X(m[0]), y1: Y(m[1]), x2: X(s.R[0]), y2: Y(s.R[1]), class: "reflect" });
        svgEl(live, "circle", { cx: X(m[0]), cy: Y(m[1]), r: 6, class: "neg" });
        svgEl(live, "text", { x: X(m[0]) - 26, y: Y(m[1]) + 4, class: "lbl red" }, "−R");
      }
      if (s.R) svgEl(live, "circle", { cx: X(s.R[0]), cy: Y(s.R[1]), r: 14, class: "Q" });
      const title = s.op === "start" ? "Start from the base point" : s.op === "double" ? `Double: ${s.n / 2}G + ${s.n / 2}G` : `Add G: ${s.n - 1}G + G` + (s.s && s.s.kind === "doubling" ? " (same point: tangent rule)" : "");
      const geo = s.op === "start" ? "Both pictures start from G." :
        s.R === O ? "On the real curve the step gives an ordinary point; modulo 17 the multiples have run through the whole cycle and return to O." :
        (s.s && s.s.kind === "doubling") ? "Left: the tangent at the point meets the curve once more at −R; reflecting gives R." :
        "Left: the line through the two points meets the curve a third time at −R; reflecting gives R.";
      $("stepInfo").innerHTML = `<div class="step-label">STEP ${currentStep} OF ${st.length}${s.bit ? ` · BIT ${s.bit}` : ""}</div><h3>${title}</h3>` +
        `<div class="stepcols"><div><p><b>Geometry.</b> ${geo}</p><p><b>Result mod 17:</b> ${s.n}G = ${show(s.R)}</p></div><div class="calc">${explain(s)}</div></div>`;
    } else {
      $("stepInfo").innerHTML = `<div class="step-label">READY</div><h3>Build Q = ${K()}G with ${useRep() ? "repeated addition" : "double-and-add"}</h3>` +
        `<p>Left: the smooth curve y² = x³ + 7. Right: its ${POINTS.length} points modulo 17 (dashed line = symmetry axis, P and −P share x). G is ringed in teal. Press <b>Next step</b> or <b>Play</b>.</p>`;
    }
    const cur = s ? s.n % n : -1;
    $("cycleStrip").innerHTML = T.slice(1).concat([O]).map((P, i) => {
      const idx = (i + 1) % n, visited = st.slice(0, currentStep).some(t => t.n % n === idx);
      return `<span class="chip${visited ? " on" : ""}${idx === cur ? " cur" : ""}" title="${idx ? idx + "G" : "nG = O"} = ${show(P)}"><b>${idx ? idx + "G" : n + "G"}</b>${show(P)}</span>`;
    }).join("");
    const dna = !useRep();
    $("bitWrap").hidden = !dna;
    if (dna) $("bitStrip").innerHTML = [...K().toString(2)].map((bit, i) => `<span class="chip bit${s && s.bitIndex === i ? " cur" : ""}${s && s.bitIndex > i ? " on" : ""}">${bit}</span>`).join("");
    const done = currentStep === st.length;
    $("animInterpretation").innerHTML = done
      ? `<b>Done:</b> Q = ${K()}G = ${show(st.at(-1).R)}, using ${st.length - 1} group operations. On the real curve the points wander along the curve; modulo 17 they stay on a grid of ${POINTS.length} points and repeat every ${n} steps.`
      : currentStep === 0
        ? `<b>What to observe:</b> on the left each step is a simple straight line. On the right the result jumps across the grid with no visible order: from the picture alone you cannot tell how many steps were made.`
        : `<b>What to observe:</b> the same two inputs are combined on both sides. ${useRep() ? "Repeated addition always adds G to the last result." : "Double-and-add alternates tangents (doubling) and lines through G (addition), as dictated by the bits of k."}`;
    $("prev").disabled = currentStep === 0;
    $("next").disabled = done;
  }
  async function play() {
    if ($("play").dataset.on === "1") { token++; return; }
    const my = ++token; $("play").dataset.on = "1"; $("play").textContent = "❚❚ Pause";
    if (currentStep === steps().length) renderStep(0);
    while (my === token && currentStep < steps().length) { renderStep(currentStep + 1); await sleep(+$("speed").value); }
    if (my === token) token++;
    $("play").dataset.on = "0"; $("play").textContent = "▶ Play";
  }
  const stopPlay = () => { token++; $("play").dataset.on = "0"; $("play").textContent = "▶ Play"; };


  /* 05 — Direct exploration of the properties listed in the assignment */
  const statState = { g: [1, 5], n: 9, points: [], k: 6, sample: [], bitSample: [], coordSample: [] };
  const bin5 = n => n.toString(2).padStart(5, "0");
  const popVar = v => { const m = mean(v); return mean(v.map(x => (x - m) ** 2)); };
  const count = (vals, n) => { const a = Array(n).fill(0); vals.forEach(x => a[x]++); return a; };
  const statnote = (observation, conclusion) => `<div class="stat-reading"><p><b>Observation.</b> ${observation}</p><p><b>Conclusion.</b> ${conclusion || observation}</p></div>`;
  const bitsChanged = (u, v) => [...u].filter((ch, i) => ch !== v[i]).length;
  function selectRandomKey(n) {
    const size = n - 1;
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      // Unbiased rejection sampling in the finite range 1 ... size.
      const limit = Math.floor(4294967296 / size) * size, a = new Uint32Array(1);
      do { crypto.getRandomValues(a); } while (a[0] >= limit);
      return 1 + a[0] % size;
    }
    return 1 + Math.floor(Math.random() * size); // non-secure browser fallback
  }
  function refreshTrial() {
    const {g, n, k, points} = statState, P = mul(k,g);
    $("statTrial").innerHTML = `<strong>k = ${k}, G = ${show(g)} → Q = ${show(P)}</strong>
      <span class="mini">Repeating the experiment for every valid key k = 1 … ${n-1} (G has order ${n}, so ${n}G = O):</span>
      <div class="chips">${points.map((Q,i)=>`<span class="chip${i+1===k?" cur":""}"><b>k = ${i+1}</b>${show(Q)}</span>`).join("")}</div>`;
  }
  function distExperiment() {
    const pts=statState.points, n=pts.length, xs=pts.map(P=>P[0]), ys=pts.map(P=>P[1]);
    const coordPts=statState.coordSample.map(i=>pts[i]), coordX=coordPts.map(P=>P[0]), coordY=coordPts.map(P=>P[1]);
    const N=coordPts.length, cx=count(coordX,17),cy=count(coordY,17);
    const hx=count(xs,17),hy=count(ys,17),labs=Array.from({length:17},(_,i)=>String(i));
    const ux=new Set(xs).size,uy=new Set(ys).size;
    const uniX=hx.every(v=>v===hx[0]), uniY=hy.every(v=>v===hy[0]);
    $("simpleDist").innerHTML=`
      <div class="charts">${barsChart("How often each X value occurs",labs,[{values:hx,cls:"s1"}])}${barsChart("How often each Y value occurs",labs,[{values:hy,cls:"s2"}])}</div>
      <div class="tablewrap"><table class="grid-table compact"><thead><tr><th>Measure</th><th>X</th><th>Y</th></tr></thead><tbody>
        <tr><td>Different values</td><td>${ux} of 17</td><td>${uy} of 17</td></tr>
        <tr><td>Mean</td><td>${mean(xs).toFixed(2)}</td><td>${mean(ys).toFixed(2)}</td></tr>
        <tr><td>Population variance</td><td>${popVar(xs).toFixed(2)}</td><td>${popVar(ys).toFixed(2)}</td></tr>
      </tbody></table></div>
      <div class="stat-method"><b>What did we do?</b> We first listed every finite point once: that gives the exact distribution of X and Y. We then generated ${N} random private keys and counted their coordinates, including repetitions.<br><b>How to read the result?</b> The histograms show the exact possible coordinate values. The table below shows how often those values reappear in random draws.</div>
      <details class="stat-details"><summary>View coordinate frequencies from ${N} random keys</summary>
        <div class="tablewrap"><table class="grid-table compact"><thead><tr><th>Coordinate</th><th>Exact X</th><th>Sample X</th><th>Exact Y</th><th>Sample Y</th></tr></thead><tbody>${labs.map((v,i)=>`<tr><td>${v}</td><td>${hx[i]}</td><td>${cx[i]}</td><td>${hy[i]}</td><td>${cy[i]}</td></tr>`).join('')}</tbody></table></div></details>
      <details class="stat-details"><summary>View the ${n} points used in the analysis</summary><div class="tablewrap"><table class="grid-table compact"><thead><tr><th>k</th><th>Q = kG</th><th>X</th><th>Y</th></tr></thead><tbody>${pts.map((P,i)=>`<tr><td>${i+1}</td><td>${show(P)}</td><td>${P[0]}</td><td>${P[1]}</td></tr>`).join("")}</tbody></table></div></details>
      ${statnote(`Among the <b>${n}</b> different public points, X takes <b>${ux}</b> values and Y takes <b>${uy}</b>, out of 17 possible values. In ${N} random draws we again found <b>${new Set(coordX).size}</b> X values and <b>${new Set(coordY).size}</b> Y values. The average X of the exact points is <b>${mean(xs).toFixed(2)}</b> and the average Y is <b>${mean(ys).toFixed(2)}</b>.`, `The numbers reveal a simple fact: <b>different public points can share the same coordinate</b>. That is why some bars are taller and others remain at zero. Repeating the experiment with random keys can change the heights of the bars but cannot create coordinate values absent from the selected base point's subgroup. We are describing the coordinates, not testing cryptographic security.`)}`;
  }
  function uniformExperiment() {
    const {n,points,sample}=statState, freq=count(sample,n-1), expected=sample.length/(n-1);
    const min=Math.min(...freq),max=Math.max(...freq);
    const diffs=freq.map(v=>v-expected),largest=Math.max(...diffs.map(Math.abs));
    const allRows=points.map((P,i)=>`<tr><td>${i+1}G = ${show(P)}</td><td>${freq[i]}</td><td>${expected.toFixed(2)}</td><td>${(100*freq[i]/sample.length).toFixed(1)}%</td></tr>`).join('');
    $("statUniform").innerHTML=`
      <div class="stat-method"><b>What did we do?</b> We drew ${sample.length} random private keys, computed Q = kG and counted each public point. The same point can be drawn many times.<br>
        <b>What is the comparison?</b> Since there are ${n-1} valid finite points, the expected count per point is ${sample.length} ÷ ${n-1} ≈ <b>${expected.toFixed(2)}</b>. Equal probabilities do not guarantee equal observed counts. An expected count is an average prediction, not a mandatory result.</div>
      <div class="tablewrap"><table class="grid-table compact"><thead><tr><th>Public point</th><th>Observed count</th><th>Expected count</th><th>Observed share</th></tr></thead><tbody>
        ${allRows}<tr class="hlrow"><td><b>Total</b></td><td><b>${sample.length}</b></td><td>${sample.length}</td><td>100%</td></tr>
      </tbody></table></div>
      ${statnote(`Out of ${sample.length} draws, individual points appeared between <b>${min}</b> and <b>${max}</b> times. The expected number per point is <b>${expected.toFixed(2)}</b>. The largest absolute deviation from that expected count is <b>${largest.toFixed(2)}</b>.`,
        `All valid keys are drawn with the same probability, so all finite public points have the same theoretical chance of appearing. In a finite sample, however, the counts need not be identical. This difference between expected and observed frequencies is an ordinary feature of random sampling. Press the button to draw a new set of keys: the numbers change, while the theoretical probabilities remain the same.`)}`;
  }
  function bitExperiment() {
    const pts=statState.points,n=pts.length,N=statState.bitSample.length;
    const exactX=Array(5).fill(0),exactY=Array(5).fill(0);
    const sampleX=Array(5).fill(0),sampleY=Array(5).fill(0);
    const addBits=(P,bx,by)=>{for(let j=0;j<5;j++){bx[j]+=(P[0]>>(4-j))&1;by[j]+=(P[1]>>(4-j))&1;}};
    pts.forEach(P=>addBits(P,exactX,exactY));
    statState.bitSample.forEach(i=>addBits(pts[i],sampleX,sampleY));
    const pc=(count,total)=>(100*count/total).toFixed(1)+'%';
    const valRows=pts.map(([x,y],i)=>`<tr><td>${i+1}</td><td>${show([x,y])}</td><td><code>${bin5(x)}</code></td><td><code>${bin5(y)}</code></td></tr>`).join('');
    const bitRows=Array.from({length:5},(_,j)=>`<tr>
      <td>b${4-j} (value ${2**(4-j)})</td>
      <td>${exactX[j]}/${n} (${pc(exactX[j],n)})</td>
      <td>${sampleX[j]}/${N} (${pc(sampleX[j],N)})</td>
      <td>${exactY[j]}/${n} (${pc(exactY[j],n)})</td>
      <td>${sampleY[j]}/${N} (${pc(sampleY[j],N)})</td></tr>`).join('');
    const mostX=Math.max(...exactX),leastX=Math.min(...exactX),mostY=Math.max(...exactY),leastY=Math.min(...exactY);
    $('simpleBits').innerHTML=`
      <div class="stat-method"><b>What are we studying?</b> A bit is a binary digit, 0 or 1. Each coordinate is written on five bits, from <b>b4</b> (worth 16) to <b>b0</b> (worth 1). For example, 5 = 00101.<br>
      <b>Why use 240 keys?</b> Repeated random draws make the observation more representative of the possible outputs. There are still only <b>${n} distinct finite points</b>: we observe them many times rather than creating new ones.<br>
      <b>How to read the table?</b> For each position, 50% means that the bit is 1 about half of the time. Comparing the “exact” and “sample” columns shows how random repetitions change the percentages.</div>
      <div class="tablewrap"><table class="grid-table compact bit-frequency-table"><thead><tr><th>Bit position</th><th>X: all ${n} points</th><th>X: ${N} draws</th><th>Y: all ${n} points</th><th>Y: ${N} draws</th></tr></thead><tbody>${bitRows}</tbody></table></div>
      <details class="stat-details"><summary>See the ${n} distinct points written in binary</summary><div class="tablewrap"><table class="grid-table compact bit-data-table"><thead><tr><th>k</th><th>Point</th><th>X (binary)</th><th>Y (binary)</th></tr></thead><tbody>${valRows}</tbody></table></div></details>
      <div class="stat-reading"><p><b>Observation.</b> Across all ${n} distinct public points, the number of 1s ranges from <b>${leastX} to ${mostX}</b> for X and from <b>${leastY} to ${mostY}</b> for Y, depending on the bit position. For example, the leftmost bit b4 of X is 1 for <b>${exactX[0]} of ${n}</b> different points, compared with <b>${sampleX[0]} of ${N}</b> random draws. Other positions can have quite different percentages.</p>
      <p><b>What does this mean?</b> The table shows which output bits occur often and which are rare. A balanced bit would be 1 around half the time; <b>not every bit is balanced here</b>. For example, b4 is 1 only if a coordinate is 16 because all coordinates are between 0 and 16. The 240 draws help us see this pattern repeatedly, but we still generate points from the same small set. This is a description of bit frequencies, not a test of key security.</p></div>`;
  }
  // One-bit example: a short guided animation, not a statistical test.
  let avalancheTimer=null,avalanchePhase=0,avalanchePair=null;
  const stopAvalanche=()=>{if(avalancheTimer){clearInterval(avalancheTimer);avalancheTimer=null;} };
  function chooseAvalanchePair() {
    const {g,n,k}=statState,pairs=[];
    for(let u=1;u<n;u++) for(let bit=0;bit<5;bit++){
      const v=u^(1<<bit);if(v>u&&v<n&&v>=1)pairs.push([u,v]);
    }
    const keys=pairs.find(t=>t.includes(k))||pairs[0];
    const [u,v]=keys;
    return {u,v,P:mul(u,g),Q:mul(v,g)};
  }
  function renderAvalanchePhase(){
    const {u,v,P,Q}=avalanchePair, a=bin5(P[0])+bin5(P[1]),b=bin5(Q[0])+bin5(Q[1]);
    const inpWidth=5,ki=u.toString(2).padStart(inpWidth,'0'),kj=v.toString(2).padStart(inpWidth,'0');
    const marks=(s,t,highlight)=>[...s].map((bit,i)=>`<span class="aval-bit${highlight&&bit!==t[i]?' changed':''}">${bit}</span>`).join('');
    const diff=bitsChanged(a,b);
    const texts=[
      'Start with two private keys. We will change just one input bit.',
      `Compare the private keys: exactly <b>one</b> input bit is different.`,
      `Compute both public points: ${show(P)} and ${show(Q)}.`,
      `Compare their 10-bit encodings: <b>${diff} out of 10</b> output bits differ.`,
    ];
    $('avalScene').innerHTML=`<div class="aval-stage"><div class="aval-col"><span class="guide-tag">Private key A</span><strong>k = ${u}</strong><div class="aval-bits">${marks(ki,kj,avalanchePhase>=1)}</div></div><span class="aval-arrow">→</span><div class="aval-col"><span class="guide-tag">Private key B</span><strong>k = ${v}</strong><div class="aval-bits">${marks(kj,ki,avalanchePhase>=1)}</div></div></div>
      ${avalanchePhase>=2?`<div class="aval-stage outputs"><div class="aval-col"><span class="guide-tag">Public point A</span><strong>${show(P)}</strong><div class="aval-bits">${marks(a,b,avalanchePhase>=3)}</div></div><span class="aval-arrow">→</span><div class="aval-col"><span class="guide-tag">Public point B</span><strong>${show(Q)}</strong><div class="aval-bits">${marks(b,a,avalanchePhase>=3)}</div></div></div>`:''}
      <div class="aval-caption"><b>Step ${avalanchePhase+1} of 4.</b> ${texts[avalanchePhase]}</div>`;
    $('avalNext').disabled=avalanchePhase===3;
    $('avalPlay').textContent=avalancheTimer?'Pause animation':'Play animation';
    $('avalFinding').innerHTML=avalanchePhase>=3 ? statnote(`In the animated example, flipping just one input bit changed <b>${diff} of 10</b> output bits.`, `The highlighted bits explain exactly what happened for this pair. The comparison table below gives a wider view of the possible changes. In a cryptographic hash, the ideal is that about half of the output bits change on average; elliptic-curve multiplication is designed for a different purpose. Here we are simply observing sensitivity to the input.`):'';
  }
  function avalancheExperiment() {
    stopAvalanche();avalanchePhase=0;avalanchePair=chooseAvalanchePair();
    const {g,n}=statState, comparisons=[];
    for(let u=1;u<n;u++) for(let j=0;j<5;j++){
      const v=u^(1<<j);
      if(v>u&&v<n) {const A=mul(u,g),B=mul(v,g);
        comparisons.push({u,v,changed:bitsChanged(bin5(A[0])+bin5(A[1]),bin5(B[0])+bin5(B[1]))});}
    }
    const avg=comparisons.reduce((a,b)=>a+b.changed,0)/comparisons.length;
    const examples=comparisons.slice(0,Math.min(8,comparisons.length));
    $('simpleAvalanche').innerHTML=`<div class="stat-method"><b>What did we do?</b> First we change one bit in a key and watch the new public point appear step by step. Then, instead of relying on just one example, we compare all <b>${comparisons.length}</b> valid pairs of keys that differ by exactly one bit. We count changes in the 10-bit representation of X and Y.</div>
      <div class="controls aval-controls"><button id="avalNext">Next step →</button><button id="avalPlay" class="secondary">Play animation</button><button id="avalReset" class="secondary">Reset</button></div><div id="avalScene" aria-live="polite"></div><div id="avalFinding"></div>
      <div class="tablewrap"><table class="grid-table compact"><thead><tr><th>Key A</th><th>Key B</th><th>Input bits changed</th><th>Output bits changed (of 10)</th></tr></thead><tbody>${examples.map(t=>`<tr><td>${t.u}</td><td>${t.v}</td><td>1</td><td>${t.changed}</td></tr>`).join('')}</tbody></table></div>
      <div class="stat-reading"><p><b>Observation across multiple pairs.</b> Among ${comparisons.length} valid one-bit changes, the number of output bits that changed ranged from <b>${Math.min(...comparisons.map(t=>t.changed))}</b> to <b>${Math.max(...comparisons.map(t=>t.changed))}</b>. The average was <b>${avg.toFixed(2)} out of 10</b>. The table shows ${examples.length} examples.</p><p><b>What does it mean?</b> One input-bit change can affect several output bits, but the number varies from pair to pair. Hash functions are designed so that roughly half their output bits change on average; our tiny elliptic-curve experiment does not need to match that benchmark. It cannot tell us whether a real elliptic-curve key can be recovered.</p></div>`;
    $('avalNext').onclick=()=>{stopAvalanche();avalanchePhase=Math.min(3,avalanchePhase+1);renderAvalanchePhase();};
    $('avalReset').onclick=()=>{stopAvalanche();avalanchePhase=0;renderAvalanchePhase();};
    $('avalPlay').onclick=()=>{
      if(avalancheTimer){stopAvalanche();renderAvalanchePhase();return;}
      if(avalanchePhase>=3)avalanchePhase=0;
      avalancheTimer=setInterval(()=>{avalanchePhase=Math.min(3,avalanchePhase+1);if(avalanchePhase===3)stopAvalanche();renderAvalanchePhase();},1250);
      renderAvalanchePhase();
    };
    renderAvalanchePhase();
  }
  function renderOverallFinding() {
    const {n,g,points,sample}=statState;
    const sx=points.map(P=>P[0]),sy=points.map(P=>P[1]);
    const ux=new Set(sx).size, uy=new Set(sy).size;
    const freq=count(sample,n-1);
    const expected=sample.length/(n-1);
    const pairResults=[];
    for(let u=1;u<n;u++) for(let bit=0;bit<5;bit++) {
      const v=u^(1<<bit);
      if(v>u && v<n) {
        const A=mul(u,g),B=mul(v,g);
        pairResults.push(bitsChanged(bin5(A[0])+bin5(A[1]),bin5(B[0])+bin5(B[1])));
      }
    }
    const avg=pairResults.reduce((a,b)=>a+b,0)/pairResults.length;
    const exactX=Array(5).fill(0),exactY=Array(5).fill(0);
    points.forEach(([x,y])=>{for(let j=0;j<5;j++) {
      exactX[j]+=(x>>(4-j))&1;
      exactY[j]+=(y>>(4-j))&1;
    }});
    const unbalanced=exactX.concat(exactY).filter(v=>v*2!==n-1).length;
    $('overallFinding').innerHTML=`<div class="conclusion-guide">
      <p class="conclusion-intro"><b>In recap, here is what we observed in our experiments:</b></p>
      <div class="conclusion-property">
        <h3>1. The coordinates are not spread out equally</h3>
        <p>We first looked at the X and Y coordinates of the points produced by our algorithm. With the selected point G = ${show(g)}, we obtained <b>${n-1} different public points</b>, but only <b>${ux} different X values</b> and <b>${uy} different Y values</b>.</p>
        <p>This tells us that some coordinate values appear more than once, while others do not appear at all. So, even though the algorithm produces different points, their coordinates are not necessarily distributed evenly. <b>This does not mean that the algorithm is working incorrectly:</b> it simply shows that the points follow the rules of our curve rather than being chosen as arbitrary pairs of numbers.</p>
      </div>
      <div class="conclusion-property">
        <h3>2. Random keys do not give perfectly equal counts</h3>
        <p>Next, we generated <b>${sample.length} random private keys</b> and counted how many times each public point appeared. If the points appeared in exactly equal numbers, we would see about <b>${expected.toFixed(1)} appearances per point</b>. In our experiment, the counts actually ranged from <b>${Math.min(...freq)}</b> to <b>${Math.max(...freq)}</b>.</p>
        <p>At first, these differences might seem surprising. But random choices do not mean that every result must occur the same number of times in a small experiment. <b>For our algorithm, the important observation is that every possible finite public point has the same chance of appearing when we choose the valid keys equally often.</b> The small differences in our table come from the random selection of keys, not from one point being preferred by the multiplication itself.</p>
      </div>
      <div class="conclusion-property">
        <h3>3. Some output bits appear more often than others</h3>
        <p>We also looked inside the coordinates by writing them as sequences of zeros and ones. Across our <b>${n-1} different points</b>, the first bit of X was 1 in <b>${exactX[0]}</b> cases, and the first bit of Y was 1 in <b>${exactY[0]}</b> cases. We then repeated the observation using more randomly selected keys.</p>
        <p>This helped us see that not every bit position behaves in the same way. Some positions contain more zeros, while others contain more ones. That is understandable because our curve works with only a few small numbers, so there are limits to which binary combinations can occur.</p>
      </div>
      <div class="conclusion-property">
        <h3>4. A tiny change in the key can change the public point</h3>
        <p>Finally, we changed just <b>one bit of a private key</b> and compared the public point before and after the change. Looking at <b>${pairResults.length} valid pairs</b>, we found that an average of <b>${avg.toFixed(1)} of the 10 output bits</b> changed. The number was not the same for every pair.</p>
        <p>We can therefore see that even a very small change in the input may give a noticeably different result. However, <b>this does not mean that every bit of the output changes</b>, nor that our algorithm behaves exactly like a cryptographic hash. Hash functions are specifically designed to spread small input changes widely across their outputs. For elliptic-curve multiplication, this experiment is useful for observing sensitivity to changes, but it is not the main measure of security.</p>
      </div>

    </div>`;
  }
  function renderStatExperiments() {distExperiment();uniformExperiment();bitExperiment();avalancheExperiment();renderOverallFinding();}
  function updateStatBase() {
    const [x,y]=$("statBase").value.split(",").map(Number), g=[x,y], n=order(g);
    statState.g=g;statState.n=n;statState.points=cycle(g).slice(1);
    $("statKey").max=n-1;statState.k=Math.min(Math.max(1,+$("statKey").value||6),n-1);$("statKey").value=statState.k;
    statState.sample=Array.from({length:240},()=>selectRandomKey(n)-1);
    statState.bitSample=Array.from({length:240},()=>selectRandomKey(n)-1);
    statState.coordSample=Array.from({length:240},()=>selectRandomKey(n)-1);
    refreshTrial();renderStatExperiments();
  }
  /* ---------- wiring ---------- */
  const refreshAll = () => { stopPlay(); renderStep(0); };
  $("next").onclick = () => { stopPlay(); renderStep(currentStep + 1); };
  $("prev").onclick = () => { stopPlay(); renderStep(currentStep - 1); };
  $("reset").onclick = () => { stopPlay(); renderStep(0); };
  $("play").onclick = play;
  $("rcAdd").onclick = () => drawRealCurve("add");
  $("rcDbl").onclick = () => drawRealCurve("dbl");
  $("speed").oninput = () => ($("speedLbl").textContent = $("speed").value + " ms/step");
  $("speed").oninput(); drawRealCurve("add"); renderIdea(); refreshAll();
  $("statBase").onchange=updateStatBase;
  $("statTry").onclick=()=>{statState.k=Math.min(Math.max(1,Number($("statKey").value)||1),statState.n-1);$("statKey").value=statState.k;refreshTrial();renderStatExperiments();};
  $("statCoordDraw").onclick=()=>{statState.coordSample=Array.from({length:240},()=>selectRandomKey(statState.n)-1);distExperiment();};
  $("statDraw").onclick=()=>{statState.sample=Array.from({length:240},()=>selectRandomKey(statState.n)-1);uniformExperiment();renderOverallFinding();};
  $("statBitDraw").onclick=()=>{statState.bitSample=Array.from({length:240},()=>selectRandomKey(statState.n)-1);bitExperiment();};
  updateStatBase();
}
