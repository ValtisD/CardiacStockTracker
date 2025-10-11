import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { offlineStorage } from "./lib/offlineStorage";

// Register service worker for PWA and offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service Worker registered:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

// Initialize offline storage
offlineStorage.init().catch(error => {
  console.error('Failed to initialize offline storage:', error);
});

createRoot(document.getElementById("root")!).render(<App />);
