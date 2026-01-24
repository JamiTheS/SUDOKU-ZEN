// Global Error Handler for debugging
window.onerror = function (msg, url, lineNo, columnNo, error) {
  console.error(
    "Error: " +
      msg +
      "\nurl: " +
      url +
      "\nline: " +
      lineNo +
      "\ncolumn: " +
      columnNo +
      "\nerror: " +
      error
  );
  // alert('Une erreur est survenue: ' + msg); // Uncomment if needed for user feedback
  return false;
};

class SudokuGame {
  constructor() {
    this.board = [];
    this.solution = [];
    this.initialBoard = [];
    this.selectedCell = null;
    this.mistakes = 0;
    this.timer = 0;
    this.timerInterval = null;
    this.difficulty = "medium";
    this.battleMode = false;
    this.coopMode = false;
    this.currentMode = null;
    this.solution = null;
    this.initial = null;
    this.isPaused = false;
    this.hintsRemaining = 3;

    // New Features
    this.isNoteMode = false;
    this.notes = new Array(81).fill(null).map(() => new Set());

    try {
      this.soundManager = new SoundManager();
    } catch (e) {
      console.warn("SoundManager failed to init", e);
      this.soundManager = {
        playTap: () => {},
        playNote: () => {},
        playErase: () => {},
        playWin: () => {},
      }; // Dummy fallback
    }
    this.themeManager = new ThemeManager();
    this.profileManager = new ProfileManager();
    this.statsManager = new StatsManager(this.profileManager);
    this.battleManager = new BattleManager(this);
    this.coopManager = new CoopManager(this);
    // this.mediaController represents the UI Shell, which is initialized in DOMContentLoaded

    // This block is now removed as managers are initialized directly.
    // setTimeout(() => {
    //     if (window.firebaseDB) {
    //         this.battleManager = new BattleManager(this);
    //     }
    // }, 500);

    this.dom = {
      board: document.getElementById("board"),
      timer: document.querySelector(".timer"),
      newGameBtn: document.getElementById("new-game-btn"),
      diffBtns: document.querySelectorAll(".diff-btn"),
      numBtns: document.querySelectorAll(".num-btn"),
      eraseBtn: document.getElementById("erase-btn"),
      modal: document.getElementById("modal"),
      modalTitle: document.getElementById("modal-title"),
      modalMessage: document.getElementById("modal-message"),
      modalCloseBtn: document.getElementById("modal-close-btn"),
      notesToggle: document.getElementById("notes-toggle"),
      statsBtn: document.getElementById("stats-btn"),
      statsModal: document.getElementById("stats-modal"),
      statsCloseBtn: document.getElementById("stats-close-btn"),
      profileBtn: document.getElementById("profile-btn"),
      profileDropdown: document.getElementById("profile-dropdown"),
      profileName: document.getElementById("profile-name"),
      newProfileBtn: document.getElementById("new-profile-btn"),
      profileModal: document.getElementById("profile-modal"),
      profileModalClose: document.getElementById("profile-modal-close"),
      newProfileInput: document.getElementById("new-profile-input"),
      createProfileBtn: document.getElementById("create-profile-btn"),
      savesBtn: document.getElementById("saves-btn"),
      savesModal: document.getElementById("saves-modal"),
      savesCloseBtn: document.getElementById("saves-close-btn"),
      savesList: document.getElementById("saves-list"),
      newSaveBtn: document.getElementById("new-save-btn"),
      saveNameModal: document.getElementById("save-name-modal"),
      saveNameInput: document.getElementById("save-name-input"),
      saveNameConfirm: document.getElementById("save-name-confirm"),
      saveNameCancel: document.getElementById("save-name-cancel"),
      confirmModal: document.getElementById("confirm-modal"),
      confirmMessage: document.getElementById("confirm-message"),
      confirmOk: document.getElementById("confirm-ok"),
      confirmCancel: document.getElementById("confirm-cancel"),
      // Battle mode elements
      battleBtn: document.getElementById("battle-btn"),
      battleChoiceModal: document.getElementById("battle-choice-modal"),
      battleChoiceClose: document.getElementById("battle-choice-close"),
      createRoomChoiceBtn: document.getElementById("create-room-choice-btn"),
      joinRoomChoiceBtn: document.getElementById("join-room-choice-btn"),
      createRoomModal: document.getElementById("create-room-modal"),
      battleNameInput: document.getElementById("battle-name-input"),
      battleDiffBtns: document.querySelectorAll("[data-battle-diff]"),
      confirmCreateRoomBtn: document.getElementById("confirm-create-room-btn"),
      cancelCreateRoomBtn: document.getElementById("cancel-create-room-btn"),
      joinRoomModal: document.getElementById("join-room-modal"),
      joinCodeInput: document.getElementById("join-code-input"),
      joinNameInput: document.getElementById("join-name-input"),
      confirmJoinRoomBtn: document.getElementById("confirm-join-room-btn"),
      cancelJoinRoomBtn: document.getElementById("cancel-join-room-btn"),
      waitingRoomModal: document.getElementById("waiting-room-modal"),
      waitingRoomCode: document.getElementById("waiting-room-code"),
      copyCodeBtn: document.getElementById("copy-code-btn"),
      cancelWaitingBtn: document.getElementById("cancel-waiting-btn"),
      pauseBtn: document.getElementById("pause-btn"),
      hintBtn: document.getElementById("hint-btn"),
      hintCount: document.getElementById("hint-count"),
      riddleToast: document.getElementById("riddle-toast"),
      riddleText: document.getElementById("riddle-text"),
      coopBtn: document.getElementById("coop-btn"),
      coopHud: document.getElementById("coop-hud"),
    };

    // Validate critical DOM elements
    if (!this.dom.board) console.error("Critical: Board element not found!");

    this.init();
  }

  init() {
    try {
      this.generateBoard();
      this.setupEventListeners();
      this.loadGame();
      this.updateProfileUI(); // Initialize profile UI
    } catch (e) {
      console.error("Initialization error:", e);
      alert(
        "Erreur d'initialisation du jeu. Une nouvelle partie va être lancée."
      );
      this.startNewGame();
    }
  }

  setupEventListeners() {
    if (this.dom.newGameBtn)
      this.dom.newGameBtn.addEventListener("click", () => this.startNewGame());

    if (this.dom.pauseBtn) {
      this.dom.pauseBtn.addEventListener("click", () => this.togglePause());
    }

    if (this.dom.hintBtn) {
      this.dom.hintBtn.addEventListener("click", () => this.getHint());
    }

    if (this.dom.coopBtn) {
      this.dom.coopBtn.addEventListener("click", () => this.startCoopMode());
    }

    this.dom.diffBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.dom.diffBtns.forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
        this.difficulty = e.target.dataset.diff;
      });
    });

    // Board interaction
    if (this.dom.board) {
      this.dom.board.addEventListener("click", (e) => {
        if (this.isPaused) this.resumeTimer();
        const cell = e.target.closest(".cell");
        if (cell) this.selectCell(cell);
      });
    }

    // Numpad interaction
    this.dom.numBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.handleInput(parseInt(btn.dataset.num));
      });
    });

    if (this.dom.eraseBtn)
      this.dom.eraseBtn.addEventListener("click", () => this.handleInput(0));

    // Notes Toggle
    if (this.dom.notesToggle) {
      this.dom.notesToggle.addEventListener("click", () => {
        this.isNoteMode = !this.isNoteMode;
        this.dom.notesToggle.classList.toggle("active");
      });
    }

    // Keyboard support
    document.addEventListener("keydown", (e) => {
      if (!this.isPlaying) return;

      if (e.key >= "1" && e.key <= "9") {
        if (this.isPaused) this.resumeTimer();
        this.handleInput(parseInt(e.key));
      } else if (e.key === "Backspace" || e.key === "Delete") {
        if (this.isPaused) this.resumeTimer();
        this.handleInput(0);
      } else if (e.key.toLowerCase() === "n") {
        this.isNoteMode = !this.isNoteMode;
        if (this.dom.notesToggle) {
          this.dom.notesToggle.classList.toggle("active");
        }
      } else {
        if (this.isPaused) this.resumeTimer();
        this.handleArrowNavigation(e.key);
      }
    });

    if (this.dom.modalCloseBtn) {
      this.dom.modalCloseBtn.addEventListener("click", () => {
        this.dom.modal.classList.add("hidden");
      });
    }

    // Stats modal
    if (this.dom.statsBtn) {
      this.dom.statsBtn.addEventListener("click", () => this.showStats());
    }
    if (this.dom.statsCloseBtn) {
      this.dom.statsCloseBtn.addEventListener("click", () => {
        this.dom.statsModal.classList.add("hidden");
      });
    }

    const resetBtn = document.getElementById("reset-stats-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (
          confirm(
            "Êtes-vous sûr de vouloir réinitialiser toutes vos statistiques ?"
          )
        ) {
          this.statsManager.resetStats();
          this.showStats(); // Refresh display
        }
      });
    }

    // Profile system listeners
    if (this.dom.profileBtn) {
      this.dom.profileBtn.addEventListener("click", () => {
        this.dom.profileDropdown.classList.toggle("hidden");
      });
    }

    if (this.dom.newProfileBtn) {
      this.dom.newProfileBtn.addEventListener("click", () => {
        this.dom.profileDropdown.classList.add("hidden");
        this.dom.profileModal.classList.remove("hidden");
        this.dom.newProfileInput.value = "";
        this.dom.newProfileInput.focus();
      });
    }

    if (this.dom.profileModalClose) {
      this.dom.profileModalClose.addEventListener("click", () => {
        this.dom.profileModal.classList.add("hidden");
      });
    }

    if (this.dom.createProfileBtn) {
      this.dom.createProfileBtn.addEventListener("click", () =>
        this.createNewProfile()
      );
    }

    if (this.dom.newProfileInput) {
      this.dom.newProfileInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.createNewProfile();
      });
    }

    // Saves modal listeners
    if (this.dom.savesBtn) {
      this.dom.savesBtn.addEventListener("click", () => this.showSaves());
    }

    if (this.dom.savesCloseBtn) {
      this.dom.savesCloseBtn.addEventListener("click", () => {
        this.dom.savesModal.classList.add("hidden");
      });
    }

    if (this.dom.newSaveBtn) {
      this.dom.newSaveBtn.addEventListener("click", () =>
        this.promptSaveGame()
      );
    }

    if (this.dom.saveNameConfirm) {
      this.dom.saveNameConfirm.addEventListener("click", () =>
        this.confirmSaveGame()
      );
    }

    if (this.dom.saveNameCancel) {
      this.dom.saveNameCancel.addEventListener("click", () => {
        this.dom.saveNameModal.classList.add("hidden");
      });
    }

    if (this.dom.saveNameInput) {
      this.dom.saveNameInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.confirmSaveGame();
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (this.dom.profileBtn && this.dom.profileDropdown) {
        if (
          !this.dom.profileBtn.contains(e.target) &&
          !this.dom.profileDropdown.contains(e.target)
        ) {
          this.dom.profileDropdown.classList.add("hidden");
        }
      }
    });

    // Battle mode event listeners
    if (this.dom.battleBtn) {
      this.dom.battleBtn.addEventListener("click", () => {
        this.currentMode = "battle";
        if (this.dom.battleChoiceModal) {
          this.dom.battleChoiceModal.classList.remove("hidden");
        }
      });
    }

    if (this.dom.battleChoiceClose) {
      this.dom.battleChoiceClose.addEventListener("click", () => {
        this.dom.battleChoiceModal.classList.add("hidden");
      });
    }

    if (this.dom.createRoomChoiceBtn) {
      this.dom.createRoomChoiceBtn.addEventListener("click", () => {
        this.dom.battleChoiceModal.classList.add("hidden");
        this.dom.createRoomModal.classList.remove("hidden");
        // Pre-fill with profile name
        if (this.dom.battleNameInput) {
          this.dom.battleNameInput.value =
            this.profileManager.currentProfile || "";
        }
      });
    }

    if (this.dom.joinRoomChoiceBtn) {
      this.dom.joinRoomChoiceBtn.addEventListener("click", () => {
        this.dom.battleChoiceModal.classList.add("hidden");
        this.dom.joinRoomModal.classList.remove("hidden");
        // Pre-fill with profile name
        if (this.dom.joinNameInput) {
          this.dom.joinNameInput.value =
            this.profileManager.currentProfile || "";
        }
      });
    }

    // Difficulty selection for Battle
    if (this.dom.battleDiffBtns) {
      this.dom.battleDiffBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          this.dom.battleDiffBtns.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
        });
      });
    }

    // Game mode selection for Co-op
    const modeButtons = document.querySelectorAll(".mode-option-btn");
    modeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        modeButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    if (this.dom.confirmCreateRoomBtn) {
      this.dom.confirmCreateRoomBtn.addEventListener("click", () =>
        this.createBattleRoom()
      );
    }

    if (this.dom.cancelCreateRoomBtn) {
      this.dom.cancelCreateRoomBtn.addEventListener("click", () => {
        this.dom.createRoomModal.classList.add("hidden");
      });
    }

    if (this.dom.confirmJoinRoomBtn) {
      this.dom.confirmJoinRoomBtn.addEventListener("click", () =>
        this.joinBattleRoom()
      );
    }

    if (this.dom.cancelJoinRoomBtn) {
      this.dom.cancelJoinRoomBtn.addEventListener("click", () => {
        this.dom.joinRoomModal.classList.add("hidden");
      });
    }

    if (this.dom.copyCodeBtn) {
      this.dom.copyCodeBtn.addEventListener("click", () => {
        const code = this.dom.waitingRoomCode.textContent;
        navigator.clipboard.writeText(code).then(() => {
          this.dom.copyCodeBtn.textContent = "✓";
          setTimeout(() => {
            this.dom.copyCodeBtn.textContent = "\ud83d\udccb";
          }, 2000);
        });
      });
    }

    if (this.dom.cancelWaitingBtn) {
      this.dom.cancelWaitingBtn.addEventListener("click", async () => {
        if (this.battleManager) {
          await this.battleManager.leaveRoom();
          this.dom.waitingRoomModal.classList.add("hidden");
        }
      });
    }

    // Mobile setup removed
  }

  setupSettingsModalButtons() {
    // Wire theme buttons
    document
      .querySelectorAll(".settings-theme-selector .theme-btn")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const theme = btn.dataset.theme;
          const desktopThemeBtn = document.querySelector(
            `.header-controls .theme-btn[data-theme="${theme}"]`
          );
          if (desktopThemeBtn) {
            desktopThemeBtn.click();
          }
        });
      });

    // Wire difficulty buttons
    document
      .querySelectorAll(".settings-difficulty-selector .diff-btn")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const diff = btn.dataset.diff;
          // Debug: Difficulty button clicked

          // Update active state in settings modal
          document
            .querySelectorAll(".settings-difficulty-selector .diff-btn")
            .forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");

          // Update difficulty and start new game
          this.difficulty = diff;

          // Update desktop difficulty display if visible
          const diffDisplay = document.getElementById("current-difficulty");
          if (diffDisplay) {
            diffDisplay.textContent =
              diff.charAt(0).toUpperCase() + diff.slice(1);
          }

          // Start new game with new difficulty
          this.newGame();

          // Close settings modal
          document.getElementById("settings-modal")?.classList.add("hidden");

          // Debug: New game started with selected difficulty
        });
      });

    // Wire profile button
    document
      .getElementById("settings-profile-btn")
      ?.addEventListener("click", () => {
        document.getElementById("profile-btn")?.click();
      });

    // Wire stats button
    document
      .getElementById("settings-stats-btn")
      ?.addEventListener("click", () => {
        document.getElementById("stats-btn")?.click();
        document.getElementById("settings-modal")?.classList.add("hidden");
      });

    // Wire saves button
    document
      .getElementById("settings-saves-btn")
      ?.addEventListener("click", () => {
        document.getElementById("saves-btn")?.click();
        document.getElementById("settings-modal")?.classList.add("hidden");
      });

    // Wire sound button
    document
      .getElementById("settings-sound-btn")
      ?.addEventListener("click", () => {
        document.getElementById("sound-toggle")?.click();
        // Update icon
        const icon = document.getElementById("settings-sound-icon");
        if (icon) {
          icon.textContent = this.soundEnabled ? "🔊" : "🔇";
        }
      });
  }

  handleArrowNavigation(key) {
    if (!this.selectedCell) return;

    const index = parseInt(this.selectedCell.dataset.index);
    let newIndex = index;

    switch (key) {
      case "ArrowUp":
        newIndex -= 9;
        break;
      case "ArrowDown":
        newIndex += 9;
        break;
      case "ArrowLeft":
        newIndex -= 1;
        break;
      case "ArrowRight":
        newIndex += 1;
        break;
    }

    if (newIndex >= 0 && newIndex < 81) {
      const newCell = this.dom.board.children[newIndex];
      this.selectCell(newCell);
    }
  }

  handleInput(num) {
    if (!this.isPlaying || this.isPaused) return;
    if (!this.selectedCell) return;

    const index = parseInt(this.selectedCell.dataset.index);

    // Co-op Mode Delegation
    if (this.coopMode) {
      if (this.initialBoard[index] !== 0) return;
      this.coopManager.makeMove(index, num);
      return;
    }

    if (this.initialBoard[index] !== 0) return;

    if (this.isNoteMode && num !== 0) {
      // Handle Notes
      const currentNotes = this.notes[index];
      if (currentNotes.has(num)) {
        currentNotes.delete(num);
      } else {
        currentNotes.add(num);
      }
      this.renderCell(index);
      this.soundManager.playNote();
      this.saveGame();
      return;
    }

    // Normal Input
    if (num === 0) {
      this.board[index] = 0;
      this.notes[index].clear();
      this.soundManager.playErase();
    } else {
      this.board[index] = num;
      this.notes[index].clear();
      this.soundManager.playTap();
    }

    this.renderCell(index);
    this.selectCell(this.selectedCell);
    this.saveGame();

    // Battle mode: sync progress
    if (this.battleMode && this.battleManager) {
      this.battleManager.syncProgress();
    }

    if (this.board.every((cell) => cell !== 0)) {
      this.checkWin();
    }
  }

  renderCell(index) {
    if (!this.dom.board.children[index]) return;

    const cell = this.dom.board.children[index];
    const value = this.board[index];
    const cellNotes = this.notes[index];

    cell.innerHTML = "";
    cell.className = "cell";
    cell.dataset.index = index;

    // Co-op Mode Styling
    if (this.coopMode) {
      const owner = this.coopManager.cellOwners
        ? this.coopManager.cellOwners[index]
        : null;
      if (owner === "p1") cell.classList.add("cell-p1");
      if (owner === "p2") cell.classList.add("cell-p2");
    }

    if (this.initialBoard[index] !== 0) {
      cell.classList.add("initial");
      cell.dataset.fixed = "true"; // Ensure CSS targets this
      cell.textContent = this.initialBoard[index];
    } else if (value !== 0) {
      cell.textContent = value;
    } else if (cellNotes && cellNotes.size > 0) {
      const notesGrid = document.createElement("div");
      notesGrid.className = "notes-grid";
      for (let i = 1; i <= 9; i++) {
        const noteEl = document.createElement("div");
        noteEl.className = "note-num";
        if (cellNotes.has(i)) noteEl.textContent = i;
        notesGrid.appendChild(noteEl);
      }
      cell.appendChild(notesGrid);
    }

    if (
      this.selectedCell &&
      parseInt(this.selectedCell.dataset.index) === index
    ) {
      cell.classList.add("selected");
      this.selectedCell = cell;
    }
  }

  saveGame() {
    try {
      const gameState = {
        board: this.board,
        initialBoard: this.initialBoard,
        solution: this.solution,
        notes: this.notes.map((set) => Array.from(set)),
        seconds: this.timer,
        difficulty: this.difficulty,
        hintsRemaining: this.hintsRemaining,
      };
      localStorage.setItem("sudoku-save", JSON.stringify(gameState));
    } catch (e) {
      console.error("Save failed", e);
    }
  }

  loadGame() {
    // Clean up any active multiplayer modes first
    this.cleanupMultiplayerModes();

    const saved = localStorage.getItem("sudoku-save");
    if (saved) {
      try {
        const state = JSON.parse(saved);

        // Validate state structure
        if (
          !state ||
          !state.board ||
          !state.initialBoard ||
          !state.solution ||
          !Array.isArray(state.notes)
        ) {
          throw new Error("Invalid save file format");
        }

        this.board = state.board;
        this.initialBoard = state.initialBoard;
        this.solution = state.solution;
        this.notes = state.notes.map((arr) => new Set(arr));
        this.timer = state.seconds || 0;
        this.difficulty = state.difficulty || "medium";
        this.hintsRemaining =
          state.hintsRemaining !== undefined ? state.hintsRemaining : 3;
        this.updateHintUI();

        this.renderBoard();
        this.isPlaying = true;
        
        // Clear any existing timer before starting new one
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }
        this.startTimer();

        const diffDisplay = document.getElementById("current-difficulty");
        if (diffDisplay) {
          diffDisplay.textContent =
            this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1);
        }
      } catch (e) {
        console.error("Failed to load save, resetting", e);
        localStorage.removeItem("sudoku-save"); // Clear bad save
        this.startNewGame();
      }
    } else {
      this.startNewGame();
    }
  }

  // === Save Slots Management ===

  getSaveSlots() {
    const profileName = this.profileManager.getCurrentProfile();
    const key = `sudoku-slots-${profileName}`;
    const saved = localStorage.getItem(key);

    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load save slots", e);
        return {};
      }
    }
    return {};
  }

  saveToSlot(slotId, slotName) {
    const slots = this.getSaveSlots();

    // Check if we've reached the limit (5 slots)
    if (!slots[slotId] && Object.keys(slots).length >= 5) {
      return {
        success: false,
        error:
          "Limite de 5 sauvegardes atteinte. Supprimez une sauvegarde existante.",
      };
    }

    // Calculate progression
    const filledCells = this.board.filter((cell) => cell !== 0).length;
    const progression = Math.round((filledCells / 81) * 100);

    const gameState = {
      name: slotName || `Partie ${new Date().toLocaleDateString()}`,
      board: this.board,
      initialBoard: this.initialBoard,
      solution: this.solution,
      notes: this.notes.map((set) => Array.from(set)),
      seconds: this.timer,
      difficulty: this.difficulty,
      timestamp: Date.now(),
      progression: progression,
    };

    slots[slotId] = gameState;

    const profileName = this.profileManager.getCurrentProfile();
    const key = `sudoku-slots-${profileName}`;

    try {
      localStorage.setItem(key, JSON.stringify(slots));
      return { success: true };
    } catch (e) {
      console.error("Failed to save slot", e);
      return { success: false, error: "Erreur lors de la sauvegarde" };
    }
  }

  loadFromSlot(slotId) {
    const slots = this.getSaveSlots();
    const slot = slots[slotId];

    if (!slot) {
      return { success: false, error: "Sauvegarde introuvable" };
    }

    try {
      // Clean up any active multiplayer modes first
      this.cleanupMultiplayerModes();

      // Validate slot structure
      if (
        !slot.board ||
        !slot.initialBoard ||
        !slot.solution ||
        !Array.isArray(slot.notes)
      ) {
        throw new Error("Invalid save slot format");
      }

      this.board = slot.board;
      this.initialBoard = slot.initialBoard;
      this.solution = slot.solution;
      this.notes = slot.notes.map((arr) => new Set(arr));
      this.timer = slot.seconds || 0;
      this.difficulty = slot.difficulty || "medium";

      this.renderBoard();
      this.isPlaying = true;

      // Clear and restart timer
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      this.startTimer();

      // Update difficulty display
      const diffDisplay = document.getElementById("current-difficulty");
      if (diffDisplay) {
        diffDisplay.textContent =
          this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1);
      }

      // Also save to auto-save
      this.saveGame();

      return { success: true };
    } catch (e) {
      console.error("Failed to load from slot", e);
      return { success: false, error: "Erreur lors du chargement" };
    }
  }

  deleteSlot(slotId) {
    const slots = this.getSaveSlots();

    if (!slots[slotId]) {
      return { success: false, error: "Sauvegarde introuvable" };
    }

    delete slots[slotId];

    const profileName = this.profileManager.getCurrentProfile();
    const key = `sudoku-slots-${profileName}`;

    try {
      localStorage.setItem(key, JSON.stringify(slots));
      return { success: true };
    } catch (e) {
      console.error("Failed to delete slot", e);
      return { success: false, error: "Erreur lors de la suppression" };
    }
  }

  getSlotInfo(slotId) {
    const slots = this.getSaveSlots();
    return slots[slotId] || null;
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${secs}`;
  }

  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;

    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }

  startNewGame() {
    // Clean up any active multiplayer modes
    this.cleanupMultiplayerModes();

    this.generateBoard();
    this.prepareBoardForDifficulty();
    this.notes = new Array(81).fill(null).map(() => new Set());
    this.hintsRemaining = 3;
    this.updateHintUI();
    this.renderBoard();
    this.resetGameStats();
    this.startTimer();
    this.isPlaying = true;
    this.statsManager.recordGameStart(this.difficulty);
    this.saveGame();

    const diffDisplay = document.getElementById("current-difficulty");
    if (diffDisplay) {
      diffDisplay.textContent =
        this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1);
    }
  }

  resetGameStats() {
    this.mistakes = 0;
    this.timer = 0;
    
    // Clear timer interval properly
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    if (this.dom.timer) this.dom.timer.textContent = "00:00";
  }

  startTimer() {
    // Always clear any existing timer first
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    this.isPaused = false;
    this.updatePauseUI();

    this.timerInterval = setInterval(() => {
      if (!this.isPaused && this.isPlaying) {
        this.timer++;
        const minutes = Math.floor(this.timer / 60)
          .toString()
          .padStart(2, "0");
        const seconds = (this.timer % 60).toString().padStart(2, "0");
        if (this.dom.timer)
          this.dom.timer.textContent = `${minutes}:${seconds}`;
      }
    }, 1000);
  }

  togglePause() {
    if (this.battleMode) return; // No pause in battle mode
    if (!this.isPlaying) return;

    this.isPaused = !this.isPaused;

    const board = document.getElementById("sudoku-board");
    if (board) {
      if (this.isPaused) {
        board.classList.add("blurred");
      } else {
        board.classList.remove("blurred");
      }
    }

    this.updatePauseUI();
  }

  resumeTimer() {
    if (this.isPaused) {
      this.isPaused = false;
      this.updatePauseUI();
    }
  }

  updatePauseUI() {
    if (this.isPaused) {
      document.body.classList.add("game-paused");
      if (this.dom.pauseBtn) {
        this.dom.pauseBtn.textContent = "▶️";
        this.dom.pauseBtn.title = "Reprendre";
      }
    } else {
      document.body.classList.remove("game-paused");
      if (this.dom.pauseBtn) {
        this.dom.pauseBtn.textContent = "⏸️";
        this.dom.pauseBtn.title = "Pause (P)";
      }
    }

    // Hide pause button in battle mode
    if (this.dom.pauseBtn) {
      this.dom.pauseBtn.style.display = this.battleMode ? "none" : "flex";
    }
  }

  updateHintUI() {
    if (this.dom.hintCount) {
      this.dom.hintCount.textContent = this.hintsRemaining;
    }
    if (this.dom.hintBtn) {
      if (this.hintsRemaining <= 0 || this.battleMode) {
        this.dom.hintBtn.classList.add("disabled");
        this.dom.hintBtn.style.opacity = "0.5";
        this.dom.hintBtn.style.cursor = "not-allowed";
      } else {
        this.dom.hintBtn.classList.remove("disabled");
        this.dom.hintBtn.style.opacity = "1";
        this.dom.hintBtn.style.cursor = "pointer";
      }
      // Hide in battle mode
      this.dom.hintBtn.style.display = this.battleMode ? "none" : "flex";
    }
  }

  getHint() {
    if (
      this.hintsRemaining <= 0 ||
      !this.isPlaying ||
      this.isPaused ||
      this.battleMode
    )
      return;

    // 1. Find all empty cells
    const emptyIndices = [];
    this.board.forEach((val, idx) => {
      if (val === 0) emptyIndices.push(idx);
    });

    if (emptyIndices.length === 0) return;

    let bestHint = null;
    let minCandidates = 10;

    // 2. Analyze candidates for each empty cell
    for (const idx of emptyIndices) {
      const row = Math.floor(idx / 9);
      const col = idx % 9;
      let candidates = 0;
      let validNum = 0;

      for (let num = 1; num <= 9; num++) {
        if (this.isSafe(this.board, row, col, num)) {
          candidates++;
          validNum = num;
        }
      }

      // Found a Naked Single (only 1 possibility)
      if (candidates === 1) {
        bestHint = { index: idx, type: "single" };
        break;
      }

      if (candidates < minCandidates) {
        minCandidates = candidates;
        bestHint = { index: idx, type: "fallback" };
      }
    }

    // 3. Apply Hint
    if (bestHint) {
      this.hintsRemaining--;
      this.updateHintUI();

      // Visual feedback
      const cell = this.dom.board.children[bestHint.index];

      // Remove existing highlights
      document
        .querySelectorAll(".hint-highlight")
        .forEach((el) => el.classList.remove("hint-highlight"));

      cell.classList.add("hint-highlight");
      this.selectCell(cell);

      // Auto-remove highlight after 5 seconds
      setTimeout(() => {
        cell.classList.remove("hint-highlight");
      }, 5000);

      // Play sound
      this.soundManager.playTap(); // Or specific hint sound

      // Show Riddle
      const correctValue = this.solution[bestHint.index];
      this.showRiddle(correctValue);
    }
  }

  showRiddle(number) {
    const riddles = {
      1: [
        "Je suis le commencement, l'unique.",
        "Seul, je me tiens debout comme un piquet.",
        "Le premier pas de tout voyage.",
      ],
      2: [
        "Le couple parfait, inséparable.",
        "Je suis le cygne sur le lac.",
        "Un, c'est peu. Moi, c'est mieux.",
      ],
      3: [
        "Le trépied stable de l'univers.",
        "Je forme le triangle parfait.",
        "Jamais deux sans moi.",
      ],
      4: [
        "Je suis la chaise renversée.",
        "Les points cardinaux me connaissent.",
        "Le carré est ma maison.",
      ],
      5: [
        "Au milieu de tout, je règne.",
        "La main ouverte me salue.",
        "L'étoile à cinq branches.",
      ],
      6: [
        "La tête en bas, je suis un neuf.",
        "L'hexagone est mon domaine.",
        "Le dé s'arrête souvent sur moi.",
      ],
      7: [
        "Le chiffre magique des contes.",
        "Je porte chance, dit-on.",
        "Les jours de la semaine sont miens.",
      ],
      8: [
        "L'infini qui s'est levé.",
        "Le bonhomme de neige éternel.",
        "Deux cercles unis pour la vie.",
      ],
      9: [
        "La fin du cycle, avant le zéro.",
        "Je suis un six qui a grandi.",
        "Le chat a autant de vies que moi.",
      ],
    };

    const options = riddles[number];
    const randomRiddle = options[Math.floor(Math.random() * options.length)];

    if (this.dom.riddleText && this.dom.riddleToast) {
      this.dom.riddleText.textContent = randomRiddle;
      this.dom.riddleToast.classList.remove("hidden");

      // Auto hide
      setTimeout(() => {
        this.dom.riddleToast.classList.add("hidden");
      }, 6000);
    }
  }

  generateBoard() {
    this.solution = Array(81).fill(0);
    for (let i = 0; i < 9; i += 3) {
      this.fillBox(i, i);
    }
    this.solveSudoku(this.solution);
    this.board = [...this.solution];
  }

  fillBox(row, col) {
    let num;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        do {
          num = Math.floor(Math.random() * 9) + 1;
        } while (!this.isSafeInBox(row, col, num));

        this.solution[(row + i) * 9 + (col + j)] = num;
      }
    }
  }

  isSafeInBox(rowStart, colStart, num) {
    if (!this.solution) return false;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (this.solution[(rowStart + i) * 9 + (colStart + j)] === num) {
          return false;
        }
      }
    }
    return true;
  }

  isSafe(board, row, col, num) {
    if (!board) return false;
    for (let x = 0; x < 9; x++) {
      if (board[row * 9 + x] === num) return false;
    }
    for (let x = 0; x < 9; x++) {
      if (board[x * 9 + col] === num) return false;
    }
    let startRow = row - (row % 3);
    let startCol = col - (col % 3);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (board[(startRow + i) * 9 + (startCol + j)] === num) return false;
      }
    }
    return true;
  }

  solveSudoku(board) {
    for (let i = 0; i < 81; i++) {
      if (board[i] === 0) {
        let row = Math.floor(i / 9);
        let col = i % 9;

        for (let num = 1; num <= 9; num++) {
          if (this.isSafe(board, row, col, num)) {
            board[i] = num;
            if (this.solveSudoku(board)) return true;
            board[i] = 0;
          }
        }
        return false;
      }
    }
    return true;
  }

  prepareBoardForDifficulty() {
    let attempts = 5;
    let removeCount;

    switch (this.difficulty) {
      case "easy":
        removeCount = 30;
        break;
      case "medium":
        removeCount = 40;
        break;
      case "hard":
        removeCount = 50;
        break;
      case "expert":
        removeCount = 60;
        break;
      default:
        removeCount = 30;
    }

    this.initialBoard = [...this.solution];

    while (removeCount > 0) {
      let cellId = Math.floor(Math.random() * 81);
      while (this.initialBoard[cellId] === 0) {
        cellId = Math.floor(Math.random() * 81);
      }

      let backup = this.initialBoard[cellId];
      this.initialBoard[cellId] = 0;

      // Copy board for solver
      let boardCopy = [...this.initialBoard];

      // Count solutions
      let solutions = 0;
      this.countSolutions(boardCopy, () => {
        solutions++;
      });

      if (solutions !== 1) {
        this.initialBoard[cellId] = backup;
        // Do not decrement attempts, just try another cell
      } else {
        removeCount--;
      }
    }
    this.board = [...this.initialBoard];
  }

  countSolutions(board, callback) {
    for (let i = 0; i < 81; i++) {
      if (board[i] === 0) {
        for (let num = 1; num <= 9; num++) {
          if (this.isSafe(board, Math.floor(i / 9), i % 9, num)) {
            board[i] = num;
            this.countSolutions(board, callback);
            board[i] = 0;
          }
        }
        return;
      }
    }
    callback();
  }

  renderBoard() {
    if (!this.dom.board) {
      return;
    }
    this.dom.board.innerHTML = "";
    this.board.forEach((num, index) => {
      const cell = document.createElement("div");
      cell.classList.add("cell");
      cell.dataset.index = index;
      this.dom.board.appendChild(cell);
      this.renderCell(index);
    });
  }

  selectCell(cell) {
    if (this.selectedCell) {
      this.selectedCell.classList.remove("selected");
      document
        .querySelectorAll(".cell")
        .forEach((c) => c.classList.remove("highlighted"));
    }

    this.selectedCell = cell;
    cell.classList.add("selected");

    const val = cell.textContent;
    if (val && !cell.querySelector(".notes-grid")) {
      // Don't highlight if it's just notes
      document.querySelectorAll(".cell").forEach((c) => {
        if (c.textContent === val && !c.querySelector(".notes-grid"))
          c.classList.add("highlighted");
      });
    }
  }

  checkWin() {
    const isFull = this.board.every((cell) => cell !== 0);
    if (isFull) {
      const isCorrect = this.board.every(
        (cell, i) => cell === this.solution[i]
      );
      if (isCorrect) {
        this.gameWon();
      } else {
        this.highlightErrors();
        this.showModal(
          "Oups !",
          "Il y a des erreurs. Les cases incorrectes ont été marquées."
        );
      }
    }
  }

  highlightErrors() {
    const cells = this.dom.board.children;
    this.board.forEach((num, i) => {
      if (num !== 0 && num !== this.solution[i]) {
        cells[i].classList.add("error");
      }
    });
  }

  gameWon() {
    this.isPlaying = false;
    
    // Clear timer interval
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Battle mode: notify win
    if (this.battleMode && this.battleManager) {
      this.battleManager.handleWin();
      return; // BattleManager will show the result
    }

    // Co-op mode: handle via CoopManager
    if (this.coopMode) {
      // CoopManager handles win display
      return;
    }

    // Record the win and check for new record
    const isNewRecord = this.statsManager.recordGameEnd(
      this.difficulty,
      this.timer,
      true
    );

    let message = `Vous avez gagné en ${this.dom.timer.textContent} !`;
    if (isNewRecord) {
      message += "\n🏆 NOUVEAU RECORD ! 🏆";
    }

    this.showModal("Victoire !", message);
    this.soundManager.playWin();
  }

  showModal(title, message) {
    if (this.dom.modalTitle) this.dom.modalTitle.textContent = title;
    if (this.dom.modalMessage) this.dom.modalMessage.textContent = message;
    if (this.dom.modal) this.dom.modal.classList.remove("hidden");
  }

  showStats() {
    const records = this.statsManager.getRecords();
    const stats = this.statsManager.getStats();

    // Update records
    document.getElementById("record-easy").textContent = records.easy
      ? this.statsManager.formatTime(records.easy)
      : "--:--";
    document.getElementById("record-medium").textContent = records.medium
      ? this.statsManager.formatTime(records.medium)
      : "--:--";
    document.getElementById("record-hard").textContent = records.hard
      ? this.statsManager.formatTime(records.hard)
      : "--:--";
    document.getElementById("record-expert").textContent = records.expert
      ? this.statsManager.formatTime(records.expert)
      : "--:--";

    // Update stats
    document.getElementById("stat-played").textContent = stats.gamesPlayed;
    document.getElementById("stat-won").textContent = stats.gamesWon;
    document.getElementById("stat-winrate").textContent = stats.winRate + "%";
    stats.averageTime > 0
      ? this.statsManager.formatTime(stats.averageTime)
      : "--:--";

    // Show modal
    if (this.dom.statsModal) this.dom.statsModal.classList.remove("hidden");
  }

  showSaves() {
    const slots = this.getSaveSlots();
    const slotIds = Object.keys(slots);

    if (!this.dom.savesList) return;

    // Clear the list
    this.dom.savesList.innerHTML = "";

    // Remove any existing event listener to avoid duplicates
    const oldList = this.dom.savesList.cloneNode(true);
    this.dom.savesList.parentNode.replaceChild(oldList, this.dom.savesList);
    this.dom.savesList = oldList;

    if (slotIds.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "empty-saves-message";
      emptyMessage.innerHTML =
        '📁 Aucune sauvegarde<br><span style="font-size: 0.9em; opacity: 0.7;">Créez une nouvelle sauvegarde pour commencer</span>';
      this.dom.savesList.appendChild(emptyMessage);
    } else {
      // Sort by timestamp (newest first)
      slotIds.sort((a, b) => slots[b].timestamp - slots[a].timestamp);

      slotIds.forEach((slotId) => {
        const slot = slots[slotId];
        const card = document.createElement("div");
        card.className = "save-card";
        card.dataset.slotId = slotId;

        const difficultyColors = {
          easy: "#4ade80",
          medium: "#60a5fa",
          hard: "#f59e0b",
          expert: "#ef4444",
        };

        card.innerHTML = `
                    <div class="save-card-header">
                        <div class="save-card-name">${slot.name}</div>
                        <div class="save-card-difficulty" style="--diff-color: ${
                          difficultyColors[slot.difficulty]
                        }">
                            ${
                              slot.difficulty.charAt(0).toUpperCase() +
                              slot.difficulty.slice(1)
                            }
                        </div>
                    </div>
                    <div class="save-card-info">
                        <div class="save-card-stat">
                            <span class="save-card-label">⏱️ Temps:</span>
                            <span class="save-card-value">${this.formatTime(
                              slot.seconds
                            )}</span>
                        </div>
                        <div class="save-card-stat">
                            <span class="save-card-label">📊 Progression:</span>
                            <span class="save-card-value">${
                              slot.progression
                            }%</span>
                        </div>
                        <div class="save-card-stat">
                            <span class="save-card-label">📅 Date:</span>
                            <span class="save-card-value">${this.formatDate(
                              slot.timestamp
                            )}</span>
                        </div>
                    </div>
                    <div class="save-card-actions">
                        <button class="save-card-btn load-btn" data-slot-id="${slotId}">Charger</button>
                        <button class="save-card-btn delete-btn" data-slot-id="${slotId}">Supprimer</button>
                    </div>
                `;

        this.dom.savesList.appendChild(card);
      });

      // Use event delegation for better reliability
      this.dom.savesList.addEventListener("click", (e) => {
        const target = e.target;

        // Handle load button click
        if (target.classList.contains("load-btn")) {
          const slotId = target.dataset.slotId;
          const result = this.loadFromSlot(slotId);
          if (result.success) {
            this.dom.savesModal.classList.add("hidden");
            this.showModal("Chargement réussi", "Votre partie a été chargée !");
          } else {
            alert(result.error);
          }
        }

        // Handle delete button click
        if (target.classList.contains("delete-btn")) {
          const slotId = target.dataset.slotId;
          const slots = this.getSaveSlots();
          const slot = slots[slotId];

          if (slot) {
            this.showConfirm(
              `Êtes-vous sûr de vouloir supprimer "${slot.name}" ?`,
              () => {
                const result = this.deleteSlot(slotId);
                if (result.success) {
                  this.showSaves(); // Refresh the list
                } else {
                  alert(result.error);
                }
              }
            );
          }
        }
      });
    }

    // Show modal
    if (this.dom.savesModal) this.dom.savesModal.classList.remove("hidden");
  }

  showConfirm(message, onConfirm) {
    if (!this.dom.confirmModal || !this.dom.confirmMessage) return;

    // Set the message
    this.dom.confirmMessage.textContent = message;

    // Show the modal
    this.dom.confirmModal.classList.remove("hidden");

    // Remove any existing listeners to avoid duplicates
    const newOkBtn = this.dom.confirmOk.cloneNode(true);
    const newCancelBtn = this.dom.confirmCancel.cloneNode(true);
    this.dom.confirmOk.parentNode.replaceChild(newOkBtn, this.dom.confirmOk);
    this.dom.confirmCancel.parentNode.replaceChild(
      newCancelBtn,
      this.dom.confirmCancel
    );
    this.dom.confirmOk = newOkBtn;
    this.dom.confirmCancel = newCancelBtn;

    // Add event listeners for OK
    this.dom.confirmOk.addEventListener("click", () => {
      this.dom.confirmModal.classList.add("hidden");
      if (onConfirm) onConfirm();
    });

    // Add event listeners for Cancel
    this.dom.confirmCancel.addEventListener("click", () => {
      this.dom.confirmModal.classList.add("hidden");
    });
  }

  promptSaveGame() {
    if (!this.isPlaying) {
      alert("Aucune partie en cours à sauvegarder.");
      return;
    }

    // Check if we've reached the limit
    const slots = this.getSaveSlots();
    if (Object.keys(slots).length >= 5) {
      alert(
        "Limite de 5 sauvegardes atteinte. Supprimez une sauvegarde existante."
      );
      return;
    }

    if (this.dom.saveNameModal && this.dom.saveNameInput) {
      this.dom.saveNameInput.value = `Partie ${new Date().toLocaleDateString(
        "fr-FR"
      )}`;
      this.dom.saveNameModal.classList.remove("hidden");
      this.dom.saveNameInput.select();
    }
  }

  confirmSaveGame() {
    const name = this.dom.saveNameInput?.value.trim();

    if (!name) {
      alert("Veuillez entrer un nom pour la sauvegarde.");
      return;
    }

    // Generate unique slot ID
    const slotId = `slot-${Date.now()}`;
    const result = this.saveToSlot(slotId, name);

    if (result.success) {
      this.dom.saveNameModal.classList.add("hidden");
      this.showSaves(); // Refresh the saves list
    } else {
      alert(result.error);
    }
  }

  // Co-op Mode Method
  startCoopMode() {
    this.currentMode = "coop";
    if (this.dom.battleChoiceModal) {
      this.dom.battleChoiceModal.classList.remove("hidden");
    }
  }

  // Battle Mode Methods
  async createBattleRoom() {
    const monitor = window.firebaseMonitor;
    
    if (!window.firebaseDB) {
      const errorMsg = "Service multijoueur indisponible. Vérifiez votre connexion internet.";
      if (monitor) monitor.showDisconnected(errorMsg);
      alert(errorMsg);
      return;
    }
    
    if (!this.battleManager && !this.coopManager) {
      alert("Managers non initialisés. Rafraîchissez la page.");
      return;
    }

    const playerName = this.dom.battleNameInput.value.trim();
    if (!playerName) {
      alert("Veuillez entrer un pseudo");
      return;
    }

    if (playerName.length < 2) {
      alert("Le pseudo doit contenir au moins 2 caractères");
      return;
    }

    if (playerName.length > 15) {
      alert("Le pseudo ne doit pas dépasser 15 caractères");
      return;
    }

    const selectedDiff = document.querySelector("[data-battle-diff].active");
    const difficulty = selectedDiff
      ? selectedDiff.dataset.battleDiff
      : "medium";

    this.dom.createRoomModal.classList.add("hidden");

    let result;
    try {
      if (this.currentMode === "coop") {
        // Get selected game mode (lives or timer)
        const selectedMode = document.querySelector(".mode-option-btn.active");
        const gameMode = selectedMode ? selectedMode.dataset.mode : "lives";
        result = await this.coopManager.createRoom(
          playerName,
          difficulty,
          gameMode
        );
      } else {
        // Default to battle mode if currentMode is not set or is 'battle'
        result = await this.battleManager.createRoom(playerName, difficulty);
      }

      if (result.success) {
        this.dom.waitingRoomCode.textContent = result.roomCode;
        this.dom.waitingRoomModal.classList.remove("hidden");

        // Update waiting room title for Co-op
        const title = document.querySelector("#waiting-room-modal h2");
        if (title && this.currentMode === "coop") {
          title.textContent = "🧬 Salon Fusion";
        } else if (title) {
          title.textContent = "⚔️ Salon de Bataille";
        }
      } else {
        alert(result.error || "Erreur lors de la création du salon");
        // Re-show create room modal to allow retry
        this.dom.createRoomModal.classList.remove("hidden");
      }
    } catch (error) {
      console.error("Error creating room:", error);
      const errorMsg = monitor ? monitor.getErrorMessage(error) : "Erreur de connexion";
      if (monitor) monitor.showDisconnected(errorMsg);
      alert(errorMsg + ". Vérifiez votre connexion internet et réessayez.");
      // Re-show create room modal to allow retry
      this.dom.createRoomModal.classList.remove("hidden");
    }
  }

  async joinBattleRoom() {
    const monitor = window.firebaseMonitor;
    const codeInput = document.getElementById("join-code-input");
    const nameInput = document.getElementById("join-name-input");

    const roomCode = codeInput ? codeInput.value.trim().toUpperCase() : "";
    const playerName = nameInput ? nameInput.value.trim() : "";

    // Validate room code format (6 alphanumeric characters)
    if (!roomCode) {
      alert("Veuillez entrer un code de salon");
      return;
    }
    
    if (roomCode.length !== 6) {
      alert("Le code du salon doit contenir 6 caractères");
      return;
    }
    
    if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
      alert("Le code du salon ne doit contenir que des lettres et des chiffres");
      return;
    }
    
    if (!playerName) {
      alert("Veuillez entrer un pseudo");
      return;
    }

    if (playerName.length < 2) {
      alert("Le pseudo doit contenir au moins 2 caractères");
      return;
    }

    if (playerName.length > 15) {
      alert("Le pseudo ne doit pas dépasser 15 caractères");
      return;
    }

    // First, check the room's mode from Firebase to determine which manager to use
    if (!window.firebaseDB) {
      const errorMsg = "Service multijoueur indisponible. Vérifiez votre connexion internet.";
      if (monitor) monitor.showDisconnected(errorMsg);
      alert(errorMsg);
      return;
    }

    try {
      if (monitor) monitor.showLoading("Vérification du salon...");
      
      const roomRef = window.firebaseRefs.ref(window.firebaseDB, `rooms/${roomCode}`);
      const snapshot = await Promise.race([
        new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Timeout"));
          }, 10000);
          
          window.firebaseRefs.onValue(roomRef, (snap) => {
            clearTimeout(timeout);
            resolve(snap);
          }, {
            onlyOnce: true,
          });
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        )
      ]);

      if (!snapshot.exists()) {
        if (monitor) monitor.hideLoading();
        alert("Salon introuvable. Vérifiez le code.");
        return;
      }

      const roomData = snapshot.val();
      const roomMode = roomData.mode || "battle";

      // Update currentMode based on room data
      this.currentMode = roomMode;

      if (monitor) monitor.hideLoading();

      let result;
      if (roomMode === "coop") {
        result = await this.coopManager.joinRoom(roomCode, playerName);
      } else {
        result = await this.battleManager.joinRoom(roomCode, playerName);
      }

      if (result.success) {
        this.dom.joinRoomModal.classList.add("hidden");
        if (roomMode === "coop") {
          this.coopMode = true;
          this.dom.coopHud.classList.remove("hidden");
          this.isPlaying = true;
        } else {
          this.battleMode = true;
        }
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error("Error checking room mode:", error);
      if (monitor) monitor.hideLoading();
      
      const errorMsg = monitor ? monitor.getErrorMessage(error) : 
        (error.message === "Timeout" ? "Délai d'attente dépassé" : "Erreur de connexion");
      
      if (monitor) monitor.showDisconnected(errorMsg);
      alert(errorMsg + ". Vérifiez votre connexion internet et réessayez.");
    }
  }

  updateProfileUI() {
    if (this.dom.profileName) {
      this.dom.profileName.textContent =
        this.profileManager.getCurrentProfile();
    }

    // Update dropdown list
    const dropdown = document.getElementById("profile-list");
    if (dropdown) {
      dropdown.innerHTML = "";
      const profiles = this.profileManager.getAllProfiles();
      const currentProfile = this.profileManager.getCurrentProfile();

      profiles.forEach((profileName) => {
        const item = document.createElement("div");
        item.className = "profile-item";
        if (profileName === currentProfile) {
          item.classList.add("active");
          item.innerHTML = `✓ ${profileName}`;
        } else {
          item.textContent = profileName;
        }
        item.addEventListener("click", () => this.switchToProfile(profileName));
        dropdown.appendChild(item);
      });
    }
  }

  createNewProfile() {
    const name = this.dom.newProfileInput.value;
    const result = this.profileManager.createProfile(name);

    if (result.success) {
      this.dom.profileModal.classList.add("hidden");
      this.switchToProfile(name);
    } else {
      alert(result.error);
    }
  }

  switchToProfile(profileName) {
    const result = this.profileManager.switchProfile(profileName);

    if (result.success) {
      // Reload stats with new profile
      this.statsManager = new StatsManager(this.profileManager);

      // Reload game data
      this.loadGame();

      // Update UI
      this.updateProfileUI();
      this.dom.profileDropdown.classList.add("hidden");

      // Reload theme
      this.themeManager.loadTheme(this.profileManager);
    } else {
      alert(result.error);
    }
  }

  // Clean up multiplayer modes and HUDs
  cleanupMultiplayerModes() {
    // Clean up managers first
    if (this.battleMode && this.battleManager) {
      this.battleManager.cleanup();
    }
    if (this.coopMode && this.coopManager) {
      this.coopManager.cleanup();
    }
    
    // Reset mode flags
    this.battleMode = false;
    this.coopMode = false;
    this.currentMode = null;

    // Hide HUDs
    if (this.dom.coopHud) {
      this.dom.coopHud.classList.add("hidden");
    }
    const battleHud = document.getElementById("battle-hud");
    if (battleHud) {
      battleHud.classList.add("hidden");
    }

    // Clean up DOM classes
    if (this.dom.board) {
      this.dom.board.classList.remove("coop-mode");
    }
    document.body.classList.remove("game-paused");

    // Update UI elements visibility
    this.updatePauseUI();
    this.updateHintUI();
  }
}

class SoundManager {
  constructor() {
    this.enabled = true;
    this.toggleBtn = document.getElementById("sound-toggle");

    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("AudioContext not supported");
      this.enabled = false;
    }

    if (this.toggleBtn) {
      this.toggleBtn.addEventListener("click", () => this.toggle());
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.toggleBtn) {
      this.toggleBtn.textContent = this.enabled ? "🔊" : "🔇";
      this.toggleBtn.classList.toggle("active", !this.enabled);
    }
  }

  playTone(freq, type, duration, vol = 0.1) {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === "suspended") this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.01,
      this.ctx.currentTime + duration
    );

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playTap() {
    this.playTone(600, "sine", 0.1, 0.1);
  }
  playNote() {
    this.playTone(800, "sine", 0.05, 0.05);
  }
  playErase() {
    this.playTone(300, "sine", 0.15, 0.1);
  }
  playWin() {
    if (!this.enabled) return;
    [440, 554, 659, 880].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, "sine", 0.5, 0.2), i * 100);
    });
  }
}

class ThemeManager {
  constructor() {
    this.buttons = document.querySelectorAll(".theme-btn");
    this.init();
  }

  init() {
    const savedTheme = localStorage.getItem("sudoku-theme") || "blue";
    this.setTheme(savedTheme);

    this.buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = btn.dataset.theme;
        this.setTheme(theme);
      });
    });
  }

  setTheme(theme) {
    document.body.className = `theme-${theme}`;
    localStorage.setItem("sudoku-theme", theme);

    this.buttons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.theme === theme);
    });
  }
}

class MediaController {
  constructor() {
    this.container = document.getElementById("media-container");
    this.toggleBtn = document.getElementById("multitask-btn");
    this.closeBtn = document.getElementById("close-media-btn");
    this.loadBtn = document.getElementById("load-media-btn");
    this.detachBtn = document.getElementById("detach-btn");
    this.input = document.getElementById("media-url");
    this.iframe = document.getElementById("media-frame");
    this.placeholder = document.querySelector(".placeholder-text");
    this.dragHandle = document.getElementById("drag-handle");
    this.resizeHandle = document.getElementById("floating-resize-handle");
    this.isFloating = false;

    if (this.container && this.toggleBtn) {
      this.init();
    }
  }

  init() {
    this.toggleBtn.addEventListener("click", () => this.toggleMedia());
    if (this.closeBtn)
      this.closeBtn.addEventListener("click", () => this.toggleMedia());
    if (this.loadBtn)
      this.loadBtn.addEventListener("click", () => this.loadMedia());
    if (this.detachBtn)
      this.detachBtn.addEventListener("click", () => this.toggleFloat());

    if (this.input) {
      this.input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.loadMedia();
      });
    }
  }

  toggleMedia() {
    const resizer = document.getElementById("resizer");
    const currentWidth = parseInt(this.container.style.width) || 0;
    const isOpen = currentWidth > 0;

    if (isOpen) {
      // CLOSING
      this.toggleBtn.textContent = "📺 Mode Multitâche";
      this.container.style.width = "0";
      if (resizer) resizer.classList.add("hidden");
    } else {
      // OPENING
      this.toggleBtn.textContent = "Fermer Multitâche";
      this.container.style.width = "400px";
      this.container.style.flex = "none";

      if (!this.isFloating && resizer) {
        resizer.classList.remove("hidden");
      }
    }
  }

  toggleFloat() {
    this.isFloating = !this.isFloating;
    this.container.classList.toggle("floating");
    if (this.dragHandle) this.dragHandle.classList.toggle("hidden");
    if (this.resizeHandle) this.resizeHandle.classList.toggle("hidden");
    const resizer = document.getElementById("resizer");

    if (this.isFloating) {
      this.detachBtn.textContent = "🔒";
      this.detachBtn.title = "Attacher";
      if (resizer) resizer.classList.add("hidden");
      document.getElementById("game-container").style.flex = "1";
    } else {
      this.detachBtn.textContent = "🔓";
      this.detachBtn.title = "Détacher";
      if (resizer) resizer.classList.remove("hidden");
      this.container.style.top = "";
      this.container.style.left = "";
      this.container.style.right = "";
      this.container.style.width = "";
      this.container.style.height = "";
      this.container.style.position = "";
    }
  }

  loadMedia() {
    const url = this.input.value.trim();
    if (!url) return;

    let embedUrl = "";

    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      let videoId = "";
      if (url.includes("v=")) {
        videoId = url.split("v=")[1].split("&")[0];
      } else if (url.includes("youtu.be/")) {
        videoId = url.split("youtu.be/")[1];
      }
      const origin = window.location.origin;
      embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&origin=${origin}`;
    } else if (url.includes("twitch.tv")) {
      const channel = url.split("twitch.tv/")[1].split("/")[0];
      const parent =
        window.location.hostname === ""
          ? "localhost"
          : window.location.hostname;
      embedUrl = `https://player.twitch.tv/?channel=${channel}&parent=${parent}`;
    } else {
      alert("Lien non reconnu. Essayez YouTube ou Twitch.");
      return;
    }

    this.iframe.src = embedUrl;
    if (this.placeholder) this.placeholder.style.display = "none";
  }
}

class ResizeController {
  constructor() {
    this.resizer = document.getElementById("resizer");
    this.leftSide = document.getElementById("game-container");
    this.rightSide = document.getElementById("media-container");
    this.wrapper = document.querySelector(".app-wrapper");
    this.isResizing = false;

    if (this.resizer && this.leftSide && this.rightSide) {
      this.init();
    }
  }

  init() {
    this.resizer.addEventListener("mousedown", (e) => {
      this.isResizing = true;
      this.resizer.classList.add("resizing");
      document.body.style.cursor = "col-resize";
      const frame = document.getElementById("media-frame");
      if (frame) frame.style.pointerEvents = "none";
    });

    document.addEventListener("mousemove", (e) => this.handleMouseMove(e));
    document.addEventListener("mouseup", () => this.stopResize());
  }

  handleMouseMove(e) {
    if (!this.isResizing) return;

    const containerRect = this.wrapper.getBoundingClientRect();
    const pointerRelativeXpos = e.clientX - containerRect.left;
    const minWidth = containerRect.width * 0.3;

    if (
      pointerRelativeXpos > minWidth &&
      pointerRelativeXpos < containerRect.width - minWidth
    ) {
      const leftWidth = (pointerRelativeXpos / containerRect.width) * 100;
      const rightWidth = 100 - leftWidth;

      this.leftSide.style.flex = `0 0 ${leftWidth}%`;
      this.rightSide.style.flex = `0 0 ${rightWidth}%`;
    }
  }

  stopResize() {
    if (this.isResizing) {
      this.isResizing = false;
      this.resizer.classList.remove("resizing");
      document.body.style.cursor = "";
      const frame = document.getElementById("media-frame");
      if (frame) frame.style.pointerEvents = "auto";
    }
  }
}

class DragController {
  constructor() {
    this.handle = document.getElementById("drag-handle");
    this.container = document.getElementById("media-container");
    this.isDragging = false;
    this.offset = { x: 0, y: 0 };

    if (this.handle && this.container) {
      this.init();
    }
  }

  init() {
    this.handle.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.container.style.cursor = "move";
      this.offset.x = e.clientX - this.container.getBoundingClientRect().left;
      this.offset.y = e.clientY - this.container.getBoundingClientRect().top;
      const frame = document.getElementById("media-frame");
      if (frame) frame.style.pointerEvents = "none";
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      this.container.style.left = e.clientX - this.offset.x + "px";
      this.container.style.top = e.clientY - this.offset.y + "px";
      this.container.style.right = "auto";
    });

    document.addEventListener("mouseup", () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.container.style.cursor = "default";
        const frame = document.getElementById("media-frame");
        if (frame) frame.style.pointerEvents = "auto";
      }
    });
  }
}

class FloatingResizeController {
  constructor() {
    this.handle = document.getElementById("floating-resize-handle");
    this.container = document.getElementById("media-container");
    this.isResizing = false;

    if (this.handle && this.container) {
      this.init();
    }
  }

  init() {
    this.handle.addEventListener("mousedown", (e) => {
      this.isResizing = true;
      e.stopPropagation();
      const frame = document.getElementById("media-frame");
      if (frame) frame.style.pointerEvents = "none";
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.isResizing) return;

      const newWidth = e.clientX - this.container.getBoundingClientRect().left;
      const newHeight = e.clientY - this.container.getBoundingClientRect().top;

      if (newWidth > 300) this.container.style.width = newWidth + "px";
      if (newHeight > 200) this.container.style.height = newHeight + "px";
    });

    document.addEventListener("mouseup", () => {
      if (this.isResizing) {
        this.isResizing = false;
        const frame = document.getElementById("media-frame");
        if (frame) frame.style.pointerEvents = "auto";
      }
    });
  }
}

class ProfileManager {
  constructor() {
    this.currentProfile = null;
    this.profiles = [];
    this.init();
  }

  init() {
    // Check if this is first time (migration needed)
    const hasOldData =
      localStorage.getItem("sudoku-save") ||
      localStorage.getItem("sudoku-stats");
    const profilesExist = localStorage.getItem("sudoku-profiles");

    if (!profilesExist) {
      // First time setup
      if (hasOldData) {
        // Migrate old data to "Joueur 1"
        this.migrateOldData();
      } else {
        // Create default profile
        this.profiles = ["Joueur 1"];
        this.currentProfile = "Joueur 1";
        this.saveProfiles();
      }
    } else {
      // Load existing profiles
      this.profiles = JSON.parse(profilesExist);
      this.currentProfile =
        localStorage.getItem("sudoku-current-profile") || this.profiles[0];
    }
  }

  migrateOldData() {
    // Migrating old data to default profile

    const defaultProfile = "Joueur 1";

    // Migrate save data
    const oldSave = localStorage.getItem("sudoku-save");
    if (oldSave) {
      localStorage.setItem(`sudoku-save-${defaultProfile}`, oldSave);
      localStorage.removeItem("sudoku-save");
    }

    // Migrate stats
    const oldStats = localStorage.getItem("sudoku-stats");
    if (oldStats) {
      localStorage.setItem(`sudoku-stats-${defaultProfile}`, oldStats);
      localStorage.removeItem("sudoku-stats");
    }

    // Migrate theme (if exists)
    const oldTheme = localStorage.getItem("sudoku-theme");
    if (oldTheme) {
      localStorage.setItem(`sudoku-theme-${defaultProfile}`, oldTheme);
    }

    // Set up profile system
    this.profiles = [defaultProfile];
    this.currentProfile = defaultProfile;
    this.saveProfiles();
  }

  saveProfiles() {
    localStorage.setItem("sudoku-profiles", JSON.stringify(this.profiles));
    localStorage.setItem("sudoku-current-profile", this.currentProfile);
  }

  createProfile(name) {
    if (!name || name.trim() === "") {
      return { success: false, error: "Le nom ne peut pas être vide" };
    }

    const trimmedName = name.trim();

    if (this.profiles.includes(trimmedName)) {
      return { success: false, error: "Ce profil existe déjà" };
    }

    if (this.profiles.length >= 10) {
      return { success: false, error: "Maximum 10 profils atteints" };
    }

    this.profiles.push(trimmedName);
    this.saveProfiles();
    return { success: true };
  }

  switchProfile(name) {
    if (!this.profiles.includes(name)) {
      return { success: false, error: "Profil introuvable" };
    }

    this.currentProfile = name;
    localStorage.setItem("sudoku-current-profile", name);
    return { success: true };
  }

  deleteProfile(name) {
    if (this.profiles.length === 1) {
      return {
        success: false,
        error: "Impossible de supprimer le dernier profil",
      };
    }

    if (!this.profiles.includes(name)) {
      return { success: false, error: "Profil introuvable" };
    }

    // Remove profile data
    localStorage.removeItem(`sudoku-save-${name}`);
    localStorage.removeItem(`sudoku-stats-${name}`);
    localStorage.removeItem(`sudoku-theme-${name}`);

    // Remove from list
    this.profiles = this.profiles.filter((p) => p !== name);

    // Switch to first profile if deleting current
    if (this.currentProfile === name) {
      this.currentProfile = this.profiles[0];
    }

    this.saveProfiles();
    return { success: true };
  }

  getCurrentProfile() {
    return this.currentProfile;
  }

  getAllProfiles() {
    return [...this.profiles];
  }

  getStorageKey(baseKey) {
    return `${baseKey}-${this.currentProfile}`;
  }
}

class StatsManager {
  constructor(profileManager) {
    this.profileManager = profileManager;
    this.stats = this.loadStats();
    this.currentGameStart = null;
  }

  loadStats() {
    const key = this.profileManager.getStorageKey("sudoku-stats");
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load stats", e);
      }
    }

    // Default stats structure
    return {
      records: {
        easy: null,
        medium: null,
        hard: null,
        expert: null,
      },
      gamesPlayed: 0,
      gamesWon: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalTime: 0,
      timeByDifficulty: {
        easy: { total: 0, count: 0 },
        medium: { total: 0, count: 0 },
        hard: { total: 0, count: 0 },
        expert: { total: 0, count: 0 },
      },
    };
  }

  saveStats() {
    try {
      const key = this.profileManager.getStorageKey("sudoku-stats");
      localStorage.setItem(key, JSON.stringify(this.stats));
    } catch (e) {
      console.error("Failed to save stats", e);
    }
  }

  recordGameStart(difficulty) {
    this.currentGameStart = { difficulty, startTime: Date.now() };
  }

  recordGameEnd(difficulty, timeInSeconds, won) {
    this.stats.gamesPlayed++;

    if (won) {
      this.stats.gamesWon++;
      this.stats.currentStreak++;
      this.stats.bestStreak = Math.max(
        this.stats.bestStreak,
        this.stats.currentStreak
      );

      // Update time stats
      this.stats.totalTime += timeInSeconds;
      this.stats.timeByDifficulty[difficulty].total += timeInSeconds;
      this.stats.timeByDifficulty[difficulty].count++;

      // Check for new record
      const currentRecord = this.stats.records[difficulty];
      if (!currentRecord || timeInSeconds < currentRecord) {
        this.stats.records[difficulty] = timeInSeconds;
        this.saveStats();
        return true; // New record!
      }
    } else {
      this.stats.currentStreak = 0;
    }

    this.saveStats();
    return false;
  }

  isNewRecord(difficulty, time) {
    const currentRecord = this.stats.records[difficulty];
    return !currentRecord || time < currentRecord;
  }

  getRecords() {
    return this.stats.records;
  }

  getStats() {
    return {
      gamesPlayed: this.stats.gamesPlayed,
      gamesWon: this.stats.gamesWon,
      winRate:
        this.stats.gamesPlayed > 0
          ? Math.round((this.stats.gamesWon / this.stats.gamesPlayed) * 100)
          : 0,
      currentStreak: this.stats.currentStreak,
      bestStreak: this.stats.bestStreak,
      averageTime:
        this.stats.gamesWon > 0
          ? Math.round(this.stats.totalTime / this.stats.gamesWon)
          : 0,
    };
  }

  getAverageTime(difficulty) {
    const data = this.stats.timeByDifficulty[difficulty];
    return data.count > 0 ? Math.round(data.total / data.count) : 0;
  }

  resetStats() {
    this.stats = {
      records: { easy: null, medium: null, hard: null, expert: null },
      gamesPlayed: 0,
      gamesWon: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalTime: 0,
      timeByDifficulty: {
        easy: { total: 0, count: 0 },
        medium: { total: 0, count: 0 },
        hard: { total: 0, count: 0 },
        expert: { total: 0, count: 0 },
      },
    };
    this.saveStats();
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
}

// Start the game
window.addEventListener("DOMContentLoaded", () => {
  try {
    window.game = new SudokuGame();
    new MediaController();
    new ResizeController();
    new DragController();
    new FloatingResizeController();
  } catch (e) {
    console.error("Critical startup error", e);
  }
});
