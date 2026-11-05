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
// true = exercises added to the builder start with one empty set; false = with none (Add set adds the first)
let addFirstSetByDefault = false;
const addFirstSetCheckbox = document.getElementById('addFirstSetSetting');
// true = on narrow screens the builder's rows wrap onto a few lines (CSS under .builder-adaptive)
let adaptiveBuilderDisplay = true;
const adaptiveDisplayCheckbox = document.getElementById('adaptiveDisplaySetting');

// Same width as the phone layout in style.css ("Adaptive display")
const phoneLayoutQuery = window.matchMedia('(max-width: 760px)');

function applyAdaptiveBuilderDisplay() {
  document.getElementById('workoutBuilderSection')?.classList.toggle('builder-adaptive', adaptiveBuilderDisplay);
  if (adaptiveDisplayCheckbox) adaptiveDisplayCheckbox.checked = adaptiveBuilderDisplay;
  updateResultPlaceholder();
}

// "How you felt" box: the full prompt is too long for a phone, so phones get a short one
function updateResultPlaceholder() {
  const input = document.getElementById('lastworkoutresult');
  if (!input?.dataset.longPlaceholder) return;
  const phone = adaptiveBuilderDisplay && phoneLayoutQuery.matches;
  input.placeholder = phone ? input.dataset.shortPlaceholder : input.dataset.longPlaceholder;
}
phoneLayoutQuery.addEventListener?.('change', updateResultPlaceholder);
applyAdaptiveBuilderDisplay();

function applyBuilderWidthMode() {
  document.getElementById('workoutBuilderSection')?.classList.toggle('builder-full-width', !fitBuilderWidth);
  if (fitBuilderWidthCheckbox) fitBuilderWidthCheckbox.checked = fitBuilderWidth;
  // Fit mode adds a hidden sizing row to the builder (see getWidthProbeExercise); redraw to add or drop it
  if (exerciseList?.childElementCount) renderExerciseList();
}

const exercisePickerSearch = document.getElementById('exercisePickerSearch');
const exercisePickerEmpty = document.getElementById('exercisePickerEmpty');

function setExercisePickerOpen(isOpen) {
  if (!exercisePickerMenu || !exercisePickerTrigger) return;
  exercisePickerMenu.hidden = !isOpen;
  if (!isOpen) exercisePickerMenu.style.minWidth = '';
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

// A routine picked in the dropdown (null when an exercise is picked instead). Add loads it.
let selectedPickerRoutineId = null;

function clearPickerRoutineSelection() {
  if (!selectedPickerRoutineId) return;
  selectedPickerRoutineId = null;
  exercisePickerTrigger.querySelector('[data-exercise-picker-label]').textContent = 'Select Exercise';
}

// A raised heading in the dropdown (a category, or a collection's name)
function appendPickerHeading(text) {
  const heading = document.createElement('div');
  heading.className = 'exercise-picker-category';
  heading.textContent = text;
  exercisePickerOptions.appendChild(heading);
}

// "No routines yet. Create one…" style link to the panel where they're made
function appendPickerCreateLink(text, openPanel) {
  const create = document.createElement('button');
  create.type = 'button';
  create.className = 'exercise-picker-routine-create';
  create.textContent = text;
  create.addEventListener('click', () => {
    setExercisePickerOpen(false);
    openPanel();
  });
  exercisePickerOptions.appendChild(create);
}

// One exercise in the dropdown; picking it selects that option of the hidden select
function appendPickerExerciseOption(option) {
  const choice = document.createElement('button');
  choice.type = 'button';
  choice.className = 'exercise-picker-option';
  choice.textContent = option.textContent;
  choice.addEventListener('click', () => {
    selectedPickerRoutineId = null;
    exerciseSelect.value = option.value;
    exercisePickerTrigger.querySelector('[data-exercise-picker-label]').textContent = option.textContent;
    setExercisePickerOpen(false);
    exercisePickerTrigger.focus();
  });
  exercisePickerOptions.appendChild(choice);
}

// Collections mode: a heading per collection with its exercises under it
function renderPickerCollectionOptions() {
  const collections = typeof getCollectionPickerEntries === 'function' ? getCollectionPickerEntries() : [];
  if (!collections.length) {
    appendPickerCreateLink('No collections yet. Create one…', openCollectionsPanel);
    return;
  }
  collections.forEach((collection) => {
    const options = collection.exerciseIds.map(findExerciseOption).filter(Boolean);
    if (!options.length) return;
    appendPickerHeading(collection.name);
    options.forEach(appendPickerExerciseOption);
  });
}

// Routines mode: one option per saved routine, or a link to create one when there are none
function renderPickerRoutineOptions(routines) {
  if (!routines.length) {
    appendPickerCreateLink('No routines yet. Create one…', openRoutinesPanel);
    return;
  }
  routines.forEach((routine) => {
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = 'exercise-picker-option exercise-picker-routine';
    choice.textContent = routine.name;
    choice.title = `${routine.exerciseCount} exercise${routine.exerciseCount === 1 ? '' : 's'}`;
    choice.addEventListener('click', () => {
      selectedPickerRoutineId = routine.id;
      exerciseSelect.value = '';
      exercisePickerTrigger.querySelector('[data-exercise-picker-label]').textContent = routine.name;
      setExercisePickerOpen(false);
      exercisePickerTrigger.focus();
    });
    exercisePickerOptions.appendChild(choice);
  });
}

function renderExercisePickerOptions() {
  if (!exercisePickerOptions) return;

  exercisePickerOptions.replaceChildren();

  const routinesMode = workoutBuilderGroupingMode === EXERCISE_GROUPING_MODE.ROUTINES;
  const routines = typeof getRoutinePickerEntries === 'function' ? getRoutinePickerEntries() : [];
  if (selectedPickerRoutineId && !routines.some((routine) => routine.id === selectedPickerRoutineId)) {
    clearPickerRoutineSelection();
  }
  if (exercisePickerSearch) {
    exercisePickerSearch.placeholder = routinesMode ? 'Search routines' : 'Search exercises';
    exercisePickerSearch.setAttribute('aria-label', exercisePickerSearch.placeholder);
  }
  if (exercisePickerEmpty) exercisePickerEmpty.textContent = routinesMode ? 'No matching routines' : 'No matching exercises';

  if (routinesMode) {
    renderPickerRoutineOptions(routines);
    filterExercisePickerOptions();
    return;
  }
  if (workoutBuilderGroupingMode === EXERCISE_GROUPING_MODE.COLLECTIONS) {
    renderPickerCollectionOptions();
    filterExercisePickerOptions();
    return;
  }

  Array.from(exerciseSelect.children).forEach((entry) => {
    const options = entry.tagName === 'OPTGROUP' ? Array.from(entry.children) : [entry];
    const validOptions = options.filter((option) => option.value && option.dataset.collectionOnly !== 'true');
    if (!validOptions.length) return;
    if (entry.tagName === 'OPTGROUP') appendPickerHeading(entry.label);
    validOptions.forEach(appendPickerExerciseOption);
  });
  filterExercisePickerOptions();
}

const sectionVisibilityTargets = {
  addEdit: ['#addEditSection', '#toggleFormBtn'],
  workouts: ['#showWorkoutsSection', '#showWorkoutsBtn'],
  calendar: ['#calendarSection', '#showCalendarBtn'],
  bio: ['#bioSection', '#toggleBioBtn'],
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

adaptiveDisplayCheckbox?.addEventListener('change', async () => {
  adaptiveBuilderDisplay = adaptiveDisplayCheckbox.checked;
  applyAdaptiveBuilderDisplay();
  alignExerciseColumns();
  try {
    await database.ref('settings/workoutBuilder').update({ adaptiveDisplay: adaptiveBuilderDisplay });
  } catch (error) {
    console.error('Error saving adaptiveDisplay setting:', error);
  }
});

if (addFirstSetCheckbox) {
  addFirstSetCheckbox.addEventListener('change', async () => {
    const previousValue = addFirstSetByDefault;
    addFirstSetByDefault = addFirstSetCheckbox.checked;
    // Turning it on also gives a first set to exercises already in the builder that have none
    if (addFirstSetByDefault) {
      const emptyExercises = selectedExercises.filter((exercise) => {
        const fields = normalizeFields(exercise.fields);
        return (fields.includes('sets') || fields.includes('reps')) && !(exercise.setsList || []).length;
      });
      if (emptyExercises.length) {
        emptyExercises.forEach((exercise) => {
          exercise.setsList = [{ reps: '', weight: '', note: '', custom: '' }];
          exercise.activeSetIndex = 0;
        });
        renderExerciseList();
        saveWorkoutDraft();
      }
    }
    try {
      await database.ref('settings/workoutBuilder').update({ addFirstSet: addFirstSetByDefault });
    } catch (error) {
      addFirstSetByDefault = previousValue;
      addFirstSetCheckbox.checked = previousValue;
      console.error('Error saving addFirstSet setting:', error);
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

// Exercise dropdown modes; "routines" lists saved routines instead of exercises
const EXERCISE_GROUPING_MODE = {
  FREQUENCY: 'frequency',
  CATEGORY: 'category',
  ROUTINES: 'routines',
  COLLECTIONS: 'collections'
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

// Settings sections: the name button opens and closes the section's settings. Every section starts
// collapsed; a deselected one has nothing to show, so it stays shut.
settingsPanel?.addEventListener('click', (event) => {
  const button = event.target.closest('.settings-section-collapse');
  if (!button) return;
  const body = document.getElementById(button.getAttribute('aria-controls'));
  const include = button.closest('.settings-section-header')?.querySelector('input[type="checkbox"]');
  if (!body || (include && !include.checked)) return;
  const open = button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded', String(open));
  body.hidden = !open;
});

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

  // "Frequency" order: most done lately first (see computeExerciseFrequency)
  let frequencyMap = {};
  try {
    frequencyMap = await computeExerciseFrequency();
  } catch (error) {
    console.error('Could not count how often exercises are done:', error);
  }
  renderExerciseDropdown(exerciseCatalogByCategory, frequencyMap);
}

// How often each exercise has been done lately, for the dropdown's "Frequency" order. Each workout
// counts once per exercise, weighted by how recent it is: today 1, halving every
// FREQUENCY_HALF_LIFE_DAYS, so what you've been doing lately comes first. Undated workouts count as old.
const FREQUENCY_HALF_LIFE_DAYS = 42;
const UNDATED_WORKOUT_WEIGHT = 0.02;

async function computeExerciseFrequency() {
  const snapshot = await database.ref('workouts').once('value');
  const workouts = snapshot.val();
  const frequencyMap = {};

  if (!workouts || typeof workouts !== 'object') {
    return frequencyMap;
  }

  const now = Date.now();
  Object.values(workouts).forEach((workout) => {
    if (!workout || !Array.isArray(workout.exercises)) return;
    const time = /^\d{4}-\d{2}-\d{2}/.test(workout.date || '') ? new Date(`${workout.date.slice(0, 10)}T12:00:00`).getTime() : NaN;
    const daysAgo = Number.isFinite(time) ? Math.max(0, (now - time) / 86400000) : null;
    const weight = daysAgo === null ? UNDATED_WORKOUT_WEIGHT : 0.5 ** (daysAgo / FREQUENCY_HALF_LIFE_DAYS);
    const seen = new Set();
    workout.exercises.forEach((exercise) => {
      const key = exercise?.id || exercise?.name;
      if (!key || seen.has(key)) return;
      seen.add(key);
      frequencyMap[key] = (frequencyMap[key] || 0) + weight;
    });
  });

  return frequencyMap;
}

function getExerciseCategoriesRef() {
  return database.ref('settings/exerciseCategories');
}

function renderExerciseCategoryOptions() {
  if (!exerciseCategory) return;

  const previous = exerciseCategory.value;
  exerciseCategory.replaceChildren(...exerciseCategories.map((categoryName) => new Option(categoryName, categoryName)));
  appendCategoryManageOptions(exerciseCategory);
  exerciseCategory.value = exerciseCategories.includes(previous) ? previous : (exerciseCategories[0] || ADD_CATEGORY_VALUE);
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

// Category add / remove happen inline under a category dropdown, in Add Exercise and in the
// Exercise Editor (both edit the one shared category list). The dropdown ends with "Add new
// category" and "Remove category". Add: the dropdown is swapped for a name box. Remove: a chip
// per category, each with ×; a category that still has exercises can't be removed, since its
// exercises would drop out of the workout builder's dropdown.
const ADD_CATEGORY_VALUE = 'addNewCategory';
const REMOVE_CATEGORY_VALUE = 'removeCategory';
const categoryManagers = [];

function setCategoryHint(hint, message) {
  hint.textContent = message;
  hint.hidden = !message;
}

function countExercisesInCategory(category) {
  const bucket = getExerciseCategoryBucket(exerciseCatalogByCategory, category) || {};
  return Object.values(bucket).filter((exercise) =>
    !exercise?.collectionOnly && typeof exercise?.name === 'string' && exercise.name.trim()).length;
}

// The separator and the two manage options at the end of a category dropdown
function appendCategoryManageOptions(select) {
  const separator = new Option('──────────', '');
  separator.disabled = true;
  select.append(separator, new Option('Add new category', ADD_CATEGORY_VALUE), new Option('Remove category', REMOVE_CATEGORY_VALUE));
}

// Redraw every category dropdown after the list changes, keeping what each had chosen
function refreshCategoryDropdowns() {
  categoryManagers.forEach((manager) => manager.renderOptions());
}

function setupCategoryManager({ select, addRow, input, addHint, removeRow, chips, removeHint, saveBtn, cancelBtn, doneBtn, renderOptions, onChosen = () => {} }) {
  if (!select || !addRow || !removeRow) return;
  let lastChosen = select.value;

  const close = (selectValue = lastChosen) => {
    addRow.hidden = true;
    removeRow.hidden = true;
    select.hidden = false;
    refreshCategoryDropdowns();
    if ([...select.options].some((option) => option.value === selectValue)) select.value = selectValue;
    if (select.value === ADD_CATEGORY_VALUE || select.value === REMOVE_CATEGORY_VALUE) select.value = lastChosen;
    lastChosen = select.value;
    onChosen(select.value);
  };

  const openAdd = () => {
    select.hidden = true;
    addRow.hidden = false;
    input.value = '';
    input.classList.remove('input-invalid');
    setCategoryHint(addHint, '');
    input.focus();
  };

  const saveNew = async () => {
    const cleaned = input.value.trim();
    if (!cleaned) return input.focus();
    const existing = exerciseCategories.find((category) => category.toLowerCase() === cleaned.toLowerCase());
    if (existing) {
      input.classList.add('input-invalid');
      setCategoryHint(addHint, `"${existing}" already exists`);
      return input.focus();
    }
    exerciseCategories.push(cleaned);
    exerciseCategories.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    await saveExerciseCategories();
    close(cleaned);
  };

  const renderChips = () => {
    const onlyOne = exerciseCategories.length <= 1;
    chips.innerHTML = exerciseCategories.map((category) => {
      const count = countExercisesInCategory(category);
      const removable = !onlyOne && count === 0;
      return `<span class="category-chip" data-category="${escapeExerciseHtml(category)}"${count ? ` title="Has ${count} exercise${count === 1 ? '' : 's'}; delete them first to remove this category"` : ''}>
        ${escapeExerciseHtml(category)}${count ? ` <span class="category-chip-count">${count}</span>` : ''}
        <button type="button" class="category-chip-remove" aria-label="Remove ${escapeExerciseHtml(category)}" ${removable ? '' : 'hidden'}>×</button>
      </span>`;
    }).join('');
    setCategoryHint(removeHint, onlyOne
      ? 'You need at least one category, so the last one can\'t be removed.'
      : 'Categories with exercises (the number shows how many) can\'t be removed.');
  };

  const openRemove = () => {
    select.hidden = true;
    removeRow.hidden = false;
    renderChips();
  };

  select.addEventListener('change', (event) => {
    if (select.value === ADD_CATEGORY_VALUE || select.value === REMOVE_CATEGORY_VALUE) {
      // Keep other listeners from treating these as a category
      event.stopImmediatePropagation();
      if (select.value === ADD_CATEGORY_VALUE) openAdd();
      else openRemove();
      return;
    }
    lastChosen = select.value;
  });

  saveBtn.addEventListener('click', saveNew);
  cancelBtn.addEventListener('click', () => close());
  input.addEventListener('input', () => {
    input.classList.remove('input-invalid');
    setCategoryHint(addHint, '');
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); saveNew(); }
    if (event.key === 'Escape') close();
  });

  // × asks "Remove? Yes / No" inside the chip; Yes removes it straight away.
  chips.addEventListener('click', async (event) => {
    const chip = event.target.closest('.category-chip');
    if (!chip) return;
    const category = chip.dataset.category;

    if (event.target.closest('.category-chip-remove')) {
      renderChips(); // closes any other chip that was asking
      const fresh = chips.querySelector(`.category-chip[data-category="${CSS.escape(category)}"]`);
      fresh.classList.add('is-confirming');
      fresh.innerHTML = `${escapeExerciseHtml(category)} → Remove?
        <span class="category-chip-confirm">
          <button type="button" class="category-chip-yes">Yes</button>
          <button type="button" class="category-chip-no">No</button>
        </span>`;
      fresh.querySelector('.category-chip-yes').focus();
    } else if (event.target.closest('.category-chip-no')) {
      renderChips();
    } else if (event.target.closest('.category-chip-yes')) {
      exerciseCategories = exerciseCategories.filter((name) => name !== category);
      await saveExerciseCategories();
      refreshCategoryDropdowns();
      renderChips();
    }
  });
  doneBtn.addEventListener('click', () => close());

  categoryManagers.push({ renderOptions });
}

// Add Exercise → Create your own
setupCategoryManager({
  select: exerciseCategory,
  addRow: document.getElementById('categoryAddRow'),
  input: document.getElementById('newCategoryInput'),
  addHint: document.getElementById('categoryAddHint'),
  removeRow: document.getElementById('categoryRemoveRow'),
  chips: document.getElementById('categoryChips'),
  removeHint: document.getElementById('categoryRemoveHint'),
  saveBtn: document.getElementById('saveCategoryBtn'),
  cancelBtn: document.getElementById('cancelCategoryBtn'),
  doneBtn: document.getElementById('doneRemovingCategoriesBtn'),
  renderOptions: () => renderExerciseCategoryOptions(),
  onChosen: () => { if (typeof renderNewExerciseModel === 'function') renderNewExerciseModel(); }
});

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

  monthSelect.innerHTML = '<option value="">All Months</option>' +
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

// "Create your own": the button submits the form, so Enter in Name or Note adds the exercise too
const newExerciseNote = document.getElementById('newExerciseNote');
const newExerciseHint = document.getElementById('newExerciseHint');

function setNewExerciseProblem(message) {
  newExerciseName.classList.toggle('input-invalid', Boolean(message));
  newExerciseHint.textContent = message;
  newExerciseHint.hidden = !message;
  if (message) newExerciseName.focus();
}

newExerciseName.addEventListener('input', () => setNewExerciseProblem(''));

// Variations for "Create your own": typed in by the user; each shows as a ticked chip that can be unticked
const customVariationChips = document.getElementById('customVariationChips');
const customVariationInput = document.getElementById('customVariationInput');
let ownVariations = [];

function getCheckedCustomVariations() {
  return [...customVariationChips.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
}

function renderCustomVariationChips() {
  const checked = new Set(getCheckedCustomVariations());
  customVariationChips.innerHTML = ownVariations.length
    ? `<div class="library-variation-group">${ownVariations.map((value) => `<label class="library-chip"><input type="checkbox" value="${escapeExerciseHtml(value)}" ${checked.has(value) ? 'checked' : ''}> ${escapeExerciseHtml(value)}</label>`).join('')}</div>`
    : '';
}

// Adds the typed variation as a ticked chip (or ticks the existing one with that name)
function addOwnVariation() {
  const value = customVariationInput.value.trim();
  if (!value) return customVariationInput.focus();
  const known = ownVariations;
  const name = known.find((variation) => variation.toLowerCase() === value.toLowerCase()) || value;
  if (!known.includes(name)) ownVariations.push(name);
  renderCustomVariationChips();
  const box = [...customVariationChips.querySelectorAll('input[type="checkbox"]')].find((input) => input.value === name);
  if (box) box.checked = true;
  customVariationInput.value = '';
  customVariationInput.focus();
  renderNewExerciseModel();
}

document.getElementById('customVariationAddBtn').addEventListener('click', addOwnVariation);
customVariationInput.addEventListener('keydown', (event) => {
  // Enter adds the variation instead of the whole exercise
  if (event.key === 'Enter') { event.preventDefault(); addOwnVariation(); }
});
renderCustomVariationChips();

// Right side of "Create your own": the exercise as it will be saved, and how much each
// muscle group counts for it (saved as the exercise's default volume mappings)
let newExerciseTargets = {}; // muscle group -> contribution typed so far

function renderNewExerciseModel() {
  const name = newExerciseName.value.trim();
  const category = exerciseCategories.includes(exerciseCategory.value) ? exerciseCategory.value : '';
  document.getElementById('newExerciseModelName').textContent = name || 'New exercise';
  document.getElementById('newExerciseModelCategory').textContent = category;
  const variations = getCheckedCustomVariations();
  document.getElementById('newExerciseModelVariations').innerHTML = variations.length
    ? ['Default', ...variations].map((variation) => `<span>${escapeExerciseHtml(variation)}</span>`).join('')
    : '<span class="exo-hint">No variations</span>';
}

function renderNewExerciseTargets() {
  const container = document.getElementById('newExerciseTargets');
  if (!volumeGroupsLoaded) {
    container.innerHTML = '<p class="exo-hint">Loading muscle groups…</p>';
    ensureVolumeGroups().then(renderNewExerciseTargets);
    return;
  }
  if (!volumeMuscleGroups.length) {
    container.innerHTML = '<p class="exo-hint">No muscle groups yet. Add them in the Exercise Editor\'s Target Groups.</p>';
    return;
  }
  container.innerHTML = `
    <table class="exo-volume-table">
      <thead><tr><th>Muscle group</th><th>Contribution</th></tr></thead>
      <tbody>${volumeMuscleGroups.map((group) => `
        <tr>
          <td>${escapeExerciseHtml(group)}</td>
          <td><input type="number" class="exo-add-target-input" data-group="${escapeExerciseHtml(group)}" min="0" max="1" step="0.05" placeholder="0"
            value="${newExerciseTargets[group] > 0 ? newExerciseTargets[group] : ''}" aria-label="Contribution for ${escapeExerciseHtml(group)}"></td>
        </tr>`).join('')}</tbody>
    </table>`;
}

function getNewExerciseVolumeMappings() {
  return Object.entries(newExerciseTargets)
    .filter(([group, weight]) => volumeMuscleGroups.includes(group) && weight > 0)
    .map(([muscleGroup, weight]) => ({ variation: '', muscleGroup, weight: Math.min(weight, 1) }));
}

document.getElementById('newExerciseTargets').addEventListener('input', (event) => {
  const input = event.target.closest('.exo-add-target-input');
  if (!input) return;
  const weight = parseFloat(input.value);
  if (Number.isFinite(weight) && weight > 0) newExerciseTargets[input.dataset.group] = weight;
  else delete newExerciseTargets[input.dataset.group];
});
newExerciseName.addEventListener('input', renderNewExerciseModel);
exerciseCategory.addEventListener('change', renderNewExerciseModel);
customVariationChips.addEventListener('change', renderNewExerciseModel);
document.getElementById('addCustomBtn')?.addEventListener('click', () => {
  renderNewExerciseModel();
  renderNewExerciseTargets();
});

document.getElementById('addExerciseForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = newExerciseName.value.trim();
  const category = exerciseCategory.value;

  if (!name) return setNewExerciseProblem('Enter a name for the exercise.');
  if (getExistingExerciseNames().has(name.toLowerCase())) return setNewExerciseProblem(`You already have "${name}".`);
  if (!exerciseCategories.includes(category)) {
    showNotice('Choose a category first.', 'error');
    return exerciseCategory.focus();
  }

  // A variation typed but not yet added counts too
  const typedVariation = customVariationInput.value.trim();
  const variations = [...new Set([...getCheckedCustomVariations(), ...(typedVariation ? [typedVariation] : [])])];

  try {
    saveNewExerciseBtn.disabled = true;
    await postToWorkoutApi('/api/exercises', {
      name,
      category,
      note: newExerciseNote.value.trim(),
      variations,
      volumeMappings: getNewExerciseVolumeMappings(),
      focusAreas: [],
      ...readTrackFields(newExerciseTrackFields)
    });
    resetTrackFields(newExerciseTrackFields);
    newExerciseName.value = '';
    newExerciseNote.value = '';
    customVariationInput.value = '';
    ownVariations = [];
    customVariationChips.innerHTML = '';
    renderCustomVariationChips();
    newExerciseTargets = {};
    renderNewExerciseModel();
    renderNewExerciseTargets();
    await loadExercises();
    if (typeof reloadExerciseLists === 'function') reloadExerciseLists();
    refreshExerciseEditor();
    if (window.refreshTrackedExercises) window.refreshTrackedExercises();
    collapseAddEditSection();
  } catch (error) {
    showNotice(error.message, 'error');
  } finally {
    saveNewExerciseBtn.disabled = false;
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
const libraryTargets = document.getElementById('libraryTargets');
const libraryTargetDetails = document.getElementById('libraryTargetDetails');
const addLibraryExerciseBtn = document.getElementById('addLibraryExerciseBtn');
let selectedLibraryExercise = null;
let libraryTargetValues = {};

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
      if (!exercise?.collectionOnly && typeof exercise?.name === 'string') names.add(exercise.name.trim().toLowerCase());
    });
  });
  return names;
}

function renderLibraryList() {
  if (!libraryList) return;
  const library = window.EXERCISE_LIBRARY || [];
  const query = (librarySearch?.value || '').trim().toLowerCase();
  // "Added" also covers small spelling differences ("Pull-ups" for Pull-Up)
  const existing = new Set([...getExistingExerciseNames()].map(looseExerciseKey));
  // A search also matches variation names, e.g. "hammer" finds Bicep Curl
  const matches = library.filter((entry) => !query
    || entry.name.toLowerCase().includes(query)
    || getLibraryVariations(entry).some((variation) => variation.toLowerCase().includes(query)));

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
        const added = existing.has(looseExerciseKey(entry.name));
        const selected = selectedLibraryExercise?.name === entry.name;
        return `<button type="button" class="library-item${selected ? ' selected' : ''}" role="option" aria-selected="${selected}"
          data-library-name="${escapeExerciseHtml(entry.name)}" ${added ? 'disabled' : ''}>
          ${escapeExerciseHtml(entry.name)}${added ? ' <span class="library-added">Added</span>' : ''}
        </button>`;
      }).join('')}
    </div>`).join('');
}

// The "how variations work" explainer, shared by both Add Exercise modes (template in index.html)
document.querySelectorAll('[data-variations-explainer]').forEach((slot) => {
  const template = document.getElementById('variationsExplainerTemplate');
  if (template) slot.replaceChildren(template.content.cloneNode(true));
});

// "Track" for new exercises (Create your own and collection-only exercises): a tick box per
// field, sets + reps + weight ticked to start; ticking Custom shows a box to name it ("Floors")
const TRACK_FIELD_LABELS = { sets: 'Sets', reps: 'Reps', weight: 'Weight', custom: 'Custom' };
const DEFAULT_TRACK_FIELDS = ['sets', 'reps', 'weight'];

function renderTrackFieldsPicker(container) {
  if (!container) return;
  container.innerHTML = `${Object.entries(TRACK_FIELD_LABELS).map(([value, label]) =>
    `<label class="track-field"><input type="checkbox" value="${value}"${DEFAULT_TRACK_FIELDS.includes(value) ? ' checked' : ''}> ${label}</label>`).join('')}
    <input type="text" class="form-control form-control-sm track-custom-label" maxlength="40" placeholder="Custom name, e.g. Floors" aria-label="Name of the custom field" hidden>`;
  container.addEventListener('change', (event) => {
    if (event.target.value === 'custom') {
      const label = container.querySelector('.track-custom-label');
      label.hidden = !event.target.checked;
      if (event.target.checked) label.focus();
    }
  });
}

// { fields, customLabel } from a picker; fields keep the usual order
function readTrackFields(container) {
  if (!container) return { fields: [...DEFAULT_TRACK_FIELDS], customLabel: '' };
  const fields = [...container.querySelectorAll('input[type="checkbox"]:checked')].map((box) => box.value);
  const customLabel = fields.includes('custom') ? container.querySelector('.track-custom-label').value.trim() : '';
  return { fields, customLabel };
}

function resetTrackFields(container) {
  if (!container) return;
  container.querySelectorAll('input[type="checkbox"]').forEach((box) => { box.checked = DEFAULT_TRACK_FIELDS.includes(box.value); });
  const label = container.querySelector('.track-custom-label');
  label.value = '';
  label.hidden = true;
}

const newExerciseTrackFields = document.getElementById('newExerciseTrackFields');
renderTrackFieldsPicker(newExerciseTrackFields);
renderTrackFieldsPicker(document.getElementById('collectionNewExerciseTrackFields'));

// What a library exercise records per set; entries without `fields` track sets, reps and weight
function getLibraryExerciseFields(entry) {
  const fields = Array.isArray(entry?.fields) && entry.fields.length ? entry.fields : ['sets', 'reps', 'weight'];
  return { fields, customLabel: fields.includes('custom') ? (entry.customLabel || '') : '' };
}

// "Tracks sets, reps and weight", or "Tracks Floors" for a single custom entry
function describeLibraryExerciseFields(entry) {
  const { fields, customLabel } = getLibraryExerciseFields(entry);
  const names = fields.map((field) => (field === 'custom' ? (customLabel || 'Custom') : field));
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return `Tracks ${list}`;
}

function selectLibraryExercise(name) {
  selectedLibraryExercise = (window.EXERCISE_LIBRARY || []).find((entry) => entry.name === name) || null;
  librarySelection.hidden = !selectedLibraryExercise;
  renderLibraryList();
  if (!selectedLibraryExercise) return;
  libraryTargetValues = { ...(selectedLibraryExercise.targets || {}) };
  libraryTargetDetails.open = false;

  document.getElementById('librarySelectedName').textContent = selectedLibraryExercise.name;
  document.getElementById('librarySelectedCategory').textContent = `${selectedLibraryExercise.category} · ${describeLibraryExerciseFields(selectedLibraryExercise)}`;
  setDemoLink(document.getElementById('librarySelectedLink'), selectedLibraryExercise.link);
  const values = getLibraryVariations(selectedLibraryExercise);
  libraryVariations.innerHTML = values.length
    ? `<div class="library-variation-group">${values.map((value) => `<label class="library-chip"><input type="checkbox" value="${escapeExerciseHtml(value)}"> ${escapeExerciseHtml(value)}</label>`).join('')}</div>`
    : '<p class="exo-hint">No common variations for this one.</p>';
  renderLibraryTargets(selectedLibraryExercise);
}

async function renderLibraryTargets(entry) {
  libraryTargets.innerHTML = '<p class="exo-hint">Loading muscle groups…</p>';
  await ensureVolumeGroups();
  if (selectedLibraryExercise !== entry) return;

  const groups = [...volumeMuscleGroups, ...Object.keys(entry.targets || {})]
    .filter((group, index, all) => all.findIndex((candidate) => candidate.toLowerCase() === group.toLowerCase()) === index);
  if (!groups.length) {
    libraryTargets.innerHTML = '<p class="exo-hint">No muscle groups are set up yet.</p>';
    return;
  }
  groups.forEach((group) => {
    const source = Object.keys(libraryTargetValues).find((name) => name.toLowerCase() === group.toLowerCase());
    if (source && source !== group) {
      libraryTargetValues[group] = libraryTargetValues[source];
      delete libraryTargetValues[source];
    }
  });
  libraryTargets.innerHTML = `
    <table class="exo-volume-table">
      <thead><tr><th>Muscle group</th><th>Contribution</th></tr></thead>
      <tbody>${groups.map((group) => `
        <tr><td>${escapeExerciseHtml(group)}</td>
          <td><input type="number" class="library-target-input form-control form-control-sm"
            data-group="${escapeExerciseHtml(group)}" min="0" max="1" step="0.05" placeholder="0"
            value="${libraryTargetValues[group] > 0 ? libraryTargetValues[group] : ''}"
            aria-label="Default contribution for ${escapeExerciseHtml(group)}"></td></tr>`).join('')}
      </tbody>
    </table>`;
}

libraryTargets.addEventListener('input', (event) => {
  const input = event.target.closest('.library-target-input');
  if (!input) return;
  let weight = input.value === '' ? 0 : Number(input.value);
  if (!Number.isFinite(weight)) weight = 0;
  weight = Math.min(Math.max(weight, 0), 1);
  input.value = weight > 0 ? String(weight) : '';
  if (weight > 0) {
    libraryTargetValues[input.dataset.group] = weight;
  } else {
    delete libraryTargetValues[input.dataset.group];
  }
});

// A library entry's variations as a flat list (older entries grouped them by type)
function getLibraryVariations(entry) {
  const raw = entry?.variations;
  return Array.isArray(raw) ? raw : Object.values(raw || {}).flat();
}

// A name reduced for loose matching: case, spaces, hyphens and plurals don't count, so
// "Pull-ups", "pullups" and "Pull-Up" all match ("Press" keeps its s)
function looseExerciseKey(name) {
  return String(name || '').toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length > 4 && /(ch|sh|x)es$/.test(word)) return word.slice(0, -2); // crunches → crunch
      if (word.length > 2 && word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0, -1); // raises → raise, ups → up
      return word;
    })
    .join('');
}

// The library entry matching this exercise's name (loosely), e.g. for its Demo link
function findLibraryEntryByName(name) {
  const key = looseExerciseKey(name);
  return key ? (window.EXERCISE_LIBRARY || []).find((entry) => looseExerciseKey(entry.name) === key) || null : null;
}

async function getLibraryExerciseVolumeMappings(entry) {
  await ensureVolumeGroups();
  const originalGroups = [...volumeMuscleGroups];
  const mappings = Object.entries(libraryTargetValues)
    .filter(([group, weight]) => typeof group === 'string' && Number.isFinite(Number(weight)) && Number(weight) > 0)
    .map(([group, weight]) => {
      let muscleGroup = volumeMuscleGroups.find((existing) => existing.toLowerCase() === group.toLowerCase());
      if (!muscleGroup) {
        muscleGroup = group;
        volumeMuscleGroups.push(muscleGroup);
      }
      return { variation: '', muscleGroup, weight: Math.min(Number(weight), 1) };
    });

  if (volumeMuscleGroups.length !== originalGroups.length) {
    try {
      await saveVolumeGroups();
    } catch (error) {
      volumeMuscleGroups = originalGroups;
      throw error;
    }
  }
  return mappings;
}

// "Demo ↗": a demonstration page (ExRx.net) in a new tab; hidden when there isn't one
function setDemoLink(anchor, url) {
  if (!anchor) return;
  anchor.hidden = !url;
  if (url) anchor.href = url;
  else anchor.removeAttribute('href');
}

async function addSelectedLibraryExercise() {
  if (!selectedLibraryExercise) return;
  const { name } = selectedLibraryExercise;
  // Use the user's own spelling of the category ("Upper-Body Push" for the library's "Upper Body Push")
  const category = exerciseCategories.find((existing) =>
    normalizeCategoryName(existing) === normalizeCategoryName(selectedLibraryExercise.category)) || selectedLibraryExercise.category;
  const variations = [...libraryVariations.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);

  try {
    addLibraryExerciseBtn.disabled = true;
    // Bring back the library's category if the user removed it
    if (!exerciseCategories.includes(category)) {
      exerciseCategories.push(category);
      await saveExerciseCategories();
      renderExerciseCategoryOptions();
    }
    const { fields, customLabel } = getLibraryExerciseFields(selectedLibraryExercise);
    const volumeMappings = await getLibraryExerciseVolumeMappings(selectedLibraryExercise);
    await postToWorkoutApi('/api/exercises', { name, category, variations, focusAreas: [], fields, customLabel, volumeMappings });
    selectedLibraryExercise = null;
    librarySelection.hidden = true;
    if (librarySearch) librarySearch.value = '';
    await loadExercises();
    if (typeof reloadExerciseLists === 'function') reloadExerciseLists();
    refreshExerciseEditor();
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

// A new exercise for the workout builder. Exercises that track sets start with none, or with one
// empty set when "Add first set by default" is on (withFirstSet forces one). An exercise with a
// single custom field always has its one entry.
function createBuilderExercise(exerciseId, exerciseName, exerciseCategory, { withFirstSet = addFirstSetByDefault } = {}) {
  const exerciseMetadata = exerciseMetadataById[exerciseId] || {};
  const fields = normalizeFields(exerciseMetadata.fields);
  const trackSetsReps = fields.includes('sets') || fields.includes('reps');
  const trackCustomOnly = fields.includes('custom') && !trackSetsReps;
  const initialSetsList = ((trackSetsReps && withFirstSet) || trackCustomOnly) ? [{ reps: '', weight: '', note: '', custom: '' }] : [];

  return {
    id: exerciseId,
    name: exerciseName,
    category: exerciseCategory,
    fields,
    customLabel: exerciseMetadata.customLabel || '',
    variations: normalizeExerciseVariations(exerciseMetadata.variations),
    variation: '',
    sets: trackSetsReps ? initialSetsList.length : 0,
    reps: 0,
    note: '',
    setsList: initialSetsList,
    activeSetIndex: 0,
    showSR: false
  };
}

// The dropdown option for an exercise id, or null if the exercise no longer exists
function findExerciseOption(exerciseId) {
  return Array.from(exerciseSelect.options).find((option) => option.value && option.value === exerciseId) || null;
}

function getExerciseOptionCategory(option) {
  return option.dataset.category || option.parentElement?.label || 'Unknown';
}

// Prevent duplicate exercise addition
addExerciseBtn.addEventListener('click', () => {
    // A routine picked from the dropdown loads all its exercises (see routines.js)
    if (selectedPickerRoutineId) {
      const routineId = selectedPickerRoutineId;
      clearPickerRoutineSelection();
      if (typeof loadRoutineIntoBuilder === 'function') loadRoutineIntoBuilder(routineId);
      return;
    }

    const selectedOption = exerciseSelect.options[exerciseSelect.selectedIndex];
    const exerciseId = selectedOption.value;
    const exerciseName = selectedOption.text;

    if (!exerciseId) return;

    // An exercise can be in the workout more than once, each time as a different variation.
    // A repeat starts on the first variation not already used (the default counts as one).
    const usedVariations = selectedExercises.filter((e) => e.id === exerciseId).map((e) => e.variation || '');
    const newExercise = createBuilderExercise(exerciseId, exerciseName, getExerciseOptionCategory(selectedOption));
    if (usedVariations.length) {
      const freeVariation = ['', ...newExercise.variations].find((variation) => !usedVariations.includes(variation));
      if (freeVariation === undefined) {
        showNotice(newExercise.variations.length
          ? `Every variation of ${exerciseName} is already in this workout`
          : `${exerciseName} is already in this workout. Add a variation in the Exercise Editor to log it twice.`, 'error');
        return;
      }
      newExercise.variation = freeVariation;
      showNotice(`Added ${exerciseName}${freeVariation ? ` – ${freeVariation}` : ''} again. Change its variation with the layers button.`, 'info');
    }

    selectedExercises.push(newExercise);

    renderExerciseList();
    saveWorkoutDraft();
    if (autoStartClock) beginClock();
});

let dropdownContent = []; // Global variable to store the generated dropdown content

function getSettingsRef() {
  return database.ref('settings/workoutBuilder');
}

// Settings → Exercises → "Routines": the Routines mode in the exercise dropdown (settings/workoutBuilder/showRoutines)
let showRoutinesInDropdown = true;
const showRoutinesCheckbox = document.getElementById('showRoutinesSetting');
// Settings → Exercises → "Collections" (settings/workoutBuilder/showCollections). Off hides only
// the Collections mode; collection members remain in the regular exercise lists.
let showCollectionsInDropdown = true;
const showCollectionsCheckbox = document.getElementById('showCollectionsSetting');

function applyRoutinesModeVisibility() {
  if (showRoutinesCheckbox) showRoutinesCheckbox.checked = showRoutinesInDropdown;
  if (showCollectionsCheckbox) showCollectionsCheckbox.checked = showCollectionsInDropdown;
  document.querySelector('[data-grouping-mode="routines"]')?.toggleAttribute('hidden', !showRoutinesInDropdown);
  document.querySelector('[data-grouping-mode="collections"]')?.toggleAttribute('hidden', !showCollectionsInDropdown);
  // The last button showing gets the group's rounded right end
  const visible = [...exerciseGroupingModeButtons].filter((button) => !button.hidden);
  exerciseGroupingModeButtons.forEach((button) => button.classList.toggle('is-last-visible', button === visible[visible.length - 1]));
}

function isGroupingModeAvailable(mode) {
  if (mode === EXERCISE_GROUPING_MODE.ROUTINES) return showRoutinesInDropdown;
  if (mode === EXERCISE_GROUPING_MODE.COLLECTIONS) return showCollectionsInDropdown;
  return true;
}

function setWorkoutBuilderGroupingMode(nextMode, persist = false) {
  let normalizedMode = Object.values(EXERCISE_GROUPING_MODE).includes(nextMode)
    ? nextMode
    : EXERCISE_GROUPING_MODE.FREQUENCY;
  // A saved Routines or Collections mode that's been hidden falls back to Frequency
  if (!isGroupingModeAvailable(normalizedMode)) normalizedMode = EXERCISE_GROUPING_MODE.FREQUENCY;

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
    addFirstSetByDefault = settings.addFirstSet === true;
    adaptiveBuilderDisplay = settings.adaptiveDisplay !== false;
    applyAdaptiveBuilderDisplay();
    if (addFirstSetCheckbox) addFirstSetCheckbox.checked = addFirstSetByDefault;
    showRoutinesInDropdown = settings.showRoutines !== false;
    showCollectionsInDropdown = settings.showCollections !== false;
    applyRoutinesModeVisibility();
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
  selectedPickerRoutineId = null;
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
  // The saved categories plus any other category that holds exercises, so none are left out.
  const listedCategories = new Set(exerciseCategories.map(normalizeCategoryName));
  const validCategories = [...exerciseCategories, ...Object.keys(exercises).filter((category) => !listedCategories.has(normalizeCategoryName(category)))]
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
            variations: normalizeExerciseVariations(categoryExercises[exerciseId]?.variations),
            collectionOnly: categoryExercises[exerciseId]?.collectionOnly === true
          };
        const option = document.createElement("option");
        option.value = exerciseId;
        option.textContent = name;
        option.dataset.category = category;
        if (categoryExercises[exerciseId]?.collectionOnly === true) option.dataset.collectionOnly = 'true';
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
        variations: normalizeExerciseVariations(categoryExercises[exerciseId]?.variations),
        collectionOnly: categoryExercises[exerciseId]?.collectionOnly === true
      };
      const option = document.createElement("option");
      option.value = exerciseId;
      option.textContent = name;
      option.dataset.category = category;
      if (categoryExercises[exerciseId]?.collectionOnly === true) option.dataset.collectionOnly = 'true';
      exerciseSelect.appendChild(option);
    });
  }

  renderExercisePickerOptions();
  // The builder's width follows the widest kind of exercise, which may have just changed
  if (fitBuilderWidth && getWidthProbeExercise()?.id !== widthProbeExerciseId) renderExerciseList();
  console.log("✅ Dropdown updated successfully.");
}

showRoutinesCheckbox?.addEventListener('change', async () => {
  showRoutinesInDropdown = showRoutinesCheckbox.checked;
  applyRoutinesModeVisibility();
  // Hiding Routines while the dropdown is on it switches the dropdown to Frequency
  if (!showRoutinesInDropdown && workoutBuilderGroupingMode === EXERCISE_GROUPING_MODE.ROUTINES) {
    await setWorkoutBuilderGroupingMode(EXERCISE_GROUPING_MODE.FREQUENCY, true);
    loadExercises();
  }
  try {
    await getSettingsRef().update({ showRoutines: showRoutinesInDropdown });
  } catch (error) {
    console.error('Error saving showRoutines setting:', error);
  }
});

showCollectionsCheckbox?.addEventListener('change', async () => {
  showCollectionsInDropdown = showCollectionsCheckbox.checked;
  applyRoutinesModeVisibility();
  if (!showCollectionsInDropdown && workoutBuilderGroupingMode === EXERCISE_GROUPING_MODE.COLLECTIONS) {
    await setWorkoutBuilderGroupingMode(EXERCISE_GROUPING_MODE.FREQUENCY, true);
    loadExercises();
  } else {
    renderExercisePickerOptions();
  }
  try {
    await getSettingsRef().update({ showCollections: showCollectionsInDropdown });
  } catch (error) {
    console.error('Error saving showCollections setting:', error);
  }
});

exerciseGroupingModeButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    // Hold the open menu's width so a narrower list (e.g. Routines) doesn't make it shrink;
    // released when the menu closes
    if (exercisePickerMenu && !exercisePickerMenu.hidden) {
      exercisePickerMenu.style.minWidth = `${exercisePickerMenu.offsetWidth}px`;
    }
    await setWorkoutBuilderGroupingMode(button.dataset.groupingMode, true);
    loadExercises();
  });
});



////////// Here is functionality for viewing and editing past workout fields

// Look inside "/workouts/"
var basePath = "/workouts/";
var workoutKeys = [];
var workoutsById = {};
var currentIndex = -1; // -1 = no workout picked yet
// Year / month picked in the editor before a day (and so a workout) is chosen
var workoutNavYear = "";
var workoutNavMonth = "";

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
      clearWorkoutSelection();
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
// customLabel is set for exercises with a custom field (e.g. "Laps"); others get no custom box
function buildPastSetRowHtml(exerciseIndex, setIndex, set, customLabel = '') {
  set = set || {};
  return `
    <div class="set-row we-set" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}">
      <span class="we-set-number">${setIndex + 1}</span>
      <input type="number" id="set_reps_${exerciseIndex}_${setIndex}" value="${escapeExerciseHtml(set.reps || '')}" placeholder="Reps" aria-label="Reps">
      <input type="number" id="set_weight_${exerciseIndex}_${setIndex}" value="${escapeExerciseHtml(set.weight || '')}" placeholder="Weight" aria-label="Weight">
      ${customLabel ? `<input type="text" id="set_custom_${exerciseIndex}_${setIndex}" value="${escapeExerciseHtml(set.custom || '')}" placeholder="${escapeExerciseHtml(customLabel)}" aria-label="${escapeExerciseHtml(customLabel)}">` : ''}
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

function getExerciseCustomLabel(exercise) {
  const setsList = Array.isArray(exercise?.setsList) ? exercise.setsList : [];
  const hasCustom = normalizeFields(exercise?.fields).includes('custom') || Boolean(exercise?.customLabel) || setsList.some((set) => set && set.custom);
  return hasCustom ? (exercise.customLabel || 'Custom') : '';
}

function buildPastExerciseHtml(exercise, index) {
  const setsList = Array.isArray(exercise.setsList) ? exercise.setsList : [];
  const customLabel = getExerciseCustomLabel(exercise);
  const legacyField = (id, label, value) => `
    <label class="we-legacy-field">${label}
      <input type="number" id="${id}_${index}" value="${escapeExerciseHtml(value)}" placeholder="${label}">
    </label>`;
  const setsHtml = setsList.length > 0
    ? setsList.map((set, setIndex) => buildPastSetRowHtml(index, setIndex, set, customLabel)).join('')
    : `<div class="legacy-row we-legacy">
        ${legacyField('legacy_sets', 'Sets', exercise.sets || '')}
        ${legacyField('legacy_reps', 'Reps', exercise.reps || '')}
        ${legacyField('legacy_weight', 'Weight', exercise.weight || '')}
      </div>`;

  return `
    <div class="exercise-entry we-exercise" data-index="${index}" data-custom-label="${escapeExerciseHtml(customLabel)}">
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
  const hasWorkout = currentIndex >= 0 || isNewWorkout;
  addExerciseBtn.disabled = !hasWorkout || !(dateInput && dateInput.value.trim());
  // Save and Delete need a workout to act on (Delete doubles as Cancel for a new one)
  ["saveChangesBtn", "deleteWorkoutBtn"].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.disabled = !hasWorkout;
  });
}

// Show the editor with no workout loaded, so a day has to be picked first.
// Year and month start on the current ones when there are workouts in them.
function clearWorkoutSelection() {
  if (isNewWorkout) setNewWorkoutMode(false);
  currentIndex = -1;
  const [year, month] = getToday().split("-");
  const dates = workoutKeys.map((key) => getWorkoutDateParts(key));
  workoutNavYear = dates.some((parts) => parts.year === year) ? year : "";
  workoutNavMonth = workoutNavYear && dates.some((parts) => parts.year === year && parts.month === month) ? month : "";
  displayCurrentNode();
}

function startNewWorkout() {
  setNewWorkoutMode(true);
  document.getElementById("fields").innerHTML = `
    <h3 class="we-heading">New workout</h3>
    <div class="we-info">
      <label class="we-field">Name
        <input type="text" id="workout_name" value="" placeholder="Workout on (date)">
      </label>
      <label class="we-field">Date
        <input type="date" id="workout_date" value="">
      </label>
      <label class="we-field we-field-sm">Duration
        <input type="text" id="workout_duration" value="">
      </label>
      <label class="we-field we-field-sm">Score
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
    clearWorkoutSelection();
  } else {
    document.getElementById("fields").innerHTML = "<p>No workouts found.</p>";
  }
}

function displayCurrentNode() {
  if (isNewWorkout) setNewWorkoutMode(false);
  if (workoutKeys.length === 0) return;

  if (currentIndex < 0) {
    const step = !workoutNavYear ? "a year" : !workoutNavMonth ? "a month" : "a day";
    document.getElementById("fields").innerHTML = `<p class="we-hint">Choose ${step} above to open a workout.</p>`;
    renderWorkoutNav();
    updateAddPastExerciseState();
    return;
  }

  var workoutID = workoutKeys[currentIndex];
  var data = workoutsById[workoutID];
  var fieldsHTML = "";

  if (data) {
    const workoutFields = {
      name: "Name",
      date: "Date",
      duration: "Duration",
      intensity: "Score",
      intensityNote: "Note",
      result: "Result"
    };

    fieldsHTML += `<h3 class="we-heading">Workout info</h3><div class="we-info">`;
    for (const key in workoutFields) {
      // An empty name shows the default "Workout on …" title
      const placeholder = key === "name" ? ` placeholder="${escapeExerciseHtml(getDefaultWorkoutName(data.date))}"` : "";
      const sizeClass = key === "duration" || key === "intensity" ? " we-field-sm" : "";
      fieldsHTML += `
        <label class="we-field${sizeClass}">${workoutFields[key]}
          <input type="text" id="workout_${key}" value="${escapeExerciseHtml(data[key] || '')}"${placeholder}>
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

// Title used when a workout has no name of its own
function getDefaultWorkoutName(date) {
  return `Workout on ${formatWorkoutListDate(date)}`;
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
  if (!hasWorkouts) {
    [yearSelect, monthSelect, daySelect].forEach((select) => { select.innerHTML = ""; select.disabled = true; });
    return;
  }

  // With a workout open, the dropdowns show its date; otherwise whatever has been picked so far.
  const selectedKey = currentIndex >= 0 ? workoutKeys[currentIndex] : "";
  const current = selectedKey ? getWorkoutDateParts(selectedKey) : { year: workoutNavYear, month: workoutNavMonth };
  const unique = (values) => Array.from(new Set(values));
  const sameYear = workoutKeys.filter((key) => getWorkoutDateParts(key).year === current.year);
  const sameMonth = sameYear.filter((key) => getWorkoutDateParts(key).month === current.month);
  const placeholder = (label) => ({ value: "", label });

  fillSelect(yearSelect, [placeholder("Year")].concat(unique(workoutKeys.map((key) => getWorkoutDateParts(key).year))
    .map((year) => ({ value: year, label: year || "No date" }))), current.year);
  fillSelect(monthSelect, [placeholder("Month")].concat(unique(sameYear.map((key) => getWorkoutDateParts(key).month))
    .map((month) => ({ value: month, label: MONTH_NAMES[Number(month) - 1] || month || "No date" }))), current.month);
  fillSelect(daySelect, [placeholder("Day")].concat(sameMonth.map((key) => {
    const day = getWorkoutDateParts(key).day;
    const duplicates = sameMonth.filter((other) => getWorkoutDateParts(other).day === day);
    const label = duplicates.length > 1 ? `${day || "No date"} (${duplicates.indexOf(key) + 1})` : (day || "No date");
    return { value: key, label };
  })), selectedKey);

  yearSelect.disabled = false;
  monthSelect.disabled = !current.year;
  daySelect.disabled = !current.year || !current.month;
}

// Picking a year or month narrows the choices; a workout only opens once a day is picked.
function pickWorkoutNavDate(year, month) {
  if (isNewWorkout) setNewWorkoutMode(false);
  currentIndex = -1;
  workoutNavYear = year;
  workoutNavMonth = year ? month : "";
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
            var customValue = entry.querySelector(`#set_custom_${index}_${setIndex}`)?.value;

            if (repsValue || weightValue || noteValue || customValue) {
                setsList.push({
                    reps: repsValue || '',
                    weight: weightValue || '',
                    note: noteValue || '',
                    custom: customValue || ''
                });
            }
        });

        // Keep what the editor doesn't show (id, fields, custom label, variation...) unless the
        // exercise was switched to a different one
        var original = (workoutsById[workoutID]?.exercises || [])[index];
        var kept = original && original.name === name ? { ...original } : {};
        delete kept.sets; delete kept.reps; delete kept.weight; delete kept.setsList;

        if (setsList.length > 0) {
            exerciseUpdates.push({
                ...kept,
                name,
                note,
                sets: setsList.length,
                reps: setsList.reduce((sum, set) => sum + (parseInt(set.reps, 10) || 0), 0),
                setsList
            });
            return;
        }

        var legacySets = parseInt(entry.querySelector(`#legacy_sets_${index}`)?.value, 10);
        var legacyReps = parseInt(entry.querySelector(`#legacy_reps_${index}`)?.value, 10);
        var legacyWeight = parseFloat(entry.querySelector(`#legacy_weight_${index}`)?.value);

        var exerciseObj = { ...kept, name, note };
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
          finishWorkoutEditorSave();
          showNotice("Workout added.", "success");
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
        finishWorkoutEditorSave();
        showNotice("Workout saved.", "success");
        refreshAfterWorkoutSaved({ reloadEditor: false });
      })
      .catch(error => showNotice("Error: " + error.message, 'error'));
}

// After a save: flash the Workouts tab green and clear the date so the next workout is picked fresh.
function finishWorkoutEditorSave() {
  clearWorkoutSelection();
  flashSuccess(document.getElementById("showWorkoutsBtn"));
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
      if (workoutKeys.length > 0) {
        clearWorkoutSelection();
      } else {
        currentIndex = -1;
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
  if (yearNav) yearNav.addEventListener("change", () => pickWorkoutNavDate(yearNav.value, ""));
  if (monthNav) monthNav.addEventListener("change", () => pickWorkoutNavDate(yearNav.value, monthNav.value));
  if (dayNav) dayNav.addEventListener("change", () => {
    const index = workoutKeys.indexOf(dayNav.value);
    if (index === -1) {
      pickWorkoutNavDate(yearNav.value, monthNav.value);
      return;
    }
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
        setsWrapper.insertAdjacentHTML('beforeend', buildPastSetRowHtml(Number(exerciseIndex), nextSetIndex, {}, addSetButton.closest('.exercise-entry')?.dataset.customLabel || ''));
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
// The editor lists every exercise; the category dropdown only narrows the list ('' = all
// categories). Nothing is selected until an exercise is picked (currentExerciseIndex -1).
var currentExerciseCategory = '';      // category filter; '' = all categories
var exerciseKeys = [];                 // ids of the exercises in the list, by category then name
var exerciseDataMap = {};              // every exercise's record, keyed by id
var exerciseCategoryById = {};         // id -> the category it's stored under
var currentExerciseIndex = -1;         // index into exerciseKeys; -1 = none selected
var pendingVariationNames = {};       // unsaved "Variation name" edits: original name -> typed name

// The user's categories (empty ones too, so a new category shows up), then any others that hold exercises
function getEditorCategories() {
  const available = Object.keys(exerciseCatalogByCategory).filter((category) => countExercisesInCategory(category) > 0);
  const listed = new Set(exerciseCategories.map(normalizeCategoryName));
  return [...exerciseCategories, ...available.filter((category) => !listed.has(normalizeCategoryName(category)))];
}

// Rebuild the editor's lists from the exercise catalog, keeping the filter and the selected
// exercise when they still exist
function loadCategories() {
  const selector = document.getElementById('categorySelector');
  if (!selector) return;
  const previousExerciseId = getCurrentExerciseId();

  const categories = getEditorCategories();
  exerciseDataMap = {};
  exerciseCategoryById = {};
  categories.forEach((category) => {
    Object.entries(getExerciseCategoryBucket(exerciseCatalogByCategory, category) || {}).forEach(([id, exercise]) => {
      if (exercise && typeof exercise.name === 'string' && exercise.name.trim()) {
        if (exercise.collectionOnly) return;
        exerciseDataMap[id] = exercise;
        exerciseCategoryById[id] = category;
      }
    });
  });

  renderEditorCategoryOptions();
  applyEditorCategoryFilter(previousExerciseId, { redisplay: true });
}

// "All categories", each category, then Add / Remove category
function renderEditorCategoryOptions() {
  const selector = document.getElementById('categorySelector');
  if (!selector) return;
  const categories = getEditorCategories();
  selector.replaceChildren(new Option('All categories', ''), ...categories.map((category) => new Option(category, category)));
  appendCategoryManageOptions(selector);
  if (!categories.includes(currentExerciseCategory)) currentExerciseCategory = '';
  selector.value = currentExerciseCategory;
}

// exerciseKeys = the exercises in the chosen category (or all), in category order then by name.
// The exercise is only redrawn when the selection changes, so unsaved edits survive a filter change.
function applyEditorCategoryFilter(selectedId = getCurrentExerciseId(), { redisplay = false } = {}) {
  const previousId = getCurrentExerciseId();
  const categoryOrder = getEditorCategories();
  exerciseKeys = Object.keys(exerciseDataMap)
    .filter((id) => !currentExerciseCategory || exerciseCategoryById[id] === currentExerciseCategory)
    .sort((a, b) => (categoryOrder.indexOf(exerciseCategoryById[a]) - categoryOrder.indexOf(exerciseCategoryById[b]))
      || exerciseDataMap[a].name.localeCompare(exerciseDataMap[b].name, undefined, { sensitivity: 'base' }));
  currentExerciseIndex = exerciseKeys.indexOf(selectedId);
  renderExerciseSelector();
  if (redisplay || !previousId || getCurrentExerciseId() !== previousId) displayExercise();
  else updateEditorCounter();
}

function updateEditorCounter() {
  const counter = document.getElementById('exerciseCounter');
  if (!counter) return;
  counter.textContent = currentExerciseIndex >= 0
    ? `Exercise ${currentExerciseIndex + 1} of ${exerciseKeys.length}`
    : `${exerciseKeys.length} exercise${exerciseKeys.length === 1 ? '' : 's'}`;
}

// Reload the editor from the latest exercise list (e.g. after adding an exercise),
// staying on the filter and exercise that were showing.
function refreshExerciseEditor() {
  loadCategories();
}

function selectEditorExercise(exerciseId) {
  captureVolumeRows();
  currentExerciseIndex = exerciseKeys.indexOf(exerciseId);
  renderExerciseSelector();
  displayExercise();
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
// Add / remove categories from the editor's dropdown too (set up first, so its change
// listener handles those two options before the filter below sees them)
setupCategoryManager({
  select: document.getElementById('categorySelector'),
  addRow: document.getElementById('editorCategoryAddRow'),
  input: document.getElementById('editorNewCategoryInput'),
  addHint: document.getElementById('editorCategoryAddHint'),
  removeRow: document.getElementById('editorCategoryRemoveRow'),
  chips: document.getElementById('editorCategoryChips'),
  removeHint: document.getElementById('editorCategoryRemoveHint'),
  saveBtn: document.getElementById('editorSaveCategoryBtn'),
  cancelBtn: document.getElementById('editorCancelCategoryBtn'),
  doneBtn: document.getElementById('editorDoneRemovingCategoriesBtn'),
  renderOptions: () => renderEditorCategoryOptions(),
  // A newly added category becomes the filter (it's empty, so the list says so); after removing
  // categories the filter may have fallen back to All, so the list is always rebuilt
  onChosen: (value) => {
    currentExerciseCategory = value;
    applyEditorCategoryFilter();
  }
});

// The category only filters the exercise list; the selected exercise stays if it's still in it
document.getElementById("categorySelector").addEventListener("change", function(e) {
  captureVolumeRows();
  currentExerciseCategory = e.target.value;
  applyEditorCategoryFilter();
});

// ---- Exercise picker (search + category headings) ----
const editorExercisePicker = document.getElementById('editorExercisePicker');
const editorExercisePickerTrigger = document.getElementById('editorExercisePickerTrigger');
const editorExercisePickerMenu = document.getElementById('editorExercisePickerMenu');
const editorExerciseSearch = document.getElementById('editorExerciseSearch');
const editorExerciseOptions = document.getElementById('editorExerciseOptions');
const editorExerciseEmpty = document.getElementById('editorExerciseEmpty');

function setEditorExercisePickerOpen(open) {
  if (!editorExercisePickerMenu) return;
  editorExercisePickerMenu.hidden = !open;
  editorExercisePickerTrigger.setAttribute('aria-expanded', String(open));
  editorExerciseSearch.value = '';
  filterEditorExerciseOptions();
  if (open) {
    editorExerciseSearch.focus();
    editorExerciseOptions.querySelector('.exercise-picker-option.active')?.scrollIntoView({ block: 'nearest' });
  }
}

// Hides exercises that don't contain the search text, and headings left with none
function filterEditorExerciseOptions() {
  const query = editorExerciseSearch.value.trim().toLowerCase();
  let heading = null;
  let headingHasMatch = false;
  let anyMatch = false;
  const closeHeading = () => { if (heading) heading.hidden = !headingHasMatch; };
  Array.from(editorExerciseOptions.children).forEach((element) => {
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
  editorExerciseEmpty.hidden = anyMatch;
  editorExerciseEmpty.textContent = exerciseKeys.length ? 'No matching exercises' : 'No exercises in this category';
}

editorExercisePickerTrigger?.addEventListener('click', () => setEditorExercisePickerOpen(editorExercisePickerMenu.hidden));
editorExerciseSearch?.addEventListener('input', filterEditorExerciseOptions);
editorExerciseSearch?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  Array.from(editorExerciseOptions.querySelectorAll('.exercise-picker-option')).find((option) => !option.hidden)?.click();
});
editorExerciseOptions?.addEventListener('click', (event) => {
  const option = event.target.closest('.exercise-picker-option');
  if (!option) return;
  setEditorExercisePickerOpen(false);
  editorExercisePickerTrigger.focus();
  selectEditorExercise(option.dataset.exerciseId);
});
document.addEventListener('click', (event) => {
  if (editorExercisePicker && !editorExercisePickerMenu.hidden && !editorExercisePicker.contains(event.target)) setEditorExercisePickerOpen(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && editorExercisePickerMenu && !editorExercisePickerMenu.hidden) {
    setEditorExercisePickerOpen(false);
    editorExercisePickerTrigger.focus();
  }
});

document.getElementById("variationSelector").addEventListener("change", function(e) {
  captureVolumeRows();
  currentVariation = e.target.value;
  renderVolumeTracking();
  updateVariationButtons();
});

async function persistExerciseUpdates(exerciseId, updates) {
  await database.ref(getExerciseDataPath(exerciseId)).update(updates);
  // Keep this page's copies in step (the catalog's record too, which the volume table reads)
  const catalogRecord = Object.values(exerciseCatalogByCategory || {}).map((bucket) => bucket?.[exerciseId]).find(Boolean);
  [...new Set([exerciseDataMap[exerciseId], exerciseMetadataById[exerciseId], catalogRecord])].forEach((record) => {
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

  const existing = [...editorVariations, ...Object.values(pendingVariationNames).map((typed) => typed.trim())]
    .find((variation) => variation.toLowerCase() === variationName.toLowerCase());
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
      delete pendingVariationNames[currentVariation];
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

// The picker's options (a heading per category) and its button label
function renderExerciseSelector() {
  if (!editorExerciseOptions) return;
  const selectedId = getCurrentExerciseId();
  editorExerciseOptions.replaceChildren();
  let lastCategory = null;
  exerciseKeys.forEach((exerciseId) => {
    const category = exerciseCategoryById[exerciseId];
    if (category !== lastCategory) {
      const heading = document.createElement('div');
      heading.className = 'exercise-picker-category';
      heading.textContent = category;
      editorExerciseOptions.appendChild(heading);
      lastCategory = category;
    }
    const option = document.createElement('button');
    option.type = 'button';
    option.className = `exercise-picker-option${exerciseId === selectedId ? ' active' : ''}`;
    option.dataset.exerciseId = exerciseId;
    option.textContent = exerciseDataMap[exerciseId]?.name || exerciseId;
    editorExerciseOptions.appendChild(option);
  });
  filterEditorExerciseOptions();

  const label = editorExercisePickerTrigger?.querySelector('[data-editor-exercise-label]');
  if (label) label.textContent = selectedId ? exerciseDataMap[selectedId]?.name || 'Exercise' : 'Select exercise';
  editorExercisePickerTrigger?.classList.toggle('is-placeholder', !selectedId);
}

function renderVariationSelector() {
  const selector = document.getElementById('variationSelector');
  if (!selector) return;
  // Nothing to choose until an exercise is picked
  const hasExercise = Boolean(getCurrentExerciseId());
  selector.replaceChildren(...(hasExercise
    ? [new Option('Default (no variation)', ''), ...editorVariations.map((variation) => new Option(variation, variation))]
    : [new Option('Select variation', '')]));
  selector.value = hasExercise ? currentVariation : '';
  selector.disabled = !hasExercise;
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
  renderVariationNameField();
  const hasExercise = Boolean(getCurrentExerciseId());
  if (addExerciseVariationButton) addExerciseVariationButton.disabled = !hasExercise;
  if (removeExerciseVariationButton) removeExerciseVariationButton.disabled = !hasExercise || !currentVariation;
}

// "Variation name" in Exercise Details: shows the selected variation (hidden for the default).
// A typed name is kept per variation until Save, so switching variation doesn't lose it.
function renderVariationNameField() {
  const container = document.getElementById('variationNameContainer');
  const input = document.getElementById('exercise_variation_name');
  if (!container || !input) return;
  container.hidden = !currentVariation;
  input.value = pendingVariationNames[currentVariation] ?? currentVariation;
  input.classList.remove('input-invalid');
}

function trackVariationNameInput(event) {
  if (!currentVariation) return;
  const typed = event.target.value;
  if (typed.trim() === currentVariation) delete pendingVariationNames[currentVariation];
  else pendingVariationNames[currentVariation] = typed;
  event.target.classList.remove('input-invalid');
}

// Renames whose history (past workouts etc.) isn't updated yet are queued on the exercise as
// pendingVariationRenames, saved together with the new name. They're worked through in order and
// removed once done; anything left is retried on the next Save or when the app opens.
function normalizePendingRenames(raw) {
  return Object.values(raw || {})
    .filter((rename) => typeof rename?.from === 'string' && typeof rename?.to === 'string');
}

const variationRenameRuns = {};

function applyPendingVariationRenames(exerciseId) {
  const run = async () => {
    const queueRef = database.ref(`${getExerciseDataPath(exerciseId)}/pendingVariationRenames`);
    const queue = normalizePendingRenames((await queueRef.once('value')).val());
    if (!queue.length) return;
    // Keep this page's copies of the exercise in step, so the next Save queues only what's left
    const setLocalQueue = () => {
      [exerciseDataMap[exerciseId], ...Object.values(exerciseCatalogByCategory || {}).map((bucket) => bucket?.[exerciseId])]
        .forEach((record) => {
          if (!record) return;
          if (queue.length) record.pendingVariationRenames = [...queue];
          else delete record.pendingVariationRenames;
        });
    };
    while (queue.length) {
      await renameVariationInHistory(exerciseId, queue[0].from, queue[0].to);
      queue.shift();
      await (queue.length ? queueRef.set(queue) : queueRef.remove());
      setLocalQueue();
    }
    refreshAfterWorkoutSaved();
    if (window.refreshTrackedExercises) window.refreshTrackedExercises();
  };
  // One run at a time per exercise
  variationRenameRuns[exerciseId] = (variationRenameRuns[exerciseId] || Promise.resolve()).catch(() => {}).then(run);
  return variationRenameRuns[exerciseId];
}

// When the app opens: finish renames that didn't get through last time
function retryPendingVariationRenames() {
  Object.values(exerciseCatalogByCategory || {}).forEach((bucket) => {
    Object.entries(bucket || {}).forEach(([exerciseId, exercise]) => {
      if (!normalizePendingRenames(exercise?.pendingVariationRenames).length) return;
      applyPendingVariationRenames(exerciseId)
        .catch((error) => console.error('Could not finish renaming a variation in past workouts:', error));
    });
  });
}

// A renamed variation keeps its history: past workouts, e1RM entries and the
// Progress tracking choice move to the new name. Safe to run again.
async function renameVariationInHistory(exerciseId, from, to) {
  const [workoutsSnapshot, e1rmSnapshot, trackedSnapshot] = await Promise.all([
    database.ref('workouts').once('value'),
    database.ref('estimoneRepMax').once('value'),
    database.ref('settings/progress/trackedExercises').once('value')
  ]);

  const workoutUpdates = {};
  Object.entries(workoutsSnapshot.val() || {}).forEach(([workoutId, workout]) => {
    Object.entries(workout?.exercises || {}).forEach(([index, exercise]) => {
      if (exercise?.id === exerciseId && typeof exercise.variation === 'string' && exercise.variation.trim() === from) {
        workoutUpdates[`${workoutId}/exercises/${index}/variation`] = to;
      }
    });
  });

  const e1rmUpdates = {};
  Object.entries(e1rmSnapshot.val() || {}).forEach(([entryId, entry]) => {
    if (entry?.exercise === exerciseId && typeof entry.variation === 'string' && entry.variation.trim() === from) {
      e1rmUpdates[`${entryId}/variation`] = to;
    }
  });

  const trackedUpdates = {};
  const tracked = trackedSnapshot.val() || {};
  if (typeof progressKey === 'function') {
    const oldKey = progressKey(exerciseId, from);
    if (oldKey in tracked) {
      trackedUpdates[progressKey(exerciseId, to)] = tracked[oldKey];
      trackedUpdates[oldKey] = null;
    }
  }

  await Promise.all([
    Object.keys(workoutUpdates).length && database.ref('workouts').update(workoutUpdates),
    Object.keys(e1rmUpdates).length && database.ref('estimoneRepMax').update(e1rmUpdates),
    Object.keys(trackedUpdates).length && database.ref('settings/progress/trackedExercises').update(trackedUpdates)
  ]);
}

// ---- Renaming or merging exercises ----
// Renaming an exercise (or merging it into another by giving it that one's name) moves every stored
// copy of its name and id: past workouts (older ones may have only the name, and get the id added),
// 1RM records, routines, collections, the workout draft and Progress's tracked list. Each step only
// changes entries that still point at the old exercise, so running it again after a failure is safe.
async function moveExerciseHistory(fromId, fromName, toId, toName) {
  const oldName = String(fromName || '').trim().toLowerCase();
  const isOld = (id, name) => (id ? id === fromId : typeof name === 'string' && name.trim().toLowerCase() === oldName);
  const read = (path) => database.ref(path).once('value').then((snapshot) => snapshot.val());
  const [workouts, e1rm, tracked, routines, collections, draft] = await Promise.all(
    ['workouts', 'estimoneRepMax', 'settings/progress/trackedExercises', 'routines', 'collections', 'workoutDraft'].map(read));
  const counts = { workouts: 0, entries: 0, records: 0 };
  const writes = [];

  const workoutUpdates = {};
  Object.entries(workouts || {}).forEach(([workoutId, workout]) => {
    let touched = false;
    Object.entries(workout?.exercises || {}).forEach(([index, exercise]) => {
      if (!exercise || !isOld(exercise.id, exercise.name)) return;
      workoutUpdates[`${workoutId}/exercises/${index}/id`] = toId;
      workoutUpdates[`${workoutId}/exercises/${index}/name`] = toName;
      counts.entries++;
      touched = true;
    });
    if (touched) counts.workouts++;
  });
  if (Object.keys(workoutUpdates).length) writes.push(database.ref('workouts').update(workoutUpdates));

  const e1rmUpdates = {};
  Object.entries(e1rm || {}).forEach(([entryId, entry]) => {
    if (!entry || !isOld(entry.exercise, entry.name)) return;
    e1rmUpdates[`${entryId}/exercise`] = toId;
    e1rmUpdates[`${entryId}/name`] = toName;
    counts.records++;
  });
  if (Object.keys(e1rmUpdates).length) writes.push(database.ref('estimoneRepMax').update(e1rmUpdates));

  // Progress's tracked choices are keyed by id (and id~variation); a merge moves them to the other id
  if (fromId !== toId && tracked) {
    const trackedUpdates = {};
    Object.entries(tracked).forEach(([key, value]) => {
      if (key !== fromId && !key.startsWith(`${fromId}~`)) return;
      const newKey = toId + key.slice(fromId.length);
      if (!(newKey in tracked)) trackedUpdates[newKey] = value;
      trackedUpdates[key] = null;
    });
    if (Object.keys(trackedUpdates).length) writes.push(database.ref('settings/progress/trackedExercises').update(trackedUpdates));
  }

  // Routines and collections: point at the new id and name, without listing an exercise twice
  [['routines', routines], ['collections', collections]].forEach(([path, lists]) => {
    Object.entries(lists || {}).forEach(([listId, list]) => {
      const exercises = Array.isArray(list?.exercises) ? list.exercises : Object.values(list?.exercises || {});
      if (!exercises.some((exercise) => exercise?.id === fromId)) return;
      const seen = new Set();
      const moved = exercises.map((exercise) => (exercise?.id === fromId ? { id: toId, name: toName } : exercise))
        .filter((exercise) => exercise && !seen.has(exercise.id) && seen.add(exercise.id));
      writes.push(database.ref(`${path}/${listId}/exercises`).set(moved));
    });
  });

  const draftExercises = Array.isArray(draft?.exercises) ? draft.exercises : Object.values(draft?.exercises || {});
  if (draftExercises.some((exercise) => exercise && isOld(exercise.id, exercise.name))) {
    writes.push(database.ref('workoutDraft/exercises').set(draftExercises.map((exercise) => (
      exercise && isOld(exercise.id, exercise.name) ? { ...exercise, id: toId, name: toName } : exercise))));
  }

  await Promise.all(writes);

  // This page's copies: the workout being built, and the routine / collection lists
  selectedExercises.forEach((exercise) => {
    if (isOld(exercise.id, exercise.name)) Object.assign(exercise, { id: toId, name: toName });
  });
  if (typeof reloadExerciseLists === 'function') reloadExerciseLists();
  return counts;
}

// Merge one exercise into another: its history moves over (see moveExerciseHistory), the other
// exercise gains its variations, and any muscle group contributions it doesn't have yet (the
// default, or a variation's own), then the merged exercise is deleted.
async function mergeExerciseInto(fromId, toId) {
  const from = exerciseDataMap[fromId];
  const to = exerciseDataMap[toId];
  const counts = await moveExerciseHistory(fromId, from.name, toId, to.name);
  // The other exercise's own older entries that have only its name get its id too
  await moveExerciseHistory(toId, to.name, toId, to.name);

  const toMappings = normalizeVolumeMappings(to.volumeMappings);
  const covered = new Set(toMappings.map((mapping) => mapping.variation));
  const carried = normalizeVolumeMappings(from.volumeMappings).filter((mapping) => !covered.has(mapping.variation));
  await persistExerciseUpdates(toId, {
    variations: [...new Set([...normalizeExerciseVariations(to.variations), ...normalizeExerciseVariations(from.variations)])],
    volumeMappings: [...toMappings, ...carried]
  });
  await database.ref(getExerciseDataPath(fromId)).remove();
  return counts;
}

function describeMovedHistory(counts) {
  const parts = [];
  if (counts.entries) parts.push(`${counts.entries} entr${counts.entries === 1 ? 'y' : 'ies'} in ${counts.workouts} workout${counts.workouts === 1 ? '' : 's'}`);
  if (counts.records) parts.push(`${counts.records} 1RM record${counts.records === 1 ? '' : 's'}`);
  return parts.length ? ` (${parts.join(', ')})` : '';
}

// Display the selected exercise: details, its variations, and the volume mappings of the selected variation.
function displayExercise() {
  const detailsSection = document.getElementById('exerciseeditorsection');
  const volumeSection = document.getElementById('volumeTrackingSection');
  const exerciseId = getCurrentExerciseId();
  const data = exerciseId && exerciseDataMap[exerciseId];

  currentVariation = '';
  pendingVariationNames = {};
  if (saveExoBtn) saveExoBtn.disabled = !data;
  if (deleteExoBtn) deleteExoBtn.disabled = !data;
  if (!data) {
    editorVariations = [];
    editorVolumeMappings = [];
    detailsSection.innerHTML = exerciseKeys.length
      ? '<p class="exo-hint">Pick an exercise to edit it. Search for it, or narrow the list by category.</p>'
      : '<p class="exo-hint">No exercises in this category.</p>';
    volumeSection.innerHTML = '';
    updateEditorCounter();
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
      <label for="exercise_category">Category</label>
      <select id="exercise_category">${[...new Set([...exerciseCategories, exerciseCategoryById[exerciseId]].filter(Boolean))]
        .map((category) => `<option value="${escapeExerciseHtml(category)}"${category === exerciseCategoryById[exerciseId] ? ' selected' : ''}>${escapeExerciseHtml(category)}</option>`).join('')}</select>
    </div>
    <div class="exo-field" id="variationNameContainer" hidden>
      <label for="exercise_variation_name">Variation name</label>
      <input type="text" id="exercise_variation_name" maxlength="40">
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
      ${findLibraryEntryByName(data.name)?.link
        ? `<a class="exo-demo-link exercise-editor-demo-link" href="${escapeExerciseHtml(findLibraryEntryByName(data.name).link)}" target="_blank" rel="noopener noreferrer" title="Demonstration on ExRx.net (opens in a new tab)">Demo ↗</a>`
        : ''}
    </div>
    <div id="customFieldContainer" class="exo-field" style="${fields.includes('custom') ? '' : 'display:none;'}">
      <label for="exercise_custom_label">Custom field label</label>
      <input type="text" id="exercise_custom_label" value="${escapeExerciseHtml(data.customLabel)}">
    </div>
  `;
  updateEditorCounter();
  setupExerciseTrackingToggle();
  document.getElementById('exercise_variation_name')?.addEventListener('input', trackVariationNameInput);
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

// Target Group Table (its own panel under Exercises): every exercise and variation against every muscle
// group, each cell an editable contribution (0–1) saved when it's changed. A variation without
// contributions of its own uses its exercise's default, shown as grey placeholders; editing one of
// its cells first copies the defaults to it, since a variation with any of its own replaces the
// default completely (see volume.js).
const volumeTableEditedIds = new Set(); // exercises changed here, so the editor re-reads them

function renderVolumeMatrix() {
  const section = document.getElementById('volumeMatrixSection');
  if (!section || volumeTablePanel?.classList.contains('hidden')) return;

  const categoryNames = Object.keys(exerciseCatalogByCategory || {});
  const orderedCategories = [...new Set([...exerciseCategories.filter((name) => categoryNames.includes(name)), ...categoryNames])];
  const rows = [];
  const groups = new Set(volumeMuscleGroups);
  orderedCategories.forEach((category) => {
    const exercises = Object.entries(getExerciseCategoryBucket(exerciseCatalogByCategory, category) || {})
      .filter(([, exercise]) => exercise && !exercise.collectionOnly && typeof exercise.name === 'string' && exercise.name.trim())
      .sort(([, a], [, b]) => a.name.localeCompare(b.name));
    exercises.forEach(([id, exercise]) => {
      const mappings = normalizeVolumeMappings(exercise.volumeMappings);
      mappings.forEach((mapping) => groups.add(mapping.muscleGroup));
      const weightsFor = (variation) => Object.fromEntries(mappings
        .filter((mapping) => mapping.variation === variation && mapping.weight > 0)
        .map((mapping) => [mapping.muscleGroup, mapping.weight]));
      const defaults = weightsFor('');
      rows.push({ id, category, name: exercise.name, variation: '', weights: defaults, inherited: false });
      normalizeExerciseVariations(exercise.variations).forEach((variation) => {
        const own = weightsFor(variation);
        const inherited = Object.keys(own).length === 0;
        rows.push({ id, category, name: exercise.name, variation, weights: inherited ? defaults : own, inherited });
      });
    });
  });

  const groupList = [...groups];
  const header = `<tr><th>Exercise</th><th>Variation</th>${groupList.map((group) => `<th>${escapeExerciseHtml(group)}</th>`).join('')}</tr>`;
  let lastCategory = null;
  const bodyHtml = rows.map((row) => {
    const categoryRow = row.category !== lastCategory
      ? `<tr class="volume-matrix-category"><th colspan="${groupList.length + 2}">${escapeExerciseHtml(row.category)}</th></tr>`
      : '';
    lastCategory = row.category;
    const cells = groupList.map((group) => {
      const weight = row.weights[group] || '';
      const label = `${row.name}${row.variation ? ` – ${row.variation}` : ''}: ${group}`;
      // Inherited defaults show as placeholders, so the box is empty until the variation gets its own
      return `<td><input type="number" class="volume-matrix-input" min="0" max="1" step="0.05" inputmode="decimal"
        data-exercise-id="${escapeExerciseHtml(row.id)}" data-variation="${escapeExerciseHtml(row.variation)}" data-group="${escapeExerciseHtml(group)}"
        ${row.inherited ? `placeholder="${weight}" title="Uses the exercise default"` : `value="${weight}"`} aria-label="${escapeExerciseHtml(label)}"></td>`;
    }).join('');
    return `${categoryRow}<tr><td>${row.variation ? '' : escapeExerciseHtml(row.name)}</td><td>${row.variation ? escapeExerciseHtml(row.variation) : '<span class="exo-hint">Default</span>'}</td>${cells}</tr>`;
  }).join('');

  section.innerHTML = `
    <div class="volume-matrix-scroll">
      <table class="volume-matrix volume-matrix-editable">${rows.length ? `<thead>${header}</thead><tbody>${bodyHtml}</tbody>` : '<tbody><tr><td class="exo-hint">No exercises yet.</td></tr></tbody>'}</table>
    </div>`;
}

// Save one cell: set (or clear, when empty or 0) that exercise/variation's contribution for the group
async function saveVolumeMatrixCell(input) {
  const { exerciseId, variation, group } = input.dataset;
  const record = Object.values(exerciseCatalogByCategory || {}).map((bucket) => bucket?.[exerciseId]).find(Boolean);
  if (!record) return;
  let weight = input.value === '' ? 0 : Number(input.value);
  if (!Number.isFinite(weight)) weight = 0;
  weight = Math.min(Math.max(weight, 0), 1);
  if (input.value !== '' && weight > 0) input.value = String(weight);

  let mappings = normalizeVolumeMappings(record.volumeMappings);
  // A variation's first own value: start from a copy of the defaults so the rest still count
  if (variation && !mappings.some((mapping) => mapping.variation === variation)) {
    mappings = [...mappings, ...mappings.filter((mapping) => mapping.variation === '').map((mapping) => ({ ...mapping, variation }))];
  }
  mappings = mappings.filter((mapping) => !(mapping.variation === variation && mapping.muscleGroup === group));
  if (weight > 0) mappings.push({ variation, muscleGroup: group, weight });

  input.classList.remove('is-saved', 'is-error');
  try {
    await persistExerciseUpdates(exerciseId, { volumeMappings: mappings });
    volumeTableEditedIds.add(exerciseId);
    input.classList.add('is-saved');
    // The variation's other cells now hold its own values instead of grey defaults
    if (variation) {
      input.closest('tr').querySelectorAll('.volume-matrix-input').forEach((cell) => {
        if (cell === input || cell.value !== '' || !cell.placeholder) return;
        cell.value = cell.placeholder;
        cell.removeAttribute('placeholder');
        cell.removeAttribute('title');
      });
    }
  } catch (error) {
    input.classList.add('is-error');
    showNotice(`Could not save the contribution: ${error.message}`, 'error');
  }
}

document.getElementById('volumeMatrixSection')?.addEventListener('change', (event) => {
  if (event.target.matches('.volume-matrix-input')) saveVolumeMatrixCell(event.target);
});

function renderVolumeTracking() {
  const section = document.getElementById('volumeTrackingSection');
  if (!section) return;
  if (!getCurrentExerciseId()) {
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
      <span class="exo-card-header-actions">
        <button type="button" id="addVolumeMappingBtn" class="btn btn-sm btn-outline-secondary">Add muscle group</button>
      </span>
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
async function saveexo() {
  const exerciseId = getCurrentExerciseId();
  if (!exerciseId) return;

  captureVolumeRows();
  const name = document.getElementById("exercise_name").value.trim();
  if (!name) {
    showNotice('Exercise name is required.', 'error');
    return;
  }

  // Renamed to the name of another exercise (spelling aside, e.g. "Tricep extensions" for
  // "Tricep Extension"): offer to merge into that one rather than end up with two
  const oldName = exerciseDataMap[exerciseId]?.name || '';
  const nameChanged = name !== oldName;
  const mergeTargetId = nameChanged && looseExerciseKey(name) !== looseExerciseKey(oldName)
    ? Object.keys(exerciseDataMap).find((id) => id !== exerciseId && looseExerciseKey(exerciseDataMap[id].name) === looseExerciseKey(name))
    : null;
  if (mergeTargetId) {
    const targetName = exerciseDataMap[mergeTargetId].name;
    const confirmed = await confirmInPlace(saveExoBtn, { question: `${targetName} already exists. Merge ${oldName} into it?`, yesLabel: 'Merge', noLabel: 'Cancel', timeout: 10000 });
    if (!confirmed) return;
    try {
      const counts = await mergeExerciseInto(exerciseId, mergeTargetId);
      await loadExercises();
      refreshExerciseEditor();
      selectEditorExercise(mergeTargetId);
      renderExerciseList();
      saveWorkoutDraft();
      refreshAfterWorkoutSaved();
      if (window.refreshTrackedExercises) window.refreshTrackedExercises();
      showNotice(`Merged ${oldName} into ${targetName}${describeMovedHistory(counts)}`, 'success');
    } catch (error) {
      console.error('Error merging exercises:', error);
      showNotice(`Could not finish the merge: ${error.message}. Save again to retry; nothing is lost.`, 'error');
    }
    return;
  }

  // Variation renames typed in "Variation name", for any variation (not just the one showing).
  // A new name can't be another variation's current name, so renames never swap or chain.
  const renames = [];
  for (const [from, typed] of Object.entries(pendingVariationNames)) {
    if (!editorVariations.includes(from)) continue;
    const to = typed.trim();
    if (to === from) continue;
    const problem = !to ? 'Variation name is required.'
      : editorVariations.some((variation) => variation !== from && variation.toLowerCase() === to.toLowerCase())
        ? `"${to}" is already a variation.`
        : renames.some((rename) => rename.to.toLowerCase() === to.toLowerCase())
          ? `Two variations can't both be called "${to}".`
          : '';
    if (problem) {
      // Show the variation with the problem
      if (from !== currentVariation) {
        currentVariation = from;
        renderVariationSelector();
        renderVolumeTracking();
      }
      document.getElementById('exercise_variation_name')?.classList.add('input-invalid');
      showNotice(problem, 'error');
      return;
    }
    renames.push({ from, to });
  }
  const renameMap = new Map(renames.map((rename) => [rename.from, rename.to]));
  const renamed = (variation) => renameMap.get(variation) ?? variation;
  const historyQueue = [...normalizePendingRenames(exerciseDataMap[exerciseId]?.pendingVariationRenames), ...renames];
  const savedVariations = editorVariations.map(renamed);
  const savedMappings = editorVolumeMappings.map((mapping) => ({ ...mapping, variation: renamed(mapping.variation) }));

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
  const previousCategory = exerciseCategoryById[exerciseId];
  const category = document.getElementById('exercise_category')?.value || previousCategory;
  const updatedData = {
    name,
    category,
    note: document.getElementById("exercise_note").value,
    fields: storedFields,
    customLabel: fields.includes('custom') && customLabelInput ? customLabelInput.value || '' : '',
    variations: savedVariations,
    volumeMappings: savedMappings,
    // Saved with the new names, so past workouts get renamed even if that step fails now
    pendingVariationRenames: historyQueue.length ? historyQueue : null
  };

  // A new name goes into the history first and onto the exercise last, so if anything fails part
  // way, saving again still sees the rename and finishes it
  let movedCounts = null;
  if (nameChanged) {
    try {
      movedCounts = await moveExerciseHistory(exerciseId, oldName, exerciseId, name);
    } catch (error) {
      console.error('Error renaming exercise in past workouts:', error);
      showNotice(`Could not rename ${oldName} everywhere: ${error.message}. Save again to retry; nothing is lost.`, 'error');
      return;
    }
  }

  persistExerciseUpdates(exerciseId, updatedData)
    .then(async () => {
      editorVariations = savedVariations;
      editorVolumeMappings = savedMappings;
      pendingVariationNames = {};
      if (renames.length) {
        currentVariation = renamed(currentVariation);
        renderVariationSelector();
        renderVolumeTracking();
        selectedExercises.forEach((exercise) => {
          if (exercise.id === exerciseId && renameMap.has(exercise.variation)) exercise.variation = renamed(exercise.variation);
        });
      }
      let historyError = null;
      if (historyQueue.length) {
        try {
          await applyPendingVariationRenames(exerciseId);
        } catch (error) {
          historyError = error;
          console.error('Error renaming variation in past workouts:', error);
        }
      }
      showNotice(historyError
        ? 'Exercise saved, but past workouts still have the old variation name. Press Save to try again (it also retries when the app opens).'
        : nameChanged ? `Renamed ${oldName} to ${name}${describeMovedHistory(movedCounts || {})}` : "Exercise updated successfully!", historyError ? 'error' : 'success');
      if (nameChanged) {
        // Lists that show names (exercise dropdowns, saved workouts, Progress) pick up the new one
        await loadExercises();
        refreshExerciseEditor();
        refreshAfterWorkoutSaved();
        if (window.refreshTrackedExercises) window.refreshTrackedExercises();
      }
      renderExerciseSelector();
      // Apply the new fields to this exercise if it's already in the builder
      exerciseMetadataById[exerciseId] = {
        ...(exerciseMetadataById[exerciseId] || {}),
        fields: normalizeFields(updatedData.fields),
        customLabel: updatedData.customLabel,
        variations: normalizeExerciseVariations(updatedData.variations)
      };
      if (selectedExercises.some((exercise) => exercise.id === exerciseId)) {
        selectedExercises.forEach((exercise) => { if (exercise.id === exerciseId) exercise.category = category; });
        renderExerciseList();
        saveWorkoutDraft();
      }
      // Moved to another category: reload the lists so it's filed under the new one everywhere
      if (category !== previousCategory) {
        await loadExercises();
        refreshExerciseEditor();
      }
    })
    .catch(error => showNotice("Error updating exercise: " + error.message, 'error'));
}

function stepExercise(direction) {
  if (exerciseKeys.length === 0) return;
  captureVolumeRows();
  // With nothing selected, › starts at the first exercise and ‹ at the last
  currentExerciseIndex = currentExerciseIndex < 0
    ? (direction > 0 ? 0 : exerciseKeys.length - 1)
    : (currentExerciseIndex + direction + exerciseKeys.length) % exerciseKeys.length;
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
      const bucket = getExerciseCategoryBucket(exerciseCatalogByCategory, exerciseCategoryById[exerciseId]);
      if (bucket) delete bucket[exerciseId];
      delete exerciseMetadataById[exerciseId];
      delete exerciseDataMap[exerciseId];
      delete exerciseCategoryById[exerciseId];
      exerciseKeys.splice(currentExerciseIndex, 1);
      currentExerciseIndex = -1; // back to nothing selected
      renderExerciseSelector();
      displayExercise();
    })
    .catch(error => showNotice("Error deleting exercise: " + error.message, 'error'));
}


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

// "Fit builder to visible columns": the builder is sized for the widest kind of exercise in the
// exercise list (most inputs per set), not just the ones in this workout, so adding, removing or
// swapping exercises never changes its width; only the display settings do. A hidden copy of that
// exercise is drawn as the last row (see renderExerciseList) and the columns are sized to fit it.
let widthProbeExerciseId = null;

function getWidthProbeExercise() {
  let best = null;
  let bestScore = -1;
  Array.from(exerciseSelect.options).forEach((option) => {
    if (!option.value) return;
    const fields = normalizeFields(exerciseMetadataById[option.value]?.fields);
    const tracksSets = fields.includes('sets') || fields.includes('reps');
    const inputs = ['reps', 'weight', 'custom'].filter((field) => fields.includes(field)).length;
    // Set controls (Add set, arrows, counter, set notes) outweigh any number of inputs
    const score = (tracksSets ? 100 : 0) + inputs;
    if (score > bestScore) {
      best = option;
      bestScore = score;
    }
  });
  // With one set, so the columns leave room for the set controls even while real rows have none
  return best ? createBuilderExercise(best.value, best.text, getExerciseOptionCategory(best), { withFirstSet: true }) : null;
}

// Render the exercise list dynamically, including intensity note field
function renderExerciseList() {
  exerciseList.innerHTML = ''; // Clear the list

  const isEmpty = selectedExercises.length === 0;
  if (isEmpty) {
    const emptyRow = document.createElement('div');
    emptyRow.className = 'exercise-item exercise-empty';
    emptyRow.textContent = 'Add an exercise to get started';
    exerciseList.appendChild(emptyRow);
  }

  const probe = fitBuilderWidth ? getWidthProbeExercise() : null;
  widthProbeExerciseId = probe?.id || null;

  [...selectedExercises, ...(probe ? [probe] : [])].forEach((exercise, index) => {
    const exerciseDiv = document.createElement('div');
    exerciseDiv.className = 'exercise-item';
    if (exercise === probe) {
      // Sizes the columns but is never seen or used
      exerciseDiv.classList.add('wk-width-probe');
      exerciseDiv.inert = true;
      exerciseDiv.setAttribute('aria-hidden', 'true');
    }

    // Follow the exercise's current settings, so a change in the exercise editor (e.g. unticking
    // reps) applies to exercises already in the builder
    const metadata = exerciseMetadataById[exercise.id];
    if (metadata) {
      exercise.fields = metadata.fields;
      exercise.customLabel = metadata.customLabel;
    }

    // Ensure the sets list exists; exercises that track sets may have none yet
    ensureSetsList(exercise);
    const fields = normalizeFields(exercise.fields);
    const showSetsReps = fields.includes('sets') || fields.includes('reps');
    const setsList = Array.isArray(exercise.setsList) ? exercise.setsList : [];
    const totalSets = setsList.length;
    const showReps = fields.includes('reps');
    const showWeight = fields.includes('weight');
    const showCustom = fields.includes('custom');
    const customOnly = showCustom && !showSetsReps;
    const totalReps = setsList.reduce((sum, set) => sum + (parseInt(set.reps, 10) || 0), 0);
    const totalWeight = setsList.reduce((sum, set) => sum + ((parseInt(set.reps, 10) || 0) * (parseFloat(set.weight) || 0)), 0);
    const volumeLabel = getVolumeDetailsText(showSetsReps, totalSets, totalReps, totalWeight, fields.includes('reps'));
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
      ${showReps ? `<input type="number" class="form-control form-control-sm set-input set-reps-input" ${attrs} value="${set.reps || ''}" placeholder="Reps" aria-label="Set ${setIndex + 1} reps">` : ''}
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

    const addSetButtonHtml = `<button type="button" class="btn btn-secondary btn-sm add-set-btn" data-index="${index}">Add set</button>`;
    // No sets yet: just the Add set button, no counter or inputs
    const setControlsHtml = showSetsReps && totalSets === 0
      ? addSetButtonHtml
      : showAllSets
      ? `${addSetButtonHtml}${allSetInputsHtml(setsList[0] || {}, 0)}`
      : showSetsReps ? `
      <button type="button" class="btn btn-secondary btn-sm add-set-btn" data-index="${index}">Add set</button>
      <button type="button" class="btn btn-sm btn-outline-secondary set-up-btn" data-index="${index}" ${activeSetIndex < totalSets - 1 ? '' : 'disabled'}>▲</button>
      <span class="set-counter" data-index="${index}">${activeSetIndex + 1}/${totalSets}</span>
      <button type="button" class="btn btn-sm btn-outline-secondary set-down-btn" data-index="${index}" ${activeSetIndex > 0 ? '' : 'disabled'}>▼</button>
      ${showReps ? `<input type="number" class="form-control form-control-sm set-input set-reps-input" ${setAttrs} value="${currentSet.reps || ''}" placeholder="Reps">` : ''}
      ${showWeight ? `<input type="number" class="form-control form-control-sm set-input set-weight-input" ${setAttrs} value="${currentSet.weight || ''}" placeholder="Weight">` : ''}
      ${showCustom ? `<input type="text" class="form-control form-control-sm set-input set-custom-input" ${setAttrs} value="${currentSet.custom || ''}" placeholder="${customPlaceholder}">` : ''}
      ${showSetNotes ? `<input type="text" class="form-control form-control-sm set-input set-note-input" ${setAttrs} value="${currentSet.note || ''}" placeholder="Set notes">` : ''}
      <button type="button" class="btn btn-sm btn-outline-danger remove-set-btn" ${setAttrs}>×</button>
    ` : (customOnly ? `<input type="text" class="form-control form-control-sm set-input set-custom-input set-custom-only" data-index="${index}" data-set-index="0" value="${currentSet.custom || ''}" placeholder="${customPlaceholder}">` : '');

    // Exercises with nothing to track put their notes in the empty sets column; a spacer
    // keeps the remove button lined up with the other rows
    const noteInputHtml = `<input type="text" class="form-control form-control-sm note-input" placeholder="Exercise notes" data-index="${index}" value="${exercise.note || ''}">`;
    const notesInSets = !setControlsHtml;

    exerciseDiv.innerHTML = `
    <div class="wk-row">
      <span class="wk-name" title="${escapeExerciseHtml(exercise.name)}">${exerciseTitleHtml}</span>
      <div class="wk-sets">${variationButtonHtml}${notesInSets ? noteInputHtml : setControlsHtml}</div>
      ${volumeDetailsHtml}
      ${notesInSets ? '<span class="wk-note-spacer" aria-hidden="true"></span>' : noteInputHtml}
      <button type="button" class="btn btn-danger btn-sm remove-btn" data-index="${index}">X</button>
    </div>
    ${extraSetRowsHtml}
    `;
    exerciseList.appendChild(exerciseDiv);
  });

  if (isEmpty) {
    alignExerciseColumns();
    updateVolumeSummary();
    return;
  }

  // Add intensity field with intensity note (global for the workout, not per exercise)
  const intensityDiv = document.createElement('div');
  intensityDiv.className = showWorkoutNotes ? 'introw' : 'introw hidden';
  intensityDiv.id = 'introwcss';

  intensityDiv.innerHTML = `
  <div class="row p-1">
  <div class="col-8 col-md-2">
    <input type="text" id="workoutName" class="form-control form-control-sm" placeholder="${escapeExerciseHtml(getDefaultWorkoutName(getToday()))}" aria-label="Workout name" value="${escapeExerciseHtml(currentWorkout.name || '')}">
  </div>
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

// Reps (and weight moved, which needs reps) only appear for exercises that track reps
function getVolumeDetailsText(showSetsReps, totalSets, totalReps, totalWeight, tracksReps = true) {
  if (!showSetsReps || (!showSetsRepsCounter && !showWeightMoved)) return '';
  if (totalSets <= 0) return 'No sets yet';
  const parts = [];
  if (showSetsRepsCounter) parts.push(tracksReps ? `${totalSets} sets • ${totalReps} reps` : `${totalSets} sets`);
  if (showWeightMoved && tracksReps) parts.push(`${totalWeight} kg moved`);
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
        // Two entries of one exercise can't share a variation; they'd be the same thing logged twice
        const variation = variationOption.dataset.variation;
        const clash = selectedExercises.some((other) => other !== exercise && other.id === exercise.id && (other.variation || '') === variation);
        if (clash) {
          showNotice(`${exercise.name}${variation ? ` – ${variation}` : ''} is already in this workout`, 'error');
          variationOption.closest('.variation-menu')?.classList.add('hidden');
          return;
        }
        exercise.variation = variation;
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

    if (target.matches('#workoutName')) {
      currentWorkout.name = target.value.trim();
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
    name: (document.getElementById('workoutName')?.value || '').trim(),
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
    currentWorkout.name = '';
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
      if (draft.name) {
        currentWorkout.name = draft.name;
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
  // The first set's inputs have just appeared: put the cursor in the first one
  if (exercise.setsList.length === 1) {
    exerciseList.querySelectorAll('.exercise-item')[index]?.querySelector('.set-input[data-set-index="0"]')?.focus();
  } else if (setsDisplayMode === 'all') {
    exerciseList.querySelectorAll('.exercise-item')[index]
      ?.querySelector(`.set-input[data-set-index="${exercise.setsList.length - 1}"]`)?.focus();
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
    const label = getVolumeDetailsText(showSetsReps, totalSets, totalReps, totalWeight, fields.includes('reps'));

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
    name: currentWorkout.name || '',
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
const exoEditorBtn = document.getElementById("showexoeditorbtn");
const workoutEditorSection = document.getElementById("editorsection");
const exerciseEditorSection = document.getElementById("exerciseeditor");
const categorySelector = document.getElementById("categorySelector");
const typeSelector = document.getElementById("typeSelector");
const exerciseNotesSection = document.getElementById("exercisenotessection");
const showRoutinesBtn = document.getElementById("showRoutinesBtn");
const routinesPanel = document.getElementById("routinesPanel");
const showCollectionsBtn = document.getElementById("showCollectionsBtn");
const collectionsPanel = document.getElementById("collectionsPanel");
const showVolumeTableBtn = document.getElementById("showVolumeTableBtn");
const volumeTablePanel = document.getElementById("volumeTablePanel");

// The Exercises section's panels and their toolbar buttons; only one is open at a time
const addEditPanels = [
  [toggleAddExerciseFormBtn, addExerciseFormWrapper],
  [exoEditorBtn, exerciseEditorSection],
  [showRoutinesBtn, routinesPanel],
  [showCollectionsBtn, collectionsPanel],
  [showVolumeTableBtn, volumeTablePanel]
];

function closeOtherAddEditPanels(keep) {
  addEditPanels.forEach(([, panel]) => { if (panel !== keep) panel.classList.add("hidden"); });
}

// Reflect which panel is open: active toolbar buttons, and the exercise Save/Delete actions.
function syncAddEditToolbar() {
  addEditPanels.forEach(([button, panel]) => button.classList.toggle("exo-btn-active", !panel.classList.contains("hidden")));
  exerciseActionButtons.classList.toggle("hidden", exerciseEditorSection.classList.contains("hidden"));
}

// Briefly flash a button green as confirmation.
function flashSuccess(button) {
  if (!button) return;
  button.classList.remove("flash-success");
  void button.offsetWidth;
  button.classList.add("flash-success");
  button.addEventListener("animationend", () => button.classList.remove("flash-success"), { once: true });
}

// Close every Add and Edit panel and briefly flash the toggle button green as confirmation.
function collapseAddEditSection() {
  if (!addEditToolbarButtons.classList.contains("hidden")) {
    toggleFormBtn.click();
  }
  flashSuccess(toggleFormBtn);
}

// Toggle the whole Add and Edit toolbar ("Hide" collapses every panel)
toggleFormBtn.addEventListener("click", () => {
  const isOpening = addEditToolbarButtons.classList.contains("hidden");
  addEditToolbarButtons.classList.toggle("hidden", !isOpening);

  if (!isOpening) {
    closeOtherAddEditPanels(null);
  } else if (addEditPanels.every(([, panel]) => panel.classList.contains("hidden"))) {
    // Open on "Add Exercise" by default; clicking it also refreshes the library list
    toggleAddExerciseFormBtn.click();
  }
  syncAddEditToolbar();
});

// Toggle Exercise Editor section
exoEditorBtn.addEventListener("click", () => {
  exerciseEditorSection.classList.toggle("hidden");
  closeOtherAddEditPanels(exerciseEditorSection);
  syncAddEditToolbar();
  // If the volume table changed this exercise's contributions, show the new ones
  if (!exerciseEditorSection.classList.contains("hidden") && volumeTableEditedIds.has(getCurrentExerciseId())) displayExercise();
  volumeTableEditedIds.clear();
});

// Toggle the Routines panel (its contents are drawn by routines.js)
showRoutinesBtn.addEventListener("click", () => {
  routinesPanel.classList.toggle("hidden");
  closeOtherAddEditPanels(routinesPanel);
  syncAddEditToolbar();
  if (!routinesPanel.classList.contains("hidden") && typeof resetRoutinesPanel === 'function') resetRoutinesPanel();
});

// Toggle the Collections panel (also drawn by routines.js)
showCollectionsBtn.addEventListener("click", () => {
  collectionsPanel.classList.toggle("hidden");
  closeOtherAddEditPanels(collectionsPanel);
  syncAddEditToolbar();
  if (!collectionsPanel.classList.contains("hidden") && typeof resetCollectionsPanel === 'function') resetCollectionsPanel();
});

// Toggle the Target Group Table panel (every exercise's muscle group contributions, editable)
showVolumeTableBtn.addEventListener("click", async () => {
  volumeTablePanel.classList.toggle("hidden");
  closeOtherAddEditPanels(volumeTablePanel);
  syncAddEditToolbar();
  if (!volumeTablePanel.classList.contains("hidden")) {
    await ensureVolumeGroups();
    renderVolumeMatrix();
  }
});

// Opens Exercises → Routines (from the dropdown's "Create one" link) and scrolls to it
function openRoutinesPanel() {
  if (addEditToolbarButtons.classList.contains("hidden")) toggleFormBtn.click();
  if (routinesPanel.classList.contains("hidden")) showRoutinesBtn.click();
  routinesPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Opens Exercises → Collections (from the dropdown's "Create one" link) and scrolls to it
function openCollectionsPanel() {
  if (addEditToolbarButtons.classList.contains("hidden")) toggleFormBtn.click();
  if (collectionsPanel.classList.contains("hidden")) showCollectionsBtn.click();
  collectionsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Runs after the form's own toggle (registered earlier); opening the form closes both editors
if (toggleAddExerciseFormBtn) {
  toggleAddExerciseFormBtn.addEventListener("click", () => {
    if (!addExerciseFormWrapper.classList.contains("hidden")) closeOtherAddEditPanels(addExerciseFormWrapper);
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

    // Each workout is a card: header (name, score, duration, notes), the exercises, and a footer
    // with the result when there is one
    entries.forEach(([workoutKey, workout]) => {
      const date = workout.date || '';
      const editBtn = `<button type="button" class="saved-workout-edit-btn" data-workout-key="${escapeExerciseHtml(workoutKey)}" title="Edit in workout editor" aria-label="Edit this workout">✎</button>`;
      const title = String(workout.name || '').trim() || getDefaultWorkoutName(date);
      const meta = [
        workout.intensity ? `Score ${escapeExerciseHtml(workout.intensity)}/10` : '',
        workout.duration ? escapeExerciseHtml(workout.duration) : ''
      ].filter(Boolean).map((text) => `<span class="saved-workout-chip">${text}</span>`).join('');
      const notes = workout.intensityNote ? `<div class="saved-workout-notes">${escapeExerciseHtml(workout.intensityNote)}</div>` : '';

      const exercises = [...(workout.exercises || [])].reverse().map((e) => {
        const name = escapeExerciseHtml(e.name || 'Unknown');
        const variation = e.variation ? ` <span class="saved-workout-variation">(${escapeExerciseHtml(e.variation)})</span>` : '';
        const noteText = e.note ? ` <span class="saved-workout-exercise-note">${escapeExerciseHtml(e.note)}</span>` : '';

        if (Array.isArray(e.setsList) && e.setsList.length > 0) {
          const setsList = e.setsList;
          const totalSets = setsList.length;
          const totalReps = setsList.reduce((sum, set) => sum + (parseInt(set.reps, 10) || 0), 0);
          const weightMoved = setsList.reduce((sum, set) => sum + ((parseInt(set.reps, 10) || 0) * (parseFloat(set.weight) || 0)), 0);
          const summary = totalSets > 0 ? `${totalSets} sets${totalReps ? ` • ${totalReps} reps` : ''}${weightMoved ? ` • ${weightMoved} kg moved` : ''}` : '';
          const setDetails = setsList.map((set, idx) => {
            // "reps" is spelled out only next to a custom value, where a bare number would be unclear
            const reps = set.reps ? `${set.reps}${set.custom ? ' reps' : ''}${set.weight ? ` x ${set.weight}kg` : ''}` : (set.weight ? `${set.weight}kg` : '');
            const custom = set.custom ? `${escapeExerciseHtml(set.custom)} ${escapeExerciseHtml(e.customLabel || '')}`.trim() : '';
            const setNote = set.note ? ` (${escapeExerciseHtml(set.note)})` : '';
            return `${idx + 1}) ${[reps, custom].filter(Boolean).join(' · ') || '-'}${setNote}`;
          }).join(', ');
          return `<div class="saved-workout-exercise"><span class="saved-workout-exercise-name">${name}</span>${variation}: ${summary}${noteText}${setDetails ? ` <span class="saved-workout-sets">— ${setDetails}</span>` : ''}</div>`;
        }

        const parts = [];
        if (e.sets) parts.push(`${e.sets} sets`);
        if (e.reps) parts.push(`x ${e.reps} reps`);
        if (e.weight) parts.push(`@ ${e.weight}kg`);
        const legacyText = escapeExerciseHtml(parts.join(' '));
        return `<div class="saved-workout-exercise"><span class="saved-workout-exercise-name">${name}</span>${variation}: ${legacyText}${noteText}</div>`;
      }).join('');

      const footer = workout.result
        ? `<div class="saved-workout-footer"><span class="saved-workout-label">Result</span> ${escapeExerciseHtml(workout.result)}</div>`
        : '';
      const workoutDiv = document.createElement('div');
      workoutDiv.className = 'saved-workout';
      workoutDiv.innerHTML = `
        <div class="saved-workout-header">
          <div class="saved-workout-title">${editBtn}<strong>${escapeExerciseHtml(title)}</strong>${meta}</div>
          ${notes}
        </div>
        ${exercises ? `<div class="saved-workout-body">${exercises}</div>` : ''}
        ${footer}
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

// Workouts tab: "List" shows saved workouts with their year/month filters,
// "Editor" swaps them for the past-workout editor. The tab remembers the last view.
const workoutsArea = document.getElementById('workoutsArea');
const workoutsListModeBtn = document.getElementById('workoutsListModeBtn');
const workoutsEditorModeBtn = document.getElementById('workoutsEditorModeBtn');
let workoutsMode = 'list';

function setWorkoutsMode(mode) {
  workoutsMode = mode;
  const showList = mode === 'list';
  workoutsListModeBtn.classList.toggle('exo-btn-active', showList);
  workoutsListModeBtn.setAttribute('aria-pressed', String(showList));
  workoutsEditorModeBtn.classList.toggle('exo-btn-active', !showList);
  workoutsEditorModeBtn.setAttribute('aria-pressed', String(!showList));
  document.getElementById('addPastWorkoutBtn')?.classList.toggle('hidden', showList);
  document.getElementById('workoutListFilters')?.classList.toggle('hidden', !showList);
  if (showList) renderSavedWorkouts();
  else savedWorkoutList.innerHTML = '';
  savedWorkoutList.classList.toggle('hidden', !showList);
  workoutEditorSection.classList.toggle('hidden', showList);
}

workoutsListModeBtn.addEventListener('click', () => setWorkoutsMode('list'));

// Pencil next to "Workout on …": open that workout in the editor.
savedWorkoutList.addEventListener('click', (event) => {
  const editBtn = event.target.closest('.saved-workout-edit-btn');
  if (!editBtn) return;
  const index = workoutKeys.indexOf(editBtn.dataset.workoutKey);
  if (index === -1) {
    showNotice('Could not find that workout in the editor. Try again in a moment.', 'error');
    return;
  }
  setWorkoutsMode('editor');
  currentIndex = index;
  displayCurrentNode();
});
workoutsEditorModeBtn.addEventListener('click', () => setWorkoutsMode('editor'));

workoutButton.addEventListener('click', () => {
  const opening = workoutsArea.classList.contains('hidden');
  workoutsArea.classList.toggle('hidden', !opening);
  if (opening) setWorkoutsMode(workoutsMode);
  else savedWorkoutList.innerHTML = '';
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

          input.dataset.longPlaceholder = `Add how you felt after your workout on ${date}`;
          input.dataset.shortPlaceholder = `How did ${date} feel?`;
          input.title = input.dataset.longPlaceholder;
          updateResultPlaceholder();
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
  currentWorkout.name = '';
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
    retryPendingVariationRenames();
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
