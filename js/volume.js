const volumeMonthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const muscleGroups = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Legs'];
const exerciseMatrixDefaults = [
  { exercise: 'Bench Press', muscleGroups: { Chest: 0 } },
  { exercise: 'Dips', muscleGroups: { Chest: 0, Triceps: 0 } },
  { exercise: 'Shoulder Press', muscleGroups: { Shoulders: 0 } },
  { exercise: 'Pull-up', muscleGroups: { Back: 0, Biceps: 0 } },
  { exercise: 'Row', muscleGroups: { Back: 0 } },
  { exercise: 'Curl', muscleGroups: { Biceps: 0 } },
  { exercise: 'Tricep ext.', muscleGroups: { Triceps: 0 } },
  { exercise: 'Lateral Raise', muscleGroups: { Shoulders: 0 } },
  { exercise: 'Hanging Leg Raise', muscleGroups: { Core: 0 } },
  { exercise: 'Deadlift', muscleGroups: { Back: 0, Legs: 0 } }
];
const viewTargets = {
  sofar: { Chest: 14, Back: 14, Shoulders: 10, Biceps: 8, Triceps: 8, Core: 8, Legs: 12 },
  monthly: { Chest: 6, Back: 6, Shoulders: 4, Biceps: 3, Triceps: 3, Core: 4, Legs: 5 },
  coverage: { Chest: 3, Back: 3, Shoulders: 3, Biceps: 2, Triceps: 2, Core: 2, Legs: 3 }
};

let currentVolumeYear = new Date().getFullYear();
let currentVolumeMonth = new Date().getMonth();
let currentVolumeView = 'sofar';
let exerciseMuscleMatrix = [];
let matrixMuscleGroups = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Legs'];
let monthlyTargets = {};
let currentTargetMonthKey = '';
const defaultVolumeTarget = 40;

function formatVolumeMonthLabel(year, month) {
  return `${volumeMonthNames[month]} ${year}`;
}

function parseWorkoutDate(workout) {
  const dateValue = workout.date || workout.createdAt || workout.timestamp || workout.dateString;
  if (!dateValue) return null;

  const parsed = new Date(dateValue);
  if (!isNaN(parsed)) return parsed;

  const numeric = new Date(parseInt(dateValue, 10));
  return !isNaN(numeric) ? numeric : null;
}

function getExerciseName(exercise) {
  if (!exercise) return 'Unnamed exercise';
  return exercise.name || exercise.exerciseName || exercise.title || 'Unnamed exercise';
}

function getExerciseMuscleGroups(exercise) {
  const exerciseName = getExerciseName(exercise).toLowerCase();
  const match = exerciseMuscleMatrix.find(item => item.exercise.toLowerCase() === exerciseName);
  if (match) {
    return Object.entries(match.muscleGroups || {})
      .filter(([, value]) => Number(value) > 0)
      .map(([group]) => group);
  }

  if (!exercise) return ['Core'];

  const categoryText = `${exercise.category || ''} ${exercise.categoryName || ''} ${exercise.type || ''} ${exerciseName}`.toLowerCase();

  if (categoryText.includes('upper body pull') || categoryText.includes('back') || categoryText.includes('row') || categoryText.includes('lat') || categoryText.includes('pull')) {
    return ['Back'];
  }
  if (categoryText.includes('chest') || categoryText.includes('pec') || categoryText.includes('bench') || categoryText.includes('fly') || categoryText.includes('pushup') || categoryText.includes('push up')) {
    return ['Chest'];
  }
  if (categoryText.includes('shoulder') || categoryText.includes('delt') || categoryText.includes('lateral') || categoryText.includes('raise')) {
    return ['Shoulders'];
  }
  if (categoryText.includes('bicep') || categoryText.includes('curl')) {
    return ['Biceps'];
  }
  if (categoryText.includes('tricep') || categoryText.includes('dip')) {
    return ['Triceps'];
  }
  if (categoryText.includes('core') || categoryText.includes('abs') || categoryText.includes('ab') || categoryText.includes('plank') || categoryText.includes('situp')) {
    return ['Core'];
  }
  if (categoryText.includes('leg') || categoryText.includes('squat') || categoryText.includes('hinge') || categoryText.includes('lunge')) {
    return ['Legs'];
  }

  if (categoryText.includes('upper body push')) {
    return ['Chest'];
  }

  return ['Core'];
}

function getExerciseSetMetrics(exercise) {
  if (!exercise) return { directSets: 0, effectiveSets: 0, contributions: {} };

  const setsList = Array.isArray(exercise.setsList)
    ? exercise.setsList
    : (exercise.setsList && typeof exercise.setsList === 'object')
      ? Object.values(exercise.setsList)
      : [];

  const directSets = setsList.length || (parseInt(exercise.sets, 10) || 0);

  if (directSets <= 0) {
    return { directSets: 0, effectiveSets: 0, contributions: {} };
  }

  const exerciseName = getExerciseName(exercise).toLowerCase();
  const matrixEntry = exerciseMuscleMatrix.find(item => item.exercise.toLowerCase() === exerciseName);
  const fallbackGroups = getExerciseMuscleGroups(exercise);
  const matrixGroups = Object.keys(matrixEntry?.muscleGroups || {}).filter(group => Number(matrixEntry.muscleGroups[group]) > 0);
  const groups = matrixGroups.length ? matrixGroups : fallbackGroups;

  const contributions = {};
  groups.forEach(group => {
    const score = Number(matrixEntry?.muscleGroups?.[group] ?? (group === fallbackGroups[0] ? 1 : 0)) || 0;
    if (score <= 0) return;

    const directContribution = score === 1 ? directSets : 0;
    const effectiveContribution = directSets * score;

    contributions[group] = {
      directSets: directContribution,
      effectiveSets: effectiveContribution
    };
  });

  const totalDirectSets = Object.values(contributions).reduce((sum, contribution) => sum + contribution.directSets, 0);
  const totalEffectiveSets = Object.values(contributions).reduce((sum, contribution) => sum + contribution.effectiveSets, 0);

  return { directSets: totalDirectSets, effectiveSets: totalEffectiveSets, contributions };
}

function getVolumeTargetMonthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function getWorkoutExercises(workout) {
  if (!workout) return [];
  if (Array.isArray(workout.exercises)) return workout.exercises;
  if (workout.exercises && typeof workout.exercises === 'object') return Object.values(workout.exercises);
  return [];
}

function formatTargetMonthLabel(monthKey) {
  if (!monthKey) return 'Unknown';
  const [year, month] = monthKey.split('-').map(part => parseInt(part, 10));
  if (!year || !month) return monthKey;
  return `${volumeMonthNames[month - 1]} ${year}`;
}

function getConfiguredTargetForGroup(group, year, month) {
  const monthKey = getVolumeTargetMonthKey(year, month);
  return Number((monthlyTargets[monthKey] || {})[group] ?? defaultVolumeTarget);
}

function getDefaultTargetValues() {
  return muscleGroups.reduce((acc, group) => {
    acc[group] = defaultVolumeTarget;
    return acc;
  }, {});
}

function updateVolumeMonthLabel(year, month) {
  const label = document.getElementById('volumeMonthLabel');
  if (label) {
    label.textContent = formatVolumeMonthLabel(year, month);
  }
}

function updateVolumeViewButtons() {
  document.querySelectorAll('.volume-view-btn').forEach(button => {
    const isActive = button.dataset.view === currentVolumeView;
    button.classList.toggle('btn-primary', isActive);
    button.classList.toggle('btn-outline-primary', !isActive);
    button.classList.toggle('active', isActive);
  });
}

function renderMatrixHeaders() {
  const headerRow = document.getElementById('muscleGroupHeaderRow');
  if (!headerRow) return;

  headerRow.innerHTML = '';

  const exerciseHeader = document.createElement('th');
  exerciseHeader.style.textAlign = 'center';
  exerciseHeader.style.width = '170px';
  exerciseHeader.textContent = 'Exercise';
  headerRow.appendChild(exerciseHeader);

  matrixMuscleGroups.forEach(group => {
    const cell = document.createElement('th');
    cell.style.textAlign = 'center';
    cell.style.width = '90px';
    cell.textContent = group;
    headerRow.appendChild(cell);
  });
}

function getCoverageMonthKeys() {
  const months = [];
  let year = currentVolumeYear;
  let month = currentVolumeMonth;

  for (let index = 0; index < 12; index += 1) {
    months.push(getVolumeTargetMonthKey(year, month));
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }

  return months.reverse();
}

function formatCoverageMonthLabel(monthKey) {
  if (!monthKey) return '';
  const [year, monthValue] = monthKey.split('-').map(part => parseInt(part, 10));
  if (!year || !monthValue) return monthKey;
  const monthName = volumeMonthNames[monthValue - 1]?.slice(0, 3) || '';
  return `${monthName} ${String(year).slice(-2)}`;
}

function getCoverageCellStyle(percent) {
  if (percent <= 0) {
    return { color: '#d1d5db', background: '#f9fafb' };
  }

  if (percent > 80) {
    return { color: '#065f46', background: '#dcfce7' };
  }

  const blueValue = Math.min(255, 40 + Math.round((percent / 80) * 180));
  return {
    color: `rgb(2, 48, ${Math.max(80, blueValue)})`,
    background: `rgba(37, 99, 235, ${0.08 + (percent / 80) * 0.22})`
  };
}

function renderVolumeTable(rows) {
  const tableBody = document.getElementById('volumeTableBody');
  const tableHead = document.querySelector('#volumeTable thead');
  if (!tableBody || !tableHead) return;

  tableBody.innerHTML = '';

  if (currentVolumeView === 'coverage') {
    const monthKeys = getCoverageMonthKeys();
    tableHead.innerHTML = `
      <tr>
        <th style="width:90px; white-space:nowrap;">Muscle group</th>
        ${monthKeys.map(monthKey => `<th style="width:56px; min-width:56px; text-align:center; white-space:nowrap;">${formatCoverageMonthLabel(monthKey)}</th>`).join('')}
      </tr>
    `;

    muscleGroups.forEach(group => {
      const entry = rows[group] || { coverageByMonth: {} };
      const cells = monthKeys.map(monthKey => {
        const [monthYear, monthValue] = monthKey.split('-');
        const target = getConfiguredTargetForGroup(group, parseInt(monthYear, 10), parseInt(monthValue, 10) - 1);
        const effectiveSets = Number(entry.coverageByMonth?.[monthKey] || 0);
        const percent = target > 0 ? Math.min(100, Math.round((effectiveSets / target) * 100)) : 0;
        const style = getCoverageCellStyle(percent);
        return `<td style="text-align:center; font-weight:600; color:${percent > 0 ? '#111827' : style.color}; background:${style.background}; padding:4px 2px; width:56px; min-width:56px;">${percent}%</td>`;
      }).join('');

      const row = document.createElement('tr');
      row.innerHTML = `<td style="white-space:nowrap; font-size:0.9rem;">${group}</td>${cells}`;
      tableBody.appendChild(row);
    });
    return;
  }

  tableHead.innerHTML = `
    <tr>
      <th style="width:22%; white-space:nowrap;">Muscle group</th>
      <th style="width:19%; text-align:center;">Direct Sets</th>
      <th style="width:19%; text-align:center;">Effective Sets</th>
      <th style="width:19%; text-align:center;">Target</th>
      <th style="width:21%; text-align:center;">On Track</th>
    </tr>
  `;

  const monthStart = new Date(currentVolumeYear, currentVolumeMonth, 1);
  const monthEnd = new Date(currentVolumeYear, currentVolumeMonth + 1, 0);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === currentVolumeYear && today.getMonth() === currentVolumeMonth;

  const elapsedDays = isCurrentMonth
    ? Math.max(1, Math.round((today - monthStart) / (1000 * 60 * 60 * 24)) + 1)
    : monthEnd.getDate();
  const totalDays = Math.max(1, Math.round((monthEnd - monthStart) / (1000 * 60 * 60 * 24)) + 1);
  const monthProgress = elapsedDays / totalDays;

  muscleGroups.forEach(group => {
    const entry = rows[group] || { directSets: 0, effectiveSets: 0, target: viewTargets[currentVolumeView][group], onTrack: false };
    const row = document.createElement('tr');

    let target = entry.target ?? getConfiguredTargetForGroup(group, currentVolumeYear, currentVolumeMonth);
    let effectiveSets = entry.effectiveSets;
    let directSets = entry.directSets;
    let progressPercent = 0;
    let progressLabel = '0%';

    if (currentVolumeView === 'sofar' || currentVolumeView === 'monthly') {
      if (currentVolumeView === 'sofar' && isCurrentMonth) {
        target = target * monthProgress;
      }
      progressPercent = target > 0 ? Math.min(1, effectiveSets / target) : 0;
      progressLabel = `${Math.round(progressPercent * 100)}%`;
    }

    const onTrackValue = (currentVolumeView === 'sofar' || currentVolumeView === 'monthly')
      ? `${progressLabel}<div style="height:8px; width:100%; background:#e9ecef; border-radius:4px; overflow:hidden; margin-top:4px;"><div style="height:100%; width:${Math.max(4, Math.round(progressPercent * 100))}%; background:${progressPercent >= 1 ? '#28a745' : '#0d6efd'}; border-radius:4px;"></div></div>`
      : (entry.onTrack ? 'Yes' : 'No');

    row.innerHTML = `
      <td style="white-space:nowrap;">${group}</td>
      <td style="text-align:center;">${directSets}</td>
      <td style="text-align:center;">${effectiveSets.toFixed(1)}</td>
      <td style="text-align:center;">${target.toFixed(1)}</td>
      <td style="text-align:center;">${onTrackValue}</td>
    `;
    tableBody.appendChild(row);
  });
}

function loadVolumeData() {
  updateVolumeMonthLabel(currentVolumeYear, currentVolumeMonth);
  renderVolumeTable({});

  if (!window.database) return;

  window.database.ref('workouts').once('value').then(snapshot => {
    const workouts = snapshot.val() || {};
    const rows = {};

    const monthStart = new Date(currentVolumeYear, currentVolumeMonth, 1);
    const monthEnd = new Date(currentVolumeYear, currentVolumeMonth + 1, 0, 23, 59, 59, 999);
    const coverageStart = new Date(currentVolumeYear, currentVolumeMonth - 11, 1);
    const yearStart = new Date(currentVolumeYear, 0, 1);
    const yearEnd = new Date(currentVolumeYear, 11, 31, 23, 59, 59, 999);

    Object.values(workouts).forEach(workout => {
      const workoutDate = parseWorkoutDate(workout);
      if (!workoutDate) return;

      let includeWorkout = false;
      if (currentVolumeView === 'monthly' || currentVolumeView === 'sofar') {
        includeWorkout = workoutDate >= monthStart && workoutDate <= monthEnd;
      } else if (currentVolumeView === 'coverage') {
        includeWorkout = workoutDate >= coverageStart && workoutDate <= monthEnd;
      } else {
        includeWorkout = workoutDate >= monthStart && workoutDate <= monthEnd;
      }

      if (!includeWorkout) return;

      const exercises = getWorkoutExercises(workout);
      exercises.forEach(exercise => {
        const metrics = getExerciseSetMetrics(exercise);

        Object.entries(metrics.contributions || {}).forEach(([group, contribution]) => {
          if (!rows[group]) {
            rows[group] = { directSets: 0, effectiveSets: 0, monthsWithData: new Set(), monthCoverage: {}, monthCount: 0 };
          }

          rows[group].directSets += contribution.directSets;
          rows[group].effectiveSets += contribution.effectiveSets;

          if (currentVolumeView === 'coverage') {
            const monthKey = `${workoutDate.getFullYear()}-${String(workoutDate.getMonth() + 1).padStart(2, '0')}`;
            rows[group].monthCoverage[monthKey] = (rows[group].monthCoverage[monthKey] || 0) + contribution.effectiveSets;
          }
        });
      });
    });

    muscleGroups.forEach(group => {
      const base = rows[group] || { directSets: 0, effectiveSets: 0, monthsWithData: new Set() };
      const target = getConfiguredTargetForGroup(group, currentVolumeYear, currentVolumeMonth);
      let directSets = base.directSets;
      let effectiveSets = base.effectiveSets;
      let onTrack = effectiveSets >= target;

      if (currentVolumeView === 'coverage') {
        directSets = Object.keys(base.monthCoverage || {}).length;
        effectiveSets = Object.values(base.monthCoverage || {}).reduce((sum, value) => sum + value, 0);
        onTrack = effectiveSets >= target;
      }

      rows[group] = {
        directSets,
        effectiveSets,
        target,
        onTrack,
        coverageByMonth: base.monthCoverage || {}
      };
    });

    renderVolumeTable(rows);
  }).catch(() => {
    renderVolumeTable({});
  });
}

let volumeBootstrapped = false;

async function bootstrapVolumeData() {
  if (volumeBootstrapped) {
    return;
  }

  volumeBootstrapped = true;
  loadVolumeTargets();
  loadMuscleMatrix();
  loadVolumeData();
}

bootstrapVolumeData();

const volumeToggleButton = document.getElementById('toggleVolumeBtn');
const volumeArea = document.getElementById('volumearea');
const volumePrevMonthButton = document.getElementById('volumePrevMonth');
const volumeNextMonthButton = document.getElementById('volumeNextMonth');
const showMatrixSettingCheckbox = document.getElementById('showMatrixSetting');
const muscleMatrixArea = document.getElementById('muscleMatrixArea');
const saveMuscleMatrixButton = document.getElementById('saveMuscleMatrixBtn');
const muscleMatrixBody = document.getElementById('muscleMatrixBody');
const addMuscleGroupButton = document.getElementById('addMuscleGroupBtn');
const removeMuscleGroupButton = document.getElementById('removeMuscleGroupBtn');
const addExerciseRowButton = document.getElementById('addExerciseRowBtn');
const removeExerciseRowButton = document.getElementById('removeExerciseRowBtn');
const targetMonthSelect = document.getElementById('targetMonthSelect');
const targetEditorRows = document.getElementById('targetEditorRows');
const saveTargetsButton = document.getElementById('saveTargetsBtn');

function renderTargetEditor() {
  if (!targetEditorRows) return;

  const monthKey = currentTargetMonthKey || getVolumeTargetMonthKey(currentVolumeYear, currentVolumeMonth);
  const monthTargets = monthlyTargets[monthKey] || {};

  targetEditorRows.innerHTML = muscleGroups.map(group => `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px;">
      <label style="font-size:0.9rem; margin:0;">${group}</label>
      <input type="number" class="form-control form-control-sm" style="width:80px;" data-target-group="${group}" value="${Number(monthTargets[group] ?? defaultVolumeTarget)}" min="0" step="1">
    </div>
  `).join('');
}

function populateTargetMonthOptions() {
  if (!targetMonthSelect) return;

  const years = [currentVolumeYear - 1, currentVolumeYear, currentVolumeYear + 1];
  const options = [];

  years.forEach(year => {
    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      const value = getVolumeTargetMonthKey(year, monthIndex);
      options.push({ value, label: formatTargetMonthLabel(value) });
    }
  });

  targetMonthSelect.innerHTML = options.map(option => `<option value="${option.value}">${option.label}</option>`).join('');

  if (currentTargetMonthKey) {
    targetMonthSelect.value = currentTargetMonthKey;
  } else {
    currentTargetMonthKey = getVolumeTargetMonthKey(currentVolumeYear, currentVolumeMonth);
    targetMonthSelect.value = currentTargetMonthKey;
  }
}

function loadVolumeTargets() {
  if (!window.database) return;

  window.database.ref('volumeTargets').once('value').then(snapshot => {
    const data = snapshot.val() || {};
    monthlyTargets = data;
    if (!currentTargetMonthKey) {
      currentTargetMonthKey = getVolumeTargetMonthKey(currentVolumeYear, currentVolumeMonth);
    }
    populateTargetMonthOptions();
    renderTargetEditor();
  }).catch(() => {
    monthlyTargets = {};
    populateTargetMonthOptions();
    renderTargetEditor();
  });
}

function saveVolumeTargets() {
  if (!window.database) return;

  const monthKey = currentTargetMonthKey || getVolumeTargetMonthKey(currentVolumeYear, currentVolumeMonth);
  const nextMonthTargets = { ...(monthlyTargets[monthKey] || {}) };

  muscleGroups.forEach(group => {
    const input = targetEditorRows?.querySelector(`[data-target-group="${group}"]`);
    nextMonthTargets[group] = Number(input?.value || defaultVolumeTarget);
  });

  monthlyTargets[monthKey] = nextMonthTargets;

  window.database.ref('volumeTargets').set(monthlyTargets).then(() => {
    alert('Targets saved');
  }).catch(error => {
    console.error('Error saving targets', error);
    alert('Could not save targets');
  });
}

function renderMuscleMatrix() {
  if (!muscleMatrixBody) return;
  muscleMatrixBody.innerHTML = '';
  renderMatrixHeaders();

  const sourceMatrix = (exerciseMuscleMatrix.length ? exerciseMuscleMatrix : exerciseMatrixDefaults).map(entry => ({
    ...entry,
    muscleGroups: entry.muscleGroups || {}
  }));

  sourceMatrix.forEach(entry => {
    const row = document.createElement('tr');
    const muscleMap = entry.muscleGroups || {};
    row.innerHTML = `
      <td style="width: 170px;"><input type="text" class="form-control form-control-sm" value="${entry.exercise}" data-field="exercise"></td>
      ${matrixMuscleGroups.map(group => `
        <td style="text-align:center;"><input type="number" class="form-control form-control-sm" style="width:78px; margin:auto;" value="${Number(muscleMap[group] || 0)}" data-group="${group}" min="0" step="1"></td>
      `).join('')}
    `;
    muscleMatrixBody.appendChild(row);
  });
}

function saveMuscleMatrix() {
  if (!window.database) return;

  const rows = Array.from(muscleMatrixBody.querySelectorAll('tr'));
  const nextMatrix = rows.map(row => {
    const exerciseInput = row.querySelector('input[data-field="exercise"]');
    const muscleGroupsData = {};
    matrixMuscleGroups.forEach(group => {
      const value = row.querySelector(`input[data-group="${group}"]`);
      muscleGroupsData[group] = Number(value?.value || 0);
    });
    return {
      exercise: exerciseInput ? exerciseInput.value.trim() : '',
      muscleGroups: muscleGroupsData
    };
  }).filter(entry => entry.exercise);

  exerciseMuscleMatrix = nextMatrix;
  window.database.ref('muscleMatrix').set(nextMatrix).then(() => {
    alert('Muscle matrix saved');
    loadVolumeData();
  }).catch(error => {
    console.error('Error saving muscle matrix', error);
    alert('Could not save muscle matrix');
  });
}

function loadMuscleMatrix() {
  if (!window.database) return;

  window.database.ref('muscleMatrix').once('value').then(snapshot => {
    const data = snapshot.val();
    if (Array.isArray(data) && data.length) {
      exerciseMuscleMatrix = data;
      if (Array.isArray(data[0]?.muscleGroups)) {
        matrixMuscleGroups = data[0].muscleGroups.map(group => group);
      }
    } else {
      exerciseMuscleMatrix = exerciseMatrixDefaults;
    }
    renderMuscleMatrix();
  }).catch(() => {
    exerciseMuscleMatrix = exerciseMatrixDefaults;
    renderMuscleMatrix();
  });
}

function addMuscleGroup() {
  const groupName = prompt('Enter new muscle group name');
  if (!groupName) return;
  const cleaned = groupName.trim();
  if (!cleaned) return;
  if (matrixMuscleGroups.includes(cleaned)) {
    alert('That muscle group already exists');
    return;
  }
  matrixMuscleGroups.push(cleaned);
  exerciseMuscleMatrix = exerciseMuscleMatrix.map(entry => ({
    ...entry,
    muscleGroups: { ...entry.muscleGroups, [cleaned]: 0 }
  }));
  renderMuscleMatrix();
}

function removeMuscleGroup() {
  if (matrixMuscleGroups.length <= 1) {
    alert('At least one muscle group is required');
    return;
  }
  const groupName = prompt('Enter the muscle group to remove');
  if (!groupName) return;
  const cleaned = groupName.trim();
  if (!matrixMuscleGroups.includes(cleaned)) {
    alert('That muscle group was not found');
    return;
  }
  matrixMuscleGroups = matrixMuscleGroups.filter(group => group !== cleaned);
  exerciseMuscleMatrix = exerciseMuscleMatrix.map(entry => {
    const updated = { ...entry.muscleGroups };
    delete updated[cleaned];
    return { ...entry, muscleGroups: updated };
  });
  renderMuscleMatrix();
}

function addExerciseRow() {
  const exerciseName = prompt('Enter new exercise name');
  if (!exerciseName) return;
  const cleaned = exerciseName.trim();
  if (!cleaned) return;
  const muscleGroupsData = {};
  matrixMuscleGroups.forEach(group => {
    muscleGroupsData[group] = 0;
  });
  exerciseMuscleMatrix.push({ exercise: cleaned, muscleGroups: muscleGroupsData });
  renderMuscleMatrix();
}

function removeExerciseRow() {
  if (exerciseMuscleMatrix.length <= 1) {
    alert('At least one exercise is required');
    return;
  }
  const exerciseName = prompt('Enter the exercise name to remove');
  if (!exerciseName) return;
  const cleaned = exerciseName.trim();
  const index = exerciseMuscleMatrix.findIndex(entry => entry.exercise.toLowerCase() === cleaned.toLowerCase());
  if (index < 0) {
    alert('That exercise was not found');
    return;
  }
  exerciseMuscleMatrix.splice(index, 1);
  renderMuscleMatrix();
}

function setMuscleMatrixVisibility(show) {
  if (!muscleMatrixArea) return;
  muscleMatrixArea.classList.toggle('hidden', !show);
  if (show) {
    loadMuscleMatrix();
  }
}

if (showMatrixSettingCheckbox && muscleMatrixArea) {
  showMatrixSettingCheckbox.checked = !muscleMatrixArea.classList.contains('hidden');
  showMatrixSettingCheckbox.addEventListener('change', () => {
    setMuscleMatrixVisibility(showMatrixSettingCheckbox.checked);
  });
}

if (saveMuscleMatrixButton) {
  saveMuscleMatrixButton.addEventListener('click', saveMuscleMatrix);
}

if (saveTargetsButton) {
  saveTargetsButton.addEventListener('click', saveVolumeTargets);
}

if (targetMonthSelect) {
  targetMonthSelect.addEventListener('change', () => {
    currentTargetMonthKey = targetMonthSelect.value;
    renderTargetEditor();
  });
}

if (addMuscleGroupButton) {
  addMuscleGroupButton.addEventListener('click', addMuscleGroup);
}

if (removeMuscleGroupButton) {
  removeMuscleGroupButton.addEventListener('click', removeMuscleGroup);
}

if (addExerciseRowButton) {
  addExerciseRowButton.addEventListener('click', addExerciseRow);
}

if (removeExerciseRowButton) {
  removeExerciseRowButton.addEventListener('click', removeExerciseRow);
}

function initVolumeEvents() {
  if (volumeToggleButton && volumeArea) {
    volumeToggleButton.addEventListener('click', () => {
      volumeArea.classList.toggle('hidden');
      volumeToggleButton.textContent = volumeArea.classList.contains('hidden') ? 'Show Volume' : 'Hide Volume';
      if (!volumeArea.classList.contains('hidden')) {
        loadVolumeData();
      }
    });
  }

  if (volumePrevMonthButton) {
    volumePrevMonthButton.addEventListener('click', () => {
      currentVolumeMonth -= 1;
      if (currentVolumeMonth < 0) {
        currentVolumeMonth = 11;
        currentVolumeYear -= 1;
      }
      if (new Date().getFullYear() === currentVolumeYear && new Date().getMonth() === currentVolumeMonth) {
        currentVolumeView = 'sofar';
      } else {
        currentVolumeView = 'monthly';
      }
      updateVolumeViewButtons();
      loadVolumeData();
    });
  }

  if (volumeNextMonthButton) {
    volumeNextMonthButton.addEventListener('click', () => {
      currentVolumeMonth += 1;
      if (currentVolumeMonth > 11) {
        currentVolumeMonth = 0;
        currentVolumeYear += 1;
      }
      if (new Date().getFullYear() === currentVolumeYear && new Date().getMonth() === currentVolumeMonth) {
        currentVolumeView = 'sofar';
      } else {
        currentVolumeView = 'monthly';
      }
      updateVolumeViewButtons();
      loadVolumeData();
    });
  }

  document.querySelectorAll('.volume-view-btn').forEach(button => {
    button.addEventListener('click', () => {
      const isPastMonth = !(new Date().getFullYear() === currentVolumeYear && new Date().getMonth() === currentVolumeMonth);
      if (isPastMonth && button.dataset.view === 'sofar') {
        currentVolumeView = 'monthly';
      } else {
        currentVolumeView = button.dataset.view;
      }
      updateVolumeViewButtons();
      loadVolumeData();
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVolumeEvents);
} else {
  initVolumeEvents();
}

updateVolumeViewButtons();
// Initial load starts with the rest of the app.
