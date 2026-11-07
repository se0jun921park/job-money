(function () {
  "use strict";

  const D = window.CareerData;
  const M = window.CareerModel;
  const START = M.START_AGE;
  const END = M.RETIRE_AGE;
  const MAX_PICK = 3;
  const SLOTS = ["var(--s1)", "var(--s2)", "var(--s3)"];
  const RACE_SECONDS = 12; // full 18→65 run at 1×
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const byId = Object.fromEntries(D.CAREERS.map((c) => [c.id, c]));

  const state = {
    picks: [], // [{ id, slot }]; slot index into SLOTS, kept stable for each career
    schoolType: "public",
    borrowShare: 1,
    repayYears: 10,
    afterTax: false,
    mode: "net",
    age: END,
    playing: false,
    speed: 1,
    sort: { key: "net", dir: -1 },
    hoverAge: null,
  };
  let results = {}; // id -> simulation result
  let lastFrame = 0;

  const $ = (sel) => document.querySelector(sel);
  const els = {
    grid: $("#career-grid"),
    hint: $("#picker-hint"),
    borrow: $("#borrow"),
    borrowOut: $("#borrow-out"),
    repay: $("#repay"),
    chart: $("#chart"),
    chartWrap: $("#chart-wrap"),
    chartSub: $("#chart-sub"),
    tooltip: $("#tooltip"),
    ageValue: $("#age-value"),
    play: $("#play"),
    playIcon: $("#play-icon"),
    playText: $("#play-text"),
    scrub: $("#scrub"),
    speed: $("#speed"),
    board: $("#board"),
    notes: $("#race-notes"),
    cards: $("#cards"),
    table: $("#table"),
    sources: $("#sources"),
  };

  /* ---------- formatting ---------- */

  function money(v, opts = {}) {
    const sign = v < 0 ? "−" : "";
    const a = Math.abs(v);
    if (opts.full) return sign + "$" + Math.round(a).toLocaleString("en-US");
    if (a >= 1e6) return sign + "$" + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + "M";
    if (a >= 1e3) return sign + "$" + Math.round(a / 1e3) + "K";
    return sign + "$" + Math.round(a);
  }
  function tickMoney(v) {
    const sign = v < 0 ? "−" : "";
    const a = Math.abs(v);
    if (a === 0) return "$0";
    if (a >= 1e6) return sign + "$" + +(a / 1e6).toFixed(1) + "M";
    if (a >= 1e3) return sign + "$" + +(a / 1e3).toFixed(0) + "K";
    return sign + "$" + a;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function yrs(n) {
    return n + (n === 1 ? " yr" : " yrs");
  }
  function ageText(a) {
    return a == null ? "—" : String(Math.round(a));
  }

  /* ---------- model ---------- */

  function opts() {
    return {
      schoolType: state.schoolType,
      borrowShare: state.borrowShare,
      repayYears: state.repayYears,
      afterTax: state.afterTax,
    };
  }
  function recompute() {
    results = {};
    for (const c of D.CAREERS) results[c.id] = M.simulate(c, D, opts());
  }
  function seriesValues(r) {
    if (state.mode === "net") return r.position; // 48 points, ages 18..65
    const v = r.years.map((y) => y.income);
    v.push(v[v.length - 1]);
    return v;
  }
  function valueAt(values, age) {
    const f = Math.max(0, Math.min(values.length - 1, age - START));
    const i = Math.floor(f);
    const t = f - i;
    if (i >= values.length - 1) return values[values.length - 1];
    return values[i] + (values[i + 1] - values[i]) * t;
  }
  function phaseAt(r, age) {
    const y = r.years[Math.min(r.years.length - 1, Math.max(0, Math.floor(age) - START))];
    if (y.phase === "school") return "in school";
    if (y.phase === "training") return r.career.training.label;
    return "working";
  }

  /* ---------- picker ---------- */

  function slotOf(id) {
    const p = state.picks.find((x) => x.id === id);
    return p ? p.slot : -1;
  }
  function togglePick(id) {
    const i = state.picks.findIndex((p) => p.id === id);
    if (i >= 0) {
      state.picks.splice(i, 1);
    } else {
      if (state.picks.length >= MAX_PICK) {
        els.hint.textContent = "You can compare 3 at a time. Remove one to add another.";
        els.hint.classList.add("warn");
        return;
      }
      const used = new Set(state.picks.map((p) => p.slot));
      let slot = 0;
      while (used.has(slot)) slot++;
      state.picks.push({ id, slot });
      if (!reduceMotion.matches) startRace(true);
    }
    writeHash();
    renderAll();
  }

  function renderPicker() {
    els.grid.textContent = "";
    for (const c of D.CAREERS) {
      const r = results[c.id];
      const slot = slotOf(c.id);
      const full = state.picks.length >= MAX_PICK && slot < 0;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "career";
      b.id = "pick-" + c.id;
      b.setAttribute("aria-pressed", String(slot >= 0));
      if (full) b.setAttribute("aria-disabled", "true");
      if (slot >= 0) b.style.setProperty("--slot", SLOTS[slot]);
      const training = r.trainingYears ? ` + ${r.trainingYears} ${c.training.label.split(" ")[0]}` : "";
      b.innerHTML =
        `<span class="check" aria-hidden="true"><svg viewBox="0 0 10 10"><path d="M1.8 5.2l2.2 2.2 4.2-4.6"/></svg></span>` +
        `<span class="career-name"></span>` +
        `<span class="career-meta"></span>` +
        `<span class="career-pay"></span>`;
      b.querySelector(".career-name").textContent = c.name;
      b.querySelector(".career-meta").textContent = `${yrs(r.schoolYears)} school${training}`;
      b.querySelector(".career-pay").textContent = `${money(c.startSalary)} → ${money(c.peakSalary)}`;
      b.addEventListener("click", () => togglePick(c.id));
      els.grid.appendChild(b);
    }
    els.hint.classList.remove("warn");
    els.hint.textContent = `${state.picks.length} of ${MAX_PICK} selected`;
  }

  /* ---------- chart ---------- */

  let geom = null;

  function niceStep(span, target) {
    const raw = span / target;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    const step = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
    return step * mag;
  }

  function valueRange(upto) {
    let lo = 0, hi = 0;
    for (const p of state.picks) {
      const vals = seriesValues(results[p.id]);
      const last = Math.min(vals.length - 1, Math.floor(upto - START));
      for (let i = 0; i <= last; i++) { lo = Math.min(lo, vals[i]); hi = Math.max(hi, vals[i]); }
      const v = valueAt(vals, upto);
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    return [lo, hi];
  }

  function computeGeom() {
    const w = els.chartWrap.clientWidth || 800;
    const h = els.chart.clientHeight || 360;
    const narrow = w < 560;
    const m = { top: 14, right: narrow ? 92 : 150, bottom: 28, left: narrow ? 46 : 58 };
    // The y-range follows the race: it covers only the ages run so far,
    // so the axis grows as the leaders pull away.
    const [rawLo, rawHi] = valueRange(state.age);
    const floor = state.mode === "net" ? 500000 : 100000;
    let lo = rawLo < 0 ? rawLo * 1.12 : 0;
    let hi = Math.max(rawHi * 1.08, floor);
    const step = niceStep(hi - lo, narrow ? 4 : 5);
    if (state.age >= END) {
      hi = Math.max(rawHi * 1.02, floor);
      lo = Math.floor(lo / step) * step;
      hi = Math.ceil(hi / step) * step;
    }
    const ticks = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-6; v += step) ticks.push(Math.round(v));
    const iw = w - m.left - m.right;
    const ih = h - m.top - m.bottom;
    geom = {
      w, h, m, narrow, iw, ih, lo, hi, ticks,
      x: (age) => m.left + ((age - START) / (END - START)) * iw,
      y: (v) => m.top + (1 - (v - lo) / (hi - lo)) * ih,
      age: (px) => START + ((px - m.left) / iw) * (END - START),
    };
  }

  function pathFor(values, upto) {
    const g = geom;
    const last = Math.floor(upto - START);
    let d = "";
    for (let i = 0; i <= Math.min(last, values.length - 1); i++) {
      d += (i ? "L" : "M") + g.x(START + i).toFixed(1) + " " + g.y(values[i]).toFixed(1);
    }
    if (upto - START > last && last < values.length - 1) {
      d += "L" + g.x(upto).toFixed(1) + " " + g.y(valueAt(values, upto)).toFixed(1);
    }
    return d;
  }

  function placeLabels(items, minGap, lo, hi) {
    // items: [{ y }], returns adjusted label y keeping order, min spacing, in bounds
    const s = items.slice().sort((a, b) => a.y - b.y);
    for (let i = 0; i < s.length; i++) {
      s[i].ly = Math.max(s[i].y, lo + minGap / 2);
      if (i > 0 && s[i].ly - s[i - 1].ly < minGap) s[i].ly = s[i - 1].ly + minGap;
    }
    for (let i = s.length - 1; i >= 0; i--) {
      const max = i === s.length - 1 ? hi - minGap / 2 : s[i + 1].ly - minGap;
      if (s[i].ly > max) s[i].ly = max;
    }
    return items;
  }

  function renderChart() {
    const svg = els.chart;
    if (!geom) computeGeom();
    const g = geom;
    svg.setAttribute("viewBox", `0 0 ${g.w} ${g.h}`);
    if (!state.picks.length) {
      svg.innerHTML = `<text x="${g.w / 2}" y="${g.h / 2}" text-anchor="middle" class="tick">Pick a career above to start the race.</text>`;
      return;
    }
    let out = "";

    // grid + y ticks
    out += `<g class="grid">`;
    for (const t of g.ticks) {
      const y = g.y(t).toFixed(1);
      if (t !== 0) out += `<line x1="${g.m.left}" x2="${g.m.left + g.iw}" y1="${y}" y2="${y}"/>`;
      out += `<text class="tick" x="${g.m.left - 8}" y="${y}" dy="0.32em" text-anchor="end">${tickMoney(t)}</text>`;
    }
    out += `</g>`;
    // x ticks
    for (let a = 20; a <= END; a += g.narrow ? 10 : 5) {
      out += `<text class="tick" x="${g.x(a).toFixed(1)}" y="${g.h - 8}" text-anchor="middle">${a}</text>`;
    }
    out += `<line class="zero" x1="${g.m.left}" x2="${g.m.left + g.iw}" y1="${g.y(0).toFixed(1)}" y2="${g.y(0).toFixed(1)}"/>`;

    // progress marker
    if (state.age < END) {
      const x = g.x(state.age).toFixed(1);
      out += `<line class="marker-line" x1="${x}" x2="${x}" y1="${g.m.top}" y2="${g.m.top + g.ih}"/>`;
    }

    // series
    const ends = [];
    for (const p of state.picks) {
      const r = results[p.id];
      const vals = seriesValues(r);
      const col = SLOTS[p.slot];
      out += `<path class="series-line" style="stroke:${col}" d="${pathFor(vals, state.age)}"/>`;
      const v = valueAt(vals, state.age);
      ends.push({ p, r, v, col, x: g.x(state.age), y: g.y(v) });
    }
    placeLabels(ends, 32, g.m.top, g.m.top + g.ih + 10);
    for (const e of ends) {
      const lx = e.x + 12;
      if (Math.abs(e.ly - e.y) > 4) {
        out += `<path class="leader" d="M${(e.x + 5).toFixed(1)} ${e.y.toFixed(1)}L${(lx - 3).toFixed(1)} ${e.ly.toFixed(1)}"/>`;
      }
      out += `<circle class="end-dot" style="fill:${e.col}" cx="${e.x.toFixed(1)}" cy="${e.y.toFixed(1)}" r="5"/>`;
      out += `<text class="end-label" x="${lx.toFixed(1)}" y="${(e.ly - 3).toFixed(1)}">${esc(g.narrow ? e.r.career.short : e.r.career.name)}` +
        `<tspan class="val" x="${lx.toFixed(1)}" dy="15">${money(e.v)}</tspan></text>`;
    }

    // hover layer
    if (state.hoverAge != null) {
      const a = state.hoverAge;
      const x = g.x(a).toFixed(1);
      out += `<line class="crosshair" x1="${x}" x2="${x}" y1="${g.m.top}" y2="${g.m.top + g.ih}"/>`;
      for (const p of state.picks) {
        const v = valueAt(seriesValues(results[p.id]), a);
        out += `<circle class="hover-dot" style="fill:${SLOTS[p.slot]}" cx="${x}" cy="${g.y(v).toFixed(1)}" r="4.5"/>`;
      }
    }
    svg.innerHTML = out;
  }

  function renderTooltip() {
    const tt = els.tooltip;
    if (state.hoverAge == null || !state.picks.length) { tt.hidden = true; return; }
    const a = state.hoverAge;
    const rows = state.picks
      .map((p) => ({ p, r: results[p.id], v: valueAt(seriesValues(results[p.id]), a) }))
      .sort((x, y) => y.v - x.v);
    tt.textContent = "";
    const head = document.createElement("div");
    head.className = "tt-age";
    head.textContent = state.mode === "net" ? `Net earnings by age ${a}` : `Pay at age ${a}`;
    tt.appendChild(head);
    for (const row of rows) {
      const el = document.createElement("div");
      el.className = "tt-row";
      const key = document.createElement("span");
      key.className = "tt-key";
      key.style.background = SLOTS[row.p.slot];
      const val = document.createElement("span");
      val.className = "tt-val";
      val.textContent = money(row.v, { full: true });
      const name = document.createElement("span");
      name.className = "tt-name";
      name.textContent = row.r.career.name + " ";
      const ph = document.createElement("span");
      ph.className = "tt-phase";
      ph.textContent = "· " + phaseAt(row.r, a);
      name.appendChild(ph);
      el.append(key, val, name);
      tt.appendChild(el);
    }
    tt.hidden = false;
    const g = geom;
    const x = g.x(a);
    const tw = tt.offsetWidth;
    let left = x + 14;
    if (left + tw > g.w) left = x - tw - 14;
    tt.style.transform = `translate(${Math.max(0, left)}px, ${g.m.top + 4}px)`;
  }

  /* ---------- standings board ---------- */

  function boardDomain() {
    const [lo, hi] = valueRange(state.age);
    return [lo, Math.max(hi, state.mode === "net" ? 500000 : 100000)];
  }

  function renderBoard() {
    const board = els.board;
    const rowH = 38;
    board.style.height = Math.max(0, state.picks.length * rowH) + "px";
    board.hidden = !state.picks.length;
    // keep one DOM row per career so transforms animate between ranks
    const existing = new Map([...board.children].map((n) => [n.dataset.id, n]));
    for (const [id, n] of existing) if (!state.picks.some((p) => p.id === id)) n.remove();
    const rows = state.picks
      .map((p) => ({ p, r: results[p.id], v: valueAt(seriesValues(results[p.id]), state.age) }))
      .sort((a, b) => b.v - a.v);
    const [lo, hi] = boardDomain();
    rows.forEach((row, rank) => {
      let n = existing.get(row.p.id);
      if (!n) {
        n = document.createElement("div");
        n.className = "board-row";
        n.dataset.id = row.p.id;
        n.innerHTML = `<span class="board-rank"></span><span class="board-name"></span>` +
          `<span class="board-track"><span class="board-zero"></span><span class="board-bar"></span><span class="board-val"></span></span>`;
        n.style.transform = `translateY(${rank * rowH}px)`;
        board.appendChild(n);
      }
      n.style.transform = `translateY(${rank * rowH}px)`;
      n.querySelector(".board-rank").textContent = rank + 1;
      n.querySelector(".board-name").textContent = geom && geom.narrow ? row.r.career.short : row.r.career.name;
      const track = n.querySelector(".board-track");
      const tw = track.clientWidth || 300;
      const pad = tw < 220 ? 58 : 70; // room for the value label at either end
      const span = Math.max(1, tw - pad * (lo < 0 ? 2 : 1));
      const sx = (v) => (lo < 0 ? pad : 0) + ((v - lo) / (hi - lo)) * span;
      const x0 = sx(0);
      const x1 = sx(row.v);
      const bar = n.querySelector(".board-bar");
      bar.style.left = Math.min(x0, x1) + "px";
      bar.style.width = Math.max(0, Math.abs(x1 - x0)) + "px";
      bar.style.background = SLOTS[row.p.slot];
      // 4px rounded data-end, square at the zero baseline
      bar.style.borderRadius = row.v >= 0 ? "0 4px 4px 0" : "4px 0 0 4px";
      n.querySelector(".board-zero").style.left = x0 + "px";
      const val = n.querySelector(".board-val");
      val.textContent = money(row.v);
      if (row.v >= 0) { val.style.left = x1 + 8 + "px"; val.style.right = "auto"; }
      else { val.style.left = "auto"; val.style.right = tw - x1 + 8 + "px"; }
    });
  }

  /* ---------- race notes ---------- */

  function renderNotes() {
    const picks = state.picks.map((p) => results[p.id]);
    els.notes.textContent = "";
    if (picks.length < 2) {
      els.notes.textContent = picks.length ? "Add another career to see who pulls ahead." : "";
      return;
    }
    const ranked = picks.slice().sort((a, b) => b.netLifetime - a.netLifetime);
    const parts = [];
    const strong = (t) => { const s = document.createElement("strong"); s.textContent = t; return s; };
    const frag = document.createDocumentFragment();
    frag.append(strong(ranked[0].career.name), ` finishes first with ${money(ranked[0].netLifetime)}. `);
    for (let i = 0; i < ranked.length - 1; i++) {
      const a = ranked[i], b = ranked[i + 1];
      // last age at which a was behind b
      let behind = -1;
      for (let k = 0; k < a.position.length; k++) if (a.position[k] < b.position[k] - 0.5) behind = k;
      const gap = money(a.netLifetime - b.netLifetime);
      if (behind >= 0) {
        frag.append(`${a.career.name} passes ${b.career.name} for good at age ${START + behind + 1} and ends ${gap} ahead. `);
      } else {
        frag.append(`${a.career.name} stays ahead of ${b.career.name} the whole way and ends ${gap} ahead. `);
      }
    }
    parts.push(frag);
    els.notes.append(...parts);
  }

  /* ---------- summary cards ---------- */

  function renderCards() {
    const wrap = els.cards;
    wrap.textContent = "";
    wrap.style.setProperty("--n", Math.max(1, state.picks.length));
    if (!state.picks.length) {
      const e = document.createElement("div");
      e.className = "cards-empty";
      e.textContent = "Pick up to three careers to compare them here.";
      wrap.appendChild(e);
      return;
    }
    const picks = state.picks.map((p) => ({ p, r: results[p.id] }));
    const best = Math.max(...picks.map((x) => x.r.netLifetime));
    for (const { p, r } of picks) {
      const c = r.career;
      const card = document.createElement("article");
      card.className = "card";
      const isBest = picks.length > 1 && r.netLifetime === best;
      const delta = best - r.netLifetime;
      const leader = picks.find((x) => x.r.netLifetime === best).r.career.name;
      const repaidAge = r.years.reduce((acc, y) => (y.loanPaid > 0 ? y.age + 1 : acc), null);
      const peakAge = r.workStartAge + c.yearsToPeak;
      const schoolLabel = c.school.map((s) => s.label).join(" + ");
      card.innerHTML = `
        <div class="card-head">
          <span class="card-key" style="background:${SLOTS[p.slot]}"></span>
          <h3 class="card-name"></h3>
          ${isBest ? '<span class="pill">Highest net</span>' : ""}
        </div>
        <div class="card-hero">
          <span class="label">Net lifetime earnings${state.afterTax ? ", after tax" : ""}</span>
          <span class="value">${money(r.netLifetime)}</span>
          <span class="delta"></span>
        </div>
        <dl class="stats">
          <div class="stat"><dt>Tuition &amp; fees</dt><dd>${money(r.educationCost, { full: true })}<small>${state.schoolType === "public" ? "public in-state" : "private"}</small></dd></div>
          <div class="stat"><dt>Years in school</dt><dd>${yrs(r.schoolYears)}<small>${esc(schoolLabel)}${r.trainingYears ? ` + ${r.trainingYears}-yr ${esc(c.training.label)}` : ""}</small></dd></div>
          <div class="stat"><dt>Starting salary</dt><dd>${money(c.startSalary, { full: true })}<small>at age ${r.workStartAge}</small></dd></div>
          <div class="stat"><dt>Peak salary</dt><dd>${money(c.peakSalary, { full: true })}<small>by age ${peakAge}</small></dd></div>
          <div class="stat"><dt>Loan repaid</dt><dd>${r.borrowed ? money(r.loanPaid, { full: true }) : "$0"}<small>${r.borrowed ? `${money(r.interestPaid)} interest · paid off at ${repaidAge}` : "no loans"}</small></dd></div>
          <div class="stat"><dt>Earnings cover school costs</dt><dd>age ${ageText(r.breakEvenAge)}<small>deepest hole ${money(r.lowPoint)}</small></dd></div>
          <div class="stat"><dt>Lifetime pay${state.afterTax ? " after tax" : ""}</dt><dd>${money(r.lifetimeIncome)}<small>ages 18–65</small></dd></div>
        </dl>
        <p class="card-note"></p>`;
      card.querySelector(".card-name").textContent = c.name;
      card.querySelector(".delta").textContent = picks.length < 2 ? c.detail : isBest ? `${c.detail}` : `${money(delta)} behind ${leader}`;
      card.querySelector(".card-note").textContent = c.note;
      wrap.appendChild(card);
    }
  }

  /* ---------- table ---------- */

  function renderTable() {
    const keyFns = {
      name: (r) => r.career.name,
      years: (r) => r.schoolYears + r.trainingYears / 100,
      cost: (r) => r.educationCost,
      start: (r) => r.career.startSalary,
      peak: (r) => r.career.peakSalary,
      loan: (r) => r.loanPaid,
      net: (r) => r.netLifetime,
    };
    const f = keyFns[state.sort.key];
    const rows = D.CAREERS.map((c) => results[c.id]).sort((a, b) => {
      const x = f(a), y = f(b);
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * state.sort.dir;
    });
    const tbody = els.table.tBodies[0];
    tbody.textContent = "";
    for (const r of rows) {
      const c = r.career;
      const slot = slotOf(c.id);
      const tr = document.createElement("tr");
      if (slot >= 0) tr.className = "is-selected";
      tr.innerHTML = `
        <td class="text"><span class="row-key"${slot >= 0 ? ` style="background:${SLOTS[slot]}"` : ""}></span><span class="nm"></span><span class="sub"></span></td>
        <td>${r.schoolYears}${r.trainingYears ? `<span class="sub">+${r.trainingYears} ${esc(c.training.label.split(" ")[0])}</span>` : ""}</td>
        <td>${money(r.educationCost, { full: true })}</td>
        <td>${money(c.startSalary, { full: true })}</td>
        <td>${money(c.peakSalary, { full: true })}</td>
        <td>${money(r.loanPaid, { full: true })}${r.interestPaid ? `<span class="sub">${money(r.interestPaid)} interest</span>` : ""}</td>
        <td class="net">${money(r.netLifetime, { full: true })}</td>`;
      tr.querySelector(".nm").textContent = c.name;
      tr.querySelector(".sub").textContent = c.detail;
      tbody.appendChild(tr);
    }
    for (const th of els.table.tHead.rows[0].cells) {
      if (th.dataset.sort === state.sort.key) th.setAttribute("aria-sort", state.sort.dir < 0 ? "descending" : "ascending");
      else th.removeAttribute("aria-sort");
    }
  }

  function renderSources() {
    els.sources.textContent = "";
    for (const s of Object.values(D.SOURCES)) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = s.label;
      li.appendChild(a);
      els.sources.appendChild(li);
    }
  }

  /* ---------- frame ---------- */

  function renderSub() {
    const tax = state.afterTax ? "After tax." : "Before tax.";
    els.chartSub.textContent = state.mode === "net"
      ? `Total pay so far, minus tuition, loan payments and the loan balance still owed. Below zero, the degree has not paid for itself yet. ${tax}`
      : `Pay earned in each year. Zero while in school; resident stipends during medical training. ${tax}`;
  }

  function renderFrame() {
    els.ageValue.textContent = Math.floor(state.age + 1e-6);
    els.scrub.value = state.age.toFixed(1);
    computeGeom();
    renderChart();
    renderBoard();
    renderTooltip();
  }

  function renderAll() {
    recompute();
    computeGeom();
    renderPicker();
    renderSub();
    renderFrame();
    renderNotes();
    renderCards();
    renderTable();
  }

  /* ---------- playback ---------- */

  function setPlayUI() {
    els.playIcon.setAttribute("d", state.playing ? "M4 2.5h3v11H4zM9 2.5h3v11H9z" : "M4 2.5v11l9-5.5z");
    els.playText.textContent = state.playing ? "Pause" : state.age >= END ? "Run the race" : "Resume";
    els.play.setAttribute("aria-label", state.playing ? "Pause the race" : "Play the race");
  }
  function tick(ts) {
    if (!state.playing) return;
    const dt = Math.min(0.1, (ts - lastFrame) / 1000);
    lastFrame = ts;
    state.age = Math.min(END, state.age + dt * ((END - START) / RACE_SECONDS) * state.speed);
    if (state.age >= END) state.playing = false;
    renderFrame();
    setPlayUI();
    if (state.playing) requestAnimationFrame(tick);
  }
  function startRace(fromStart) {
    if (fromStart || state.age >= END) state.age = START;
    if (reduceMotion.matches) { state.age = END; state.playing = false; renderFrame(); setPlayUI(); return; }
    state.playing = true;
    lastFrame = performance.now();
    setPlayUI();
    requestAnimationFrame(tick);
  }
  function pause() {
    state.playing = false;
    setPlayUI();
  }

  /* ---------- hash ---------- */

  function writeHash() {
    try {
      history.replaceState(null, "", "#" + state.picks.map((p) => p.id).join("-"));
    } catch (e) { /* hash sync is a convenience */ }
  }
  function readHash() {
    const ids = (location.hash || "").replace(/^#/, "").split("-").filter((id) => byId[id]);
    const unique = [...new Set(ids)].slice(0, MAX_PICK);
    return unique.length ? unique : null;
  }

  /* ---------- events ---------- */

  function bindSegmented(attr, apply) {
    document.querySelectorAll(`[data-${attr}]`).forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(`[data-${attr}]`).forEach((b) => b.setAttribute("aria-checked", String(b === btn)));
        apply(btn.dataset[attr]);
        renderAll();
      });
      btn.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const group = [...btn.parentElement.querySelectorAll("button")];
        const next = group[(group.indexOf(btn) + (e.key === "ArrowRight" ? 1 : group.length - 1)) % group.length];
        next.focus();
        next.click();
        e.preventDefault();
      });
    });
  }

  function bind() {
    bindSegmented("school", (v) => (state.schoolType = v));
    bindSegmented("tax", (v) => (state.afterTax = v === "post"));
    bindSegmented("mode", (v) => (state.mode = v));

    els.borrow.addEventListener("input", () => {
      state.borrowShare = els.borrow.value / 100;
      els.borrowOut.textContent = els.borrow.value + "%";
      renderAll();
    });
    els.repay.addEventListener("change", () => {
      state.repayYears = +els.repay.value;
      renderAll();
    });
    els.play.addEventListener("click", () => (state.playing ? pause() : startRace(false)));
    els.scrub.addEventListener("input", () => {
      pause();
      state.age = +els.scrub.value;
      renderFrame();
      setPlayUI();
    });
    els.speed.addEventListener("change", () => (state.speed = +els.speed.value));

    const svg = els.chart;
    const hoverFromEvent = (e) => {
      if (!geom || !state.picks.length) return;
      const rect = svg.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * geom.w;
      const a = Math.round(geom.age(px));
      state.hoverAge = Math.max(START, Math.min(END, a));
      renderChart();
      renderTooltip();
    };
    svg.addEventListener("pointermove", hoverFromEvent);
    svg.addEventListener("pointerdown", hoverFromEvent);
    svg.addEventListener("pointerleave", () => {
      state.hoverAge = null;
      renderChart();
      renderTooltip();
    });
    svg.addEventListener("focus", () => {
      state.hoverAge = Math.round(state.age);
      renderChart();
      renderTooltip();
    });
    svg.addEventListener("blur", () => {
      state.hoverAge = null;
      renderChart();
      renderTooltip();
    });
    svg.addEventListener("keydown", (e) => {
      const step = { ArrowLeft: -1, ArrowRight: 1, Home: -99, End: 99 }[e.key];
      if (!step) return;
      e.preventDefault();
      const cur = state.hoverAge ?? Math.round(state.age);
      state.hoverAge = Math.max(START, Math.min(END, cur + step));
      renderChart();
      renderTooltip();
    });

    els.table.tHead.addEventListener("click", (e) => {
      const th = e.target.closest("th[data-sort]");
      if (!th) return;
      const key = th.dataset.sort;
      state.sort = state.sort.key === key ? { key, dir: -state.sort.dir } : { key, dir: key === "name" ? 1 : -1 };
      renderTable();
    });

    window.addEventListener("hashchange", () => {
      const ids = readHash();
      if (!ids) return;
      state.picks = ids.map((id, slot) => ({ id, slot }));
      renderAll();
    });

    let resizeRaf = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => { computeGeom(); renderFrame(); });
    }).observe(els.chartWrap);
  }

  /* ---------- boot ---------- */

  const initial = readHash() || ["specialist", "swe", "teacher"];
  state.picks = initial.map((id, slot) => ({ id, slot }));
  bind();
  renderSources();
  renderAll();
  setPlayUI();
})();
