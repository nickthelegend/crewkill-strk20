import React from 'react';
import ReactDOM from 'react-dom/client';
import { StarknetProvider } from './providers/StarknetProvider';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StarknetProvider>
      <App />
    </StarknetProvider>
  </React.StrictMode>,
);
