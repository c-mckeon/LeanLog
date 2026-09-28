import { formatDuration, ensureClockRunning } from './clock.js';

const exerciseSelect = document.getElementById('exerciseSelect');
const addExerciseBtn = document.getElementById('addExerciseBtn');
const exerciseList = document.getElementById('exerciseList');
const saveWorkoutBtn = document.getElementById('saveWorkoutBtn');
const newExerciseName = document.getElementById('newExerciseName');
const exerciseCategory = document.getElementById('exerciseCategory');
const saveNewExerciseBtn = document.getElementById('saveNewExerciseBtn');
const focusCategory = document.getElementById('focusCategory');
const focusCheckbox = document.getElementById('focusCheckbox');
const focusContainer = document.getElementById('focusContainer');
const validateBtn = document.getElementById('validateBtn');

const selectedExercises = [];
const currentWorkout = { intensity: '', intensityNote: '' };
const workoutDraftRef = window.database.ref('workoutDraft');
let onWorkoutSaved = null;
let dropdownContent = [];

function renderExerciseDropdown(exercises, fromFocusAreas = false) {
  exerciseSelect.innerHTML = '';

  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = 'Select Exercise';
  placeholderOption.disabled = true;
  placeholderOption.selected = true;
  exerciseSelect.appendChild(placeholderOption);

  if (!exercises || typeof exercises !== 'object' || Object.keys(exercises).length === 0) {
    return;
  }

  dropdownContent = [];

  for (const category in exercises) {
    if (!category || typeof category !== 'string' || category.toLowerCase() === 'none' || !category.trim()) {
      continue;
    }

    const optgroup = document.createElement('optgroup');
    optgroup.label = category.replace(/_/g, ' ').toUpperCase();

    for (const exerciseId in exercises[category]) {
      const exercise = exercises[category][exerciseId];
      if (!exercise || typeof exercise !== 'object' || !exercise.name || typeof exercise.name !== 'string' || exercise.name.toLowerCase() === 'none' || !exercise.name.trim()) {
        continue;
      }

      const option = document.createElement('option');
      option.value = exerciseId;
      option.textContent = exercise.name;
      optgroup.appendChild(option);
    }

    dropdownContent.push(optgroup);
    exerciseSelect.appendChild(optgroup);
  }
}

async function loadExercises() {
  try {
    const seeFocusEl = document.getElementById('seefocusCheckbox');
    const groupByCategory = seeFocusEl ? seeFocusEl.checked : false;

    const snapshot = await window.database.ref('exercises').once('value');
    let data = snapshot.val() || {};

    // Normalize categories if the node is stored as a flat exercise list.
    if (Object.keys(data).length > 0) {
      const hasCategoryShape = Object.values(data).some(
        (v) => v && typeof v === 'object' && Object.keys(v).some((k) => typeof v[k] === 'object')
      );
      if (!hasCategoryShape) {
        data = { 'All Exercises': data };
      }
    }

    const frequencyMap = await computeExerciseFrequency();

    if (groupByCategory) {
      const sortedByCategory = sortExercisesByCategory(data, frequencyMap);
      renderExerciseDropdown(sortedByCategory, true);
    } else {
      const flattened = flattenAndSortExercises(data, frequencyMap);
      renderExerciseDropdown({ 'Most frequent': flattened }, false);
    }
  } catch (err) {
    console.error('loadExercises error:', err);
    renderExerciseDropdown({}, false);
  }
}

async function computeExerciseFrequency() {
  const snapshot = await window.database.ref('workouts').once('value');
  const workouts = snapshot.val();
  const frequency = {};

  if (!workouts) {
    return frequency;
  }

  Object.values(workouts).forEach((workout) => {
    if (!workout || !workout.exercises) return;
    workout.exercises.forEach((exercise) => {
      const key = exercise.id || exercise.name;
      if (!key) return;
      frequency[key] = (frequency[key] || 0) + 1;
    });
  });

  return frequency;
}

function flattenAndSortExercises(data, frequencyMap) {
  const flat = [];

  Object.entries(data).forEach(([category, exercises]) => {
    if (!exercises || typeof exercises !== 'object') return;
    Object.entries(exercises).forEach(([exerciseId, exercise]) => {
      if (!exercise || !exercise.name) return;
      flat.push({ exerciseId, name: exercise.name, category });
    });
  });

  flat.sort((a, b) => {
    const freqA = frequencyMap[a.exerciseId] || 0;
    const freqB = frequencyMap[b.exerciseId] || 0;
    if (freqB !== freqA) return freqB - freqA;
    return a.name.localeCompare(b.name);
  });

  const result = {};
  flat.forEach(({ exerciseId, name }) => {
    result[exerciseId] = { name };
  });
  return result;
}

function sortExercisesByCategory(data, frequencyMap) {
  const output = {};

  Object.entries(data).forEach(([category, exercises]) => {
    if (!exercises || typeof exercises !== 'object') return;

    const sorted = Object.entries(exercises)
      .filter(([, exercise]) => exercise && exercise.name)
      .sort(([idA, a], [idB, b]) => {
        const freqA = frequencyMap[idA] || 0;
        const freqB = frequencyMap[idB] || 0;
        if (freqB !== freqA) return freqB - freqA;
        return a.name.localeCompare(b.name);
      });

    const ordered = {};
    sorted.forEach(([exerciseId, exercise]) => {
      ordered[exerciseId] = { name: exercise.name };
    });

    output[category] = ordered;
  });

  return output;
}

async function loadFocusAreas() {
  focusCategory.innerHTML = '';
  const snapshot = await window.database.ref('focusareas').once('value');
  snapshot.forEach((childSnapshot) => {
    const focusArea = childSnapshot.key;
    const option = document.createElement('option');
    option.value = focusArea;
    option.textContent = focusArea;
    focusCategory.appendChild(option);
  });

  const addOption = document.createElement('option');
  addOption.value = 'addNew';
  addOption.textContent = '➕ Add New Focus Area';
  focusCategory.appendChild(addOption);
}

function handleFocusCategoryChange() {
  if (focusCategory.value === 'addNew') {
    const newFocusArea = prompt('Enter a new focus area:');
    if (!newFocusArea) {
      focusCategory.value = '';
      return;
    }

    const sanitizedFocusArea = newFocusArea.trim();
    const focusRef = window.database.ref(`focusareas/${sanitizedFocusArea}`);

    focusRef.once('value').then((snapshot) => {
      if (snapshot.exists()) {
        alert('Focus area already exists!');
      } else {
        focusRef.set(true);
        const newOption = document.createElement('option');
        newOption.value = sanitizedFocusArea;
        newOption.textContent = sanitizedFocusArea;
        focusCategory.insertBefore(newOption, focusCategory.lastElementChild);
        newOption.selected = true;
      }
      focusCategory.value = '';
    });
  }
}

function handleFocusCheckboxChange() {
  focusContainer.style.display = focusCheckbox.checked ? 'block' : 'none';
}

function addSelectedExercise() {
  const selectedOption = exerciseSelect.options[exerciseSelect.selectedIndex];
  const exerciseId = selectedOption?.value;
  const exerciseName = selectedOption?.text;

  if (!exerciseId || selectedExercises.some((e) => e.id === exerciseId)) {
    alert('Exercise already exists');
    return;
  }

  selectedExercises.push({ id: exerciseId, name: exerciseName, sets: 0, reps: 0, note: '', showSR: false });
  renderExerciseList();
  saveWorkoutDraft();
}

function renderExerciseList() {
  exerciseList.innerHTML = '';

  selectedExercises.forEach((exercise, index) => {
    const exerciseDiv = document.createElement('div');
    exerciseDiv.className = 'exercise-item';
    exerciseDiv.innerHTML = `
      <div class="row p-1">
        <div class="col-12 col-md-3">${exercise.name}</div>
        <div class="col-4 col-md-1">
          <input type="number" class="form-control sets-input" placeholder="Sets" data-index="${index}" value="${exercise.sets !== 0 ? exercise.sets : ''}">
        </div>
        <div class="col-4 col-md-1">
          <input type="number" class="form-control reps-input" placeholder="Reps" data-index="${index}" value="${exercise.reps !== 0 ? exercise.reps : ''}">
        </div>
        <div class="col-8 col-md-2">
          <input type="text" class="form-control note-input" placeholder="Add a note" data-index="${index}" value="${exercise.note || ''}">
        </div>
        <div class="col-2 col-md-1">
          <button class="btn btn-danger remove-btn" data-index="${index}">X</button>
        </div>
      </div>
    `;
    exerciseList.appendChild(exerciseDiv);
  });

  const intensityDiv = document.createElement('div');
  intensityDiv.className = 'introw';
  intensityDiv.innerHTML = `
    <div class="row p-1">
      <div class="col-8 col-md-3">Workout Intensity</div>
      <div class="col-8 col-md-2">
        <input type="number" id="workoutIntensity" class="form-control" placeholder="1-10" min="1" max="10" value="${currentWorkout.intensity || ''}">
      </div>
      <div class="col-8 col-md-2">
        <input type="text" id="workoutIntensityNote" class="form-control" placeholder="Misc. notes" value="${currentWorkout.intensityNote || ''}">
      </div>
      <div class="col-1"></div>
    </div>
  `;

  exerciseList.appendChild(intensityDiv);
  addDraftListeners();
}

function addDraftListeners() {
  document.querySelectorAll('.sets-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const index = Number(e.target.dataset.index);
      const value = parseInt(e.target.value, 10) || 0;
      selectedExercises[index].sets = value;
      if (value > 0) {
        ensureClockRunning();
      }
      saveWorkoutDraft();
    });
  });

  document.querySelectorAll('.reps-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const index = Number(e.target.dataset.index);
      selectedExercises[index].reps = parseInt(e.target.value, 10) || 0;
      saveWorkoutDraft();
    });
  });

  document.querySelectorAll('.note-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const index = Number(e.target.dataset.index);
      selectedExercises[index].note = e.target.value.trim();
      saveWorkoutDraft();
    });
  });

  document.querySelectorAll('.remove-btn').forEach((button) => {
    button.addEventListener('click', (e) => {
      const index = Number(e.target.dataset.index);
      selectedExercises.splice(index, 1);
      renderExerciseList();
      saveWorkoutDraft();
    });
  });

  const intensityInput = document.getElementById('workoutIntensity');
  const intensityNoteInput = document.getElementById('workoutIntensityNote');

  if (intensityInput) {
    intensityInput.addEventListener('input', (e) => {
      currentWorkout.intensity = e.target.value.trim();
      saveWorkoutDraft();
    });
  }

  if (intensityNoteInput) {
    intensityNoteInput.addEventListener('input', (e) => {
      currentWorkout.intensityNote = e.target.value.trim();
      saveWorkoutDraft();
    });
  }
}

function getToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function saveWorkout(workout) {
  return new Promise((resolve, reject) => {
    const workoutsRef = window.database.ref('workouts');
    workoutsRef.push(workout, (error) => {
      if (error) {
        console.error('Error saving workout:', error);
        reject(error);
      } else {
        clearWorkoutDraft();
        if (typeof onWorkoutSaved === 'function') {
          onWorkoutSaved();
        }
        resolve();
      }
    });
  });
}

async function loadWorkoutDraft() {
  const snapshot = await workoutDraftRef.once('value');
  const draft = snapshot.val();

  if (draft && Array.isArray(draft.exercises)) {
    selectedExercises.length = 0;
    selectedExercises.push(...draft.exercises);
    currentWorkout.intensity = draft.intensity || '';
    currentWorkout.intensityNote = draft.intensityNote || '';
    renderExerciseList();
  }
}

function saveWorkoutDraft() {
  const draft = {
    exercises: selectedExercises,
    intensity: currentWorkout.intensity || '',
    intensityNote: currentWorkout.intensityNote || '',
    date: getToday(),
  };

  workoutDraftRef.set(draft, (error) => {
    if (error) {
      console.error('Error saving workout draft:', error);
    }
  });
}

function clearWorkoutDraft() {
  workoutDraftRef.remove((error) => {
    if (error) {
      console.error('Error clearing workout draft:', error);
    }
  });
}

export async function initExerciseManagement(config = {}) {
  onWorkoutSaved = config.onWorkoutSaved;

  // Use the old focus-area checkbox slot for category grouping.
  try {
    focusCheckbox.style.display = 'none';
  } catch (e) {}
  try {
    focusContainer.style.display = 'none';
  } catch (e) {}
  const groupCheckbox = document.getElementById('seefocusCheckbox');
  if (groupCheckbox) {
    groupCheckbox.addEventListener('change', loadExercises);
    if (groupCheckbox.parentElement) {
      groupCheckbox.parentElement.style.display = 'inline-flex';
    }
  }
  addExerciseBtn.addEventListener('click', addSelectedExercise);
  saveNewExerciseBtn.addEventListener('click', async () => {
    const name = newExerciseName.value.trim();
    const category = exerciseCategory.value;

    if (!name) {
      alert('Please enter an exercise name.');
      return;
    }

    try {
      await saveNewExerciseToDatabase(name, category);
      newExerciseName.value = '';
      await loadExercises();
      alert('Exercise added successfully!');
    } catch (error) {
      console.error('Error saving new exercise:', error);
      alert('Error saving new exercise.');
    }
  });

  saveWorkoutBtn.addEventListener('click', async () => {
    if (selectedExercises.length === 0) {
      alert('Please add some exercises before saving!');
      return;
    }

    const workoutDuration = formatDuration(validateBtn.textContent);
    const workout = {
      date: getToday(),
      exercises: selectedExercises,
      intensity: currentWorkout.intensity || '',
      intensityNote: currentWorkout.intensityNote || '',
      duration: workoutDuration,
    };

    try {
      await saveWorkout(workout);
      alert('Workout saved successfully!');
      selectedExercises.length = 0;
      currentWorkout.intensity = '';
      currentWorkout.intensityNote = '';
      renderExerciseList();
    } catch (error) {
      alert('Error saving workout: ' + error.message);
    }
  });

    await loadExercises();
    await loadWorkoutDraft();
}

function saveNewExerciseToDatabase(name, category) {
  const exerciseData = { name };
  if (category && category.toLowerCase() !== 'none') {
    const exercisesRef = window.database.ref(`exercises/${category}`);
    const newExerciseRef = exercisesRef.push();
    return newExerciseRef.set(exerciseData);
  }
  return Promise.resolve();
}
