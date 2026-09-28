
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
  database
    .ref('access_logs/start_time')
    .once('value')
    .then((snapshot) => {
      const lastStartTime = snapshot.val();
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
      console.error('Error retrieving start_time:', error);
    });
}




// Listen for the validate button click
validateBtn.addEventListener('click', () => {
  if (!startTime) {
    // If the clock is not already running, initialize it
    startTime = Date.now();
    elapsedTime = 0;

    database
      .ref('access_logs/start_time')
      .set(startTime)
      .then(() => {
        startClock();

        // Show the pause and reset buttons' parent divs
        pauseDiv.style.display = 'block';
        resetDiv.style.display = 'block';


      })
      .catch((error) => {
        console.error('Error updating start_time:', error);
      });
  }
});

// Listen for the pause button click
pauseBtn.addEventListener('click', () => {
  if (paused) {
    // Resume the clock
    paused = false;
    startTime = Date.now() - elapsedTime; // Adjust the start time to account for elapsed time
    pauseBtn.textContent = 'Pause';
    startClock(); // Restart the clock
  } else {
    // Pause the clock
    paused = true;
    elapsedTime = Date.now() - startTime; // Store the elapsed time
    clearInterval(timerInterval); // Stop the clock ticking
    pauseBtn.textContent = 'Resume';
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
  database
    .ref('access_logs/start_time')
    .remove()
    .catch((error) => {
      console.error('Error clearing start_time:', error);
    });
});

// On page load, check if the button was clicked in the last 3 hours
document.addEventListener('DOMContentLoaded', () => {
  // Hide pause and reset buttons by default
  pauseDiv.style.display = 'none';
  resetDiv.style.display = 'none';

  // Check the last clock state
  checkLastClick();
});

//////////////////////////////////////////////////////////////////////////// Clock timer fuctionality

//-////////////////////////////////////////////////////////////////////////// Creating exercises, editing workouts, exercise list
// DOM Elements
const exerciseSelect = document.getElementById('exerciseSelect');
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

const selectedExercises = [];

// Firebase reference for workout drafts
const workoutDraftRef = database.ref('workoutDraft');

// Current workout intensity
let currentWorkout = { intensity: '', intensityNote: '' };

// Toggle focus area selection visibility
focusCheckbox.addEventListener('change', () => {
    focusContainer.style.display = focusCheckbox.checked ? 'block' : 'none';
});

// Clear dropdown options
function clearDropdown() {
    exerciseSelect.innerHTML = '';
}

// Function to load exercises dynamically based on checkbox state
function loadExercises() {
  const useFocusAreas = document.getElementById("seefocusCheckbox").checked;
  const exercisesRef = database.ref(useFocusAreas ? 'focusareas' : 'exercises');

  exercisesRef.once('value', (snapshot) => {
      const data = snapshot.val();
      renderExerciseDropdown(data || {}, useFocusAreas); // Pass data and mode
  });
}

// Load focus areas dynamically, including an "Add New Focus Area" option
function loadFocusAreas() {
  focusCategory.innerHTML = ""; 

  database.ref("focusareas").once("value", snapshot => {
      snapshot.forEach(childSnapshot => {
          const focusArea = childSnapshot.key;

          const option = document.createElement("option");
          option.value = focusArea;
          option.textContent = focusArea;
          focusCategory.appendChild(option);
      });

      // Add "Add New Focus Area" option at the end
      const addOption = document.createElement("option");
      addOption.value = "addNew";
      addOption.textContent = "➕ Add New Focus Area";
      focusCategory.appendChild(addOption);
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
                  // Add to Firebase
                  database.ref(`focusareas/${sanitizedFocusArea}`).set(true);

                  // Add to dropdown
                  const newOption = document.createElement("option");
                  newOption.value = sanitizedFocusArea;
                  newOption.textContent = sanitizedFocusArea;
                  focusCategory.insertBefore(newOption, focusCategory.lastElementChild);

                  // Select the newly added option
                  newOption.selected = true;
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

// Load exercises & focus areas on page load
window.onload = () => {
  loadExercises();
  loadFocusAreas();
};



// Save new exercise to Firebase when created
saveNewExerciseBtn.addEventListener('click', () => {
    const name = newExerciseName.value.trim();
    const category = exerciseCategory.value;
    const selectedFocusAreas = focusCheckbox.checked
        ? Array.from(focusCategory.selectedOptions).map(opt => opt.value)
        : [];

    if (!name) {
        alert('Please enter an exercise name.');
        return;
    }

    saveExerciseToDatabase(name, category, selectedFocusAreas);
    newExerciseName.value = ''; 
    alert('Exercise added successfully!');
});

// Function to save an exercise in Firebase
function saveExerciseToDatabase(name, category, focusAreas) {
    const exerciseData = { name };
    let newExerciseKey = null;

    // Save under main category only if not "None"
    if (category !== "None") {
        const exercisesRef = database.ref(`exercises/${category}`);
        const newExerciseRef = exercisesRef.push();
        newExerciseKey = newExerciseRef.key;
        newExerciseRef.set(exerciseData);
    }

    // Save under focus areas only if checkbox is checked
    if (newExerciseKey && focusAreas.length > 0) {
        focusAreas.forEach(focus => {
            database.ref(`focusareas/${focus}/${newExerciseKey}`).set(exerciseData);
        });
    }
}

// Prevent duplicate exercise addition
addExerciseBtn.addEventListener('click', () => {
    const selectedOption = exerciseSelect.options[exerciseSelect.selectedIndex];
    const exerciseId = selectedOption.value;
    const exerciseName = selectedOption.text;

    if (!exerciseId || selectedExercises.some(e => e.id === exerciseId)) {
        alert("Exercise already exists");
        return;
    }

    selectedExercises.push({ id: exerciseId, name: exerciseName, sets: 0, reps: 0, note: '', showSR: false });

    renderExerciseList();
    saveWorkoutDraft();
});

let dropdownContent = []; // Global variable to store the generated dropdown content

function renderExerciseDropdown(exercises, fromFocusAreas = false) {
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
    return;
  }

  dropdownContent = [];  // Reset the global variable before generating new content

  // Loop through categories in the exercises object
  for (const category in exercises) {
    if (!category || typeof category !== "string" || category.toLowerCase() === "none" || !category.trim()) {
      console.warn("⚠️ Skipping empty or 'none' category:", category);
      continue;
    }

    // Create an optgroup for each category
    const optgroup = document.createElement("optgroup");
    optgroup.label = category.replace("_", " ").toUpperCase();

    // Loop through exercises within the category
    for (const exerciseId in exercises[category]) {
      const exercise = exercises[category][exerciseId];

      // Validate exercise object and name
      if (!exercise || typeof exercise !== "object" || !exercise.name || typeof exercise.name !== "string" || exercise.name.toLowerCase() === "none" || !exercise.name.trim()) {
        console.warn("⚠️ Skipping invalid exercise:", exercise);
        continue;
      }

      // Create an option for each exercise
      const option = document.createElement("option");
      option.value = exerciseId;
      option.textContent = exercise.name;
      optgroup.appendChild(option);
    }

    // Append the optgroup to the global content array (for reuse)
    dropdownContent.push(optgroup);

    // Also append the optgroup to the original dropdown
    exerciseSelect.appendChild(optgroup);
  }

  console.log("✅ Dropdown updated successfully.");
}



// Listen for focus area checkbox toggle and reload exercises
document.getElementById("seefocusCheckbox").addEventListener("change", loadExercises);



////////// Here is functionality for viewing and editing past workout fields

// 📌 Look inside "/workouts/"
var basePath = "/workouts/";
var workoutKeys = [];
var currentIndex = 0;

//  Load all workout node keys
function loadWorkouts() {
    database.ref(basePath).once("value").then(snapshot => {
        if (snapshot.exists()) {
            workoutKeys = Object.keys(snapshot.val());
            console.log("Workout Keys:", workoutKeys); // DEBUG LOG

            if (workoutKeys.length > 0) {
                currentIndex = 0;
                displayCurrentNode();
            } else {
                document.getElementById("fields").innerHTML = "<p>No workouts found.</p>";
            }
        } else {
            console.log("No data found at", basePath);
        }
    }).catch(error => console.error("Error fetching workouts:", error));
}

// Display current workout node
function displayCurrentNode() {
    if (workoutKeys.length === 0) return;

    var workoutID = workoutKeys[currentIndex];
    var fullPath = basePath + workoutID;
    
    console.log("Fetching data from:", fullPath); // DEBUG LOG

    database.ref(fullPath).once("value").then(snapshot => {
        var data = snapshot.val();
        console.log("Data received:", data); // DEBUG LOG
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
                fieldsHTML += `
                    <label style="display:inline-block; width:50px";>Name: </label>
                    <input type="text" id="name_${index}" value="${exercise.name}"><button class="btn btn-danger btn-sm" style="margin-left: 10px;" onclick="deleteExercise(${index})">X</button><br>

                    <label style="display:inline-block; width:50px";>Note: </label>
                    <input type="text" id="note_${index}" value="${exercise.note}"><br>
                    <label style="display:inline-block; width:50px";>Sets: </label>
                    <input type="number" id="sets_${index}" value="${exercise.sets}"><br>
                    <label style="display:inline-block; width:50px";>Reps: </label>
                    <input type="number" id="reps_${index}" value="${exercise.reps}"><br><br>

                `;
            });
        }

        document.getElementById("fields").innerHTML = fieldsHTML || "<p>No exercises found.</p>";
    }).catch(error => console.error("Error fetching node data:", error));
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
  // Count existing exercise fields by counting inputs with IDs starting with "name_"
  var index = document.querySelectorAll("#fields input[id^='name_']").length;
  
  // Build the new exercise fields HTML with aligned fields and default 0 for sets/reps
  var newExerciseHTML = `
      <div class="exercise-entry" style="margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
          <div>
              <label style="display:inline-block; width:50px;">Name:</label>
              <input type="text" id="name_${index}" value=""><button class="btn btn-danger btn-sm" style="margin-left: 10px;" onclick="deleteExercise(${index})">X</button><br>

              <label style="display:inline-block; width:50px;">Note:</label>
              <input type="text" id="note_${index}" value="">
<br>
              <label style="display:inline-block; width:50px;">Sets:</label>
              <input type="number" id="sets_${index}" value="0">
<br>
              <label style="display:inline-block; width:50px;">Reps:</label>
              <input type="number" id="reps_${index}" value="0">
          </div>
      </div>
  `;
  
  // Append the new exercise block to the editor form
  document.getElementById("fields").insertAdjacentHTML("beforeend", newExerciseHTML);
}



//  Save changes (Workout + Exercises)
function saveChanges() {
    var workoutID = workoutKeys[currentIndex];
    var fullPath = basePath + workoutID;

    // Collect updated workout-level fields
    var workoutUpdates = {};
    var workoutInputs = document.querySelectorAll("#fields input[id^='workout_']");
    workoutInputs.forEach(input => {
        var field = input.id.replace("workout_", "");
        workoutUpdates[field] = input.value;
    });

    // Collect updated exercises
    var exerciseUpdates = [];
    var numExercises = (document.querySelectorAll("#fields input[id^='name_']").length);
    
    for (var i = 0; i < numExercises; i++) {
        exerciseUpdates.push({
            name: document.getElementById(`name_${i}`).value,
            note: document.getElementById(`note_${i}`).value,
            sets: parseInt(document.getElementById(`sets_${i}`).value, 10),
            reps: parseInt(document.getElementById(`reps_${i}`).value, 10)
        });
    }

    // Update Firebase
    database.ref(fullPath).update(workoutUpdates) // Update workout-level fields
        .then(() => database.ref(fullPath + "/exercises").set(exerciseUpdates)) // Update exercises
        .then(() => alert("Changes saved!"))
        .catch(error => alert("Error: " + error.message));

document.getElementById("showeditorbtn").addEventListener("click", function() {
    displayCurrentNode(); // Refresh
});
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
      
      // Optionally clear the editor fields or update the UI.
      document.getElementById("editForm").innerHTML = "";
      document.getElementById("fields").innerHTML = "";
      
      // You might also want to update workoutKeys/currentIndex here
      // or refresh the list of workouts if needed.
    })
    .catch(error => {
      alert("Error deleting workout: " + error.message);
    });
}


loadWorkouts();



//////////////////////////////////////////////////////////////////////// Creating exercises, editing past workouts 

//-////////////////////////////////////////////////////////////////////// Exercise list editing
// Global variables for managing the current type, category, exercise keys, and index.
var currentExerciseType = "exercises"; // default type; user can change via typeSelector
var currentExerciseCategory = null;    // will be set by the category selector
var exerciseKeys = [];                 // Firebase keys for exercises in the selected category
var currentExerciseIndex = 0;

// Load available categories from the chosen root node (exercises or focusareas)
function loadCategories(type) {
  currentExerciseType = type;
  var refPath = "/" + type + "/";
  database.ref(refPath).once("value").then(snapshot => {
    if (snapshot.exists()) {
      var categories = Object.keys(snapshot.val());
      var selector = document.getElementById("categorySelector");
      if (selector) {
        // Clear previous options
        selector.innerHTML = "";
        categories.forEach(cat => {
          var option = document.createElement("option");
          option.value = cat;
          option.textContent = cat;
          selector.appendChild(option);
        });
        // Set the current category to the first one and load its exercises for the editor.
        currentExerciseCategory = categories[0];
        loadExercisesEditor();
      }
    } else {
      console.log("No categories found under " + refPath);
    }
  }).catch(error => console.error("Error loading categories:", error));
}

// Event listener for when the type selection changes.
document.getElementById("typeSelector").addEventListener("change", function(e) {
  loadCategories(e.target.value);
});

// Event listener for when the category selection changes.
document.getElementById("categorySelector").addEventListener("change", function(e) {
  currentExerciseCategory = e.target.value;
  loadExercisesEditor();
});

// Load exercises for the current type and category for the editor section.
function loadExercisesEditor() {
  if (!currentExerciseCategory) return;
  var refPath = "/" + currentExerciseType + "/" + currentExerciseCategory;
  console.log("Fetching exercises from:", refPath);
  
  database.ref(refPath).once("value").then(snapshot => {
    if (snapshot.exists()) {
      exerciseKeys = Object.keys(snapshot.val());
      console.log("Exercise Keys:", exerciseKeys); // DEBUG
      if (exerciseKeys.length > 0) {
        currentExerciseIndex = 0;
        displayExercise();
      } else {
        document.getElementById("exerciseeditorsection").innerHTML = "<p>No exercises found in this category.</p>";
      }
    } else {
      document.getElementById("exerciseeditorsection").innerHTML = `<p>No data found at ${refPath}.</p>`;
    }
  }).catch(error => console.error("Error fetching exercises:", error));
}

// Display the current exercise for editing/viewing.
function displayExercise() {
  if (exerciseKeys.length === 0) return;

  // Filter out the "note" key from exerciseKeys
  const filteredExerciseKeys = exerciseKeys.filter(key => key !== "note");

  // If there are no valid exercises, return
  if (filteredExerciseKeys.length === 0) {
    document.getElementById("exerciseeditorsection").innerHTML = "<p>No valid exercises available.</p>";
    return;
  }

  // Get the current exercise ID based on the filtered list
  var exerciseID = filteredExerciseKeys[currentExerciseIndex];
  var refPath = "/" + currentExerciseType + "/" + currentExerciseCategory + "/" + exerciseID;
  console.log("Fetching exercise from:", refPath); // DEBUG

  database.ref(refPath).once("value").then(snapshot => {
    var data = snapshot.val();
    console.log("Exercise data received:", data); // DEBUG

    var editorHTML = "";
    if (data) {
      editorHTML += `<h3>Exercise Info</h3>`;
      editorHTML += `
        <label style="display:inline-block; width:50px;">Name:</label>
        <input type="text" id="exercise_name" value="${data.name || ''}"><br>
        <label style="display:inline-block; width:50px;">Note:</label>
        <input type="text" id="exercise_note" value="${data.note || ''}"><br>
        <p>Exercise ${currentExerciseIndex + 1} of ${filteredExerciseKeys.length}</p>
      `;
    } else {
      editorHTML = "<p>No data for this exercise.</p>";
    }
    document.getElementById("exerciseeditorsection").innerHTML = editorHTML;
  }).catch(error => console.error("Error displaying exercise:", error));
}

// Navigate to the next exercise.
function nextexo() {
  if (exerciseKeys.length > 0) {
    do {
      currentExerciseIndex = (currentExerciseIndex + 1) % exerciseKeys.length;
    } while (exerciseKeys[currentExerciseIndex] === "note"); // Skip the "note" node

    displayExercise();
  }
}

// Navigate to the previous exercise.
function prevexo() {
  if (exerciseKeys.length > 0) {
    do {
      currentExerciseIndex = (currentExerciseIndex - 1 + exerciseKeys.length) % exerciseKeys.length;
    } while (exerciseKeys[currentExerciseIndex] === "note"); // Skip the "note" node

    displayExercise();
  }
}

// Save changes made to the current exercise back to Firebase.
function saveexo() {
  if (exerciseKeys.length === 0) return;
  var exerciseID = exerciseKeys[currentExerciseIndex];
  var refPath = "/" + currentExerciseType + "/" + currentExerciseCategory + "/" + exerciseID;
  var updatedData = {
    name: document.getElementById("exercise_name").value,
    note: document.getElementById("exercise_note").value
  };

  database.ref(refPath).update(updatedData)
    .then(() => {
      // Additionally, update the focus area note if a focus area is selected
      // and the focus area notes textarea (with id "notesInput") exists.
      var selectedFocusArea = categorySelector.value;
      var notesTextarea = document.getElementById("notesInput");
      if (selectedFocusArea && notesTextarea) {
        return database.ref("focusareas").child(selectedFocusArea).update({ note: notesTextarea.value });
      } else {
        return Promise.resolve();
      }
    })
    .then(() => {
      alert("Exercise updated successfully!");
      displayExercise();
    })
    .catch(error => alert("Error updating exercise: " + error.message));
}

// Delete the current exercise from Firebase.
function deleteexo() {
  if (exerciseKeys.length === 0) return;
  if (!confirm("Are you sure you want to delete this exercise?")) return;
  var exerciseID = exerciseKeys[currentExerciseIndex];
  var refPath = "/" + currentExerciseType + "/" + currentExerciseCategory + "/" + exerciseID;

  database.ref(refPath).remove()
    .then(() => {
      alert("Exercise deleted successfully!");
      // Remove the deleted exercise from the local keys array.
      exerciseKeys.splice(currentExerciseIndex, 1);
      if (currentExerciseIndex >= exerciseKeys.length) {
        currentExerciseIndex = Math.max(exerciseKeys.length - 1, 0);
      }
      displayExercise();
    })
    .catch(error => alert("Error deleting exercise: " + error.message));
}

// Optionally, the 'Exercise Editor' button can refresh the current view.
document.getElementById("showeditorbtn").addEventListener("click", function() {
  displayExercise();
});

// On initial load, populate categories from the default type.
loadCategories(currentExerciseType);


//////////////////////////////////////////////////////////////////////// Exercise list editing

//-////////////////////////////////////////////////////////////////////// Workout creation and saving


// Render the exercise list dynamically, including intensity note field
function renderExerciseList() {
  exerciseList.innerHTML = ''; // Clear the list

  selectedExercises.forEach((exercise, index) => {
    const exerciseDiv = document.createElement('row');
    exerciseDiv.className = 'exercise-item';
    exerciseDiv.id = 'test';

    exerciseDiv.innerHTML = `
    <div class="row p-1">
      <div class="col-12 col-md-3">${exercise.name}</div>
      <div class="col-4 col-md-1">
        <input type="number" class="form-control sets-input" placeholder="Sets" data-index="${index}" 
          value="${exercise.sets !== 0 ? exercise.sets : ''}">
      </div>
      <div class="col-4 col-md-1">
        <input type="number" class="form-control reps-input" placeholder="Reps" data-index="${index}" 
          value="${exercise.reps !== 0 ? exercise.reps : ''}">
      </div>
      <div class="col-8 col-md-2">
        <input type="text" class="form-control note-input" placeholder="Add a note" data-index="${index}" 
          value="${exercise.note || ''}">
      </div>
      <div class="col-2 col-md-1">
        <button class="btn btn-danger remove-btn" data-index="${index}">X</button>
      </div>
    </div>
    `;
    exerciseList.appendChild(exerciseDiv);
  });

  // Add intensity field with intensity note (global for the workout, not per exercise)
  const intensityDiv = document.createElement('row');
  intensityDiv.className = 'introw';
  intensityDiv.id = 'introwcss';

  intensityDiv.innerHTML = `
  <div class="row p-1">
  <div class="col-8 col-md-3">Workout Intensity</div>
  <div class="col-8 col-md-2">
    <input type="number" id="workoutIntensity" class="form-control" placeholder="1-10" min="1" max="10" value="${currentWorkout.intensity || ''}">
  </div>
  <div class="col-8 col-md-2">
    <input type="text" id="workoutIntensityNote" class="form-control" placeholder="Misc. notes" value="${currentWorkout.intensityNote || ''}">
  </div>
  <div class="col-1"></div></div> <!-- Empty column to balance the grid -->
  `;

  exerciseList.appendChild(intensityDiv); // Append the intensity field
  addDraftListeners(); // Add listeners to save draft on changes
}


// Save workout to Firebase
saveWorkoutBtn.addEventListener('click', () => {
  if (selectedExercises.length === 0) {
    alert('Please add some exercises before saving!');
    return;
  }

  const workoutDuration = formatDuration(validateBtn.textContent);  // Convert clock time to "h m" format
  
  const workout = {
    date: getToday(),
    exercises: selectedExercises,
    intensity: document.getElementById('workoutIntensity')?.value || '', // Include intensity
    intensityNote: currentWorkout.intensityNote || '', // Include intensity note
    duration: workoutDuration  // Save the formatted duration
  };

  saveWorkout(workout);
  alert('Workout saved successfully!');
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
function saveWorkout(workout) {
  const workoutsRef = database.ref('workouts');
  workoutsRef.push(workout, (error) => {
    if (error) {
      console.error('Error saving workout:', error);
    } else {
      // Clear the workout draft after saving
      clearWorkoutDraft();
      renderSavedWorkouts(); // Refresh the list of saved workouts
    }
  });
}

//////////////////////////////////////////////////////////////////////// Creating and saving workouts


//-////////////////////////////////////////////////////////////////////// Workout drafts and draft keeping

// Load existing workout draft on page load
function loadWorkoutDraft() {
  workoutDraftRef.once('value', (snapshot) => {
    const draft = snapshot.val();
    if (draft && draft.exercises) {
      selectedExercises.push(...draft.exercises); // Populate draft exercises
      if (draft.intensity) {
        currentWorkout.intensity = draft.intensity; // Load intensity
      }
      if (draft.intensityNote) {
        currentWorkout.intensityNote = draft.intensityNote; // Load intensity note
      }
      renderExerciseList(); // Render the draft
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

  workoutDraftRef.set(draft, (error) => {
    if (error) {
      console.error('Error saving workout draft:', error);
    }
  });
}

// Clear the workout draft from Firebase (after saving the workout)
function clearWorkoutDraft() {
  workoutDraftRef.remove((error) => {
    if (error) {
      console.error('Error clearing workout draft:', error);
    }
  });
}


// Add listeners for input changes to save the draft
function addDraftListeners() {
  document.querySelectorAll('.sets-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const index = e.target.dataset.index;
      selectedExercises[index].sets = parseInt(e.target.value) || 0;
      saveWorkoutDraft(); // Save the draft after modifying sets
    });
  });

  document.querySelectorAll('.reps-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const index = e.target.dataset.index;
      selectedExercises[index].reps = parseInt(e.target.value) || 0;
      saveWorkoutDraft(); // Save the draft after modifying reps
    });
  });

  document.querySelectorAll('.note-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const index = e.target.dataset.index;
      selectedExercises[index].note = e.target.value.trim();
      saveWorkoutDraft(); // Save the draft after modifying notes
    });
  });

  document.querySelectorAll('.remove-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const index = e.target.dataset.index;
      selectedExercises.splice(index, 1); // Remove exercise
      renderExerciseList();
      saveWorkoutDraft(); // Save the draft after removing an exercise
    });
  });

  // Intensity input listener
  document.getElementById('workoutIntensity').addEventListener('input', (e) => {
    currentWorkout.intensity = e.target.value.trim();
    saveWorkoutDraft(); // Save the draft after modifying intensity
  });

  // Intensity note input listener
  document.getElementById('workoutIntensityNote').addEventListener('input', (e) => {
    currentWorkout.intensityNote = e.target.value.trim();
    saveWorkoutDraft(); // Save the draft after modifying intensity note
  });
}

//////////////////////////////////////////////////////////////////////// Workout drafts and draft keeping


//-////////////////////////////////////////////////////////////////////// Add and edit section functionality
// Get elements// Get elements// Get elements
const toggleFormBtn = document.getElementById("toggleFormBtn");
const addExerciseSection = document.getElementById("addExerciseSection");
const workoutEditorBtn = document.getElementById("showeditorbtn");
const exoEditorBtn = document.getElementById("showexoeditorbtn");
const workoutEditorSection = document.getElementById("editorsection");
const exerciseEditorSection = document.getElementById("exerciseeditor");
const categorySelector = document.getElementById("categorySelector");
const typeSelector = document.getElementById("typeSelector");
const exerciseNotesSection = document.getElementById("exercisenotessection");

// Toggle form section and show/hide the two editor toggle buttons
toggleFormBtn.addEventListener("click", () => {
  addExerciseSection.classList.toggle("hidden");
  toggleFormBtn.textContent = addExerciseSection.classList.contains("hidden") ? "Add and Edit" : "Hide";

  if (addExerciseSection.classList.contains("hidden")) {
    workoutEditorBtn.classList.add("hidden");
    exoEditorBtn.classList.add("hidden");
    workoutEditorSection.classList.add("hidden");
    exerciseEditorSection.classList.add("hidden");
    workoutEditorBtn.textContent = "Workout Editor";
    exoEditorBtn.textContent = "Exercise Editor";
  } else {
    workoutEditorBtn.classList.remove("hidden");
    exoEditorBtn.classList.remove("hidden");
  }
});

// Toggle Workout Editor section
workoutEditorBtn.addEventListener("click", () => {
  workoutEditorSection.classList.toggle("hidden");
  exerciseEditorSection.classList.add("hidden");
  workoutEditorBtn.textContent = workoutEditorSection.classList.contains("hidden") ? "Workout Editor" : "Hide Workout Editor";
  exoEditorBtn.textContent = "Exercise Editor";
});

// Toggle Exercise Editor section
exoEditorBtn.addEventListener("click", () => {
  exerciseEditorSection.classList.toggle("hidden");
  workoutEditorSection.classList.add("hidden");
  exoEditorBtn.textContent = exerciseEditorSection.classList.contains("hidden") ? "Exercise Editor" : "Hide Exercise Editor";
  workoutEditorBtn.textContent = "Workout Editor";
});

// Function to load the focus area note
function loadFocusAreaNote() {
  const selectedFocusArea = categorySelector.value;
  exerciseNotesSection.innerHTML = ""; // Clear existing notes section

  if (selectedFocusArea) {
    const notesTextarea = document.createElement("textarea");
    notesTextarea.setAttribute("id", "notesInput");
    notesTextarea.style.width = "450px";
    notesTextarea.style.height = "100px";
    notesTextarea.style.marginTop = "10px";

    database.ref("focusareas").child(selectedFocusArea).once("value", (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object" && data.note !== undefined && data.note.trim() !== "") {
        notesTextarea.value = data.note; // Load existing note
        notesTextarea.setAttribute("placeholder", ""); // No placeholder if note exists
      } else {
        notesTextarea.value = ""; // No note exists
        notesTextarea.setAttribute("placeholder", `Notes for ${selectedFocusArea}`); // Show placeholder
      }
    });

    exerciseNotesSection.appendChild(notesTextarea);
  }
}

// Listen for changes on the category selector
categorySelector.addEventListener("change", loadFocusAreaNote);

// Delay loading of notes when switching to "Focus Areas"
typeSelector.addEventListener("change", () => {
  if (typeSelector.value === "focusareas") {
    setTimeout(() => {
      loadFocusAreaNote();
    }, 500); // Short delay ensures categorySelector value updates first
  } else {
    exerciseNotesSection.innerHTML = ""; // Hide notes when switching to "Exercises"
  }
});



// Save changes made to the current exercise back to Firebase
function saveexo() {
  if (exerciseKeys.length === 0) return;
  var exerciseID = exerciseKeys[currentExerciseIndex];
  var refPath = "/" + currentExerciseType + "/" + currentExerciseCategory + "/" + exerciseID;
  var updatedData = {
    name: document.getElementById("exercise_name").value,
    note: document.getElementById("exercise_note").value
  };

  database.ref(refPath).update(updatedData)
    .then(() => {
      if (typeSelector.value === "focusareas") {
        var selectedFocusArea = categorySelector.value;
        var notesTextarea = document.getElementById("notesInput");
        if (selectedFocusArea && notesTextarea) {
          return database.ref("focusareas").child(selectedFocusArea).update({ note: notesTextarea.value });
        }
      }
      return Promise.resolve();
    })
    .then(() => {
      alert("Exercise updated successfully!");
      displayExercise();
    })
    .catch(error => alert("Error updating exercise: " + error.message));
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

    Object.keys(workouts).forEach(workoutId => {
      const workout = workouts[workoutId];

      // Create a container for this workout.
      const workoutDiv = document.createElement('div');
      workoutDiv.className = 'saved-workout';

      const date = workout.date; 
      const intensity = workout.intensity ? `Intensity: ${workout.intensity}/10` : '';
      const intensityNote = workout.intensityNote ? `${workout.intensityNote}` : '';
      const duration = workout.duration ? `${workout.duration}` : '';
      const exercises = workout.exercises.map(e => {
        const setsRepsText = (e.sets || e.reps)
          ? `${e.sets ? `${e.sets} sets` : ''} ${e.reps ? `x ${e.reps} reps` : ''}`
          : '';
        const noteText = e.note ? ` ${e.note}` : '';
        return `<span style="color: blue;">${e.name}</span>: ${setsRepsText} <span style="color: red;">${noteText}</span>`;
      }).join('<br>');
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

// Toggle workouts (and the filter) when the "Show workouts" button is clicked
workoutButton.addEventListener('click', () => {
  if (workoutButton.textContent === 'Show workouts') {
    renderSavedWorkouts(); // Populate the workouts
    savedWorkoutList.classList.remove('hidden'); // Make the workouts list visible
    workoutButton.textContent = 'Hide workouts'; // Change button text
  } else {
    savedWorkoutList.innerHTML = ''; // Clear the workouts content
    savedWorkoutList.classList.add('hidden'); // Hide the workouts list
    workoutButton.textContent = 'Show workouts'; // Change button text back
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
  const workoutsRef = database.ref('workouts');

  workoutsRef.orderByChild('date').limitToLast(1).once('value', snapshot => {
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const workout = child.val();
        const workoutKey = child.key;

        // Only show if result is missing or empty
        if (!workout.result || workout.result.trim() === '') {
          const date = workout.date || 'recently';
          const input = document.getElementById('lastworkoutresult');
          const resultSection = document.getElementById('resultsection');

          input.placeholder = `How did you feel after your workout on ${date}?`;
          input.dataset.key = workoutKey; // Save the key for use when saving
          resultSection.classList.remove('hidden');
        }
      });
    }
  });
}

function savelastworkoutresult() {
  const input = document.getElementById('lastworkoutresult');
  const workoutKey = input.dataset.key;
  const result = input.value.trim();

  if (!result) {
    alert('Please enter how you felt!');
    return;
  }

  const workoutRef = database.ref('workouts/' + workoutKey);
  workoutRef.update({ result: result }, (error) => {
    if (error) {
      console.error('Error saving result:', error);
    } else {
      document.getElementById('resultsection').classList.add('hidden');
    }
  });
}




// Initialize the app
loadExercises();
loadWorkoutDraft();
renderSavedWorkouts();  // Ensure saved workouts are shown when the app loads
checkLastWorkoutResult();