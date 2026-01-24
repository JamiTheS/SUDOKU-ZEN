// Battle Manager - Gère toute la logique multijoueur avec Firebase
class BattleManager {
  constructor(sudokuGame) {
    this.game = sudokuGame;
    this.db = window.firebaseDB;
    this.dbRefs = window.firebaseRefs;
    this.currentRoom = null;
    this.playerName = null;
    this.isHost = false;
    this.roomListeners = [];
  }

  // Génère un code de salon unique (6 caractères)
  generateRoomCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Crée un nouveau salon
  async createRoom(playerName, difficulty) {
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
    if (monitor) monitor.showLoading("Création du salon...");

    try {
      const roomCode = this.generateRoomCode();
      this.playerName = playerName;
      this.isHost = true;

      // Générer une nouvelle grille
      this.game.difficulty = difficulty;
      this.game.generateBoard();
      this.game.prepareBoardForDifficulty();

      const roomData = {
        mode: "battle",
        roomCode: roomCode,
        host: playerName,
        guest: null,
        difficulty: difficulty,
        status: "waiting",
        createdAt: Date.now(),
        board: this.game.initialBoard,
        solution: this.game.solution,
        startTime: null,
        players: {
          [playerName]: {
            name: playerName,
            progress: 0,
            finished: false,
            finishTime: null,
            connected: true,
          },
        },
        winner: null,
      };

      // Créer le salon dans Firebase avec timeout
      const roomRef = this.dbRefs.ref(this.db, `rooms/${roomCode}`);
      
      await Promise.race([
        this.dbRefs.set(roomRef, roomData),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        )
      ]);

      this.currentRoom = roomCode;
      this.setupRoomListeners(roomCode);
      this.setupPresence(roomCode, playerName);

      if (monitor) monitor.hideLoading();
      return { success: true, roomCode: roomCode };
    } catch (error) {
      console.error("Error creating room:", error);
      if (monitor) {
        monitor.hideLoading();
        const errorMsg = monitor.getErrorMessage(error);
        monitor.showDisconnected(errorMsg);
      }
      
      // Retry logic
      if (error.message === 'Timeout' && monitor && monitor.retryAttempts < monitor.maxRetries) {
        try {
          return await monitor.retryConnection(
            () => this.createRoom(playerName, difficulty),
            'Création du salon'
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

  // Rejoint un salon existant
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
    if (monitor) monitor.showLoading("Connexion au salon...");

    try {
      this.playerName = playerName;
      this.isHost = false;

      // Vérifier si le salon existe avec timeout
      const roomRef = this.dbRefs.ref(this.db, `rooms/${roomCode}`);

      const snapshot = await Promise.race([
        this.dbRefs.get(roomRef),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        )
      ]);

      if (!snapshot.exists()) {
        if (monitor) monitor.hideLoading();
        return { success: false, error: "Salon introuvable. Vérifiez le code." };
      }

      const roomData = snapshot.val();

      if (roomData.guest) {
        if (monitor) monitor.hideLoading();
        return { success: false, error: "Salon complet (2/2 joueurs)." };
      }

      if (roomData.status !== "waiting") {
        if (monitor) monitor.hideLoading();
        return { success: false, error: "La partie a déjà commencé." };
      }

      if (roomData.mode !== "battle") {
        if (monitor) monitor.hideLoading();
        return { success: false, error: "Ce salon n'est pas en mode Battle." };
      }

      // Ajouter le joueur au salon avec timeout
      await Promise.race([
        this.dbRefs.update(roomRef, {
          guest: playerName,
          status: "starting",
          [`players/${playerName}`]: {
            name: playerName,
            progress: 0,
            finished: false,
            finishTime: null,
            connected: true,
          },
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        )
      ]);

      this.currentRoom = roomCode;
      this.setupRoomListeners(roomCode);
      this.setupPresence(roomCode, playerName);

      // Charger la grille du salon
      this.game.difficulty = roomData.difficulty;
      this.game.initialBoard = roomData.board;
      this.game.solution = roomData.solution;
      this.game.board = [...roomData.board];

      if (monitor) monitor.hideLoading();
      return { success: true, roomCode: roomCode };
    } catch (error) {
      console.error("[BattleManager] Error joining room:", error);
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
            'Connexion au salon'
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

  // Configure les listeners pour les changements du salon
  setupRoomListeners(roomCode) {
    const roomRef = this.dbRefs.ref(this.db, `rooms/${roomCode}`);
    const monitor = window.firebaseMonitor;

    const unsubscribe = this.dbRefs.onValue(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        this.handleRoomClosed();
        return;
      }

      const roomData = snapshot.val();
      this.handleRoomUpdate(roomData);
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

  // Gère les mises à jour du salon
  handleRoomUpdate(roomData) {
    // Si le statut change en "starting", lancer le compte à rebours
    if (roomData.status === "starting" && !this.countdownStarted) {
      this.countdownStarted = true;
      this.startCountdown(roomData);
    }

    // Mettre à jour la progression de l'adversaire
    if (roomData.status === "playing") {
      const opponentName = this.isHost ? roomData.guest : roomData.host;
      const opponentData = roomData.players[opponentName];

      if (opponentData) {
        this.updateOpponentProgress(opponentData);
      }
    }

    // Vérifier s'il y a un gagnant
    if (roomData.winner) {
      this.handleGameEnd(roomData.winner);
    }
  }

  // Lance le compte à rebours 3-2-1-GO!
  startCountdown(roomData) {
    // Fermer tous les modals Battle
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

    // Ensure Co-op HUD is hidden in battle mode
    if (this.game.dom.coopHud) {
      this.game.dom.coopHud.classList.add("hidden");
    }

    const countdownEl = document.getElementById("countdown");
    const battleHud = document.getElementById("battle-hud");

    // Afficher le HUD et le countdown
    if (battleHud) battleHud.classList.remove("hidden");
    if (countdownEl) {
      countdownEl.classList.remove("hidden");
      countdownEl.classList.remove("go"); // Reset any previous class
    }

    let count = 3;
    if (countdownEl) countdownEl.textContent = count;

    const countdownInterval = setInterval(() => {
      count--;
      if (countdownEl) {
        if (count > 0) {
          countdownEl.textContent = count;
        } else if (count === 0) {
          countdownEl.textContent = "GO!";
          countdownEl.classList.add("go");
        } else {
          countdownEl.classList.add("hidden");
          clearInterval(countdownInterval);
          this.startGame(roomData);
        }
      }
    }, 1000);
  }

  // Démarre la partie
  async startGame(roomData) {
    // Mettre à jour le statut en "playing"
    if (this.isHost) {
      const roomRef = this.dbRefs.ref(this.db, `rooms/${this.currentRoom}`);
      await this.dbRefs.update(roomRef, {
        status: "playing",
        startTime: Date.now(),
      });
    }

    // Charger la grille
    this.game.board = [...roomData.board];
    this.game.initialBoard = roomData.board;
    this.game.solution = roomData.solution;
    this.game.notes = new Array(81).fill(null).map(() => new Set());
    this.game.renderBoard();
    
    // Set flags properly
    this.game.isPlaying = true;
    this.game.battleMode = true;
    this.game.coopMode = false;
    this.game.currentMode = "battle";
    
    // Reset and start timer
    this.game.resetGameStats();
    this.game.startTimer();

    // Afficher le nom de l'adversaire
    const opponentName = this.isHost ? roomData.guest : roomData.host;
    const opponentNameEl = document.querySelector(".opponent-name");
    if (opponentNameEl) {
      opponentNameEl.textContent = `👤 ${opponentName}`;
    }
  }

  // Synchronise la progression du joueur
  async syncProgress() {
    if (!this.currentRoom || !this.playerName) return;

    const filledCells = this.game.board.filter((cell) => cell !== 0).length;
    const progress = Math.round((filledCells / 81) * 100);

    const playerRef = this.dbRefs.ref(
      this.db,
      `rooms/${this.currentRoom}/players/${this.playerName}`
    );
    await this.dbRefs.update(playerRef, {
      progress: progress,
    });
  }

  // Met à jour l'affichage de la progression adverse
  updateOpponentProgress(opponentData) {
    const progressFill = document.getElementById("opponent-progress");
    const progressText = document.getElementById("opponent-progress-text");

    if (progressFill) {
      progressFill.style.width = `${opponentData.progress}%`;
    }
    if (progressText) {
      progressText.textContent = `${opponentData.progress}%`;
    }
  }

  // Gère la fin de partie
  async handleWin() {
    if (!this.currentRoom || !this.playerName) return;

    const roomRef = this.dbRefs.ref(this.db, `rooms/${this.currentRoom}`);
    const playerRef = this.dbRefs.ref(
      this.db,
      `rooms/${this.currentRoom}/players/${this.playerName}`
    );

    // Marquer comme terminé
    await this.dbRefs.update(playerRef, {
      finished: true,
      finishTime: Date.now(),
    });

    // Vérifier si c'est le premier à terminer
    const snapshot = await this.dbRefs.get(roomRef);

    const roomData = snapshot.val();

    if (!roomData.winner) {
      // Premier joueur à terminer = gagnant!
      await this.dbRefs.update(roomRef, {
        winner: this.playerName,
        status: "finished",
      });
    }
  }

  // Affiche l'écran de fin
  handleGameEnd(winner) {
    this.game.isPlaying = false;
    
    // Clear timer interval properly
    if (this.game.timerInterval) {
      clearInterval(this.game.timerInterval);
      this.game.timerInterval = null;
    }

    const isWinner = winner === this.playerName;
    const title = isWinner ? "🏆 VICTOIRE !" : "😔 Défaite";
    const message = isWinner
      ? `Félicitations ! Vous avez terminé en premier en ${this.game.dom.timer.textContent} !`
      : `${winner} a gagné cette fois !`;

    this.game.showModal(title, message);

    if (isWinner) {
      this.game.soundManager.playWin();
    }

    // Hide Battle HUD after game end
    const battleHud = document.getElementById("battle-hud");
    if (battleHud) battleHud.classList.add("hidden");

    // Clean up battle mode state
    this.game.battleMode = false;
    this.game.currentMode = null;
  }

  // Gère la fermeture du salon
  handleRoomClosed() {
    this.cleanup();
    this.game.showModal(
      "Salon fermé", 
      "Le salon a été fermé par l'hôte ou en raison d'une déconnexion."
    );
  }

  // Configure la présence (détection de déconnexion)
  setupPresence(roomCode, playerName) {
    const playerRef = this.dbRefs.ref(
      this.db,
      `rooms/${roomCode}/players/${playerName}`
    );
    const presenceRef = this.dbRefs.onDisconnect(playerRef);

    presenceRef.set({
      name: playerName,
      progress: 0,
      finished: false,
      finishTime: null,
      connected: false,
    });
  }

  // Quitte le salon
  async leaveRoom() {
    if (!this.currentRoom) return;

    // Stop the game
    this.game.isPlaying = false;
    
    // Clear timer interval
    if (this.game.timerInterval) {
      clearInterval(this.game.timerInterval);
      this.game.timerInterval = null;
    }

    // Nettoyer les listeners
    this.cleanup();

    try {
      // Si c'est l'hôte, supprimer le salon
      if (this.isHost) {
        const roomRef = this.dbRefs.ref(this.db, `rooms/${this.currentRoom}`);
        await this.dbRefs.remove(roomRef);
      } else {
        // Si c'est l'invité, se retirer du salon
        const roomRef = this.dbRefs.ref(this.db, `rooms/${this.currentRoom}`);
        await this.dbRefs.update(roomRef, {
          guest: null,
          status: "waiting",
          [`players/${this.playerName}`]: null,
        });
      }
    } catch (error) {
      console.error("Error leaving room:", error);
      // Continue with cleanup even if Firebase update fails
    }

    this.currentRoom = null;
    this.playerName = null;
    this.isHost = false;
    this.game.battleMode = false;
    this.game.currentMode = null;

    // Cacher le HUD battle
    const battleHud = document.getElementById("battle-hud");
    if (battleHud) battleHud.classList.add("hidden");

    // Clean up DOM classes
    if (this.game.dom.board) {
      this.game.dom.board.classList.remove("coop-mode");
    }
    document.body.classList.remove("game-paused");
  }

  // Nettoie les listeners
  cleanup() {
    this.roomListeners.forEach((unsubscribe) => {
      if (typeof unsubscribe === "function") unsubscribe();
    });
    this.roomListeners = [];
    this.countdownStarted = false;
  }
}
