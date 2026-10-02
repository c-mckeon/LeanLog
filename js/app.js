const PAUSE_ICON = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="2.6" height="10"/><rect x="8.4" y="2" width="2.6" height="10"/></svg>';
const PLAY_ICON = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M3.5 2l8 5-8 5z"/></svg>';

//-////////////////////////////////////////////////////////////////////////// Clock timer fuctionality


// Reference to the Firebase Realtime Database
const validateBtn = document.getElementById('validateBtn');
const pauseDiv = document.querySelector('#pauseBtn').parentElement; // Parent div of pauseBtn
const resetDiv = document.querySelector('#resetBtn').parentElement; // Parent div of resetBtn
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');

let timerInterval = null;
let paused = false; // Track if the clock is paused
let elapsedTime = 0; // Store elapsed time in milliseconds when paused
let startTime = null; // Store the initial start time

// Function to update the button's display with the elapsed time
function updateClockDisplay() {
  const totalElapsed = paused ? elapsedTime : Date.now() - startTime; // Use elapsedTime when paused
  const hours = Math.floor(totalElapsed / (1000 * 60 * 60));
  const minutes = Math.floor((totalElapsed % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((totalElapsed % (1000 * 60)) / 1000);

  validateBtn.textContent = `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Function to start the clock
function startClock() {
  validateBtn.style.backgroundColor = 'white';
  validateBtn.style.borderColor = 'black';
  validateBtn.style.color = 'black';

  if (timerInterval) clearInterval(timerInterval); // Clear any existing timer

  timerInterval = setInterval(() => {
    if (!paused) {
      updateClockDisplay();
    }
  }, 1000);
}

// Function to check if the button was clicked in the last three hours
function checkLastClick() {
  fetch(`${workoutApiOrigin}/api/clock`, { credentials: 'include' })
    .then((response) => {
      if (!response.ok) throw new Error(`Clock request failed with ${response.status}.`);
      return response.json();
    })
    .then(({ startTime: lastStartTime }) => {
      if (lastStartTime) {
        const currentTime = Date.now();
        const timeElapsedSinceStart = currentTime - lastStartTime;

        if (timeElapsedSinceStart < 3 * 60 * 60 * 1000) {
          // If within 3 hours, restore state
          startTime = lastStartTime; // Set the start time
          elapsedTime = timeElapsedSinceStart; // Update elapsed time
          startClock();
          pauseDiv.style.display = 'block'; // Show the pause button's parent div
          resetDiv.style.display = 'block'; // Show the reset button's parent div
          updateClockDisplay();
        }
      }
    })
    .catch((error) => {
      console.error('Error retrieving clock state:', error);
    });


}




// Listen for the validate button click
validateBtn.addEventListener('click', () => {
  if (!startTime) {
    // If the clock is not already running, initialize it
    startTime = Date.now();
    elapsedTime = 0;

    postToWorkoutApi('/api/clock/start', { startTime })
      .then(() => {
        startClock();

        // Show the pause and reset buttons' parent divs
        pauseDiv.style.display = 'block';
        resetDiv.style.display = 'block';


      })
      .catch((error) => {
        startTime = null;
        console.error('Error starting clock:', error);
      });
  }
});

// Listen for the pause button click
pauseBtn.addEventListener('click', () => {
  if (paused) {
    // Resume the clock
    paused = false;
    startTime = Date.now() - elapsedTime; // Adjust the start time to account for elapsed time
    pauseBtn.innerHTML = PAUSE_ICON; pauseBtn.title = 'Pause';
    startClock(); // Restart the clock
  } else {
    // Pause the clock
    paused = true;
    elapsedTime = Date.now() - startTime; // Store the elapsed time
    clearInterval(timerInterval); // Stop the clock ticking
    pauseBtn.innerHTML = PLAY_ICON; pauseBtn.title = 'Resume';
  }
});

// Listen for the reset button click
resetBtn.addEventListener('click', () => {
  if (timerInterval) clearInterval(timerInterval);
  paused = false;
  elapsedTime = 0;
  startTime = null;

  validateBtn.style.backgroundColor = 'green'; // Reset button color
  validateBtn.style.borderColor = 'black'; // Reset button border
  validateBtn.style.color = ''; // Reset button text color
  validateBtn.textContent = 'Start clock'; // Reset button text

  // Hide pause and reset buttons' parent divs again
  pauseDiv.style.display = 'none';
  resetDiv.style.display = 'none';

  // Clear the start time from the database
  fetch(`${workoutApiOrigin}/api/clock`, {
    method: 'DELETE',
    credentials: 'include'
  }).catch((error) => {
      console.error('Error clearing clock state:', error);
    });
});

// On page load, check if the button was clicked in the last 3 hours
document.addEventListener('DOMContentLoaded', () => {
  // Hide pause and reset buttons by default
  pauseDiv.style.display = 'none';
  resetDiv.style.display = 'none';
  setupWorkoutYearSelector();
});

//////////////////////////////////////////////////////////////////////////// Clock timer fuctionality

//-////////////////////////////////////////////////////////////////////////// Creating exercises, editing workouts, exercise list
// DOM Elements
const exerciseSelect = document.getElementById('exerciseSelect');
const exercisePicker = document.getElementById('exercisePicker');
const exercisePickerTrigger = document.getElementById('exercisePickerTrigger');
const exercisePickerMenu = document.getElementById('exercisePickerMenu');
const exercisePickerOptions = document.getElementById('exercisePickerOptions');
const addExerciseBtn = document.getElementById('addExerciseBtn');
const exerciseList = document.getElementById('exerciseList');
const saveWorkoutBtn = document.getElementById('saveWorkoutBtn');
const savedWorkoutList = document.getElementById('savedWorkoutList');
const newExerciseName = document.getElementById('newExerciseName');
const exerciseCategory = document.getElementById('exerciseCategory');
const saveNewExerciseBtn = document.getElementById('saveNewExerciseBtn');
const focusCategory = document.getElementById('focusCategory');
const focusCheckbox = document.getElementById('focusCheckbox');
const focusContainer = document.getElementById('focusContainer');
const addExerciseFormWrapper = document.getElementById('addExerciseFormWrapper');
const toggleAddExerciseFormBtn = document.getElementById('toggleAddExerciseFormBtn');
const settingsGearBtn = document.getElementById('settingsGearBtn');
const settingsPanel = document.getElementById('settingsPanel');
const exerciseGroupingModeButtons = document.querySelectorAll('[data-grouping-mode]');
const showWeightMovedCheckbox = document.getElementById('showWeightMovedSetting');
const showWorkoutNotesCheckbox = document.getElementById('showWorkoutNotesSetting');
const showPostWorkoutNotesCheckbox = document.getElementById('showPostWorkoutNotesSetting');
const showSetNotesCheckbox = document.getElementById('showSetNotesSetting');
let showWeightMoved = true;
let showWorkoutNotes = true;
let showPostWorkoutNotes = true;
let showSetNotes = true;

function setExercisePickerOpen(isOpen) {
  if (!exercisePickerMenu || !exercisePickerTrigger) return;
  exercisePickerMenu.hidden = !isOpen;
  exercisePickerTrigger.setAttribute('aria-expanded', String(isOpen));
}

if (exercisePickerTrigger) {
  exercisePickerTrigger.addEventListener('click', () => {
    setExercisePickerOpen(exercisePickerMenu.hidden);
  });

  document.addEventListener('click', (event) => {
    if (exercisePicker && !exercisePicker.contains(event.target)) setExercisePickerOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && exercisePickerMenu && !exercisePickerMenu.hidden) {
      setExercisePickerOpen(false);
      exercisePickerTrigger.focus();
    }
  });
}

function renderExercisePickerOptions() {
  if (!exercisePickerOptions) return;

  exercisePickerOptions.replaceChildren();
  Array.from(exerciseSelect.children).forEach((entry) => {
    const options = entry.tagName === 'OPTGROUP' ? Array.from(entry.children) : [entry];
    const validOptions = options.filter((option) => option.value);
    if (!validOptions.length) return;

    if (entry.tagName === 'OPTGROUP') {
      const heading = document.createElement('div');
      heading.className = 'exercise-picker-category';
      heading.textContent = entry.label;
      exercisePickerOptions.appendChild(heading);
    }

    validOptions.forEach((option) => {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'exercise-picker-option';
      choice.textContent = option.textContent;
      choice.addEventListener('click', () => {
        exerciseSelect.value = option.value;
        exercisePickerTrigger.querySelector('[data-exercise-picker-label]').textContent = option.textContent;
        setExercisePickerOpen(false);
        exercisePickerTrigger.focus();
      });
      exercisePickerOptions.appendChild(choice);
    });
  });
}

const sectionVisibilityTargets = {
  addEdit: ['#addEditSection'],
  workouts: ['#showWorkoutsSection'],
  calendar: ['#calendarSection'],
  progress: ['#progressdiv'],
  volume: ['#showvolume']
};

function setSectionIncluded(sectionName, included) {
  (sectionVisibilityTargets[sectionName] || []).forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.classList.toggle('section-disabled', !included);
    });
  });
}

async function loadSectionVisibilitySettings() {
  try {
    const snapshot = await database.ref('settings/sections').once('value');
    const savedSections = snapshot.val() || {};

    Object.keys(sectionVisibilityTargets).forEach((sectionName) => {
      const checkbox = document.querySelector(`[data-section-setting="${sectionName}"]`);
      const included = savedSections[sectionName] !== false;
      if (checkbox) checkbox.checked = included;
      setSectionIncluded(sectionName, included);
    });
  } catch (error) {
    console.error('Error loading section settings:', error);
  }
}

Object.keys(sectionVisibilityTargets).forEach((sectionName) => {
  const checkbox = document.querySelector(`[data-section-setting="${sectionName}"]`);
  if (!checkbox) return;

  checkbox.addEventListener('change', async () => {
    const included = checkbox.checked;
    setSectionIncluded(sectionName, included);

    try {
      await database.ref('settings/sections').update({ [sectionName]: included });
    } catch (error) {
      console.error('Error saving section settings:', error);
    }
  });
});

loadSectionVisibilitySettings();

async function loadShowWeightMovedSetting() {
  try {
    const snapshot = await database.ref('settings/volume/showWeightMoved').once('value');
    showWeightMoved = snapshot.val() !== false;
    if (showWeightMovedCheckbox) showWeightMovedCheckbox.checked = showWeightMoved;
  } catch (error) {
    console.error('Error loading weight display setting:', error);
  }
}

function applyWorkoutNoteVisibility() {
  const intensityRow = document.getElementById('introwcss');
  const resultSection = document.getElementById('resultsection');
  if (intensityRow) intensityRow.classList.toggle('hidden', !showWorkoutNotes);
  if (resultSection && !showPostWorkoutNotes) resultSection.classList.add('hidden');
}

if (showWeightMovedCheckbox) {
  showWeightMovedCheckbox.addEventListener('change', async () => {
    const previousValue = showWeightMoved;
    showWeightMoved = showWeightMovedCheckbox.checked;
    updateVolumeSummary();
    if (typeof renderExerciseList === 'function' && exerciseList) renderExerciseList();

    try {
      await database.ref('settings/volume/showWeightMoved').set(showWeightMoved);
    } catch (error) {
      showWeightMoved = previousValue;
      showWeightMovedCheckbox.checked = previousValue;
      updateVolumeSummary();
      console.error('Error saving weight display setting:', error);
    }
  });
}

async function saveWorkoutNoteVisibility(settingName, checkbox, previousValue) {
  try {
    await database.ref('settings/workoutBuilder').update({ [settingName]: checkbox.checked });
  } catch (error) {
    checkbox.checked = previousValue;
    if (settingName === 'showWorkoutNotes') showWorkoutNotes = previousValue;
    if (settingName === 'showPostWorkoutNotes') showPostWorkoutNotes = previousValue;
    if (settingName === 'showSetNotes') { showSetNotes = previousValue; renderExerciseList(); }
    applyWorkoutNoteVisibility();
    if (settingName === 'showPostWorkoutNotes' && previousValue) checkLastWorkoutResult();
    console.error(`Error saving ${settingName} setting:`, error);
  }
}

if (showWorkoutNotesCheckbox) {
  showWorkoutNotesCheckbox.addEventListener('change', async () => {
    const previousValue = showWorkoutNotes;
    showWorkoutNotes = showWorkoutNotesCheckbox.checked;
    applyWorkoutNoteVisibility();
    await saveWorkoutNoteVisibility('showWorkoutNotes', showWorkoutNotesCheckbox, previousValue);
  });
}

if (showSetNotesCheckbox) {
  showSetNotesCheckbox.addEventListener('change', async () => {
    const previousValue = showSetNotes;
    showSetNotes = showSetNotesCheckbox.checked;
    renderExerciseList();
    await saveWorkoutNoteVisibility('showSetNotes', showSetNotesCheckbox, previousValue);
  });
}

if (showPostWorkoutNotesCheckbox) {
  showPostWorkoutNotesCheckbox.addEventListener('change', async () => {
    const previousValue = showPostWorkoutNotes;
    showPostWorkoutNotes = showPostWorkoutNotesCheckbox.checked;
    applyWorkoutNoteVisibility();
    if (showPostWorkoutNotes) checkLastWorkoutResult();
    await saveWorkoutNoteVisibility('showPostWorkoutNotes', showPostWorkoutNotesCheckbox, previousValue);
  });
}

const EXERCISE_GROUPING_MODE = {
  FREQUENCY: 'frequency',
  CATEGORY: 'category'
};
const DEFAULT_EXERCISE_CATEGORIES = ['Legs', 'Core', 'Upper-Body Pull'];
let workoutBuilderGroupingMode = EXERCISE_GROUPING_MODE.FREQUENCY;
let exerciseCategories = [];

function normalizeExerciseVariations(variations) {
  const values = Array.isArray(variations)
    ? variations
    : (variations && typeof variations === 'object' ? Object.values(variations) : []);
  return [...new Set(values
    .filter((variation) => typeof variation === 'string')
    .map((variation) => variation.trim())
    .filter(Boolean))];
}

function escapeExerciseHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

if (settingsGearBtn && settingsPanel) {
  settingsGearBtn.addEventListener('click', () => {
    const isHidden = settingsPanel.classList.toggle('hidden');
    settingsGearBtn.setAttribute('aria-expanded', String(!isHidden));
  });

  document.addEventListener('click', (event) => {
    if (!settingsPanel.classList.contains('hidden') && !settingsPanel.contains(event.target) && !settingsGearBtn.contains(event.target)) {
      settingsPanel.classList.add('hidden');
      settingsGearBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

const selectedExercises = [];
// Exercise metadata loaded into the dropdown so added exercises preserve editor settings.
const exerciseMetadataById = {};
let exerciseCatalogByCategory = {};

// Normalize stored fields to an array. Accepts arrays or objects (Firebase may store arrays as objects).
function normalizeFields(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    return Object.values(raw).filter(Boolean);
  }
  return [];
}
function getWorkoutDraftRef() {
  return database.ref('workoutDraft');
}

// Current workout intensity
let currentWorkout = { intensity: '', intensityNote: '' };
const workoutApiOrigin = window.WORKOUT_BACKEND_ORIGIN || 'https://lean-backend.agreeableplant-a51f439e.northeurope.azurecontainerapps.io';

// Toggle focus area selection visibility
focusCheckbox.addEventListener('change', () => {
    focusContainer.style.display = focusCheckbox.checked ? 'block' : 'none';
});

if (toggleAddExerciseFormBtn && addExerciseFormWrapper) {
  toggleAddExerciseFormBtn.addEventListener('click', () => {
    addExerciseFormWrapper.classList.toggle('hidden');
  });
}

// Clear dropdown options
function clearDropdown() {
    exerciseSelect.innerHTML = '';
}

// Function to load exercises dynamically based on checkbox state
async function loadExercises() {
  const response = await fetch(`${workoutApiOrigin}/api/exercises`, { credentials: 'include' });
  if (!response.ok) throw new Error(`Could not load exercises (${response.status}).`);
  const result = await response.json();
  exerciseCatalogByCategory = result.exercises || {};

  const hasUnnamedExercise = Object.values(exerciseCatalogByCategory).some((categoryExercises) =>
    Object.values(categoryExercises || {}).some((exercise) => !exercise || typeof exercise.name !== 'string' || !exercise.name.trim())
  );

  if (hasUnnamedExercise) {
    const workoutsSnapshot = await database.ref('workouts').once('value');
    const workoutNamesByExerciseId = {};
    Object.values(workoutsSnapshot.val() || {}).forEach((workout) => {
      const workoutExercises = Array.isArray(workout?.exercises)
        ? workout.exercises
        : Object.values(workout?.exercises || {});
      workoutExercises.forEach((exercise) => {
        if (exercise?.id && typeof exercise.name === 'string' && exercise.name.trim()) {
          workoutNamesByExerciseId[exercise.id] = exercise.name.trim();
        }
      });
    });

    Object.values(exerciseCatalogByCategory).forEach((categoryExercises) => {
      Object.entries(categoryExercises || {}).forEach(([exerciseId, exercise]) => {
        if (exercise && (typeof exercise.name !== 'string' || !exercise.name.trim())) {
          if (!Array.isArray(exercise.variations) && Array.isArray(exercise.name?.variations)) {
            exercise.variations = exercise.name.variations;
          }
          exercise.name = workoutNamesByExerciseId[exerciseId] || '';
        }
      });
    });
  }

  renderExerciseDropdown(exerciseCatalogByCategory, {});
}

async function computeExerciseFrequency() {
  const snapshot = await database.ref('workouts').once('value');
  const workouts = snapshot.val();
  const frequencyMap = {};

  if (!workouts || typeof workouts !== 'object') {
    return frequencyMap;
  }

  Object.values(workouts).forEach((workout) => {
    if (!workout || !Array.isArray(workout.exercises)) return;
    workout.exercises.forEach((exercise) => {
      const key = exercise.id || exercise.name;
      if (!key) return;
      frequencyMap[key] = (frequencyMap[key] || 0) + 1;
    });
  });

  return frequencyMap;
}

// Load focus areas dynamically, including an "Add New Focus Area" option
async function loadFocusAreas() {
  focusCategory.innerHTML = "";
  const response = await fetch(`${workoutApiOrigin}/api/focus-areas`, { credentials: 'include' });
  if (!response.ok) throw new Error(`Could not load focus areas (${response.status}).`);
  const result = await response.json();

  (result.focusAreas || []).forEach((focusArea) => {
    const option = document.createElement("option");
    option.value = focusArea;
    option.textContent = focusArea;
    focusCategory.appendChild(option);
  });

  const addOption = document.createElement("option");
  addOption.value = "addNew";
  addOption.textContent = "Add New Focus Area";
  focusCategory.appendChild(addOption);
}

function getExerciseCategoriesRef() {
  return database.ref('settings/exerciseCategories');
}

function renderExerciseCategoryOptions() {
  if (!exerciseCategory) return;

  exerciseCategory.innerHTML = '';

  exerciseCategories.forEach((categoryName) => {
    const option = document.createElement('option');
    option.value = categoryName;
    option.textContent = categoryName;
    exerciseCategory.appendChild(option);
  });

  const manageSeparator = document.createElement('option');
  manageSeparator.disabled = true;
  manageSeparator.textContent = '──────────';
  exerciseCategory.appendChild(manageSeparator);

  const addOption = document.createElement('option');
  addOption.value = 'addNewCategory';
  addOption.textContent = '➕ Add New Category';
  exerciseCategory.appendChild(addOption);

  const removeOption = document.createElement('option');
  removeOption.value = 'removeCategory';
  removeOption.textContent = '➖ Remove Category';
  exerciseCategory.appendChild(removeOption);

  if (!exerciseCategories.includes(exerciseCategory.value)) {
    exerciseCategory.value = exerciseCategories[0] || 'addNewCategory';
  }
}

async function loadExerciseCategories() {
  try {
    const snapshot = await getExerciseCategoriesRef().once('value');
    const savedCategories = snapshot.val();
    if (Array.isArray(savedCategories) && savedCategories.length > 0) {
      exerciseCategories = savedCategories.filter(Boolean);
    } else {
      exerciseCategories = [...DEFAULT_EXERCISE_CATEGORIES];
      await getExerciseCategoriesRef().set(exerciseCategories);
    }
  } catch (error) {
    console.error('Error loading exercise categories:', error);
    exerciseCategories = [...DEFAULT_EXERCISE_CATEGORIES];
  }

  renderExerciseCategoryOptions();
}

async function saveExerciseCategories() {
  try {
    await getExerciseCategoriesRef().set(exerciseCategories);
  } catch (error) {
    console.error('Error saving exercise categories:', error);
  }
}

async function addExerciseCategory() {
  const categoryName = prompt('Enter a new category name:');
  if (!categoryName) return;

  const cleaned = categoryName.trim();
  if (!cleaned) return;

  const exists = exerciseCategories.some((category) => category.toLowerCase() === cleaned.toLowerCase());
  if (exists) {
    alert('Category already exists');
    return;
  }

  exerciseCategories.push(cleaned);
  exerciseCategories.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  await saveExerciseCategories();
  renderExerciseCategoryOptions();
  exerciseCategory.value = cleaned;
}

async function removeExerciseCategory() {
  if (exerciseCategories.length <= 1) {
    alert('At least one category is required');
    return;
  }

  const categoryName = prompt('Enter the category name to remove:');
  if (!categoryName) return;

  const cleaned = categoryName.trim();
  const index = exerciseCategories.findIndex((category) => category.toLowerCase() === cleaned.toLowerCase());
  if (index < 0) {
    alert('Category not found');
    return;
  }

  exerciseCategories.splice(index, 1);
  await saveExerciseCategories();
  renderExerciseCategoryOptions();
}

if (exerciseCategory) {
  exerciseCategory.addEventListener('change', async () => {
    if (exerciseCategory.value === 'addNewCategory') {
      await addExerciseCategory();
    } else if (exerciseCategory.value === 'removeCategory') {
      await removeExerciseCategory();
    }
  });
}

// Detect when "Add New Focus Area" is selected
focusCategory.addEventListener("change", function() {
  if (focusCategory.value === "addNew") {
      const newFocusArea = prompt("Enter a new focus area:");

      if (newFocusArea) {
          const sanitizedFocusArea = newFocusArea.trim();

          // Check if it already exists
          database.ref(`focusareas/${sanitizedFocusArea}`).once("value", snapshot => {
              if (snapshot.exists()) {
                  alert("Focus area already exists!");
              } else {
                    createFocusArea(sanitizedFocusArea).then(() => {
                      const newOption = document.createElement("option");
                      newOption.value = sanitizedFocusArea;
                      newOption.textContent = sanitizedFocusArea;
                      focusCategory.insertBefore(newOption, focusCategory.lastElementChild);
                      newOption.selected = true;
                    }).catch((error) => {
                      alert(error.message);
                    });
              }
          });
      }

      // Reset selection to prevent re-triggering
      focusCategory.value = "";
  }
});

// Ensure focus area selection only appears when checkbox is checked
focusCheckbox.addEventListener('change', () => {
  focusContainer.style.display = focusCheckbox.checked ? 'block' : 'none';
});

function setupWorkoutYearSelector() {
  const yearSelect = document.getElementById('workout-year-filter');
  if (!yearSelect) return;

  const currentYear = new Date().getFullYear();
  const years = ['all', currentYear, currentYear - 1, currentYear - 2];
  yearSelect.innerHTML = '';

  years.forEach((year, idx) => {
    const option = document.createElement('option');
    option.value = year === 'all' ? 'all' : year.toString();
    option.textContent = year === 'all' ? 'All years' : year.toString();
    if (year === currentYear) option.selected = true;
    yearSelect.appendChild(option);
  });
}



async function requestWorkoutApi(path, method, body) {
  const response = await fetch(`${workoutApiOrigin}${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'The request failed.');
  }
  return result;
}

async function postToWorkoutApi(path, body) {
  return requestWorkoutApi(path, 'POST', body);
}

async function createFocusArea(name) {
  return postToWorkoutApi('/api/focus-areas', { name });
}

saveNewExerciseBtn.addEventListener('click', async () => {
    const name = newExerciseName.value.trim();
    const category = exerciseCategory.value;
  const selectedFocusAreas = focusCheckbox?.checked
        ? Array.from(focusCategory.selectedOptions).map(opt => opt.value)
        : [];

    if (!name) {
        alert('Please enter an exercise name.');
        return;
    }

    try {
      await postToWorkoutApi('/api/exercises', {
        name,
        category,
        focusAreas: selectedFocusAreas,
        fields: ['sets', 'reps', 'weight']
      });
      newExerciseName.value = '';
      await loadExercises();
      alert('Exercise added successfully!');
    } catch (error) {
      alert(error.message);
    }
});

// Prevent duplicate exercise addition
addExerciseBtn.addEventListener('click', () => {
    const selectedOption = exerciseSelect.options[exerciseSelect.selectedIndex];
    const exerciseId = selectedOption.value;
    const exerciseName = selectedOption.text;

    if (!exerciseId || selectedExercises.some(e => e.id === exerciseId)) {
        alert("Exercise already exists");
        return;
    }

    const exerciseCategory = selectedOption.dataset.category || selectedOption.parentElement?.label || 'Unknown';
    const exerciseMetadata = exerciseMetadataById[exerciseId] || {};
    const fields = normalizeFields(exerciseMetadata.fields);
    const trackSetsReps = fields.includes('sets') || fields.includes('reps');
    const trackCustomOnly = fields.includes('custom') && !trackSetsReps;
    const initialSetsList = (trackSetsReps || trackCustomOnly) ? [{ reps: '', weight: '', note: '', custom: '' }] : [];

    selectedExercises.push({
        id: exerciseId,
        name: exerciseName,
        category: exerciseCategory,
      fields,
      customLabel: exerciseMetadata.customLabel || '',
        variations: normalizeExerciseVariations(exerciseMetadata.variations),
        variation: '',
        sets: trackSetsReps ? 1 : 0,
        reps: 0,
        note: '',
        setsList: initialSetsList,
        activeSetIndex: 0,
        showSR: false
    });

    renderExerciseList();
    saveWorkoutDraft();
    if (!startTime) {
      startTime = Date.now();
      elapsedTime = 0;
      database
        .ref('access_logs/start_time')
        .set(startTime)
        .then(() => {
          startClock();
          pauseDiv.style.display = 'block';
          resetDiv.style.display = 'block';
          updateClockDisplay();
        })
        .catch((error) => {
          console.error('Error updating start_time:', error);
        });
    }
});

let dropdownContent = []; // Global variable to store the generated dropdown content

function getSettingsRef() {
  return database.ref('settings/workoutBuilder');
}

function setWorkoutBuilderGroupingMode(nextMode, persist = false) {
  const normalizedMode = nextMode === EXERCISE_GROUPING_MODE.CATEGORY
    ? EXERCISE_GROUPING_MODE.CATEGORY
    : EXERCISE_GROUPING_MODE.FREQUENCY;

  workoutBuilderGroupingMode = normalizedMode;

  exerciseGroupingModeButtons.forEach((button) => {
    const selected = button.dataset.groupingMode === normalizedMode;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  if (!persist) return Promise.resolve();

  return getSettingsRef()
    .update({ exerciseDropdownGrouping: normalizedMode })
    .catch((error) => {
      console.error('Error saving workout builder settings:', error);
    });
}

async function loadWorkoutBuilderSettings() {
  try {
    const snapshot = await getSettingsRef().once('value');
    const settings = snapshot.val() || {};
    const savedMode = settings.exerciseDropdownGrouping;
    showWorkoutNotes = settings.showWorkoutNotes !== false;
    showPostWorkoutNotes = settings.showPostWorkoutNotes !== false;
    showSetNotes = settings.showSetNotes !== false;
    if (showSetNotesCheckbox) showSetNotesCheckbox.checked = showSetNotes;
    if (showWorkoutNotesCheckbox) showWorkoutNotesCheckbox.checked = showWorkoutNotes;
    if (showPostWorkoutNotesCheckbox) showPostWorkoutNotesCheckbox.checked = showPostWorkoutNotes;
    applyWorkoutNoteVisibility();
    await setWorkoutBuilderGroupingMode(savedMode, false);
  } catch (error) {
    console.error('Error loading workout builder settings:', error);
    showWorkoutNotes = true;
    showPostWorkoutNotes = true;
    showSetNotes = true;
    if (showSetNotesCheckbox) showSetNotesCheckbox.checked = true;
    if (showWorkoutNotesCheckbox) showWorkoutNotesCheckbox.checked = true;
    if (showPostWorkoutNotesCheckbox) showPostWorkoutNotesCheckbox.checked = true;
    applyWorkoutNoteVisibility();
    await setWorkoutBuilderGroupingMode(EXERCISE_GROUPING_MODE.FREQUENCY, false);
  }
}

function normalizeCategoryName(categoryName) {
  return String(categoryName || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function getExerciseCategoryBucket(exercises, categoryName) {
  if (!exercises || typeof exercises !== 'object') return null;

  if (exercises[categoryName]) {
    return exercises[categoryName];
  }

  const normalizedTarget = normalizeCategoryName(categoryName);
  const matchingKey = Object.keys(exercises).find((key) => normalizeCategoryName(key) === normalizedTarget);
  return matchingKey ? exercises[matchingKey] : null;
}

function renderExerciseDropdown(exercises, frequencyMap = {}, fromFocusAreas = false) {
  console.log("renderExerciseDropdown() called");

  // Get the dropdown element
  const exerciseSelect = document.getElementById("exerciseSelect");

  // Check if the dropdown exists in the HTML
  if (!exerciseSelect) {
    console.error("❌ ERROR: exerciseSelect element not found!");
    return;
  }

  // Clear existing options
  exerciseSelect.innerHTML = "";
  exercisePickerTrigger.querySelector('[data-exercise-picker-label]').textContent = 'Select Exercise';

  // Add default placeholder option
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = "Select Exercise";
  placeholderOption.disabled = true;
  placeholderOption.selected = true;
  exerciseSelect.appendChild(placeholderOption);

  // Check if exercises exist and are valid
  if (!exercises || typeof exercises !== "object" || Object.keys(exercises).length === 0) {
    console.warn("⚠️ WARNING: No exercises found! Dropdown will be empty.");
    renderExercisePickerOptions();
    return;
  }

  dropdownContent = [];  // Reset the global variable before generating new content
  Object.keys(exerciseMetadataById).forEach(key => delete exerciseMetadataById[key]);

  const groupByCategory = workoutBuilderGroupingMode === EXERCISE_GROUPING_MODE.CATEGORY;
  const validCategories = (exerciseCategories.length > 0 ? exerciseCategories : Object.keys(exercises))
    .filter(category => category && typeof category === "string" && category.trim())
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const sortOptions = (options) => {
    return options.sort((a, b) => {
      const freqA = Number(a.frequency) || 0;
      const freqB = Number(b.frequency) || 0;
      if (freqA !== freqB) return freqB - freqA;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  };

  if (groupByCategory) {
    validCategories.forEach((category) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = category;
      const categoryExercises = getExerciseCategoryBucket(exercises, category) || {};

      const sortedOptions = sortOptions(
        Object.entries(categoryExercises)
          .map(([exerciseId, exercise]) => ({ exerciseId, exercise }))
          .filter(({ exercise }) => exercise && typeof exercise === "object" && exercise.name && typeof exercise.name === "string" && exercise.name.toLowerCase() !== "none" && exercise.name.trim())
          .map(({ exerciseId, exercise }) => ({
            exerciseId,
            name: exercise.name.trim(),
            frequency: Number(frequencyMap[exerciseId]) || 0
          }))
      );

      sortedOptions.forEach(({ exerciseId, name }) => {
        const exerciseFields = normalizeFields(categoryExercises[exerciseId]?.fields);
          exerciseMetadataById[exerciseId] = {
            fields: exerciseFields,
            customLabel: categoryExercises[exerciseId]?.customLabel || '',
            variations: normalizeExerciseVariations(categoryExercises[exerciseId]?.variations)
          };
        const option = document.createElement("option");
        option.value = exerciseId;
        option.textContent = name;
        option.dataset.category = category;
        optgroup.appendChild(option);
      });

      dropdownContent.push(optgroup);
      exerciseSelect.appendChild(optgroup);
    });
  } else {
    const allOptions = [];

    validCategories.forEach((category) => {
      const categoryExercises = getExerciseCategoryBucket(exercises, category) || {};
      Object.entries(categoryExercises).forEach(([exerciseId, exercise]) => {
        if (!exercise || typeof exercise !== "object" || !exercise.name || typeof exercise.name !== "string" || exercise.name.toLowerCase() === "none" || !exercise.name.trim()) {
          return;
        }
        allOptions.push({
          exerciseId,
          name: exercise.name.trim(),
          frequency: Number(frequencyMap[exerciseId]) || 0,
          category
        });
      });
    });

    sortOptions(allOptions).forEach(({ exerciseId, name, category }) => {
      const categoryExercises = getExerciseCategoryBucket(exercises, category) || {};
      const exerciseFields = normalizeFields(categoryExercises[exerciseId]?.fields);
      exerciseMetadataById[exerciseId] = {
        fields: exerciseFields,
        customLabel: categoryExercises[exerciseId]?.customLabel || '',
        variations: normalizeExerciseVariations(categoryExercises[exerciseId]?.variations)
      };
      const option = document.createElement("option");
      option.value = exerciseId;
      option.textContent = name;
      option.dataset.category = category;
      exerciseSelect.appendChild(option);
    });
  }

  renderExercisePickerOptions();
  console.log("✅ Dropdown updated successfully.");
}

exerciseGroupingModeButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    await setWorkoutBuilderGroupingMode(button.dataset.groupingMode, true);
    loadExercises();
  });
});



////////// Here is functionality for viewing and editing past workout fields

// 📌 Look inside "/workouts/"
var basePath = "/workouts/";
var workoutKeys = [];
var workoutsById = {};
var currentIndex = 0;

// Load workout node keys through the Cognito-protected backend.
async function loadWorkouts() {
  try {
    const response = await fetch(`${workoutApiOrigin}/api/workouts`, { credentials: 'include' });
    if (!response.ok) throw new Error(`Could not load workouts (${response.status}).`);
    const result = await response.json();
    workoutsById = result.workouts || {};
    workoutKeys = Object.keys(workoutsById);

    if (workoutKeys.length > 0) {
      console.log("Workout Keys:", workoutKeys);
      currentIndex = 0;
      displayCurrentNode();
    } else {
      document.getElementById("fields").innerHTML = "<p>No workouts found.</p>";
    }
  } catch (error) {
    console.error("Error fetching workouts:", error);
  }
}

// Display current workout node
function displayCurrentNode() {
    if (workoutKeys.length === 0) return;

    var workoutID = workoutKeys[currentIndex];
    var data = workoutsById[workoutID];
    console.log("Displaying workout:", workoutID); // DEBUG LOG
        var fieldsHTML = "";

        // 📌 Workout-Level Fields (Dynamically show all fields except "exercises")
        if (data) {
          fieldsHTML += `<h3>Workout Info</h3>`;
          // Define the workout fields with custom labels
          const workoutFields = {
              date: "Date",
              duration: "Duration",
              intensity: "Intensity",
              intensityNote: "Note",
              result: "Result" 
          };
      
          for (const key in workoutFields) {
              fieldsHTML += `
                  <label style="display:inline-block; width:65px">${workoutFields[key]}: </label>
                  <input type="text" style=" width:350px" id="workout_${key}" value="${data[key] || ''}"><br>
              `;
          }
      }
      

        // 📌 Exercise-Level Fields
        if (data && data.exercises) {
            fieldsHTML += `<br><h3>Exercises</h3>`;
            data.exercises.forEach((exercise, index) => {
                const setsList = Array.isArray(exercise.setsList) ? exercise.setsList : [];
                const preserveLegacy = !setsList.length;
                const legacySets = exercise.sets || '';
                const legacyReps = exercise.reps || '';
                const legacyWeight = exercise.weight || '';

                fieldsHTML += `
                    <div class="exercise-entry" data-index="${index}" style="margin-bottom: 16px; padding: 12px; border: 1px solid #ccc; border-radius: 6px;">
                      <div style="display:flex; flex-wrap:wrap; gap: 0.75rem; align-items:flex-start;">
                        <div style="min-width: 200px; flex: 1 1 220px;">
                          <label style="display:block; font-weight:600; margin-bottom: 4px;">Name</label>
                          <input type="text" id="name_${index}" value="${exercise.name || ''}" style="width:100%; margin-bottom: 8px;">
                          <label style="display:block; font-weight:600; margin-bottom: 4px;">Note</label>
                          <input type="text" id="note_${index}" value="${exercise.note || ''}" style="width:100%; margin-bottom: 8px;">
                          <button type="button" class="btn btn-danger btn-sm" onclick="deleteExercise(${index})">Delete exercise</button>
                        </div>
                        <div style="flex: 2 1 400px;">
                          <div style="display:flex; align-items:center; gap: 0.75rem; margin-bottom: 8px;">
                            <strong>Sets</strong>
                            <button type="button" class="btn btn-sm btn-outline-secondary add-editor-set-btn" data-index="${index}">+ Add set</button>
                          </div>
                          <div id="setsWrapper_${index}">
                            ${setsList.length > 0 ? setsList.map((set, setIndex) => `
                              <div class="set-row" data-exercise-index="${index}" data-set-index="${setIndex}" style="display:flex; gap: 0.5rem; align-items:center; margin-bottom: 6px; flex-wrap:wrap;">
                                <span style="min-width: 24px;">#${setIndex + 1}</span>
                                <input type="number" id="set_reps_${index}_${setIndex}" value="${set.reps || ''}" placeholder="Reps" style="width:80px;">
                                <input type="number" id="set_weight_${index}_${setIndex}" value="${set.weight || ''}" placeholder="Weight" style="width:80px;">
                                <input type="text" id="set_note_${index}_${setIndex}" value="${set.note || ''}" placeholder="Note" style="width:160px;">
                                <button type="button" class="btn btn-sm btn-outline-danger remove-set-editor-btn" data-exercise-index="${index}" data-set-index="${setIndex}">Remove</button>
                              </div>
                            `).join('') : `
                              <div class="legacy-row" style="display:flex; gap: 0.5rem; align-items:center; flex-wrap:wrap; margin-bottom: 6px;">
                                <label style="min-width: 45px;">Sets</label>
                                <input type="number" id="legacy_sets_${index}" value="${legacySets}" placeholder="Sets" style="width:80px;">
                                <label style="min-width: 45px;">Reps</label>
                                <input type="number" id="legacy_reps_${index}" value="${legacyReps}" placeholder="Reps" style="width:80px;">
                                <label style="min-width: 55px;">Weight</label>
                                <input type="number" id="legacy_weight_${index}" value="${legacyWeight}" placeholder="Weight" style="width:80px;">
                              </div>
                            `}
                          </div>
                        </div>
                      </div>
                    </div>
                `;
            });
        }

        document.getElementById("fields").innerHTML = fieldsHTML || "<p>No exercises found.</p>";
}

// ➡️ Move to next workout
function nextNode() {
    if (workoutKeys.length > 0) {
        currentIndex = (currentIndex + 1) % workoutKeys.length;
        console.log("Next node index:", currentIndex, "Key:", workoutKeys[currentIndex]); // DEBUG LOG
        displayCurrentNode();
    }
}

// ⬅️ Move to previous workout
function prevNode() {
    if (workoutKeys.length > 0) {
        currentIndex = (currentIndex - 1 + workoutKeys.length) % workoutKeys.length;
        displayCurrentNode();
    }
}

function addpastexercise() {
  var index = document.querySelectorAll('#fields .exercise-entry').length;
  var newExerciseHTML = `
      <div class="exercise-entry" data-index="${index}" style="margin-bottom: 16px; padding: 12px; border: 1px solid #ccc; border-radius: 6px;">
          <div style="display:flex; flex-wrap:wrap; gap: 0.75rem; align-items:flex-start;">
            <div style="min-width: 200px; flex: 1 1 220px;">
              <label style="display:block; font-weight:600; margin-bottom: 4px;">Name</label>
              <input type="text" id="name_${index}" value="" style="width:100%; margin-bottom: 8px;">
              <label style="display:block; font-weight:600; margin-bottom: 4px;">Note</label>
              <input type="text" id="note_${index}" value="" style="width:100%; margin-bottom: 8px;">
              <button type="button" class="btn btn-danger btn-sm" onclick="deleteExercise(${index})">Delete exercise</button>
            </div>
            <div style="flex: 2 1 400px;">
              <div style="display:flex; align-items:center; gap: 0.75rem; margin-bottom: 8px;">
                <strong>Sets</strong>
                <button type="button" class="btn btn-sm btn-outline-secondary add-editor-set-btn" data-index="${index}">+ Add set</button>
              </div>
              <div id="setsWrapper_${index}">
                <div class="set-row" data-exercise-index="${index}" data-set-index="0" style="display:flex; gap: 0.5rem; align-items:center; margin-bottom: 6px; flex-wrap:wrap;">
                  <span style="min-width: 24px;">#1</span>
                  <input type="number" id="set_reps_${index}_0" value="" placeholder="Reps" style="width:80px;">
                  <input type="number" id="set_weight_${index}_0" value="" placeholder="Weight" style="width:80px;">
                  <input type="text" id="set_note_${index}_0" value="" placeholder="Note" style="width:160px;">
                  <button type="button" class="btn btn-sm btn-outline-danger remove-set-editor-btn" data-exercise-index="${index}" data-set-index="0">Remove</button>
                </div>
              </div>
            </div>
          </div>
      </div>
  `;
  document.getElementById("fields").insertAdjacentHTML("beforeend", newExerciseHTML);
}



//  Save changes (Workout + Exercises)
function saveChanges() {
    var workoutID = workoutKeys[currentIndex];
    // Collect updated workout-level fields
    var workoutUpdates = {};
    var workoutInputs = document.querySelectorAll("#fields input[id^='workout_']");
    workoutInputs.forEach(input => {
        var field = input.id.replace("workout_", "");
        workoutUpdates[field] = input.value;
    });

    // Collect updated exercises
    var exerciseUpdates = [];
    var exerciseEntries = document.querySelectorAll('#fields .exercise-entry');

    exerciseEntries.forEach(entry => {
        var index = entry.dataset.index;
        var name = entry.querySelector(`#name_${index}`)?.value || '';
        var note = entry.querySelector(`#note_${index}`)?.value || '';
        var setsList = [];

        entry.querySelectorAll('.set-row').forEach(setRow => {
            var setIndex = setRow.dataset.setIndex;
            var repsValue = entry.querySelector(`#set_reps_${index}_${setIndex}`)?.value;
            var weightValue = entry.querySelector(`#set_weight_${index}_${setIndex}`)?.value;
            var noteValue = entry.querySelector(`#set_note_${index}_${setIndex}`)?.value;

            if (repsValue || weightValue || noteValue) {
                setsList.push({
                    reps: repsValue || '',
                    weight: weightValue || '',
                    note: noteValue || ''
                });
            }
        });

        if (setsList.length > 0) {
            exerciseUpdates.push({
                name,
                note,
                setsList
            });
            return;
        }

        var legacySets = parseInt(entry.querySelector(`#legacy_sets_${index}`)?.value, 10);
        var legacyReps = parseInt(entry.querySelector(`#legacy_reps_${index}`)?.value, 10);
        var legacyWeight = parseFloat(entry.querySelector(`#legacy_weight_${index}`)?.value);

        var exerciseObj = { name, note };
        if (!isNaN(legacySets)) exerciseObj.sets = legacySets;
        if (!isNaN(legacyReps)) exerciseObj.reps = legacyReps;
        if (!isNaN(legacyWeight)) exerciseObj.weight = legacyWeight;

        exerciseUpdates.push(exerciseObj);
    });

    const updatedWorkout = {
      ...(workoutsById[workoutID] || {}),
      ...workoutUpdates,
      exercises: exerciseUpdates
    };

    requestWorkoutApi(`/api/workouts/${encodeURIComponent(workoutID)}`, 'PUT', updatedWorkout)
      .then((result) => {
        workoutsById[workoutID] = result.workout;
        alert("Changes saved!");
      })
      .catch(error => alert("Error: " + error.message));
}

function deleteExercise(index) {
  if (!confirm("Are you sure you want to delete this exercise?")) return;

  var workoutID = workoutKeys[currentIndex];
  var fullPath = basePath + workoutID + "/exercises";

  database.ref(fullPath).once("value").then(snapshot => {
      var exercises = snapshot.val();
      if (!exercises || index >= exercises.length) return;

      // Remove the exercise from the array
      exercises.splice(index, 1);

      // Update Firebase with the new array (without the deleted exercise)
      return database.ref(fullPath).set(exercises);
  }).then(() => {
      displayCurrentNode(); // Refresh UI
  }).catch(error => {
      alert("Error deleting exercise: " + error.message);
  });
}


function deleteworkout() {
  // Confirm the deletion action with the user.
  if (!confirm("Are you sure you want to delete this workout? This action cannot be undone.")) {
    return;
  }
  
  // Retrieve the current workout ID using your workoutKeys array and currentIndex.
  var workoutID = workoutKeys[currentIndex];
  var fullPath = basePath + workoutID; // e.g., '/workouts/' + workoutID

  // Remove the workout from the Firebase database.
  database.ref(fullPath).remove()
    .then(() => {
      alert("Workout deleted successfully!");
      
      // Refresh local index and editor UI.
      workoutKeys.splice(currentIndex, 1);
      if (currentIndex >= workoutKeys.length) {
        currentIndex = Math.max(workoutKeys.length - 1, 0);
      }
      if (workoutKeys.length > 0) {
        displayCurrentNode();
      } else {
        document.getElementById("editForm").innerHTML = "";
        document.getElementById("fields").innerHTML = "<p>No workouts found.</p>";
      }
    })
    .catch(error => {
      alert("Error deleting workout: " + error.message);
    });
}

function initWorkoutEditorControls() {
  const workoutPrevBtn = document.getElementById("workoutPrevBtn");
  const workoutNextBtn = document.getElementById("workoutNextBtn");
  const saveChangesBtn = document.getElementById("saveChangesBtn");
  const deleteWorkoutBtn = document.getElementById("deleteWorkoutBtn");
  const addPastExerciseBtn = document.getElementById("addPastExerciseBtn");
  const fieldsContainer = document.getElementById("fields");

  if (workoutPrevBtn) workoutPrevBtn.addEventListener("click", prevNode);
  if (workoutNextBtn) workoutNextBtn.addEventListener("click", nextNode);
  if (saveChangesBtn) saveChangesBtn.addEventListener("click", saveChanges);
  if (deleteWorkoutBtn) deleteWorkoutBtn.addEventListener("click", deleteworkout);
  if (addPastExerciseBtn) addPastExerciseBtn.addEventListener("click", addpastexercise);

  if (fieldsContainer) {
    fieldsContainer.addEventListener("click", (event) => {
      const addSetButton = event.target.closest(".add-editor-set-btn");
      const removeSetButton = event.target.closest(".remove-set-editor-btn");

      if (addSetButton) {
        const exerciseIndex = addSetButton.dataset.index;
        const setsWrapper = document.getElementById(`setsWrapper_${exerciseIndex}`);
        if (!setsWrapper) return;
        const nextSetIndex = setsWrapper.querySelectorAll('.set-row').length;
        const newSetHTML = `
          <div class="set-row" data-exercise-index="${exerciseIndex}" data-set-index="${nextSetIndex}" style="display:flex; gap: 0.5rem; align-items:center; margin-bottom: 6px; flex-wrap:wrap;">
            <span style="min-width: 24px;">#${nextSetIndex + 1}</span>
            <input type="number" id="set_reps_${exerciseIndex}_${nextSetIndex}" value="" placeholder="Reps" style="width:80px;">
            <input type="number" id="set_weight_${exerciseIndex}_${nextSetIndex}" value="" placeholder="Weight" style="width:80px;">
            <input type="text" id="set_note_${exerciseIndex}_${nextSetIndex}" value="" placeholder="Note" style="width:160px;">
            <button type="button" class="btn btn-sm btn-outline-danger remove-set-editor-btn" data-exercise-index="${exerciseIndex}" data-set-index="${nextSetIndex}">Remove</button>
          </div>
        `;
        setsWrapper.insertAdjacentHTML('beforeend', newSetHTML);
        return;
      }

      if (removeSetButton) {
        const row = removeSetButton.closest('.set-row');
        if (row) {
          row.remove();
        }
      }
    });
  }
}

initWorkoutEditorControls();


//////////////////////////////////////////////////////////////////////// Creating exercises, editing past workouts 

//-////////////////////////////////////////////////////////////////////// Exercise list editing
// Global variables for managing the current category, exercise keys, and index.
var currentExerciseCategory = null;    // will be set by the category selector
var exerciseKeys = [];                 // Firebase keys for exercises in the selected category
var exerciseDataMap = {};             // exercise metadata keyed by Firebase ID
var currentExerciseIndex = 0;

function loadCategories() {
  const selector = document.getElementById('categorySelector');
  if (!selector) return;

  const availableCategories = Object.keys(exerciseCatalogByCategory).filter((category) => {
    const records = getExerciseCategoryBucket(exerciseCatalogByCategory, category) || {};
    return Object.values(records).some((exercise) => typeof exercise?.name === 'string' && exercise.name.trim());
  });
  const categories = [...new Set([
    ...exerciseCategories.filter((category) => availableCategories.includes(category)),
    ...availableCategories
  ])];

  selector.replaceChildren(...categories.map((category) => new Option(category, category)));
  currentExerciseCategory = categories[0] || null;
  if (currentExerciseCategory) {
    loadExercisesEditor();
  } else {
    exerciseKeys = [];
    exerciseDataMap = {};
    renderExerciseSelector();
    document.getElementById('exerciseeditorsection').innerHTML = '<p>No exercises found.</p>';
  }
}

// Exercise editor: Category → Exercise → Variation.
// Exercise Details live on the exercise; Volume Tracking mappings live per variation
// ('' = exercise default, used by workouts whose variation has no mapping of its own).
const EXERCISE_DATA_ROOT = 'exercises';
const VOLUME_MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Legs'];
// A contribution of 1.0 marks a primary target (direct sets); lower values are secondary.
const DEFAULT_CONTRIBUTION = 1;
let currentVariation = '';
let editorVariations = [];
let editorVolumeMappings = [];

function normalizeVolumeMappings(mappings) {
  const values = Array.isArray(mappings)
    ? mappings
    : (mappings && typeof mappings === 'object' ? Object.values(mappings) : []);
  return values
    .filter((mapping) => mapping && typeof mapping.muscleGroup === 'string' && mapping.muscleGroup.trim())
    .map((mapping) => {
      const weight = Number(mapping.weight);
      return {
        variation: typeof mapping.variation === 'string' ? mapping.variation.trim() : '',
        muscleGroup: mapping.muscleGroup.trim(),
        weight: Number.isFinite(weight) && weight >= 0 ? weight : DEFAULT_CONTRIBUTION
      };
    });
}

function getCurrentExerciseId() {
  return exerciseKeys[currentExerciseIndex] || null;
}

function getExerciseDataPath(exerciseId) {
  return `${EXERCISE_DATA_ROOT}/${exerciseId}`;
}

// Event listener for when the category selection changes.
document.getElementById("categorySelector").addEventListener("change", function(e) {
  captureVolumeRows();
  currentExerciseCategory = e.target.value;
  loadExercisesEditor();
});

document.getElementById("exerciseSelector").addEventListener("change", function(e) {
  captureVolumeRows();
  currentExerciseIndex = exerciseKeys.indexOf(e.target.value);
  if (currentExerciseIndex < 0) currentExerciseIndex = 0;
  displayExercise();
});

document.getElementById("variationSelector").addEventListener("change", function(e) {
  captureVolumeRows();
  currentVariation = e.target.value;
  renderVolumeTracking();
  updateVariationButtons();
});

async function persistExerciseUpdates(exerciseId, updates) {
  await database.ref(getExerciseDataPath(exerciseId)).update(updates);
  [exerciseDataMap[exerciseId], exerciseMetadataById[exerciseId]].forEach((record) => {
    if (record) Object.assign(record, updates);
  });
}

const addExerciseVariationButton = document.getElementById('addExerciseVariationBtn');
if (addExerciseVariationButton) {
  addExerciseVariationButton.addEventListener('click', async () => {
    const exerciseId = getCurrentExerciseId();
    const exercise = exerciseId && exerciseDataMap[exerciseId];
    if (!exercise) return;

    const variationName = prompt(`Add a variation for ${exercise.name || 'this exercise'}:`)?.trim();
    if (!variationName) return;

    if (editorVariations.some((variation) => variation.toLowerCase() === variationName.toLowerCase())) {
      alert('That variation already exists for this exercise.');
      return;
    }

    captureVolumeRows();
    const updatedVariations = [...editorVariations, variationName];

    try {
      await persistExerciseUpdates(exerciseId, { variations: updatedVariations });
      editorVariations = updatedVariations;
      currentVariation = variationName;
      renderVariationSelector();
      renderVolumeTracking();
    } catch (error) {
      console.error('Error saving exercise variation:', error);
      alert('Could not save the variation. Please try again.');
    }
  });
}

const removeExerciseVariationButton = document.getElementById('removeExerciseVariationBtn');
if (removeExerciseVariationButton) {
  removeExerciseVariationButton.addEventListener('click', async () => {
    const exerciseId = getCurrentExerciseId();
    if (!exerciseId || !currentVariation) return;
    if (!confirm(`Remove the variation "${currentVariation}" and its volume mappings?`)) return;

    captureVolumeRows();
    const updatedVariations = editorVariations.filter((variation) => variation !== currentVariation);
    const updatedMappings = editorVolumeMappings.filter((mapping) => mapping.variation !== currentVariation);

    try {
      await persistExerciseUpdates(exerciseId, { variations: updatedVariations, volumeMappings: updatedMappings });
      editorVariations = updatedVariations;
      editorVolumeMappings = updatedMappings;
      currentVariation = '';
      renderVariationSelector();
      renderVolumeTracking();
    } catch (error) {
      console.error('Error removing exercise variation:', error);
      alert('Could not remove the variation. Please try again.');
    }
  });
}

const saveExoBtn = document.getElementById("saveExoBtn");
const deleteExoBtn = document.getElementById("deleteExoBtn");
if (saveExoBtn) saveExoBtn.addEventListener("click", saveexo);
if (deleteExoBtn) deleteExoBtn.addEventListener("click", deleteexo);

function loadExercisesEditor() {
  if (!currentExerciseCategory) return;
  const categoryExercises = getExerciseCategoryBucket(exerciseCatalogByCategory, currentExerciseCategory) || {};
  exerciseDataMap = Object.fromEntries(Object.entries(categoryExercises)
    .filter(([, exercise]) => exercise && typeof exercise.name === 'string' && exercise.name.trim()));
  exerciseKeys = Object.keys(exerciseDataMap);
  currentExerciseIndex = 0;
  renderExerciseSelector();
  displayExercise();
}

function renderExerciseSelector() {
  var selector = document.getElementById("exerciseSelector");
  if (!selector) return;
  selector.replaceChildren(...exerciseKeys.map((exerciseId) =>
    new Option(exerciseDataMap[exerciseId]?.name || exerciseId, exerciseId)));
  if (exerciseKeys.length > 0) {
    selector.value = exerciseKeys[currentExerciseIndex] || exerciseKeys[0];
  }
}

function renderVariationSelector() {
  const selector = document.getElementById('variationSelector');
  if (!selector) return;
  selector.replaceChildren(
    new Option('Default (no variation)', ''),
    ...editorVariations.map((variation) => new Option(variation, variation))
  );
  selector.value = currentVariation;
  selector.disabled = exerciseKeys.length === 0;
  updateVariationButtons();
}

function updateVariationButtons() {
  const hasExercise = exerciseKeys.length > 0;
  if (addExerciseVariationButton) addExerciseVariationButton.disabled = !hasExercise;
  if (removeExerciseVariationButton) removeExerciseVariationButton.disabled = !hasExercise || !currentVariation;
}

// Display the selected exercise: details, its variations, and the volume mappings of the selected variation.
function displayExercise() {
  const detailsSection = document.getElementById('exerciseeditorsection');
  const volumeSection = document.getElementById('volumeTrackingSection');
  const exerciseId = getCurrentExerciseId();
  const data = exerciseId && exerciseDataMap[exerciseId];

  currentVariation = '';
  if (!data) {
    editorVariations = [];
    editorVolumeMappings = [];
    detailsSection.innerHTML = '<p>No exercises found in this category.</p>';
    volumeSection.innerHTML = '';
    const emptyCounter = document.getElementById('exerciseCounter');
    if (emptyCounter) emptyCounter.textContent = 'Exercise 0 of 0';
    renderVariationSelector();
    return;
  }

  editorVariations = normalizeExerciseVariations(data.variations);
  editorVolumeMappings = normalizeVolumeMappings(data.volumeMappings);

  const fields = normalizeFields(data.fields);
  const trackedFieldLabels = { sets: 'Sets', reps: 'Reps', weight: 'Weight', custom: 'Custom' };
  detailsSection.innerHTML = `
    <h3>Exercise Details</h3>
    <div class="exo-field">
      <label for="exercise_name">Name</label>
      <input type="text" id="exercise_name" value="${escapeExerciseHtml(data.name)}">
    </div>
    <div class="exo-field">
      <label for="exercise_note">Notes</label>
      <textarea id="exercise_note" rows="3">${escapeExerciseHtml(data.note)}</textarea>
    </div>
    <div class="exo-field exo-checks">
      <label>Track fields</label>
      <p class="exo-hint">Select which fields to track for this exercise.</p>
      ${Object.entries(trackedFieldLabels).map(([value, label]) =>
        `<label><input type="checkbox" class="field-checkbox" value="${value}" ${fields.includes(value) ? 'checked' : ''}> ${label}</label>`).join('\n      ')}
    </div>
    <div id="customFieldContainer" class="exo-field" style="${fields.includes('custom') ? '' : 'display:none;'}">
      <label for="exercise_custom_label">Custom field label</label>
      <input type="text" id="exercise_custom_label" value="${escapeExerciseHtml(data.customLabel)}">
    </div>
  `;
  const counter = document.getElementById('exerciseCounter');
  if (counter) counter.textContent = `Exercise ${currentExerciseIndex + 1} of ${exerciseKeys.length}`;
  setupExerciseTrackingToggle();
  renderVariationSelector();
  renderVolumeTracking();
}

function buildVolumeRowHtml(mapping) {
  const groups = VOLUME_MUSCLE_GROUPS.includes(mapping.muscleGroup)
    ? VOLUME_MUSCLE_GROUPS
    : [...VOLUME_MUSCLE_GROUPS, mapping.muscleGroup];
  return `
    <tr class="volume-mapping-row">
      <td><select class="volume-group-select form-control form-control-sm" aria-label="Muscle group">
        ${groups.map((group) => `<option value="${escapeExerciseHtml(group)}" ${group === mapping.muscleGroup ? 'selected' : ''}>${escapeExerciseHtml(group)}</option>`).join('')}
      </select></td>
      <td><input type="number" class="volume-weight-input form-control form-control-sm" aria-label="Contribution" min="0" max="1" step="0.05" value="${mapping.weight}" style="width:90px;"></td>
      <td><button type="button" class="btn btn-sm btn-outline-danger volume-delete-btn" aria-label="Delete muscle group">✕</button></td>
    </tr>`;
}

function renderVolumeTracking() {
  const section = document.getElementById('volumeTrackingSection');
  if (!section) return;
  if (exerciseKeys.length === 0) {
    section.innerHTML = '';
    return;
  }

  const rows = editorVolumeMappings.filter((mapping) => mapping.variation === currentVariation);
  const scope = currentVariation
    ? `Assign muscle groups and their contribution for the "${escapeExerciseHtml(currentVariation)}" variation.`
    : 'Assign muscle groups and their contribution for this exercise. Used when a variation has no mapping of its own.';
  section.innerHTML = `
    <div class="exo-card-header">
      <h3>Target Groups <small>(Volume Tracking)</small></h3>
      <button type="button" id="addVolumeMappingBtn" class="btn btn-sm btn-outline-secondary">⊕ Add Muscle Group</button>
    </div>
    <p class="exo-hint">${scope}</p>
    <table class="exo-volume-table">
      <thead><tr><th>Muscle Group</th><th>Contribution</th><th></th></tr></thead>
      <tbody id="volumeMappingRows">${rows.map(buildVolumeRowHtml).join('')}</tbody>
    </table>
    <div class="exo-info">
      <strong>About muscle group contributions</strong><br>
      Effective volume = completed sets × contribution. A contribution of 1.0 is a primary target and counts as direct sets; lower values are secondary muscles that assist the movement.
    </div>
  `;

  const body = document.getElementById('volumeMappingRows');
  document.getElementById('addVolumeMappingBtn').addEventListener('click', () => {
    captureVolumeRows();
    const used = editorVolumeMappings.filter((mapping) => mapping.variation === currentVariation).map((mapping) => mapping.muscleGroup);
    const muscleGroup = VOLUME_MUSCLE_GROUPS.find((group) => !used.includes(group)) || VOLUME_MUSCLE_GROUPS[0];
    editorVolumeMappings.push({ variation: currentVariation, muscleGroup, weight: DEFAULT_CONTRIBUTION });
    renderVolumeTracking();
  });
  body.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('.volume-delete-btn');
    if (!deleteButton) return;
    deleteButton.closest('.volume-mapping-row').remove();
    captureVolumeRows();
    renderVolumeTracking();
  });
}

// Copy the visible volume rows into editorVolumeMappings for the selected variation.
function captureVolumeRows() {
  const body = document.getElementById('volumeMappingRows');
  if (!body) return;
  const captured = Array.from(body.querySelectorAll('.volume-mapping-row')).map((row) => {
    const weight = Number(row.querySelector('.volume-weight-input').value);
    return {
      variation: currentVariation,
      muscleGroup: row.querySelector('.volume-group-select').value,
      weight: Number.isFinite(weight) ? Math.min(Math.max(weight, 0), 1) : 0
    };
  });
  editorVolumeMappings = [
    ...editorVolumeMappings.filter((mapping) => mapping.variation !== currentVariation),
    ...captured
  ];
}

function setupExerciseTrackingToggle() {
  const customContainer = document.getElementById('customFieldContainer');
  if (!customContainer) return;

  document.querySelectorAll('.field-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.value === 'custom') {
        customContainer.style.display = cb.checked ? 'block' : 'none';
      }
    });
  });
}

// Save the exercise details and every variation's volume mappings.
function saveexo() {
  const exerciseId = getCurrentExerciseId();
  if (!exerciseId) return;

  captureVolumeRows();
  const name = document.getElementById("exercise_name").value.trim();
  if (!name) {
    alert('Exercise name is required.');
    return;
  }

  const seen = new Set();
  for (const mapping of editorVolumeMappings) {
    const key = `${mapping.variation}\u0000${mapping.muscleGroup}`;
    if (seen.has(key)) {
      alert(`${mapping.muscleGroup} is mapped more than once${mapping.variation ? ` for "${mapping.variation}"` : ' by default'}.`);
      return;
    }
    seen.add(key);
  }

  const fields = Array.from(document.querySelectorAll('.field-checkbox'))
    .filter(cb => cb.checked)
    .map(cb => cb.value);

  // Fields are stored as an object so empty selections survive Firebase storage.
  const storedFields = {};
  fields.forEach((f, i) => { storedFields[i] = f; });

  const customLabelInput = document.getElementById("exercise_custom_label");
  const updatedData = {
    name,
    note: document.getElementById("exercise_note").value,
    fields: storedFields,
    customLabel: fields.includes('custom') && customLabelInput ? customLabelInput.value || '' : '',
    variations: editorVariations,
    volumeMappings: editorVolumeMappings
  };

  persistExerciseUpdates(exerciseId, updatedData)
    .then(() => {
      alert("Exercise updated successfully!");
      renderExerciseSelector();
    })
    .catch(error => alert("Error updating exercise: " + error.message));
}

function stepExercise(direction) {
  if (exerciseKeys.length === 0) return;
  captureVolumeRows();
  currentExerciseIndex = (currentExerciseIndex + direction + exerciseKeys.length) % exerciseKeys.length;
  renderExerciseSelector();
  displayExercise();
}

document.getElementById('prevExerciseBtn')?.addEventListener('click', () => stepExercise(-1));
document.getElementById('nextExerciseBtn')?.addEventListener('click', () => stepExercise(1));

// Delete the current exercise.
function deleteexo() {
  const exerciseId = getCurrentExerciseId();
  if (!exerciseId) return;
  if (!confirm("Are you sure you want to delete this exercise?")) return;

  database.ref(getExerciseDataPath(exerciseId)).remove()
    .then(() => {
      alert("Exercise deleted successfully!");
      const bucket = getExerciseCategoryBucket(exerciseCatalogByCategory, currentExerciseCategory);
      if (bucket) delete bucket[exerciseId];
      delete exerciseMetadataById[exerciseId];
      delete exerciseDataMap[exerciseId];
      exerciseKeys.splice(currentExerciseIndex, 1);
      currentExerciseIndex = Math.min(currentExerciseIndex, Math.max(exerciseKeys.length - 1, 0));
      renderExerciseSelector();
      displayExercise();
    })
    .catch(error => alert("Error deleting exercise: " + error.message));
}

// Optionally, the 'Exercise Editor' button can refresh the current view.
document.getElementById("showeditorbtn").addEventListener("click", function() {
  displayExercise();
});

//////////////////////////////////////////////////////////////////////// Exercise list editing

//-////////////////////////////////////////////////////////////////////// Workout creation and saving


// Size the sets column to the widest row so every row's columns line up
function alignExerciseColumns() {
  const cols = exerciseList.querySelectorAll('.wk-sets');
  let widest = 0;
  cols.forEach((col) => {
    col.style.width = 'max-content';
    widest = Math.max(widest, Math.ceil(col.getBoundingClientRect().width));
    col.style.width = '';
  });
  exerciseList.classList.toggle('compact-volume', !showWeightMoved);
  exerciseList.style.setProperty('--sets-w', widest ? ('' + widest + 'px') : '');
}

// Render the exercise list dynamically, including intensity note field
function renderExerciseList() {
  exerciseList.innerHTML = ''; // Clear the list

  selectedExercises.forEach((exercise, index) => {
    const exerciseDiv = document.createElement('div');
    exerciseDiv.className = 'exercise-item';

    // Ensure sets list exists and enforce at least one set for exercises that track sets/reps
    ensureSetsList(exercise);
    const fields = normalizeFields(exercise.fields);
    const showSetsReps = fields.includes('sets') || fields.includes('reps');
    if (showSetsReps && (!Array.isArray(exercise.setsList) || exercise.setsList.length === 0)) {
      exercise.setsList = [{ reps: '', weight: '', note: '', custom: '' }];
      exercise.activeSetIndex = 0;
    }
    const setsList = Array.isArray(exercise.setsList) ? exercise.setsList : [];
    const totalSets = setsList.length;
    const showWeight = fields.includes('weight');
    const showCustom = fields.includes('custom');
    const customOnly = showCustom && !showSetsReps;
    const totalReps = setsList.reduce((sum, set) => sum + (parseInt(set.reps, 10) || 0), 0);
    const totalWeight = setsList.reduce((sum, set) => sum + ((parseInt(set.reps, 10) || 0) * (parseFloat(set.weight) || 0)), 0);
    const volumeLabel = getVolumeDetailsText(showSetsReps, totalSets, totalReps, totalWeight);
    const volumeDetailsHtml = showSetsReps ? `<span class="volume-details">${volumeLabel || 'No sets yet'}</span>` : '<span class="volume-details"></span>';
    const variations = normalizeExerciseVariations(exerciseMetadataById[exercise.id]?.variations ?? exercise.variations);
    const variationButtonHtml = variations.length
      ? `<div class="variation-picker"><button type="button" class="btn btn-sm btn-outline-secondary variation-btn" data-index="${index}" aria-label="Choose variation for ${escapeExerciseHtml(exercise.name)}" title="Variation"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 16l9 5 9-5"/></svg></button><div class="variation-menu hidden">${['', ...variations].map((variation) => `<button type="button" class="variation-option${(exercise.variation || '') === variation ? ' active' : ''}" data-index="${index}" data-variation="${escapeExerciseHtml(variation)}">${variation ? escapeExerciseHtml(variation) : 'Default (none)'}</button>`).join('')}</div></div>`
      : '<div class="variation-picker variation-placeholder" aria-hidden="true"><button type="button" class="btn btn-sm btn-outline-secondary variation-btn" tabindex="-1" disabled><svg viewBox="0 0 24 24" width="16" height="16"></svg></button></div>';
    const exerciseTitleHtml = `${exercise.name}${exercise.variation ? ` - ${escapeExerciseHtml(exercise.variation)}` : ''}`;
    const activeSetIndex = Number.isInteger(exercise.activeSetIndex) ? Math.min(Math.max(exercise.activeSetIndex, 0), Math.max(totalSets - 1, 0)) : 0;
    const currentSet = setsList[activeSetIndex] || { reps: '', weight: '', note: '', custom: '' };
    const setAttrs = `data-index="${index}" data-set-index="${activeSetIndex}"`;
    const customPlaceholder = exercise.customLabel || 'Custom';

    const setControlsHtml = showSetsReps ? `
      <button type="button" class="btn btn-secondary btn-sm add-set-btn" data-index="${index}">Add set</button>
      <button type="button" class="btn btn-sm btn-outline-secondary set-up-btn" data-index="${index}" ${activeSetIndex < totalSets - 1 ? '' : 'disabled'}>▲</button>
      <span class="set-counter" data-index="${index}">${activeSetIndex + 1}/${totalSets}</span>
      <button type="button" class="btn btn-sm btn-outline-secondary set-down-btn" data-index="${index}" ${activeSetIndex > 0 ? '' : 'disabled'}>▼</button>
      <input type="number" class="form-control form-control-sm set-input set-reps-input" ${setAttrs} value="${currentSet.reps || ''}" placeholder="Reps">
      ${showWeight ? `<input type="number" class="form-control form-control-sm set-input set-weight-input" ${setAttrs} value="${currentSet.weight || ''}" placeholder="Weight">` : ''}
      ${showCustom ? `<input type="text" class="form-control form-control-sm set-input set-custom-input" ${setAttrs} value="${currentSet.custom || ''}" placeholder="${customPlaceholder}">` : ''}
      ${showSetNotes ? `<input type="text" class="form-control form-control-sm set-input set-note-input" ${setAttrs} value="${currentSet.note || ''}" placeholder="Set notes">` : ''}
      <button type="button" class="btn btn-sm btn-outline-danger remove-set-btn" ${setAttrs}>×</button>
    ` : (customOnly ? `<input type="text" class="form-control form-control-sm set-input set-custom-input" data-index="${index}" data-set-index="0" value="${currentSet.custom || ''}" placeholder="${customPlaceholder}">` : '');

    exerciseDiv.innerHTML = `
    <div class="wk-row">
      <span class="wk-name" title="${escapeExerciseHtml(exercise.name)}">${exerciseTitleHtml}</span>
      <div class="wk-sets">${variationButtonHtml}${setControlsHtml}</div>
      ${volumeDetailsHtml}
      <input type="text" class="form-control form-control-sm note-input" placeholder="Exercise notes" data-index="${index}" value="${exercise.note || ''}">
      <button type="button" class="btn btn-danger btn-sm remove-btn" data-index="${index}">X</button>
    </div>
    `;
    exerciseList.appendChild(exerciseDiv);
  });

  // Add intensity field with intensity note (global for the workout, not per exercise)
  const intensityDiv = document.createElement('div');
  intensityDiv.className = showWorkoutNotes ? 'introw' : 'introw hidden';
  intensityDiv.id = 'introwcss';

  intensityDiv.innerHTML = `
  <div class="row p-1">
  <div class="col-8 col-md-2">
    <input type="number" id="workoutIntensity" class="form-control form-control-sm" placeholder="Score your workout 1-10" min="1" max="10" value="${currentWorkout.intensity || ''}">
  </div>
  <div class="col-8 col-md-2">
    <input type="text" id="workoutIntensityNote" class="form-control form-control-sm" placeholder="Workout notes" value="${currentWorkout.intensityNote || ''}">
  </div>
  <div class="col-1"></div></div> <!-- Empty column to balance the grid -->
  `;

  exerciseList.appendChild(intensityDiv); // Append the intensity field
  alignExerciseColumns();
  updateVolumeSummary();
}

function getVolumeDetailsText(showSetsReps, totalSets, totalReps, totalWeight) {
  if (!showSetsReps) return '';
  if (totalSets <= 0) return 'No sets yet';
  return showWeightMoved
    ? `${totalSets} sets • ${totalReps} reps • ${totalWeight} kg moved`
    : `${totalSets} sets • ${totalReps} reps`;
}

setupDraftListeners();

function setupDraftListeners() {
  exerciseList.addEventListener('click', (e) => {
    const variationBtn = e.target.closest('.variation-btn');
    const variationOption = e.target.closest('.variation-option');
    if (variationBtn) {
      const menu = variationBtn.parentElement.querySelector('.variation-menu');
      const wasHidden = menu.classList.contains('hidden');
      exerciseList.querySelectorAll('.variation-menu').forEach((m) => m.classList.add('hidden'));
      menu.classList.toggle('hidden', !wasHidden);
      return;
    }
    if (variationOption) {
      const exercise = selectedExercises[Number(variationOption.dataset.index)];
      if (exercise) {
        exercise.variation = variationOption.dataset.variation;
        saveWorkoutDraft();
        renderExerciseList();
      }
      return;
    }
    const setStepButton = e.target.closest('.set-up-btn, .set-down-btn');
    if (setStepButton) {
      const exercise = selectedExercises[parseInt(setStepButton.dataset.index, 10)];
      if (exercise && Array.isArray(exercise.setsList)) {
        const step = setStepButton.classList.contains('set-up-btn') ? 1 : -1;
        const next = (exercise.activeSetIndex || 0) + step;
        if (next >= 0 && next < exercise.setsList.length) {
          exercise.activeSetIndex = next;
          renderExerciseList();
          saveWorkoutDraft();
        }
      }
      return;
    }
    const addButton = e.target.closest('.add-set-btn');
    const removeButton = e.target.closest('.remove-btn');
    const removeSetButton = e.target.closest('.remove-set-btn');
    const setCounterButton = e.target.closest('.set-counter');

    if (addButton) {
      addSetToExercise(addButton.dataset.index);
      return;
    }

    if (removeButton) {
      const index = removeButton.dataset.index;
      selectedExercises.splice(index, 1);
      renderExerciseList();
      saveWorkoutDraft();
      updateVolumeSummary();
      return;
    }

    if (removeSetButton) {
      const exerciseIndex = removeSetButton.dataset.index;
      const setIndex = removeSetButton.dataset.setIndex;
      removeSetFromExercise(exerciseIndex, setIndex);
      return;
    }

    if (setCounterButton) {
      const exercise = selectedExercises[parseInt(setCounterButton.dataset.index, 10)];
      if (exercise && Array.isArray(exercise.setsList) && exercise.setsList.length > 1) {
        exercise.activeSetIndex = ((exercise.activeSetIndex || 0) + 1) % exercise.setsList.length;
        renderExerciseList();
        saveWorkoutDraft();
      }
      return;
    }
  });

  exerciseList.addEventListener('input', (e) => {
    const target = e.target;
    const exerciseIndex = target.dataset.index;
    const setIndex = target.dataset.setIndex;

    if (target.matches('.note-input')) {
      selectedExercises[exerciseIndex].note = target.value.trim();
      saveWorkoutDraft();
      updateVolumeSummary();
      return;
    }

    if (target.matches('.set-reps-input')) {
      selectedExercises[exerciseIndex].setsList[setIndex].reps = target.value;
      saveWorkoutDraft();
      updateVolumeSummary();
      return;
    }

    if (target.matches('.set-weight-input')) {
      selectedExercises[exerciseIndex].setsList[setIndex].weight = target.value;
      saveWorkoutDraft();
      updateVolumeSummary();
      return;
    }

    if (target.matches('.set-custom-input')) {
      selectedExercises[exerciseIndex].setsList[setIndex].custom = target.value;
      saveWorkoutDraft();
      return;
    }

    if (target.matches('.set-note-input')) {
      selectedExercises[exerciseIndex].setsList[setIndex].note = target.value;
      saveWorkoutDraft();
      return;
    }

    if (target.matches('#workoutIntensity')) {
      currentWorkout.intensity = target.value.trim();
      saveWorkoutDraft();
      return;
    }

    if (target.matches('#workoutIntensityNote')) {
      currentWorkout.intensityNote = target.value.trim();
      saveWorkoutDraft();
      return;
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('.variation-picker')) return;
    exerciseList.querySelectorAll('.variation-menu').forEach((m) => m.classList.add('hidden'));
  });
}

// Save workout to Firebase
saveWorkoutBtn.addEventListener('click', async () => {
  if (selectedExercises.length === 0) {
    alert('Please add some exercises before saving!');
    return;
  }

  const workoutDuration = formatDuration(validateBtn.textContent);  // Convert clock time to "h m" format
  const intensityValue = document.getElementById('workoutIntensity')?.value || '';
  const intensityNoteValue = document.getElementById('workoutIntensityNote')?.value || '';

  const workoutExercises = selectedExercises.map(exercise => {
    const setsList = Array.isArray(exercise.setsList) ? exercise.setsList : [];
    const totalSets = setsList.length;
    const totalReps = setsList.reduce((sum, set) => sum + (parseInt(set.reps, 10) || 0), 0);
    return {
      ...exercise,
      sets: totalSets,
      reps: totalReps,
      setsList: setsList
    };
  });

  const workout = {
    date: getToday(),
    exercises: workoutExercises,
    intensity: intensityValue,
    intensityNote: intensityNoteValue,
    duration: workoutDuration
  };

  try {
    await saveWorkout(workout);
    selectedExercises.length = 0;
    currentWorkout.intensity = '';
    currentWorkout.intensityNote = '';
    renderExerciseList();
    resetBtn.click();
    checkLastWorkoutResult();
    alert('Workout saved successfully!');
  } catch (error) {
    alert(error.message);
  }
});

// Function to convert clock time (e.g., "01:30") into "1h 30m"
function formatDuration(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);

  let formattedTime = '';
  if (hours > 0) {
    formattedTime += `${hours}h `;
  }
  if (minutes > 0) {
    formattedTime += `${minutes}m`;
  }

  return formattedTime.trim();
}

// Save workout in Firebase under "workouts" node
async function saveWorkout(workout) {
  const response = await fetch(`${workoutApiOrigin}/api/workouts`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workout)
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Workout could not be saved.');
  }

  clearWorkoutDraft();
  workoutsById[result.id] = result.workout;
  if (!workoutKeys.includes(result.id)) {
    workoutKeys.push(result.id);
  }
  return result;
}

//////////////////////////////////////////////////////////////////////// Creating and saving workouts


//-////////////////////////////////////////////////////////////////////// Workout drafts and draft keeping

// Load existing workout draft on page load
function loadWorkoutDraft() {
  getWorkoutDraftRef().once('value', (snapshot) => {
    const draft = snapshot.val();
    if (draft && draft.exercises) {
      draft.exercises.forEach(exercise => {
        ensureSetsList(exercise);
      });
      selectedExercises.push(...draft.exercises); // Populate draft exercises
      if (draft.intensity) {
        currentWorkout.intensity = draft.intensity; // Load intensity
      }
      if (draft.intensityNote) {
        currentWorkout.intensityNote = draft.intensityNote; // Load intensity note
      }
      renderExerciseList(); // Render the draft
      updateVolumeSummary();
    }
  });
}

function ensureSetsList(exercise) {
  if (!exercise) return;
  if (!Array.isArray(exercise.setsList)) {
    exercise.setsList = [];
  }
  const fields = normalizeFields(exercise.fields);
  if (exercise.setsList.length === 0 && fields.includes('custom') && !(fields.includes('sets') || fields.includes('reps'))) {
    exercise.setsList = [{ reps: '', weight: '', note: '', custom: '' }];
  }
  if (!Number.isInteger(exercise.activeSetIndex) || exercise.activeSetIndex < 0) {
    exercise.activeSetIndex = 0;
  }
  if (exercise.setsList.length > 0 && exercise.activeSetIndex >= exercise.setsList.length) {
    exercise.activeSetIndex = exercise.setsList.length - 1;
  }
}

function addSetToExercise(exerciseIndex) {
  const index = parseInt(exerciseIndex, 10);
  const exercise = selectedExercises[index];
  if (!exercise) return;
  const fields = normalizeFields(exercise.fields);
  if (!(fields.includes('sets') || fields.includes('reps'))) return;
  ensureSetsList(exercise);

  const lastSet = exercise.setsList[exercise.setsList.length - 1] || { reps: '', weight: '', note: '', custom: '' };
  exercise.setsList.push({
    reps: lastSet.reps || '',
    weight: lastSet.weight || '',
    note: lastSet.note || '',
    custom: lastSet.custom || ''
  });
  exercise.activeSetIndex = exercise.setsList.length - 1;

  saveWorkoutDraft();
  renderExerciseList();
}

function removeSetFromExercise(exerciseIndex, setIndex) {
  const exerciseIdx = parseInt(exerciseIndex, 10);
  const setIdx = parseInt(setIndex, 10);
  const exercise = selectedExercises[exerciseIdx];
  if (!exercise || !Array.isArray(exercise.setsList)) return;

  exercise.setsList.splice(setIdx, 1);
  if (!Number.isInteger(exercise.activeSetIndex) || exercise.activeSetIndex >= exercise.setsList.length) {
    exercise.activeSetIndex = Math.max(exercise.setsList.length - 1, 0);
  }
  saveWorkoutDraft();
  renderExerciseList();
}

function updateVolumeSummary() {
  document.querySelectorAll('.exercise-item').forEach((exerciseDiv, index) => {
    const exercise = selectedExercises[index];
    if (!exercise) return;

    const setsList = Array.isArray(exercise.setsList) ? exercise.setsList : [];
    const fields = normalizeFields(exercise.fields);
    const showSetsReps = fields.includes('sets') || fields.includes('reps');
    const totalSets = setsList.length;
    const totalReps = setsList.reduce((sum, set) => sum + (parseInt(set.reps, 10) || 0), 0);
    const totalWeight = setsList.reduce((sum, set) => sum + ((parseInt(set.reps, 10) || 0) * (parseFloat(set.weight) || 0)), 0);
    const label = getVolumeDetailsText(showSetsReps, totalSets, totalReps, totalWeight);

    const labelEl = exerciseDiv.querySelector('.volume-details');
    if (labelEl) {
      labelEl.textContent = label;
    }
  });
}

// Save the workout draft to Firebase
function saveWorkoutDraft() {
  const draft = {
    exercises: selectedExercises,
    intensity: document.getElementById('workoutIntensity')?.value || '', // Save intensity
    intensityNote: currentWorkout.intensityNote || '', // Save intensity note
    date: getToday()
  };

  getWorkoutDraftRef().set(draft, (error) => {
    if (error) {
      console.error('Error saving workout draft:', error);
    }
  });
}

// Clear the workout draft from Firebase (after saving the workout)
function clearWorkoutDraft() {
  getWorkoutDraftRef().remove((error) => {
    if (error) {
      console.error('Error clearing workout draft:', error);
    }
  });
}


// Add listeners for input changes to save the draft
function addDraftListeners() {
  // This function existed previously but is now replaced with delegated listeners.
}

//////////////////////////////////////////////////////////////////////// Workout drafts and draft keeping


//-////////////////////////////////////////////////////////////////////// Add and edit section functionality
// Get elements// Get elements// Get elements
const toggleFormBtn = document.getElementById("toggleFormBtn");
const addExerciseSection = document.getElementById("addExerciseSection");
const addEditToolbarButtons = document.getElementById("addEditToolbarButtons");
const exerciseActionButtons = document.getElementById("exerciseActionButtons");
const workoutEditorBtn = document.getElementById("showeditorbtn");
const exoEditorBtn = document.getElementById("showexoeditorbtn");
const workoutEditorSection = document.getElementById("editorsection");
const exerciseEditorSection = document.getElementById("exerciseeditor");
const categorySelector = document.getElementById("categorySelector");
const typeSelector = document.getElementById("typeSelector");
const exerciseNotesSection = document.getElementById("exercisenotessection");

// Reflect which panel is open: active toolbar buttons, and the exercise Save/Delete actions.
function syncAddEditToolbar() {
  const workoutOpen = !workoutEditorSection.classList.contains("hidden");
  const exerciseOpen = !exerciseEditorSection.classList.contains("hidden");
  const addFormOpen = !addExerciseFormWrapper.classList.contains("hidden");
  workoutEditorBtn.classList.toggle("exo-btn-active", workoutOpen);
  exoEditorBtn.classList.toggle("exo-btn-active", exerciseOpen);
  toggleAddExerciseFormBtn.classList.toggle("exo-btn-active", addFormOpen);
  exerciseActionButtons.classList.toggle("hidden", !exerciseOpen);
}

// Toggle the whole Add and Edit toolbar ("Hide" collapses every panel)
toggleFormBtn.addEventListener("click", () => {
  const isOpening = addEditToolbarButtons.classList.contains("hidden");
  addEditToolbarButtons.classList.toggle("hidden", !isOpening);
  toggleFormBtn.textContent = isOpening ? "Hide" : "Add and Edit";

  if (!isOpening) {
    addExerciseFormWrapper.classList.add("hidden");
    workoutEditorSection.classList.add("hidden");
    exerciseEditorSection.classList.add("hidden");
  }
  syncAddEditToolbar();
});

// Toggle Workout Editor section
workoutEditorBtn.addEventListener("click", () => {
  workoutEditorSection.classList.toggle("hidden");
  exerciseEditorSection.classList.add("hidden");
  syncAddEditToolbar();
});

// Toggle Exercise Editor section
exoEditorBtn.addEventListener("click", () => {
  exerciseEditorSection.classList.toggle("hidden");
  workoutEditorSection.classList.add("hidden");
  syncAddEditToolbar();
});

if (toggleAddExerciseFormBtn) {
  toggleAddExerciseFormBtn.addEventListener("click", syncAddEditToolbar);
}
const hideAddExerciseFormBtn = document.getElementById("hideAddExerciseFormBtn");
if (hideAddExerciseFormBtn) {
  hideAddExerciseFormBtn.addEventListener("click", () => {
    addExerciseFormWrapper.classList.add("hidden");
    syncAddEditToolbar();
  });
}

//////////////////////////////////////////////////////////////////////// Add and edit section functionality

//-////////////////////////////////////////////////////////////////////// Past workouts list section

// Select the button element for workouts
const workoutButton = document.querySelector('#showworkouts .click');


// Ensure the saved workouts list is hidden initially
savedWorkoutList.classList.add('hidden');

function renderSavedWorkouts() {
  const workoutsRef = database.ref('workouts');
  workoutsRef.once('value', (snapshot) => {
    const workouts = snapshot.val();
    savedWorkoutList.innerHTML = ''; // Clear saved workouts

    if (!workouts) return;

    const workoutYearElement = document.getElementById('workout-year-filter');
    const selectedWorkoutYear = workoutYearElement ? workoutYearElement.value : 'all';

    const entries = Object.entries(workouts)
      .filter(([, workout]) => {
        if (!workout) return false;
        if (selectedWorkoutYear && selectedWorkoutYear !== 'all' && workout.date) {
          return workout.date.startsWith(selectedWorkoutYear);
        }
        return true;
      })
      .sort(([, a], [, b]) => (b.date || '').localeCompare(a.date || ''));

    entries.forEach(([, workout]) => {
      const date = workout.date || '';
      const intensity = workout.intensity ? `Intensity: ${workout.intensity}/10` : '';
      const intensityNote = workout.intensityNote ? workout.intensityNote : '';
      const duration = workout.duration ? workout.duration : '';
      const dateText = `<strong>Workout on ${date}</strong>`;
      const intensityText = intensity ? `<span style="color: green;">${intensity}</span>` : '';
      const durationText = duration ? `<span style="color: green;">${duration}</span>` : '';
      const intensityNoteText = intensityNote ? `<span style="color: green;">${intensityNote}</span>` : '';

      const exercises = [...(workout.exercises || [])].reverse().map((e) => {
        const name = e.name || 'Unknown';
        const variation = e.variation ? ` <span style="color:#555;">(${escapeExerciseHtml(e.variation)})</span>` : '';
        const noteText = e.note ? ` <span style="color: red;">${e.note}</span>` : '';

        if (Array.isArray(e.setsList) && e.setsList.length > 0) {
          const setsList = e.setsList;
          const totalSets = setsList.length;
          const totalReps = setsList.reduce((sum, set) => sum + (parseInt(set.reps, 10) || 0), 0);
          const weightMoved = setsList.reduce((sum, set) => sum + ((parseInt(set.reps, 10) || 0) * (parseFloat(set.weight) || 0)), 0);
          const summary = totalSets > 0 ? `${totalSets} sets • ${totalReps} reps${weightMoved ? ` • ${weightMoved} kg moved` : ''}` : '';
          const setDetails = setsList.map((set, idx) => {
            const reps = set.reps || '-';
            const weight = set.weight ? ` x ${set.weight}kg` : '';
            const setNote = set.note ? ` (${set.note})` : '';
            return `${idx + 1}) ${reps}${weight}${setNote}`;
          }).join(', ');
          return `<div style="margin:0; line-height:1.2;"><span style="color: blue;">${name}</span>${variation}: ${summary}${noteText}${setDetails ? ` — ${setDetails}` : ''}</div>`;
        }

        const parts = [];
        if (e.sets) parts.push(`${e.sets} sets`);
        if (e.reps) parts.push(`x ${e.reps} reps`);
        if (e.weight) parts.push(`@ ${e.weight}kg`);
        const legacyText = parts.join(' ');
        return `<div style="margin:0; line-height:1.2;"><span style="color: blue;">${name}</span>${variation}: ${legacyText}${noteText}</div>`;
      }).join('');

      const result = workout.result ? `<div style="margin:0.2rem 0 0 0; line-height:1.2;"><span style="color: darkorange;">Result: ${workout.result}</span></div>` : '';
      const workoutDiv = document.createElement('div');
      workoutDiv.className = 'saved-workout';
      workoutDiv.style.marginBottom = '1rem';
      workoutDiv.innerHTML = `
        <div style="margin:0; line-height:1.2;">${dateText}</div>
        <div style="margin:0; line-height:1.2;">${intensityText}${intensityText && durationText ? ' ' : ''}${durationText}${(intensityText || durationText) && intensityNoteText ? ' ' : ''}${intensityNoteText}</div>
        ${exercises}
        ${result}
      `;
      savedWorkoutList.appendChild(workoutDiv);
    });
  });
}

const workoutYearSelect = document.getElementById('workout-year-filter');
if (workoutYearSelect) {
  workoutYearSelect.addEventListener('change', () => {
    renderSavedWorkouts();
  });
}

// Toggle workouts (and the filter) when the "Show workouts" button is clicked
workoutButton.addEventListener('click', () => {
  const workoutYearElement = document.getElementById('workout-year-filter');
  if (workoutButton.textContent === 'Show workouts') {
    renderSavedWorkouts(); // Populate the workouts
    savedWorkoutList.classList.remove('hidden'); // Make the workouts list visible
    workoutButton.textContent = 'Hide workouts'; // Change button text
    if (workoutYearElement) workoutYearElement.style.display = 'inline';
  } else {
    savedWorkoutList.innerHTML = ''; // Clear the workouts content
    savedWorkoutList.classList.add('hidden'); // Hide the workouts list
    workoutButton.textContent = 'Show workouts'; // Change button text back
    if (workoutYearElement) workoutYearElement.style.display = 'none';
  }
});



//////////////////////////////////////////////////////////////////////// Past workouts section

//-////////////////////////////////////////////////////////////////////// misc.

// Helper function to get the current date in YYYY-MM-DD format
function getToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}



//-////////////////////////////////////////////////////////////////////// last workout result field 
function checkLastWorkoutResult() {
  if (!showPostWorkoutNotes) return;

  const workoutsRef = database.ref('workouts');

  workoutsRef.orderByChild('date').limitToLast(1).once('value', snapshot => {
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const workout = child.val();
        const workoutKey = child.key;

        // Only show if result is missing or empty
        if (!String(workout.result || '').trim()) {
          const date = workout.date || 'recently';
          const input = document.getElementById('lastworkoutresult');
          const resultSection = document.getElementById('resultsection');

          input.placeholder = `Add how you felt after your workout on ${date}`;
          input.dataset.key = workoutKey; // Save the key for use when saving
          resultSection.classList.remove('hidden');
        }
      });
    }
  });
}

async function savelastworkoutresult() {
  const input = document.getElementById('lastworkoutresult');
  const workoutKey = input?.dataset.key;
  const result = input.value.trim();

  if (!result) {
    alert('Please enter how you felt!');
    return;
  }

  if (!workoutKey) {
    alert('There is no recent workout to update.');
    return;
  }

  try {
    await database.ref(`workouts/${workoutKey}`).update({ result });
    document.getElementById('resultsection')?.classList.add('hidden');
  } catch (error) {
    console.error('Error saving result:', error);
    alert('Could not save how you felt. Please try again.');
  }
}

document.getElementById('savelastworkoutbtn')?.addEventListener('click', savelastworkoutresult);



let activePrivateUid = null;

function emitPrivateBootstrapState(state, message = '') {
  window.dispatchEvent(new CustomEvent('app:private-bootstrap', {
    detail: {
      state,
      message,
    }
  }));
}

function resetPrivateUi() {
  if (exerciseList) exerciseList.innerHTML = '';
  if (savedWorkoutList) savedWorkoutList.innerHTML = '';
  const fields = document.getElementById('fields');
  if (fields) fields.innerHTML = '';
  const exerciseEditorSection = document.getElementById('exerciseeditorsection');
  if (exerciseEditorSection) exerciseEditorSection.innerHTML = '';
  const visualsContainer = document.getElementById('visuals-container');
  if (visualsContainer) visualsContainer.innerHTML = '';
  const calendarContainer = document.getElementById('calendar-container');
  if (calendarContainer) calendarContainer.innerHTML = '';
  const resultSection = document.getElementById('resultsection');
  if (resultSection) resultSection.classList.add('hidden');

  selectedExercises.length = 0;
  currentWorkout.intensity = '';
  currentWorkout.intensityNote = '';
  startTime = null;
  elapsedTime = 0;
  paused = false;

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  if (validateBtn) {
    validateBtn.textContent = 'Start clock';
    validateBtn.style.backgroundColor = 'green';
    validateBtn.style.borderColor = 'black';
    validateBtn.style.color = '';
  }

  if (pauseDiv) pauseDiv.style.display = 'none';
  if (resetDiv) resetDiv.style.display = 'none';
}

async function bootstrapPrivateApp() {
  if (activePrivateUid === 'app') {
    emitPrivateBootstrapState('ready');
    return;
  }

  activePrivateUid = 'app';
  emitPrivateBootstrapState('loading');

  try {
    await loadShowWeightMovedSetting();
    await loadWorkoutBuilderSettings();
    await loadExerciseCategories();
    await loadExercises();
    await loadFocusAreas();
    loadWorkouts();
    loadCategories();
    await loadWorkoutDraft();
    renderSavedWorkouts();
    checkLastWorkoutResult();
    checkLastClick();
    emitPrivateBootstrapState('ready');
  } catch (error) {
    console.error('Private app bootstrap failed:', error);
    emitPrivateBootstrapState('error', error && error.message ? error.message : 'Unknown bootstrap error');
  }
}

bootstrapPrivateApp();











// kg <-> lbs converter
(function setupUnitConverter() {
  const kg = document.getElementById('convKg');
  const lbs = document.getElementById('convLbs');
  if (!kg || !lbs) return;
  const fmt = (n) => String(Math.round(n * 10) / 10);
  kg.addEventListener('input', () => { lbs.value = kg.value === '' ? '' : fmt(parseFloat(kg.value) * 2.2046226218); });
  lbs.addEventListener('input', () => { kg.value = lbs.value === '' ? '' : fmt(parseFloat(lbs.value) / 2.2046226218); });
})();











