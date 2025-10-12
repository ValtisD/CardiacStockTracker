// Global offline state that's more reliable than navigator.onLine
// DevTools offline mode doesn't always update navigator.onLine correctly

let isOffline = !navigator.onLine;
let forceOffline = false; // Manual override flag
const listeners: Array<(offline: boolean) => void> = [];

console.log('🔧 offlineState initialized, isOffline:', isOffline);

export const offlineState = {
  isOffline(): boolean {
    return isOffline || forceOffline;
  },

  setOffline(offline: boolean, force = false): void {
    if (force) {
      console.log('🔒 Force offline mode:', offline);
      forceOffline = offline;
    }
    
    const newState = offline || forceOffline;
    if (isOffline !== newState) {
      isOffline = newState;
      console.log(newState ? '📴 App is now OFFLINE (listeners: ' + listeners.length + ')' : '🌐 App is now ONLINE (listeners: ' + listeners.length + ')');
      listeners.forEach((listener, index) => {
        console.log('🔔 Calling listener #' + index);
        listener(newState);
      });
    }
  },

  subscribe(listener: (offline: boolean) => void): () => void {
    listeners.push(listener);
    console.log('➕ Listener subscribed, total:', listeners.length);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
        console.log('➖ Listener unsubscribed, total:', listeners.length);
      }
    };
  },
};

// Sync with navigator.onLine (but don't override force mode)
window.addEventListener('online', () => {
  console.log('🌐 window.online event fired');
  if (!forceOffline) {
    offlineState.setOffline(false);
  }
});
window.addEventListener('offline', () => {
  console.log('📴 window.offline event fired');
  offlineState.setOffline(true);
});

// Poll navigator.onLine to catch changes that don't fire events (but don't override force mode)
setInterval(() => {
  if (!forceOffline) {
    const currentOnline = navigator.onLine;
    if (currentOnline !== !isOffline) {
      console.log('📡 Poll detected change: navigator.onLine =', currentOnline, ', isOffline =', isOffline);
      offlineState.setOffline(!currentOnline);
    }
  }
}, 1000);
