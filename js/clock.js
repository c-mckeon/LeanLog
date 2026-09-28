const validateBtn = document.getElementById('validateBtn');
const pauseDiv = document.querySelector('#pauseBtn').parentElement;
const resetDiv = document.querySelector('#resetBtn').parentElement;
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');

let timerInterval = null;
let paused = false;
let elapsedTime = 0;
let startTime = null;

function updateClockDisplay() {
  const totalElapsed = paused ? elapsedTime : Date.now() - startTime;
  const hours = Math.floor(totalElapsed / (1000 * 60 * 60));
  const minutes = Math.floor((totalElapsed % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((totalElapsed % (1000 * 60)) / 1000);

  validateBtn.textContent = `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function startClock() {
  validateBtn.style.backgroundColor = 'white';
  validateBtn.style.borderColor = 'black';
  validateBtn.style.color = 'black';

  if (timerInterval) {
    clearInterval(timerInterval);
  }

  timerInterval = setInterval(() => {
    if (!paused) {
      updateClockDisplay();
    }
  }, 1000);
}

function checkLastClick() {
  const db = window.database;
  if (!db) {
    console.error('Clock: database is not available.');
    return;
  }

  db.ref('access_logs/start_time')
    .once('value')
    .then((snapshot) => {
      const lastStartTime = snapshot.val();
      if (lastStartTime) {
        const currentTime = Date.now();
        const timeElapsedSinceStart = currentTime - lastStartTime;

        if (timeElapsedSinceStart < 3 * 60 * 60 * 1000) {
          startTime = lastStartTime;
          elapsedTime = timeElapsedSinceStart;
          startClock();
          pauseDiv.style.display = 'block';
          resetDiv.style.display = 'block';
          updateClockDisplay();
        }
      }
    })
    .catch((error) => {
      console.error('Error retrieving start_time:', error);
    });
}

function handleValidateClick() {
  const db = window.database;
  if (!db) {
    console.error('Clock: database is not available.');
    return;
  }

  if (!startTime) {
    startTime = Date.now();
    elapsedTime = 0;

    db.ref('access_logs/start_time')
      .set(startTime)
      .then(() => {
        startClock();
        pauseDiv.style.display = 'block';
        resetDiv.style.display = 'block';
      })
      .catch((error) => {
        console.error('Error updating start_time:', error);
      });
  }
}

export function ensureClockRunning() {
  if (!startTime) {
    handleValidateClick();
    return;
  }

  if (paused) {
    paused = false;
    startTime = Date.now() - elapsedTime;
    pauseBtn.textContent = 'Pause';
    startClock();
  }
}

function handlePauseClick() {
  if (paused) {
    paused = false;
    startTime = Date.now() - elapsedTime;
    pauseBtn.textContent = 'Pause';
    startClock();
  } else {
    paused = true;
    elapsedTime = Date.now() - startTime;
    clearInterval(timerInterval);
    pauseBtn.textContent = 'Resume';
  }
}

function handleResetClick() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  paused = false;
  elapsedTime = 0;
  startTime = null;

  validateBtn.style.backgroundColor = 'green';
  validateBtn.style.borderColor = 'black';
  validateBtn.style.color = '';
  validateBtn.textContent = 'Start clock';

  pauseDiv.style.display = 'none';
  resetDiv.style.display = 'none';

  const db = window.database;
  if (!db) {
    console.error('Clock: database is not available.');
    return;
  }

  db.ref('access_logs/start_time')
    .remove()
    .catch((error) => {
      console.error('Error clearing start_time:', error);
    });
}

export function formatDuration(timeStr) {
  const parts = timeStr.split(':').map(Number);
  const [hours = 0, minutes = 0] = parts;
  let formatted = '';

  if (hours > 0) {
    formatted += `${hours}h `;
  }
  if (minutes > 0) {
    formatted += `${minutes}m`;
  }

  return formatted.trim() || '0m';
}

export function initClock() {
  pauseDiv.style.display = 'none';
  resetDiv.style.display = 'none';
  validateBtn.addEventListener('click', handleValidateClick);
  pauseBtn.addEventListener('click', handlePauseClick);
  resetBtn.addEventListener('click', handleResetClick);
  checkLastClick();
}
