import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { offlineStorage } from "./lib/offlineStorage";
import { syncManager } from "./lib/syncManager";

// Register service worker for PWA and offline support
// Note: Service Worker may fail in development (requires HTTPS)
// but IndexedDB offline functionality works independently
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(registration => {
        console.log('✅ Service Worker registered successfully!', {
          scope: registration.scope,
          active: registration.active?.state,
          installing: registration.installing?.state
        });
      })
      .catch(error => {
        // Service Worker fails in non-HTTPS environments (development)
        // This is expected - IndexedDB offline mode still works!
        console.warn('⚠️ Service Worker not available (requires HTTPS):', error.name);
        console.log('✅ Offline data persistence via IndexedDB is still active!');
      });
  });
}

// Initialize offline storage
offlineStorage.init().catch(error => {
  console.error('Failed to initialize offline storage:', error);
});

createRoot(document.getElementById("root")!).render(<App />);
