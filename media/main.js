// @ts-check
(function () {
  'use strict';

  const vscode = acquireVsCodeApi();

  /** @type {HTMLSelectElement} */
  const providerSelect = /** @type {any} */ (document.getElementById('provider-select'));
  /** @type {HTMLSelectElement} */
  const modeSelect = /** @type {any} */ (document.getElementById('mode-select'));
  /** @type {HTMLDivElement} */
  const messagesEl = /** @type {any} */ (document.getElementById('messages'));
  /** @type {HTMLTextAreaElement} */
  const promptInput = /** @type {any} */ (document.getElementById('prompt-input'));
  /** @type {HTMLButtonElement} */
  const btnRun = /** @type {any} */ (document.getElementById('btn-run'));
  /** @type {HTMLButtonElement} */
  const btnStop = /** @type {any} */ (document.getElementById('btn-stop'));
  /** @type {HTMLButtonElement} */
  const btnScm = /** @type {any} */ (document.getElementById('btn-scm'));
  /** @type {HTMLDivElement} */
  const timelineEl = /** @type {any} */ (document.getElementById('timeline'));
  /** @type {HTMLSpanElement} */
  const elapsedEl = /** @type {any} */ (document.getElementById('elapsed'));
  /** @type {HTMLElement} */
  const gitStatusSection = /** @type {any} */ (document.getElementById('git-status-section'));
  /** @type {HTMLUListElement} */
  const changedFilesList = /** @type {any} */ (document.getElementById('changed-files'));
  /** @type {HTMLDetailsElement} */
  const rawOutputSection = /** @type {any} */ (document.getElementById('raw-output-section'));
  /** @type {HTMLPreElement} */
  const rawOutputPre = /** @type {any} */ (document.getElementById('raw-output'));

  let taskStartTime = 0;
  let elapsedTimer = 0;
  let isRunning = false;
  let rawOutput = '';

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * @param {string} text
   * @param {'info'|'error'|'stderr'|'success'|'system'} kind
   */
  function appendMessage(text, kind) {
    const el = document.createElement('div');
    el.className = `message ${kind}`;
    el.textContent = text;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setRunning(running) {
    isRunning = running;
    btnRun.disabled = running;
    btnStop.disabled = !running;
    promptInput.disabled = running;

    if (running) {
      taskStartTime = Date.now();
      timelineEl.classList.remove('hidden');
      elapsedEl.textContent = '0s';
      elapsedTimer = setInterval(() => {
        const secs = Math.floor((Date.now() - taskStartTime) / 1000);
        elapsedEl.textContent = `${secs}s`;
      }, 1000);
      rawOutput = '';
      rawOutputPre.textContent = '';
    } else {
      clearInterval(elapsedTimer);
    }
  }

  function showGitStatus(changes, message) {
    changedFilesList.innerHTML = '';

    if (message && changes.length === 0) {
      const li = document.createElement('li');
      li.textContent = message;
      li.style.fontStyle = 'italic';
      changedFilesList.appendChild(li);
    } else {
      for (const change of changes) {
        const li = document.createElement('li');
        const badge = document.createElement('span');
        badge.className = 'status-badge';
        badge.textContent = change.status;
        li.appendChild(badge);
        li.appendChild(document.createTextNode(change.path));
        changedFilesList.appendChild(li);
      }
    }

    gitStatusSection.classList.remove('hidden');
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  btnRun.addEventListener('click', () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      appendMessage('Prompt must not be empty.', 'error');
      return;
    }
    gitStatusSection.classList.add('hidden');
    rawOutputSection.classList.add('hidden');
    vscode.postMessage({
      type: 'runTask',
      prompt,
      provider: providerSelect.value,
      mode: modeSelect.value,
    });
  });

  btnStop.addEventListener('click', () => {
    vscode.postMessage({ type: 'stopTask' });
  });

  btnScm.addEventListener('click', () => {
    vscode.postMessage({ type: 'openSourceControl' });
  });

  promptInput.addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      btnRun.click();
    }
  });

  // ── Messages from extension ───────────────────────────────────────────────

  window.addEventListener('message', (/** @type {MessageEvent} */ event) => {
    const msg = event.data;

    switch (msg.type) {
      case 'taskStarted':
        appendMessage(
          `▶ Task started — provider: ${msg.provider}, mode: ${msg.mode}`,
          'system',
        );
        setRunning(true);
        break;

      case 'stdout': {
        rawOutput += msg.chunk;
        rawOutputPre.textContent = rawOutput;
        // Show raw output section if configured (extension sets it via CSS class)
        rawOutputSection.classList.remove('hidden');
        // Also show nicely in messages
        const lines = msg.chunk.split('\n').filter((/** @type {string} */ l) => l.trim());
        for (const line of lines) {
          appendMessage(line, 'info');
        }
        break;
      }

      case 'stderr': {
        rawOutput += msg.chunk;
        rawOutputPre.textContent = rawOutput;
        const lines = msg.chunk.split('\n').filter((/** @type {string} */ l) => l.trim());
        for (const line of lines) {
          appendMessage(line, 'stderr');
        }
        break;
      }

      case 'taskCompleted':
        setRunning(false);
        appendMessage(
          `✓ Task completed (exit ${msg.exitCode})`,
          msg.exitCode === 0 ? 'success' : 'error',
        );
        break;

      case 'taskStopped':
        setRunning(false);
        appendMessage('⏹ Task stopped.', 'system');
        break;

      case 'taskError':
        setRunning(false);
        appendMessage(`✖ Error: ${msg.message}`, 'error');
        break;

      case 'gitStatus':
        showGitStatus(msg.changes || [], msg.message);
        break;

      case 'availableProviders': {
        // Mark unavailable providers as disabled
        const available = new Set(msg.providers);
        for (const option of providerSelect.options) {
          if (option.value !== 'auto' && option.value !== 'custom') {
            option.disabled = !available.has(option.value);
            if (option.disabled) {
              option.text = option.value + ' (not installed)';
            }
          }
        }
        break;
      }
    }
  });

  // Signal readiness to the extension
  vscode.postMessage({ type: 'ready' });
})();
