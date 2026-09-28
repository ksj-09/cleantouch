import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ScanApp from './ScanApp';
import './scan-app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScanApp />
  </StrictMode>,
);
