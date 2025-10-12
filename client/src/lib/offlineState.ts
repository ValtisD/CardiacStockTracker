// Global offline state that's more reliable than navigator.onLine
// DevTools offline mode doesn't always update navigator.onLine correctly

let isOffline = !navigator.onLine;
const listeners: Array<(offline: boolean) => void> = [];

console.log('🔧 offlineState initialized, isOffline:', isOffline);

export const offlineState = {
  isOffline(): boolean {
    return isOffline;
  },

  setOffline(offline: boolean): void {
    if (isOffline !== offline) {
      isOffline = offline;
      console.log(offline ? '📴 App is now OFFLINE (listeners: ' + listeners.length + ')' : '🌐 App is now ONLINE (listeners: ' + listeners.length + ')');
      listeners.forEach((listener, index) => {
        console.log('🔔 Calling listener #' + index);
        listener(offline);
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

// Sync with navigator.onLine
window.addEventListener('online', () => {
  console.log('🌐 window.online event fired');
  offlineState.setOffline(false);
});
window.addEventListener('offline', () => {
  console.log('📴 window.offline event fired');
  offlineState.setOffline(true);
});

// Poll navigator.onLine to catch changes that don't fire events
setInterval(() => {
  const currentOnline = navigator.onLine;
  if (currentOnline !== !isOffline) {
    console.log('📡 Poll detected change: navigator.onLine =', currentOnline, ', isOffline =', isOffline);
    offlineState.setOffline(!currentOnline);
  }
}, 1000);
