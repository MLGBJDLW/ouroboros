import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './context/AppContext';
import { VSCodeProvider } from './context/VSCodeContext';
import './styles/reset.css';
import './styles/variables.css';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <VSCodeProvider>
            <AppProvider>
                <App />
            </AppProvider>
        </VSCodeProvider>
    </React.StrictMode>
);
