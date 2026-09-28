const basePath = '/workouts/';
let workoutKeys = [];
let currentIndex = 0;
let currentExerciseType = 'exercises';
let currentExerciseCategory = null;
let exerciseKeys = [];
let currentExerciseIndex = 0;

const fieldsContainer = document.getElementById('fields');
const editForm = document.getElementById('editForm');
const categorySelector = document.getElementById('categorySelector');
const typeSelector = document.getElementById('typeSelector');
const exerciseNotesSection = document.getElementById('exercisenotessection');
const workoutYearFilterElement = document.getElementById('workout-year-filter');
const workoutButton = document.querySelector('#showworkouts .click');
const savedWorkoutList = document.getElementById('savedWorkoutList');
const saveLastWorkoutBtn = document.getElementById('savelastworkoutbtn');

function getWorkoutId() {
  return workoutKeys[currentIndex];
}

async function loadWorkouts() {
  const snapshot = await window.database.ref(basePath).once('value');
  if (snapshot.exists()) {
    workoutKeys = Object.keys(snapshot.val());
    currentIndex = 0;
    if (workoutKeys.length > 0) {
      await displayCurrentNode();
    } else {
      fieldsContainer.innerHTML = '<p>No workouts found.</p>';
    }
  } else {
    fieldsContainer.innerHTML = '<p>No workouts found.</p>';
  }
}

async function displayCurrentNode() {
  if (workoutKeys.length === 0) return;

  const workoutID = getWorkoutId();
  const snapshot = await window.database.ref(basePath + workoutID).once('value');
  const data = snapshot.val();
  let fieldsHTML = '';

  if (data) {
    fieldsHTML += '<h3>Workout Info</h3>';
    const workoutFields = {
      date: 'Date',
      duration: 'Duration',
      intensity: 'Intensity',
      intensityNote: 'Note',
      result: 'Result',
    };

    for (const key in workoutFields) {
      fieldsHTML += `
        <label style="display:inline-block; width:65px">${workoutFields[key]}:</label>
        <input type="text" style=" width:350px" id="workout_${key}" value="${data[key] || ''}"><br>
      `;
    }
  }

  if (data && Array.isArray(data.exercises)) {
    fieldsHTML += '<br><h3>Exercises</h3>';
    data.exercises.forEach((exercise, index) => {
      fieldsHTML += `
        <div class="exercise-entry" style="margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
          <label style="display:inline-block; width:50px;">Name:</label>
          <input type="text" id="name_${index}" value="${exercise.name || ''}"><button class="btn btn-danger btn-sm" style="margin-left: 10px;" data-delete-exercise="${index}">X</button><br>
          <label style="display:inline-block; width:50px;">Note:</label>
          <input type="text" id="note_${index}" value="${exercise.note || ''}"><br>
          <label style="display:inline-block; width:50px;">Sets:</label>
          <input type="number" id="sets_${index}" value="${exercise.sets}"><br>
          <label style="display:inline-block; width:50px;">Reps:</label>
          <input type="number" id="reps_${index}" value="${exercise.reps}"><br>
        </div>
      `;
    });
  }

  fieldsContainer.innerHTML = fieldsHTML || '<p>No exercises found.</p>';
  attachWorkoutFieldHandlers();
}

function attachWorkoutFieldHandlers() {
  fieldsContainer.querySelectorAll('[data-delete-exercise]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.deleteExercise);
      deleteExercise(index);
    });
  });
}

function prevNode() {
  if (!workoutKeys.length) return;
  currentIndex = (currentIndex - 1 + workoutKeys.length) % workoutKeys.length;
  displayCurrentNode();
}

function nextNode() {
  if (!workoutKeys.length) return;
  currentIndex = (currentIndex + 1) % workoutKeys.length;
  displayCurrentNode();
}

function addPastExercise() {
  const index = document.querySelectorAll('#fields input[id^="name_"]').length;
  const newExerciseHTML = `
    <div class="exercise-entry" style="margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
      <div>
        <label style="display:inline-block; width:50px;">Name:</label>
        <input type="text" id="name_${index}" value=""><button class="btn btn-danger btn-sm" style="margin-left: 10px;" data-delete-exercise="${index}">X</button><br>
        <label style="display:inline-block; width:50px;">Note:</label>
        <input type="text" id="note_${index}" value=""><br>
        <label style="display:inline-block; width:50px;">Sets:</label>
        <input type="number" id="sets_${index}" value="0"><br>
        <label style="display:inline-block; width:50px;">Reps:</label>
        <input type="number" id="reps_${index}" value="0">
      </div>
    </div>
  `;
  fieldsContainer.insertAdjacentHTML('beforeend', newExerciseHTML);
  attachWorkoutFieldHandlers();
}

async function saveChanges() {
  if (!workoutKeys.length) return;
  const workoutID = getWorkoutId();
  const fullPath = `${basePath}${workoutID}`;

  const workoutUpdates = {};
  fieldsContainer.querySelectorAll('input[id^="workout_"]').forEach((input) => {
    const field = input.id.replace('workout_', '');
    workoutUpdates[field] = input.value;
  });

  const exerciseUpdates = [];
  const nameInputs = fieldsContainer.querySelectorAll('input[id^="name_"]');
  nameInputs.forEach((input) => {
    const index = input.id.split('_')[1];
    exerciseUpdates.push({
      name: input.value,
      note: document.getElementById(`note_${index}`)?.value || '',
      sets: parseInt(document.getElementById(`sets_${index}`)?.value, 10) || 0,
      reps: parseInt(document.getElementById(`reps_${index}`)?.value, 10) || 0,
    });
  });

  try {
    await window.database.ref(fullPath).update(workoutUpdates);
    await window.database.ref(`${fullPath}/exercises`).set(exerciseUpdates);
    alert('Changes saved!');
    loadWorkouts();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function deleteExercise(index) {
  if (!confirm('Are you sure you want to delete this exercise?')) return;
  const workoutID = getWorkoutId();
  const fullPath = `${basePath}${workoutID}/exercises`;

  const snapshot = await window.database.ref(fullPath).once('value');
  const exercises = snapshot.val();
  if (!Array.isArray(exercises) || index >= exercises.length) return;

  exercises.splice(index, 1);
  await window.database.ref(fullPath).set(exercises);
  displayCurrentNode();
}

async function deleteWorkout() {
  if (!confirm('Are you sure you want to delete this workout? This action cannot be undone.')) return;
  const workoutID = getWorkoutId();
  await window.database.ref(`${basePath}${workoutID}`).remove();
  alert('Workout deleted successfully!');
  loadWorkouts();
}

async function loadCategories(type) {
  currentExerciseType = type;
  const refPath = `/${type}/`;
  const snapshot = await window.database.ref(refPath).once('value');
  const selector = categorySelector;

  if (!selector) return;

  selector.innerHTML = '';
  if (snapshot.exists()) {
    const categories = Object.keys(snapshot.val());
    categories.forEach((cat) => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      selector.appendChild(option);
    });
    currentExerciseCategory = categories[0];
    loadExercisesEditor();
  } else {
    selector.innerHTML = '<option value="">No categories</option>';
    currentExerciseCategory = null;
    document.getElementById('exerciseeditorsection').innerHTML = '<p>No exercises found.</p>';
  }
}

async function loadExercisesEditor() {
  if (!currentExerciseCategory) return;
  const refPath = `/${currentExerciseType}/${currentExerciseCategory}`;
  const snapshot = await window.database.ref(refPath).once('value');

  if (snapshot.exists()) {
    exerciseKeys = Object.keys(snapshot.val()).filter((key) => key !== 'note');
    currentExerciseIndex = 0;
    displayExercise();
  } else {
    document.getElementById('exerciseeditorsection').innerHTML = `<p>No data found at ${refPath}.</p>`;
  }
}

async function displayExercise() {
  if (!exerciseKeys.length) return;
  const exerciseID = exerciseKeys[currentExerciseIndex];
  const refPath = `/${currentExerciseType}/${currentExerciseCategory}/${exerciseID}`;
  const snapshot = await window.database.ref(refPath).once('value');
  const data = snapshot.val();

  let editorHTML = '';
  if (data) {
    editorHTML += '<h3>Exercise Info</h3>';
    editorHTML += `
      <label style="display:inline-block; width:50px;">Name:</label>
      <input type="text" id="exercise_name" value="${data.name || ''}"><br>
      <label style="display:inline-block; width:50px;">Note:</label>
      <input type="text" id="exercise_note" value="${data.note || ''}"><br>
      <p>Exercise ${currentExerciseIndex + 1} of ${exerciseKeys.length}</p>
    `;
  } else {
    editorHTML = '<p>No data for this exercise.</p>';
  }

  document.getElementById('exerciseeditorsection').innerHTML = editorHTML;
}

function prevExo() {
  if (!exerciseKeys.length) return;
  currentExerciseIndex = (currentExerciseIndex - 1 + exerciseKeys.length) % exerciseKeys.length;
  displayExercise();
}

function nextExo() {
  if (!exerciseKeys.length) return;
  currentExerciseIndex = (currentExerciseIndex + 1) % exerciseKeys.length;
  displayExercise();
}

async function saveExo() {
  if (!exerciseKeys.length) return;
  const exerciseID = exerciseKeys[currentExerciseIndex];
  const refPath = `/${currentExerciseType}/${currentExerciseCategory}/${exerciseID}`;
  const updatedData = {
    name: document.getElementById('exercise_name')?.value || '',
    note: document.getElementById('exercise_note')?.value || '',
  };

  await window.database.ref(refPath).update(updatedData);

  if (typeSelector.value === 'focusareas') {
    const selectedFocusArea = categorySelector.value;
    const notesTextarea = document.getElementById('notesInput');
    if (selectedFocusArea && notesTextarea) {
      await window.database.ref('focusareas').child(selectedFocusArea).update({ note: notesTextarea.value });
    }
  }

  alert('Exercise updated successfully!');
  displayExercise();
}

async function deleteExo() {
  if (!exerciseKeys.length) return;
  if (!confirm('Are you sure you want to delete this exercise?')) return;
  const exerciseID = exerciseKeys[currentExerciseIndex];
  const refPath = `/${currentExerciseType}/${currentExerciseCategory}/${exerciseID}`;
  await window.database.ref(refPath).remove();
  exerciseKeys.splice(currentExerciseIndex, 1);
  if (currentExerciseIndex >= exerciseKeys.length) {
    currentExerciseIndex = Math.max(exerciseKeys.length - 1, 0);
  }
  alert('Exercise deleted successfully!');
  displayExercise();
}

function loadFocusAreaNote() {
  exerciseNotesSection.innerHTML = '';
  if (!categorySelector.value) return;

  const notesTextarea = document.createElement('textarea');
  notesTextarea.id = 'notesInput';
  notesTextarea.style.width = '450px';
  notesTextarea.style.height = '100px';
  notesTextarea.style.marginTop = '10px';

  window.database.ref('focusareas').child(categorySelector.value).once('value', (snapshot) => {
    const data = snapshot.val();
    if (data && typeof data === 'object' && data.note) {
      notesTextarea.value = data.note;
    } else {
      notesTextarea.value = '';
      notesTextarea.placeholder = `Notes for ${categorySelector.value}`;
    }
  });

  exerciseNotesSection.appendChild(notesTextarea);
}

async function populateWorkoutYears() {
  const snapshot = await window.database.ref('workouts').once('value');
  const workouts = snapshot.val();
  const years = new Set();

  if (workouts) {
    Object.values(workouts).forEach((workout) => {
      if (workout.date) {
        const year = workout.date.split('-')[0];
        if (year) years.add(year);
      }
    });
  }

  const sortedYears = Array.from(years).sort().reverse();
  const currentYear = new Date().getFullYear().toString();

  workoutYearFilterElement.innerHTML = '<option value="all">All years</option>';
  sortedYears.forEach((year) => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    if (year === currentYear) {
      option.selected = true;
    }
    workoutYearFilterElement.appendChild(option);
  });
}

function renderSavedWorkouts() {
  window.database.ref('workouts').once('value', (snapshot) => {
    const workouts = snapshot.val();
    savedWorkoutList.innerHTML = '';
    if (!workouts) return;

    const selectedYear = workoutYearFilterElement?.value || 'all';

    // Collect and filter workouts
    const workoutEntries = Object.entries(workouts)
      .filter(([, workout]) => {
        if (!workout) return false;

        if (selectedYear !== 'all' && workout.date) {
          const workoutYear = workout.date.split('-')[0];
          if (workoutYear !== selectedYear) return false;
        }

        return true;
      })
      // Sort by date descending (most recent first)
      .sort(([, a], [, b]) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
      });

    workoutEntries.forEach(([workoutId, workout]) => {
      const workoutDiv = document.createElement('div');
      workoutDiv.className = 'saved-workout';
      const date = workout.date || '';
      const intensity = workout.intensity ? `Intensity: ${workout.intensity}/10` : '';
      const intensityNote = workout.intensityNote ? `${workout.intensityNote}` : '';
      const duration = workout.duration ? `${workout.duration}` : '';
      const exercises = (workout.exercises || [])
        .map((e) => {
          const setsRepsText = (e.sets || e.reps)
            ? `${e.sets ? `${e.sets} sets` : ''} ${e.reps ? `x ${e.reps} reps` : ''}`.trim()
            : '';
          const noteText = e.note ? ` ${e.note}` : '';
          return `<span style="color: blue;">${e.name}</span>: ${setsRepsText}<span style="color: red;">${noteText}</span>`;
        })
        .join('<br>');
      const result = workout.result ? `<br><span style="color: darkorange;">Result: ${workout.result}</span>` : '';

      workoutDiv.innerHTML = `
        <p><strong>Workout on ${date}</strong><br>
          <span style="color: green;">${intensity}${intensity ? ' &nbsp;&nbsp; ' : ''}${duration} ${intensityNote ? `${intensityNote}<br>` : '<br>'}</span>
          ${exercises}${result}
        </p>
      `;
      savedWorkoutList.appendChild(workoutDiv);
    });
  });
}

function toggleSavedWorkouts() {
  if (!savedWorkoutList.classList.contains('hidden')) {
    savedWorkoutList.innerHTML = '';
    savedWorkoutList.classList.add('hidden');
    workoutButton.textContent = 'Show workouts';
    workoutYearFilterElement.style.display = 'none';
  } else {
    renderSavedWorkouts();
    savedWorkoutList.classList.remove('hidden');
    workoutButton.textContent = 'Hide workouts';
    workoutYearFilterElement.style.display = 'inline';
  }
}

function checkLastWorkoutResult() {
  window.database.ref('workouts').orderByChild('date').limitToLast(1).once('value', (snapshot) => {
    snapshot.forEach((child) => {
      const workout = child.val();
      const workoutKey = child.key;
      if (!workout.result || workout.result.trim() === '') {
        const date = workout.date || 'recently';
        const input = document.getElementById('lastworkoutresult');
        const resultSection = document.getElementById('resultsection');
        input.placeholder = `How did you feel after your workout on ${date}?`;
        input.dataset.key = workoutKey;
        resultSection.classList.remove('hidden');
      }
    });
  });
}

function saveLastWorkoutResult() {
  const input = document.getElementById('lastworkoutresult');
  const workoutKey = input.dataset.key;
  const result = input.value.trim();

  if (!result) {
    alert('Please enter how you felt!');
    return;
  }

  window.database.ref(`workouts/${workoutKey}`).update({ result }, (error) => {
    if (error) {
      console.error('Error saving result:', error);
    } else {
      document.getElementById('resultsection').classList.add('hidden');
    }
  });
}

export function initEditorManager() {
  document.getElementById('workoutPrevBtn').addEventListener('click', prevNode);
  document.getElementById('workoutNextBtn').addEventListener('click', nextNode);
  document.getElementById('addPastExerciseBtn').addEventListener('click', addPastExercise);
  document.getElementById('saveChangesBtn').addEventListener('click', saveChanges);
  document.getElementById('deleteWorkoutBtn').addEventListener('click', deleteWorkout);
  document.getElementById('exoPrevBtn').addEventListener('click', prevExo);
  document.getElementById('exoNextBtn').addEventListener('click', nextExo);
  document.getElementById('saveExoBtn').addEventListener('click', saveExo);
  document.getElementById('deleteExoBtn').addEventListener('click', deleteExo);

  typeSelector.addEventListener('change', (e) => {
    loadCategories(e.target.value);
    if (e.target.value === 'focusareas') {
      loadFocusAreaNote();
    } else {
      exerciseNotesSection.innerHTML = '';
    }
  });

  categorySelector.addEventListener('change', (e) => {
    currentExerciseCategory = e.target.value;
    loadExercisesEditor();
    if (currentExerciseType === 'focusareas') {
      loadFocusAreaNote();
    }
  });

  workoutButton.addEventListener('click', toggleSavedWorkouts);
  workoutYearFilterElement.addEventListener('change', renderSavedWorkouts);
  saveLastWorkoutBtn.addEventListener('click', saveLastWorkoutResult);

  loadWorkouts();
  loadCategories(currentExerciseType);
  populateWorkoutYears();
  renderSavedWorkouts();
  checkLastWorkoutResult();
}

export function refreshSavedWorkouts() {
  renderSavedWorkouts();
}
