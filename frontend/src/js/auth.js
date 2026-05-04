const API_BASE_URL = 'https://translations-attorney-parliamentary-improvements.trycloudflare.com/api'; // Change according to the deployment URL

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('authForm');
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const errorEl = document.getElementById('authError');
  const successEl = document.getElementById('authSuccess');

  // Check if already logged in
  if (localStorage.getItem('token')) {
    successEl.textContent = 'You are already logged in.';
    successEl.removeAttribute('hidden');
    form.querySelector('div').setAttribute('hidden', '');
    form.querySelector('div:nth-of-type(2)').setAttribute('hidden', '');
    loginBtn.textContent = 'Log out';
    registerBtn.setAttribute('hidden', '');
    
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      window.location.reload();
    });
    return;
  }

  const handleAuth = async (isLogin) => {
    errorEl.setAttribute('hidden', '');
    successEl.setAttribute('hidden', '');
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      errorEl.textContent = 'Please fill in all fields.';
      errorEl.removeAttribute('hidden');
      return;
    }

    const endpoint = isLogin ? '/auth/login' : '/auth/register';

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'An error occurred');
      }

      if (isLogin) {
        localStorage.setItem('token', data.token);
        successEl.textContent = 'Login successful. Redirecting...';
        successEl.removeAttribute('hidden');
        setTimeout(() => {
          window.location.href = 'history.html';
        }, 1000);
      } else {
        successEl.textContent = 'Registration successful. You can now log in.';
        successEl.removeAttribute('hidden');
      }
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.removeAttribute('hidden');
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleAuth(true); // Login by default on submit
  });

  registerBtn.addEventListener('click', () => {
    handleAuth(false); // Register
  });
});