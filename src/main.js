import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/chat.css';
import './styles/auth.css';
import './styles/admin.css';

import { initApp } from './ui/app.js';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});
