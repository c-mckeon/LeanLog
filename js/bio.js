// Bio: any body measurement the user wants to log as numbers over time (weight by default).
// Data lives under bio/: metrics/{id} = { name, unit }, entries/{metricId}/{entryId} = { date, value }.
// Chart display choices (points and/or trend line, zoom period, selected measurement) live in settings/bio.
(function () {
  const DEFAULT_METRICS = { weight: { name: 'Weight', unit: 'kg' } };
  const CHART_COLOR = '#176b45';

  const area = document.getElementById('bioarea');
  const tab = document.getElementById('toggleBioBtn');
  if (!area || !tab) return;

  const el = (id) => document.getElementById(id);
  const metricChips = el('bioMetricChips');
  const addMetricForm = el('bioAddMetricForm');
  const metricNameInput = el('bioMetricName');
  const metricUnitInput = el('bioMetricUnit');
  const showPointsBox = el('bioShowPoints');
  const showLineBox = el('bioShowLine');
  const showSpreadBox = el('bioShowSpread');
  const zoomSelect = el('bioZoomSelect');
  const dateInput = el('bioEntryDate');
  const dateToggle = el('bioDateToggle');
  const valueInput = el('bioEntryValue');
  const saveEntryBtn = el('bioSaveEntryBtn');
  const chartCanvas = el('bioChart');
  const statsPanel = el('bioStats');
  const emptyHint = el('bioEmpty');
  const entryList = el('bioEntryList');

  let metrics = {};
  let metricsSaved = false; // false while only the built-in defaults exist (nothing stored yet)
  let entriesByMetric = {};
  let selectedId = '';
  let chart = null;
  let model = null; // fitted trend and error model for the selected measurement (null with too few readings)
  let shown = []; // the model's estimates within the zoom period
  let hovered = null; // the estimate under the pointer, shown in the stats panel

  const escapeHtml = (text) => (typeof escapeExerciseHtml === 'function'
    ? escapeExerciseHtml(text)
    : String(text ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`));
  const formatDate = (date) => (typeof formatWorkoutListDate === 'function' ? formatWorkoutListDate(date) : date);
  const today = () => (typeof getToday === 'function' ? getToday() : new Date().toISOString().slice(0, 10));
  const newId = () => window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const notify = (message, type = 'error') => (window.showNotice ? window.showNotice(message, type) : console.error(message));
  const metricLabel = (metric) => (metric.unit ? `${metric.name} (${metric.unit})` : metric.name);

  function sortedEntries(metricId) {
    return Object.entries(entriesByMetric[metricId] || {})
      .map(([key, entry]) => ({ key, date: entry?.date, time: Number(entry?.time) || 0, value: Number(entry?.value) }))
      .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.date || '') && Number.isFinite(entry.value))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time - b.time || a.key.localeCompare(b.key));
  }

  // Writes that create the first stored measurement also store the defaults, so they stay
  function metricUpdates() {
    if (metricsSaved) return {};
    return Object.fromEntries(Object.entries(metrics).map(([id, metric]) => [`metrics/${id}`, metric]));
  }

  async function saveSettings() {
    try {
      await window.database.ref('settings/bio').update({
        showPoints: showPointsBox.checked,
        showLine: showLineBox.checked,
        showSpread: showSpreadBox.checked,
        zoom: zoomSelect.value,
        metric: selectedId
      });
    } catch (error) {
      console.error('Could not save Bio settings:', error);
    }
  }

  async function loadBio() {
    try {
      const [bioSnapshot, settingsSnapshot] = await Promise.all([
        window.database.ref('bio').once('value'),
        window.database.ref('settings/bio').once('value')
      ]);
      const bio = bioSnapshot.val() || {};
      const settings = settingsSnapshot.val() || {};
      metricsSaved = Boolean(bio.metrics && Object.keys(bio.metrics).length);
      metrics = metricsSaved ? bio.metrics : { ...DEFAULT_METRICS };
      entriesByMetric = bio.entries || {};
      if (typeof settings.showPoints === 'boolean') showPointsBox.checked = settings.showPoints;
      if (typeof settings.showLine === 'boolean') showLineBox.checked = settings.showLine;
      if (typeof settings.showSpread === 'boolean') showSpreadBox.checked = settings.showSpread;
      if (settings.zoom && [...zoomSelect.options].some((option) => option.value === settings.zoom)) zoomSelect.value = settings.zoom;
      if (!showPointsBox.checked && !showLineBox.checked) showPointsBox.checked = true;
      if (!selectedId || !metrics[selectedId]) selectedId = metrics[settings.metric] ? settings.metric : Object.keys(metrics)[0];
      render();
    } catch (error) {
      console.error('Could not load Bio data:', error);
      entryList.innerHTML = `<li class="exo-hint">${escapeHtml(error.message || 'Could not load your measurements.')}</li>`;
    }
  }

  // One chip per measurement: click to show it, × to remove; "+ Add" opens the add form
  function renderChips() {
    const adding = !addMetricForm.hidden;
    metricChips.innerHTML = Object.entries(metrics)
      .sort(([, a], [, b]) => a.name.localeCompare(b.name))
      .map(([id, metric]) => `
        <span class="bio-chip${id === selectedId ? ' is-selected' : ''}">
          <button type="button" class="bio-chip-select" data-id="${escapeHtml(id)}" aria-pressed="${id === selectedId}">${escapeHtml(metricLabel(metric))}</button>
          <button type="button" class="bio-chip-remove" data-id="${escapeHtml(id)}" aria-label="Remove ${escapeHtml(metric.name)}">×</button>
        </span>`).join('')
      + (adding ? '' : '<button type="button" class="bio-chip bio-chip-add">+ Add</button>');
  }

  function render() {
    renderChips();
    const metric = metrics[selectedId] || { name: '', unit: '' };
    valueInput.placeholder = metricLabel(metric) || 'Value';

    const entries = sortedEntries(selectedId);
    const inPeriod = zoomedPoints(entries).length;
    emptyHint.textContent = entries.length ? "No readings in this period." : "No entries yet. Add one above to start the chart.";
    emptyHint.hidden = inPeriod > 0;
    renderChart(metric, entries);
    entryList.innerHTML = [...entries].reverse().map((entry) => `
      <li>
        <span>${escapeHtml(formatDate(entry.date))}</span>
        <strong>${escapeHtml(entry.value)}${metric.unit ? ` ${escapeHtml(metric.unit)}` : ''}</strong>
        <button type="button" class="btn btn-sm btn-outline-danger bio-delete-entry" data-key="${escapeHtml(entry.key)}" aria-label="Delete entry from ${escapeHtml(formatDate(entry.date))}">×</button>
      </li>`).join('');
  }

  // Zoom: only readings from the chosen period are plotted, and the axis fits them
  const ZOOM_DAYS = { '1m': 30, '3m': 90, '6m': 180, '1y': 365 };
  const DAY_MS = 24 * 60 * 60 * 1000;

  function toTime(date) {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day).getTime();
  }

  function zoomedPoints(entries) {
    const points = entries.map((entry) => ({ x: entry.time || toTime(entry.date), y: entry.value }));
    const days = ZOOM_DAYS[zoomSelect.value];
    if (!days) return points;
    const cutoff = Date.now() - days * DAY_MS;
    return points.filter((point) => point.x >= cutoff);
  }

  /* 14-day Gaussian trend with a ±1 SD spread band (replaced by the model further down), kept to come back to:
  // Trend line: a Gaussian time-weighted average (TREND_SIGMA wide), worked out on an even
  // grid of days rather than only at each reading, so bunched-up readings don't make it kink.
  // Readings are split into runs wherever there's a gap longer than TREND_GAP; each run is
  // smoothed on its own and the chart joins runs with a straight line, so the line doesn't
  // invent bumps where there's no data. Raise TREND_SIGMA for a smoother line.
  const TREND_SIGMA = 14 * DAY_MS;
  const TREND_GAP = 30 * DAY_MS;
  const TREND_MAX_GRID_POINTS = 400;

  function trendLine(points) {
    if (points.length < 2) return points.slice();
    const sorted = points.slice().sort((a, b) => a.x - b.x);
    const step = Math.max(DAY_MS, (sorted[sorted.length - 1].x - sorted[0].x) / TREND_MAX_GRID_POINTS);

    const runs = [[sorted[0]]];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].x - sorted[i - 1].x > TREND_GAP) runs.push([]);
      runs[runs.length - 1].push(sorted[i]);
    }

    const weightAt = (p, t) => {
      const dx = (p.x - t) / TREND_SIGMA;
      return Math.exp(-0.5 * dx * dx);
    };
    const averageAt = (run, t, skip) => {
      let sum = 0;
      let weightSum = 0;
      run.forEach((p) => {
        if (p === skip) return;
        const weight = weightAt(p, t);
        sum += p.y * weight;
        weightSum += weight;
      });
      return sum / weightSum;
    };

    // Spread band: besides the average (y), each point carries sd, the typical distance of
    // readings from the trend around that time (a Gaussian-weighted root mean square, same
    // width as the trend). Each reading's distance is measured against the trend worked out
    // without it, so it can't pull the line towards itself and make the band look too tight,
    // and measuring from the trend (not a flat average) stops steady gains or losses from
    // counting as scatter. About 68% of readings should fall within ±1 sd. Where fewer than
    // ~1.5 readings effectively count (n_eff = (Σw)² / Σw²), sd is null and the band has a gap.
    const spreadAt = (residuals, t) => {
      let squareSum = 0;
      let weightSum = 0;
      let squareWeightSum = 0;
      residuals.forEach(({ p, residual }) => {
        const weight = weightAt(p, t);
        squareSum += weight * residual * residual;
        weightSum += weight;
        squareWeightSum += weight * weight;
      });
      if (!weightSum || (weightSum * weightSum) / squareWeightSum < 1.5) return null;
      return Math.sqrt(squareSum / weightSum);
    };

    const line = [];
    runs.forEach((run) => {
      const residuals = run.length < 2 ? [] : run.map((p) => ({ p, residual: p.y - averageAt(run, p.x, p) }));
      const add = (t) => line.push({ x: t, y: averageAt(run, t), sd: spreadAt(residuals, t) });
      const start = run[0].x;
      const end = run[run.length - 1].x;
      for (let t = start; t < end; t += step) add(t);
      add(end);
    });
    return line;
  }
  */

  /* Previous trend line, kept to come back to:
  // Trend line: per point, a rolling average of the 5 points either side, blended with a
  // Gaussian (10-day) time-weighted average. Where readings are dense the Gaussian counts
  // for more (up to 100% at 8+ readings within 10 days); where they're sparse it's 50/50.
  const TREND_SIGMA = 10 * DAY_MS;
  const TREND_WINDOW = 5;

  function trendLine(points) {
    return points.map((point, i) => {
      let rollingSum = 0;
      let rollingCount = 0;
      for (let j = Math.max(0, i - TREND_WINDOW); j <= Math.min(points.length - 1, i + TREND_WINDOW); j++) {
        rollingSum += points[j].y;
        rollingCount++;
      }
      let gaussianSum = 0;
      let weightSum = 0;
      let nearby = 0;
      points.forEach((other) => {
        const diff = other.x - point.x;
        if (Math.abs(diff) <= TREND_SIGMA) nearby++;
        const weight = Math.exp(-(diff * diff) / (2 * TREND_SIGMA * TREND_SIGMA));
        gaussianSum += other.y * weight;
        weightSum += weight;
      });
      const density = Math.min(8, Math.max(1, nearby));
      const gaussianShare = 0.5 + 0.5 * ((density - 1) / 7);
      const y = (1 - gaussianShare) * (rollingSum / rollingCount) + gaussianShare * (gaussianSum / weightSum);
      return { x: point.x, y };
    });
  }
  */

  // ---- Trend and error: a statistical model of the readings ----
  // Each reading = slow trend + short-term swing + reading noise:
  // - slow trend: a level whose rate of change drifts slowly (behaves like a cubic smoothing spline)
  // - swing: smooth ups and downs (water, food, ...) that fade over about `ell` days (Matérn 3/2)
  // - reading noise: scatter between readings taken close together
  // How big each part is gets fitted to this measurement's own readings (maximum likelihood).
  // A Kalman filter and smoother then give, for any moment, the best estimate (trend + swing)
  // and its error. The error grows across gaps with no readings and shrinks where readings are dense.
  // Checked on the imported weight history by hiding readings and predicting them (single readings,
  // gaps of 1 week to 4 months, and 3-60 days after the last reading): 57-78% landed within ±1 error
  // and 93-99% within ±2, against 68% and 95% expected.
  const MODEL_MIN_READINGS = 8;
  const TRACKING_DAYS = 3.5; // a moment counts as "tracking" when a reading is within this many days
  const MODEL_MAX_GRID_POINTS = 1200;
  const BAND_WINDOW_DAYS = 30;
  const BAND_PRIOR_READINGS = 2;
  /* Previous gap widening, by days from the nearest reading (one reading reset it fully), kept to come back to:
  // Extra spread per day away from the nearest reading (beyond TRACKING_DAYS), as a share of the
  // readings' overall mean square distance from the trend. Hidden-reading tests on the weight history
  // fitted 0.014 (maximum likelihood); this is double that, to widen more in gaps while staying
  // accurate (68-75% of hidden readings within ±1, 95-99% within ±2). About ±0.5 kg extra after
  // 30 days without readings. At 4x (0.056) the band overstates the error (82% within ±1 in long gaps).
  const BAND_GAP_GROWTH = 0.028;
  */

  // Reading coverage at a moment: a Gaussian-weighted count of readings around it (BAND_COVERAGE_DAYS
  // wide). Steady tracking gives BAND_FULL_READINGS or more; a lone reading gives about 1, so it only
  // partly brings the band back. Both the band's extra widening and its fade go by coverage.
  const BAND_COVERAGE_DAYS = 7;
  const BAND_FULL_READINGS = 3;
  // Widening: coverage is turned into "days without readings" (how far from a full run of readings
  // you'd have to be to see this little coverage; about the real gap once far from any reading), and
  // the band gets extra variance BAND_GAP_GROWTH × (readings' overall mean square from the trend)
  // per such day. Hidden-reading tests on the weight history fitted 0.010 (maximum likelihood);
  // 0.056 is set on purpose to widen more, so in long gaps the band overstates the error a little
  // (75-83% of hidden readings within ±1 instead of 68%; 96-100% within ±2).
  const BAND_GAP_GROWTH = 0.056;

  // 4x4 matrices as flat arrays of 16, row by row
  const matMul = (A, B) => {
    const C = new Array(16).fill(0);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) {
      const a = A[i * 4 + k];
      if (a) for (let j = 0; j < 4; j++) C[i * 4 + j] += a * B[k * 4 + j];
    }
    return C;
  };
  const matT = (A) => A.map((_, n) => A[(n % 4) * 4 + Math.floor(n / 4)]);
  const matAdd = (A, B, sign = 1) => A.map((a, n) => a + sign * B[n]);
  const matVec = (A, v) => [0, 1, 2, 3].map((i) => A[i * 4] * v[0] + A[i * 4 + 1] * v[1] + A[i * 4 + 2] * v[2] + A[i * 4 + 3] * v[3]);
  function matInverse(M) {
    const A = [0, 1, 2, 3].map((i) => [...M.slice(i * 4, i * 4 + 4), ...[0, 1, 2, 3].map((j) => (i === j ? 1 : 0))]);
    for (let c = 0; c < 4; c++) {
      let pivot = c;
      for (let r = c + 1; r < 4; r++) if (Math.abs(A[r][c]) > Math.abs(A[pivot][c])) pivot = r;
      [A[c], A[pivot]] = [A[pivot], A[c]];
      const p = A[c][c] || 1e-12;
      for (let j = 0; j < 8; j++) A[c][j] /= p;
      for (let r = 0; r < 4; r++) if (r !== c && A[r][c]) {
        const f = A[r][c];
        for (let j = 0; j < 8; j++) A[r][j] -= f * A[c][j];
      }
    }
    return A.flatMap((row) => row.slice(4));
  }

  // State: [trend level, trend slope per day, swing, swing slope]. A reading sees level + swing.
  function modelTransition(d, { q, s2, ell }) {
    const lam = Math.sqrt(3) / ell;
    const e = Math.exp(-lam * d);
    const p00 = e * (1 + lam * d), p01 = e * d, p10 = -e * lam * lam * d, p11 = e * (1 - lam * d);
    const v0 = s2, v1 = lam * lam * s2; // the swing's long-run variance (and its slope's)
    return {
      F: [1, d, 0, 0, 0, 1, 0, 0, 0, 0, p00, p01, 0, 0, p10, p11],
      Q: [
        q * d ** 3 / 3, q * d ** 2 / 2, 0, 0,
        q * d ** 2 / 2, q * d, 0, 0,
        0, 0, v0 - (p00 * p00 * v0 + p01 * p01 * v1), -(p00 * p10 * v0 + p01 * p11 * v1),
        0, 0, -(p00 * p10 * v0 + p01 * p11 * v1), v1 - (p10 * p10 * v0 + p11 * p11 * v1)
      ]
    };
  }

  // obs: [{ t (days), y }] sorted by t; times: extra moments (days) to estimate at
  function runFilter(obs, times, params, keepSteps) {
    const events = obs.map((o) => ({ t: o.t, y: o.y })).concat(times.map((t) => ({ t, y: null })));
    events.sort((a, b) => a.t - b.t || (a.y === null) - (b.y === null));
    const big = 1e6;
    const lam = Math.sqrt(3) / params.ell;
    let m = [obs[0].y, 0, 0, 0];
    let P = [big, 0, 0, 0, 0, big, 0, 0, 0, 0, params.s2, 0, 0, 0, 0, lam * lam * params.s2];
    let lastT = events[0].t;
    let logLik = 0;
    let seen = 0;
    const steps = [];
    events.forEach((event) => {
      const d = event.t - lastT;
      lastT = event.t;
      const { F, Q } = modelTransition(d, params);
      const mp = matVec(F, m);
      const Pp = matAdd(matMul(matMul(F, P), matT(F)), Q);
      let mf = mp;
      let Pf = Pp;
      if (event.y !== null) {
        const PH = [0, 1, 2, 3].map((i) => Pp[i * 4] + Pp[i * 4 + 2]);
        const S = PH[0] + PH[2] + params.r;
        const innovation = event.y - (mp[0] + mp[2]);
        const K = PH.map((x) => x / S);
        mf = mp.map((x, i) => x + K[i] * innovation);
        Pf = Pp.map((x, n) => x - K[Math.floor(n / 4)] * PH[n % 4]);
        seen++;
        // The first two readings only pin down the starting level and slope
        if (seen > 2) logLik -= 0.5 * (Math.log(2 * Math.PI * S) + (innovation * innovation) / S);
      }
      if (keepSteps) steps.push({ t: event.t, y: event.y, F, mp, Pp, mf, Pf });
      m = mf;
      P = Pf;
    });
    return { steps, logLik };
  }

  // Rauch-Tung-Striebel smoother: lets later readings inform earlier moments too
  function smoothSteps(steps) {
    const out = new Array(steps.length);
    const lastStep = steps[steps.length - 1];
    out[steps.length - 1] = { t: lastStep.t, y: lastStep.y, m: lastStep.mf, P: lastStep.Pf };
    for (let i = steps.length - 2; i >= 0; i--) {
      const step = steps[i];
      const next = steps[i + 1];
      const C = matMul(matMul(step.Pf, matT(next.F)), matInverse(next.Pp));
      const shift = matVec(C, out[i + 1].m.map((x, j) => x - next.mp[j]));
      out[i] = {
        t: step.t,
        y: step.y,
        m: step.mf.map((x, k) => x + shift[k]),
        P: matAdd(step.Pf, matMul(matMul(C, matAdd(out[i + 1].P, next.Pp, -1)), matT(C)))
      };
    }
    return out;
  }

  // Maximum likelihood: try a spread of starting guesses, then refine the best few
  function fitModel(obs) {
    const ys = obs.map((o) => o.y);
    const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
    const variance = Math.max(1e-6, ys.reduce((a, b) => a + (b - mean) ** 2, 0) / ys.length);
    // Searched in log10 units, relative to the readings' overall variance so any unit works
    const toParams = ([lq, ls, ll, lr]) => ({ q: variance * 10 ** lq, s2: variance * 10 ** ls, ell: 10 ** ll, r: variance * 10 ** lr });
    const score = (x) => {
      const value = runFilter(obs, [], toParams(x), false).logLik;
      return Number.isFinite(value) ? value : -Infinity;
    };
    const starts = [];
    for (const lq of [-9, -7, -5]) for (const ls of [-2.5, -1.5, -0.5]) for (const ll of [0.25, 0.75, 1.25, 1.75]) for (const lr of [-2.5, -1.5]) {
      const x = [lq, ls, ll, lr];
      starts.push({ x, value: score(x) });
    }
    starts.sort((a, b) => b.value - a.value);
    let best = null;
    starts.slice(0, 3).forEach((start) => {
      let current = start;
      let stepSize = 0.5;
      while (stepSize > 0.03) {
        let improved = false;
        for (let k = 0; k < 4; k++) for (const sign of [1, -1]) {
          const x = current.x.slice();
          x[k] += sign * stepSize;
          if (k === 2) x[k] = Math.min(2.2, Math.max(-0.5, x[k])); // swings fade over 0.3 to 160 days
          const value = score(x);
          if (value > current.value + 1e-9) { current = { x, value }; improved = true; }
        }
        if (!improved) stepSize /= 2;
      }
      if (!best || current.value > best.value) best = current;
    });
    return toParams(best.x);
  }

  // Fitting takes a moment, so it's redone only when the readings change
  let modelCache = { key: '', params: null };

  // Returns null with too few readings; otherwise the fitted parts and an estimate for each
  // moment from the first reading to now: { x, trend, sd (band), trendSd, slope, slopeSd, prev, next }
  function buildModel(entries) {
    const obs = entries
      .map((entry) => ({ t: (entry.time || toTime(entry.date)) / DAY_MS, y: entry.value }))
      .sort((a, b) => a.t - b.t);
    if (obs.length < MODEL_MIN_READINGS) return null;
    const key = `${selectedId}|${obs.map((o) => `${o.t}:${o.y}`).join(',')}`;
    if (modelCache.key !== key) modelCache = { key, params: fitModel(obs) };
    const { params } = modelCache;

    const start = obs[0].t;
    const end = Math.max(obs[obs.length - 1].t, Date.now() / DAY_MS);
    const step = Math.max(1, (end - start) / MODEL_MAX_GRID_POINTS);
    const times = [];
    for (let t = start; t < end; t += step) times.push(t);
    times.push(end);

    const smoothed = smoothSteps(runFilter(obs, times, params, true).steps);
    // Error band, centred on the smooth trend. Its width combines:
    // - how far readings sit from the trend around then: a Gaussian-weighted (BAND_WINDOW_DAYS)
    //   mean square of the readings' distances from the trend, pulled towards the overall value
    //   where few readings are nearby (as if BAND_PRIOR_READINGS more were at the overall value)
    // - the trend's own uncertainty, which grows across gaps with no readings
    // - an extra term that grows where few readings are nearby (BAND_GAP_GROWTH, see there for how
    //   accurate it is)
    const residuals = smoothed.filter((state) => state.y !== null).map((state) => ({ t: state.t, square: (state.y - state.m[0]) ** 2 }));
    const overallSquare = residuals.reduce((sum, item) => sum + item.square, 0) / residuals.length;
    const localSquare = (t) => {
      let weightSum = 0;
      let squareSum = 0;
      residuals.forEach((item) => {
        const dx = (item.t - t) / BAND_WINDOW_DAYS;
        const weight = Math.exp(-0.5 * dx * dx);
        weightSum += weight;
        squareSum += weight * item.square;
      });
      return (squareSum + BAND_PRIOR_READINGS * overallSquare) / (weightSum + BAND_PRIOR_READINGS);
    };

    const readingTimes = obs.map((o) => o.t);
    let nextIndex = 0;
    const estimates = smoothed
      .filter((state) => state.y === null)
      .map(({ t, m, P }) => {
        while (nextIndex < readingTimes.length && readingTimes[nextIndex] < t) nextIndex++;
        const trendVariance = Math.max(0, P[0]);
        // Previous: days from the nearest reading
        // const nearestReading = Math.min(...[readingTimes[nextIndex - 1], readingTimes[nextIndex]].filter((time) => time !== undefined).map((time) => Math.abs(time - t)));
        // const daysAway = Math.max(0, nearestReading - TRACKING_DAYS);
        const coverage = readingTimes.reduce((sum, time) => sum + Math.exp(-0.5 * ((time - t) / BAND_COVERAGE_DAYS) ** 2), 0);
        // Days equivalent: BAND_COVERAGE_DAYS × √(2 ln(full / coverage)), with the cut-off at full
        // coverage rounded off (a soft maximum) so the band's edge has no corner there
        const shortfall = Math.log(BAND_FULL_READINGS / Math.max(coverage, 1e-300));
        const softShortfall = shortfall > 20 ? shortfall : Math.log1p(Math.exp(3 * shortfall)) / 3;
        const daysAway = BAND_COVERAGE_DAYS * Math.sqrt(2 * softShortfall);
        return {
          x: t * DAY_MS,
          coverage,
          trend: m[0],
          sd: Math.sqrt(trendVariance + localSquare(t) + BAND_GAP_GROWTH * overallSquare * daysAway),
          trendSd: Math.sqrt(trendVariance),
          slope: m[1],
          slopeSd: Math.sqrt(Math.max(0, P[5])),
          prev: nextIndex > 0 ? readingTimes[nextIndex - 1] * DAY_MS : null,
          next: nextIndex < readingTimes.length ? readingTimes[nextIndex] * DAY_MS : null
        };
      });
    return { params, estimates, count: obs.length, scatter: Math.sqrt(overallSquare) };
  }

  const isTracking = (point) => [point.prev, point.next].some((time) => time !== null && Math.abs(time - point.x) <= TRACKING_DAYS * DAY_MS);

  // Numbers beside the chart: the estimate and its error now (or at the date under the pointer),
  // the typical error while tracking and while not, and how much readings vary
  function renderStats(metric) {
    if (!statsPanel) return;
    const count = sortedEntries(selectedId).length;
    if (!model) {
      statsPanel.innerHTML = count
        ? `<p class="bio-stat-hint">The estimate and its error appear once there are ${MODEL_MIN_READINGS} readings (${count} so far).</p>`
        : '';
      return;
    }
    const unit = metric.unit ? ` ${escapeHtml(metric.unit)}` : '';
    const value = (number) => escapeHtml(number.toFixed(1));
    const error = (number) => escapeHtml(number < 1 ? number.toFixed(2) : number.toFixed(1));
    const dayCount = (ms) => {
      const daysApart = ms / DAY_MS;
      if (daysApart < 1) return `${Math.max(1, Math.round(daysApart * 24))} h`;
      const rounded = Math.round(daysApart);
      return `${rounded} day${rounded === 1 ? '' : 's'}`;
    };
    const dateLabel = (time) => new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const pointBlock = (point, heading) => {
      let status;
      if (isTracking(point)) {
        const nearest = Math.min(...[point.prev, point.next].filter((time) => time !== null).map((time) => Math.abs(time - point.x)));
        status = `<div class="bio-stat-status is-tracking">Tracking · nearest reading ${nearest < DAY_MS / 24 ? 'at this time' : `${dayCount(nearest)} away`}</div>`;
      } else {
        const parts = [];
        if (point.prev !== null) parts.push(`${dayCount(point.x - point.prev)} since last reading`);
        if (point.next !== null) parts.push(`${dayCount(point.next - point.x)} ${point.prev === null ? 'before first reading' : 'until next'}`);
        status = `<div class="bio-stat-status is-gap">Not tracking · ${parts.join(', ')}</div>`;
      }
      const perWeek = point.slope * 7;
      return `
        <div class="bio-stat-block">
          <div class="bio-stat-heading">${escapeHtml(heading)}</div>
          <div class="bio-stat-value">${value(point.trend)} <small>± ${error(point.sd)}${unit}</small></div>
          ${status}
          <div class="bio-stat-line">Trend line itself ± ${error(point.trendSd)}${unit}</div>
          <div class="bio-stat-line">Changing ${perWeek >= 0 ? '+' : '−'}${error(Math.abs(perWeek))} ± ${error(point.slopeSd * 7)}${unit}/week</div>
        </div>`;
    };

    const median = (list) => {
      if (!list.length) return null;
      const sorted = list.slice().sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };
    const trackedErrors = shown.filter(isTracking).map((p) => p.sd);
    const gapErrors = shown.filter((p) => !isTracking(p)).map((p) => p.sd);
    const now = model.estimates[model.estimates.length - 1];

    statsPanel.innerHTML = `
      ${pointBlock(now, `Now · ${dateLabel(now.x)}`)}
      ${hovered && hovered !== now ? pointBlock(hovered, `At pointer · ${dateLabel(hovered.x)}`) : '<p class="bio-stat-hint">Point at the chart for any date.</p>'}
      <div class="bio-stat-block">
        <div class="bio-stat-heading">Error in this view</div>
        <dl class="bio-stat-list">
          <dt>While tracking</dt><dd>${trackedErrors.length ? `± ${error(median(trackedErrors))}${unit} typical<br>± ${error(Math.max(...trackedErrors))}${unit} at most` : '—'}</dd>
          <dt>While not tracking</dt><dd>${gapErrors.length ? `± ${error(median(gapErrors))}${unit} typical<br>± ${error(Math.max(...gapErrors))}${unit} at most` : '—'}</dd>
        </dl>
      </div>
      <div class="bio-stat-block">
        <div class="bio-stat-heading">Readings around the trend</div>
        <dl class="bio-stat-list">
          <dt>All time</dt><dd>± ${error(model.scatter)}${unit}</dd>
        </dl>
      </div>
      <p class="bio-stat-hint">± is one standard deviation: about 2 in 3 readings land within it, 19 in 20 within double. It grows the longer you go without a reading. Tracking means a reading within ${TRACKING_DAYS} days.</p>`;
  }

  // Previous fade, by days from the nearest reading (one reading brought it back fully):
  // // The error band fades the further it is from a reading: full strength within TRACKING_DAYS,
  // // then halving about every BAND_FADE_HALF_DAYS, down to a faint floor so it never quite vanishes
  // const BAND_FADE_HALF_DAYS = 10;
  // The error band fades with reading coverage (see BAND_COVERAGE_DAYS): full strength at
  // BAND_FULL_READINGS or more, a third for a lone reading, down to a faint floor in long gaps
  const AXIS_FUTURE_SHARE = 0.03;
  const BAND_FADE_FLOOR = 0.06;
  const BAND_FADE_MAX_STOPS = 300;

  function bandColor(chartInstance, baseAlpha) {
    const solid = `rgba(220, 0, 0, ${baseAlpha})`;
    const area = chartInstance.chartArea;
    const xScale = chartInstance.scales?.x;
    if (!area || !xScale || !shown.length || area.right <= area.left) return solid;
    const gradient = chartInstance.ctx.createLinearGradient(area.left, 0, area.right, 0);
    const every = Math.max(1, Math.ceil(shown.length / BAND_FADE_MAX_STOPS));
    let lastOffset = -1;
    shown.forEach((point, i) => {
      if (i % every && i !== shown.length - 1) return;
      const offset = (xScale.getPixelForValue(point.x) - area.left) / (area.right - area.left);
      if (offset < 0 || offset > 1 || offset <= lastOffset) return;
      lastOffset = offset;
      // Previous:
      // const nearest = Math.min(...[point.prev, point.next].filter((time) => time !== null).map((time) => Math.abs(time - point.x)));
      // const daysAway = Math.max(0, nearest / DAY_MS - TRACKING_DAYS);
      // const strength = Math.max(BAND_FADE_FLOOR, 0.5 ** (daysAway / BAND_FADE_HALF_DAYS));
      const strength = Math.max(BAND_FADE_FLOOR, Math.min(1, point.coverage / BAND_FULL_READINGS));
      gradient.addColorStop(offset, `rgba(220, 0, 0, ${(baseAlpha * strength).toFixed(3)})`);
    });
    return lastOffset < 0 ? solid : gradient;
  }

  function renderChart(metric, entries) {
    // With no readings the chart still shows, empty, over the zoom period (or the last month)
    const points = zoomedPoints(entries);
    if (!window.Chart) return;
    const emptyEnd = Date.now();
    const emptyStart = emptyEnd - (ZOOM_DAYS[zoomSelect.value] || 30) * DAY_MS;

    const datasets = [{
      label: metricLabel(metric),
      data: points,
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
      borderColor: 'blue',
      pointBackgroundColor: 'black',
      pointBorderColor: 'white',
      pointRadius: showPointsBox.checked ? 2 : 0,
      pointHoverRadius: showPointsBox.checked ? 4 : 0,
      pointHitRadius: showPointsBox.checked ? 6 : 0,
      showLine: false,
      fill: false
    }];
    /* Previous datasets for the 14-day Gaussian trend and its spread band, kept to come back to:
    const trend = points.length > 1 ? trendLine(points) : [];
    if (showSpreadBox.checked && trend.length) {
      // ±1 standard deviation band; the lower edge fills up to the upper one
      const edge = (sign) => trend.map((p) => ({ x: p.x, y: p.sd === null ? null : p.y + sign * p.sd }));
      const bandStyle = {
        borderColor: 'rgba(220, 0, 0, 0.35)',
        borderWidth: 1,
        borderDash: [4, 3],
        pointRadius: 0,
        pointHitRadius: 0,
        spanGaps: false,
        tension: 0.3,
        cubicInterpolationMode: 'monotone'
      };
      datasets.push({ ...bandStyle, label: 'Spread (+1 SD)', data: edge(1), fill: false });
      datasets.push({ ...bandStyle, label: 'Spread (−1 SD)', data: edge(-1), fill: '-1', backgroundColor: 'rgba(220, 0, 0, 0.08)' });
    }
    if (showLineBox.checked && trend.length) {
      datasets.push({
        label: 'Trend',
        data: trend,
        borderColor: 'red',
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 0,
        fill: false,
        tension: 0.3,
        cubicInterpolationMode: 'monotone'
      });
    }
    */

    // Model estimates within the zoom period (the model itself always uses every reading)
    model = buildModel(entries);
    const days = ZOOM_DAYS[zoomSelect.value];
    const viewStart = days ? Date.now() - days * DAY_MS : (points.length ? points[0].x : emptyStart);
    shown = model ? model.estimates.filter((p) => p.x >= viewStart) : [];
    const lineStyle = { pointRadius: 0, pointHitRadius: 0, tension: 0, fill: false };
    /* Previous bands, centred on the trend + swing estimate (followed the readings too closely), kept to come back to:
    if (showSpreadBox.checked && shown.length) {
      // Light band: where a reading would land (±1 SD). Dark band: the estimate's own error (±1 SD).
      // Each lower edge fills up to the upper edge just before it.
      const edge = (key, sign) => shown.map((p) => ({ x: p.x, y: p.estimate + sign * p[key] }));
      const edgeStyle = { ...lineStyle, borderColor: 'rgba(220, 0, 0, 0.25)', borderWidth: 1, borderDash: [4, 3] };
      datasets.push({ ...edgeStyle, label: 'Reading range high', data: edge('readSd', 1) });
      datasets.push({ ...edgeStyle, label: 'Reading range low', data: edge('readSd', -1), fill: '-1', backgroundColor: 'rgba(220, 0, 0, 0.07)' });
      datasets.push({ ...lineStyle, label: 'Error high', data: edge('sd', 1), borderWidth: 0 });
      datasets.push({ ...lineStyle, label: 'Error low', data: edge('sd', -1), borderWidth: 0, fill: '-1', backgroundColor: 'rgba(220, 0, 0, 0.16)' });
      datasets.push({ ...lineStyle, label: 'Estimate', data: shown.map((p) => ({ x: p.x, y: p.estimate })), borderColor: 'rgba(160, 0, 0, 0.7)', borderWidth: 1 });
    }
    */
    if (showSpreadBox.checked && shown.length) {
      // ±1 SD band around the trend; the lower edge fills up to the upper one.
      // It widens through gaps (the trend gets less certain) and fades with time since a reading.
      const edge = (sign) => shown.map((p) => ({ x: p.x, y: p.trend + sign * p.sd }));
      const edgeStyle = { ...lineStyle, borderColor: (context) => bandColor(context.chart, 0.3), borderWidth: 1, borderDash: [4, 3] };
      datasets.push({ ...edgeStyle, label: 'Error high', data: edge(1) });
      datasets.push({ ...edgeStyle, label: 'Error low', data: edge(-1), fill: '-1', backgroundColor: (context) => bandColor(context.chart, 0.1) });
    }
    if (showLineBox.checked && shown.length) {
      datasets.push({ ...lineStyle, label: 'Trend', data: shown.map((p) => ({ x: p.x, y: p.trend })), borderColor: 'red', borderWidth: 2 });
    } else if (showLineBox.checked && !model && points.length > 1) {
      // Too few readings to fit the model: just join them up
      datasets.push({ ...lineStyle, label: 'Trend', data: points, borderColor: 'red', borderWidth: 2 });
    }
    hovered = null;
    renderStats(metric);

    // With the model the axis runs on to now, so the estimate covers time since the last reading.
    // The right-hand AXIS_FUTURE_SHARE of the axis is left empty, for the future.
    const axisMin = shown.length ? Math.max(viewStart, shown[0].x) : (points.length ? points[0].x : emptyStart);
    const dataEnd = shown.length ? shown[shown.length - 1].x : (points.length ? points[points.length - 1].x : emptyEnd);
    const axisMax = dataEnd + (dataEnd - axisMin) * (AXIS_FUTURE_SHARE / (1 - AXIS_FUTURE_SHARE));
    const formatTooltipDate = (time) => new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      // The stats panel follows the pointer: the model's estimate and error at that date
      onHover: (event, elements, chartInstance) => {
        if (!shown.length || !chartInstance.scales?.x) return;
        const time = chartInstance.scales.x.getValueForPixel(event.x);
        let low = 0;
        let high = shown.length - 1;
        while (low < high) {
          const mid = (low + high) >> 1;
          if (shown[mid].x < time) low = mid + 1; else high = mid;
        }
        const nearest = low > 0 && Math.abs(shown[low - 1].x - time) < Math.abs(shown[low].x - time) ? shown[low - 1] : shown[low];
        if (nearest !== hovered) {
          hovered = nearest;
          renderStats(metric);
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: (item) => item.datasetIndex === 0,
          callbacks: { title: (items) => (items.length ? formatTooltipDate(items[0].parsed.x) : '') }
        }
      },
      scales: {
        x: {
          type: 'time',
          min: axisMin,
          max: axisMax,
          time: { unit: 'day', displayFormats: { day: 'dd MMM yyyy' } },
          ticks: { autoSkip: true, maxTicksLimit: 8 },
          title: { display: true, text: 'Date' }
        },
        y: {
          beginAtZero: false,
          title: { display: true, text: metricLabel(metric) }
        }
      }
    };

    try {
      if (chart) chart.destroy();
      chart = new window.Chart(chartCanvas, { type: 'line', data: { datasets }, options });
    } catch (error) {
      // Without the date adapter, fall back to a plain number axis labelled with dates
      console.error('Bio chart time axis failed, using a plain axis:', error);
      if (chart) chart.destroy();
      options.scales.x = { type: 'linear', min: options.scales.x.min, max: options.scales.x.max, ticks: { callback: formatTooltipDate, maxTicksLimit: 8 }, title: { display: true, text: 'Date' } };
      chart = new window.Chart(chartCanvas, { type: 'line', data: { datasets }, options });
    }
  }

  async function saveEntry() {
    // Default is now; an earlier day picked with "Change date" is saved without a time
    const pickedDate = dateInput.hidden ? '' : dateInput.value;
    const backdated = /^\d{4}-\d{2}-\d{2}$/.test(pickedDate) && pickedDate !== today();
    const date = backdated ? pickedDate : today();
    const value = parseFloat(valueInput.value);
    if (!Number.isFinite(value)) {
      notify('Enter a number.');
      return;
    }
    const entry = backdated ? { date, value } : { date, value, time: Date.now() };
    const key = newId();
    saveEntryBtn.disabled = true;
    try {
      await window.database.ref('bio').update({ ...metricUpdates(), [`entries/${selectedId}/${key}`]: entry });
      metricsSaved = true;
      (entriesByMetric[selectedId] ||= {})[key] = entry;
      valueInput.value = '';
      setDatePickerOpen(false);
      render();
      valueInput.focus();
    } catch (error) {
      notify(`Could not save: ${error.message}`);
    } finally {
      saveEntryBtn.disabled = false;
    }
  }

  async function deleteEntry(button) {
    const key = button.dataset.key;
    if (window.confirmInPlace && !(await window.confirmInPlace(button, { question: 'Delete?' }))) return;
    try {
      await window.database.ref(`bio/entries/${selectedId}/${key}`).remove();
      delete entriesByMetric[selectedId]?.[key];
      render();
    } catch (error) {
      notify(`Could not delete: ${error.message}`);
    }
  }

  function setDatePickerOpen(open) {
    dateInput.hidden = !open;
    dateToggle.setAttribute('aria-expanded', String(open));
    dateToggle.textContent = open ? 'Use today' : 'Change date';
    dateInput.value = today();
    if (open) dateInput.focus();
  }

  function setAddMetricOpen(open) {
    addMetricForm.hidden = !open;
    renderChips();
    if (open) {
      metricNameInput.value = '';
      metricUnitInput.value = '';
      metricNameInput.focus();
    }
  }

  async function addMetric() {
    const name = metricNameInput.value.trim();
    const unit = metricUnitInput.value.trim();
    if (!name) {
      notify('Give the measurement a name.');
      return;
    }
    if (Object.values(metrics).some((metric) => metric.name.toLowerCase() === name.toLowerCase())) {
      notify(`You already track ${name}.`);
      return;
    }
    const id = newId();
    try {
      await window.database.ref('bio').update({ ...metricUpdates(), [`metrics/${id}`]: { name, unit } });
      metricsSaved = true;
      metrics[id] = { name, unit };
      selectedId = id;
      setAddMetricOpen(false);
      render();
      saveSettings();
      valueInput.focus();
    } catch (error) {
      notify(`Could not add: ${error.message}`);
    }
  }

  async function removeMetric(metricId, button) {
    const metric = metrics[metricId];
    if (!metric) return;
    const count = sortedEntries(metricId).length;
    const question = count ? `Remove ${metric.name} and its ${count} ${count === 1 ? 'entry' : 'entries'}?` : `Remove ${metric.name}?`;
    if (window.confirmInPlace && !(await window.confirmInPlace(button, { question }))) return;
    const remaining = Object.fromEntries(Object.entries(metrics).filter(([id]) => id !== metricId));
    try {
      // Removing the last one brings back the default (weight) on the next load
      const updates = { [`entries/${metricId}`]: null };
      if (metricsSaved) updates[`metrics/${metricId}`] = null;
      await window.database.ref('bio').update(updates);
      delete entriesByMetric[metricId];
      metrics = Object.keys(remaining).length ? remaining : { ...DEFAULT_METRICS };
      metricsSaved = Object.keys(remaining).length > 0 && metricsSaved;
      if (!metrics[selectedId]) selectedId = Object.keys(metrics)[0];
      render();
      saveSettings();
    } catch (error) {
      notify(`Could not remove: ${error.message}`);
    }
  }

  // Points and line can be shown together or alone, but not both off
  function onChartToggle(changed, other) {
    if (!changed.checked && !other.checked) other.checked = true;
    render();
    saveSettings();
  }

  tab.addEventListener('click', () => {
    area.classList.toggle('hidden');
    if (area.classList.contains('hidden')) return;
    if (!chart) renderChart(metrics[selectedId] || DEFAULT_METRICS.weight, []); // empty chart while loading
    loadBio();
  });
  metricChips.addEventListener('click', (event) => {
    const select = event.target.closest('.bio-chip-select');
    const remove = event.target.closest('.bio-chip-remove');
    if (event.target.closest('.bio-chip-add')) {
      setAddMetricOpen(true);
    } else if (remove) {
      removeMetric(remove.dataset.id, remove);
    } else if (select && select.dataset.id !== selectedId) {
      selectedId = select.dataset.id;
      render();
      saveSettings();
    }
  });
  el('bioCancelMetricBtn').addEventListener('click', () => setAddMetricOpen(false));
  el('bioSaveMetricBtn').addEventListener('click', addMetric);
  [metricNameInput, metricUnitInput].forEach((input) => input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); addMetric(); }
    if (event.key === 'Escape') setAddMetricOpen(false);
  }));
  showPointsBox.addEventListener('change', () => onChartToggle(showPointsBox, showLineBox));
  showLineBox.addEventListener('change', () => onChartToggle(showLineBox, showPointsBox));
  chartCanvas.addEventListener('mouseleave', () => {
    if (!hovered) return;
    hovered = null;
    renderStats(metrics[selectedId] || { name: '', unit: '' });
  });
  showSpreadBox.addEventListener('change', () => {
    render();
    saveSettings();
  });
  zoomSelect.addEventListener('change', () => {
    render();
    saveSettings();
  });
  saveEntryBtn.addEventListener('click', saveEntry);
  dateToggle.addEventListener('click', () => setDatePickerOpen(dateInput.hidden));
  valueInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); saveEntry(); }
  });
  entryList.addEventListener('click', (event) => {
    const button = event.target.closest('.bio-delete-entry');
    if (button) deleteEntry(button);
  });
})();
