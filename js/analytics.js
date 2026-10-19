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
document.getElementById("showCalendarBtn").addEventListener("click", async function() {
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
let calendarLayout = 'horizontal'; // 'horizontal' (months side by side) or 'vertical' (a row per week)
const calendarEndAtSelect = document.getElementById('calendarEndAtSetting');
const calendarStartWeekInput = document.getElementById('calendarStartWeekSetting');
const calendarLayoutSelect = document.getElementById('calendarLayoutSetting');
let calendarStartMonth = 1; // 1-12, used by the month layout instead of the start week
const calendarStartMonthSelect = document.getElementById('calendarStartMonthSetting');
// Writable days: each day cell holds a short note, saved at calendarNotes/<YYYY-MM-DD>
let calendarWritableDays = false;
let calendarNotes = {};
const writableDaysCheckbox = document.getElementById('writableDaysSetting');

// Month layout shows "Start from month"; week layout shows "Start from week" and "End at"
function syncCalendarStartControls() {
  const monthLayout = calendarLayout === 'horizontal';
  const monthRow = document.getElementById('calendarStartMonthRow');
  const weekRow = document.getElementById('calendarStartWeekRow');
  if (monthRow) monthRow.hidden = !monthLayout;
  if (weekRow) weekRow.hidden = monthLayout;
}

function rerenderCalendarIfOpen() {
  const calendarContainer = document.getElementById('calendar-container');
  if (calendarContainer && calendarContainer.style.display !== 'none') {
    return createCalendar(Number(document.getElementById('calendar-year-filter').value));
  }
}

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
    calendarLayout = settings.layout === 'vertical' ? 'vertical' : 'horizontal';
    if (calendarLayoutSelect) calendarLayoutSelect.value = calendarLayout;
    calendarStartMonth = Math.min(12, Math.max(1, Math.trunc(Number(settings.startMonth)) || 1));
    if (calendarStartMonthSelect) calendarStartMonthSelect.value = String(calendarStartMonth);
    calendarWritableDays = settings.writableDays === true;
    if (writableDaysCheckbox) writableDaysCheckbox.checked = calendarWritableDays;
    syncCalendarStartControls();
    if (calendarEndAtSelect) calendarEndAtSelect.value = showWholeYearCalendar ? 'yearEnd' : 'auto';
    if (calendarStartWeekInput) calendarStartWeekInput.value = String(calendarStartWeek);
  } catch (error) {
    console.error('Error loading calendar settings:', error);
  }
}

const calendarSettingsReady = loadCalendarSettings();

if (calendarLayoutSelect) {
  calendarLayoutSelect.addEventListener('change', async () => {
    await calendarSettingsReady;
    calendarLayout = calendarLayoutSelect.value === 'vertical' ? 'vertical' : 'horizontal';
    syncCalendarStartControls();
    await rerenderCalendarIfOpen();
    try {
      await database.ref('settings/calendar/layout').set(calendarLayout);
    } catch (error) {
      console.error('Error saving calendar layout:', error);
    }
  });
}

if (writableDaysCheckbox) {
  writableDaysCheckbox.addEventListener('change', async () => {
    await calendarSettingsReady;
    calendarWritableDays = writableDaysCheckbox.checked;
    await rerenderCalendarIfOpen();
    try {
      await database.ref('settings/calendar/writableDays').set(calendarWritableDays);
    } catch (error) {
      console.error('Error saving writable days setting:', error);
    }
  });
}

// Save a day's note when its box loses focus (Enter also commits); an empty note is deleted
const calendarContainerElement = document.getElementById('calendar-container');
if (calendarContainerElement) {
  calendarContainerElement.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.matches('.calendar-note')) event.target.blur();
  });
  calendarContainerElement.addEventListener('change', async (event) => {
    const input = event.target.closest('.calendar-note');
    if (!input) return;
    const date = input.dataset.date;
    const text = input.value.trim();
    input.value = text;
    try {
      const noteRef = database.ref(`calendarNotes/${date}`);
      if (text) {
        await noteRef.set(text);
        calendarNotes[date] = text;
      } else {
        await noteRef.remove();
        delete calendarNotes[date];
      }
      input.classList.remove('calendar-note-error');
    } catch (error) {
      input.classList.add('calendar-note-error');
      console.error('Error saving calendar note:', error);
    }
  });
}

if (calendarStartMonthSelect) {
  calendarStartMonthSelect.addEventListener('change', async () => {
    await calendarSettingsReady;
    calendarStartMonth = Number(calendarStartMonthSelect.value) || 1;
    await rerenderCalendarIfOpen();
    try {
      await database.ref('settings/calendar/startMonth').set(calendarStartMonth);
    } catch (error) {
      console.error('Error saving calendar start month:', error);
    }
  });
}

// "End at": Year end shows the whole year; Auto stops shortly after today
if (calendarEndAtSelect) {
  calendarEndAtSelect.addEventListener('change', async () => {
    await calendarSettingsReady;
    const previousValue = showWholeYearCalendar;
    showWholeYearCalendar = calendarEndAtSelect.value === 'yearEnd';

    try {
      await database.ref('settings/calendar/showWholeYear').set(showWholeYearCalendar);
      await rerenderCalendarIfOpen();
    } catch (error) {
      showWholeYearCalendar = previousValue;
      calendarEndAtSelect.value = previousValue ? 'yearEnd' : 'auto';
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
  // Month layout always runs to December, so "End at" only affects the week layout
  if (showWholeYearCalendar || calendarLayout === 'horizontal' || year !== today.getFullYear()) return yearEnd;

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

const CALENDAR_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Work out every visible week and the colour and month-boundary edges of each day.
// Edges are named for the weeks-down layout: left/right are neighbouring days in the
// same week, top/bottom are the same weekday in neighbouring weeks.
// firstVisibleWeek defaults to the start-week setting (current year only).
async function buildCalendarWeeks(year, firstVisibleWeek) {
  const workoutsByDate = await groupWorkoutsByDate();
  const weeks = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayString = formatCalendarDate(today);
  const firstOfYear = new Date(year, 0, 1);
  const firstWeekStart = getCalendarWeekStart(firstOfYear);
  firstVisibleWeek ??= year === today.getFullYear() ? calendarStartWeek : 1;
  firstWeekStart.setDate(firstWeekStart.getDate() + (firstVisibleWeek - 1) * 7);
  const lastVisibleDate = getCalendarEndDate(year, today);

  for (let weekNumber = firstVisibleWeek, weekStart = new Date(firstWeekStart);
    weekStart <= lastVisibleDate;
    weekNumber++, weekStart.setDate(weekStart.getDate() + 7)) {
    const days = [];

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
      days.push({
        dateString,
        color,
        monthEdges: {
          left: currentDate.getDate() === 1 && currentDate.getDay() !== 1,
          top: currentDate >= firstOfMonth && isSameCalendarWeek(currentDate, firstOfMonth),
          right: currentDate.getDate() === lastOfMonth.getDate() && currentDate.getDay() !== 0,
          bottom: currentDate <= lastOfMonth && isSameCalendarWeek(currentDate, lastOfMonth)
        }
      });
    }

    weeks.push({ weekNumber, days });
  }

  return weeks;
}

// `sides` maps each weeks-down edge to the CSS side it is drawn on in this layout.
function renderCalendarDayCell(day, sides) {
  const borders = Object.keys(sides)
    .filter((edge) => day.monthEdges[edge])
    .map((edge) => `border-${sides[edge]}:2px solid black`);
  const borderStyle = borders.length ? `${borders.join(';')};` : '';
  const note = calendarWritableDays
    ? `<input type="text" class="calendar-note" data-date="${day.dateString}" maxlength="80" aria-label="Note for ${day.dateString}" value="${escapeCalendarText(calendarNotes[day.dateString] || '')}">`
    : '';
  return `<td data-date="${day.dateString}" title="${day.dateString}" style="background-color:${day.color};border:1px solid grey;${borderStyle}">${note}</td>`;
}

function escapeCalendarText(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

// Vertical layout: a row per week, weekdays along the top.
function renderCalendarWeeksDown(weeks) {
  const sides = { left: 'left', top: 'top', right: 'right', bottom: 'bottom' };
  const headerRow = `<tr><th class="week-column">Week</th>${CALENDAR_DAY_LABELS.map((label) => `<th class="day-column">${label}</th>`).join('')}</tr>`;
  const rows = weeks.map((week) =>
    `<tr><td>Week ${week.weekNumber}</td>${week.days.map((day) => renderCalendarDayCell(day, sides)).join('')}</tr>`
  ).join('');
  return `<table class="calendar-weeks-down" border="1" style="border-collapse: collapse;">${headerRow}${rows}</table>`;
}

// Horizontal layout: a regular month calendar (days left to right, Monday first) for
// each visible month of the year, laid side by side. Days outside the visible range
// (before the start week, after the end date) are left blank.
function renderCalendarMonths(weeks, year, firstMonth) {
  if (!weeks.length) return '<p class="settings-empty">No weeks to show yet.</p>';
  const daysByDate = new Map();
  const weekNumberByDate = new Map();
  weeks.forEach((week) => week.days.forEach((day) => {
    daysByDate.set(day.dateString, day);
    weekNumberByDate.set(day.dateString, week.weekNumber);
  }));
  const lastDate = new Date(`${weeks[weeks.length - 1].days[6].dateString}T00:00`);
  const lastMonth = lastDate.getFullYear() > year ? 11 : lastDate.getMonth();
  const blank = '<td class="calendar-blank"></td>';
  // Fixed column widths, so a merged header cell can't stretch the columns
  const monthColumns = `<colgroup><col class="calendar-week-col">${'<col class="calendar-day-col">'.repeat(7)}</colgroup>`;

  const months = [];
  for (let month = firstMonth; month <= lastMonth; month++) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = (new Date(year, month, 1).getDay() + 6) % 7; // days before the 1st in its week
    const cells = Array(offset).fill(blank);
    // Each row is one Monday-to-Sunday week; its number comes from any visible day in it
    const rowWeekNumbers = [];
    for (let date = 1; date <= daysInMonth; date++) {
      const dateString = formatCalendarDate(new Date(year, month, date));
      const day = daysByDate.get(dateString);
      cells.push(day ? renderCalendarDayCell(day, {}) : blank);
      const row = Math.floor((cells.length - 1) / 7);
      if (day && rowWeekNumbers[row] === undefined) rowWeekNumbers[row] = weekNumberByDate.get(dateString);
    }
    while (cells.length % 7) cells.push(blank);

    // Weekday labels for the columns before the 1st drop into the first week's empty cells,
    // so the header steps down to meet the month. That week began in the previous month,
    // so it gets no week number. If the first week is hidden, the header stays in one row.
    const dropLabels = offset > 0 && rowWeekNumbers[0] !== undefined;
    // The empty grey area (corner, cells above the dropped labels, and the week cell beside them)
    // is one merged header cell plus the week cell below it with the border between them hidden.
    const labels = CALENDAR_DAY_LABELS.map((label, col) => (dropLabels && col < offset ? '' : `<th>${label}</th>`)).join('');
    const name = new Date(year, month, 1).toLocaleString('en', { month: 'long' });
    // Months starting Thursday to Sunday (Wednesday to Sunday with the wider writable cells) have
    // room for the name in the top row, in place of the grey block, which saves a row.
    const nameInHeader = dropLabels && offset >= (calendarWritableDays ? 2 : 3);
    const corner = nameInHeader
      ? `<th class="calendar-month-name" colspan="${offset + 1}">${name}</th>`
      : `<th class="calendar-week-number"${dropLabels ? ` colspan="${offset + 1}"` : ''}></th>`;
    // Other months get a full-width name row, so every month has a square top with the name inside
    const nameRow = nameInHeader ? '' : `<tr><th class="calendar-month-name" colspan="8">${name}</th></tr>`;
    let rows = `${nameRow}<tr>${corner}${labels}</tr>`;
    for (let i = 0; i < cells.length; i += 7) {
      if (rowWeekNumbers[i / 7] === undefined) continue; // week outside the visible range
      if (i === 0 && dropLabels) {
        for (let col = 0; col < offset; col++) cells[col] = `<th>${CALENDAR_DAY_LABELS[col]}</th>`;
        rows += `<tr><th class="calendar-week-number${nameInHeader ? '' : ' calendar-corner-below'}"></th>${cells.slice(0, 7).join('')}</tr>`;
      } else {
        rows += `<tr><th class="calendar-week-number">${rowWeekNumbers[i / 7]}</th>${cells.slice(i, i + 7).join('')}</tr>`;
      }
    }
    months.push(`<table class="calendar-month">${monthColumns}${rows}</table>`);
  }
  // Normal: up to 6 months per row in as few rows as possible, balanced with any extra months
  // in the first rows (7 = 4+3, 11 = 6+5). Writable days: full rows of 3, leftovers last (7 = 3+3+1).
  const rowSizes = [];
  if (calendarWritableDays) {
    for (let left = months.length; left > 0; left -= 3) rowSizes.push(Math.min(3, left));
  } else {
    const rowCount = Math.ceil(months.length / 6);
    for (let row = 0; row < rowCount; row++) {
      rowSizes.push(Math.floor(months.length / rowCount) + (row < months.length % rowCount ? 1 : 0));
    }
  }
  let monthRows = '';
  let start = 0;
  rowSizes.forEach((size) => {
    monthRows += `<div class="calendar-months-row">${months.slice(start, start + size).join('')}</div>`;
    start += size;
  });
  return `<div class="calendar-months">${monthRows}</div>`;
}

async function createCalendar(year = new Date().getFullYear()) {
  await calendarSettingsReady;
  const container = document.getElementById("calendar-container");
  if (!container) return;

  container.classList.toggle('calendar-writable', calendarWritableDays);
  if (calendarWritableDays) {
    try {
      calendarNotes = (await database.ref('calendarNotes').once('value')).val() || {};
    } catch (error) {
      console.error('Error loading calendar notes:', error);
    }
  }

  if (calendarLayout === 'vertical') {
    container.innerHTML = renderCalendarWeeksDown(await buildCalendarWeeks(year));
    return;
  }

  // Month layout: start at the week holding the 1st of the start month (current year only)
  const firstMonth = year === new Date().getFullYear() ? calendarStartMonth - 1 : 0;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const firstWeek = Math.round((getCalendarWeekStart(new Date(year, firstMonth, 1)) - getCalendarWeekStart(new Date(year, 0, 1))) / msPerWeek) + 1;
  container.innerHTML = renderCalendarMonths(await buildCalendarWeeks(year, firstWeek), year, firstMonth);
}



