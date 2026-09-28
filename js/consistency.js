const consistencyToggleButton = document.getElementById('toggleConsistencyBtn');
const consistencyArea = document.getElementById('consistencyarea');
const consistencyList = document.getElementById('consistencyList');
const consistencyEmptyMessage = document.getElementById('consistencyEmptyMessage');

function parseConsistencyDate(workout) {
  const dateValue = workout.date || workout.createdAt || workout.timestamp || workout.dateString;
  if (!dateValue) return null;

  const parsed = new Date(dateValue);
  if (!isNaN(parsed)) return parsed;

  const numeric = new Date(parseInt(dateValue, 10));
  return !isNaN(numeric) ? numeric : null;
}

function loadConsistencyData() {
  if (!consistencyList || !consistencyEmptyMessage) return;

  consistencyList.innerHTML = '';
  consistencyEmptyMessage.textContent = 'Loading consistency data...';
  consistencyEmptyMessage.style.display = 'block';

  database.ref('workouts').once('value').then(snapshot => {
    const workouts = snapshot.val();

    if (!workouts) {
      consistencyEmptyMessage.textContent = 'No workouts saved yet.';
      return;
    }

    const workoutDates = Object.values(workouts)
      .map(parseConsistencyDate)
      .filter(Boolean)
      .map(date => date.toISOString().slice(0, 10));

    const uniqueDates = [...new Set(workoutDates)].sort();

    if (uniqueDates.length === 0) {
      consistencyEmptyMessage.textContent = 'No workout dates found.';
      return;
    }

    consistencyEmptyMessage.style.display = 'none';

    const totalDays = uniqueDates.length;
    const startDate = new Date(uniqueDates[0]);
    const endDate = new Date(uniqueDates[uniqueDates.length - 1]);
    const daySpan = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
    const consistencyPercent = Math.round((totalDays / daySpan) * 100);

    const item = document.createElement('li');
    item.innerHTML = `
      <strong>${consistencyPercent}%</strong> of the days between ${uniqueDates[0]} and ${uniqueDates[uniqueDates.length - 1]} include a logged workout.
      <br>
      <span style="color:#666;">Tracked workout days: ${totalDays}</span>
    `;
    consistencyList.appendChild(item);
  }).catch(error => {
    consistencyEmptyMessage.textContent = `Error loading consistency data: ${error.message}`;
  });
}

if (consistencyToggleButton && consistencyArea) {
  consistencyToggleButton.addEventListener('click', () => {
    consistencyArea.classList.toggle('hidden');
    consistencyToggleButton.textContent = consistencyArea.classList.contains('hidden') ? 'Show Consistency' : 'Hide Consistency';
    if (!consistencyArea.classList.contains('hidden')) {
      loadConsistencyData();
    }
  });
}
