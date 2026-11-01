// Entry for the single-file build (used to share the app as one HTML page).
import { createRoot } from 'react-dom/client';
import App from '../src/app/App';

// Hosts that block file downloads: the app hides its Download button and relies on copy/paste backups.
(window as unknown as { __SALES_STANDALONE__: boolean }).__SALES_STANDALONE__ = true;

createRoot(document.getElementById('root')!).render(<App />);
