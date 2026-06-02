/**
 * ui/auth-screen.js — Login, Sign Up, and Pending Approval screens.
 */

import { signIn, signUp } from '../auth.js';

export function renderAuthScreen(container) {
  let currentTab = 'login';
  let isLoading = false;
  let errorMsg = '';
  let showPending = false;
  let pendingEmail = '';

  function render() {
    if (showPending) {
      container.innerHTML = `
        <div class="auth-screen">
          <div class="auth-bg"></div>
          <div class="auth-card glass">
            <div class="pending-pulse"></div>
            <div class="spark-logo">✦</div>
            <h1>Request Submitted</h1>
            <p class="auth-subtitle">Your account is pending admin approval</p>
            <p class="pending-email">${pendingEmail}</p>
            <p class="pending-hint">You'll be able to sign in once an admin approves your account.</p>
            <button class="btn btn-primary" id="auth-back-login">Back to Login</button>
          </div>
        </div>
      `;
      document.getElementById('auth-back-login')?.addEventListener('click', () => {
        showPending = false;
        currentTab = 'login';
        render();
      });
      return;
    }

    container.innerHTML = `
      <div class="auth-screen">
        <div class="auth-bg"></div>
        <div class="auth-card glass">
          <div class="spark-logo">✦</div>
          <h1>Content Factory</h1>
          <p class="auth-subtitle">Powered by Fady George</p>

          <div class="auth-tabs">
            <button class="auth-tab ${currentTab === 'login' ? 'active' : ''}" data-tab="login">Login</button>
            <button class="auth-tab ${currentTab === 'signup' ? 'active' : ''}" data-tab="signup">Sign Up</button>
          </div>

          ${errorMsg ? `<div class="auth-error">${errorMsg}</div>` : ''}

          ${currentTab === 'login' ? `
            <form id="auth-form" class="auth-form">
              <div class="form-field">
                <label for="auth-email">Email</label>
                <input type="email" id="auth-email" placeholder="your@email.com" required autocomplete="email">
              </div>
              <div class="form-field">
                <label for="auth-pass">Password</label>
                <input type="password" id="auth-pass" placeholder="••••••••" required autocomplete="current-password">
              </div>
              <button type="submit" class="btn btn-primary btn-block" ${isLoading ? 'disabled' : ''}>
                ${isLoading ? '<span class="spinner"></span> Signing in...' : 'Sign In'}
              </button>
            </form>
          ` : `
            <form id="auth-form" class="auth-form">
              <div class="form-field">
                <label for="auth-email">Email</label>
                <input type="email" id="auth-email" placeholder="your@email.com" required autocomplete="email">
              </div>
              <div class="form-field">
                <label for="auth-pass">Password</label>
                <input type="password" id="auth-pass" placeholder="••••••••" required autocomplete="new-password" minlength="6">
              </div>
              <div class="form-field">
                <label for="auth-pass2">Confirm Password</label>
                <input type="password" id="auth-pass2" placeholder="••••••••" required autocomplete="new-password" minlength="6">
              </div>
              <button type="submit" class="btn btn-primary btn-block" ${isLoading ? 'disabled' : ''}>
                ${isLoading ? '<span class="spinner"></span> Requesting...' : 'Request Access'}
              </button>
            </form>
          `}
        </div>
      </div>
    `;

    // Tab switching
    container.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        currentTab = tab.dataset.tab;
        errorMsg = '';
        render();
      });
    });

    // Form submission
    const form = document.getElementById('auth-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorMsg = '';

      const email = document.getElementById('auth-email')?.value?.trim();
      const password = document.getElementById('auth-pass')?.value;

      if (!email || !password) {
        errorMsg = 'Please fill in all fields';
        render();
        return;
      }

      if (currentTab === 'signup') {
        const pass2 = document.getElementById('auth-pass2')?.value;
        if (password !== pass2) {
          errorMsg = 'Passwords do not match';
          render();
          return;
        }
        if (password.length < 6) {
          errorMsg = 'Password must be at least 6 characters';
          render();
          return;
        }
      }

      isLoading = true;
      render();

      try {
        if (currentTab === 'login') {
          await signIn(email, password);
          // Auth state listener in app.js will handle navigation
        } else {
          const result = await signUp(email, password);
          if (result.status === 'pending') {
            pendingEmail = email;
            showPending = true;
          }
          // If admin, auth state listener will auto-navigate
        }
      } catch (err) {
        errorMsg = friendlyError(err.message);
      } finally {
        isLoading = false;
        render();
      }
    });
  }

  render();
}

/**
 * Convert Firebase error codes to user-friendly messages.
 */
function friendlyError(msg) {
  if (!msg) return 'An error occurred';
  if (msg.includes('auth/email-already-in-use')) return 'This email is already registered';
  if (msg.includes('auth/invalid-email')) return 'Invalid email address';
  if (msg.includes('auth/user-not-found')) return 'No account found with this email';
  if (msg.includes('auth/wrong-password')) return 'Incorrect password';
  if (msg.includes('auth/weak-password')) return 'Password is too weak (min 6 characters)';
  if (msg.includes('auth/too-many-requests')) return 'Too many attempts. Please try again later.';
  if (msg.includes('auth/invalid-credential')) return 'Invalid email or password';
  if (msg.includes('pending approval')) return 'Account pending approval';
  return msg;
}
