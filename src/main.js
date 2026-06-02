import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/chat.css';
import './styles/auth.css';
import './styles/admin.css';
import './styles/fixes.css';

import { initApp } from './ui/app.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
