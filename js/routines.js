// Routines and collections: named lists of exercises, edited in their own panels under
// Exercises (Routines / Collections buttons) and listed in their own modes of the workout
// builder's exercise dropdown (see renderExercisePickerOptions in app.js).
//
//   Routines    routines/{id}     Pick one in the dropdown and press Add: all its exercises load.
//   Collections collections/{id}  Groups of exercises kept out of the regular dropdown (e.g. rehab
//                                 or stretches); they're picked one at a time from Collections mode.
//
// Both are stored as { name, exercises: [{ id, name }], updatedAt }. The exercise name is kept so
// a list still reads sensibly if one of its exercises is later deleted.

function normalizeListExercises(exercises) {
  const list = Array.isArray(exercises) ? exercises : Object.values(exercises || {});
  return list
    .filter((exercise) => exercise && typeof exercise.id === 'string' && exercise.id)
    .map((exercise) => ({ id: exercise.id, name: String(exercise.name || '').trim() }));
}

// Every exercise in the dropdown, by category then name
function getListExerciseChoices() {
  return Array.from(exerciseSelect.options)
    .filter((option) => option.value)
    .map((option) => ({ id: option.value, name: option.text, category: getExerciseOptionCategory(option) }))
    .sort((a, b) => a.category.localeCompare(b.category, undefined, { sensitivity: 'base' })
      || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

// One editable set of lists. `key` names the elements (routineList, saveRoutineBtn, …) and the
// database path (`${key}s`); `noun` is how it's written in messages; `addPlaceholder` is the
// first line of the "add an existing exercise" dropdown. Elements that aren't on the page
// (e.g. Copy from current workout for collections) are simply skipped.
function createExerciseListManager({ key, noun, addPlaceholder = 'Add exercise…' }) {
  const Key = key[0].toUpperCase() + key.slice(1);
  const $ = (id) => document.getElementById(id);
  const el = {
    list: $(`${key}List`),
    editor: $(`${key}Editor`),
    editorEmpty: $(`${key}EditorEmpty`),
    nameInput: $(`${key}NameInput`),
    hint: $(`${key}Hint`),
    exerciseList: $(`${key}ExerciseList`),
    exerciseSelect: $(`${key}ExerciseSelect`),
    fromBuilderBtn: $(`${key}FromBuilderBtn`),
    saveBtn: $(`save${Key}Btn`),
    deleteBtn: $(`delete${Key}Btn`),
    newBtn: $(`new${Key}Btn`),
    // Collections only: create a new exercise straight into the list
    newExerciseInput: $(`${key}NewExerciseInput`),
    newExerciseBtn: $(`${key}NewExerciseBtn`),
    newExerciseFields: $(`${key}NewExerciseTrackFields`)
  };
  const path = `${key}s`;
  let itemsById = {};
  // The list being edited: id is null for a new one that hasn't been saved yet
  let draft = null;
  let dirty = false;

  function getSorted() {
    return Object.entries(itemsById)
      .filter(([, item]) => item && typeof item.name === 'string' && item.name.trim())
      .map(([id, item]) => ({ id, name: item.name.trim(), exercises: normalizeListExercises(item.exercises) }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  async function load() {
    try {
      itemsById = (await database.ref(path).once('value')).val() || {};
    } catch (error) {
      console.error(`Error loading ${path}:`, error);
      itemsById = {};
    }
    renderExercisePickerOptions();
    renderList();
  }

  function showHint(message) {
    el.hint.textContent = message;
    el.hint.hidden = !message;
  }

  function render() {
    renderList();
    renderEditor();
  }

  // Opening the panel starts with nothing selected
  function reset() {
    draft = null;
    dirty = false;
    showHint('');
    render();
  }

  function renderList() {
    if (!el.list) return;
    const items = getSorted();
    el.list.replaceChildren();
    if (!items.length && !(draft && !draft.id)) {
      const empty = document.createElement('div');
      empty.className = 'settings-empty';
      empty.textContent = `No ${noun}s yet`;
      el.list.appendChild(empty);
      return;
    }
    items.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'routine-list-item';
      button.setAttribute('role', 'listitem');
      button.dataset.itemId = item.id;
      button.classList.toggle('active', draft?.id === item.id);
      button.innerHTML = '<span class="routine-list-name"></span><span class="routine-list-count"></span>';
      button.querySelector('.routine-list-name').textContent = item.name;
      button.querySelector('.routine-list-count').textContent = String(item.exercises.length);
      button.title = `${item.exercises.length} exercise${item.exercises.length === 1 ? '' : 's'}`;
      el.list.appendChild(button);
    });
    if (draft && !draft.id) {
      const pending = document.createElement('div');
      pending.className = 'routine-list-item active routine-list-new';
      pending.textContent = draft.name.trim() || `New ${noun}`;
      el.list.appendChild(pending);
    }
  }

  function renderEditor() {
    if (!el.editor) return;
    el.editor.hidden = !draft;
    if (el.editorEmpty) el.editorEmpty.hidden = Boolean(draft);
    if (!draft) return;

    if (document.activeElement !== el.nameInput) el.nameInput.value = draft.name;
    el.deleteBtn.hidden = !draft.id;
    el.saveBtn.disabled = !dirty;

    // The exercises, in order, each with move and remove buttons
    const knownIds = new Set(Array.from(exerciseSelect.options).map((option) => option.value).filter(Boolean));
    el.exerciseList.replaceChildren();
    if (!draft.exercises.length) {
      const empty = document.createElement('li');
      empty.className = 'routine-exercise-empty';
      empty.textContent = 'No exercises yet. Add some below.';
      el.exerciseList.appendChild(empty);
    }
    draft.exercises.forEach((exercise, index) => {
      const option = findExerciseOption(exercise.id);
      const item = document.createElement('li');
      item.className = 'routine-exercise';
      item.innerHTML = `<span class="routine-exercise-name"></span>
        <span class="routine-exercise-buttons">
          <button type="button" class="exo-btn exo-btn-sm" data-move="-1" data-index="${index}" aria-label="Move up"${index === 0 ? ' disabled' : ''}>▲</button>
          <button type="button" class="exo-btn exo-btn-sm" data-move="1" data-index="${index}" aria-label="Move down"${index === draft.exercises.length - 1 ? ' disabled' : ''}>▼</button>
          <button type="button" class="exo-btn exo-btn-sm exo-btn-danger" data-remove data-index="${index}" aria-label="Remove">×</button>
        </span>`;
      const name = item.querySelector('.routine-exercise-name');
      name.textContent = option ? option.text : (exercise.name || 'Unknown exercise');
      if (!knownIds.has(exercise.id)) {
        item.classList.add('routine-exercise-missing');
        name.title = 'This exercise no longer exists, so it will be skipped';
        name.textContent += ' (deleted)';
      }
      el.exerciseList.appendChild(item);
    });

    // "Add exercise…" lists the exercises not already in the list, grouped by category
    const included = new Set(draft.exercises.map((exercise) => exercise.id));
    el.exerciseSelect.replaceChildren(new Option(addPlaceholder, ''));
    let group = null;
    getListExerciseChoices().forEach((choice) => {
      if (included.has(choice.id)) return;
      if (!group || group.label !== choice.category) {
        group = document.createElement('optgroup');
        group.label = choice.category;
        el.exerciseSelect.appendChild(group);
      }
      group.appendChild(new Option(choice.name, choice.id));
    });
    el.exerciseSelect.value = '';
    if (el.fromBuilderBtn) el.fromBuilderBtn.disabled = !selectedExercises.some((exercise) => !included.has(exercise.id));
  }

  function markDirty() {
    dirty = true;
    showHint('');
    renderEditor();
  }

  // Leaving a list with unsaved changes asks first, in place of the button that was clicked
  async function confirmLeave(button) {
    if (!draft || !dirty) return true;
    return confirmInPlace(button, { question: 'Discard unsaved changes?', yesLabel: 'Discard', noLabel: 'Keep editing' });
  }

  function open(id) {
    const item = getSorted().find((entry) => entry.id === id);
    draft = item
      ? { id: item.id, name: item.name, exercises: item.exercises.map((exercise) => ({ ...exercise })) }
      : { id: null, name: '', exercises: [] };
    dirty = false;
    showHint('');
    render();
  }

  el.newBtn?.addEventListener('click', async () => {
    if (!(await confirmLeave(el.newBtn))) return;
    open(null);
    el.nameInput.focus();
  });

  el.list?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-item-id]');
    if (!button) return;
    const id = button.dataset.itemId;
    if (!(await confirmLeave(button))) return;
    // Clicking the open one closes it
    if (id === draft?.id) reset();
    else open(id);
  });

  el.nameInput?.addEventListener('input', () => {
    draft.name = el.nameInput.value;
    markDirty();
    renderList(); // a new list's entry shows its name as it's typed
  });
  el.nameInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!el.saveBtn.disabled) el.saveBtn.click();
    }
  });

  el.exerciseSelect?.addEventListener('change', () => {
    const option = el.exerciseSelect.selectedOptions[0];
    if (!option || !option.value) return;
    draft.exercises.push({ id: option.value, name: option.text });
    markDirty();
    el.exerciseSelect.focus();
  });

  el.fromBuilderBtn?.addEventListener('click', () => {
    const included = new Set(draft.exercises.map((exercise) => exercise.id));
    selectedExercises.forEach((exercise) => {
      if (!exercise?.id || included.has(exercise.id)) return;
      draft.exercises.push({ id: exercise.id, name: exercise.name || '' });
      included.add(exercise.id);
    });
    markDirty();
  });

  el.exerciseList?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-index]');
    if (!button || !draft) return;
    const index = Number(button.dataset.index);
    if (button.hasAttribute('data-remove')) {
      draft.exercises.splice(index, 1);
    } else {
      const target = index + Number(button.dataset.move);
      if (target < 0 || target >= draft.exercises.length) return;
      [draft.exercises[index], draft.exercises[target]] = [draft.exercises[target], draft.exercises[index]];
    }
    markDirty();
    // Keep focus on the same kind of button so repeated moves are easy
    const moved = button.dataset.move ? index + Number(button.dataset.move) : index;
    el.exerciseList.querySelector(`button[data-index="${moved}"]${button.dataset.move ? `[data-move="${button.dataset.move}"]` : '[data-remove]'}:not(:disabled)`)?.focus();
  });

  // The list's name, or a hint saying what's wrong with it
  function checkName() {
    const name = draft.name.trim();
    if (!name) {
      showHint(`Give the ${noun} a name.`);
      el.nameInput.focus();
      return null;
    }
    const duplicate = getSorted().find((item) => item.id !== draft.id && item.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      showHint(`There's already a ${noun} called ${duplicate.name}.`);
      el.nameInput.focus();
      return null;
    }
    return name;
  }

  // Saves the draft; returns true when it worked
  async function persist(name) {
    const id = draft.id || database.ref(path).push().key;
    const item = { name, exercises: draft.exercises.map(({ id: exerciseId, name: exerciseName }) => ({ id: exerciseId, name: exerciseName })), updatedAt: Date.now() };
    el.saveBtn.disabled = true;
    try {
      await database.ref(`${path}/${id}`).set(item);
      itemsById[id] = item;
      draft = { id, name, exercises: item.exercises.map((exercise) => ({ ...exercise })) };
      dirty = false;
      renderExercisePickerOptions();
      render();
      return true;
    } catch (error) {
      console.error(`Error saving ${noun}:`, error);
      showNotice(`Could not save the ${noun}: ${error.message}`, 'error');
      el.saveBtn.disabled = false;
      return false;
    }
  }

  el.saveBtn?.addEventListener('click', async () => {
    if (!draft) return;
    const name = checkName();
    if (!name) return;
    if (!draft.exercises.length) {
      showHint('Add at least one exercise.');
      return;
    }
    if (await persist(name)) showNotice(`Saved ${name}`, 'success');
  });

  // New exercise straight into the list. It's created right away (under the list's name as its
  // category, tracking what's ticked under the name box) and the list is saved with it, so the
  // exercise never shows up loose in the main exercise list.
  async function addNewExercise() {
    if (!draft || !el.newExerciseInput) return;
    const exerciseName = el.newExerciseInput.value.trim();
    if (!exerciseName) return el.newExerciseInput.focus();
    const listName = checkName();
    if (!listName) return;
    if (getExistingExerciseNames().has(exerciseName.toLowerCase())) {
      showHint(`You already have "${exerciseName}". Move it in with the dropdown below instead.`);
      return el.newExerciseInput.focus();
    }

    el.newExerciseBtn.disabled = true;
    try {
      const created = await postToWorkoutApi('/api/exercises', {
        name: exerciseName, category: listName, variations: [], focusAreas: [], ...readTrackFields(el.newExerciseFields)
      });
      draft.exercises.push({ id: created.id, name: exerciseName });
      await loadExercises(); // so the new exercise is in the dropdowns
      if (typeof refreshExerciseEditor === 'function') refreshExerciseEditor();
      if (await persist(listName)) {
        showNotice(`Added ${exerciseName} to ${listName}`, 'success');
        el.newExerciseInput.value = '';
        resetTrackFields(el.newExerciseFields);
        el.newExerciseInput.focus();
      }
    } catch (error) {
      console.error('Error adding exercise:', error);
      showNotice(`Could not add the exercise: ${error.message}`, 'error');
    } finally {
      el.newExerciseBtn.disabled = false;
    }
  }

  el.newExerciseBtn?.addEventListener('click', addNewExercise);
  el.newExerciseInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); addNewExercise(); }
  });
  el.newExerciseInput?.addEventListener('input', () => showHint(''));

  el.deleteBtn?.addEventListener('click', async () => {
    if (!draft?.id) return;
    const { id, name } = draft;
    if (!(await confirmInPlace(el.deleteBtn, { question: `Delete ${name}?`, yesLabel: 'Delete', noLabel: 'Cancel' }))) return;
    try {
      await database.ref(`${path}/${id}`).remove();
      delete itemsById[id];
      draft = null;
      dirty = false;
      renderExercisePickerOptions();
      render();
      showNotice(`Deleted ${name}`, 'success');
    } catch (error) {
      console.error(`Error deleting ${noun}:`, error);
      showNotice(`Could not delete the ${noun}: ${error.message}`, 'error');
    }
  });

  return { getSorted, load, reset, render };
}

const routineLists = createExerciseListManager({ key: 'routine', noun: 'routine' });
const collectionLists = createExerciseListManager({ key: 'collection', noun: 'collection', addPlaceholder: 'Or move in an existing exercise…' });

// ---- Used by app.js ----

function resetRoutinesPanel() { routineLists.reset(); }
// After an exercise is renamed or merged (app.js), re-read both from the database
function reloadExerciseLists() { routineLists.load(); collectionLists.load(); }
function resetCollectionsPanel() { collectionLists.reset(); }

// Routines mode of the exercise dropdown
function getRoutinePickerEntries() {
  return routineLists.getSorted().map((routine) => ({ id: routine.id, name: routine.name, exerciseCount: routine.exercises.length }));
}

// Collections mode of the exercise dropdown: each collection and its exercise ids, in order
function getCollectionPickerEntries() {
  return collectionLists.getSorted().map((collection) => ({ id: collection.id, name: collection.name, exerciseIds: collection.exercises.map((exercise) => exercise.id) }));
}

// Exercises that belong to a collection, kept out of the regular dropdown modes
function getCollectionExerciseIds() {
  return new Set(collectionLists.getSorted().flatMap((collection) => collection.exercises.map((exercise) => exercise.id)));
}

// Pressing Add with a routine picked: all its exercises go into the workout builder
function loadRoutineIntoBuilder(routineId) {
  const routine = routineLists.getSorted().find((entry) => entry.id === routineId);
  if (!routine) {
    showNotice('That routine no longer exists', 'error');
    return;
  }

  let added = 0;
  let alreadyThere = 0;
  const missing = [];
  routine.exercises.forEach(({ id, name }) => {
    if (selectedExercises.some((exercise) => exercise.id === id)) {
      alreadyThere++;
      return;
    }
    const option = findExerciseOption(id);
    if (!option) {
      missing.push(name || 'an exercise');
      return;
    }
    selectedExercises.push(createBuilderExercise(id, option.text, getExerciseOptionCategory(option)));
    added++;
  });

  renderExerciseList();
  saveWorkoutDraft();
  if (added && autoStartClock) beginClock();

  const parts = [`Added ${added} exercise${added === 1 ? '' : 's'} from ${routine.name}`];
  if (alreadyThere) parts.push(`${alreadyThere} already in the workout`);
  if (missing.length) parts.push(`not found: ${missing.join(', ')}`);
  showNotice(parts.join('; '), missing.length || !added ? 'error' : 'success');
}

routineLists.load();
collectionLists.load();
