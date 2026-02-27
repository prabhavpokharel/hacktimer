/* ============================================================
   HACKATHON TIMER — js/settings.js
   Settings panel: General, Teams, Sounds, Recovery tabs
   ============================================================ */

// ── Team names ───────────────────────────────────────────────────────────────
let teamNames = [
  'Iris', '5th Avenue', 'Thapathali Debuggers', 'aSolveZ', 'VARS', 'QuadS',
  'Royal Hogs', 'Code Crafters', 'Root Users', 'Hackathali Crew',
  'LEC Girlies', 'Team Subharambha', 'The HackPack', '404 Brain Found', 'dot', 'ARYANS',
];

const SettingsPanel = (() => {

  function open() {
    document.getElementById('settingsOverlay').classList.add('open');
    buildTeamNameList();
  }
  function close() {
    document.getElementById('settingsOverlay').classList.remove('open');
  }
  function toggleSettings() {
    const isOpen = document.getElementById('settingsOverlay').classList.contains('open');
    isOpen ? close() : open();
  }
  function closeOnBackdrop(e) {
    if (e.target === document.getElementById('settingsOverlay')) close();
  }
  function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    btn.classList.add('active');
    if (tabId === 'teams') buildTeamNameList();
  }

  // ── Team Names tab ──────────────────────────────────────────────────────────
  function buildTeamNameList() {
    document.getElementById('teamNameList').innerHTML = teamNames.map((name, i) => `
      <div class="team-name-row">
        <span class="team-num-label">${i + 1}</span>
        <input class="team-name-input" type="text" value="${name}"
               placeholder="Team ${i + 1}" data-idx="${i}" maxlength="36">
      </div>
    `).join('');
  }

  function saveTeamNames() {
    document.querySelectorAll('.team-name-input').forEach(inp => {
      const idx = parseInt(inp.dataset.idx);
      teamNames[idx] = inp.value.trim() || `Team ${idx + 1}`;
    });
    UI.renderJudgeCards();
    UI.showToast('✓ TEAM NAMES SAVED', 'ok');
  }

  function bulkLoadTeamNames() {
    const raw = document.getElementById('teamBulkPaste').value;
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) { UI.showToast('⚠ NOTHING TO LOAD', 'warn'); return; }
    lines.forEach((name, i) => { if (i < teamNames.length) teamNames[i] = name; });
    buildTeamNameList();
    document.getElementById('teamBulkPaste').value = '';
    UI.renderJudgeCards();
    UI.showToast(`✓ LOADED ${Math.min(lines.length, teamNames.length)} NAMES`, 'ok');
  }

  // ── Sounds tab ──────────────────────────────────────────────────────────────
  const SOUND_SLOTS = [
    {
      key:   'pitchEnd',
      label: 'Pitch End Alarm',
      when:  'Plays when the 4-min timer hits zero',
    },
    {
      key:   'oneMinWarning',
      label: '1-Minute Warning',
      when:  'Plays at exactly 1 minute remaining',
    },
    {
      key:   'transition',
      label: 'Transition Music',
      when:  'Loops continuously during the shift period',
    },
  ];

  function buildSoundPanel() {
    const container = document.getElementById('soundSlotList');
    container.innerHTML = SOUND_SLOTS.map(({ key, label, when }) => `
      <div class="sound-slot" id="slot-${key}">
        <div class="sound-slot-header">
          <span class="sound-slot-name">${label}</span>
          <span class="sound-slot-when">${when}</span>
        </div>
        <div class="sound-row">
          <select class="sound-mode-select" id="mode-${key}" onchange="SettingsPanel.onModeChange('${key}')">
            <option value="synth">Built-in Synth</option>
            <option value="file">Custom File</option>
          </select>
          <label class="upload-label" id="uploadLabel-${key}" style="display:none">
            📂 Upload
            <input type="file" class="upload-input" accept="audio/*"
                   onchange="SettingsPanel.onFileUpload('${key}', this)">
          </label>
          <button class="sound-preview-btn" onclick="SoundEngine.preview('${key}')" title="Preview sound">▶</button>
        </div>
        <div class="sound-file-name" id="fileName-${key}" style="display:none"></div>
        <div class="volume-row">
          <span class="volume-label">VOL</span>
          <input type="range" class="volume-slider" min="0" max="1" step="0.05"
                 value="${SoundEngine.getSlot(key).vol}"
                 oninput="SettingsPanel.onVolumeChange('${key}', this.value)">
          <span style="font-family:var(--font-mono);font-size:0.62rem;color:var(--text-mid);width:30px;"
                id="volLabel-${key}">${Math.round(SoundEngine.getSlot(key).vol * 100)}%</span>
        </div>
      </div>
    `).join('');
  }

  function onModeChange(key) {
    const mode = document.getElementById(`mode-${key}`).value;
    SoundEngine.setMode(key, mode);
    const uploadLabel = document.getElementById(`uploadLabel-${key}`);
    const fileName    = document.getElementById(`fileName-${key}`);
    if (mode === 'file') {
      uploadLabel.style.display = '';
    } else {
      uploadLabel.style.display = 'none';
      fileName.style.display    = 'none';
      fileName.textContent      = '';
    }
  }

  async function onFileUpload(key, input) {
    const file = input.files[0];
    if (!file) return;
    try {
      await SoundEngine.loadFile(key, file);
      const fn = document.getElementById(`fileName-${key}`);
      fn.textContent = `✓ ${file.name}`;
      fn.style.display = '';
      UI.showToast(`✓ LOADED: ${file.name}`, 'ok');
    } catch(e) {
      UI.showToast('⚠ COULD NOT DECODE AUDIO FILE', 'warn');
    }
  }

  function onVolumeChange(key, val) {
    SoundEngine.setVol(key, val);
    document.getElementById(`volLabel-${key}`).textContent = Math.round(val * 100) + '%';
  }

  // ── Recovery tab ────────────────────────────────────────────────────────────
  function jumpFromPanel() {
    const val = parseInt(document.getElementById('skipRoundInput').value);
    jumpToRound(val);
    close();
  }

  function quickSkipPrompt() {
    const val = parseInt(prompt(
      `⚡ JUMP TO ROUND\nEnter a round number (1–${state.totalRounds})\nCurrently: round ${state.round}`,
      state.round
    ));
    if (isNaN(val)) return;
    jumpToRound(val);
  }

  return {
    open, close, toggleSettings, closeOnBackdrop, switchTab,
    saveTeamNames, bulkLoadTeamNames, buildSoundPanel,
    onModeChange, onFileUpload, onVolumeChange,
    jumpFromPanel, quickSkipPrompt,
  };
})();
