// Metrics tab (named "bio" in code and data): any body measurement the user wants to log as numbers
// over time (weight by default). Data lives under bio/: metrics/{id} = { name, unit },
// entries/{metricId}/{entryId} = { date, value }.
// Chart display choices (points and/or trend line, zoom period, selected measurement) live in settings/bio.
(function () {
  const DEFAULT_METRICS = { weight: { name: 'Weight', unit: 'kg' } };
  const CHART_COLOR = '#176b45';
  // Points, trend line and error band colours, unless the measurement has its own (metrics/{id}.pointColor / .lineColor / .bandColor)
  const DEFAULT_POINT_COLOR = '#000000';
  const DEFAULT_LINE_COLOR = '#ff0000';
  const DEFAULT_BAND_COLOR = '#dc0000';
  const pointColorOf = (metric) => (/^#[0-9a-f]{6}$/i.test(metric?.pointColor || '') ? metric.pointColor : DEFAULT_POINT_COLOR);
  const lineColorOf = (metric) => (/^#[0-9a-f]{6}$/i.test(metric?.lineColor || '') ? metric.lineColor : DEFAULT_LINE_COLOR);
  const bandColorOf = (metric) => (/^#[0-9a-f]{6}$/i.test(metric?.bandColor || '') ? metric.bandColor : DEFAULT_BAND_COLOR);
  // Chart.js draws lower 'order' on top; everything else is 0, so this puts the trend over the dots and band
  const TREND_ORDER = -1;
  const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');

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
  // Each Metric remembers whether its points, trend and error are shown (metrics/{id}.showPoints / ...)
  const VISIBILITY = [[showPointsBox, 'showPoints'], [showLineBox, 'showLine'], [showSpreadBox, 'showSpread']];
  const visibilityDefaults = { showPoints: true, showLine: true, showSpread: true };
  const visibleOf = (metric, key) => (typeof metric?.[key] === 'boolean' ? metric[key] : visibilityDefaults[key]);
  const pointColorInput = el('bioPointColor');
  const lineColorInput = el('bioLineColor');
  const bandColorInput = el('bioBandColor');
  const zoomSelect = el('bioZoomSelect');
  const dateInput = el('bioEntryDate');
  const dateToggle = el('bioDateToggle');
  const valueInput = el('bioEntryValue');
  const saveEntryBtn = el('bioSaveEntryBtn');
  const openEntryBtn = el('bioOpenEntryBtn');
  const entryRow = el('bioEntryRow');
  const chartCanvas = el('bioChart');
  const statsPanel = el('bioStats');
  const emptyHint = el('bioEmpty');
  const entryList = el('bioEntryList');
  const entriesBox = el('bioEntries');
  const entryCount = el('bioEntryCount');

  let metrics = {};
  let metricsSaved = false; // false while only the built-in defaults exist (nothing stored yet)
  let entriesByMetric = {};
  let selectedId = '';
  let chart = null;
  let model = null; // fitted trend and error model for the selected measurement (null with too few readings)
  let shown = []; // the model's estimates within the zoom period
  let hovered = null; // the estimate under the pointer, shown in the stats panel
  let pinned = null; // the estimate clicked on, kept in the stats panel until clicked again

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
        zoom: zoomSelect.value,
        metric: selectedId
      });
    } catch (error) {
      console.error('Could not save Metrics settings:', error);
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
      // Skip any measurement without a name (e.g. a removed one left behind as null)
      const savedMetrics = Object.fromEntries(Object.entries(bio.metrics || {})
        .filter(([, metric]) => metric && typeof metric.name === 'string'));
      metricsSaved = Object.keys(savedMetrics).length > 0;
      metrics = metricsSaved ? savedMetrics : { ...DEFAULT_METRICS };
      entriesByMetric = bio.entries || {};
      // Visibility used to be shared by all Metrics; it's still the default for any Metric without its own
      VISIBILITY.forEach(([, key]) => {
        if (typeof settings[key] === 'boolean') visibilityDefaults[key] = settings[key];
      });
      if (settings.zoom && [...zoomSelect.options].some((option) => option.value === settings.zoom)) zoomSelect.value = settings.zoom;
      if (!selectedId || !metrics[selectedId]) selectedId = metrics[settings.metric] ? settings.metric : Object.keys(metrics)[0];
      render();
    } catch (error) {
      console.error('Could not load Metrics data:', error);
      if (entriesBox) entriesBox.open = true; // so the error is seen
      entryList.innerHTML = `<li class="exo-hint">${escapeHtml(error.message || 'Could not load your Measurements.')}</li>`;
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
    VISIBILITY.forEach(([box, key]) => { box.checked = visibleOf(metric, key); });
    pointColorInput.value = pointColorOf(metric);
    lineColorInput.value = lineColorOf(metric);
    bandColorInput.value = bandColorOf(metric);

    const entries = sortedEntries(selectedId);
    const inPeriod = zoomedPoints(entries).length;
    emptyHint.textContent = entries.length ? "No Measurements in this period." : "No Measurements yet. Add one to start the chart.";
    emptyHint.hidden = inPeriod > 0;
    renderChart(metric, entries);
    if (entryCount) entryCount.textContent = `(${entries.length})`;
    entryList.innerHTML = [...entries].reverse().map((entry) => `
      <li>
        <span>${escapeHtml(formatDate(entry.date))}</span>
        <strong>${escapeHtml(entry.value)}${metric.unit ? ` ${escapeHtml(metric.unit)}` : ''}</strong>
        <button type="button" class="btn btn-sm btn-outline-danger bio-delete-entry" data-key="${escapeHtml(entry.key)}" aria-label="Delete Measurement from ${escapeHtml(formatDate(entry.date))}">×</button>
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
  const MODEL_MIN_READINGS = 5; // the trend line appears from here
  const ERROR_MIN_READINGS = 8; // the error band and ± figures appear from here
  // The day counts below (BAND_WINDOW_DAYS, BAND_COVERAGE_DAYS) were tuned on the
  // weight history, about CADENCE_REFERENCE_DAYS between readings. Measurements read less often
  // stretch them in proportion to their typical gap, so with one reading a month the band doesn't
  // treat every day between readings as a long gap.
  const CADENCE_REFERENCE_DAYS = 1.5;
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
  // What the shaded band shows. With plenty of frequent readings: where a reading would land (sd).
  // With few or infrequent ones that is mostly the readings' own scatter, about as wide everywhere,
  // so the band shows how sure the trend line itself is instead. Between the two it blends:
  // by count (all trend certainty at ERROR_MIN_READINGS, all reading range at BAND_READINGS_FULL_COUNT)
  // times by cadence (all reading range up to BAND_STRETCH_FULL × the reference gap, all trend
  // certainty from BAND_STRETCH_NONE ×, i.e. about daily to fortnightly readings).
  const BAND_WINDOW_SPAN_SHARE = 1 / 6;
  // The drawn band bulges out (on that side only) to take in any reading beyond ±1 SD, plus
  // BAND_WARP_MARGIN, easing back over about BAND_WARP_GAPS typical gaps between readings, or
  // a share of the whole history if that's longer: BAND_WARP_SPAN_SHARE at BAND_WARP_BASE_READINGS
  // readings, growing with √readings up to BAND_WARP_SPAN_SHARE_MAX. So the more readings, the broader
  // and gentler the swells (a lone outlier in lots of data shouldn't make a sharp bump), while
  // every reading still sits inside the band.
  const BAND_WARP_GAPS = 1.5;
  const BAND_WARP_SPAN_SHARE = 1 / 50;
  const BAND_WARP_BASE_READINGS = 30;
  const BAND_WARP_SPAN_SHARE_MAX = 1 / 8;
  const BAND_WARP_MARGIN = 1.08;
  const BAND_READINGS_FULL_COUNT = 30;
  const BAND_STRETCH_FULL = 2;
  const BAND_STRETCH_NONE = 10;

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

  // Trend bendiness prior. With few readings the fit can't tell trend from noise and tends to give
  // up on the trend (a straight line) or thread it through every reading. So the fit is nudged
  // towards a trend that averages over about TREND_PRIOR_SPACINGS × the typical gap between
  // readings. The nudge is firm at MODEL_MIN_READINGS readings and fades in proportion to the count
  // (TREND_PRIOR_SD wide in log10 smoothing width at 5 readings, 1.5 at 150), so long histories fit
  // on their own: on the 2-year weight history the trend's smoothing width moves 11.4 -> 11.0 days.
  const TREND_PRIOR_SPACINGS = 0.7;
  const TREND_PRIOR_SD = 0.05;

  // Maximum likelihood (with the prior above): try a spread of starting guesses, then refine the best few
  function fitModel(obs) {
    const ys = obs.map((o) => o.y);
    const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
    const variance = Math.max(1e-6, ys.reduce((a, b) => a + (b - mean) ** 2, 0) / ys.length);
    const gaps = obs.slice(1).map((o, i) => o.t - obs[i].t).sort((a, b) => a - b);
    const spacing = Math.max(0.05, gaps[Math.floor(gaps.length / 2)]);
    const priorSd = TREND_PRIOR_SD * (obs.length / MODEL_MIN_READINGS);
    // Searched in log10 units, relative to the readings' overall variance so any unit works
    const toParams = ([lq, ls, ll, lr]) => ({ q: variance * 10 ** lq, s2: variance * 10 ** ls, ell: 10 ** ll, r: variance * 10 ** lr });
    const score = (x) => {
      const value = runFilter(obs, [], toParams(x), false).logLik;
      // The trend averages over about ((swing + noise) × spacing / q)^(1/4) days, like a smoothing spline
      const [lq, ls, , lr] = x;
      const widthOff = (Math.log10((10 ** ls + 10 ** lr) * spacing) - lq) / 4 - Math.log10(TREND_PRIOR_SPACINGS * spacing);
      return Number.isFinite(value) ? value - 0.5 * (widthOff / priorSd) ** 2 : -Infinity;
    };
    const starts = [];
    for (const lq of [-9, -7, -5, -3, -1]) for (const ls of [-2.5, -1.5, -0.5]) for (const ll of [0.25, 0.75, 1.25, 1.75]) for (const lr of [-2.5, -1.5]) {
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
  // moment from the first reading to now: { x, trend, sd, bandSd (the shaded band), slope, slopeSd, prev, next }
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
    // All of these windows are stretched for measurements read less often (see CADENCE_REFERENCE_DAYS)
    const gaps = obs.slice(1).map((o, i) => o.t - obs[i].t).sort((a, b) => a - b);
    const stretch = Math.max(1, gaps[Math.floor(gaps.length / 2)] / CADENCE_REFERENCE_DAYS);
    const coverageDays = BAND_COVERAGE_DAYS * stretch;
    // The local window is also capped at BAND_WINDOW_SPAN_SHARE of the history, so a short or sparse
    // history still shows calm and swinging stretches apart rather than averaging over everything
    const bandWindowDays = Math.min(BAND_WINDOW_DAYS * stretch, Math.max(1, obs[obs.length - 1].t - obs[0].t) * BAND_WINDOW_SPAN_SHARE);
    const residuals = smoothed.filter((state) => state.y !== null).map((state) => ({ t: state.t, square: (state.y - state.m[0]) ** 2 }));
    const overallSquare = residuals.reduce((sum, item) => sum + item.square, 0) / residuals.length;
    const localSquare = (t) => {
      let weightSum = 0;
      let squareSum = 0;
      residuals.forEach((item) => {
        const dx = (item.t - t) / bandWindowDays;
        const weight = Math.exp(-0.5 * dx * dx);
        weightSum += weight;
        squareSum += weight * item.square;
      });
      return (squareSum + BAND_PRIOR_READINGS * overallSquare) / (weightSum + BAND_PRIOR_READINGS);
    };

    const clamp01 = (value) => Math.min(1, Math.max(0, value));
    const readingRangeShare = clamp01((obs.length - ERROR_MIN_READINGS) / (BAND_READINGS_FULL_COUNT - ERROR_MIN_READINGS))
      * clamp01(Math.log(BAND_STRETCH_NONE / stretch) / Math.log(BAND_STRETCH_NONE / BAND_STRETCH_FULL));

    // Outlier bulges: each reading's signed distance from the trend, spread to nearby moments
    // with a Gaussian BAND_WARP_GAPS typical gaps wide (see BAND_WARP_GAPS)
    const warpSpanShare = Math.min(BAND_WARP_SPAN_SHARE_MAX, BAND_WARP_SPAN_SHARE * Math.sqrt(obs.length / BAND_WARP_BASE_READINGS));
    const warpDays = Math.max(0.25, BAND_WARP_GAPS * gaps[Math.floor(gaps.length / 2)], warpSpanShare * (obs[obs.length - 1].t - obs[0].t));
    const offsets = smoothed.filter((state) => state.y !== null).map((state) => ({ t: state.t, offset: state.y - state.m[0] }));
    const reachAt = (t, side) => offsets.reduce((most, item) => {
      if (item.offset * side <= 0) return most;
      const dx = (item.t - t) / warpDays;
      return dx * dx > 18 ? most : Math.max(most, Math.abs(item.offset) * BAND_WARP_MARGIN * Math.exp(-0.5 * dx * dx));
    }, 0);
    const softMax = (a, b) => (a ** 4 + b ** 4) ** 0.25;

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
        const coverage = readingTimes.reduce((sum, time) => sum + Math.exp(-0.5 * ((time - t) / coverageDays) ** 2), 0);
        // Days equivalent (in unstretched days): BAND_COVERAGE_DAYS × √(2 ln(full / coverage)), with
        // the cut-off at full coverage rounded off (a soft maximum) so the band's edge has no corner there
        const shortfall = Math.log(BAND_FULL_READINGS / Math.max(coverage, 1e-300));
        const softShortfall = shortfall > 20 ? shortfall : Math.log1p(Math.exp(3 * shortfall)) / 3;
        const daysAway = BAND_COVERAGE_DAYS * Math.sqrt(2 * softShortfall);
        const local = localSquare(t);
        const readingVariance = local + BAND_GAP_GROWTH * overallSquare * daysAway;
        // The trend's own uncertainty assumes one swing size throughout; scale it by how much
        // readings swing around here compared with overall, so calm stretches get a narrower band
        const localTrendVariance = trendVariance * (overallSquare > 0 ? local / overallSquare : 1);
        const bandSd = Math.sqrt(localTrendVariance + readingRangeShare * readingVariance);
        return {
          x: t * DAY_MS,
          coverage,
          trend: m[0],
          sd: Math.sqrt(trendVariance + readingVariance),
          bandSd,
          // The drawn band's half-widths above and below, bulging to take in readings outside ±bandSd
          bandUp: softMax(bandSd, reachAt(t, 1)),
          bandDown: softMax(bandSd, reachAt(t, -1)),
          slope: m[1],
          slopeSd: Math.sqrt(Math.max(0, P[5])),
          prev: nextIndex > 0 ? readingTimes[nextIndex - 1] * DAY_MS : null,
          next: nextIndex < readingTimes.length ? readingTimes[nextIndex] * DAY_MS : null
        };
      });
    // How many readings land within ±bandSd of the trend (each checked at the nearest estimate)
    let withinCount = 0;
    let at = 0;
    obs.forEach(({ t, y }) => {
      const time = t * DAY_MS;
      while (at < estimates.length - 1 && Math.abs(estimates[at + 1].x - time) <= Math.abs(estimates[at].x - time)) at++;
      const point = estimates[at];
      if (point && Math.abs(y - point.trend) <= point.bandSd) withinCount++;
    });
    return {
      params,
      estimates,
      count: obs.length,
      withinCount,
      hasError: obs.length >= ERROR_MIN_READINGS,
      readingRangeShare,
      scatter: Math.sqrt(overallSquare) // typical distance of readings from the trend (not shown at the moment)
    };
  }

  // Numbers beside the chart: the latest reading, then the trend line and its error now and at
  // the date under the pointer (or pinned by a click). The ± matches the shaded band.
  function renderStats(metric) {
    if (!statsPanel) return;
    const entries = sortedEntries(selectedId);
    const count = entries.length;
    const unit = metric.unit ? ` ${escapeHtml(metric.unit)}` : '';
    const value = (number) => escapeHtml(number.toFixed(1));
    const error = (number) => escapeHtml(number < 1 ? number.toFixed(2) : number.toFixed(1));
    const dateLabel = (time) => new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const latest = entries[count - 1];
    let latestBlock = '';
    if (latest) {
      const daysAgo = Math.round((toTime(today()) - toTime(latest.date)) / DAY_MS);
      const when = daysAgo <= 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`;
      latestBlock = `
        <div class="bio-stat-block">
          <div class="bio-stat-heading">Latest Measurement · ${dateLabel(toTime(latest.date))}</div>
          <div class="bio-stat-value">${escapeHtml(latest.value)} <small>${unit}</small></div>
          <div class="bio-stat-line">${when}</div>
        </div>`;
    }

    if (!model) {
      statsPanel.innerHTML = count
        ? `${latestBlock}<p class="bio-stat-hint">The trend appears once there are ${MODEL_MIN_READINGS} Measurements, and its error at ${ERROR_MIN_READINGS} (${count} so far).</p>`
        : '';
      return;
    }

    const pointBlock = (point, heading, tooltip = '') => {
      const perWeek = point.slope * 7;
      const change = `${perWeek >= 0 ? '+' : '−'}${error(Math.abs(perWeek))}`;
      return `
        <div class="bio-stat-block"${tooltip ? ` title="${escapeHtml(tooltip)}"` : ''}>
          <div class="bio-stat-heading">${escapeHtml(heading)}</div>
          <div class="bio-stat-value">${value(point.trend)} <small>${model.hasError ? `± ${error(point.bandSd)}` : ''}${unit}</small></div>
          <div class="bio-stat-line">Changing ${change}${unit}/week</div>
        </div>`;
    };

    // Same shape as a point block, so the panel keeps its height and the page doesn't jump on hover
    const emptyPointBlock = `
        <div class="bio-stat-block">
          <div class="bio-stat-heading">Trend at pointer</div>
          <div class="bio-stat-value"><small>Point at the chart for any date</small></div>
          <div class="bio-stat-line">Click to keep it here</div>
        </div>`;
    const now = model.estimates[model.estimates.length - 1];
    let atPointer = emptyPointBlock;
    if (pinned) atPointer = pointBlock(pinned, `Trend pinned · ${dateLabel(pinned.x)}`, 'Click the chart again to release');
    else if (hovered) atPointer = pointBlock(hovered, `Trend at pointer · ${dateLabel(hovered.x)}`);
    const pointBlocks = `
      ${latestBlock}
      ${pointBlock(now, `Trend now · ${dateLabel(now.x)}`)}
      ${atPointer}`;

    if (!model.hasError) {
      statsPanel.innerHTML = `${pointBlocks}
      <p class="bio-stat-hint">The error appears once there are ${ERROR_MIN_READINGS} Measurements (${model.count} so far).</p>`;
      return;
    }

    statsPanel.innerHTML = `${pointBlocks}
      <p class="bio-stat-hint">± is roughly one standard deviation: ${model.withinCount} of ${model.count} Measurements land within it.</p>`;
  }

  // Empty space on each side of the chart, as a share of the axis: CHART_PAD_MAX with one
  // reading, easing down to CHART_PAD_MIN at CHART_PAD_READINGS readings in view
  const CHART_PAD_MAX = 0.3;
  const CHART_PAD_MIN = 0.05;
  const CHART_PAD_READINGS = 10;

  function chartPad(readings) {
    const progress = Math.min(1, Math.max(0, (readings - 1) / (CHART_PAD_READINGS - 1)));
    return CHART_PAD_MAX + (CHART_PAD_MIN - CHART_PAD_MAX) * progress;
  }

  // Axis limits leaving `pad` of the axis empty beyond each end of [low, high]
  function paddedRange(low, high, pad, fallbackSpan) {
    const range = high - low || fallbackSpan;
    const middle = (low + high) / 2;
    const half = range / 2 / (1 - 2 * pad);
    return { min: middle - half, max: middle + half };
  }

  // Date axis ticks on obvious calendar points: the finest step from CALENDAR_STEPS that leaves at
  // most `maxTicks` ticks, each aligned to its calendar (weeks start on Mondays, 3 months on
  // Jan/Apr/Jul/Oct, 2 years on even years, ...). Local time, so ticks sit on local midnight.
  const TICK_LABEL_PX = 80; // room per label
  const CALENDAR_STEPS = [
    { unit: 'day', count: 1 }, { unit: 'day', count: 2 },
    { unit: 'week', count: 1 }, { unit: 'week', count: 2 },
    { unit: 'month', count: 1 }, { unit: 'month', count: 2 }, { unit: 'month', count: 3 }, { unit: 'month', count: 6 },
    { unit: 'year', count: 1 }, { unit: 'year', count: 2 }, { unit: 'year', count: 5 }, { unit: 'year', count: 10 }
  ];
  const WEEK_MS = 7 * DAY_MS;
  const MONDAY_EPOCH = new Date(2024, 0, 1).getTime(); // a Monday, so fortnights line up the same way every time

  function firstCalendarTick(time, { unit, count }) {
    const date = new Date(time);
    if (unit === 'day' || unit === 'week') {
      date.setHours(0, 0, 0, 0);
      if (unit === 'week') {
        date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); // back to Monday
        const weeks = Math.round((date.getTime() - MONDAY_EPOCH) / WEEK_MS);
        date.setDate(date.getDate() - 7 * (((weeks % count) + count) % count));
      } else if (count > 1) {
        const days = Math.round((date.getTime() - MONDAY_EPOCH) / DAY_MS);
        date.setDate(date.getDate() - (((days % count) + count) % count));
      }
    } else if (unit === 'month') {
      return new Date(date.getFullYear(), date.getMonth() - (date.getMonth() % count), 1);
    } else {
      return new Date(date.getFullYear() - (date.getFullYear() % count), 0, 1);
    }
    return date;
  }

  function nextCalendarTick(date, { unit, count }) {
    if (unit === 'day') return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
    if (unit === 'week') return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7 * count);
    if (unit === 'month') return new Date(date.getFullYear(), date.getMonth() + count, 1);
    return new Date(date.getFullYear() + count, 0, 1);
  }

  function calendarTicks(min, max, maxTicks) {
    const build = (step) => {
      const ticks = [];
      for (let date = firstCalendarTick(min, step); date.getTime() <= max && ticks.length <= maxTicks; date = nextCalendarTick(date, step)) {
        if (date.getTime() >= min) ticks.push(date.getTime());
      }
      return ticks;
    };
    for (const step of CALENDAR_STEPS) {
      const ticks = build(step);
      if (ticks.length <= maxTicks) return { ...step, ticks };
    }
    const last = CALENDAR_STEPS[CALENDAR_STEPS.length - 1];
    return { ...last, ticks: build(last) };
  }

  // Days and weeks: "5 Oct", months: "Oct", years: "2026"; the year is added on the first
  // label and wherever it changes
  function calendarTickLabel(value, index, step) {
    const date = new Date(value);
    if (!step || step.unit === 'year') return String(date.getFullYear());
    const previous = index > 0 ? new Date(step.ticks[index - 1]) : null;
    const showYear = !previous || previous.getFullYear() !== date.getFullYear();
    const options = step.unit === 'month' ? { month: 'short' } : { day: 'numeric', month: 'short' };
    if (showYear) options.year = 'numeric';
    return date.toLocaleDateString('en-GB', options);
  }

  // Previous fade, by days from the nearest reading (one reading brought it back fully):
  // // The error band fades the further it is from a reading: full strength within TRACKING_DAYS,
  // // then halving about every BAND_FADE_HALF_DAYS, down to a faint floor so it never quite vanishes
  // const BAND_FADE_HALF_DAYS = 10;
  // The error band fades with reading coverage (see BAND_COVERAGE_DAYS): full strength at
  // BAND_FULL_READINGS or more, a third for a lone reading, down to a faint floor in long gaps
  const BAND_FADE_FLOOR = 0.06;
  // Light pink fill fading gently to white towards the dashed edges: nested layers reaching these
  // shares of the band's half-width, each BAND_LAYER_ALPHA opaque (about 0.1 in the middle third)
  const BAND_LAYER_SHARES = [1, 0.86, 0.72, 0.58, 0.44, 0.3];
  const BAND_LAYER_ALPHA = 0.018;
  const BAND_EDGE_ALPHA = 0.3; // the dashed ±1 SD edge lines
  const BAND_FADE_MAX_STOPS = 300;
  let bandPoints = []; // what the band is drawn through: { x, trend, bandSd, strength }

  // Previous strength, by days from the nearest reading:
  // const nearest = Math.min(...[point.prev, point.next].filter((time) => time !== null).map((time) => Math.abs(time - point.x)));
  // const daysAway = Math.max(0, nearest / DAY_MS - TRACKING_DAYS);
  // const strength = Math.max(BAND_FADE_FLOOR, 0.5 ** (daysAway / BAND_FADE_HALF_DAYS));
  // const bandStrength = (point) => Math.max(BAND_FADE_FLOOR, Math.min(1, point.coverage / BAND_FULL_READINGS));
  // Eased (smoothstep) between the faint floor and full strength, so the fade has no corners at either end
  const bandStrength = (point) => {
    const share = Math.min(1, point.coverage / BAND_FULL_READINGS);
    return BAND_FADE_FLOOR + (1 - BAND_FADE_FLOOR) * share * share * (3 - 2 * share);
  };

  function buildBandPoints() {
    return shown.map((p) => ({ x: p.x, trend: p.trend, up: p.bandUp, down: p.bandDown, strength: bandStrength(p) }));
  }

  // Colour fading left to right with each point's strength. Chart.js asks for it again and again,
  // so each gradient is built once per band and chart layout, then reused.
  let bandColorCache = new Map();
  let bandRgb = hexToRgb(DEFAULT_BAND_COLOR); // the selected measurement's band colour, as "r, g, b"
  function bandColor(chartInstance, baseAlpha) {
    const solid = `rgba(${bandRgb}, ${baseAlpha})`;
    const area = chartInstance.chartArea;
    const xScale = chartInstance.scales?.x;
    if (!area || !xScale || !bandPoints.length || area.right <= area.left) return solid;
    const key = `${baseAlpha}|${area.left}|${area.right}|${xScale.min}|${xScale.max}`;
    if (bandColorCache.has(key)) return bandColorCache.get(key);
    const gradient = chartInstance.ctx.createLinearGradient(area.left, 0, area.right, 0);
    const every = Math.max(1, Math.ceil(bandPoints.length / BAND_FADE_MAX_STOPS));
    let lastOffset = -1;
    bandPoints.forEach((point, i) => {
      if (i % every && i !== bandPoints.length - 1) return;
      const offset = (xScale.getPixelForValue(point.x) - area.left) / (area.right - area.left);
      if (offset < 0 || offset > 1 || offset <= lastOffset) return;
      lastOffset = offset;
      gradient.addColorStop(offset, `rgba(${bandRgb}, ${(baseAlpha * point.strength).toFixed(3)})`);
    });
    const color = lastOffset < 0 ? solid : gradient;
    bandColorCache.set(key, color);
    return color;
  }

  // The model estimate nearest the date under an x pixel on the chart
  function estimateAtPixel(chartInstance, pixel) {
    if (!shown.length || !chartInstance.scales?.x) return null;
    const time = chartInstance.scales.x.getValueForPixel(pixel);
    let low = 0;
    let high = shown.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (shown[mid].x < time) low = mid + 1; else high = mid;
    }
    return low > 0 && Math.abs(shown[low - 1].x - time) < Math.abs(shown[low].x - time) ? shown[low - 1] : shown[low];
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
      pointBackgroundColor: pointColorOf(metric),
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
    // Fixed point colours, so Chart.js doesn't work out the band's colour once per (invisible) point
    const lineStyle = { pointRadius: 0, pointHitRadius: 0, pointBackgroundColor: 'transparent', pointBorderColor: 'transparent', tension: 0, fill: false };

    // With the model the axis runs on to now, so the estimate covers time since the last reading.
    // Each side gets chartPad() of empty space: a lot with few readings, 5% from 10 on.
    const pad = chartPad(points.length);
    const dataStart = shown.length ? Math.max(viewStart, shown[0].x) : (points.length ? points[0].x : emptyStart);
    const dataEnd = shown.length ? shown[shown.length - 1].x : (points.length ? points[points.length - 1].x : emptyEnd);
    const xRange = paddedRange(dataStart, dataEnd, pad, 2 * DAY_MS);
    const axisMin = xRange.min;
    const axisMax = xRange.max;
    bandPoints = [];
    bandColorCache = new Map();
    bandRgb = hexToRgb(bandColorOf(metric));
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
    if (showSpreadBox.checked && shown.length && model.hasError) {
      // ±1 SD band around the trend (bandSd, see BAND_READINGS_FULL_COUNT); the lower edge fills up to
      // the upper one. It widens through gaps (the trend gets less certain) and fades with time since a reading.
      // The fill is a few nested layers (BAND_LAYER_SHARES), so it softens just inside the dashed edges.
      bandPoints = buildBandPoints();
      const edge = (sign, share) => bandPoints.map((p) => ({ x: p.x, y: p.trend + sign * share * (sign > 0 ? p.up : p.down) }));
      const layerStyle = { ...lineStyle, borderWidth: 0 };
      BAND_LAYER_SHARES.forEach((share, layer) => {
        datasets.push({ ...layerStyle, label: `Error high ${layer}`, data: edge(1, share) });
        datasets.push({ ...layerStyle, label: `Error low ${layer}`, data: edge(-1, share), fill: '-1', backgroundColor: (context) => bandColor(context.chart, BAND_LAYER_ALPHA) });
      });
      // Dashed lines marking the ±1 SD edges
      const edgeStyle = { ...lineStyle, borderColor: (context) => bandColor(context.chart, BAND_EDGE_ALPHA), borderWidth: 1, borderDash: [4, 3] };
      datasets.push({ ...edgeStyle, label: 'Error high', data: edge(1, 1) });
      datasets.push({ ...edgeStyle, label: 'Error low', data: edge(-1, 1) });
    }
    if (showLineBox.checked && shown.length) {
      datasets.push({ ...lineStyle, label: 'Trend', data: shown.map((p) => ({ x: p.x, y: p.trend })), borderColor: lineColorOf(metric), borderWidth: 2, order: TREND_ORDER });
    } else if (showLineBox.checked && !model && points.length > 1) {
      // Too few readings to fit the model: join them with a smooth curve (monotone, so it never
      // overshoots past a reading)
      const sorted = points.slice().sort((a, b) => a.x - b.x);
      datasets.push({ ...lineStyle, label: 'Trend', data: sorted, borderColor: lineColorOf(metric), borderWidth: 2, tension: 0.4, cubicInterpolationMode: 'monotone', order: TREND_ORDER });
    }
    hovered = null;
    pinned = null;
    renderStats(metric);

    const yValues = [];
    datasets.forEach((dataset, index) => {
      if (index === 0 && !showPointsBox.checked) return;
      dataset.data.forEach((p) => { if (p.y !== null && Number.isFinite(p.y)) yValues.push(p.y); });
    });
    const yRange = yValues.length
      ? paddedRange(Math.min(...yValues), Math.max(...yValues), pad, Math.max(1, Math.abs(yValues[0]) * 0.05))
      : null;
    const formatTooltipDate = (time) => new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      // The stats panel follows the pointer: the model's estimate and error at that date.
      // A click pins it there (the pointer is then ignored); another click releases it.
      onHover: (event, elements, chartInstance) => {
        if (pinned) return;
        const nearest = estimateAtPixel(chartInstance, event.x);
        if (nearest && nearest !== hovered) {
          hovered = nearest;
          renderStats(metric);
        }
      },
      onClick: (event, elements, chartInstance) => {
        if (!shown.length) return;
        if (pinned) {
          pinned = null;
          hovered = estimateAtPixel(chartInstance, event.x);
        } else {
          pinned = estimateAtPixel(chartInstance, event.x);
        }
        renderStats(metric);
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
          // Ticks and grid lines on calendar dates (see calendarTicks), labelled to suit their step
          afterBuildTicks: (scale) => {
            const step = calendarTicks(scale.min, scale.max, Math.max(2, Math.floor((scale.width || 600) / TICK_LABEL_PX)));
            scale.ticks = step.ticks.map((value) => ({ value }));
            scale.calendarStep = step;
          },
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            callback: function (value, index) { return calendarTickLabel(value, index, this.calendarStep); }
          },
          title: { display: true, text: 'Date' }
        },
        y: {
          beginAtZero: false,
          ...(yRange ? { min: yRange.min, max: yRange.max } : {}),
          // Only round-number labels, not the exact padded edges
          ticks: { includeBounds: false },
          title: { display: true, text: metricLabel(metric) }
        }
      }
    };

    try {
      if (chart) chart.destroy();
      chart = new window.Chart(chartCanvas, { type: 'line', data: { datasets }, options });
    } catch (error) {
      // Without the date adapter, fall back to a plain number axis labelled with dates
      console.error('Metrics chart time axis failed, using a plain axis:', error);
      if (chart) chart.destroy();
      options.scales.x = { ...options.scales.x, type: 'linear' };
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
      setEntryRowOpen(false);
      render();
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
      notify('Give the Metric a name.');
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
    const question = count ? `Remove ${metric.name} and its ${count} ${count === 1 ? 'Measurement' : 'Measurements'}?` : `Remove ${metric.name}?`;
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

  // Saves one setting of the selected Metric (a colour or a show/hide choice)
  async function saveMetricSetting(key, value) {
    if (!metrics[selectedId]) return;
    // Before any Metric is stored, store them all (this one with its new setting)
    const updates = metricsSaved ? { [`metrics/${selectedId}/${key}`]: value } : metricUpdates();
    try {
      await window.database.ref('bio').update(updates);
      metricsSaved = true;
    } catch (error) {
      notify(`Could not save the setting: ${error.message}`);
    }
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
  // Points, trend and error are each shown or hidden per Metric, independently
  VISIBILITY.forEach(([box, key]) => box.addEventListener('change', () => {
    if (!metrics[selectedId]) return;
    metrics[selectedId] = { ...metrics[selectedId], [key]: box.checked };
    render();
    saveMetricSetting(key, box.checked);
  }));
  chartCanvas.addEventListener('mouseleave', () => {
    if (!hovered || pinned) return;
    hovered = null;
    renderStats(metrics[selectedId] || { name: '', unit: '' });
  });
  // Recolour the drawn chart in place (cheap enough to follow the picker while dragging,
  // unlike rebuilding it)
  function recolorChart() {
    const metric = metrics[selectedId];
    if (!chart || !metric) return;
    // Point colours are cached per point, so the points dataset is swapped for a recoloured copy
    // (a new dataset object makes Chart.js work its points' colours out again)
    chart.data.datasets[0] = { ...chart.data.datasets[0], pointBackgroundColor: pointColorOf(metric) };
    chart.data.datasets.forEach((dataset) => {
      if (dataset.label === 'Trend') dataset.borderColor = lineColorOf(metric);
    });
    bandRgb = hexToRgb(bandColorOf(metric));
    bandColorCache = new Map(); // the band's colours are worked out again on update
    chart.update('none');
  }

  // Colours belong to the selected measurement: the chart follows the picker as it moves (at most
  // once a frame), and the colour is saved COLOR_SAVE_DELAY_MS after it stops, or when the picker closes
  const COLOR_SAVE_DELAY_MS = 700;
  let recolorFrame = 0;
  [[pointColorInput, 'pointColor'], [lineColorInput, 'lineColor'], [bandColorInput, 'bandColor']].forEach(([input, key]) => {
    let saveTimer = 0;
    const save = () => {
      clearTimeout(saveTimer);
      saveMetricSetting(key, input.value);
    };
    input.addEventListener('input', () => {
      if (!metrics[selectedId]) return;
      metrics[selectedId] = { ...metrics[selectedId], [key]: input.value };
      if (!recolorFrame) {
        recolorFrame = requestAnimationFrame(() => {
          recolorFrame = 0;
          recolorChart();
        });
      }
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, COLOR_SAVE_DELAY_MS);
    });
    input.addEventListener('change', save);
  });
  zoomSelect.addEventListener('change', () => {
    render();
    saveSettings();
  });
  // The new-reading row stays hidden behind "Add measurement" until wanted, and closes after saving
  function setEntryRowOpen(open) {
    entryRow.hidden = !open;
    openEntryBtn.hidden = open;
    openEntryBtn.setAttribute('aria-expanded', String(open));
    valueInput.value = '';
    setDatePickerOpen(false);
    (open ? valueInput : openEntryBtn).focus();
  }
  openEntryBtn.addEventListener('click', () => setEntryRowOpen(true));
  el('bioCloseEntryBtn').addEventListener('click', () => setEntryRowOpen(false));
  saveEntryBtn.addEventListener('click', saveEntry);
  dateToggle.addEventListener('click', () => setDatePickerOpen(dateInput.hidden));
  valueInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); saveEntry(); }
    if (event.key === 'Escape') setEntryRowOpen(false);
  });
  entryList.addEventListener('click', (event) => {
    const button = event.target.closest('.bio-delete-entry');
    if (button) deleteEntry(button);
  });
})();
