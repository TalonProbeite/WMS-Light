/**
 * UI — Вспомогательные функции интерфейса
 * Тосты, модальные окна, хелперы таблиц
 */

const UI = (() => {

  // ─── ТОСТЫ ──────────────────────────────────────────
  const toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  document.body.appendChild(toastContainer);

  const toast = (message, type = 'info', duration = 4000) => {
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span style="font-size:1rem;flex-shrink:0">${icons[type] || icons.info}</span>
      <span>${message}</span>
    `;
    toastContainer.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      el.style.transition = 'opacity 0.25s, transform 0.25s';
      setTimeout(() => el.remove(), 300);
    }, duration);
  };

  const toastSuccess = (msg) => toast(msg, 'success');
  const toastError   = (msg) => toast(msg, 'error');
  const toastInfo    = (msg) => toast(msg, 'info');

  // ─── МОДАЛЬНЫЕ ОКНА ──────────────────────────────────
  const openModal = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
    document.body.style.overflow = '';
  };

  // Закрытие по клику на оверлей
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('open');
      document.body.style.overflow = '';
    }
  });

  // Закрытие по Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => {
        m.classList.remove('open');
        document.body.style.overflow = '';
      });
    }
  });

  // ─── НАВИГАЦИЯ (SPA-стиль) ───────────────────────────
  const showSection = (sectionId) => {
    document.querySelectorAll('[data-section]').forEach(s => {
      s.style.display = s.dataset.section === sectionId ? 'block' : 'none';
    });
    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.nav === sectionId);
    });
  };

  // ─── ФОРМЫ ───────────────────────────────────────────
  const clearForm = (formId) => {
    const form = document.getElementById(formId);
    if (!form) return;
    form.querySelectorAll('input, select, textarea').forEach(el => {
      el.value = '';
    });
    form.querySelectorAll('.field-error').forEach(e => e.textContent = '');
  };

  const getFormData = (formId) => {
    const form = document.getElementById(formId);
    if (!form) return {};
    const data = {};
    form.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.name) data[el.name] = el.value.trim();
    });
    return data;
  };

  const setFormData = (formId, data) => {
    const form = document.getElementById(formId);
    if (!form) return;
    Object.entries(data).forEach(([key, val]) => {
      const el = form.querySelector(`[name="${key}"]`);
      if (el) el.value = val ?? '';
    });
  };

  const showFieldError = (fieldName, msg) => {
    const err = document.querySelector(`[data-error="${fieldName}"]`);
    if (err) err.textContent = msg;
  };

  const clearFieldErrors = (formId) => {
    document.querySelectorAll(`#${formId} .field-error`).forEach(e => e.textContent = '');
  };

  // ─── ТАБЛИЦЫ ─────────────────────────────────────────
  const renderEmptyRow = (cols, message = 'Нет данных') => `
    <tr>
      <td colspan="${cols}" class="text-muted" style="text-align:center;padding:40px">
        <span style="font-size:1.5rem;display:block;margin-bottom:8px">📭</span>
        ${message}
      </td>
    </tr>
  `;

  const renderLoadingRow = (cols) => `
    <tr>
      <td colspan="${cols}" style="text-align:center;padding:40px">
        <span class="spinner dark"></span>
      </td>
    </tr>
  `;

  // ─── ФОРМАТИРОВАНИЕ ───────────────────────────────────
  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatDateOnly = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ru-RU');
  };

  const roleLabel = (role) => {
    const map = { superadmin: 'Супер-администратор', admin: 'Администратор', worker: 'Кладовщик' };
    return map[role] || role;
  };

  const roleBadge = (role) => {
    const classes = { superadmin: 'badge-blue', admin: 'badge-warn', worker: 'badge-gray' };
    return `<span class="badge ${classes[role] || 'badge-gray'}">${roleLabel(role)}</span>`;
  };

  const txTypeBadge = (type) => {
    if (type === 'incoming') return `<span class="badge badge-green">↑ Приход</span>`;
    if (type === 'outgoing') return `<span class="badge badge-red">↓ Расход</span>`;
    return `<span class="badge badge-gray">${type}</span>`;
  };

  // ─── ЗАГРУЗКА КНОПКИ ─────────────────────────────────
  const btnLoading = (btn, loading) => {
    if (loading) {
      btn.dataset.origText = btn.innerHTML;
      btn.innerHTML = `<span class="spinner"></span>`;
      btn.disabled = true;
    } else {
      btn.innerHTML = btn.dataset.origText || btn.innerHTML;
      btn.disabled = false;
    }
  };

  // ─── ПОДТВЕРЖДЕНИЕ ───────────────────────────────────
  const confirm = (message) => window.confirm(message);

  // ─── МОБИЛЬНЫЙ САЙДБАР ───────────────────────────────
  const initMobileSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // Кнопка-гамбургер
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary btn-sm';
    btn.style.cssText = 'display:none;margin-right:8px;font-size:1.1rem;padding:5px 9px';
    btn.textContent = '☰';
    const header = document.querySelector('.page-header');
    if (header) header.prepend(btn);

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99
    `;
    document.body.appendChild(overlay);

    btn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
    });

    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.style.display = 'none';
    });

    const checkMobile = () => {
      btn.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
  };

  return {
    toast, toastSuccess, toastError, toastInfo,
    openModal, closeModal,
    showSection,
    clearForm, getFormData, setFormData, showFieldError, clearFieldErrors,
    renderEmptyRow, renderLoadingRow,
    formatDate, formatDateOnly,
    roleLabel, roleBadge, txTypeBadge,
    btnLoading,
    confirm,
    initMobileSidebar,
  };
})();