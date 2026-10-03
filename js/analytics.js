// Function to format the date as "DD MMM"
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { day: '2-digit', month: 'short' };
  return date.toLocaleDateString('en-GB', options); // Adjusted for 'en-GB' to get the format DD MMM
}

// Function to get the background color based on intensity (light to dark green)
function getIntensityColor() {
  // Every workout day uses the same green regardless of score
  return 'rgb(130, 230, 130)';
}

// Select only the button with ID "showchartbtn"
const clickButton = document.querySelector('#showchartbtn');
const filterTypeElement = document.querySelector('#filter-type');

clickButton.addEventListener('click', () => {
  const visualsContainer = document.querySelector('#visuals-container');

  if (clickButton.textContent === 'Show chart') {
    console.log('Button clicked. Running analytics...');
    runanalytics();
    generatevisuals();

    clickButton.textContent = 'Hide chart';
    filterTypeElement.style.display = 'inline'; // Show the filter dropdown
  } else {
    visualsContainer.innerHTML = '';
    clickButton.textContent = 'Show chart';
    
    filterTypeElement.style.display = 'none'; // Hide the filter dropdown
  }
});

// Ensure the filter is hidden by default
filterTypeElement.style.display = 'none';



// Function to fetch workout data from Firebase
async function fetchWorkouts() {
  const sourceRef = window.database.ref('/'); // User root of the source database
  try {
    // Fetch the entire database
    const snapshot = await sourceRef.once('value');
    const data = snapshot.val();

    if (data && data.workouts) {
      // Parse workouts data
      const workouts = Object.values(data.workouts).map(workout => ({
        date: workout.date,
        intensity: workout.intensity
      }));

      return workouts;
    } else {
      return []; // Return an empty array if no workouts exist
    }
  } catch (error) {
    console.error('Error fetching workouts:', error);
    return []; // Return an empty array if there's an error
  }
}

// Add event listener to show calendar
document.getElementById("showcal").querySelector("button").addEventListener("click", async function() {
  const calendarContainer = document.getElementById("calendar-container");
  const yearSelector = document.getElementById("calendar-year-filter");
  
  if (calendarContainer.classList.contains('hidden') || calendarContainer.style.display === 'none') {
    // Show calendar
    const year = parseInt(yearSelector.value, 10);
    await createCalendar(year);
    calendarContainer.style.display = 'block';
    yearSelector.style.display = 'inline';
  } else {
    // Hide calendar
    calendarContainer.innerHTML = '';
    calendarContainer.style.display = 'none';
    yearSelector.style.display = 'none';
  }
});

function populateCalendarYearSelector() {
  const yearSelector = document.getElementById('calendar-year-filter');
  const currentYear = new Date().getFullYear();
  if (!yearSelector) return;

  yearSelector.replaceChildren();
  for (let year = currentYear - 5; year <= currentYear + 5; year++) {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    yearSelector.appendChild(option);
  }
  yearSelector.value = String(currentYear);
}

populateCalendarYearSelector();

// Add listener for year selector change
document.getElementById("calendar-year-filter").addEventListener("change", async function() {
  const year = parseInt(this.value, 10);
  await createCalendar(year);
});



async function runanalytics() {
  const sourceRef = window.database.ref('/'); // User root of the source database
  const destinationRef = window.database.ref('/analyticsdb'); // Destination database
  const analyticsRef = destinationRef.child('analytics/exercise-count'); // Path for analytics

  console.log('Starting runanalytics...');

  try {
    // Fetch the entire database
    const snapshot = await sourceRef.once('value');
    const data = snapshot.val();

    if (data) {
      // Prepare exercise frequency map
      const exercises = {}; // Object to store exercise frequency

      // Check if workouts exist
      if (data.workouts) {
        const workouts = Object.values(data.workouts);

        // Iterate over each workout
        workouts.forEach((workout) => {
          if (workout.exercises) {
            const exerciseList = Object.values(workout.exercises);

            // Count the frequency of each exercise
            exerciseList.forEach((exercise) => {
              if (exercise.name) {
                // Sanitize the exercise name to use it as a valid key
                const sanitizedExerciseName = exercise.name.replace(/[.#$/\[\]]/g, '_');
                exercises[sanitizedExerciseName] = (exercises[sanitizedExerciseName] || 0) + 1;
              }
            });
          }
        });
      }

      // Sort exercises by frequency (most frequent first)
      const sortedExercises = Object.entries(exercises)
        .sort((a, b) => b[1] - a[1]) // Sort by frequency
        .map(([exercise]) => exercise); // Extract sorted exercise names

      // Write analytics data and sorted exercises to the database
      await analyticsRef.set({
        sortedExercises,
        frequencies: exercises
      });

      console.log('Analytics data written successfully.');
    }
  } catch (error) {
    console.error('Error during runanalytics:', error);
  }
}

function getWorkoutDateKey(workout) {
  const rawDate = workout?.date || workout?.createdAt || workout?.timestamp || workout?.dateString;
  if (rawDate === null || rawDate === undefined || rawDate === '') return null;

  if (typeof rawDate === 'string') {
    const explicitDate = rawDate.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/);
    if (explicitDate) return explicitDate[1];
  }

  const parsedDate = new Date(rawDate);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return formatCalendarDate(parsedDate);
}

async function groupWorkoutsByDate() {
  const sourceRef = window.database.ref('/');

  try {
    // Fetch workouts data
    const sourceSnapshot = await sourceRef.once('value');
    const data = sourceSnapshot.val();

    if (!data || !data.workouts) return {};

    const workouts = Object.values(data.workouts);

    return workouts.reduce((acc, workout) => {
      const date = getWorkoutDateKey(workout);
      if (!date) return acc;
      const intensity = Number(workout.intensity) || 5;

      // Create or update workout entry for the date
      if (!acc[date]) {
        acc[date] = { workouts: [], maxIntensity: intensity };
      }

      // Add the workout to the date's group
      acc[date].workouts.push(workout);

      // Update the max intensity for the day
      acc[date].maxIntensity = Math.max(acc[date].maxIntensity, intensity);

      return acc;
    }, {}); // Grouped workouts by date

  } catch (error) {
    console.error('Error fetching or processing workouts:', error);
    return {};
  }
}


// Call the integrated groupWorkoutsByDate function
groupWorkoutsByDate().then(workoutsByDate => {
  if (workoutsByDate) {
    console.log('Grouped Workouts by Date:', workoutsByDate);
    // You can now use workoutsByDate for any further operations
  }
});






async function generatevisuals() {
  const analyticsRef = window.database.ref('/analyticsdb/analytics/exercise-count');
  const sourceRef = window.database.ref('/');

  try {
    // Fetch analytics data (exercise counts and sorted exercises)
    console.log('Fetching analytics data from Firebase...');
    const analyticsSnapshot = await analyticsRef.once('value');
    const analyticsData = analyticsSnapshot.val();

    console.log('Analytics Data:', analyticsData);

    if (!analyticsData || !analyticsData.sortedExercises) {
      console.error('No analytics data available to generate visuals.');
      return;
    }

    const sortedExercises = analyticsData.sortedExercises; // Sorted exercise names

    // Fetch workouts and exercises data
    const sourceSnapshot = await sourceRef.once('value');
    const data = sourceSnapshot.val();

    if (!data || !data.workouts) {
      console.error('No workouts data available to generate visuals.');
      return;
    }

    // Call the helper function to group workouts by date
    const workoutsByDate = await groupWorkoutsByDate();
    console.log('Workouts Grouped by Date:', workoutsByDate);

    // Step 1: Use all workout dates
    const filteredDates = Object.keys(workoutsByDate);

    // Step 2: Identify the exercises that are actually used on these filtered dates
    const relevantExercises = new Set();
    filteredDates.forEach((date) => {
      workoutsByDate[date].workouts.forEach((workout) => {
        Object.values(workout.exercises || {}).forEach((exercise) => {
          const sanitizedExercise = exercise.name.replace(/[.#$/\[\]]/g, '_');
          relevantExercises.add(sanitizedExercise);
        });
      });
    });

    // Step 3: Create the HTML table dynamically using the filtered dates and relevant exercises
    const tableContainer = document.getElementById('visuals-container');
    tableContainer.innerHTML = ''; // Clear previous visuals

    const table = document.createElement('table');
    table.className = 'exercise-table';
    table.style.borderCollapse = 'collapse'; // Ensure borders collapse into a single border
    table.style.marginTop = '10px';

    // Create header row (Dates)
    const headerRow = document.createElement('tr');
    const emptyHeader = document.createElement('th'); // Empty cell at the top left
    headerRow.appendChild(emptyHeader);

    filteredDates.forEach((date) => {
      const dateHeader = document.createElement('th');
      const formattedDate = formatDate(date);
      dateHeader.textContent = formattedDate;
      dateHeader.style.border = '1px solid black'; // Add border to header cell
      headerRow.appendChild(dateHeader);
    });
    table.appendChild(headerRow);

    // Step 4: Create rows only for relevant exercises
    sortedExercises.forEach((exercise) => {
      const sanitizedExercise = exercise.replace(/[.#$/\[\]]/g, '_');

      // Skip exercises not performed on filtered dates
      if (!relevantExercises.has(sanitizedExercise)) {
        return;
      }

      const row = document.createElement('tr');

      // Add row header (exercise name)
      const exerciseCell = document.createElement('th');
      exerciseCell.textContent = exercise;
      exerciseCell.style.border = '1px solid black';
      row.appendChild(exerciseCell);

      // Add cells for each date
      filteredDates.forEach((date) => {
        const cell = document.createElement('td');
        cell.style.border = '1px solid black';

        // Check if the exercise was performed on this date
        const didExercise = workoutsByDate[date].workouts.some((workout) => {
          const exercises = workout.exercises || {};
          return Object.values(exercises).some((e) => {
            const sanitizedEx = e.name.replace(/[.#$/\[\]]/g, '_');
            return sanitizedEx === sanitizedExercise;
          });
        });

        // Get the intensity color for this date's workouts
        const intensityColor = getIntensityColor(workoutsByDate[date].maxIntensity);

        // Color the cell if the exercise was performed
        cell.style.backgroundColor = didExercise ? intensityColor : '#f0f0f0';
        row.appendChild(cell);
      });

      table.appendChild(row);
    });

    tableContainer.appendChild(table);
  } catch (error) {
    console.error('Error during generatevisuals:', error);
  }
}













let showWholeYearCalendar = false;
let calendarStartWeek = 1;
const showWholeYearSettingCheckbox = document.getElementById('showWholeYearSetting');
const calendarStartWeekInput = document.getElementById('calendarStartWeekSetting');

function normalizeCalendarStartWeek(value) {
  const week = Math.trunc(Number(value));
  return Number.isFinite(week) ? Math.max(1, Math.min(53, week)) : 1;
}

async function loadCalendarSettings() {
  try {
    const snapshot = await database.ref('settings/calendar').once('value');
    const settings = snapshot.val() || {};
    showWholeYearCalendar = settings.showWholeYear === true;
    calendarStartWeek = normalizeCalendarStartWeek(settings.startWeek ?? 1);
    if (showWholeYearSettingCheckbox) showWholeYearSettingCheckbox.checked = showWholeYearCalendar;
    if (calendarStartWeekInput) calendarStartWeekInput.value = String(calendarStartWeek);
  } catch (error) {
    console.error('Error loading calendar settings:', error);
  }
}

const calendarSettingsReady = loadCalendarSettings();

if (showWholeYearSettingCheckbox) {
  showWholeYearSettingCheckbox.addEventListener('change', async () => {
    const nextValue = showWholeYearSettingCheckbox.checked;
    await calendarSettingsReady;
    const previousValue = showWholeYearCalendar;
    showWholeYearCalendar = nextValue;

    try {
      await database.ref('settings/calendar/showWholeYear').set(showWholeYearCalendar);
      const calendarContainer = document.getElementById('calendar-container');
      if (calendarContainer && calendarContainer.style.display !== 'none') {
        const selectedYear = Number(document.getElementById('calendar-year-filter').value);
        await createCalendar(selectedYear);
      }
    } catch (error) {
      showWholeYearCalendar = previousValue;
      showWholeYearSettingCheckbox.checked = previousValue;
      console.error('Error saving calendar settings:', error);
    }
  });
}

if (calendarStartWeekInput) {
  calendarStartWeekInput.addEventListener('change', async () => {
    await calendarSettingsReady;
    const previousWeek = calendarStartWeek;
    calendarStartWeek = normalizeCalendarStartWeek(calendarStartWeekInput.value);
    calendarStartWeekInput.value = String(calendarStartWeek);

    try {
      await database.ref('settings/calendar/startWeek').set(calendarStartWeek);
      const selectedYear = Number(document.getElementById('calendar-year-filter').value);
      const calendarContainer = document.getElementById('calendar-container');
      if (selectedYear === new Date().getFullYear() && calendarContainer?.style.display !== 'none') {
        await createCalendar(selectedYear);
      }
    } catch (error) {
      calendarStartWeek = previousWeek;
      calendarStartWeekInput.value = String(previousWeek);
      console.error('Error saving calendar start week:', error);
    }
  });
}

function getCalendarEndDate(year, today = new Date()) {
  const yearEnd = new Date(year, 11, 31);
  if (showWholeYearCalendar || year !== today.getFullYear()) return yearEnd;

  const daysUntilSunday = (7 - today.getDay()) % 7;
  const endOfFollowingWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysUntilSunday + 7);
  return endOfFollowingWeek < yearEnd ? endOfFollowingWeek : yearEnd;
}

function formatCalendarDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCalendarWeekStart(date) {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  return weekStart;
}

function isSameCalendarWeek(firstDate, secondDate) {
  return formatCalendarDate(getCalendarWeekStart(firstDate)) === formatCalendarDate(getCalendarWeekStart(secondDate));
}

async function createCalendar(year = new Date().getFullYear()) {
  await calendarSettingsReady;
  // Assume workoutsByDate is generated by the groupWorkoutsByDate function
  const workoutsByDate = await groupWorkoutsByDate();

  const container = document.getElementById("calendar-container");
  if (!container) return;

  // Create the table header
  const headerRow = `
    <tr>
      <th class="week-column">Week</th>
      <th class="day-column">M</th>
      <th class="day-column">T</th>
      <th class="day-column">W</th>
      <th class="day-column">T</th>
      <th class="day-column">F</th>
      <th class="day-column">S</th>
      <th class="day-column">S</th>
    </tr>
  `;

  let rows = '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayString = formatCalendarDate(today);
  const firstOfYear = new Date(year, 0, 1);
  const firstWeekStart = getCalendarWeekStart(firstOfYear);
  const firstVisibleWeek = year === today.getFullYear() ? calendarStartWeek : 1;
  firstWeekStart.setDate(firstWeekStart.getDate() + (firstVisibleWeek - 1) * 7);
  const lastVisibleDate = getCalendarEndDate(year, today);

  for (let weekNumber = firstVisibleWeek, weekStart = new Date(firstWeekStart);
    weekStart <= lastVisibleDate;
    weekNumber++, weekStart.setDate(weekStart.getDate() + 7)) {
    let row = `<tr><td>Week ${weekNumber}</td>`;

    for (let day = 0; day < 7; day++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(weekStart.getDate() + day);
      const dateString = formatCalendarDate(currentDate);

      const workoutData = workoutsByDate[dateString];
      let color;

      if (dateString === todayString && !workoutData) {
        color = 'rgb(255, 255, 146)';
      } else if (currentDate < today && !workoutData) {
        color = 'rgb(233, 233, 233)';
      } else if (workoutData) {
        color = getIntensityColor(workoutData.maxIntensity);
      } else {
        color = 'rgb(255, 255, 255)';
      }

      const firstOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const lastOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const monthBorders = [];
      if (currentDate.getDate() === 1 && currentDate.getDay() !== 1) {
        monthBorders.push('border-left:2px solid black');
      }
      if (currentDate >= firstOfMonth && isSameCalendarWeek(currentDate, firstOfMonth)) {
        monthBorders.push('border-top:2px solid black');
      }
      if (currentDate.getDate() === lastOfMonth.getDate() && currentDate.getDay() !== 0) {
        monthBorders.push('border-right:2px solid black');
      }
      if (currentDate <= lastOfMonth && isSameCalendarWeek(currentDate, lastOfMonth)) {
        monthBorders.push('border-bottom:2px solid black');
      }
      const borderStyle = monthBorders.length ? `${monthBorders.join(';')};` : '';
      row += `<td data-date="${dateString}" title="${dateString}" style="background-color:${color};border:1px solid grey;${borderStyle}"></td>`;
    }

    row += '</tr>';
    rows += row;
  }

  // Insert the table into the calendar container
  container.innerHTML = `<table border="1" style="border-collapse: collapse;">${headerRow}${rows}</table>`;
}



