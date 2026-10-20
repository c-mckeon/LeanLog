// Section tabs: a row of buttons under the workout builder. Each tab opens its
// section in the shared panel below, and opening one closes whichever was open.
//
// Each section keeps its own click handler (which loads its data), so this file
// only watches the sections' content elements. When one goes from closed to open,
// it closes the others by clicking their tabs. Watching the elements instead of
// the clicks copes with handlers that open asynchronously (calendar) or are
// attached late (volume).
(function () {
  const contentIds = {
    addEdit: 'addEditToolbarButtons',
    workouts: 'workoutsArea',
    calendar: 'calendar-container',
    bio: 'bioarea',
    progress: 'progressarea',
    volume: 'volumearea'
  };

  function isOpen(name) {
    const el = document.getElementById(contentIds[name]);
    if (!el) return false;
    if (name === 'calendar') return el.style.display !== 'none';
    return !el.classList.contains('hidden');
  }

  const names = Object.keys(contentIds);
  const tabs = {};
  document.querySelectorAll('#sectionTabs .section-tab').forEach((tab) => {
    tabs[tab.dataset.section] = tab;
  });
  const panels = Array.from(document.querySelectorAll('#sectionPanels .section-panel'));

  let lastState = {};

  function update() {
    const state = {};
    names.forEach((name) => { state[name] = isOpen(name); });

    const newlyOpened = names.find((name) => state[name] && !lastState[name]);
    lastState = state;

    if (newlyOpened) {
      names.forEach((name) => {
        if (name !== newlyOpened && state[name] && tabs[name]) tabs[name].click();
      });
    }

    names.forEach((name) => {
      const tab = tabs[name];
      if (!tab) return;
      tab.classList.toggle('active', state[name]);
      tab.setAttribute('aria-expanded', String(state[name]));
    });
    panels.forEach((panel) => {
      panel.classList.toggle('is-open', Boolean(state[panel.dataset.section]));
    });
  }

  const observer = new MutationObserver(update);
  names.forEach((name) => {
    const el = document.getElementById(contentIds[name]);
    if (el) observer.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
  });

  update();

  // Keep the scroll position fixed when sections open, close or swap. The page only
  // jumps when it gets shorter than the current scroll position plus the screen, so the
  // panel area is held at least that tall. Recomputed on scroll, so the extra blank
  // space goes away again as the user scrolls back up.
  const panelArea = document.getElementById('sectionPanels');
  function keepRoomBelow() {
    if (!panelArea) return;
    const panelTop = panelArea.getBoundingClientRect().top + window.scrollY;
    const needed = window.scrollY + window.innerHeight - panelTop;
    panelArea.style.minHeight = `${Math.max(window.innerHeight, Math.ceil(needed))}px`;
  }
  window.addEventListener('scroll', keepRoomBelow, { passive: true });
  window.addEventListener('resize', keepRoomBelow);
  keepRoomBelow();
})();
