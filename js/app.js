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

// The clock lives in localStorage so it works logged out and in demo mode;
// a server copy is kept best effort for signed-in users.
const CLOCK_STORAGE_KEY = 'workoutClockStart';
const CLOCK_MAX_AGE_MS = 3 * 60 * 60 * 1000;

function readStoredClockStart() {
  try {
    const value = Number(localStorage.getItem(CLOCK_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch (error) {
    return null;
  }
}

function writeStoredClockStart(value) {
  try {
    if (value) localStorage.setItem(CLOCK_STORAGE_KEY, String(value));
    else localStorage.removeItem(CLOCK_STORAGE_KEY);
  } catch (error) {
    // Storage unavailable (private mode); the clock still runs for this page.
  }
}

async function isServerClockAvailable() {
  try {
    const status = await window.getAuthStatus();
    return Boolean(status && status.authenticated);
  } catch (error) {
    return false;
  }
}

function showClockControls() {
  pauseDiv.style.display = 'block';
  resetDiv.style.display = 'block';
}

// Start the clock now and remember the start time locally and on the server
function beginClock() {
  if (startTime) return;
  startTime = Date.now();
  elapsedTime = 0;
  paused = false;
  writeStoredClockStart(startTime);
  const savedStart = startTime;
  isServerClockAvailable().then((available) => {
    if (available) return postToWorkoutApi('/api/clock/start', { startTime: savedStart });
  }).catch(() => {
    // Read-only demo sessions reject writes; the local clock is enough.
  });
  startClock();
  showClockControls();
  updateClockDisplay();
}

// Restore a clock started within the last three hours
async function checkLastClick() {
  let storedStart = readStoredClockStart();

  if (!storedStart && await isServerClockAvailable()) {
    try {
      const response = await fetch(`${workoutApiOrigin}/api/clock`, { credentials: 'include' });
      if (response.ok) storedStart = (await response.json()).startTime || null;
    } catch (error) {
      console.error('Error retrieving clock state:', error);
    }
  }

  if (!storedStart || startTime) return;

  const timeElapsedSinceStart = Date.now() - storedStart;
  if (timeElapsedSinceStart >= CLOCK_MAX_AGE_MS) {
    writeStoredClockStart(null);
    return;
  }

  startTime = storedStart;
  elapsedTime = timeElapsedSinceStart;
  writeStoredClockStart(storedStart);
  startClock();
  showClockControls();
  updateClockDisplay();
}

// Listen for the validate button click
validateBtn.addEventListener('click', beginClock);
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

  writeStoredClockStart(null);
  isServerClockAvailable().then((available) => {
    if (!available) return;
    return fetch(`${workoutApiOrigin}/api/clock`, {
      method: 'DELETE',
      credentials: 'include'
    });
  }).catch((error) => {
    console.error('Error clearing clock state:', error);
  });
});

// On page load, check if the button was clicked in the last 3 hours
document.addEventListener('DOMContentLoaded', () => {
  // Hide pause and reset buttons by default
  pauseDiv.style.display = 'none';
  resetDiv.style.display = 'none';
  checkLastClick();
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
const addExerciseFormWrapper = document.getElementById('addExerciseFormWrapper');
const toggleAddExerciseFormBtn = document.getElementById('toggleAddExerciseFormBtn');
const settingsGearBtn = document.getElementById('settingsGearBtn');
const settingsPanel = document.getElementById('settingsPanel');
const exerciseGroupingModeButtons = document.querySelectorAll('[data-grouping-mode]');
const showWeightMovedCheckbox = document.getElementById('showWeightMovedSetting');
const showWorkoutNotesCheckbox = document.getElementById('showWorkoutNotesSetting');
const showPostWorkoutNotesCheckbox = document.getElementById('showPostWorkoutNotesSetting');
const showSetNotesCheckbox = document.getElementById('showSetNotesSetting');
const showSetsRepsCounterCheckbox = document.getElementById('showSetsRepsCounterSetting');
const setsDisplayCheckbox = document.getElementById('setsDisplaySetting');
const fitBuilderWidthCheckbox = document.getElementById('fitBuilderWidthSetting');
const autoStartClockCheckbox = document.getElementById('autoStartClockSetting');
let showWeightMoved = true;
let showWorkoutNotes = true;
let showPostWorkoutNotes = true;
let showSetNotes = true;
let showSetsRepsCounter = true; // the "3 sets • 30 reps" part of each exercise's summary
// Workout builder sets: 'cycle' = one set at a time with ▲ ▼, 'all' = a row per set
let setsDisplayMode = 'cycle';
// true = the builder shrinks to fit its visible columns; false = it stays full width
let fitBuilderWidth = true;
// true = adding an exercise starts the clock; false = only the "Start clock" button does
let autoStartClock = true;

function applyBuilderWidthMode() {
  document.getElementById('workoutBuilderSection')?.classList.toggle('builder-full-width', !fitBuilderWidth);
  if (fitBuilderWidthCheckbox) fitBuilderWidthCheckbox.checked = fitBuilderWidth;
}

const exercisePickerSearch = document.getElementById('exercisePickerSearch');
const exercisePickerEmpty = document.getElementById('exercisePickerEmpty');

function setExercisePickerOpen(isOpen) {
  if (!exercisePickerMenu || !exercisePickerTrigger) return;
  exercisePickerMenu.hidden = !isOpen;
  exercisePickerTrigger.setAttribute('aria-expanded', String(isOpen));
  if (exercisePickerSearch) {
    exercisePickerSearch.value = '';
    filterExercisePickerOptions();
    if (isOpen) exercisePickerSearch.focus();
  }
}

// Hides exercises that don't contain the search text, and category headings left with none
function filterExercisePickerOptions() {
  if (!exercisePickerOptions) return;
  const query = (exercisePickerSearch?.value || '').trim().toLowerCase();
  let heading = null;
  let headingHasMatch = false;
  let anyMatch = false;
  const closeHeading = () => { if (heading) heading.hidden = !headingHasMatch; };

  Array.from(exercisePickerOptions.children).forEach((element) => {
    if (element.classList.contains('exercise-picker-category')) {
      closeHeading();
      heading = element;
      headingHasMatch = false;
      return;
    }
    const matches = !query || element.textContent.toLowerCase().includes(query);
    element.hidden = !matches;
    if (matches) { headingHasMatch = true; anyMatch = true; }
  });
  closeHeading();
  if (exercisePickerEmpty) exercisePickerEmpty.hidden = anyMatch;
}

if (exercisePickerSearch) {
  exercisePickerSearch.addEventListener('input', filterExercisePickerOptions);
  // Enter picks the first match
  exercisePickerSearch.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    Array.from(exercisePickerOptions.querySelectorAll('.exercise-picker-option')).find((option) => !option.hidden)?.click();
  });
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
  filterExercisePickerOptions();
}

const sectionVisibilityTargets = {
  addEdit: ['#addEditSection', '#toggleFormBtn'],
  workouts: ['#showWorkoutsSection', '#showWorkoutsBtn'],
  calendar: ['#calendarSection', '#showCalendarBtn'],
  progress: ['#progressdiv', '#toggleprogressBtn'],
  volume: ['#showvolume', '#toggleVolumeBtn']
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

if (setsDisplayCheckbox) {
  setsDisplayCheckbox.addEventListener('change', async () => {
    const previousValue = setsDisplayMode;
    setsDisplayMode = setsDisplayCheckbox.checked ? 'all' : 'cycle';
    renderExerciseList();
    try {
      await database.ref('settings/workoutBuilder').update({ setsDisplay: setsDisplayMode });
    } catch (error) {
      setsDisplayMode = previousValue;
      setsDisplayCheckbox.checked = previousValue === 'all';
      renderExerciseList();
      console.error('Error saving setsDisplay setting:', error);
    }
  });
}

if (autoStartClockCheckbox) {
  autoStartClockCheckbox.addEventListener('change', async () => {
    const previousValue = autoStartClock;
    autoStartClock = autoStartClockCheckbox.checked;
    try {
      await database.ref('settings/workoutBuilder').update({ autoStartClock });
    } catch (error) {
      autoStartClock = previousValue;
      autoStartClockCheckbox.checked = previousValue;
      console.error('Error saving autoStartClock setting:', error);
    }
  });
}

if (fitBuilderWidthCheckbox) {
  fitBuilderWidthCheckbox.addEventListener('change', async () => {
    const previousValue = fitBuilderWidth;
    fitBuilderWidth = fitBuilderWidthCheckbox.checked;
    applyBuilderWidthMode();
    try {
      await database.ref('settings/workoutBuilder').update({ fitBuilderWidth });
    } catch (error) {
      fitBuilderWidth = previousValue;
      applyBuilderWidthMode();
      console.error('Error saving fitBuilderWidth setting:', error);
    }
  });
}

if (showSetsRepsCounterCheckbox) {
  showSetsRepsCounterCheckbox.addEventListener('change', async () => {
    const previousValue = showSetsRepsCounter;
    showSetsRepsCounter = showSetsRepsCounterCheckbox.checked;
    renderExerciseList();
    try {
      await database.ref('settings/workoutBuilder').update({ showSetsRepsCounter });
    } catch (error) {
      showSetsRepsCounter = previousValue;
      showSetsRepsCounterCheckbox.checked = previousValue;
      renderExerciseList();
      console.error('Error saving showSetsRepsCounter setting:', error);
    }
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
  addOption.textContent = 'Add new category';
  exerciseCategory.appendChild(addOption);

  const removeOption = document.createElement('option');
  removeOption.value = 'removeCategory';
  removeOption.textContent = 'Remove category';
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

// Category add / remove happen inline under the "Choose Category" dropdown.
// Add: the dropdown is swapped for a name box. Remove: a chip per category, each with ×.
const categoryAddRow = document.getElementById('categoryAddRow');
const newCategoryInput = document.getElementById('newCategoryInput');
const categoryAddHint = document.getElementById('categoryAddHint');
const categoryRemoveRow = document.getElementById('categoryRemoveRow');
const categoryChips = document.getElementById('categoryChips');
const categoryRemoveHint = document.getElementById('categoryRemoveHint');
let lastChosenCategory = '';

function setCategoryHint(hint, message) {
  hint.textContent = message;
  hint.hidden = !message;
}

function closeCategoryEditors(selectValue = lastChosenCategory) {
  categoryAddRow.hidden = true;
  categoryRemoveRow.hidden = true;
  exerciseCategory.hidden = false;
  renderExerciseCategoryOptions();
  if (exerciseCategories.includes(selectValue)) exerciseCategory.value = selectValue;
  lastChosenCategory = exerciseCategory.value;
}

function openAddCategory() {
  exerciseCategory.hidden = true;
  categoryAddRow.hidden = false;
  newCategoryInput.value = '';
  newCategoryInput.classList.remove('input-invalid');
  setCategoryHint(categoryAddHint, '');
  newCategoryInput.focus();
}

async function saveNewCategory() {
  const cleaned = newCategoryInput.value.trim();
  if (!cleaned) {
    newCategoryInput.focus();
    return;
  }
  const existing = exerciseCategories.find((category) => category.toLowerCase() === cleaned.toLowerCase());
  if (existing) {
    newCategoryInput.classList.add('input-invalid');
    setCategoryHint(categoryAddHint, `"${existing}" already exists`);
    newCategoryInput.focus();
    return;
  }

  exerciseCategories.push(cleaned);
  exerciseCategories.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  await saveExerciseCategories();
  closeCategoryEditors(cleaned);
}

function renderCategoryChips() {
  const onlyOne = exerciseCategories.length <= 1;
  categoryChips.innerHTML = exerciseCategories.map((category) => `
    <span class="category-chip" data-category="${escapeExerciseHtml(category)}">
      ${escapeExerciseHtml(category)}
      <button type="button" class="category-chip-remove" aria-label="Remove ${escapeExerciseHtml(category)}" ${onlyOne ? 'hidden' : ''}>×</button>
    </span>`).join('');
  setCategoryHint(categoryRemoveHint, onlyOne ? 'You need at least one category, so the last one can\'t be removed.' : '');
}

function openRemoveCategories() {
  exerciseCategory.hidden = true;
  categoryRemoveRow.hidden = false;
  renderCategoryChips();
}

if (exerciseCategory && categoryAddRow && categoryRemoveRow) {
  lastChosenCategory = exerciseCategory.value;
  exerciseCategory.addEventListener('change', () => {
    if (exerciseCategory.value === 'addNewCategory') openAddCategory();
    else if (exerciseCategory.value === 'removeCategory') openRemoveCategories();
    else lastChosenCategory = exerciseCategory.value;
  });

  document.getElementById('saveCategoryBtn').addEventListener('click', saveNewCategory);
  document.getElementById('cancelCategoryBtn').addEventListener('click', () => closeCategoryEditors());
  newCategoryInput.addEventListener('input', () => {
    newCategoryInput.classList.remove('input-invalid');
    setCategoryHint(categoryAddHint, '');
  });
  newCategoryInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); saveNewCategory(); }
    if (event.key === 'Escape') closeCategoryEditors();
  });

  // × asks "Remove? Yes / No" inside the chip; Yes removes it straight away.
  categoryChips.addEventListener('click', async (event) => {
    const chip = event.target.closest('.category-chip');
    if (!chip) return;
    const category = chip.dataset.category;

    if (event.target.closest('.category-chip-remove')) {
      renderCategoryChips(); // closes any other chip that was asking
      const fresh = categoryChips.querySelector(`.category-chip[data-category="${CSS.escape(category)}"]`);
      fresh.classList.add('is-confirming');
      fresh.innerHTML = `${escapeExerciseHtml(category)} → Remove?
        <span class="category-chip-confirm">
          <button type="button" class="category-chip-yes">Yes</button>
          <button type="button" class="category-chip-no">No</button>
        </span>`;
      fresh.querySelector('.category-chip-yes').focus();
    } else if (event.target.closest('.category-chip-no')) {
      renderCategoryChips();
    } else if (event.target.closest('.category-chip-yes')) {
      exerciseCategories = exerciseCategories.filter((name) => name !== category);
      await saveExerciseCategories();
      renderExerciseCategoryOptions();
      renderCategoryChips();
    }
  });
  document.getElementById('doneRemovingCategoriesBtn').addEventListener('click', () => closeCategoryEditors());
}

function setupWorkoutYearSelector() {
  const yearSelect = document.getElementById('workout-year-filter');
  if (!yearSelect) return;

  // Same year range as the calendar selector, plus an "All years" option
  const currentYear = new Date().getFullYear();
  yearSelect.innerHTML = '<option value="all">All years</option>';
  for (let year = currentYear - 5; year <= currentYear + 5; year++) {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    yearSelect.appendChild(option);
  }
  yearSelect.value = String(currentYear);
  setupWorkoutMonthSelector();
}

function setupWorkoutMonthSelector() {
  const monthSelect = document.getElementById('workout-month-filter');
  if (!monthSelect) return;

  monthSelect.innerHTML = '<option value="">Select Month</option>' +
    MONTH_NAMES.map((name, index) => `<option value="${String(index + 1).padStart(2, '0')}">${name}</option>`).join('');
  monthSelect.value = '';
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

saveNewExerciseBtn.addEventListener('click', async () => {
    const name = newExerciseName.value.trim();
    const category = exerciseCategory.value;

    if (!name) {
        showNotice('Please enter an exercise name.', 'error');
        return;
    }

    try {
      await postToWorkoutApi('/api/exercises', {
        name,
        category,
        focusAreas: [],
        fields: ['sets', 'reps', 'weight']
      });
      newExerciseName.value = '';
      await loadExercises();
      if (window.refreshTrackedExercises) window.refreshTrackedExercises();
      collapseAddEditSection();
    } catch (error) {
      showNotice(error.message, 'error');
    }
});

//-////////////////////////////////////////////////////////////////////// Add from library
// "From library" picks an exercise from window.EXERCISE_LIBRARY (js/exerciseLibrary.js) and
// lets the user tick any of its variations, or none. "Create your own" is the original form.
const addFromLibraryBtn = document.getElementById('addFromLibraryBtn');
const addCustomBtn = document.getElementById('addCustomBtn');
const libraryAddPane = document.getElementById('libraryAddPane');
const addExerciseForm = document.getElementById('addExerciseForm');
const librarySearch = document.getElementById('librarySearch');
const libraryList = document.getElementById('libraryList');
const librarySelection = document.getElementById('librarySelection');
const libraryVariations = document.getElementById('libraryVariations');
const addLibraryExerciseBtn = document.getElementById('addLibraryExerciseBtn');
let selectedLibraryExercise = null;

function setAddExerciseMode(mode) {
  const fromLibrary = mode === 'library';
  libraryAddPane.hidden = !fromLibrary;
  addExerciseForm.hidden = fromLibrary;
  addFromLibraryBtn.classList.toggle('exo-btn-active', fromLibrary);
  addCustomBtn.classList.toggle('exo-btn-active', !fromLibrary);
  addFromLibraryBtn.setAttribute('aria-pressed', String(fromLibrary));
  addCustomBtn.setAttribute('aria-pressed', String(!fromLibrary));
  if (fromLibrary) renderLibraryList();
}

// Names the user already has, lower-cased, so library entries can show as "Added"
function getExistingExerciseNames() {
  const names = new Set();
  Object.values(exerciseCatalogByCategory || {}).forEach((categoryExercises) => {
    Object.values(categoryExercises || {}).forEach((exercise) => {
      if (typeof exercise?.name === 'string') names.add(exercise.name.trim().toLowerCase());
    });
  });
  return names;
}

function renderLibraryList() {
  if (!libraryList) return;
  const library = window.EXERCISE_LIBRARY || [];
  const query = (librarySearch?.value || '').trim().toLowerCase();
  const existing = getExistingExerciseNames();
  // A search also matches variation names, e.g. "hammer" finds Bicep Curl
  const matches = library.filter((entry) => !query
    || entry.name.toLowerCase().includes(query)
    || Object.values(entry.variations || {}).flat().some((variation) => variation.toLowerCase().includes(query)));

  if (!matches.length) {
    libraryList.innerHTML = '<p class="exo-hint library-empty">No matches. Try "Create your own" instead.</p>';
    return;
  }

  const byCategory = new Map();
  matches.forEach((entry) => {
    if (!byCategory.has(entry.category)) byCategory.set(entry.category, []);
    byCategory.get(entry.category).push(entry);
  });

  libraryList.innerHTML = [...byCategory].map(([category, entries]) => `
    <div class="library-group">
      <div class="library-group-title">${escapeExerciseHtml(category)}</div>
      ${entries.map((entry) => {
        const added = existing.has(entry.name.toLowerCase());
        const selected = selectedLibraryExercise?.name === entry.name;
        return `<button type="button" class="library-item${selected ? ' selected' : ''}" role="option" aria-selected="${selected}"
          data-library-name="${escapeExerciseHtml(entry.name)}" ${added ? 'disabled' : ''}>
          ${escapeExerciseHtml(entry.name)}${added ? ' <span class="library-added">Added</span>' : ''}
        </button>`;
      }).join('')}
    </div>`).join('');
}

function selectLibraryExercise(name) {
  selectedLibraryExercise = (window.EXERCISE_LIBRARY || []).find((entry) => entry.name === name) || null;
  librarySelection.hidden = !selectedLibraryExercise;
  renderLibraryList();
  if (!selectedLibraryExercise) return;

  document.getElementById('librarySelectedName').textContent = selectedLibraryExercise.name;
  document.getElementById('librarySelectedCategory').textContent = selectedLibraryExercise.category;
  const groups = Object.entries(selectedLibraryExercise.variations || {}).filter(([, values]) => values.length);
  libraryVariations.innerHTML = groups.length
    ? groups.map(([group, values]) => `
      <div class="library-variation-group">
        <span class="library-variation-type">${escapeExerciseHtml(group)}</span>
        ${values.map((value) => `<label class="library-chip"><input type="checkbox" value="${escapeExerciseHtml(value)}"> ${escapeExerciseHtml(value)}</label>`).join('')}
      </div>`).join('')
    : '<p class="exo-hint">No common variations for this one.</p>';
}

async function addSelectedLibraryExercise() {
  if (!selectedLibraryExercise) return;
  const { name, category } = selectedLibraryExercise;
  const variations = [...libraryVariations.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);

  try {
    addLibraryExerciseBtn.disabled = true;
    // Bring back the library's category if the user removed it
    if (!exerciseCategories.includes(category)) {
      exerciseCategories.push(category);
      await saveExerciseCategories();
      renderExerciseCategoryOptions();
    }
    await postToWorkoutApi('/api/exercises', { name, category, variations, focusAreas: [], fields: ['sets', 'reps', 'weight'] });
    selectedLibraryExercise = null;
    librarySelection.hidden = true;
    if (librarySearch) librarySearch.value = '';
    await loadExercises();
    if (window.refreshTrackedExercises) window.refreshTrackedExercises();
    collapseAddEditSection();
  } catch (error) {
    showNotice(error.message, 'error');
  } finally {
    addLibraryExerciseBtn.disabled = false;
  }
}

if (libraryAddPane && addExerciseForm) {
  addFromLibraryBtn.addEventListener('click', () => setAddExerciseMode('library'));
  addCustomBtn.addEventListener('click', () => setAddExerciseMode('custom'));
  librarySearch?.addEventListener('input', renderLibraryList);
  libraryList.addEventListener('click', (event) => {
    const item = event.target.closest('.library-item');
    if (item && !item.disabled) selectLibraryExercise(item.dataset.libraryName);
  });
  addLibraryExerciseBtn.addEventListener('click', addSelectedLibraryExercise);
  // Refresh "Added" markers each time the form opens
  toggleAddExerciseFormBtn?.addEventListener('click', () => {
    if (!addExerciseFormWrapper.classList.contains('hidden') && !libraryAddPane.hidden) renderLibraryList();
  });
}
//////////////////////////////////////////////////////////////////////// Add from library

// Prevent duplicate exercise addition
addExerciseBtn.addEventListener('click', () => {
    const selectedOption = exerciseSelect.options[exerciseSelect.selectedIndex];
    const exerciseId = selectedOption.value;
    const exerciseName = selectedOption.text;

    if (!exerciseId || selectedExercises.some(e => e.id === exerciseId)) {
        showNotice("Exercise already exists", 'error');
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
    if (autoStartClock) beginClock();
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
    showSetsRepsCounter = settings.showSetsRepsCounter !== false;
    if (showSetsRepsCounterCheckbox) showSetsRepsCounterCheckbox.checked = showSetsRepsCounter;
    if (showSetNotesCheckbox) showSetNotesCheckbox.checked = showSetNotes;
    setsDisplayMode = settings.setsDisplay === 'all' ? 'all' : 'cycle';
    fitBuilderWidth = settings.fitBuilderWidth !== false;
    applyBuilderWidthMode();
    autoStartClock = settings.autoStartClock !== false;
    if (autoStartClockCheckbox) autoStartClockCheckbox.checked = autoStartClock;
    if (setsDisplayCheckbox) setsDisplayCheckbox.checked = setsDisplayMode === 'all';
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

// Look inside "/workouts/"
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
    workoutKeys = Object.keys(workoutsById).sort((a, b) =>
      String(workoutsById[b]?.date || '').localeCompare(String(workoutsById[a]?.date || '')) || a.localeCompare(b));

    if (workoutKeys.length > 0) {
      console.log("Workout Keys:", workoutKeys);
      currentIndex = 0;
      displayCurrentNode();
    } else {
      document.getElementById("fields").innerHTML = "<p>No workouts found.</p>";
      renderWorkoutNav();
      updateAddPastExerciseState();
    }
  } catch (error) {
    console.error("Error fetching workouts:", error);
  }
}

// Display current workout node
function buildPastSetRowHtml(exerciseIndex, setIndex, set) {
  set = set || {};
  return `
    <div class="set-row we-set" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}">
      <span class="we-set-number">${setIndex + 1}</span>
      <input type="number" id="set_reps_${exerciseIndex}_${setIndex}" value="${escapeExerciseHtml(set.reps || '')}" placeholder="Reps" aria-label="Reps">
      <input type="number" id="set_weight_${exerciseIndex}_${setIndex}" value="${escapeExerciseHtml(set.weight || '')}" placeholder="Weight" aria-label="Weight">
      <input type="text" id="set_note_${exerciseIndex}_${setIndex}" value="${escapeExerciseHtml(set.note || '')}" placeholder="Note" aria-label="Set note" class="we-set-note">
      <button type="button" class="exo-btn exo-btn-sm exo-btn-danger remove-set-editor-btn" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}">Remove</button>
    </div>`;
}

// Sorted list of the user's saved exercise names, used by the editor name dropdown.
function getSavedExerciseNames() {
  const names = new Set();
  Object.values(typeof exerciseCatalogByCategory !== "undefined" ? exerciseCatalogByCategory || {} : {}).forEach((group) => {
    Object.values(group || {}).forEach((item) => {
      const name = item && typeof item.name === "string" ? item.name.trim() : "";
      if (name) names.add(name);
    });
  });
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function buildExerciseNameSelect(index, currentName) {
  const names = getSavedExerciseNames();
  const current = String(currentName || "");
  if (current && !names.includes(current)) names.unshift(current);
  const options = [`<option value="">Select exercise</option>`]
    .concat(names.map((name) => `<option value="${escapeExerciseHtml(name)}"${name === current ? " selected" : ""}>${escapeExerciseHtml(name)}</option>`));
  return `<select id="name_${index}">${options.join("")}</select>`;
}

function buildPastExerciseHtml(exercise, index) {
  const setsList = Array.isArray(exercise.setsList) ? exercise.setsList : [];
  const legacyField = (id, label, value) => `
    <label class="we-legacy-field">${label}
      <input type="number" id="${id}_${index}" value="${escapeExerciseHtml(value)}" placeholder="${label}">
    </label>`;
  const setsHtml = setsList.length > 0
    ? setsList.map((set, setIndex) => buildPastSetRowHtml(index, setIndex, set)).join('')
    : `<div class="legacy-row we-legacy">
        ${legacyField('legacy_sets', 'Sets', exercise.sets || '')}
        ${legacyField('legacy_reps', 'Reps', exercise.reps || '')}
        ${legacyField('legacy_weight', 'Weight', exercise.weight || '')}
      </div>`;

  return `
    <div class="exercise-entry we-exercise" data-index="${index}">
      <div class="we-exercise-main">
        <label class="we-field">Name
          ${buildExerciseNameSelect(index, exercise.name)}
        </label>
        <label class="we-field">Note
          <input type="text" id="note_${index}" value="${escapeExerciseHtml(exercise.note || '')}">
        </label>
        <button type="button" class="exo-btn exo-btn-sm exo-btn-danger" onclick="deleteExercise(${index}, this)">Delete exercise</button>
      </div>
      <div class="we-exercise-sets">
        <div class="we-sets-header">
          <strong>Sets</strong>
          <button type="button" class="exo-btn exo-btn-sm add-editor-set-btn" data-index="${index}">Add set</button>
        </div>
        <div id="setsWrapper_${index}">${setsHtml}</div>
      </div>
    </div>`;
}

var isNewWorkout = false;
var pastWorkoutSaveId = "";

function setNewWorkoutMode(active) {
  isNewWorkout = active;
  if (active) pastWorkoutSaveId = ""; // each new past workout gets its own save id
  const deleteBtn = document.getElementById("deleteWorkoutBtn");
  const addWorkoutBtn = document.getElementById("addPastWorkoutBtn");
  if (deleteBtn) deleteBtn.textContent = active ? "Cancel" : "Delete workout";
  if (addWorkoutBtn) addWorkoutBtn.disabled = active;
  updateAddPastExerciseState();
  if (active) {
    ["workoutYearNav", "workoutMonthNav", "workoutDayNav"].forEach((id) => {
      const select = document.getElementById(id);
      if (select) select.disabled = true;
    });
  } else {
    renderWorkoutNav();
  }
}

// Exercises can only be added once the workout has a date.
function updateAddPastExerciseState() {
  const addExerciseBtn = document.getElementById("addPastExerciseBtn");
  if (!addExerciseBtn) return;
  const dateInput = document.getElementById("workout_date");
  const hasWorkout = workoutKeys.length > 0 || isNewWorkout;
  addExerciseBtn.disabled = !hasWorkout || !(dateInput && dateInput.value.trim());
}

function startNewWorkout() {
  setNewWorkoutMode(true);
  document.getElementById("fields").innerHTML = `
    <h3 class="we-heading">New workout</h3>
    <div class="we-info">
      <label class="we-field">Date
        <input type="date" id="workout_date" value="">
      </label>
      <label class="we-field">Duration
        <input type="text" id="workout_duration" value="">
      </label>
      <label class="we-field">Score
        <input type="text" id="workout_intensity" value="">
      </label>
      <label class="we-field">Note
        <input type="text" id="workout_intensityNote" value="">
      </label>
      <label class="we-field">Result
        <input type="text" id="workout_result" value="">
      </label>
    </div>
    <p class="we-hint">Choose a date to start adding exercises.</p>`;
  updateAddPastExerciseState();
  const dateInput = document.getElementById("workout_date");
  if (dateInput) dateInput.focus();
}

function cancelNewWorkout() {
  setNewWorkoutMode(false);
  if (workoutKeys.length > 0) {
    displayCurrentNode();
  } else {
    document.getElementById("fields").innerHTML = "<p>No workouts found.</p>";
  }
}

function displayCurrentNode() {
  if (isNewWorkout) setNewWorkoutMode(false);
  if (workoutKeys.length === 0) return;

  var workoutID = workoutKeys[currentIndex];
  var data = workoutsById[workoutID];
  var fieldsHTML = "";

  if (data) {
    const workoutFields = {
      date: "Date",
      duration: "Duration",
      intensity: "Score",
      intensityNote: "Note",
      result: "Result"
    };

    fieldsHTML += `<h3 class="we-heading">Workout info</h3><div class="we-info">`;
    for (const key in workoutFields) {
      fieldsHTML += `
        <label class="we-field">${workoutFields[key]}
          <input type="text" id="workout_${key}" value="${escapeExerciseHtml(data[key] || '')}">
        </label>`;
    }
    fieldsHTML += `</div>`;
  }

  if (data && data.exercises) {
    fieldsHTML += `<h3 class="we-heading">Exercises</h3><div class="we-exercises">`;
    data.exercises.forEach((exercise, index) => {
      fieldsHTML += buildPastExerciseHtml(exercise, index);
    });
    fieldsHTML += `</div>`;
  }

  document.getElementById("fields").innerHTML = fieldsHTML || "<p>No exercises found.</p>";
  renderWorkoutNav();
  updateAddPastExerciseState();
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "2026-10-12" → "12 Oct 2026"; anything not in that form is shown as it is
function formatWorkoutListDate(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  const monthName = match && MONTH_NAMES[Number(match[2]) - 1];
  return monthName ? `${Number(match[3])} ${monthName.slice(0, 3)} ${match[1]}` : date;
}

function getWorkoutDateParts(key) {
  const [year = "", month = "", day = ""] = String(workoutsById[key]?.date || "").split("-");
  return { year, month, day };
}

function fillSelect(select, options, selected) {
  select.innerHTML = options.map(({ value, label }) =>
    `<option value="${escapeExerciseHtml(value)}"${value === selected ? " selected" : ""}>${escapeExerciseHtml(label)}</option>`).join("");
}

// Rebuild the year / month / day dropdowns so they reflect the current workout.
function renderWorkoutNav() {
  const yearSelect = document.getElementById("workoutYearNav");
  const monthSelect = document.getElementById("workoutMonthNav");
  const daySelect = document.getElementById("workoutDayNav");
  if (!yearSelect || !monthSelect || !daySelect) return;

  const hasWorkouts = workoutKeys.length > 0;
  [yearSelect, monthSelect, daySelect].forEach((select) => { select.disabled = !hasWorkouts; });
  if (!hasWorkouts) {
    [yearSelect, monthSelect, daySelect].forEach((select) => { select.innerHTML = ""; });
    return;
  }

  const current = getWorkoutDateParts(workoutKeys[currentIndex]);
  const unique = (values) => Array.from(new Set(values));
  const sameYear = workoutKeys.filter((key) => getWorkoutDateParts(key).year === current.year);
  const sameMonth = sameYear.filter((key) => getWorkoutDateParts(key).month === current.month);

  fillSelect(yearSelect, unique(workoutKeys.map((key) => getWorkoutDateParts(key).year))
    .map((year) => ({ value: year, label: year || "No date" })), current.year);
  fillSelect(monthSelect, unique(sameYear.map((key) => getWorkoutDateParts(key).month))
    .map((month) => ({ value: month, label: MONTH_NAMES[Number(month) - 1] || month || "No date" })), current.month);
  fillSelect(daySelect, sameMonth.map((key) => {
    const day = getWorkoutDateParts(key).day;
    const duplicates = sameMonth.filter((other) => getWorkoutDateParts(other).day === day);
    const label = duplicates.length > 1 ? `${day || "No date"} (${duplicates.indexOf(key) + 1})` : (day || "No date");
    return { value: key, label };
  }), workoutKeys[currentIndex]);
}

// Jump to the most recent workout matching the chosen year (and month when given).
function selectWorkoutByDate(year, month) {
  const matches = workoutKeys.filter((key) => {
    const parts = getWorkoutDateParts(key);
    return parts.year === year && (month === undefined || parts.month === month);
  });
  if (!matches.length) return;
  currentIndex = workoutKeys.indexOf(matches[0]);
  displayCurrentNode();
}

function addpastexercise() {
  const dateInput = document.getElementById("workout_date");
  if (!dateInput || !dateInput.value.trim()) return;
  const hint = document.querySelector("#fields .we-hint");
  if (hint) hint.remove();
  var index = document.querySelectorAll('#fields .exercise-entry').length;
  var container = document.getElementById("fields");
  var list = container.querySelector('.we-exercises');
  if (!list) {
    container.insertAdjacentHTML('beforeend', '<h3 class="we-heading">Exercises</h3><div class="we-exercises"></div>');
    list = container.querySelector('.we-exercises');
  }
  list.insertAdjacentHTML("beforeend", buildPastExerciseHtml({ name: '', note: '', setsList: [{}] }, index));
}


//  Save changes (Workout + Exercises)
function saveChanges() {
    var workoutID = isNewWorkout ? null : workoutKeys[currentIndex];
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

    if (isNewWorkout) {
      if (!updatedWorkout.date || !String(updatedWorkout.date).trim()) {
        showNotice("Please choose a date for the workout.", 'error');
        return;
      }
      // Same idea as the builder: a repeated click saves the same workout, not a copy
      pastWorkoutSaveId = pastWorkoutSaveId || (window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
      requestWorkoutApi("/api/workouts", "POST", { ...updatedWorkout, saveId: pastWorkoutSaveId })
        .then((result) => {
          pastWorkoutSaveId = "";
          workoutsById[result.id] = result.workout;
          workoutKeys.push(result.id);
          workoutKeys.sort((a, b) =>
            String(workoutsById[b]?.date || "").localeCompare(String(workoutsById[a]?.date || "")) || a.localeCompare(b));
          currentIndex = Math.max(workoutKeys.indexOf(result.id), 0);
          displayCurrentNode();
          collapseAddEditSection();
          refreshAfterWorkoutSaved({ reloadEditor: false });
        })
        .catch(error => showNotice("Error: " + error.message, 'error'));
      return;
    }

    requestWorkoutApi(`/api/workouts/${encodeURIComponent(workoutID)}`, 'PUT', updatedWorkout)
      .then((result) => {
        workoutsById[workoutID] = result.workout;
        workoutKeys.sort((a, b) =>
          String(workoutsById[b]?.date || '').localeCompare(String(workoutsById[a]?.date || '')) || a.localeCompare(b));
        currentIndex = Math.max(workoutKeys.indexOf(workoutID), 0);
        renderWorkoutNav();
        collapseAddEditSection();
        refreshAfterWorkoutSaved({ reloadEditor: false });
      })
      .catch(error => showNotice("Error: " + error.message, 'error'));
}

async function deleteExercise(index, button) {
  if (!(await confirmInPlace(button, { question: "Delete?" }))) return;

  if (isNewWorkout) {
    document.querySelector(`#fields .exercise-entry[data-index="${index}"]`)?.remove();
    return;
  }

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
      showNotice("Error deleting exercise: " + error.message, 'error');
  });
}


async function deleteworkout(event) {
  if (isNewWorkout) {
    cancelNewWorkout();
    return;
  }
  if (!(await confirmInPlace(event.currentTarget, { question: 'Delete workout?' }))) return;
  
  // Retrieve the current workout ID using your workoutKeys array and currentIndex.
  var workoutID = workoutKeys[currentIndex];
  var fullPath = basePath + workoutID; // e.g., '/workouts/' + workoutID

  // Remove the workout from the Firebase database.
  database.ref(fullPath).remove()
    .then(() => {
      showNotice("Workout deleted successfully!", 'success');
      refreshAfterWorkoutSaved({ reloadEditor: false });
      
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
        renderWorkoutNav();
      }
    })
    .catch(error => {
      showNotice("Error deleting workout: " + error.message, 'error');
    });
}

function initWorkoutEditorControls() {
  const saveChangesBtn = document.getElementById("saveChangesBtn");
  const deleteWorkoutBtn = document.getElementById("deleteWorkoutBtn");
  const addPastExerciseBtn = document.getElementById("addPastExerciseBtn");
  const fieldsContainer = document.getElementById("fields");

  const yearNav = document.getElementById("workoutYearNav");
  const monthNav = document.getElementById("workoutMonthNav");
  const dayNav = document.getElementById("workoutDayNav");
  if (yearNav) yearNav.addEventListener("change", () => selectWorkoutByDate(yearNav.value));
  if (monthNav) monthNav.addEventListener("change", () => selectWorkoutByDate(yearNav.value, monthNav.value));
  if (dayNav) dayNav.addEventListener("change", () => {
    const index = workoutKeys.indexOf(dayNav.value);
    if (index === -1) return;
    currentIndex = index;
    displayCurrentNode();
  });
  if (saveChangesBtn) saveChangesBtn.addEventListener("click", saveChanges);
  if (deleteWorkoutBtn) deleteWorkoutBtn.addEventListener("click", deleteworkout);
  if (addPastExerciseBtn) addPastExerciseBtn.addEventListener("click", addpastexercise);
  const addPastWorkoutBtn = document.getElementById("addPastWorkoutBtn");
  if (addPastWorkoutBtn) addPastWorkoutBtn.addEventListener("click", startNewWorkout);

  if (fieldsContainer) {
    fieldsContainer.addEventListener("input", (event) => {
      if (event.target.id === "workout_date") updateAddPastExerciseState();
    });
    fieldsContainer.addEventListener("click", (event) => {
      const addSetButton = event.target.closest(".add-editor-set-btn");
      const removeSetButton = event.target.closest(".remove-set-editor-btn");

      if (addSetButton) {
        const exerciseIndex = addSetButton.dataset.index;
        const setsWrapper = document.getElementById(`setsWrapper_${exerciseIndex}`);
        if (!setsWrapper) return;
        const nextSetIndex = setsWrapper.querySelectorAll('.set-row').length;
        setsWrapper.insertAdjacentHTML('beforeend', buildPastSetRowHtml(Number(exerciseIndex), nextSetIndex));
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
// The user's own muscle groups live at settings/volume/muscleGroups and are shared by the
// exercise editor and the monthly volume targets.
const VOLUME_GROUPS_PATH = 'settings/volume/muscleGroups';
let volumeMuscleGroups = [];
let volumeGroupsLoaded = false;
let volumeGroupsLoading = null;
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

function ensureVolumeGroups() {
  if (volumeGroupsLoaded) return Promise.resolve();
  if (volumeGroupsLoading) return volumeGroupsLoading;
  volumeGroupsLoading = (async () => {
    let stored = null;
    try {
      const snapshot = await database.ref(VOLUME_GROUPS_PATH).once('value');
      const value = snapshot.val();
      if (value && typeof value === 'object') {
        stored = Object.values(value).filter((name) => typeof name === 'string' && name.trim()).map((name) => name.trim());
      }
    } catch (error) {
      console.error('Error loading muscle groups:', error);
    }

    if (stored) {
      volumeMuscleGroups = stored;
    } else {
      // First use: keep every group already mapped on existing exercises.
      const seeded = new Set();
      Object.values(exerciseDataMap || {}).forEach((record) => {
        normalizeVolumeMappings(record && record.volumeMappings).forEach((mapping) => seeded.add(mapping.muscleGroup));
      });
      volumeMuscleGroups = Array.from(seeded).sort((a, b) => a.localeCompare(b));
      if (volumeMuscleGroups.length) await saveVolumeGroups().catch(() => {});
    }
    volumeGroupsLoaded = true;
  })().finally(() => { volumeGroupsLoading = null; });
  return volumeGroupsLoading;
}

function saveVolumeGroups() {
  return database.ref(VOLUME_GROUPS_PATH).set(volumeMuscleGroups);
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

// "Add variation" swaps the variation selector for an inline name box.
const addExerciseVariationButton = document.getElementById('addExerciseVariationBtn');
const variationAddRow = document.getElementById('variationAddRow');
const newVariationInput = document.getElementById('newVariationInput');
const variationHint = document.getElementById('variationHint');

function setVariationHint(message) {
  if (!variationHint) return;
  variationHint.textContent = message;
  variationHint.hidden = !message;
}

function setVariationAddOpen(open) {
  document.getElementById('variationSelector').hidden = open;
  document.getElementById('variationActions').hidden = open;
  variationAddRow.hidden = !open;
  newVariationInput.classList.remove('input-invalid');
  setVariationHint('');
  if (open) {
    newVariationInput.value = '';
    newVariationInput.focus();
  }
}

async function saveNewVariation() {
  const exerciseId = getCurrentExerciseId();
  if (!exerciseId || !exerciseDataMap[exerciseId]) return setVariationAddOpen(false);
  const variationName = newVariationInput.value.trim();
  if (!variationName) return newVariationInput.focus();

  const existing = editorVariations.find((variation) => variation.toLowerCase() === variationName.toLowerCase());
  if (existing) {
    newVariationInput.classList.add('input-invalid');
    setVariationHint(`"${existing}" already exists`);
    return newVariationInput.focus();
  }

  captureVolumeRows();
  const updatedVariations = [...editorVariations, variationName];
  try {
    await persistExerciseUpdates(exerciseId, { variations: updatedVariations });
    editorVariations = updatedVariations;
    currentVariation = variationName;
    setVariationAddOpen(false);
    renderVariationSelector();
    renderVolumeTracking();
  } catch (error) {
    console.error('Error saving exercise variation:', error);
    setVariationHint('Could not save the variation. Please try again.');
  }
}

if (addExerciseVariationButton && variationAddRow) {
  addExerciseVariationButton.addEventListener('click', () => {
    if (getCurrentExerciseId()) setVariationAddOpen(true);
  });
  document.getElementById('saveVariationBtn').addEventListener('click', saveNewVariation);
  document.getElementById('cancelVariationBtn').addEventListener('click', () => setVariationAddOpen(false));
  newVariationInput.addEventListener('input', () => {
    newVariationInput.classList.remove('input-invalid');
    setVariationHint('');
  });
  newVariationInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); saveNewVariation(); }
    if (event.key === 'Escape') setVariationAddOpen(false);
  });
}

const removeExerciseVariationButton = document.getElementById('removeExerciseVariationBtn');
if (removeExerciseVariationButton) {
  removeExerciseVariationButton.addEventListener('click', async () => {
    const exerciseId = getCurrentExerciseId();
    if (!exerciseId || !currentVariation) return;
    setVariationHint('');
    if (!(await confirmInPlace(removeExerciseVariationButton, { question: `Remove ${currentVariation}?` }))) return;

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
      setVariationHint('Could not remove the variation. Please try again.');
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
  // Close an open "Add variation" box (e.g. after switching exercise)
  const addRow = document.getElementById('variationAddRow');
  if (addRow && !addRow.hidden) {
    addRow.hidden = true;
    selector.hidden = false;
    document.getElementById('variationActions').hidden = false;
  }
  const hint = document.getElementById('variationHint');
  if (hint) hint.hidden = true;
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

function buildVolumeRowHtml(group, weight) {
  return `
    <tr class="volume-mapping-row" data-group="${escapeExerciseHtml(group)}">
      <td>${escapeExerciseHtml(group)}</td>
      <td><input type="number" class="volume-weight-input form-control form-control-sm" aria-label="Contribution for ${escapeExerciseHtml(group)}" min="0" max="1" step="0.05" placeholder="0" value="${weight > 0 ? weight : ''}" style="width:90px;"></td>
      <td><button type="button" class="btn btn-sm btn-outline-danger volume-delete-btn" aria-label="Remove ${escapeExerciseHtml(group)} from the muscle group list">Remove</button></td>
    </tr>`;
}

function renderVolumeTracking() {
  const section = document.getElementById('volumeTrackingSection');
  if (!section) return;
  if (exerciseKeys.length === 0) {
    section.innerHTML = '';
    return;
  }
  if (!volumeGroupsLoaded) {
    ensureVolumeGroups().then(renderVolumeTracking);
    return;
  }

  const weights = {};
  editorVolumeMappings
    .filter((mapping) => mapping.variation === currentVariation)
    .forEach((mapping) => { weights[mapping.muscleGroup] = mapping.weight; });
  const scope = currentVariation
    ? `Set the contribution of each muscle group for the "${escapeExerciseHtml(currentVariation)}" variation. Leave blank for none.`
    : 'Set the contribution of each muscle group for this exercise. Leave blank for none. Used when a variation has no mapping of its own.';
  section.innerHTML = `
    <div class="exo-card-header">
      <h3>Target Groups <small>(Volume Tracking)</small></h3>
      <button type="button" id="addVolumeMappingBtn" class="btn btn-sm btn-outline-secondary">Add muscle group</button>
    </div>
    <p class="exo-hint">${scope}</p>
    <table class="exo-volume-table">
      <thead><tr><th>Muscle Group</th><th>Contribution</th><th></th></tr></thead>
      <tbody id="volumeMappingRows">${volumeMuscleGroups.length
        ? volumeMuscleGroups.map((group) => buildVolumeRowHtml(group, weights[group] || 0)).join('')
        : '<tr class="volume-empty-row"><td colspan="3" class="exo-hint">No muscle groups yet. Use "Add muscle group" to create one.</td></tr>'}</tbody>
    </table>
    <div class="exo-info">
      <strong>About muscle group contributions</strong><br>
      Effective volume = completed sets × contribution. A contribution of 1.0 is a primary target and counts as direct sets; lower values are secondary muscles that assist the movement.
    </div>
  `;

  const body = document.getElementById('volumeMappingRows');
  const addButton = document.getElementById('addVolumeMappingBtn');

  // "Add muscle group" adds an editable row at the bottom of the table.
  addButton.addEventListener('click', () => {
    if (body.querySelector('.volume-new-row')) return body.querySelector('.volume-new-input').focus();
    body.querySelector('.volume-empty-row')?.remove();
    body.insertAdjacentHTML('beforeend', `
      <tr class="volume-new-row">
        <td><input type="text" class="volume-new-input form-control form-control-sm" placeholder="New group…" maxlength="40" aria-label="New muscle group name"></td>
        <td></td>
        <td class="volume-new-actions">
          <button type="button" class="exo-btn exo-btn-sm exo-btn-primary volume-new-save" aria-label="Add muscle group">✓</button>
          <button type="button" class="exo-btn exo-btn-sm volume-new-cancel" aria-label="Cancel">×</button>
        </td>
      </tr>
      <tr class="volume-new-hint-row" hidden><td colspan="3"><div class="field-hint field-hint-error" role="alert"></div></td></tr>`);
    addButton.disabled = true;
    body.querySelector('.volume-new-input').focus();
  });

  const showNewRowHint = (message) => {
    const hintRow = body.querySelector('.volume-new-hint-row');
    hintRow.querySelector('.field-hint').textContent = message;
    hintRow.hidden = !message;
    body.querySelector('.volume-new-input').classList.toggle('input-invalid', Boolean(message));
  };

  const saveNewGroup = async () => {
    const input = body.querySelector('.volume-new-input');
    const name = input.value.trim();
    if (!name) return input.focus();
    const existing = volumeMuscleGroups.find((group) => group.toLowerCase() === name.toLowerCase());
    if (existing) {
      showNewRowHint(`${existing} already exists`);
      return input.focus();
    }
    captureVolumeRows();
    volumeMuscleGroups.push(name);
    try {
      await saveVolumeGroups();
      renderVolumeTracking();
    } catch (error) {
      volumeMuscleGroups.pop();
      showNewRowHint('Could not save the muscle group: ' + error.message);
    }
  };

  // × on a row turns it into a warning strip, since removing a group affects every exercise.
  const askRemoveGroup = (row) => {
    body.querySelectorAll('.volume-confirm-row').forEach((other) => other.remove());
    body.querySelectorAll('.volume-row-removing').forEach((other) => other.classList.remove('volume-row-removing'));
    const group = row.dataset.group;
    row.classList.add('volume-row-removing');
    row.insertAdjacentHTML('afterend', `
      <tr class="volume-confirm-row"><td colspan="3">
        <div class="row-warning" role="alertdialog" aria-label="Remove ${escapeExerciseHtml(group)}">
          <div class="row-warning-text">
            <strong>Remove ${escapeExerciseHtml(group)} everywhere?</strong>
            <span>It's also removed from your other exercises and volume targets.</span>
            <span class="field-hint field-hint-error" hidden></span>
          </div>
          <div class="row-warning-actions">
            <button type="button" class="exo-btn exo-btn-sm volume-keep-btn">Keep</button>
            <button type="button" class="exo-btn exo-btn-sm exo-btn-danger volume-remove-confirm-btn">Remove</button>
          </div>
        </div>
      </td></tr>`);
    row.nextElementSibling.querySelector('.volume-keep-btn').focus();
  };

  const removeGroup = async (confirmRow) => {
    const row = confirmRow.previousElementSibling;
    const group = row.dataset.group;
    captureVolumeRows();
    const previousGroups = volumeMuscleGroups;
    const previousMappings = editorVolumeMappings;
    volumeMuscleGroups = volumeMuscleGroups.filter((name) => name !== group);
    editorVolumeMappings = editorVolumeMappings.filter((mapping) => mapping.muscleGroup !== group);
    try {
      await saveVolumeGroups();
      renderVolumeTracking();
    } catch (error) {
      volumeMuscleGroups = previousGroups;
      editorVolumeMappings = previousMappings;
      const hint = confirmRow.querySelector('.field-hint');
      hint.textContent = 'Could not remove it: ' + error.message;
      hint.hidden = false;
    }
  };

  const closeRemoveWarning = () => {
    body.querySelectorAll('.volume-confirm-row').forEach((other) => other.remove());
    const row = body.querySelector('.volume-row-removing');
    row?.classList.remove('volume-row-removing');
    row?.querySelector('.volume-delete-btn')?.focus();
  };

  body.addEventListener('click', (event) => {
    const target = event.target;
    if (target.closest('.volume-new-save')) return saveNewGroup();
    if (target.closest('.volume-new-cancel')) { captureVolumeRows(); return renderVolumeTracking(); }
    if (target.closest('.volume-delete-btn')) return askRemoveGroup(target.closest('.volume-mapping-row'));
    if (target.closest('.volume-keep-btn')) return closeRemoveWarning();
    if (target.closest('.volume-remove-confirm-btn')) return removeGroup(target.closest('.volume-confirm-row'));
  });
  body.addEventListener('input', (event) => {
    if (event.target.classList.contains('volume-new-input')) showNewRowHint('');
  });
  body.addEventListener('keydown', (event) => {
    if (event.target.classList.contains('volume-new-input')) {
      if (event.key === 'Enter') { event.preventDefault(); saveNewGroup(); }
      if (event.key === 'Escape') { captureVolumeRows(); renderVolumeTracking(); }
    } else if (event.key === 'Escape' && event.target.closest('.volume-confirm-row')) {
      closeRemoveWarning();
    }
  });
}

// Copy the visible contributions (anything above zero) into editorVolumeMappings for the selected variation.
function captureVolumeRows() {
  const body = document.getElementById('volumeMappingRows');
  if (!body) return;
  const captured = [];
  body.querySelectorAll('.volume-mapping-row').forEach((row) => {
    const weight = Number(row.querySelector('.volume-weight-input').value);
    if (!Number.isFinite(weight) || weight <= 0) return;
    captured.push({
      variation: currentVariation,
      muscleGroup: row.dataset.group,
      weight: Math.min(weight, 1)
    });
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
    showNotice('Exercise name is required.', 'error');
    return;
  }

  const seen = new Set();
  for (const mapping of editorVolumeMappings) {
    const key = `${mapping.variation}\u0000${mapping.muscleGroup}`;
    if (seen.has(key)) {
      showNotice(`${mapping.muscleGroup} is mapped more than once${mapping.variation ? ` for "${mapping.variation}"` : ' by default'}.`, 'error');
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
      showNotice("Exercise updated successfully!", 'success');
      renderExerciseSelector();
    })
    .catch(error => showNotice("Error updating exercise: " + error.message, 'error'));
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
async function deleteexo(event) {
  const exerciseId = getCurrentExerciseId();
  if (!exerciseId) return;
  const name = exerciseDataMap[exerciseId]?.name;
  if (!(await confirmInPlace(event.currentTarget, { question: name ? `Delete ${name}?` : 'Delete exercise?' }))) return;

  database.ref(getExerciseDataPath(exerciseId)).remove()
    .then(() => {
      showNotice("Exercise deleted successfully!", 'success');
      const bucket = getExerciseCategoryBucket(exerciseCatalogByCategory, currentExerciseCategory);
      if (bucket) delete bucket[exerciseId];
      delete exerciseMetadataById[exerciseId];
      delete exerciseDataMap[exerciseId];
      exerciseKeys.splice(currentExerciseIndex, 1);
      currentExerciseIndex = Math.min(currentExerciseIndex, Math.max(exerciseKeys.length - 1, 0));
      renderExerciseSelector();
      displayExercise();
    })
    .catch(error => showNotice("Error deleting exercise: " + error.message, 'error'));
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
  exerciseList.classList.toggle('compact-volume', !(showWeightMoved && showSetsRepsCounter));
  exerciseList.classList.toggle('no-volume-details', !showWeightMoved && !showSetsRepsCounter);
  exerciseList.style.setProperty('--sets-w', widest ? ('' + widest + 'px') : '');

  // All-sets mode: extra set lines start with an empty spacer as wide as the first line's
  // variation picker + Add set, so their inputs sit under set 1's
  const firstCounter = exerciseList.querySelector('.wk-row:not(.wk-extra-set) .wk-sets .set-counter');
  if (firstCounter) {
    const setsLeft = firstCounter.closest('.wk-sets').getBoundingClientRect().left;
    const lead = Math.max(Math.round(firstCounter.getBoundingClientRect().left - setsLeft - 6), 0);
    exerciseList.style.setProperty('--set-lead-w', lead + 'px');
  }
}

// Render the exercise list dynamically, including intensity note field
function renderExerciseList() {
  exerciseList.innerHTML = ''; // Clear the list

  if (selectedExercises.length === 0) {
    const emptyRow = document.createElement('div');
    emptyRow.className = 'exercise-item exercise-empty';
    emptyRow.textContent = 'Add an exercise to get started';
    exerciseList.appendChild(emptyRow);
    updateVolumeSummary();
    return;
  }

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
    const volumeDetailsHtml = `<span class="volume-details">${volumeLabel}</span>`;
    const variations = normalizeExerciseVariations(exerciseMetadataById[exercise.id]?.variations ?? exercise.variations);
    const variationButtonHtml = variations.length
      ? `<div class="variation-picker"><button type="button" class="btn btn-sm btn-outline-secondary variation-btn" data-index="${index}" aria-label="Choose variation for ${escapeExerciseHtml(exercise.name)}" title="Variation"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 16l9 5 9-5"/></svg></button><div class="variation-menu hidden">${['', ...variations].map((variation) => `<button type="button" class="variation-option${(exercise.variation || '') === variation ? ' active' : ''}" data-index="${index}" data-variation="${escapeExerciseHtml(variation)}">${variation ? escapeExerciseHtml(variation) : 'Default (none)'}</button>`).join('')}</div></div>`
      : '<div class="variation-picker variation-placeholder" aria-hidden="true"><button type="button" class="btn btn-sm btn-outline-secondary variation-btn" tabindex="-1" disabled><svg viewBox="0 0 24 24" width="16" height="16"></svg></button></div>';
    const exerciseTitleHtml = `${exercise.name}${exercise.variation ? ` - ${escapeExerciseHtml(exercise.variation)}` : ''}`;
    const activeSetIndex = Number.isInteger(exercise.activeSetIndex) ? Math.min(Math.max(exercise.activeSetIndex, 0), Math.max(totalSets - 1, 0)) : 0;
    const currentSet = setsList[activeSetIndex] || { reps: '', weight: '', note: '', custom: '' };
    const setAttrs = `data-index="${index}" data-set-index="${activeSetIndex}"`;
    const customPlaceholder = exercise.customLabel || 'Custom';
    const showAllSets = setsDisplayMode === 'all' && showSetsReps;

    // All-sets mode: the first set sits in the exercise row exactly like one-at-a-time mode
    // (number in place of the arrows); each extra set adds one line with the same columns.
    const allSetInputsHtml = (set, setIndex) => {
      const attrs = `data-index="${index}" data-set-index="${setIndex}"`;
      return `
      <span class="set-counter">${setIndex + 1}</span>
      <input type="number" class="form-control form-control-sm set-input set-reps-input" ${attrs} value="${set.reps || ''}" placeholder="Reps" aria-label="Set ${setIndex + 1} reps">
      ${showWeight ? `<input type="number" class="form-control form-control-sm set-input set-weight-input" ${attrs} value="${set.weight || ''}" placeholder="Weight" aria-label="Set ${setIndex + 1} weight">` : ''}
      ${showCustom ? `<input type="text" class="form-control form-control-sm set-input set-custom-input" ${attrs} value="${set.custom || ''}" placeholder="${customPlaceholder}" aria-label="Set ${setIndex + 1} ${customPlaceholder}">` : ''}
      ${showSetNotes ? `<input type="text" class="form-control form-control-sm set-input set-note-input" ${attrs} value="${set.note || ''}" placeholder="Set notes" aria-label="Set ${setIndex + 1} notes">` : ''}
      <button type="button" class="btn btn-sm btn-outline-danger remove-set-btn" ${attrs} aria-label="Remove set ${setIndex + 1}">×</button>`;
    };
    const extraSetRowsHtml = showAllSets ? setsList.slice(1).map((set, offset) => `
    <div class="wk-row wk-extra-set">
      <span class="wk-name"></span>
      <div class="wk-sets"><span class="wk-set-lead" aria-hidden="true"></span>${allSetInputsHtml(set, offset + 1)}</div>
    </div>`).join('') : '';

    const setControlsHtml = showAllSets
      ? `<button type="button" class="btn btn-secondary btn-sm add-set-btn" data-index="${index}">Add set</button>${allSetInputsHtml(setsList[0] || {}, 0)}`
      : showSetsReps ? `
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
    ${extraSetRowsHtml}
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
  if (!showSetsReps || (!showSetsRepsCounter && !showWeightMoved)) return '';
  if (totalSets <= 0) return 'No sets yet';
  const parts = [];
  if (showSetsRepsCounter) parts.push(`${totalSets} sets • ${totalReps} reps`);
  if (showWeightMoved) parts.push(`${totalWeight} kg moved`);
  return parts.join(' • ');
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

// One id per workout being built, kept in the draft, so saving it again can't create a copy
function getWorkoutSaveId() {
  if (!currentWorkout.saveId) {
    currentWorkout.saveId = window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
  return currentWorkout.saveId;
}

let isSavingWorkout = false;

// Sections load workouts once, so redraw them after a save instead of waiting for a reload.
// Each refresh runs on its own so one failing doesn't stop the others.
function refreshAfterWorkoutSaved({ reloadEditor = true } = {}) {
  const refreshes = [
    () => renderSavedWorkouts(),
    () => reloadEditor && loadWorkouts(),
    () => loadExercises(), // dropdown "Frequency" order counts workouts
    () => {
      const calendar = document.getElementById('calendar-container');
      const yearFilter = document.getElementById('calendar-year-filter');
      if (typeof createCalendar === 'function' && calendar && calendar.style.display === 'block') {
        return createCalendar(parseInt(yearFilter?.value, 10) || new Date().getFullYear());
      }
    },
    () => typeof loadProgressData === 'function' && loadProgressData(),
    () => typeof loadVolumeData === 'function' && loadVolumeData()
  ];
  refreshes.forEach((refresh) => {
    try {
      Promise.resolve(refresh()).catch((error) => console.error('Refresh after save failed:', error));
    } catch (error) {
      console.error('Refresh after save failed:', error);
    }
  });
}

// Save workout to Firebase
saveWorkoutBtn.addEventListener('click', async () => {
  if (isSavingWorkout) return;
  if (selectedExercises.length === 0) {
    showNotice('Please add some exercises before saving!', 'error');
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
    duration: workoutDuration,
    saveId: getWorkoutSaveId()
  };

  isSavingWorkout = true;
  saveWorkoutBtn.disabled = true;
  try {
    await saveWorkout(workout);
    selectedExercises.length = 0;
    currentWorkout.intensity = '';
    currentWorkout.intensityNote = '';
    currentWorkout.saveId = '';
    renderExerciseList();
    resetBtn.click();
    checkLastWorkoutResult();
    showNotice('Workout saved successfully!', 'success');
    refreshAfterWorkoutSaved();
  } catch (error) {
    showNotice(error.message, 'error');
  } finally {
    isSavingWorkout = false;
    saveWorkoutBtn.disabled = false;
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
      if (draft.saveId) {
        currentWorkout.saveId = draft.saveId; // Resaving a restored draft updates the same workout
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
  if (setsDisplayMode === 'all') {
    exerciseList.querySelectorAll('.exercise-item')[index]
      ?.querySelectorAll('.set-reps-input')[exercise.setsList.length - 1]?.focus();
  }
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
    intensity: document.getElementById('workoutIntensity')?.value ?? (currentWorkout.intensity || ''), // Save intensity
    intensityNote: currentWorkout.intensityNote || '', // Save intensity note
    date: getToday(),
    saveId: getWorkoutSaveId()
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

// Close every Add and Edit panel and briefly flash the toggle button green as confirmation.
function collapseAddEditSection() {
  if (!addEditToolbarButtons.classList.contains("hidden")) {
    toggleFormBtn.click();
  }
  toggleFormBtn.classList.remove("flash-success");
  void toggleFormBtn.offsetWidth;
  toggleFormBtn.classList.add("flash-success");
  toggleFormBtn.addEventListener("animationend", () => toggleFormBtn.classList.remove("flash-success"), { once: true });
}

// Toggle the whole Add and Edit toolbar ("Hide" collapses every panel)
toggleFormBtn.addEventListener("click", () => {
  const isOpening = addEditToolbarButtons.classList.contains("hidden");
  addEditToolbarButtons.classList.toggle("hidden", !isOpening);

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
  addExerciseFormWrapper.classList.add("hidden");
  syncAddEditToolbar();
});

// Toggle Exercise Editor section
exoEditorBtn.addEventListener("click", () => {
  exerciseEditorSection.classList.toggle("hidden");
  workoutEditorSection.classList.add("hidden");
  addExerciseFormWrapper.classList.add("hidden");
  syncAddEditToolbar();
});

// Runs after the form's own toggle (registered earlier); opening the form closes both editors
if (toggleAddExerciseFormBtn) {
  toggleAddExerciseFormBtn.addEventListener("click", () => {
    if (!addExerciseFormWrapper.classList.contains("hidden")) {
      workoutEditorSection.classList.add("hidden");
      exerciseEditorSection.classList.add("hidden");
    }
    syncAddEditToolbar();
  });
}
//////////////////////////////////////////////////////////////////////// Add and edit section functionality

//-////////////////////////////////////////////////////////////////////// Past workouts list section

// Select the button element for workouts
const workoutButton = document.getElementById('showWorkoutsBtn');


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
    const selectedWorkoutMonth = document.getElementById('workout-month-filter')?.value || '';

    const entries = Object.entries(workouts)
      .filter(([, workout]) => {
        if (!workout) return false;
        if (selectedWorkoutYear && selectedWorkoutYear !== 'all') {
          const prefix = selectedWorkoutMonth ? `${selectedWorkoutYear}-${selectedWorkoutMonth}` : selectedWorkoutYear;
          return Boolean(workout.date) && workout.date.startsWith(prefix);
        }
        return true;
      })
      .sort(([, a], [, b]) => (b.date || '').localeCompare(a.date || ''));

    entries.forEach(([, workout]) => {
      const date = workout.date || '';
      const intensity = workout.intensity ? `Score: ${workout.intensity}/10` : '';
      const intensityNote = workout.intensityNote ? workout.intensityNote : '';
      const duration = workout.duration ? workout.duration : '';
      const dateText = `<strong>Workout on ${formatWorkoutListDate(date)}</strong>`;
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
const workoutMonthSelect = document.getElementById('workout-month-filter');

// Months only apply to a single year
function syncWorkoutMonthState() {
  if (!workoutMonthSelect || !workoutYearSelect) return;
  const allYears = workoutYearSelect.value === 'all';
  workoutMonthSelect.disabled = allYears;
  if (allYears) workoutMonthSelect.value = '';
}

if (workoutYearSelect) {
  workoutYearSelect.addEventListener('change', () => {
    syncWorkoutMonthState();
    renderSavedWorkouts();
  });
}
if (workoutMonthSelect) {
  workoutMonthSelect.addEventListener('change', renderSavedWorkouts);
}

// Toggle workouts (and the filter) when the "Workouts" tab is clicked
workoutButton.addEventListener('click', () => {
  const workoutYearElement = document.getElementById('workout-year-filter');
  const workoutMonthElement = document.getElementById('workout-month-filter');
  if (savedWorkoutList.classList.contains('hidden')) {
    renderSavedWorkouts(); // Populate the workouts
    savedWorkoutList.classList.remove('hidden'); // Make the workouts list visible
    if (workoutYearElement) workoutYearElement.style.display = 'inline';
    if (workoutMonthElement) workoutMonthElement.style.display = 'inline';
  } else {
    savedWorkoutList.innerHTML = ''; // Clear the workouts content
    savedWorkoutList.classList.add('hidden'); // Hide the workouts list
    if (workoutYearElement) workoutYearElement.style.display = 'none';
    if (workoutMonthElement) workoutMonthElement.style.display = 'none';
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
    showNotice('Please enter how you felt!', 'error');
    return;
  }

  if (!workoutKey) {
    showNotice('There is no recent workout to update.', 'error');
    return;
  }

  try {
    await database.ref(`workouts/${workoutKey}`).update({ result });
    document.getElementById('resultsection')?.classList.add('hidden');
  } catch (error) {
    console.error('Error saving result:', error);
    showNotice('Could not save how you felt. Please try again.', 'error');
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
  renderExerciseList();
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
    loadWorkouts();
    loadCategories();
    await loadWorkoutDraft();
    renderSavedWorkouts();
    checkLastWorkoutResult();
    emitPrivateBootstrapState('ready');
  } catch (error) {
    console.error('Private app bootstrap failed:', error);
    emitPrivateBootstrapState('error', error && error.message ? error.message : 'Unknown bootstrap error');
  }
}

renderExerciseList();
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











