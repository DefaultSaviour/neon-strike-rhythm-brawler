import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// No browser right-click menu over the game (a common fix CrazyGames recommends).
document.addEventListener('contextmenu', (event) => event.preventDefault());

createRoot(document.getElementById('root')!).render(<App />);
