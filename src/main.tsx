import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// In AI Studio preview environment, HMR WebSocket is not used; ignore Vite HMR WebSocket disconnects
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.message && (event.message.includes('WebSocket') || event.message.includes('vite'))) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message && (event.reason.message.includes('WebSocket') || event.reason.message.includes('vite'))) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
