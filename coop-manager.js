// Coop Manager - Gère la logique multijoueur coopérative (Fusion)
class CoopManager {
  constructor(sudokuGame) {
    this.game = sudokuGame;
    this.db = window.firebaseDB;
    this.dbRefs = window.firebaseRefs;
    this.currentRoom = null;
    this.playerName = null;
    this.playerColor = null; // 'blue' (p1) or 'orange' (p2)
    this.isHost = false;
    this.roomListeners = [];
    this.mistakes = 0;
    this.maxMistakes = 3;
    this.gameStarted = false;
    this.cellOwners = {}; // Local cache of cell owners
    this.pendingMoves = new Set(); // Track pending moves to prevent conflicts
  }

  cleanup() {
    // Stop the game
    this.game.isPlaying = false;
    
    // Clear timer interval
    if (this.game.timerInterval) {
      clearInterval(this.game.timerInterval);
      this.game.timerInterval = null;
    }
    
    // Clean up listeners
    this.roomListeners.forEach((unsubscribe) => {
      if (typeof unsubscribe === "function") unsubscribe();
    });
    this.roomListeners = [];
    
    // Reset state
    this.currentRoom = null;
    this.isHost = false;
    this.gameStarted = false;
    this.cellOwners = {};
    this.pendingMoves.clear();
    this.game.coopMode = false;
    this.game.battleMode = false;
    this.game.currentMode = null;
    
    // Clean up DOM
    if (this.game.dom.board) {
      this.game.dom.board.classList.remove("coop-mode");
    }
    if (this.game.dom.coopHud) {
      this.game.dom.coopHud.classList.add("hidden");
    }
    document.body.classList.remove("game-paused");
  }

  generateRoomCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async createRoom(playerName, difficulty, gameMode = "lives") {
    const monitor = window.firebaseMonitor;
    
    // Check Firebase availability
    if (!this.db) {
      const errorMsg = "Service multijoueur indisponible";
      if (monitor) monitor.showDisconnected(errorMsg);
      return {
        success: false,
        error: errorMsg + ". Vérifiez votre connexion internet.",
      };
    }

    // Check connection status
    if (monitor && !monitor.isConnected()) {
      return {
        success: false,
        error: "Pas de connexion au serveur. Vérifiez votre connexion internet.",
      };
    }

    // Show loading
    if (monitor) monitor.showLoading("Création du salon Fusion...");

    try {
      const roomCode = this.generateRoomCode();
      this.playerName = playerName;
      this.isHost = true;
      this.playerColor = "blue";

      // Générer une nouvelle grille
      this.game.difficulty = difficulty;
      this.game.generateBoard();
      this.game.prepareBoardForDifficulty();

      const roomData = {
        mode: "coop",
        roomCode: roomCode,
        host: playerName,
        guest: null,
        difficulty: difficulty,
        livesEnabled: gameMode === "lives",
        status: "waiting",
        createdAt: Date.now(),
        board: this.game.initialBoard,
        currentBoard: [...this.game.board],
        solution: this.game.solution,
        mistakes: 0,
        cellOwners: {},
        players: {
          p1: { name: playerName, color: "blue", connected: true },
          p2: null,
        },
      };

      const roomRef = this.dbRefs.ref(this.db, `rooms/${roomCode}`);
      
      await Promise.race([
        this.dbRefs.set(roomRef, roomData),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        )
      ]);

      this.currentRoom = roomCode;
      this.cellOwners = {};
      this.setupRoomListeners(roomCode);
      this.setupPresence(roomCode, "p1");

      if (monitor) monitor.hideLoading();
      return { success: true, roomCode: roomCode };
    } catch (error) {
      console.error("Error creating coop room:", error);
      if (monitor) {
        monitor.hideLoading();
        const errorMsg = monitor.getErrorMessage(error);
        monitor.showDisconnected(errorMsg);
      }
      
      // Retry logic
      if (error.message === 'Timeout' && monitor && monitor.retryAttempts < monitor.maxRetries) {
        try {
          return await monitor.retryConnection(
            () => this.createRoom(playerName, difficulty, gameMode),
            'Création du salon Fusion'
          );
        } catch (retryError) {
          return {
            success: false,
            error: monitor.getErrorMessage(retryError),
          };
        }
      }
      
      return { 
        success: false, 
        error: monitor ? monitor.getErrorMessage(error) : (error.message || "Erreur de connexion")
      };
    }
  }

  async joinRoom(roomCode, playerName) {
    const monitor = window.firebaseMonitor;
    
    // Check Firebase availability
    if (!this.db) {
      const errorMsg = "Service multijoueur indisponible";
      if (monitor) monitor.showDisconnected(errorMsg);
      return {
        success: false,
        error: errorMsg + ". Vérifiez votre connexion internet.",
      };
    }

    // Check connection status
    if (monitor && !monitor.isConnected()) {
      return {
        success: false,
        error: "Pas de connexion au serveur. Vérifiez votre connexion internet.",
      };
    }

    // Show loading
    if (monitor) monitor.showLoading("Connexion au salon Fusion...");

    try {
      this.playerName = playerName;
      this.isHost = false;
      this.playerColor = "orange";

      const roomRef = this.dbRefs.ref(this.db, `rooms/${roomCode}`);
      const snapshot = await Promise.race([
        new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Timeout"));
          }, 10000);
          
          this.dbRefs.onValue(roomRef, (snap) => {
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
        return { success: false, error: "Salon introuvable. Vérifiez le code." };
      }
      
      const roomData = snapshot.val();

      if (roomData.mode !== "coop") {
        if (monitor) monitor.hideLoading();
        return { success: false, error: "Ce salon n'est pas en mode Fusion." };
      }
      
      if (roomData.guest) {
        if (monitor) monitor.hideLoading();
        return { success: false, error: "Salon complet (2/2 joueurs)." };
      }
      
      if (roomData.status !== "waiting") {
        if (monitor) monitor.hideLoading();
        return { success: false, error: "La partie a déjà commencé." };
      }

      await Promise.race([
        this.dbRefs.update(roomRef, {
          guest: playerName,
          status: "starting",
          "players/p2": { name: playerName, color: "orange", connected: true },
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        )
      ]);

      this.currentRoom = roomCode;

      // Load initial state
      this.game.difficulty = roomData.difficulty;
      this.game.initialBoard = roomData.board;
      this.game.solution = roomData.solution;
      this.game.board = [...roomData.currentBoard];
      this.cellOwners = { ...(roomData.cellOwners || {}) };
      this.game.renderBoard();

      this.setupRoomListeners(roomCode);
      this.setupPresence(roomCode, "p2");

      if (monitor) monitor.hideLoading();
      return { success: true, roomCode: roomCode };
    } catch (error) {
      console.error("Error joining coop room:", error);
      if (monitor) {
        monitor.hideLoading();
        const errorMsg = monitor.getErrorMessage(error);
        monitor.showDisconnected(errorMsg);
      }
      
      // Retry logic
      if (error.message === 'Timeout' && monitor && monitor.retryAttempts < monitor.maxRetries) {
        try {
          return await monitor.retryConnection(
            () => this.joinRoom(roomCode, playerName),
            'Connexion au salon Fusion'
          );
        } catch (retryError) {
          return {
            success: false,
            error: monitor.getErrorMessage(retryError),
          };
        }
      }
      
      return { 
        success: false, 
        error: monitor ? monitor.getErrorMessage(error) : (error.message || "Erreur de connexion")
      };
    }
  }

  setupRoomListeners(roomCode) {
    const roomRef = this.dbRefs.ref(this.db, `rooms/${roomCode}`);
    const monitor = window.firebaseMonitor;

    const unsubscribe = this.dbRefs.onValue(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        this.cleanup();
        this.game.showModal(
          "Salon fermé", 
          "Le salon a été fermé par l'hôte ou en raison d'une déconnexion."
        );
        return;
      }
      const data = snapshot.val();
      this.handleRoomUpdate(data);
    }, (error) => {
      console.error("Firebase listener error:", error);
      const errorMsg = monitor ? monitor.getErrorMessage(error) : "Connexion au serveur perdue";
      
      if (monitor) {
        monitor.showDisconnected(errorMsg);
      }
      
      this.game.showModal(
        "Erreur de connexion",
        errorMsg + ". La partie a été interrompue."
      );
      this.cleanup();
    });
    this.roomListeners.push(unsubscribe);
  }

  handleRoomUpdate(data) {
    // Start game when status changes to 'starting'
    if (data.status === "starting" && !this.gameStarted) {
      this.gameStarted = true;
      this.startGame(data);
    }

    // Sync Board and Cell Owners
    if (data.currentBoard) {
      // Update board only for cells not in pending state
      for (let i = 0; i < 81; i++) {
        if (!this.pendingMoves.has(i)) {
          this.game.board[i] = data.currentBoard[i];
        }
      }

      // Update cellOwners cache
      this.cellOwners = { ...(data.cellOwners || {}) };

      // Update UI with owners
      this.updateBoardUI(this.game.board, this.cellOwners);
    }

    // Sync Mistakes (Lives)
    if (data.mistakes !== undefined) {
      this.mistakes = data.mistakes;
      this.updateLivesUI();
      if (this.livesEnabled && this.mistakes >= this.maxMistakes) {
        this.handleGameOver();
      }
    }

    // Sync Partner Status
    if (data.players) {
      const partnerKey = this.isHost ? "p2" : "p1";
      const partner = data.players[partnerKey];
      this.updatePartnerUI(partner);
    }

    // Check Win
    if (data.status === "won") {
      this.game.showModal("VICTOIRE !", "Bravo ! La fusion est complète ! 🏆");
      this.game.soundManager.playWin();
      this.game.isPlaying = false;
      
      // Clear timer interval
      if (this.game.timerInterval) {
        clearInterval(this.game.timerInterval);
        this.game.timerInterval = null;
      }
      
      // Hide Co-op HUD after game end
      if (this.game.dom.coopHud) {
        this.game.dom.coopHud.classList.add("hidden");
      }
      
      // Clean up co-op mode state
      this.game.coopMode = false;
      this.game.currentMode = null;
      if (this.game.dom.board) {
        this.game.dom.board.classList.remove("coop-mode");
      }
    }
  }

  // Start the Co-op game for both players
  async startGame(roomData) {
    // Close all modals
    const modalsToHide = [
      "battle-choice-modal",
      "create-room-modal",
      "join-room-modal",
      "waiting-room-modal",
    ];
    modalsToHide.forEach((id) => {
      const modal = document.getElementById(id);
      if (modal) modal.classList.add("hidden");
    });

    // Ensure Battle HUD is hidden in co-op mode
    const battleHud = document.getElementById("battle-hud");
    if (battleHud) {
      battleHud.classList.add("hidden");
    }

    // Show Co-op HUD
    if (this.game.dom.coopHud) {
      this.game.dom.coopHud.classList.remove("hidden");
    }

    // Update status to 'playing' (only host does this)
    if (this.isHost) {
      const roomRef = this.dbRefs.ref(this.db, `rooms/${this.currentRoom}`);
      await this.dbRefs.update(roomRef, {
        status: "playing",
        startTime: Date.now(),
      });
    }

    // Initialize game state
    this.game.board = [...roomData.currentBoard];
    this.game.initialBoard = roomData.board;
    this.game.solution = roomData.solution;
    this.cellOwners = { ...(roomData.cellOwners || {}) }; // Initialize local cache
    this.game.notes = new Array(81).fill(null).map(() => new Set());
    this.game.renderBoard();
    
    // Set flags properly
    this.game.isPlaying = true;
    this.game.coopMode = true;
    this.game.battleMode = false;
    this.game.currentMode = "coop";
    
    this.game.dom.board.classList.add("coop-mode"); // Add class for CSS overrides
    
    // Reset and start timer
    this.game.resetGameStats();
    this.game.startTimer();

    // Store mode preference
    this.livesEnabled = roomData.livesEnabled !== false; // Default true for backward compat

    // Update HUD visibility
    const livesContainer = document.querySelector(".lives-container");
    if (livesContainer) {
      livesContainer.style.display = this.livesEnabled ? "flex" : "none";
    }

    // Initialize lives UI
    this.updateLivesUI();

    // Update partner UI
    const partnerKey = this.isHost ? "p2" : "p1";
    const partner = roomData.players[partnerKey];
    if (partner) {
      this.updatePartnerUI(partner);
    }
  }

  updateBoardUI(board, cellOwners) {
    // Re-render cells that need update
    const cells = this.game.dom.board.children;
    for (let i = 0; i < 81; i++) {
      const cell = cells[i];
      if (!cell) continue;

      const val = board[i];
      const owner = cellOwners ? cellOwners[i] : null;
      const isFixed = this.game.initialBoard[i] !== 0;

      // Update content if changed (skip if it's a pending move)
      if (!this.pendingMoves.has(i)) {
        // Handle empty cells
        if (val === 0 || val === null) {
          if (!cell.querySelector(".notes-grid")) {
            cell.textContent = "";
          }
        } else {
          // Handle filled cells
          if (cell.textContent != val) {
            cell.textContent = val;
            // Clear notes if number placed
            const notesGrid = cell.querySelector(".notes-grid");
            if (notesGrid) {
              notesGrid.remove();
            }
          }
        }
      }

      // Apply Owner Styles (but not on fixed cells)
      cell.classList.remove("cell-p1", "cell-p2");
      if (!isFixed && owner === "p1") {
        cell.classList.add("cell-p1");
      }
      if (!isFixed && owner === "p2") {
        cell.classList.add("cell-p2");
      }
    }
  }

  updateLivesUI() {
    const livesEl = document.getElementById("coop-lives");
    if (livesEl) {
      const livesLeft = Math.max(0, this.maxMistakes - this.mistakes);
      livesEl.textContent =
        "❤️".repeat(livesLeft) + "🖤".repeat(this.maxMistakes - livesLeft);
    }
  }

  updatePartnerUI(partner) {
    const partnerEl = document.getElementById("coop-partner");
    if (partnerEl && partner) {
      partnerEl.innerHTML = `
                <span class="partner-dot ${
                  partner.connected ? "online" : "offline"
                }"></span>
                ${partner.name}
            `;
    } else if (partnerEl) {
      partnerEl.innerHTML = "En attente...";
    }
  }

  async makeMove(index, value) {
    if (!this.currentRoom) return false;
    
    // Don't allow moves on fixed cells
    if (this.game.initialBoard[index] !== 0) return false;

    const playerKey = this.isHost ? "p1" : "p2";
    const roomRef = this.dbRefs.ref(this.db, `rooms/${this.currentRoom}`);
    const monitor = window.firebaseMonitor;

    // Mark this cell as pending to prevent conflicts
    this.pendingMoves.add(index);

    try {
      // In Lives mode: Check correctness and decrement lives on mistakes
      // In Timer mode: Allow any number (like real Sudoku)
      if (
        this.livesEnabled &&
        value !== 0 &&
        value !== this.game.solution[index]
      ) {
        // Mistake in Lives mode!
        this.showErrorFeedback(index);
        
        await Promise.race([
          this.dbRefs.update(roomRef, {
            mistakes: this.mistakes + 1,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ]);
        
        this.pendingMoves.delete(index);
        return false;
      }

      // Optimistically update local state
      this.game.board[index] = value;
      if (value !== 0) {
        this.cellOwners[index] = playerKey;
      } else {
        delete this.cellOwners[index];
      }

      // Update local UI immediately for responsiveness
      this.game.renderCell(index);

      // Build updates object for Firebase
      const updates = {};
      updates[`currentBoard/${index}`] = value;
      if (value !== 0) {
        updates[`cellOwners/${index}`] = playerKey;
      } else {
        // Erase
        updates[`cellOwners/${index}`] = null;
      }

      // Send to Firebase with timeout
      await Promise.race([
        this.dbRefs.update(roomRef, updates),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      ]);

      // Clear pending state
      this.pendingMoves.delete(index);

      // Check Win Condition after successful move
      if (value !== 0) {
        await this.checkWinCondition();
      }

      return true;
    } catch (error) {
      console.error("Error making move:", error);
      
      if (monitor) {
        const errorMsg = monitor.getErrorMessage(error);
        monitor.showDisconnected(errorMsg);
      }
      
      // Revert optimistic update on error
      this.pendingMoves.delete(index);
      
      // Try to resync
      try {
        const snapshot = await Promise.race([
          new Promise((resolve) => {
            this.dbRefs.onValue(roomRef, (snap) => resolve(snap), {
              onlyOnce: true,
            });
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ]);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          this.game.board = [...data.currentBoard];
          this.cellOwners = { ...(data.cellOwners || {}) };
          this.updateBoardUI(this.game.board, this.cellOwners);
        }
      } catch (resyncError) {
        console.error("Failed to resync:", resyncError);
      }
      
      return false;
    }
  }

  async checkWinCondition() {
    if (!this.currentRoom) return;

    // Check if board is completely filled
    const isFull = this.game.board.every((cell) => cell !== 0);
    
    if (!isFull) return;

    // In Lives mode, if board is full, it's automatically correct (mistakes prevent incorrect fills)
    // In Timer mode, check if solution matches
    let isCorrect = true;
    if (!this.livesEnabled) {
      isCorrect = this.game.board.every(
        (cell, i) => cell === this.game.solution[i]
      );
    }

    if (isCorrect) {
      // Update room status to won (only once, use transaction or check)
      const roomRef = this.dbRefs.ref(this.db, `rooms/${this.currentRoom}`);
      
      // Fetch current status first to avoid race condition
      const snapshot = await new Promise((resolve) => {
        this.dbRefs.onValue(roomRef, (snap) => resolve(snap), {
          onlyOnce: true,
        });
      });
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Only update if not already won
        if (data.status !== "won") {
          await this.dbRefs.update(roomRef, {
            status: "won",
            endTime: Date.now(),
          });
        }
      }
    }
  }

  handleGameOver() {
    this.game.showModal("GAME OVER", "Vous avez épuisé vos vies communes ! 💀");
    this.game.isPlaying = false;
    
    // Clear timer interval
    if (this.game.timerInterval) {
      clearInterval(this.game.timerInterval);
      this.game.timerInterval = null;
    }
    
    // Hide Co-op HUD after game over
    if (this.game.dom.coopHud) {
      this.game.dom.coopHud.classList.add("hidden");
    }
    
    // Clean up co-op mode state
    this.game.coopMode = false;
    this.game.currentMode = null;
    if (this.game.dom.board) {
      this.game.dom.board.classList.remove("coop-mode");
    }
  }

  showErrorFeedback(index) {
    // Flash the cell red temporarily
    const cell = this.game.dom.board.children[index];
    if (cell) {
      const originalBg = cell.style.background;
      cell.style.background = "rgba(255, 0, 85, 0.5)";
      setTimeout(() => {
        cell.style.background = originalBg;
      }, 500);
    }
  }

  setupPresence(roomCode, playerKey) {
    const conRef = this.dbRefs.ref(
      this.db,
      `rooms/${roomCode}/players/${playerKey}/connected`
    );
    this.dbRefs.onDisconnect(conRef).set(false);
    this.dbRefs.set(conRef, true);
  }
}

window.CoopManager = CoopManager;
