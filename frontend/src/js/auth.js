const API_BASE_URL = 'https://translations-attorney-parliamentary-improvements.trycloudflare.com/api'; // Modifier selon l'URL de déploiement

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('authForm');
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const errorEl = document.getElementById('authError');
  const successEl = document.getElementById('authSuccess');
  const adminLink = document.getElementById('adminLink');

  const role = localStorage.getItem('role');
  if (role === 'admin' && adminLink) {
    adminLink.removeAttribute('hidden');
  }

  // Check if already logged in
  if (localStorage.getItem('token')) {
    successEl.textContent = 'You are already logged in.';
    successEl.removeAttribute('hidden');
    form.querySelector('div').setAttribute('hidden', '');
    form.querySelector('div:nth-of-type(2)').setAttribute('hidden', '');
    loginBtn.textContent = 'Logout';
    registerBtn.setAttribute('hidden', '');
    
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      window.location.reload();
    });
    return;
  }

  const handleAuth = async (isLogin) => {
    errorEl.setAttribute('hidden', '');
    successEl.setAttribute('hidden', '');
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      errorEl.textContent = 'Please fill in all fields.';
      errorEl.removeAttribute('hidden');
      return;
    }

    const endpoint = isLogin ? '/auth/login' : '/auth/register';

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Une erreur est survenue');
      }

      if (isLogin) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        successEl.textContent = 'Login successful. Redirecting...';
        successEl.removeAttribute('hidden');
        setTimeout(() => {
          if (data.role === 'admin') {
            window.location.href = 'users.html'; // Admin Panel
          } else {
            window.location.href = 'history.html'; // User personal space
          }
        }, 1000);
      } else {
        successEl.textContent = 'Registration successful. You can now log in.';
        successEl.removeAttribute('hidden');
        form.reset();
      }
    } catch (err) {
      errorEl.textContent = err.message || 'Login/Registration error.';
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
