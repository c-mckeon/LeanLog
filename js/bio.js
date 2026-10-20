// Bio: any body measurement the user wants to log as numbers over time (weight by default).
// Data lives under bio/: metrics/{id} = { name, unit }, entries/{metricId}/{entryId} = { date, value }.
// Chart display choices (points and/or trend line, zoom period, selected measurement) live in settings/bio.
(function () {
  const DEFAULT_METRICS = { weight: { name: 'Weight', unit: 'kg' } };
  const CHART_COLOR = '#176b45';

  const area = document.getElementById('bioarea');
  const tab = document.getElementById('toggleBioBtn');
  if (!area || !tab) return;

  const el = (id) => document.getElementById(id);
  const metricChips = el('bioMetricChips');
  const addMetricForm = el('bioAddMetricForm');
  const metricNameInput = el('bioMetricName');
  const metricUnitInput = el('bioMetricUnit');
  const showPointsBox = el('bioShowPoints');
  const showLineBox = el('bioShowLine');
  const zoomSelect = el('bioZoomSelect');
  const dateInput = el('bioEntryDate');
  const dateToggle = el('bioDateToggle');
  const valueInput = el('bioEntryValue');
  const saveEntryBtn = el('bioSaveEntryBtn');
  const chartCanvas = el('bioChart');
  const emptyHint = el('bioEmpty');
  const entryList = el('bioEntryList');

  let metrics = {};
  let metricsSaved = false; // false while only the built-in defaults exist (nothing stored yet)
  let entriesByMetric = {};
  let selectedId = '';
  let chart = null;

  const escapeHtml = (text) => (typeof escapeExerciseHtml === 'function'
    ? escapeExerciseHtml(text)
    : String(text ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`));
  const formatDate = (date) => (typeof formatWorkoutListDate === 'function' ? formatWorkoutListDate(date) : date);
  const today = () => (typeof getToday === 'function' ? getToday() : new Date().toISOString().slice(0, 10));
  const newId = () => window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const notify = (message, type = 'error') => (window.showNotice ? window.showNotice(message, type) : console.error(message));
  const metricLabel = (metric) => (metric.unit ? `${metric.name} (${metric.unit})` : metric.name);

  function sortedEntries(metricId) {
    return Object.entries(entriesByMetric[metricId] || {})
      .map(([key, entry]) => ({ key, date: entry?.date, time: Number(entry?.time) || 0, value: Number(entry?.value) }))
      .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.date || '') && Number.isFinite(entry.value))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time - b.time || a.key.localeCompare(b.key));
  }

  // Writes that create the first stored measurement also store the defaults, so they stay
  function metricUpdates() {
    if (metricsSaved) return {};
    return Object.fromEntries(Object.entries(metrics).map(([id, metric]) => [`metrics/${id}`, metric]));
  }

  async function saveSettings() {
    try {
      await window.database.ref('settings/bio').update({
        showPoints: showPointsBox.checked,
        showLine: showLineBox.checked,
        zoom: zoomSelect.value,
        metric: selectedId
      });
    } catch (error) {
      console.error('Could not save Bio settings:', error);
    }
  }

  async function loadBio() {
    try {
      const [bioSnapshot, settingsSnapshot] = await Promise.all([
        window.database.ref('bio').once('value'),
        window.database.ref('settings/bio').once('value')
      ]);
      const bio = bioSnapshot.val() || {};
      const settings = settingsSnapshot.val() || {};
      metricsSaved = Boolean(bio.metrics && Object.keys(bio.metrics).length);
      metrics = metricsSaved ? bio.metrics : { ...DEFAULT_METRICS };
      entriesByMetric = bio.entries || {};
      if (typeof settings.showPoints === 'boolean') showPointsBox.checked = settings.showPoints;
      if (typeof settings.showLine === 'boolean') showLineBox.checked = settings.showLine;
      if (settings.zoom && [...zoomSelect.options].some((option) => option.value === settings.zoom)) zoomSelect.value = settings.zoom;
      if (!showPointsBox.checked && !showLineBox.checked) showPointsBox.checked = true;
      if (!selectedId || !metrics[selectedId]) selectedId = metrics[settings.metric] ? settings.metric : Object.keys(metrics)[0];
      render();
    } catch (error) {
      console.error('Could not load Bio data:', error);
      entryList.innerHTML = `<li class="exo-hint">${escapeHtml(error.message || 'Could not load your measurements.')}</li>`;
    }
  }

  // One chip per measurement: click to show it, × to remove; "+ Add" opens the add form
  function renderChips() {
    const adding = !addMetricForm.hidden;
    metricChips.innerHTML = Object.entries(metrics)
      .sort(([, a], [, b]) => a.name.localeCompare(b.name))
      .map(([id, metric]) => `
        <span class="bio-chip${id === selectedId ? ' is-selected' : ''}">
          <button type="button" class="bio-chip-select" data-id="${escapeHtml(id)}" aria-pressed="${id === selectedId}">${escapeHtml(metricLabel(metric))}</button>
          <button type="button" class="bio-chip-remove" data-id="${escapeHtml(id)}" aria-label="Remove ${escapeHtml(metric.name)}">×</button>
        </span>`).join('')
      + (adding ? '' : '<button type="button" class="bio-chip bio-chip-add">+ Add</button>');
  }

  function render() {
    renderChips();
    const metric = metrics[selectedId] || { name: '', unit: '' };
    valueInput.placeholder = metricLabel(metric) || 'Value';

    const entries = sortedEntries(selectedId);
    const inPeriod = zoomedPoints(entries).length;
    emptyHint.textContent = entries.length ? "No readings in this period." : "No entries yet. Add one above to start the chart.";
    emptyHint.hidden = inPeriod > 0;
    renderChart(metric, entries);
    entryList.innerHTML = [...entries].reverse().map((entry) => `
      <li>
        <span>${escapeHtml(formatDate(entry.date))}</span>
        <strong>${escapeHtml(entry.value)}${metric.unit ? ` ${escapeHtml(metric.unit)}` : ''}</strong>
        <button type="button" class="btn btn-sm btn-outline-danger bio-delete-entry" data-key="${escapeHtml(entry.key)}" aria-label="Delete entry from ${escapeHtml(formatDate(entry.date))}">×</button>
      </li>`).join('');
  }

  // Zoom: only readings from the chosen period are plotted, and the axis fits them
  const ZOOM_DAYS = { '1m': 30, '3m': 90, '6m': 180, '1y': 365 };
  const DAY_MS = 24 * 60 * 60 * 1000;

  function toTime(date) {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day).getTime();
  }

  function zoomedPoints(entries) {
    const points = entries.map((entry) => ({ x: entry.time || toTime(entry.date), y: entry.value }));
    const days = ZOOM_DAYS[zoomSelect.value];
    if (!days) return points;
    const cutoff = Date.now() - days * DAY_MS;
    return points.filter((point) => point.x >= cutoff);
  }

  // Trend line: per point, a rolling average of the 5 points either side, blended with a
  // Gaussian (10-day) time-weighted average. Where readings are dense the Gaussian counts
  // for more (up to 100% at 8+ readings within 10 days); where they're sparse it's 50/50.
  const TREND_SIGMA = 10 * DAY_MS;
  const TREND_WINDOW = 5;

  function trendLine(points) {
    return points.map((point, i) => {
      let rollingSum = 0;
      let rollingCount = 0;
      for (let j = Math.max(0, i - TREND_WINDOW); j <= Math.min(points.length - 1, i + TREND_WINDOW); j++) {
        rollingSum += points[j].y;
        rollingCount++;
      }
      let gaussianSum = 0;
      let weightSum = 0;
      let nearby = 0;
      points.forEach((other) => {
        const diff = other.x - point.x;
        if (Math.abs(diff) <= TREND_SIGMA) nearby++;
        const weight = Math.exp(-(diff * diff) / (2 * TREND_SIGMA * TREND_SIGMA));
        gaussianSum += other.y * weight;
        weightSum += weight;
      });
      const density = Math.min(8, Math.max(1, nearby));
      const gaussianShare = 0.5 + 0.5 * ((density - 1) / 7);
      const y = (1 - gaussianShare) * (rollingSum / rollingCount) + gaussianShare * (gaussianSum / weightSum);
      return { x: point.x, y };
    });
  }

  function renderChart(metric, entries) {
    // With no readings the chart still shows, empty, over the zoom period (or the last month)
    const points = zoomedPoints(entries);
    if (!window.Chart) return;
    const emptyEnd = Date.now();
    const emptyStart = emptyEnd - (ZOOM_DAYS[zoomSelect.value] || 30) * DAY_MS;

    const datasets = [{
      label: metricLabel(metric),
      data: points,
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
      borderColor: 'blue',
      pointBackgroundColor: 'black',
      pointBorderColor: 'white',
      pointRadius: showPointsBox.checked ? 2 : 0,
      pointHoverRadius: showPointsBox.checked ? 4 : 0,
      pointHitRadius: showPointsBox.checked ? 6 : 0,
      showLine: false,
      fill: false
    }];
    if (showLineBox.checked && points.length > 1) {
      datasets.push({
        label: 'Trend',
        data: trendLine(points),
        borderColor: 'red',
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 0,
        fill: false,
        tension: 0.3,
        cubicInterpolationMode: 'monotone'
      });
    }

    const formatTooltipDate = (time) => new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: (item) => item.datasetIndex === 0,
          callbacks: { title: (items) => (items.length ? formatTooltipDate(items[0].parsed.x) : '') }
        }
      },
      scales: {
        x: {
          type: 'time',
          min: points.length ? points[0].x : emptyStart,
          max: points.length ? points[points.length - 1].x : emptyEnd,
          time: { unit: 'day', displayFormats: { day: 'dd MMM yyyy' } },
          ticks: { autoSkip: true, maxTicksLimit: 8 },
          title: { display: true, text: 'Date' }
        },
        y: {
          beginAtZero: false,
          title: { display: true, text: metricLabel(metric) }
        }
      }
    };

    try {
      if (chart) chart.destroy();
      chart = new window.Chart(chartCanvas, { type: 'line', data: { datasets }, options });
    } catch (error) {
      // Without the date adapter, fall back to a plain number axis labelled with dates
      console.error('Bio chart time axis failed, using a plain axis:', error);
      if (chart) chart.destroy();
      options.scales.x = { type: 'linear', min: options.scales.x.min, max: options.scales.x.max, ticks: { callback: formatTooltipDate, maxTicksLimit: 8 }, title: { display: true, text: 'Date' } };
      chart = new window.Chart(chartCanvas, { type: 'line', data: { datasets }, options });
    }
  }

  async function saveEntry() {
    // Default is now; an earlier day picked with "Change date" is saved without a time
    const pickedDate = dateInput.hidden ? '' : dateInput.value;
    const backdated = /^\d{4}-\d{2}-\d{2}$/.test(pickedDate) && pickedDate !== today();
    const date = backdated ? pickedDate : today();
    const value = parseFloat(valueInput.value);
    if (!Number.isFinite(value)) {
      notify('Enter a number.');
      return;
    }
    const entry = backdated ? { date, value } : { date, value, time: Date.now() };
    const key = newId();
    saveEntryBtn.disabled = true;
    try {
      await window.database.ref('bio').update({ ...metricUpdates(), [`entries/${selectedId}/${key}`]: entry });
      metricsSaved = true;
      (entriesByMetric[selectedId] ||= {})[key] = entry;
      valueInput.value = '';
      setDatePickerOpen(false);
      render();
      valueInput.focus();
    } catch (error) {
      notify(`Could not save: ${error.message}`);
    } finally {
      saveEntryBtn.disabled = false;
    }
  }

  async function deleteEntry(button) {
    const key = button.dataset.key;
    if (window.confirmInPlace && !(await window.confirmInPlace(button, { question: 'Delete?' }))) return;
    try {
      await window.database.ref(`bio/entries/${selectedId}/${key}`).remove();
      delete entriesByMetric[selectedId]?.[key];
      render();
    } catch (error) {
      notify(`Could not delete: ${error.message}`);
    }
  }

  function setDatePickerOpen(open) {
    dateInput.hidden = !open;
    dateToggle.setAttribute('aria-expanded', String(open));
    dateToggle.textContent = open ? 'Use today' : 'Change date';
    dateInput.value = today();
    if (open) dateInput.focus();
  }

  function setAddMetricOpen(open) {
    addMetricForm.hidden = !open;
    renderChips();
    if (open) {
      metricNameInput.value = '';
      metricUnitInput.value = '';
      metricNameInput.focus();
    }
  }

  async function addMetric() {
    const name = metricNameInput.value.trim();
    const unit = metricUnitInput.value.trim();
    if (!name) {
      notify('Give the measurement a name.');
      return;
    }
    if (Object.values(metrics).some((metric) => metric.name.toLowerCase() === name.toLowerCase())) {
      notify(`You already track ${name}.`);
      return;
    }
    const id = newId();
    try {
      await window.database.ref('bio').update({ ...metricUpdates(), [`metrics/${id}`]: { name, unit } });
      metricsSaved = true;
      metrics[id] = { name, unit };
      selectedId = id;
      setAddMetricOpen(false);
      render();
      saveSettings();
      valueInput.focus();
    } catch (error) {
      notify(`Could not add: ${error.message}`);
    }
  }

  async function removeMetric(metricId, button) {
    const metric = metrics[metricId];
    if (!metric) return;
    const count = sortedEntries(metricId).length;
    const question = count ? `Remove ${metric.name} and its ${count} ${count === 1 ? 'entry' : 'entries'}?` : `Remove ${metric.name}?`;
    if (window.confirmInPlace && !(await window.confirmInPlace(button, { question }))) return;
    const remaining = Object.fromEntries(Object.entries(metrics).filter(([id]) => id !== metricId));
    try {
      // Removing the last one brings back the default (weight) on the next load
      const updates = { [`entries/${metricId}`]: null };
      if (metricsSaved) updates[`metrics/${metricId}`] = null;
      await window.database.ref('bio').update(updates);
      delete entriesByMetric[metricId];
      metrics = Object.keys(remaining).length ? remaining : { ...DEFAULT_METRICS };
      metricsSaved = Object.keys(remaining).length > 0 && metricsSaved;
      if (!metrics[selectedId]) selectedId = Object.keys(metrics)[0];
      render();
      saveSettings();
    } catch (error) {
      notify(`Could not remove: ${error.message}`);
    }
  }

  // Points and line can be shown together or alone, but not both off
  function onChartToggle(changed, other) {
    if (!changed.checked && !other.checked) other.checked = true;
    render();
    saveSettings();
  }

  tab.addEventListener('click', () => {
    area.classList.toggle('hidden');
    if (area.classList.contains('hidden')) return;
    if (!chart) renderChart(metrics[selectedId] || DEFAULT_METRICS.weight, []); // empty chart while loading
    loadBio();
  });
  metricChips.addEventListener('click', (event) => {
    const select = event.target.closest('.bio-chip-select');
    const remove = event.target.closest('.bio-chip-remove');
    if (event.target.closest('.bio-chip-add')) {
      setAddMetricOpen(true);
    } else if (remove) {
      removeMetric(remove.dataset.id, remove);
    } else if (select && select.dataset.id !== selectedId) {
      selectedId = select.dataset.id;
      render();
      saveSettings();
    }
  });
  el('bioCancelMetricBtn').addEventListener('click', () => setAddMetricOpen(false));
  el('bioSaveMetricBtn').addEventListener('click', addMetric);
  [metricNameInput, metricUnitInput].forEach((input) => input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); addMetric(); }
    if (event.key === 'Escape') setAddMetricOpen(false);
  }));
  showPointsBox.addEventListener('change', () => onChartToggle(showPointsBox, showLineBox));
  showLineBox.addEventListener('change', () => onChartToggle(showLineBox, showPointsBox));
  zoomSelect.addEventListener('change', () => {
    render();
    saveSettings();
  });
  saveEntryBtn.addEventListener('click', saveEntry);
  dateToggle.addEventListener('click', () => setDatePickerOpen(dateInput.hidden));
  valueInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); saveEntry(); }
  });
  entryList.addEventListener('click', (event) => {
    const button = event.target.closest('.bio-delete-entry');
    if (button) deleteEntry(button);
  });
})();
