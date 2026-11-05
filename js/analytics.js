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
  const exerciseFilter = document.getElementById('calendarExerciseFilter');

  if (calendarContainer.classList.contains('hidden') || calendarContainer.style.display === 'none') {
    // Show calendar, with the exercise filter back on All
    calendarHiddenExercises.clear();
    const year = parseInt(yearSelector.value, 10);
    await createCalendar(year);
    calendarContainer.style.display = 'block';
    yearSelector.style.display = 'inline';
    syncCalendarModeControls();
  } else {
    // Hide calendar
    await flushInjuryNoteSave();
    calendarContainer.innerHTML = '';
    calendarContainer.style.display = 'none';
    yearSelector.style.display = 'none';
    exerciseFilter.open = false;
    setCalendarBrush(null);
    openCalendarHue(null);
    calendarColorBarOpen = false;
    syncCalendarModeControls();
    document.getElementById('calendarDayCount').textContent = '';
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
// The "x of y days" text beside the exercise filter; saved as settings/calendar/showDayCount
let showCalendarDayCount = true;
const calendarDayCountCheckbox = document.getElementById('calendarDayCountSetting');

function applyCalendarDayCountVisibility() {
  const label = document.getElementById('calendarDayCount');
  if (label) label.hidden = !showCalendarDayCount;
  if (calendarDayCountCheckbox) calendarDayCountCheckbox.checked = showCalendarDayCount;
}

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
    showCalendarDayCount = settings.showDayCount !== false;
    applyCalendarDayCountVisibility();
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

if (calendarDayCountCheckbox) {
  calendarDayCountCheckbox.addEventListener('change', async () => {
    await calendarSettingsReady;
    showCalendarDayCount = calendarDayCountCheckbox.checked;
    applyCalendarDayCountVisibility();
    try {
      await database.ref('settings/calendar/showDayCount').set(showCalendarDayCount);
    } catch (error) {
      console.error('Error saving day count setting:', error);
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
async function buildCalendarWeeks(year, firstVisibleWeek, workoutsByDate) {
  workoutsByDate ??= await groupWorkoutsByDate();
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

      // Only workouts that pass the exercise filter colour the day, at their highest intensity
      const color = getCalendarDayColor(dateString, workoutsByDate, todayString);

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
  const note = calendarShowsNoteInputs()
    ? `<input type="text" class="calendar-note" data-date="${day.dateString}" maxlength="80" aria-label="Note for ${day.dateString}" value="${escapeCalendarText(calendarNotes[day.dateString] || '')}">`
    : '';
  const classes = [];
  if (injuryMonitorActive && injuryNotes[day.dateString]) classes.push('has-injury-note');
  if (injuryMonitorActive && day.dateString === injurySelectedDate) classes.push('is-selected');
  const classAttr = classes.length ? ` class="${classes.join(' ')}"` : '';
  return `<td data-date="${day.dateString}"${classAttr} title="${day.dateString}" style="background-color:${day.color};border:1px solid grey;${borderStyle}">${note}</td>`;
}

// --- Injury monitor and day colours ---
// The injury monitor is the same calendar without workout colours. Clicking a day there shows
// its note (injuryMonitor/notes/<date>) in the box under the calendar. Either calendar's days
// can be painted; the colours are kept apart (calendarColors/<date>, injuryMonitor/colors/<date>).
let injuryMonitorActive = false;
let injurySelectedDate = formatCalendarDate(new Date());
let injuryNotes = {};
let injuryDayColors = {};
let calendarDayColors = {};
let calendarBrush = null; // null = not painting, '' = remove colour, '#rrggbb' = paint
let calendarColorBarOpen = false;
let injuryNoteSaveTimer = null;
const CALENDAR_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

// Inline notes are a normal-calendar setting; the injury monitor uses the box below instead
function calendarShowsNoteInputs() {
  return calendarWritableDays && !injuryMonitorActive;
}

function getActiveDayColors() {
  return injuryMonitorActive ? injuryDayColors : calendarDayColors;
}

function getActiveDayColorPath(date) {
  return injuryMonitorActive ? `injuryMonitor/colors/${date}` : `calendarColors/${date}`;
}

// Keep only well-formed colours, since they go straight into a style attribute
function cleanCalendarColors(colors) {
  return Object.fromEntries(Object.entries(colors || {}).filter(([, color]) => CALENDAR_COLOR_PATTERN.test(color)));
}

// A day's colour with nothing painted on it: green for a workout matching the exercise filter
// (normal calendar only), yellow for today, grey for past days, white for later ones
function getCalendarDefaultDayColor(dateString, workoutsByDate, todayString = formatCalendarDate(new Date())) {
  const hasWorkout = !injuryMonitorActive
    && (workoutsByDate?.[dateString]?.workouts || []).some(workoutMatchesCalendarFilter);
  if (hasWorkout) return getIntensityColor();
  if (dateString === todayString) return 'rgb(255, 255, 146)';
  if (dateString < todayString) return 'rgb(233, 233, 233)';
  return 'rgb(255, 255, 255)';
}

function getCalendarDayColor(dateString, workoutsByDate, todayString) {
  return getActiveDayColors()[dateString] || getCalendarDefaultDayColor(dateString, workoutsByDate, todayString);
}

// Show the controls that belong to the open calendar
function syncCalendarModeControls() {
  const open = document.getElementById('calendar-container')?.style.display !== 'none';
  const exerciseFilter = document.getElementById('calendarExerciseFilter');
  if (exerciseFilter) {
    exerciseFilter.style.display = open && !injuryMonitorActive ? '' : 'none';
    if (injuryMonitorActive) exerciseFilter.open = false;
  }
  const injuryButton = document.getElementById('injuryMonitorBtn');
  if (injuryButton) {
    injuryButton.style.display = open ? '' : 'none';
    injuryButton.setAttribute('aria-pressed', String(injuryMonitorActive));
  }
  const colorButton = document.getElementById('calendarColorBtn');
  if (colorButton) {
    colorButton.style.display = open ? '' : 'none';
    colorButton.setAttribute('aria-pressed', String(calendarColorBarOpen));
  }
  const colorBar = document.getElementById('calendarColorBar');
  if (colorBar) colorBar.hidden = !(open && calendarColorBarOpen);
  const notePanel = document.getElementById('injuryNotePanel');
  if (notePanel) notePanel.hidden = !(open && injuryMonitorActive);
  if (open && injuryMonitorActive) showInjuryNote(injurySelectedDate);
}

// `swatch` is the control that chose the colour, highlighted while it is in use
function setCalendarBrush(color, swatch = null) {
  calendarBrush = color;
  document.querySelectorAll('#calendarColorBar .calendar-swatch').forEach((element) => {
    const active = color !== null && element === swatch;
    element.classList.toggle('is-active', active);
    if (element.tagName === 'BUTTON') element.setAttribute('aria-pressed', String(active));
  });
  document.getElementById('calendar-container')?.classList.toggle('calendar-painting', color !== null);
}

async function paintCalendarDay(cell) {
  const date = cell.dataset.date;
  const colors = getActiveDayColors();
  const previous = colors[date];
  const color = calendarBrush || undefined;
  if (previous === color) return;
  const path = getActiveDayColorPath(date);
  if (color) colors[date] = color;
  else delete colors[date];
  cell.style.backgroundColor = getCalendarDayColor(date, calendarWorkoutsCache);
  try {
    if (color) await database.ref(path).set(color);
    else await database.ref(path).remove();
  } catch (error) {
    if (previous) colors[date] = previous;
    else delete colors[date];
    cell.style.backgroundColor = getCalendarDayColor(date, calendarWorkoutsCache);
    console.error('Error saving day colour:', error);
  }
}

function formatInjuryNoteDate(date) {
  return new Date(`${date}T00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function showInjuryNote(date) {
  const textarea = document.getElementById('injuryNoteText');
  const label = document.getElementById('injuryNoteLabel');
  if (!textarea) return;
  if (textarea.dataset.date !== date) {
    textarea.dataset.date = date;
    textarea.value = injuryNotes[date] || '';
    document.getElementById('injuryNoteStatus').textContent = '';
  }
  if (label) label.textContent = `Note for ${formatInjuryNoteDate(date)}`;
}

async function selectInjuryDay(date) {
  await flushInjuryNoteSave();
  injurySelectedDate = date;
  document.querySelectorAll('#calendar-container td.is-selected').forEach((cell) => cell.classList.remove('is-selected'));
  document.querySelector(`#calendar-container td[data-date="${date}"]`)?.classList.add('is-selected');
  showInjuryNote(date);
}

// Saves the note box to the day it is showing; an empty note is deleted
async function saveInjuryNote() {
  clearTimeout(injuryNoteSaveTimer);
  injuryNoteSaveTimer = null;
  const textarea = document.getElementById('injuryNoteText');
  const status = document.getElementById('injuryNoteStatus');
  const date = textarea?.dataset.date;
  if (!date) return;
  const text = textarea.value.trim();
  if (text === (injuryNotes[date] || '')) return;
  try {
    const noteRef = database.ref(`injuryMonitor/notes/${date}`);
    if (text) {
      await noteRef.set(text);
      injuryNotes[date] = text;
    } else {
      await noteRef.remove();
      delete injuryNotes[date];
    }
    document.querySelector(`#calendar-container td[data-date="${date}"]`)?.classList.toggle('has-injury-note', Boolean(text));
    if (textarea.dataset.date === date) status.textContent = 'Saved';
  } catch (error) {
    if (textarea.dataset.date === date) status.textContent = "Couldn't save";
    console.error('Error saving injury note:', error);
  }
}

function flushInjuryNoteSave() {
  return injuryNoteSaveTimer ? saveInjuryNote() : Promise.resolve();
}

const injuryNoteTextarea = document.getElementById('injuryNoteText');
if (injuryNoteTextarea) {
  injuryNoteTextarea.addEventListener('input', () => {
    document.getElementById('injuryNoteStatus').textContent = '';
    clearTimeout(injuryNoteSaveTimer);
    injuryNoteSaveTimer = setTimeout(saveInjuryNote, 800);
  });
  injuryNoteTextarea.addEventListener('change', saveInjuryNote);
}

document.getElementById('injuryMonitorBtn')?.addEventListener('click', async () => {
  await flushInjuryNoteSave();
  injuryMonitorActive = !injuryMonitorActive;
  syncCalendarModeControls();
  await rerenderCalendarIfOpen();
});

document.getElementById('calendarColorBtn')?.addEventListener('click', () => {
  calendarColorBarOpen = !calendarColorBarOpen;
  if (!calendarColorBarOpen) {
    setCalendarBrush(null);
    openCalendarHue(null);
  }
  syncCalendarModeControls();
});

// Six main colours; clicking one opens a row of its six shades, light to strong. Stored as #rrggbb.
// Hand-picked clean scales (Tailwind's 50-500); yellow starts a step lighter so its strongest shade isn't mustard
const CALENDAR_SWATCH_HUES = [
  ['Red', ['#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444']],
  ['Orange', ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316']],
  ['Yellow', ['#fefdf0', '#fefce8', '#fef9c3', '#fef08a', '#fde047', '#facc15']],
  ['Green', ['#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e']],
  ['Blue', ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6']],
  ['Purple', ['#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7']]
];
const CALENDAR_MAIN_SHADE = 3; // the shade shown on the main colour, and picked when it opens

// Shades for a colour from the system picker: its hue and saturation at these lightnesses
// (close to the main colours' scales), with the exact pick in the slot nearest its own lightness
const CALENDAR_CUSTOM_LIGHTNESS = [97, 93, 87, 78, 68, 58];

function hexToHsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (!delta) return [0, 0, lightness * 100];
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return [(hue * 60 + 360) % 360, saturation * 100, lightness * 100];
}

function hslToHex(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const channel = (n) => {
    const k = (n + hue / 30) % 12;
    const value = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function getCustomCalendarShades(hex) {
  const [hue, saturation, lightness] = hexToHsl(hex);
  const shades = CALENDAR_CUSTOM_LIGHTNESS.map((level) => hslToHex(hue, saturation, level));
  let picked = 0;
  CALENDAR_CUSTOM_LIGHTNESS.forEach((level, index) => {
    if (Math.abs(level - lightness) < Math.abs(CALENDAR_CUSTOM_LIGHTNESS[picked] - lightness)) picked = index;
  });
  shades[picked] = hex.toLowerCase();
  return { shades, picked };
}

const calendarHueRow = document.getElementById('calendarHueRow');
const calendarShadeRow = document.getElementById('calendarShadeRow');
const calendarCustomInput = document.getElementById('calendarCustomColor');
if (calendarHueRow) {
  calendarHueRow.innerHTML = CALENDAR_SWATCH_HUES.map(([name, shades], index) => {
    const color = shades[CALENDAR_MAIN_SHADE];
    return `<button type="button" class="calendar-hue" data-hue-index="${index}" style="--swatch: ${color};" title="${name}" aria-label="${name}" aria-expanded="false" aria-controls="calendarShadeRow"></button>`;
  }).join('');
}

// Open the shade row for a main colour (its index) or the picker's colour ('custom'), or close
// it with null. Returns the shade to start painting with.
function openCalendarHue(index) {
  calendarHueRow?.querySelectorAll('.calendar-hue').forEach((button) => {
    const open = Number(button.dataset.hueIndex) === index;
    button.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
  });
  calendarCustomInput?.classList.toggle('is-open', index === 'custom');
  if (!calendarShadeRow) return null;
  calendarShadeRow.hidden = index === null;
  if (index === null) {
    calendarShadeRow.innerHTML = '';
    return null;
  }
  let name = 'Custom';
  let shades;
  let start = CALENDAR_MAIN_SHADE;
  if (index === 'custom') {
    ({ shades, picked: start } = getCustomCalendarShades(calendarCustomInput.value));
  } else {
    [name, shades] = CALENDAR_SWATCH_HUES[index];
  }
  calendarShadeRow.innerHTML = shades.map((color, shade) => {
    const label = `${name}, shade ${shade + 1} of ${shades.length}`;
    return `<button type="button" class="calendar-swatch" data-color="${color}" style="--swatch: ${color};" title="${label}" aria-label="${label}"></button>`;
  }).join('');
  return calendarShadeRow.querySelectorAll('.calendar-swatch')[start] || null;
}

// Open a colour's shades and start painting with its starting shade
function startCalendarHue(index) {
  const shade = openCalendarHue(index);
  if (shade) setCalendarBrush(shade.dataset.color, shade);
}

const calendarColorBar = document.getElementById('calendarColorBar');
if (calendarColorBar) {
  calendarColorBar.addEventListener('click', (event) => {
    // A main colour opens its shades and starts painting with the middle one;
    // clicking the open one again closes them and stops painting
    const hueButton = event.target.closest('button.calendar-hue');
    if (hueButton) {
      if (hueButton.classList.contains('is-open')) {
        openCalendarHue(null);
        setCalendarBrush(null);
      } else {
        startCalendarHue(Number(hueButton.dataset.hueIndex));
      }
      return;
    }
    const swatch = event.target.closest('button.calendar-swatch');
    if (!swatch) return;
    // Clicking the chosen swatch again stops painting
    if (swatch.classList.contains('is-active')) setCalendarBrush(null);
    else setCalendarBrush(swatch.dataset.color, swatch);
    // The eraser isn't a colour, so it closes the open main colour (its ring and shades)
    if (swatch.classList.contains('calendar-swatch-clear')) openCalendarHue(null);
  });
  // The rainbow circle opens the system colour picker; its colour gets shades like a main colour,
  // with the exact pick chosen
  const useCustomColor = () => startCalendarHue('custom');
  calendarCustomInput?.addEventListener('click', useCustomColor);
  calendarCustomInput?.addEventListener('input', useCustomColor);
}

// Clicking a day paints it while a colour is chosen, and in the injury monitor opens its note
if (document.getElementById('calendar-container')) {
  document.getElementById('calendar-container').addEventListener('click', (event) => {
    const cell = event.target.closest('td[data-date]');
    if (!cell) return;
    if (calendarBrush !== null) paintCalendarDay(cell);
    if (injuryMonitorActive) selectInjuryDay(cell.dataset.date);
  });
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
    const nameInHeader = dropLabels && offset >= (calendarShowsNoteInputs() ? 2 : 3);
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
        rows += `<tr><th class="calendar-week-number">${rowWeekNumbers[0]}</th>${cells.slice(0, 7).join('')}</tr>`;
      } else {
        rows += `<tr><th class="calendar-week-number">${rowWeekNumbers[i / 7]}</th>${cells.slice(i, i + 7).join('')}</tr>`;
      }
    }
    months.push(`<table class="calendar-month">${monthColumns}${rows}</table>`);
  }
  // All months go in one wrapping row, capped by CSS at this many per row:
  // normal = up to 6, in as few rows as possible (7 = 4+3, 11 = 6+5); writable days = 3.
  // On narrower screens the months then wrap evenly (5+5+2) instead of each row
  // splitting on its own (5+1, 5+1).
  const perRow = calendarShowsNoteInputs()
    ? Math.min(3, months.length)
    : Math.ceil(months.length / Math.ceil(months.length / 6));
  return `<div class="calendar-months"><div class="calendar-months-row" style="--months-per-row:${perRow}">${months.join('')}</div></div>`;
}

// --- Exercise filter ---
// Exercises are unticked by adding them to this set, so with nothing in it every
// workout counts, including ones with no exercises logged.
const calendarHiddenExercises = new Set();
let calendarExerciseNames = []; // most-done first
let calendarWorkoutsCache = null; // workouts from the last full load, reused when the filter changes

function getWorkoutExerciseNames(workout) {
  return Object.values(workout?.exercises || {})
    .map((exercise) => String(exercise?.name ?? '').trim())
    .filter(Boolean);
}

function workoutMatchesCalendarFilter(workout) {
  if (calendarHiddenExercises.size === 0) return true;
  return getWorkoutExerciseNames(workout).some((name) => !calendarHiddenExercises.has(name));
}

function updateCalendarExerciseLabel() {
  const label = document.getElementById('calendarExerciseFilterLabel');
  if (!label) return;
  const shown = calendarExerciseNames.filter((name) => !calendarHiddenExercises.has(name));
  let text = 'All';
  if (calendarHiddenExercises.size > 0) {
    if (shown.length === 0) text = 'None';
    else if (shown.length === 1) text = shown[0];
    else text = `${shown.length} of ${calendarExerciseNames.length}`;
  }
  label.textContent = `Exercises: ${text}`;
}

// Rebuild the checkbox list from every workout, most-done exercise first
function populateCalendarExerciseFilter(workoutsByDate) {
  const counts = new Map();
  Object.values(workoutsByDate).forEach(({ workouts }) => workouts.forEach((workout) => {
    new Set(getWorkoutExerciseNames(workout)).forEach((name) => counts.set(name, (counts.get(name) || 0) + 1));
  }));
  calendarExerciseNames = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
  // Forget unticked exercises that no longer exist, so they can't hide everything
  [...calendarHiddenExercises].forEach((name) => { if (!counts.has(name)) calendarHiddenExercises.delete(name); });

  const list = document.getElementById('calendarExerciseList');
  if (list) {
    list.innerHTML = calendarExerciseNames.length
      ? calendarExerciseNames.map((name) => `<label><input type="checkbox" value="${escapeCalendarText(name)}"${calendarHiddenExercises.has(name) ? '' : ' checked'}> ${escapeCalendarText(name)}</label>`).join('')
      : '<div class="settings-empty">No exercises logged yet</div>';
  }
  filterCalendarExerciseList();
  updateCalendarExerciseLabel();
}

// Hides exercises that don't contain the search text, like the exercise picker's search
function filterCalendarExerciseList() {
  const query = (document.getElementById('calendarExerciseSearch')?.value || '').trim().toLowerCase();
  let anyMatch = false;
  document.querySelectorAll('#calendarExerciseList label').forEach((label) => {
    const matches = !query || label.textContent.toLowerCase().includes(query);
    label.hidden = !matches;
    if (matches) anyMatch = true;
  });
  const empty = document.getElementById('calendarExerciseEmpty');
  if (empty) empty.hidden = anyMatch || calendarExerciseNames.length === 0;
}

// The checkboxes currently showing (all of them when there's no search)
function getVisibleCalendarExerciseBoxes() {
  return [...document.querySelectorAll('#calendarExerciseList label:not([hidden]) input[type="checkbox"]')];
}

function rerenderCalendarFromCache() {
  updateCalendarExerciseLabel();
  if (!calendarWorkoutsCache) return;
  renderCalendar(Number(document.getElementById('calendar-year-filter').value), calendarWorkoutsCache);
}

const calendarExerciseFilterElement = document.getElementById('calendarExerciseFilter');
if (calendarExerciseFilterElement) {
  calendarExerciseFilterElement.addEventListener('change', (event) => {
    const checkbox = event.target.closest('#calendarExerciseList input[type="checkbox"]');
    if (!checkbox) return;
    if (checkbox.checked) calendarHiddenExercises.delete(checkbox.value);
    else calendarHiddenExercises.add(checkbox.value);
    rerenderCalendarFromCache();
  });
  calendarExerciseFilterElement.addEventListener('click', (event) => {
    const button = event.target.closest('[data-calendar-select]');
    if (!button) return;
    // While searching, only the matching exercises are selected or deselected
    const selectAll = button.dataset.calendarSelect === 'all';
    getVisibleCalendarExerciseBoxes().forEach((box) => {
      box.checked = selectAll;
      if (selectAll) calendarHiddenExercises.delete(box.value);
      else calendarHiddenExercises.add(box.value);
    });
    rerenderCalendarFromCache();
  });
  const calendarExerciseSearch = document.getElementById('calendarExerciseSearch');
  calendarExerciseSearch?.addEventListener('input', filterCalendarExerciseList);
  // Enter ticks or unticks the first match
  calendarExerciseSearch?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    getVisibleCalendarExerciseBoxes()[0]?.click();
  });
  // Opening the list starts with an empty search box, ready to type in
  calendarExerciseFilterElement.addEventListener('toggle', () => {
    if (!calendarExerciseFilterElement.open || !calendarExerciseSearch) return;
    calendarExerciseSearch.value = '';
    filterCalendarExerciseList();
    calendarExerciseSearch.focus();
  });
  // Close the list when clicking elsewhere or pressing Escape
  document.addEventListener('click', (event) => {
    if (calendarExerciseFilterElement.open && !calendarExerciseFilterElement.contains(event.target)) {
      calendarExerciseFilterElement.open = false;
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && calendarExerciseFilterElement.open) {
      calendarExerciseFilterElement.open = false;
      calendarExerciseFilterElement.querySelector('summary').focus();
    }
  });
}

async function createCalendar(year = new Date().getFullYear()) {
  await calendarSettingsReady;
  const container = document.getElementById("calendar-container");
  if (!container) return;

  calendarWorkoutsCache = await groupWorkoutsByDate();
  populateCalendarExerciseFilter(calendarWorkoutsCache);

  container.classList.toggle('calendar-writable', calendarShowsNoteInputs());
  container.classList.toggle('calendar-injury', injuryMonitorActive);
  if (calendarShowsNoteInputs()) {
    try {
      calendarNotes = (await database.ref('calendarNotes').once('value')).val() || {};
    } catch (error) {
      console.error('Error loading calendar notes:', error);
    }
  }
  try {
    if (injuryMonitorActive) {
      await flushInjuryNoteSave();
      const injuryData = (await database.ref('injuryMonitor').once('value')).val() || {};
      injuryNotes = injuryData.notes || {};
      injuryDayColors = cleanCalendarColors(injuryData.colors);
      // Make the note box reload its text from the fresh notes
      const noteBox = document.getElementById('injuryNoteText');
      if (noteBox) delete noteBox.dataset.date;
    } else {
      calendarDayColors = cleanCalendarColors((await database.ref('calendarColors').once('value')).val());
    }
  } catch (error) {
    console.error('Error loading calendar colours and notes:', error);
  }

  await renderCalendar(year, calendarWorkoutsCache);
  if (injuryMonitorActive) syncCalendarModeControls();
}

// "x of y days this year": days with a workout matching the filter, out of the days so far
// (the whole year for past years). When the current year's calendar starts later via the
// start month / start week settings, counting starts there too ("since April", "since week 12").
function updateCalendarDayCount(year, workoutsByDate) {
  const label = document.getElementById('calendarDayCount');
  if (!label) return;
  if (injuryMonitorActive) {
    label.textContent = ''; // workout days aren't shown in the injury monitor
    return;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isCurrentYear = year === today.getFullYear();
  let firstDay = new Date(year, 0, 1);
  let when = isCurrentYear ? 'this year' : `in ${year}`;
  if (isCurrentYear && calendarLayout === 'horizontal' && calendarStartMonth > 1) {
    firstDay = new Date(year, calendarStartMonth - 1, 1);
    when = `since ${firstDay.toLocaleString('en', { month: 'long' })}`;
  } else if (isCurrentYear && calendarLayout === 'vertical' && calendarStartWeek > 1) {
    firstDay = getCalendarWeekStart(new Date(year, 0, 1));
    firstDay.setDate(firstDay.getDate() + (calendarStartWeek - 1) * 7);
    when = `since week ${calendarStartWeek}`;
  }
  const lastDay = isCurrentYear ? today : new Date(year, 11, 31);
  if (firstDay > lastDay) {
    label.textContent = ''; // nothing to count yet (a future year, or a start after today)
    return;
  }
  let totalDays = 0;
  let workoutDays = 0;
  for (const date = new Date(firstDay); date <= lastDay; date.setDate(date.getDate() + 1)) {
    totalDays++;
    if (workoutsByDate[formatCalendarDate(date)]?.workouts.some(workoutMatchesCalendarFilter)) workoutDays++;
  }
  label.textContent = `${workoutDays} of ${totalDays} days ${when}`;
}

// Draw the calendar from already-loaded workouts
async function renderCalendar(year, workoutsByDate) {
  const container = document.getElementById("calendar-container");
  if (!container) return;
  updateCalendarDayCount(year, workoutsByDate);

  if (calendarLayout === 'vertical') {
    container.innerHTML = renderCalendarWeeksDown(await buildCalendarWeeks(year, undefined, workoutsByDate));
    alignCalendarBars();
    return;
  }

  // Month layout: start at the week holding the 1st of the start month (current year only)
  const firstMonth = year === new Date().getFullYear() ? calendarStartMonth - 1 : 0;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const firstWeek = Math.round((getCalendarWeekStart(new Date(year, firstMonth, 1)) - getCalendarWeekStart(new Date(year, 0, 1))) / msPerWeek) + 1;
  container.innerHTML = renderCalendarMonths(await buildCalendarWeeks(year, firstWeek, workoutsByDate), year, firstMonth);
  alignCalendarBars();
}

// The bars above the calendar span the page, but the calendar is centred and narrower. Pad the
// bars so their left and right ends line up with the calendar's. Re-measured whenever the
// calendar changes size (a render, a window resize, showing or hiding it).
function alignCalendarBars() {
  const container = document.getElementById('calendar-container');
  const bars = [document.getElementById('showcal'), document.getElementById('calendarColorBar')].filter(Boolean);
  // Nothing to measure while the calendar is hidden; the observer runs again once it shows
  const parts = container?.offsetWidth ? [...container.querySelectorAll('.calendar-month, .calendar-weeks-down')] : [];
  if (!parts.length) {
    bars.forEach((bar) => { bar.style.paddingLeft = ''; bar.style.paddingRight = ''; });
    return;
  }
  const left = Math.min(...parts.map((part) => part.getBoundingClientRect().left));
  const right = Math.max(...parts.map((part) => part.getBoundingClientRect().right));
  bars.forEach((bar) => {
    const box = bar.getBoundingClientRect();
    // A hidden bar has no box; measure against the calendar container instead
    const barLeft = box.width ? box.left : container.getBoundingClientRect().left;
    const barRight = box.width ? box.right : container.getBoundingClientRect().right;
    bar.style.paddingLeft = `${Math.max(0, Math.round(left - barLeft))}px`;
    bar.style.paddingRight = `${Math.max(0, Math.round(barRight - right))}px`;
  });
}

if (window.ResizeObserver && document.getElementById('calendar-container')) {
  new ResizeObserver(alignCalendarBars).observe(document.getElementById('calendar-container'));
}



