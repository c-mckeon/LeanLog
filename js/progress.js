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

let currentProgressView = 'e1RM';
let allExercisesMap = {};
let exerciseIdByLowerName = {};
let isPerformanceListVisible = false;

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
  if (!exercise) return 'Unnamed exercise';
  return (exercise.name || exercise.exerciseName || exercise.title || exercise.exercise || 'Unnamed exercise').trim();
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
          avg3VolumeSum: 0,
          avg3VolumeCount: 0,
          bestEffort: 0,
          bestEffortReps: 0,
          bestEffortWeight: 0
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
      if (name) exercises.push({ id: key, name });
    });
    return exercises;
  }

  Object.values(snapshotValue).forEach(category => {
    if (!category || typeof category !== 'object') return;
    Object.entries(category).forEach(([key, exercise]) => {
      const name = getExerciseName(exercise);
      if (name) exercises.push({ id: key, name });
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

function buildProgressRows(workoutsSnapshot, e1rmSnapshot, monthKeys) {
  const exerciseIds = Object.keys(allExercisesMap);
  const allowedExercises = exerciseIds.map(id => ({ id, name: allExercisesMap[id] })).filter(entry => entry.name);
  const rows = buildInitialProgressRows(allowedExercises, monthKeys);

  Object.values(e1rmSnapshot || {}).forEach(entry => {
    const entryDate = parseWorkoutDate(entry);
    if (!entryDate) return;
    const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
    if (!monthKeys.includes(monthKey)) return;

    const exerciseKey = entry.exercise;
    const exerciseName = getExerciseName(entry);
    const normalized = exerciseName.toLowerCase();
    const rowKey = (exerciseKey && rows[exerciseKey]) ? exerciseKey : exerciseIdByLowerName[normalized];
    if (!rowKey || !rows[rowKey]) return;

    const metrics = rows[rowKey].monthly[monthKey];
    const estimated = parseFloat(entry.estimated1RM) || 0;
    if (estimated > metrics.e1RM) {
      metrics.e1RM = estimated;
    }
  });

  Object.values(workoutsSnapshot || {}).forEach(workout => {
    const workoutDate = parseWorkoutDate(workout);
    if (!workoutDate) return;

    const monthKey = `${workoutDate.getFullYear()}-${String(workoutDate.getMonth() + 1).padStart(2, '0')}`;
    if (!monthKeys.includes(monthKey)) return;

    const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
    exercises.forEach(exercise => {
      const exerciseName = getExerciseName(exercise);
      const exerciseKey = exercise.id || exercise.exercise || exerciseName;
      const normalized = exerciseName.toLowerCase();
      const rowKey = (exerciseKey && rows[exerciseKey]) ? exerciseKey : exerciseIdByLowerName[normalized];
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
    });
  });

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
    const cells = visibleMonthKeys.map(monthKey => {
      const metrics = rowData.monthly[monthKey];
      let value = 0;
      let display = '—';
      if (currentProgressView === 'e1RM') {
        value = metrics.e1RM;
        display = value > 0 ? metrics.e1RM.toFixed(1) : '—';
      } else if (currentProgressView === 'avg3Volume') {
        if (metrics.avg3VolumeCount > 0) {
          value = metrics.avg3VolumeSum / metrics.avg3VolumeCount;
          display = value > 0 ? Math.round(value).toString() : '—';
        }
      } else if (currentProgressView === 'bestEfforts') {
        value = metrics.bestEffort;
        display = value > 0 ? `${metrics.bestEffortReps}×${metrics.bestEffortWeight}kg` : '—';
      }
      return `<td style="text-align:center; ${getCellStyles(value)}">${display}</td>`;
    }).join('');

    row.innerHTML = `<td style="white-space:nowrap;">${rowData.displayName || exerciseKey}</td>${cells}`;
    progressTableBody.appendChild(row);
  });
}

function populateExerciseDropdowns(exercises, visibleExerciseIds = []) {
  if (!ORMexerciseInput || !ORMexerciseDataFilter) return;

  ORMexerciseInput.innerHTML = '<option value="">Select exercise</option>';
  ORMexerciseDataFilter.innerHTML = '<option value="all">All exercises</option>';

  const exerciseIds = visibleExerciseIds.length ? visibleExerciseIds : Object.keys(exercises);

  exerciseIds.forEach(key => {
    const name = exercises[key];
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
  return window.database.ref('exercises').once('value').then(snapshot => {
    const flattened = getFlattenedExerciseList(snapshot.val() || {});
    allExercisesMap = Object.fromEntries(flattened.map(ex => [ex.id, ex.name]));
    exerciseIdByLowerName = Object.fromEntries(flattened.map(ex => [ex.name.toLowerCase(), ex.id]));
  }).catch(error => {
    console.error('Error loading exercises:', error);
  });
}

function getExerciseNameByKey(key) {
  const exerciseName = allExercisesMap[key];
  return typeof exerciseName === 'string' ? exerciseName : '';
}

function saveE1RMEntry() {
  const exerciseKey = ORMexerciseInput?.value;
  const reps = parseInt(document.getElementById('ORMrepsInput')?.value, 10);
  const weight = parseFloat(document.getElementById('ORMweightInput')?.value);
  if (!exerciseKey || isNaN(reps) || reps <= 0 || isNaN(weight) || weight <= 0) {
    alert('Please select an exercise and enter valid reps and weight.');
    return;
  }

  const exerciseName = getExerciseNameByKey(exerciseKey);
  if (!exerciseName) {
    alert('Selected exercise could not be found.');
    return;
  }

  const estimated1RM = computeEstimated1RM({ reps, weight });
  const timestamp = new Date().toISOString();
  const unixtime = Date.now();

  window.database.ref('estimoneRepMax').push({
    exercise: exerciseKey,
    name: exerciseName,
    reps,
    weight,
    estimated1RM,
    timestamp,
    unixtime
  }).then(() => {
    loadProgressData();
    if (isPerformanceListVisible) {
      loadPerformanceList();
    }
  }).catch(error => {
    console.error('Error saving e1RM entry:', error);
    alert('Could not save the entry.');
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
    label.textContent = `${entry.name || 'Unnamed'} — ${entry.reps || '-'} reps @ ${entry.weight || '-'} kg — ${Math.round(entry.estimated1RM || 0)} e1RM — ${formattedDate}`;

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.className = 'btn btn-sm btn-outline-danger';
    deleteButton.addEventListener('click', () => {
      if (!entry.key) return;
      if (!confirm('Delete this e1RM entry?')) return;
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
      if (filterKey && filterKey !== 'all' && entry.exercise !== filterKey) return;
      entries.push(entry);
    });

    entries.sort((a, b) => (b.unixtime || 0) - (a.unixtime || 0));
    renderPerformanceList(entries);
  }).catch(error => {
    console.error('Error loading saved entries:', error);
  });
}

function updateProgressViewButtons() {
  progressViewButtons.forEach(button => {
    const isActive = button.dataset.view === currentProgressView;
    button.classList.toggle('btn-primary', isActive);
    button.classList.toggle('btn-outline-primary', !isActive);
    button.classList.toggle('active', isActive);
  });
}

function loadProgressData() {
  if (!window.database) return;
  Promise.all([
    window.database.ref('estimoneRepMax').once('value'),
    window.database.ref('workouts').once('value')
  ]).then(([e1rmSnapshot, workoutsSnapshot]) => {
    const workoutsData = workoutsSnapshot.val() || {};
    const e1rmData = e1rmSnapshot.val() || {};
    const monthKeys = getAllProgressMonthKeys(workoutsData, e1rmData);
    const rows = buildProgressRows(workoutsData, e1rmData, monthKeys);
    renderProgressTable(rows, monthKeys);
    const visibleExerciseIds = getVisibleExerciseIds(rows);
    populateExerciseDropdowns(allExercisesMap, visibleExerciseIds);
  }).catch(error => {
    console.error('Error loading progress data:', error);
  });
}

if (progressToggleButton && progressArea) {
  progressToggleButton.addEventListener('click', () => {
    progressArea.classList.toggle('hidden');
    progressToggleButton.textContent = progressArea.classList.contains('hidden') ? 'Show progress' : 'Hide progress';
    if (!progressArea.classList.contains('hidden')) {
      loadExerciseOptions().then(() => {
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

if (showDataButton) {
  showDataButton.addEventListener('click', () => {
    if (!performanceList) return;
    isPerformanceListVisible = !isPerformanceListVisible;
    performanceList.classList.toggle('hidden', !isPerformanceListVisible);
    showDataButton.textContent = isPerformanceListVisible ? 'Hide Data' : 'Show Data';
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

updateProgressViewButtons();
