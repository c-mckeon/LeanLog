const progressToggleButton = document.getElementById('toggleprogressBtn');
const progressArea = document.getElementById('progressarea');
const progressTableHead = document.getElementById('progressTableHead');
const progressTableBody = document.getElementById('progressTableBody');
const progressViewButtons = Array.from(document.querySelectorAll('.progress-view-btn'));
const ORMexerciseInput = document.getElementById('ORMexerciseInput');
const ORMexerciseDataFilter = document.getElementById('ORMexerciseDataFilter');
const recordE1RMBtn = document.getElementById('recordE1RMBtn');
const showDataButton = document.getElementById('showDataButton');
const performanceList = document.getElementById('performanceList');

let currentProgressView = 'bestEfforts';

// Display options (see PROGRESS_OPTIONS at the end). "Per kg bodyweight" divides by bodyweight on
// that day, taken from the Metrics tab's Weight Measurements.
const e1rmPerBodyweightBox = document.getElementById('e1rmPerBodyweight');
const bestEffortsMultiplyBox = document.getElementById('bestEffortsMultiply');
const bestEffortsPerBodyweightBox = document.getElementById('bestEffortsPerBodyweight');
const bestEffortsColorScaleBox = document.getElementById('bestEffortsColorScale');
const bodyweightHint = document.getElementById('progressBodyweightHint');
const progressOptions = { e1rmPerBodyweight: false, bestEffortsMultiply: false, bestEffortsPerBodyweight: false, bestEffortsColorScale: false };

// Colour scale for a row's boxes: its lowest value pastel red, through pastel yellow, to its best
// pastel green. Yellow is reached SCALE_YELLOW_AT of the way up, so only the very lowest are red.
// Rows with fewer than SCALE_MIN_VALUES months aren't coloured (too few to compare).
const SCALE_COLORS = [[244, 199, 195], [250, 236, 175], [196, 230, 193]];
const SCALE_YELLOW_AT = 0.25;
const SCALE_MIN_VALUES = 4;
function scaleColor(share) {
  const s = Math.min(1, Math.max(0, share));
  const low = s <= SCALE_YELLOW_AT;
  const [from, to] = low ? [SCALE_COLORS[0], SCALE_COLORS[1]] : [SCALE_COLORS[1], SCALE_COLORS[2]];
  const mix = low ? s / SCALE_YELLOW_AT : (s - SCALE_YELLOW_AT) / (1 - SCALE_YELLOW_AT);
  return `rgb(${from.map((c, i) => Math.round(c + mix * (to[i] - c))).join(', ')})`;
}
// Whether the current view divides by bodyweight
const isPerBodyweightView = () => (currentProgressView === 'e1RM' && progressOptions.e1rmPerBodyweight)
  || (currentProgressView === 'bestEfforts' && progressOptions.bestEffortsPerBodyweight);
// Weight is read off a straight line between two Measurements up to this far apart, or from the
// nearest Measurement up to this close; further from any Measurement it counts as unknown
const BODYWEIGHT_MAX_GAP_DAYS = 180;
const BODYWEIGHT_MAX_REACH_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const POUNDS_TO_KG = 0.45359237;

// Weight Measurements from the Metrics tab, as [{ t (ms), kg }] oldest first. The Weight Metric is
// the one with id "weight", or else one named Weight / Bodyweight; pounds are converted to kg.
function getBodyweightSeries(bio) {
  const metrics = bio?.metrics || {};
  const isWeightName = (metric) => /^(body\s*)?weight$/i.test(String(metric?.name || '').trim());
  let weightId = metrics.weight ? 'weight' : Object.keys(metrics).find((id) => isWeightName(metrics[id]));
  if (!weightId && bio?.entries?.weight) weightId = 'weight'; // the built-in Weight Metric, never saved
  if (!weightId) return [];
  const unit = String(metrics[weightId]?.unit || 'kg').trim().toLowerCase();
  const toKg = ['lb', 'lbs', 'pound', 'pounds'].includes(unit) ? POUNDS_TO_KG : 1;
  return Object.values(bio?.entries?.[weightId] || {})
    .map((entry) => {
      const t = Number(entry?.time) || (/^\d{4}-\d{2}-\d{2}$/.test(entry?.date || '') ? new Date(`${entry.date}T12:00:00`).getTime() : NaN);
      return { t, kg: Number(entry?.value) * toKg };
    })
    .filter((point) => Number.isFinite(point.t) && point.kg > 0)
    .sort((a, b) => a.t - b.t);
}

// Bodyweight (kg) at a moment, or null when no Measurement is near enough
function bodyweightAt(series, time) {
  if (!series.length || !Number.isFinite(time)) return null;
  let high = series.findIndex((point) => point.t >= time);
  if (high === -1) high = series.length;
  const before = series[high - 1];
  const after = series[high];
  if (before && after && after.t - before.t <= BODYWEIGHT_MAX_GAP_DAYS * DAY_MS) {
    const share = after.t === before.t ? 0 : (time - before.t) / (after.t - before.t);
    return before.kg + share * (after.kg - before.kg);
  }
  const nearest = [before, after].filter(Boolean).sort((a, b) => Math.abs(a.t - time) - Math.abs(b.t - time))[0];
  return nearest && Math.abs(nearest.t - time) <= BODYWEIGHT_MAX_REACH_DAYS * DAY_MS ? nearest.kg : null;
}
let allExercisesMap = {}; // exercise id -> name
let exerciseIdByLowerName = {};
// Progress is tracked per variation: one item per exercise (its plain form) and per variation of it.
// Key: the exercise id for the plain form (so older tracking choices still apply), or
// "<id>~<variation>" for a variation (made safe as a database key).
let progressItems = {}; // key -> { id, variation, label }

function encodeKeyPart(text) {
  return encodeURIComponent(text).replace(/\./g, '%2E');
}

function progressKey(id, variation = '') {
  const trimmed = typeof variation === 'string' ? variation.trim() : '';
  return trimmed ? `${id}~${encodeKeyPart(trimmed)}` : id;
}

function progressLabel(name, variation = '') {
  const trimmed = typeof variation === 'string' ? variation.trim() : '';
  return trimmed ? `${name} · ${trimmed}` : name;
}

// The exercise id an entry belongs to: by id when known, else by name
function resolveExerciseId(id, name) {
  if (id && allExercisesMap[id]) return id;
  return exerciseIdByLowerName[String(name || '').trim().toLowerCase()] || '';
}

function normalizeVariationList(variations) {
  const values = Array.isArray(variations) ? variations : (variations && typeof variations === 'object' ? Object.values(variations) : []);
  return [...new Set(values.filter((value) => typeof value === 'string').map((value) => value.trim()).filter(Boolean))];
}
let isPerformanceListVisible = false;

// Exercises hidden from progress are stored as false; anything unset counts as tracked.
const TRACKED_EXERCISES_PATH = 'settings/progress/trackedExercises';
const MAX_DEFAULT_TRACKED_EXERCISES = 10;
let trackedExercises = {};
let trackedSyncChain = Promise.resolve();

function isExerciseTracked(id) {
  return trackedExercises[id] !== false;
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonthKeysFromStart(startDate) {
  const months = [];
  const now = new Date();
  let year = startDate.getFullYear();
  let month = startDate.getMonth();

  while (year < now.getFullYear() || (year === now.getFullYear() && month <= now.getMonth())) {
    months.push(`${year}-${String(month + 1).padStart(2, '0')}`);
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return months;
}

function formatProgressMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return `${monthNames[month - 1]} '${String(year).slice(-2)}`;
}

function parseWorkoutDate(record) {
  const raw = record.date || record.timestamp || record.createdAt || record.dateString || record.unixtime;
  if (!raw) return null;

  if (typeof raw === 'number' || /^[0-9]+$/.test(String(raw))) {
    const numeric = new Date(Number(raw));
    if (!isNaN(numeric)) return numeric;
  }

  const parsed = new Date(raw);
  return isNaN(parsed) ? null : parsed;
}

function getExerciseName(exercise) {
  if (!exercise) return '';
  const name = exercise.name || exercise.exerciseName || exercise.title || exercise.exercise;
  return typeof name === 'string' ? name.trim() : '';
}

function computeEstimated1RM(set) {
  const reps = parseInt(set.reps, 10);
  const weight = parseFloat(set.weight);
  if (!reps || reps <= 0 || !weight || weight <= 0) return 0;

  const epley = weight * (1 + reps / 30);
  const brzycki = weight * (36 / (37 - reps));
  const lombardi = weight * Math.pow(reps, 0.10);
  const oconner = weight * (1 + 0.025 * reps);
  const wathan = (100 * weight) / (48.8 + 53.8 * Math.exp(-0.075 * reps));

  return (epley + brzycki + lombardi + oconner + wathan) / 5;
}

function computeSetVolume(set) {
  const reps = parseInt(set.reps, 10);
  const weight = parseFloat(set.weight);
  if (!reps || reps <= 0 || !weight || weight <= 0) return 0;
  return reps * weight;
}

function getExerciseSets(exercise) {
  if (!exercise) return [];
  if (Array.isArray(exercise.setsList) && exercise.setsList.length) {
    return exercise.setsList;
  }

  if (typeof exercise.sets === 'number' || typeof exercise.reps === 'number' || typeof exercise.weight === 'number') {
    return [{ reps: exercise.reps || 0, weight: exercise.weight || 0 }];
  }

  return [];
}

function buildInitialProgressRows(allowedExerciseEntries, monthKeys) {
  const rows = {};

  allowedExerciseEntries.forEach(entry => {
    const id = entry.id;
    const name = entry.name;
    if (!id || !name) return;

    rows[id] = {
      displayName: name,
      monthly: monthKeys.reduce((acc, key) => {
        acc[key] = {
          e1RM: 0,
          e1RMPerBw: 0, // best one-rep max ÷ bodyweight that month
          avg3VolumeSum: 0,
          avg3VolumeCount: 0,
          bestEffort: 0,
          bestEffortReps: 0,
          bestEffortWeight: 0,
          // The best set's reps × weight ÷ bodyweight that day (may be a different set from bestEffort)
          bestEffortPerBw: 0
        };
        return acc;
      }, {})
    };
  });

  return rows;
}

function getFlattenedExerciseList(snapshotValue) {
  const exercises = [];
  if (!snapshotValue || typeof snapshotValue !== 'object') return exercises;

  const isCategoryShape = Object.values(snapshotValue).some(
    value => value && typeof value === 'object' && Object.values(value).some(inner => inner && typeof inner === 'object')
  );

  if (!isCategoryShape) {
    Object.entries(snapshotValue).forEach(([key, exercise]) => {
      const name = getExerciseName(exercise);
      if (name) exercises.push({ id: key, name, variations: normalizeVariationList(exercise?.variations) });
    });
    return exercises;
  }

  Object.values(snapshotValue).forEach(category => {
    if (!category || typeof category !== 'object') return;
    Object.entries(category).forEach(([key, exercise]) => {
      const name = getExerciseName(exercise);
      if (name) exercises.push({ id: key, name, variations: normalizeVariationList(exercise?.variations) });
    });
  });

  return exercises;
}

function getAllProgressMonthKeys(workoutsSnapshot, e1rmSnapshot) {
  const dates = [];

  Object.values(workoutsSnapshot || {}).forEach(workout => {
    const workoutDate = parseWorkoutDate(workout);
    if (workoutDate) dates.push(workoutDate);
  });

  Object.values(e1rmSnapshot || {}).forEach(entry => {
    const entryDate = parseWorkoutDate(entry);
    if (entryDate) dates.push(entryDate);
  });

  if (!dates.length) {
    return getMonthKeysFromStart(new Date());
  }

  const earliest = dates.reduce((minDate, date) => (date < minDate ? date : minDate), dates[0]);
  return getMonthKeysFromStart(earliest);
}

function getVisibleExerciseIds(rows) {
  return Object.keys(rows).filter(exerciseKey => {
    return Object.values(rows[exerciseKey].monthly).some(metrics => (
      metrics.e1RM > 0 || metrics.avg3VolumeCount > 0 || metrics.bestEffort > 0
    ));
  });
}

// bodyweightSeries: see getBodyweightSeries. The returned rows also carry missingBodyweight (not
// enumerable): how many e1RM entries had no bodyweight near their date.
function buildProgressRows(workoutsSnapshot, e1rmSnapshot, monthKeys, bodyweightSeries = []) {
  let missingBodyweight = 0;
  let missingWorkoutBodyweight = 0;
  const allowedExercises = Object.keys(progressItems)
    .filter(isExerciseTracked)
    .map(key => ({ id: key, name: progressItems[key].label }))
    .filter(entry => entry.name);
  const rows = buildInitialProgressRows(allowedExercises, monthKeys);

  Object.values(e1rmSnapshot || {}).forEach(entry => {
    const entryDate = parseWorkoutDate(entry);
    if (!entryDate) return;
    const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
    if (!monthKeys.includes(monthKey)) return;

    const exerciseId = resolveExerciseId(entry.exercise, getExerciseName(entry));
    const rowKey = exerciseId && progressKey(exerciseId, entry.variation);
    if (!rowKey || !rows[rowKey]) return;

    const metrics = rows[rowKey].monthly[monthKey];
    const estimated = parseFloat(entry.estimated1RM) || 0;
    if (estimated > metrics.e1RM) {
      metrics.e1RM = estimated;
    }
    if (estimated > 0 && bodyweightSeries.length) {
      const kg = bodyweightAt(bodyweightSeries, entryDate.getTime());
      if (kg) metrics.e1RMPerBw = Math.max(metrics.e1RMPerBw, estimated / kg);
      else missingBodyweight += 1;
    }
  });

  Object.values(workoutsSnapshot || {}).forEach(workout => {
    const workoutDate = parseWorkoutDate(workout);
    if (!workoutDate) return;

    const monthKey = `${workoutDate.getFullYear()}-${String(workoutDate.getMonth() + 1).padStart(2, '0')}`;
    if (!monthKeys.includes(monthKey)) return;

    const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
    exercises.forEach(exercise => {
      const exerciseId = resolveExerciseId(exercise.id || exercise.exercise, getExerciseName(exercise));
      const rowKey = exerciseId && progressKey(exerciseId, exercise.variation);
      if (!rowKey || !rows[rowKey]) return;

      const metrics = rows[rowKey].monthly[monthKey];
      const setsList = getExerciseSets(exercise);
      const weightedSets = setsList.filter(set => computeSetVolume(set) > 0);
      if (weightedSets.length < 3) return;

      const firstThreeWeighted = weightedSets.slice(0, 3);
      const firstThreeVolume = firstThreeWeighted.reduce((sum, set) => sum + computeSetVolume(set), 0);
      metrics.avg3VolumeSum += firstThreeVolume;
      metrics.avg3VolumeCount += 1;

      const bestSet = weightedSets.reduce((best, set) => {
        const volume = computeSetVolume(set);
        return volume > best.volume ? { volume, reps: parseInt(set.reps, 10) || 0, weight: parseFloat(set.weight) || 0 } : best;
      }, { volume: 0, reps: 0, weight: 0 });

      if (bestSet.volume > metrics.bestEffort) {
        metrics.bestEffort = bestSet.volume;
        metrics.bestEffortReps = bestSet.reps;
        metrics.bestEffortWeight = bestSet.weight;
      }
      if (bodyweightSeries.length && bestSet.volume > 0) {
        const kg = bodyweightAt(bodyweightSeries, workoutDate.getTime());
        if (!kg) missingWorkoutBodyweight += 1;
        else metrics.bestEffortPerBw = Math.max(metrics.bestEffortPerBw, bestSet.volume / kg);
      }
    });
  });

  // How many e1RM entries / workout sets had no bodyweight near their date (not exercise rows)
  Object.defineProperty(rows, 'missingBodyweight', { value: missingBodyweight, enumerable: false });
  Object.defineProperty(rows, 'missingWorkoutBodyweight', { value: missingWorkoutBodyweight, enumerable: false });
  return rows;
}

function formatProgressValue(value) {
  if (!value || Number(value) === 0) return '—';
  return Math.round(value).toString();
}

function getCellStyles(value) {
  if (!value || Number(value) === 0) {
    return 'color:#6b7280; background:#f8fafc;';
  }
  return 'color:#0f172a; background:rgba(14, 165, 233, 0.12); font-weight:600;';
}

function renderProgressTable(rows, monthKeys) {
  if (!progressTableHead || !progressTableBody) return;

  const visibleMonthKeys = monthKeys.filter(monthKey => {
    return Object.values(rows).some(row => {
      const metrics = row.monthly[monthKey];
      return metrics.e1RM > 0 || metrics.avg3VolumeCount > 0;
    });
  });

  if (!visibleMonthKeys.length) {
    progressTableHead.innerHTML = `
      <tr>
        <th style="width:220px; white-space:nowrap;">Exercise</th>
      </tr>
    `;
    progressTableBody.innerHTML = '<tr><td style="color:#555;">No available month data yet.</td></tr>';
    return;
  }

  progressTableHead.innerHTML = `
    <tr>
      <th style="width:220px; white-space:nowrap;">Exercise</th>
      ${visibleMonthKeys.map(key => `<th style="width:72px; min-width:72px; text-align:center; white-space:nowrap;">${formatProgressMonthLabel(key)}</th>`).join('')}
    </tr>
  `;

  const sortedExerciseNames = Object.keys(rows).sort((a, b) => rows[a].displayName.localeCompare(rows[b].displayName));
  progressTableBody.innerHTML = '';

  sortedExerciseNames.forEach(exerciseKey => {
    const rowData = rows[exerciseKey];
    const hasData = visibleMonthKeys.some(monthKey => {
      const metrics = rowData.monthly[monthKey];
      return metrics.e1RM > 0 || metrics.avg3VolumeCount > 0 || metrics.bestEffort > 0;
    });
    if (!hasData) return;

    const row = document.createElement('tr');
    // Colour scale (Best efforts per kg bodyweight): each box placed between this row's lowest and best value
    const rowValues = visibleMonthKeys.map((monthKey) => rowData.monthly[monthKey].bestEffortPerBw).filter((v) => v > 0);
    const colorScale = currentProgressView === 'bestEfforts' && progressOptions.bestEffortsColorScale && rowValues.length >= SCALE_MIN_VALUES;
    const rowLow = Math.min(...rowValues);
    const rowHigh = Math.max(...rowValues);
    const cellStyle = (value) => {
      if (!colorScale || !(value > 0)) return getCellStyles(value);
      const share = rowHigh > rowLow ? (value - rowLow) / (rowHigh - rowLow) : 1;
      return `color:#0f172a; background:${scaleColor(share)}; font-weight:600;`;
    };
    const cells = visibleMonthKeys.map(monthKey => {
      const metrics = rowData.monthly[monthKey];
      let value = 0;
      let display = '—';
      if (currentProgressView === 'e1RM' && progressOptions.e1rmPerBodyweight) {
        value = metrics.e1RMPerBw;
        display = value > 0 ? `${value.toFixed(2)}×` : '—';
      } else if (currentProgressView === 'e1RM') {
        value = metrics.e1RM;
        display = value > 0 ? metrics.e1RM.toFixed(1) : '—';
      } else if (currentProgressView === 'avg3Volume') {
        if (metrics.avg3VolumeCount > 0) {
          value = metrics.avg3VolumeSum / metrics.avg3VolumeCount;
          display = value > 0 ? Math.round(value).toString() : '—';
        }
      } else if (currentProgressView === 'bestEfforts') {
        // Plain: "5×60kg". Multiplied: 300. Multiplied per kg bodyweight: 4.7 (only with Multiply).
        const { bestEffortsMultiply: multiply } = progressOptions;
        const perBw = multiply && progressOptions.bestEffortsPerBodyweight;
        value = perBw ? metrics.bestEffortPerBw : metrics.bestEffort;
        if (value > 0) {
          if (perBw) display = value.toFixed(1);
          else if (multiply) display = String(Math.round(value));
          else display = `${metrics.bestEffortReps}×${metrics.bestEffortWeight}kg`;
        }
      }
      return `<td style="text-align:center; ${cellStyle(value)}">${display}</td>`;
    }).join('');

    row.innerHTML = `<td style="white-space:nowrap;">${rowData.displayName || exerciseKey}</td>${cells}`;
    progressTableBody.appendChild(row);
  });
}

// One option per tracked exercise / variation (keys from progressItems)
function populateExerciseDropdowns(visibleExerciseIds = []) {
  if (!ORMexerciseInput || !ORMexerciseDataFilter) return;

  ORMexerciseInput.innerHTML = '<option value="">Select exercise</option>';
  ORMexerciseDataFilter.innerHTML = '<option value="all">Filter by exercise</option>';

  const exerciseIds = (visibleExerciseIds.length ? visibleExerciseIds : Object.keys(progressItems)).filter(isExerciseTracked);

  exerciseIds.forEach(key => {
    const name = progressItems[key]?.label;
    if (!name) return;

    const option = document.createElement('option');
    option.value = key;
    option.textContent = name;
    ORMexerciseInput.appendChild(option);

    const filterOption = document.createElement('option');
    filterOption.value = key;
    filterOption.textContent = name;
    ORMexerciseDataFilter.appendChild(filterOption);
  });
}

function loadExerciseOptions() {
  if (!window.database) return Promise.resolve();
  // Prefer the catalog the app already loaded, which has resolved exercise names
  const catalog = typeof exerciseCatalogByCategory !== 'undefined' ? exerciseCatalogByCategory : null;
  const source = catalog && Object.keys(catalog).length
    ? Promise.resolve(catalog)
    : window.database.ref('exercises').once('value').then(snapshot => snapshot.val() || {});
  return source.then(value => {
    const flattened = getFlattenedExerciseList(value);
    allExercisesMap = Object.fromEntries(flattened.map(ex => [ex.id, ex.name]));
    exerciseIdByLowerName = Object.fromEntries(flattened.map(ex => [ex.name.toLowerCase(), ex.id]));
    progressItems = {};
    flattened.forEach((ex) => {
      progressItems[progressKey(ex.id)] = { id: ex.id, variation: '', label: ex.name };
      ex.variations.forEach((variation) => {
        progressItems[progressKey(ex.id, variation)] = { id: ex.id, variation, label: progressLabel(ex.name, variation) };
      });
    });
  }).catch(error => {
    console.error('Error loading exercises:', error);
  });
}

// Load the saved tracking choices and save a default for any exercise that has none yet.
// Users with no saved choices keep all their existing exercises; after that,
// new exercises are untracked once more than 10 are already known.
function syncTrackedExercises() {
  trackedSyncChain = trackedSyncChain.then(async () => {
    if (!window.database) return;
    const snapshot = await window.database.ref(TRACKED_EXERCISES_PATH).once('value');
    const stored = snapshot.val();
    trackedExercises = stored && typeof stored === 'object' ? { ...stored } : {};

    // Every exercise and every variation of one is tracked (or not) on its own
    const exerciseIds = Object.keys(progressItems);
    const hadSavedChoices = exerciseIds.some(id => id in trackedExercises);
    let known = exerciseIds.filter(id => id in trackedExercises).length;
    const updates = {};

    exerciseIds.forEach(id => {
      if (id in trackedExercises) return;
      const tracked = hadSavedChoices ? known <= MAX_DEFAULT_TRACKED_EXERCISES : true;
      trackedExercises[id] = tracked;
      updates[id] = tracked;
      known += 1;
    });

    if (Object.keys(updates).length) {
      await window.database.ref(TRACKED_EXERCISES_PATH).update(updates);
    }
  }).catch(error => {
    console.error('Error syncing tracked exercises:', error);
  });
  return trackedSyncChain;
}
window.refreshTrackedExercises = () => loadExerciseOptions().then(syncTrackedExercises);

const trackedExercisesToggleBtn = document.getElementById('trackedExercisesToggleBtn');
const trackedExercisesPanel = document.getElementById('trackedExercisesPanel');

function renderTrackedExercisesPanel() {
  if (!trackedExercisesPanel) return;
  // One row per exercise and per variation ("Bench press · Incline"), alphabetical so each
  // exercise's variations sit right under it
  const entries = Object.entries(progressItems)
    .map(([key, item]) => [key, item.label])
    .sort((a, b) => a[1].localeCompare(b[1]));

  if (!entries.length) {
    trackedExercisesPanel.innerHTML = '<div class="settings-empty">No saved exercises yet.</div>';
    return;
  }

  trackedExercisesPanel.innerHTML = '';
  entries.forEach(([id, name]) => {
    const label = document.createElement('label');
    label.className = 'settings-checkbox-row';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isExerciseTracked(id);
    checkbox.addEventListener('change', async () => {
      const tracked = checkbox.checked;
      trackedExercises[id] = tracked;
      try {
        await window.database.ref(TRACKED_EXERCISES_PATH).update({ [id]: tracked });
        loadProgressData();
        if (isPerformanceListVisible) loadPerformanceList();
      } catch (error) {
        trackedExercises[id] = !tracked;
        checkbox.checked = !tracked;
        console.error('Error saving tracked exercise:', error);
      }
    });
    const text = document.createElement('span');
    text.textContent = name;
    label.append(checkbox, text);
    trackedExercisesPanel.appendChild(label);
  });
}

if (trackedExercisesToggleBtn && trackedExercisesPanel) {
  trackedExercisesToggleBtn.addEventListener('click', async () => {
    const opening = trackedExercisesPanel.classList.contains('hidden');
    trackedExercisesPanel.classList.toggle('hidden', !opening);
    trackedExercisesToggleBtn.setAttribute('aria-expanded', String(opening));
    if (!opening) return;
    trackedExercisesPanel.innerHTML = '<div class="settings-empty">Loading...</div>';
    await loadExerciseOptions();
    await syncTrackedExercises();
    renderTrackedExercisesPanel();
  });
}


function saveE1RMEntry() {
  const exerciseKey = ORMexerciseInput?.value;
  const reps = parseInt(document.getElementById('ORMrepsInput')?.value, 10);
  const weight = parseFloat(document.getElementById('ORMweightInput')?.value);
  if (!exerciseKey || isNaN(reps) || reps <= 0 || isNaN(weight) || weight <= 0) {
    showNotice('Please select an exercise and enter valid reps and weight.', 'error');
    return;
  }

  const item = progressItems[exerciseKey];
  const exerciseName = item ? allExercisesMap[item.id] : '';
  if (!exerciseName) {
    showNotice('Selected exercise could not be found.', 'error');
    return;
  }

  const estimated1RM = computeEstimated1RM({ reps, weight });
  const timestamp = new Date().toISOString();
  const unixtime = Date.now();

  window.database.ref('estimoneRepMax').push({
    exercise: item.id,
    name: exerciseName,
    ...(item.variation ? { variation: item.variation } : {}),
    reps,
    weight,
    estimated1RM,
    timestamp,
    unixtime
  }).then(() => {
    document.getElementById('ORMrepsInput').value = '';
    document.getElementById('ORMweightInput').value = '';
    setE1RMRecordFormOpen(false);
    loadProgressData();
    if (isPerformanceListVisible) {
      loadPerformanceList();
    }
  }).catch(error => {
    console.error('Error saving e1RM entry:', error);
    showNotice('Could not save the entry.', 'error');
  });
}

function renderPerformanceList(entries) {
  if (!performanceList) return;
  performanceList.innerHTML = '';

  if (!entries.length) {
    performanceList.innerHTML = '<li style="color:#555;">No saved e1RM entries found.</li>';
    return;
  }

  entries.forEach(entry => {
    const item = document.createElement('li');
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '10px';
    item.style.marginBottom = '6px';

    const label = document.createElement('span');
    const date = parseWorkoutDate(entry);
    const formattedDate = date ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : entry.timestamp || '';
    label.textContent = `${progressLabel(entry.name || 'Unnamed', entry.variation)} — ${entry.reps || '-'} reps @ ${entry.weight || '-'} kg — ${Math.round(entry.estimated1RM || 0)} e1RM — ${formattedDate}`;

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.className = 'btn btn-sm btn-outline-danger';
    deleteButton.addEventListener('click', async () => {
      if (!entry.key) return;
      if (!(await confirmInPlace(deleteButton, { question: 'Sure?' }))) return;
      window.database.ref(`estimoneRepMax/${entry.key}`).remove().then(() => {
        loadPerformanceList();
        loadProgressData();
      });
    });

    item.appendChild(label);
    item.appendChild(deleteButton);
    performanceList.appendChild(item);
  });
}

function loadPerformanceList() {
  if (!window.database) return;
  const filterKey = ORMexerciseDataFilter?.value;
  window.database.ref('estimoneRepMax').once('value').then(snapshot => {
    const entries = [];
    snapshot.forEach(childSnapshot => {
      const entry = childSnapshot.val();
      entry.key = childSnapshot.key;
      const entryKey = progressKey(resolveExerciseId(entry.exercise, entry.name) || entry.exercise, entry.variation);
      if (filterKey && filterKey !== 'all' && entryKey !== filterKey) return;
      entries.push(entry);
    });

    entries.sort((a, b) => (b.unixtime || 0) - (a.unixtime || 0));
    renderPerformanceList(entries);
  }).catch(error => {
    console.error('Error loading saved entries:', error);
  });
}

// The record form and saved-entry list only apply to the e1RM view; Best efforts has its own options
function updateProgressControlsVisibility() {
  const isE1RM = currentProgressView === 'e1RM';
  document.getElementById('e1rmControls')?.classList.toggle('hidden', !isE1RM);
  document.getElementById('bestEffortsControls')?.classList.toggle('hidden', currentProgressView !== 'bestEfforts');
  performanceList?.classList.toggle('hidden', !isE1RM || !isPerformanceListVisible);
}

function updateProgressViewButtons() {
  updateProgressControlsVisibility();
  progressViewButtons.forEach(button => {
    const isActive = button.dataset.view === currentProgressView;
    // Same look as the Workouts tab's List / Editor switch
    button.classList.toggle('exo-btn-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

// Under the table in "per kg bodyweight" mode: says when weight Measurements are missing
function updateBodyweightHint(series, rows) {
  if (!bodyweightHint) return;
  let text = '';
  if (isPerBodyweightView()) {
    const missing = currentProgressView === 'e1RM' ? rows.missingBodyweight : rows.missingWorkoutBodyweight;
    const things = currentProgressView === 'e1RM' ? ['entry', 'entries'] : ['workout set', 'workout sets'];
    if (!series.length) text = 'Log your weight in the Metrics tab to see this per kg bodyweight.';
    else if (missing === 1) text = `1 ${things[0]} has no weight logged near its date, so it is left out.`;
    else if (missing) text = `${missing} ${things[1]} have no weight logged near their date, so they are left out.`;
  }
  bodyweightHint.textContent = text;
  bodyweightHint.hidden = !text;
}

function loadProgressData() {
  if (!window.database) return;
  const needsBodyweight = isPerBodyweightView();
  Promise.all([
    window.database.ref('estimoneRepMax').once('value'),
    window.database.ref('workouts').once('value'),
    needsBodyweight ? window.database.ref('bio').once('value') : Promise.resolve(null)
  ]).then(([e1rmSnapshot, workoutsSnapshot, bioSnapshot]) => {
    const workoutsData = workoutsSnapshot.val() || {};
    const e1rmData = e1rmSnapshot.val() || {};
    const bodyweightSeries = bioSnapshot ? getBodyweightSeries(bioSnapshot.val()) : [];
    const monthKeys = getAllProgressMonthKeys(workoutsData, e1rmData);
    const rows = buildProgressRows(workoutsData, e1rmData, monthKeys, bodyweightSeries);
    renderProgressTable(rows, monthKeys);
    updateBodyweightHint(bodyweightSeries, rows);
    const visibleExerciseIds = getVisibleExerciseIds(rows);
    populateExerciseDropdowns(visibleExerciseIds);
  }).catch(error => {
    console.error('Error loading progress data:', error);
  });
}

if (progressToggleButton && progressArea) {
  progressToggleButton.addEventListener('click', () => {
    progressArea.classList.toggle('hidden');
    if (!progressArea.classList.contains('hidden')) {
      loadExerciseOptions().then(syncTrackedExercises).then(loadPerBodyweightSetting).then(() => {
        loadProgressData();
        if (isPerformanceListVisible) {
          loadPerformanceList();
        }
      });
    }
  });
}

if (recordE1RMBtn) {
  recordE1RMBtn.addEventListener('click', saveE1RMEntry);
}

// The exercise, reps and weight fields stay tucked behind "Record max effort set"
const recordE1RMToggle = document.getElementById('recordE1RMToggle');
const e1rmRecordForm = document.getElementById('e1rmRecordForm');

function setE1RMRecordFormOpen(isOpen) {
  if (!recordE1RMToggle || !e1rmRecordForm) return;
  e1rmRecordForm.hidden = !isOpen;
  recordE1RMToggle.setAttribute('aria-expanded', String(isOpen));
  recordE1RMToggle.classList.toggle('active', isOpen);
  if (isOpen) document.getElementById('ORMexerciseInput')?.focus();
}

recordE1RMToggle?.addEventListener('click', () => setE1RMRecordFormOpen(e1rmRecordForm.hidden));

if (showDataButton) {
  showDataButton.addEventListener('click', () => {
    if (!performanceList) return;
    isPerformanceListVisible = !isPerformanceListVisible;
    updateProgressControlsVisibility();
    showDataButton.textContent = isPerformanceListVisible ? 'Hide Entries' : 'Show Entries';
    if (isPerformanceListVisible) {
      loadPerformanceList();
    }
  });
}

if (ORMexerciseDataFilter) {
  ORMexerciseDataFilter.addEventListener('change', () => {
    if (isPerformanceListVisible) {
      loadPerformanceList();
    }
    loadProgressData();
  });
}

progressViewButtons.forEach(button => {
  button.addEventListener('click', () => {
    const view = button.dataset.view;
    if (view) {
      currentProgressView = view;
      updateProgressViewButtons();
      loadProgressData();
    }
  });
});

// Display options, saved under settings/progress:
// - e1rmPerBodyweight: estimated one-rep max ÷ bodyweight
// - bestEffortsMultiply: best set as reps × weight (one number) instead of "reps×weight"
// - bestEffortsPerBodyweight: best set's reps × weight ÷ bodyweight (needs Multiply)
// - bestEffortsColorScale: colour each exercise's months red → yellow → green (needs Per kg bodyweight)
const PROGRESS_OPTIONS = [
  [e1rmPerBodyweightBox, 'e1rmPerBodyweight'],
  [bestEffortsMultiplyBox, 'bestEffortsMultiply'],
  [bestEffortsPerBodyweightBox, 'bestEffortsPerBodyweight'],
  [bestEffortsColorScaleBox, 'bestEffortsColorScale']
];

function loadPerBodyweightSetting() {
  if (!window.database) return Promise.resolve();
  return window.database.ref('settings/progress').once('value').then((snapshot) => {
    const saved = snapshot.val() || {};
    PROGRESS_OPTIONS.forEach(([box, key]) => {
      progressOptions[key] = saved[key] === true;
      if (box) box.checked = progressOptions[key];
    });
    syncBestEffortsPerBodyweight();
  }).catch((error) => console.error('Could not load the Progress options:', error));
}

// Best efforts options build on each other: Per kg bodyweight only works on the multiplied number,
// and the colour scale only on per kg bodyweight. Each is only available (and only on) while the one
// before it is ticked. Returns the options it turned off, as updates to save.
const BEST_EFFORTS_CHAIN = [
  [bestEffortsPerBodyweightBox, 'bestEffortsPerBodyweight', 'bestEffortsMultiply'],
  [bestEffortsColorScaleBox, 'bestEffortsColorScale', 'bestEffortsPerBodyweight']
];

function syncBestEffortsPerBodyweight() {
  const turnedOff = {};
  BEST_EFFORTS_CHAIN.forEach(([box, key, needs]) => {
    if (!box) return;
    const allowed = progressOptions[needs];
    box.disabled = !allowed;
    box.closest('label')?.classList.toggle('is-disabled', !allowed);
    if (!allowed && progressOptions[key]) turnedOff[key] = false;
    if (!allowed) {
      progressOptions[key] = false;
      box.checked = false;
    }
  });
  return turnedOff;
}

PROGRESS_OPTIONS.forEach(([box, key]) => box?.addEventListener('change', () => {
  progressOptions[key] = box.checked;
  const updates = { [key]: box.checked, ...syncBestEffortsPerBodyweight() };
  loadProgressData();
  window.database?.ref('settings/progress').update(updates)
    .catch((error) => console.error('Could not save the Progress option:', error));
}));
syncBestEffortsPerBodyweight();

updateProgressViewButtons();
