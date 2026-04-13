import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);

// Service Worker registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    setInterval(() => reg.update(), 1800000); // check for updates every 30 min
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (newWorker) newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          if (window.__notifySWUpdate) window.__notifySWUpdate();
        }
      });
    });
  }).catch(() => {});
}
