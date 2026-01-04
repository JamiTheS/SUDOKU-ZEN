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
    if (!this.db)
      return {
        success: false,
        error: "Service multijoueur indisponible (Firebase non chargé)",
      };
    try {
      const roomCode = this.generateRoomCode();
      this.playerName = playerName;
      this.isHost = true;

      // Générer une nouvelle grille
      this.game.difficulty = difficulty;
      this.game.generateBoard();
      this.game.prepareBoardForDifficulty();

      const roomData = {
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

      // Créer le salon dans Firebase
      const roomRef = this.dbRefs.ref(this.db, `rooms/${roomCode}`);
      await this.dbRefs.set(roomRef, roomData);

      this.currentRoom = roomCode;
      this.setupRoomListeners(roomCode);
      this.setupPresence(roomCode, playerName);

      return { success: true, roomCode: roomCode };
    } catch (error) {
      console.error("Error creating room:", error);
      return { success: false, error: error.message };
    }
  }

  // Rejoint un salon existant
  async joinRoom(roomCode, playerName) {
    if (!this.db)
      return {
        success: false,
        error: "Service multijoueur indisponible (Firebase non chargé)",
      };
    try {
      this.playerName = playerName;
      this.isHost = false;

      // Vérifier si le salon existe
      const roomRef = this.dbRefs.ref(this.db, `rooms/${roomCode}`);

      const snapshot = await new Promise((resolve, reject) => {
        this.dbRefs.onValue(
          roomRef,
          (snap) => {
            resolve(snap);
          },
          { onlyOnce: true },
          (error) => {
            reject(error);
          }
        );
      });

      if (!snapshot.exists()) {
        return { success: false, error: "Salon introuvable" };
      }

      const roomData = snapshot.val();

      if (roomData.guest) {
        return { success: false, error: "Salon complet" };
      }

      if (roomData.status !== "waiting") {
        return { success: false, error: "Partie déjà commencée" };
      }

      // Ajouter le joueur au salon
      await this.dbRefs.update(roomRef, {
        guest: playerName,
        status: "starting",
        [`players/${playerName}`]: {
          name: playerName,
          progress: 0,
          finished: false,
          finishTime: null,
          connected: true,
        },
      });

      this.currentRoom = roomCode;
      this.setupRoomListeners(roomCode);
      this.setupPresence(roomCode, playerName);

      // Charger la grille du salon
      this.game.difficulty = roomData.difficulty;
      this.game.initialBoard = roomData.board;
      this.game.solution = roomData.solution;
      this.game.board = [...roomData.board];

      return { success: true, roomCode: roomCode };
    } catch (error) {
      console.error("[BattleManager] Error joining room:", error);
      return { success: false, error: error.message };
    }
  }

  // Configure les listeners pour les changements du salon
  setupRoomListeners(roomCode) {
    const roomRef = this.dbRefs.ref(this.db, `rooms/${roomCode}`);

    const unsubscribe = this.dbRefs.onValue(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        this.handleRoomClosed();
        return;
      }

      const roomData = snapshot.val();
      this.handleRoomUpdate(roomData);
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
    this.game.isPlaying = true;
    this.game.battleMode = true;
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
    const snapshot = await new Promise((resolve) => {
      this.dbRefs.onValue(
        roomRef,
        (snap) => {
          resolve(snap);
        },
        { onlyOnce: true }
      );
    });

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
    clearInterval(this.game.timerInterval);

    const isWinner = winner === this.playerName;
    const title = isWinner ? "🏆 VICTOIRE !" : "😔 Défaite";
    const message = isWinner
      ? `Félicitations ! Vous avez terminé en premier en ${this.game.dom.timer.textContent} !`
      : `${winner} a gagné cette fois !`;

    this.game.showModal(title, message);

    if (isWinner) {
      this.game.soundManager.playWin();
    }
  }

  // Gère la fermeture du salon
  handleRoomClosed() {
    this.cleanup();
    this.game.showModal("Salon fermé", "Le salon a été fermé.");
  }

  // Configure la présence (détection de déconnexion)
  setupPresence(roomCode, playerName) {
    const playerRef = this.dbRefs.ref(
      this.db,
      `rooms/${roomCode}/players/${playerName}`
    );
    const presenceRef = this.dbRefs.onDisconnect(playerRef);

    presenceRef.update({
      connected: false,
    });
  }

  // Quitte le salon
  async leaveRoom() {
    if (!this.currentRoom) return;

    // Nettoyer les listeners
    this.cleanup();

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

    this.currentRoom = null;
    this.playerName = null;
    this.isHost = false;
    this.game.battleMode = false;

    // Cacher le HUD battle
    const battleHud = document.getElementById("battle-hud");
    if (battleHud) battleHud.classList.add("hidden");
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
