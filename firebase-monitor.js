// Firebase Connection Monitor
class FirebaseMonitor {
  constructor() {
    this.connected = false;
    this.connectionStatusEl = null;
    this.connectionIconEl = null;
    this.connectionTextEl = null;
    this.retryAttempts = 0;
    this.maxRetries = 3;
    this.retryDelay = 2000;
    
    this.init();
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    this.connectionStatusEl = document.getElementById('connection-status');
    this.connectionIconEl = document.getElementById('connection-icon');
    this.connectionTextEl = document.getElementById('connection-text');

    // Check if Firebase is initialized
    if (!window.firebaseInitialized) {
      this.showDisconnected(`Erreur d'initialisation: ${window.firebaseError || 'Inconnue'}`);
      return;
    }

    // Monitor connection status
    this.monitorConnection();
  }

  monitorConnection() {
    if (!window.firebaseDB || !window.firebaseRefs) {
      this.showDisconnected('Service indisponible');
      return;
    }

    const connectedRef = window.firebaseRefs.ref(window.firebaseDB, '.info/connected');
    
    window.firebaseRefs.onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === true) {
        this.showConnected();
        this.retryAttempts = 0;
      } else {
        this.showDisconnected('Connexion perdue');
      }
    }, (error) => {
      console.error('Connection monitor error:', error);
      this.showDisconnected('Erreur de monitoring');
    });
  }

  showConnected() {
    this.connected = true;
    if (this.connectionStatusEl) {
      this.connectionStatusEl.classList.remove('hidden');
      this.connectionStatusEl.classList.add('connected');
      this.connectionStatusEl.classList.remove('disconnected');
    }
    if (this.connectionIconEl) {
      this.connectionIconEl.textContent = '🟢';
    }
    if (this.connectionTextEl) {
      this.connectionTextEl.textContent = 'Connecté';
    }

    // Auto-hide after 3 seconds when connected
    setTimeout(() => {
      if (this.connected && this.connectionStatusEl) {
        this.connectionStatusEl.classList.add('hidden');
      }
    }, 3000);
  }

  showDisconnected(message = 'Déconnecté') {
    this.connected = false;
    if (this.connectionStatusEl) {
      this.connectionStatusEl.classList.remove('hidden');
      this.connectionStatusEl.classList.add('disconnected');
      this.connectionStatusEl.classList.remove('connected');
    }
    if (this.connectionIconEl) {
      this.connectionIconEl.textContent = '🔴';
    }
    if (this.connectionTextEl) {
      this.connectionTextEl.textContent = message;
    }
  }

  async retryConnection(operation, operationName = 'Opération') {
    this.retryAttempts++;
    
    if (this.retryAttempts > this.maxRetries) {
      throw new Error(`${operationName} échouée après ${this.maxRetries} tentatives`);
    }

    this.showLoading(`${operationName} - Tentative ${this.retryAttempts}/${this.maxRetries}`);
    
    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
    
    return operation();
  }

  showLoading(message = 'Chargement...') {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    
    if (loadingOverlay) {
      loadingOverlay.classList.remove('hidden');
    }
    if (loadingText) {
      loadingText.textContent = message;
    }
  }

  hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
  }

  isConnected() {
    return this.connected && window.firebaseDB && window.firebaseRefs;
  }

  getErrorMessage(error) {
    if (!error) return 'Erreur inconnue';
    
    const errorMessages = {
      'PERMISSION_DENIED': 'Accès refusé. Vérifiez vos permissions.',
      'NETWORK_ERROR': 'Erreur réseau. Vérifiez votre connexion internet.',
      'TIMEOUT': 'Délai d\'attente dépassé. Réessayez.',
      'DISCONNECTED': 'Connexion perdue. Vérifiez votre connexion internet.',
      'UNAVAILABLE': 'Service temporairement indisponible.',
    };

    // Check error code
    if (error.code) {
      return errorMessages[error.code] || `Erreur: ${error.code}`;
    }

    // Check error message
    if (error.message) {
      const msg = error.message.toLowerCase();
      if (msg.includes('permission')) return errorMessages.PERMISSION_DENIED;
      if (msg.includes('network')) return errorMessages.NETWORK_ERROR;
      if (msg.includes('timeout')) return errorMessages.TIMEOUT;
      if (msg.includes('disconnect')) return errorMessages.DISCONNECTED;
      if (msg.includes('unavailable')) return errorMessages.UNAVAILABLE;
    }

    return error.message || 'Erreur inconnue';
  }
}

// Initialize monitor when script loads
window.firebaseMonitor = new FirebaseMonitor();
