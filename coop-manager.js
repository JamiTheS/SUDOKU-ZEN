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
        this.cellOwners = {};
    }

    cleanup() {
        this.roomListeners.forEach(unsubscribe => unsubscribe());
        this.roomListeners = [];
        this.currentRoom = null;
        this.isHost = false;
        this.game.coopMode = false;
        if (this.game.dom.board) {
            this.game.dom.board.classList.remove('coop-mode');
        }
        if (this.game.dom.coopHud) {
            this.game.dom.coopHud.classList.add('hidden');
        }
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    async createRoom(playerName, difficulty, gameMode = 'lives') {
        try {
            const roomCode = this.generateRoomCode();
            this.playerName = playerName;
            this.isHost = true;
            this.playerColor = 'blue';

            // Générer une nouvelle grille
            this.game.difficulty = difficulty;
            this.game.generateBoard();
            this.game.prepareBoardForDifficulty();

            const roomData = {
                mode: 'coop',
                roomCode: roomCode,
                host: playerName,
                guest: null,
                difficulty: difficulty,
                livesEnabled: gameMode === 'lives',
                status: 'waiting',
                createdAt: Date.now(),
                board: this.game.initialBoard, // Initial fixed numbers
                currentBoard: [...this.game.board], // Live board state
                solution: this.game.solution,
                mistakes: 0,
                cellOwners: {}, // { index: 'p1' | 'p2' }
                players: {
                    p1: { name: playerName, color: 'blue', connected: true },
                    p2: null
                }
            };

            const roomRef = this.dbRefs.ref(this.db, `rooms/${roomCode}`);
            await this.dbRefs.set(roomRef, roomData);

            this.currentRoom = roomCode;
            this.setupRoomListeners(roomCode);
            this.setupPresence(roomCode, 'p1');

            return { success: true, roomCode: roomCode };
        } catch (error) {
            console.error('Error creating coop room:', error);
            return { success: false, error: error.message };
        }
    }

    async joinRoom(roomCode, playerName) {
        try {
            this.playerName = playerName;
            this.isHost = false;
            this.playerColor = 'orange';

            const roomRef = this.dbRefs.ref(this.db, `rooms/${roomCode}`);
            const snapshot = await new Promise((resolve) => {
                this.dbRefs.onValue(roomRef, (snap) => resolve(snap), { onlyOnce: true });
            });

            if (!snapshot.exists()) return { success: false, error: 'Salon introuvable' };
            const roomData = snapshot.val();

            if (roomData.mode !== 'coop') return { success: false, error: 'Ce n\'est pas un salon Fusion' };
            if (roomData.guest) return { success: false, error: 'Salon complet' };

            await this.dbRefs.update(roomRef, {
                guest: playerName,
                status: 'starting',
                'players/p2': { name: playerName, color: 'orange', connected: true }
            });

            this.currentRoom = roomCode;

            // Load initial state
            this.game.difficulty = roomData.difficulty;
            this.game.initialBoard = roomData.board;
            this.game.solution = roomData.solution;
            this.game.board = [...roomData.currentBoard];
            this.game.renderBoard();

            this.setupRoomListeners(roomCode);
            this.setupPresence(roomCode, 'p2');

            return { success: true, roomCode: roomCode };
        } catch (error) {
            console.error('Error joining coop room:', error);
            return { success: false, error: error.message };
        }
    }

    setupRoomListeners(roomCode) {
        const roomRef = this.dbRefs.ref(this.db, `rooms/${roomCode}`);

        const unsubscribe = this.dbRefs.onValue(roomRef, (snapshot) => {
            if (!snapshot.exists()) {
                this.cleanup();
                this.game.showModal('Salon fermé', 'Le salon a été fermé.');
                return;
            }
            const data = snapshot.val();
            this.handleRoomUpdate(data);
        });
        this.roomListeners.push(unsubscribe);
    }

    handleRoomUpdate(data) {
        // Start game when status changes to 'starting'
        if (data.status === 'starting' && !this.gameStarted) {
            this.gameStarted = true;
            this.startGame(data);
        }

        // Sync Board
        if (data.currentBoard) {
            // Only update cells that changed to avoid overwriting local optimistic updates too aggressively
            // But for simplicity in V1, we sync full board. 
            // To prevent cursor jump or input conflict, we could check diffs.
            this.game.board = data.currentBoard;

            // Update UI with owners
            this.updateBoardUI(data.currentBoard, data.cellOwners);
        }

        // Sync Mistakes (Lives)
        if (data.mistakes !== undefined) {
            this.mistakes = data.mistakes;
            this.updateLivesUI();
            if (this.mistakes >= this.maxMistakes) {
                this.handleGameOver();
            }
        }

        // Sync Partner Status
        if (data.players) {
            const partnerKey = this.isHost ? 'p2' : 'p1';
            const partner = data.players[partnerKey];
            this.updatePartnerUI(partner);
        }

        // Check Win
        if (data.status === 'won') {
            this.game.showModal('VICTOIRE !', 'Bravo ! La fusion est complète ! 🏆');
            this.game.soundManager.playWin();
            this.game.isPlaying = false;
        }
    }

    // Start the Co-op game for both players
    async startGame(roomData) {
        // Close all modals
        const modalsToHide = [
            'battle-choice-modal',
            'create-room-modal',
            'join-room-modal',
            'waiting-room-modal'
        ];
        modalsToHide.forEach(id => {
            const modal = document.getElementById(id);
            if (modal) modal.classList.add('hidden');
        });

        // Show Co-op HUD
        if (this.game.dom.coopHud) {
            this.game.dom.coopHud.classList.remove('hidden');
        }

        // Update status to 'playing' (only host does this)
        if (this.isHost) {
            const roomRef = this.dbRefs.ref(this.db, `rooms/${this.currentRoom}`);
            await this.dbRefs.update(roomRef, {
                status: 'playing',
                startTime: Date.now()
            });
        }

        // Initialize game state
        this.game.board = [...roomData.currentBoard];
        this.game.initialBoard = roomData.board;
        this.game.solution = roomData.solution;
        this.game.notes = new Array(81).fill(null).map(() => new Set());
        this.game.renderBoard();
        this.game.isPlaying = true;
        this.game.coopMode = true;
        this.game.dom.board.classList.add('coop-mode'); // Add class for CSS overrides
        this.game.resetGameStats();
        this.game.startTimer();

        // Store mode preference
        this.livesEnabled = roomData.livesEnabled !== false; // Default true for backward compat

        // Update HUD visibility
        const livesContainer = document.querySelector('.lives-container');
        if (livesContainer) {
            livesContainer.style.display = this.livesEnabled ? 'flex' : 'none';
        }

        // Initialize lives UI
        this.updateLivesUI();

        // Update partner UI
        const partnerKey = this.isHost ? 'p2' : 'p1';
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
            const val = board[i];
            const owner = cellOwners ? cellOwners[i] : null;

            // Update content if changed
            // Note: We need to be careful not to break existing render logic
            // We'll assume game.renderCell handles basic rendering, we just add classes

            if (cell.textContent != val && val !== 0) {
                cell.textContent = val;
                cell.classList.remove('notes-grid'); // Clear notes if number placed
            } else if (val === 0 && !cell.querySelector('.notes-grid')) {
                cell.textContent = '';
            }

            // Apply Owner Styles
            cell.classList.remove('cell-p1', 'cell-p2');
            if (owner === 'p1') cell.classList.add('cell-p1');
            if (owner === 'p2') cell.classList.add('cell-p2');
        }
    }

    updateLivesUI() {
        const livesEl = document.getElementById('coop-lives');
        if (livesEl) {
            const livesLeft = Math.max(0, this.maxMistakes - this.mistakes);
            livesEl.textContent = '❤️'.repeat(livesLeft) + '🖤'.repeat(this.maxMistakes - livesLeft);
        }
    }

    updatePartnerUI(partner) {
        const partnerEl = document.getElementById('coop-partner');
        if (partnerEl && partner) {
            partnerEl.innerHTML = `
                <span class="partner-dot ${partner.connected ? 'online' : 'offline'}"></span>
                ${partner.name}
            `;
        } else if (partnerEl) {
            partnerEl.innerHTML = 'En attente...';
        }
    }

    async makeMove(index, value) {
        if (!this.currentRoom) return;

        const playerKey = this.isHost ? 'p1' : 'p2';
        const roomRef = this.dbRefs.ref(this.db, `rooms/${this.currentRoom}`);

        // In Lives mode: Check correctness and decrement lives on mistakes
        // In Timer mode: Allow any number (like real Sudoku)
        if (this.livesEnabled && value !== 0 && value !== this.game.solution[index]) {
            // Mistake in Lives mode!
            await this.dbRefs.update(roomRef, {
                mistakes: this.mistakes + 1
            });
            return false;
        }

        // Valid move (or Timer mode - accept any number)
        const updates = {};
        updates[`currentBoard/${index}`] = value;
        if (value !== 0) {
            updates[`cellOwners/${index}`] = playerKey;
        } else {
            // Erase
            updates[`cellOwners/${index}`] = null;
        }

        await this.dbRefs.update(roomRef, updates);

        // Check Win Condition
        // We need to check if board is full and correct
        // Since we validate on move, full board = win
        // But we need to check if ALL cells are filled
        // We can do a quick check locally
        const isFull = this.game.board.every(cell => cell !== 0); // currentBoard is updated optimistically or via listener
        // Actually, better to check in listener or separate check, but for now:
        if (value !== 0) {
            // Fetch latest board to be sure? Or rely on local
            // Let's assume local is up to date enough for this check
            // Or just check if 81 cells filled
        }

        // If full, update status to won
        // We'll do this in a separate check or after update
        return true;
    }

    checkWinCondition(board) {
        if (board.every(cell => cell !== 0)) {
            this.dbRefs.update(this.dbRefs.ref(this.db, `rooms/${this.currentRoom}`), {
                status: 'won'
            });
        }
    }

    handleGameOver() {
        this.game.showModal('GAME OVER', 'Vous avez épuisé vos vies communes ! 💀');
        this.game.isPlaying = false;
    }

    showErrorFeedback(index) {
        // Flash the cell red temporarily
        const cell = this.game.dom.board.children[index];
        if (cell) {
            cell.style.background = 'rgba(255, 0, 85, 0.5)';
            setTimeout(() => {
                cell.style.background = '';
            }, 500);
        }
    }

    setupPresence(roomCode, playerKey) {
        const conRef = this.dbRefs.ref(this.db, `rooms/${roomCode}/players/${playerKey}/connected`);
        this.dbRefs.onDisconnect(conRef).set(false);
        this.dbRefs.set(conRef, true);
    }

    cleanup() {
        this.roomListeners.forEach(u => u());
        this.roomListeners = [];
    }
}

window.CoopManager = CoopManager;
