class SudokuGame {
    constructor() {
        this.board = [];
        this.solution = [];
        this.initialBoard = [];
        this.selectedCell = null;
        this.mistakes = 0;
        this.timer = 0;
        this.timerInterval = null;
        this.difficulty = 'easy';
        this.isPlaying = false;

        this.dom = {
            board: document.getElementById('sudoku-board'),
            mistakes: document.getElementById('mistake-count'),
            timer: document.querySelector('.timer'),
            newGameBtn: document.getElementById('new-game-btn'),
            diffBtns: document.querySelectorAll('.diff-btn'),
            numBtns: document.querySelectorAll('.num-btn'),
            eraseBtn: document.getElementById('erase-btn'),
            modal: document.getElementById('modal'),
            modalTitle: document.getElementById('modal-title'),
            modalMessage: document.getElementById('modal-message'),
            modalCloseBtn: document.getElementById('modal-close-btn')
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.startNewGame();
    }

    setupEventListeners() {
        this.dom.newGameBtn.addEventListener('click', () => this.startNewGame());

        this.dom.diffBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.dom.diffBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.difficulty = e.target.dataset.diff;
                this.startNewGame();
            });
        });

        this.dom.numBtns.forEach(btn => {
            btn.addEventListener('click', () => this.handleInput(parseInt(btn.dataset.num)));
        });

        this.dom.eraseBtn.addEventListener('click', () => this.handleInput(0));

        document.addEventListener('keydown', (e) => {
            if (!this.isPlaying) return;

            if (e.key >= '1' && e.key <= '9') {
                this.handleInput(parseInt(e.key));
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                this.handleInput(0);
            } else {
                this.handleArrowNavigation(e.key);
            }
        });

        this.dom.modalCloseBtn.addEventListener('click', () => {
            this.dom.modal.classList.add('hidden');
        });
    }

    handleArrowNavigation(key) {
        if (!this.selectedCell) return;

        const index = parseInt(this.selectedCell.dataset.index);
        let newIndex = index;

        switch (key) {
            case 'ArrowUp': newIndex -= 9; break;
            case 'ArrowDown': newIndex += 9; break;
            case 'ArrowLeft': newIndex -= 1; break;
            case 'ArrowRight': newIndex += 1; break;
        }

        if (newIndex >= 0 && newIndex < 81) {
            const newCell = this.dom.board.children[newIndex];
            this.selectCell(newCell);
        }
    }

    startNewGame() {
        this.generateBoard();
        this.prepareBoardForDifficulty();
        this.renderBoard();
        this.resetGameStats();
        this.startTimer();
        this.isPlaying = true;
    }

    resetGameStats() {
        this.mistakes = 0;
        this.updateMistakes();
        this.timer = 0;
        clearInterval(this.timerInterval);
        this.dom.timer.textContent = "00:00";
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.timer++;
            const minutes = Math.floor(this.timer / 60).toString().padStart(2, '0');
            const seconds = (this.timer % 60).toString().padStart(2, '0');
            this.dom.timer.textContent = `${minutes}:${seconds}`;
        }, 1000);
    }

    generateBoard() {
        // Initialize empty 9x9 board
        this.solution = Array(81).fill(0);

        // Fill diagonal 3x3 boxes first (independent of each other)
        for (let i = 0; i < 9; i += 3) {
            this.fillBox(i, i);
        }

        // Solve the rest to create a valid complete board
        this.solveSudoku(this.solution);
        this.board = [...this.solution]; // Copy full solution
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

        // Check row
        for (let x = 0; x < 9; x++) {
            if (board[row * 9 + x] === num) return false;
        }

        // Check col
        for (let x = 0; x < 9; x++) {
            if (board[x * 9 + col] === num) return false;
        }

        // Check 3x3 box
        let startRow = row - row % 3;
        let startCol = col - col % 3;
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
            case 'easy': removeCount = 30; break;
            case 'medium': removeCount = 40; break;
            case 'hard': removeCount = 50; break;
            case 'expert': removeCount = 60; break;
            default: removeCount = 30;
        }

        this.initialBoard = [...this.solution];

        while (removeCount > 0 && attempts > 0) {
            let cellId = Math.floor(Math.random() * 81);
            while (this.initialBoard[cellId] === 0) {
                cellId = Math.floor(Math.random() * 81);
            }

            let backup = this.initialBoard[cellId];
            this.initialBoard[cellId] = 0;

            // Copy board to check if unique solution still exists
            let boardCopy = [...this.initialBoard];

            // Simple check: if we can solve it, it's valid enough for this simple generator
            // A true unique solution checker is more complex, but for a game generator
            // ensuring it's solvable is usually the primary concern.
            // To keep it responsive, we just remove. 
            // If we wanted strict uniqueness, we'd need to run the solver and count solutions.

            removeCount--;
        }

        this.board = [...this.initialBoard];
    }

    renderBoard() {
        this.dom.board.innerHTML = '';
        this.board.forEach((num, index) => {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.index = index;

            if (num !== 0) {
                cell.textContent = num;
                cell.classList.add('initial');
            }

            cell.addEventListener('click', () => this.selectCell(cell));
            this.dom.board.appendChild(cell);
        });
    }

    selectCell(cell) {
        if (this.selectedCell) {
            this.selectedCell.classList.remove('selected');
            // Remove highlighting from other cells
            document.querySelectorAll('.cell').forEach(c => c.classList.remove('highlighted'));
        }

        this.selectedCell = cell;
        cell.classList.add('selected');

        // Highlight same numbers
        const val = cell.textContent;
        if (val) {
            document.querySelectorAll('.cell').forEach(c => {
                if (c.textContent === val) c.classList.add('highlighted');
            });
        }
    }

    handleInput(num) {
        if (!this.selectedCell || !this.isPlaying) return;

        // Cannot edit initial cells
        if (this.selectedCell.classList.contains('initial')) return;

        const index = parseInt(this.selectedCell.dataset.index);

        if (num === 0) {
            // Erase
            this.board[index] = 0;
            this.selectedCell.textContent = '';
            this.selectedCell.classList.remove('error');
            return;
        }

        // Update board without immediate validation
        this.board[index] = num;
        this.selectedCell.textContent = num;
        this.selectedCell.classList.remove('error'); // Remove error if it was there from a previous check

        // Re-highlight
        this.selectCell(this.selectedCell);

        // Check if board is full to trigger validation
        if (this.board.every(cell => cell !== 0)) {
            this.checkWin();
        }
    }

    updateMistakes() {
        // Removed mistakes counter
    }

    checkWin() {
        // Check if board is full and matches solution
        const isFull = this.board.every(cell => cell !== 0);
        if (isFull) {
            const isCorrect = this.board.every((cell, i) => cell === this.solution[i]);
            if (isCorrect) {
                this.gameWon();
            } else {
                // Highlight errors only when board is full
                this.highlightErrors();
                this.showModal('Oups !', 'Il y a des erreurs. Les cases incorrectes ont été marquées.');
            }
        }
    }

    highlightErrors() {
        const cells = this.dom.board.children;
        this.board.forEach((num, i) => {
            if (num !== 0 && num !== this.solution[i]) {
                cells[i].classList.add('error');
            }
        });
    }

    gameWon() {
        this.isPlaying = false;
        clearInterval(this.timerInterval);
        this.showModal('Victoire !', `Vous avez gagné en ${this.dom.timer.textContent} !`);
    }

    gameOver() {
        this.isPlaying = false;
        clearInterval(this.timerInterval);
        this.showModal('Game Over', 'Vous avez fait 3 erreurs. Essayez encore !');
    }

    showModal(title, message) {
        this.dom.modalTitle.textContent = title;
        this.dom.modalMessage.textContent = message;
        this.dom.modal.classList.remove('hidden');
    }
}

class MediaController {
    constructor() {
        this.container = document.getElementById('media-container');
        this.toggleBtn = document.getElementById('media-toggle-btn');
        this.closeBtn = document.getElementById('close-media-btn');
        this.loadBtn = document.getElementById('load-media-btn');
        this.input = document.getElementById('media-url');
        this.iframe = document.getElementById('media-frame');
        this.placeholder = document.querySelector('.placeholder-text');

        this.init();
    }

    init() {
        this.toggleBtn.addEventListener('click', () => this.toggleMedia());
        this.closeBtn.addEventListener('click', () => this.toggleMedia());
        this.loadBtn.addEventListener('click', () => this.loadMedia());

        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.loadMedia();
        });
    }

    toggleMedia() {
        this.container.classList.toggle('hidden');
        const resizer = document.getElementById('resizer');
        resizer.classList.toggle('hidden');

        if (this.container.classList.contains('hidden')) {
            this.toggleBtn.textContent = '📺 Mode Multitâche';
            // Reset flex basis when closing
            document.getElementById('game-container').style.flex = '1';
            this.container.style.flex = '1';
        } else {
            this.toggleBtn.textContent = 'Fermer Multitâche';
        }
    }

    loadMedia() {
        const url = this.input.value.trim();
        if (!url) return;

        let embedUrl = '';

        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            // Extract Video ID
            let videoId = '';
            if (url.includes('v=')) {
                videoId = url.split('v=')[1].split('&')[0];
            } else if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1];
            }
            // Use nocookie domain and add origin to try to fix Error 153
            // Error 153 usually means the video owner blocked embedding or the origin is invalid.
            // We add window.location.origin, but on file:// it might still be tricky for some videos.
            const origin = window.location.origin;
            embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&origin=${origin}`;
        } else if (url.includes('twitch.tv')) {
            // Extract Channel Name
            const channel = url.split('twitch.tv/')[1].split('/')[0];
            const parent = window.location.hostname === '' ? 'localhost' : window.location.hostname;
            // Note: Twitch embedding requires a parent domain. Localhost might be tricky without a server,
            // but for file:// it often blocks. We'll try the standard embed.
            // If running on file://, Twitch might not load due to their security policies.
            embedUrl = `https://player.twitch.tv/?channel=${channel}&parent=${parent}`;
        } else {
            alert('Lien non reconnu. Essayez YouTube ou Twitch.');
            return;
        }

        this.iframe.src = embedUrl;
        this.placeholder.style.display = 'none';
    }
}

class ResizeController {
    constructor() {
        this.resizer = document.getElementById('resizer');
        this.leftSide = document.getElementById('game-container');
        this.rightSide = document.getElementById('media-container');
        this.wrapper = document.querySelector('.app-wrapper');
        this.isResizing = false;

        this.init();
    }

    init() {
        this.resizer.addEventListener('mousedown', (e) => {
            this.isResizing = true;
            this.resizer.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            // Prevent iframe from stealing mouse events
            document.getElementById('media-frame').style.pointerEvents = 'none';
        });

        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', () => this.stopResize());
    }

    handleMouseMove(e) {
        if (!this.isResizing) return;

        const containerRect = this.wrapper.getBoundingClientRect();
        const pointerRelativeXpos = e.clientX - containerRect.left;

        // Calculate percentages
        // Min width 30% for each side
        const minWidth = containerRect.width * 0.3;

        if (pointerRelativeXpos > minWidth && pointerRelativeXpos < containerRect.width - minWidth) {
            const leftWidth = (pointerRelativeXpos / containerRect.width) * 100;
            const rightWidth = 100 - leftWidth;

            this.leftSide.style.flex = `0 0 ${leftWidth}%`;
            this.rightSide.style.flex = `0 0 ${rightWidth}%`;
        }
    }

    stopResize() {
        if (this.isResizing) {
            this.isResizing = false;
            this.resizer.classList.remove('resizing');
            document.body.style.cursor = '';
            document.getElementById('media-frame').style.pointerEvents = 'auto';
        }
    }
}

// Start the game
window.addEventListener('DOMContentLoaded', () => {
    new SudokuGame();
    new MediaController();
    new ResizeController();
});
