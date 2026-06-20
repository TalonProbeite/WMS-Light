(() => {
  // Не делаем авто-редирект при наличии юзера в localStorage —
  // кука могла протухнуть, пусть пользователь войдёт явно.
  // Редирект произойдёт только после успешного POST /users/login.

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