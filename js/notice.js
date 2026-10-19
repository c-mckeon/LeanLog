// In-page replacements for the browser's alert / confirm popups.
//   showNotice(message, type)              - short message that fades away; type is 'info', 'success' or 'error'
//   await confirmInPlace(button, options)  - swaps a button for "Question? [Yes] [No]"; resolves true or false

(function () {
  let noticeStack = null;

  function getNoticeStack() {
    if (!noticeStack) {
      noticeStack = document.createElement('div');
      noticeStack.className = 'notice-stack';
      noticeStack.setAttribute('aria-live', 'polite');
      document.body.appendChild(noticeStack);
    }
    return noticeStack;
  }

  function showNotice(message, type = 'info') {
    const notice = document.createElement('div');
    notice.className = `notice notice-${type}`;
    notice.setAttribute('role', type === 'error' ? 'alert' : 'status');
    notice.textContent = message;

    const close = () => {
      if (!notice.isConnected) return;
      notice.classList.add('notice-leaving');
      setTimeout(() => notice.remove(), 200);
    };
    notice.addEventListener('click', close);
    getNoticeStack().appendChild(notice);
    setTimeout(close, type === 'error' ? 6000 : 3500);
  }

  // Swaps a button for "Question? [Yes] [No]" in the same spot. Resolves true on Yes;
  // false on No, Escape, or after `timeout` ms with no answer. The button comes back either way.
  function confirmInPlace(button, { question = 'Delete?', yesLabel = 'Yes', noLabel = 'No', timeout = 4000 } = {}) {
    return new Promise((resolve) => {
      if (!button || button.dataset.confirming) return resolve(false);
      button.dataset.confirming = 'true';

      const box = document.createElement('span');
      box.className = 'confirm-inline';
      box.setAttribute('role', 'group');
      box.innerHTML = `<span class="confirm-inline-question"></span>
        <button type="button" class="confirm-inline-yes"></button>
        <button type="button" class="confirm-inline-no"></button>`;
      box.querySelector('.confirm-inline-question').textContent = question;
      box.querySelector('.confirm-inline-yes').textContent = yesLabel;
      box.querySelector('.confirm-inline-no').textContent = noLabel;

      let timer;
      const finish = (answer) => {
        clearTimeout(timer);
        box.remove();
        button.hidden = false;
        delete button.dataset.confirming;
        if (!answer) button.focus();
        resolve(answer);
      };
      box.querySelector('.confirm-inline-yes').addEventListener('click', () => finish(true));
      box.querySelector('.confirm-inline-no').addEventListener('click', () => finish(false));
      box.addEventListener('keydown', (event) => { if (event.key === 'Escape') finish(false); });
      // Hovering or focusing pauses the auto-reset so it doesn't vanish mid-decision
      const restart = () => { clearTimeout(timer); timer = setTimeout(() => finish(false), timeout); };
      box.addEventListener('mouseenter', () => clearTimeout(timer));
      box.addEventListener('mouseleave', restart);

      button.hidden = true;
      button.after(box);
      box.querySelector('.confirm-inline-no').focus();
      restart();
    });
  }

  window.confirmInPlace = confirmInPlace;
  window.showNotice = showNotice;
})();
