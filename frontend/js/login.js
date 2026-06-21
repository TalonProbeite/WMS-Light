(() => {
  // При загрузке проверяем сессию через GET /users/me.
  // Если кука жива — редиректим сразу, без повторного логина.
  (async () => {
    try {
      const user = await API.auth.me();
      if (user && user.role) {
        API.saveUser && API.saveUser(user); // обновляем localStorage
        redirectByRole(user.role);
      }
    } catch {
      // 401/403 — кука мертва, остаёмся на странице логина
    }
  })();

  const form  = document.getElementById('login-form');
  const btn   = document.getElementById('login-btn');
  const alert = document.getElementById('login-alert');

  const showError = (msg) => { alert.textContent = msg; alert.style.display = 'block'; };
  const hideError = ()    => { alert.style.display = 'none'; };

  function redirectByRole(role) {
    window.location.href = role === 'worker' ? '/worker.html' : '/dashboard.html';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');

    const username = form.querySelector('[name="username"]').value.trim();
    const password = form.querySelector('[name="password"]').value;

    if (!username) { document.querySelector('[data-error="username"]').textContent = 'Введите логин';  return; }
    if (!password) { document.querySelector('[data-error="password"]').textContent = 'Введите пароль'; return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      const user = await API.auth.login(username, password);
      redirectByRole(user.role);
    } catch (err) {
      showError(err.message || 'Неверный логин или пароль');
      btn.disabled = false;
      btn.innerHTML = 'Войти';
    }
  });

  form.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', () => {
      const e = document.querySelector(`[data-error="${inp.name}"]`);
      if (e) e.textContent = '';
      hideError();
    });
  });
})();