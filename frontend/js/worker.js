let currentUser = null;

(async () => {
  const user = API.getUser();
  if (!user) { window.location.href = '/index.html'; return; }
  if (user.role !== 'worker') { window.location.href = '/dashboard.html'; return; }
  currentUser = user;
  document.getElementById('sidebar-username').textContent = user.username;
  document.getElementById('sidebar-avatar').textContent   = user.username[0].toUpperCase();
  UI.initMobileSidebar();
  // Загружаем категории для фильтра товаров
  workerProductsModule.loadCats();
  nav('my-tx');
})();

function nav(section) {
  const titles = {
    'my-tx':        'История моих операций',
    'new-tx':       'Новая операция',
    'products-view':'Справочник товаров',
    'stock-view':   'Остатки на складе',
  };
  UI.showSection(section);
  document.getElementById('page-title').textContent = titles[section] || section;
  if (section === 'my-tx')         myTxModule.reset();
  if (section === 'new-tx')        newTxModule.preload();
  if (section === 'products-view') workerProductsModule.reset();
  if (section === 'stock-view')    workerStockModule.reset();
}

// ═══ МОИ ТРАНЗАКЦИИ  GET /transactions/my ════════════════════════
const myTxModule = (() => {
  let page = 1; const LIMIT = 25;

  const load = async () => {
    const type  = document.getElementById('my-tx-type')?.value || '';
    const from  = document.getElementById('my-tx-from')?.value;
    const to    = document.getElementById('my-tx-to')?.value;
    const tbody = document.getElementById('my-tx-tbody');
    tbody.innerHTML = UI.renderLoadingRow(4);
    try {
      const params = { limit: LIMIT, offset: (page - 1) * LIMIT, sort_order: 'desc' };
      if (from) params.date_from        = from + 'T00:00:00';
      if (to)   params.date_to          = to   + 'T23:59:59';
      if (type) params.transaction_type = type;

      let list = await API.transactions.my(params);
      if (!Array.isArray(list)) list = [];

      tbody.innerHTML = list.length ? list.map(t => `
        <tr>
          <td>${UI.formatDate(t.created_at)}</td>
          <td>${t.product_name || '—'}</td>
          <td>${UI.txTypeBadge(t.transaction_type)}</td>
          <td><strong>${t.quantity}</strong></td>
        </tr>`).join('') : UI.renderEmptyRow(4, 'У вас пока нет операций');

      renderPagW('my-tx-pagination', list.length, LIMIT, page, 'myTxModule');
    } catch (err) {
      tbody.innerHTML = UI.renderEmptyRow(4, 'Ошибка загрузки');
      UI.toastError(err.message);
    }
  };

  const reset    = () => { page = 1; load(); };
  const prevPage = () => { if (page > 1) { page--; load(); } };
  const nextPage = () => { page++; load(); };
  return { reset, prevPage, nextPage };
})();

// ═══ НОВАЯ ОПЕРАЦИЯ ══════════════════════════════════════════════
// Поиск товара: текстовый input + dropdown с живым поиском через GET /products/
const newTxModule = (() => {
  let allProducts = [];   // кеш первых 100 для быстрого фильтра
  let selectedId  = null;
  let searchTimer = null;

  // Предзагрузка при открытии раздела
  const preload = async () => {
    try {
      const list = await API.products.list({ limit: 100, sort_by: 'name' });
      allProducts = Array.isArray(list) ? list : [];
    } catch {}
  };

  const onSearch = async (val) => {
    clearTimeout(searchTimer);
    // Сбрасываем выбранный товар при изменении текста
    selectedId = null;
    document.getElementById('tx-product-id').value = '';
    document.getElementById('product-stock-hint').style.display = 'none';

    if (!val.trim()) { closeDropdown(); return; }

    searchTimer = setTimeout(async () => {
      try {
        // Сначала ищем в кеше, если нет — запрос к API
        const q = val.toLowerCase();
        let results = allProducts.filter(p =>
          p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
        );
        if (results.length === 0) {
          const fresh = await API.products.list({ search: val, limit: 20, sort_by: 'name' });
          results = Array.isArray(fresh) ? fresh : [];
        }
        showDropdown(results.slice(0, 15), val);
      } catch {}
    }, 200);
  };

  const showDropdown = (items, query) => {
    const dd = document.getElementById('tx-product-dropdown');
    if (!items.length) { dd.innerHTML = '<div style="padding:10px 14px;color:var(--text-muted);font-size:0.85rem">Ничего не найдено</div>'; dd.style.display = 'block'; return; }
    dd.innerHTML = items.map(p => {
      const q   = p.quantity;
      const qBadge = q === 0 ? `<span class="badge badge-red" style="margin-left:6px">0</span>`
                   : q <= 5  ? `<span class="badge badge-warn" style="margin-left:6px">${q}</span>`
                   : `<span style="margin-left:6px;color:var(--text-muted);font-size:0.78rem">${q} шт.</span>`;
      return `<div data-id="${p.id}" data-name="${p.name.replace(/"/g,'&quot;')}" data-qty="${q}"
        style="padding:9px 14px;cursor:pointer;border-bottom:1px solid var(--border-light, #f0f0f0);font-size:0.88rem"
        onmousedown="newTxModule.select(${p.id},'${p.name.replace(/'/g,"\\'")}',${q})"
        onmouseover="this.style.background='var(--bg)'"
        onmouseout="this.style.background=''">
        <strong>${p.name}</strong>${p.sku ? `<code style="margin-left:6px;font-size:0.75rem">${p.sku}</code>` : ''}${qBadge}
      </div>`;
    }).join('');
    dd.style.display = 'block';
  };

  const closeDropdown = () => {
    document.getElementById('tx-product-dropdown').style.display = 'none';
  };

  const select = (id, name, qty) => {
    selectedId = id;
    document.getElementById('tx-product-search').value = name;
    document.getElementById('tx-product-id').value     = id;
    const hint = document.getElementById('product-stock-hint');
    hint.textContent = `Текущий остаток: ${qty} шт.`;
    hint.style.display = 'block';
    closeDropdown();
  };

  // Закрыть dropdown при клике вне
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#tx-product-search') && !e.target.closest('#tx-product-dropdown')) {
      closeDropdown();
    }
  });

  const submit = async () => {
    const btn     = document.getElementById('btn-submit-tx');
    const alertEl = document.getElementById('new-tx-alert');
    const okEl    = document.getElementById('new-tx-success');
    const data    = UI.getFormData('form-new-tx');

    alertEl.style.display = 'none';
    okEl.style.display = 'none';
    document.querySelectorAll('#form-new-tx .field-error').forEach(e => e.textContent = '');

    let valid = true;
    if (!data.transaction_type) { UI.showFieldError('transaction_type', 'Выберите тип операции'); valid = false; }
    if (!data.product_id)       { UI.showFieldError('product_id', 'Выберите товар из списка');   valid = false; }
    if (!data.quantity || parseInt(data.quantity) < 1) { UI.showFieldError('quantity', 'Количество ≥ 1'); valid = false; }
    if (!valid) return;

    UI.btnLoading(btn, true);
    try {
      await API.transactions.create({
        product_id:       parseInt(data.product_id),
        quantity:         parseInt(data.quantity),
        transaction_type: data.transaction_type,
      });
      okEl.textContent = 'Операция успешно проведена.';
      okEl.style.display = 'block';
      // Сбрасываем форму
      UI.clearForm('form-new-tx');
      document.getElementById('tx-product-search').value = '';
      document.getElementById('tx-product-id').value     = '';
      document.getElementById('product-stock-hint').style.display = 'none';
      selectedId = null;
      allProducts = []; // сбрасываем кеш — остатки изменились
      setTimeout(() => okEl.style.display = 'none', 5000);
    } catch (err) {
      alertEl.textContent = err.message;
      alertEl.style.display = 'block';
    } finally { UI.btnLoading(btn, false); }
  };

  return { onSearch, select, submit, preload };
})();

// ═══ ТОВАРЫ (только просмотр)  GET /products/ ════════════════════
const workerProductsModule = (() => {
  let page = 1; const LIMIT = 20;
  let timer = null;

  const loadCats = async () => {
    try {
      const cats = await API.categories.list();
      if (!Array.isArray(cats)) return;
      const f = document.getElementById('w-prod-cat-filter');
      cats.forEach(c => f.innerHTML += `<option value="${c.id}">${c.name}</option>`);
    } catch {}
  };

  const load = async () => {
    const search  = document.getElementById('w-prod-search')?.value.trim();
    const catId   = document.getElementById('w-prod-cat-filter')?.value;
    const sortBy  = document.getElementById('w-prod-sort-by')?.value || 'name';
    const tbody   = document.getElementById('w-prod-tbody');
    tbody.innerHTML = UI.renderLoadingRow(6);
    try {
      const params = { limit: LIMIT, offset: (page - 1) * LIMIT, sort_by: sortBy, sort_order: 'asc' };
      if (search) params.search = search;
      if (catId)  params.category_id = catId;
      let list = await API.products.list(params);
      if (!Array.isArray(list)) list = [];

      tbody.innerHTML = list.length ? list.map(p => {
        const q   = p.quantity;
        const qEl = q === 0 ? `<span class="badge badge-red">0</span>`
                  : q <= 5  ? `<span class="badge badge-warn">${q}</span>` : q;
        return `<tr>
          <td><code>${p.sku}</code></td>
          <td>${p.name}</td>
          <td>${p.category_name || '—'}</td>
          <td>${qEl}</td>
          <td class="text-muted" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.description || '—'}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="workerProductsModule.openDetail(${p.id})">Карточка</button>
          </td>
        </tr>`;
      }).join('') : UI.renderEmptyRow(6, 'Товары не найдены');

      renderPagW('w-prod-pagination', list.length, LIMIT, page, 'workerProductsModule');
    } catch (err) {
      tbody.innerHTML = UI.renderEmptyRow(6, 'Ошибка загрузки');
      UI.toastError(err.message);
    }
  };

  const openDetail = async (id) => {
    try {
      const p   = await API.products.single({ product_id: id });
      const q   = p.quantity;
      const qEl = q === 0 ? `<span class="badge badge-red">0 шт.</span>`
                : q <= 5  ? `<span class="badge badge-warn">${q} шт.</span>`
                : `<strong>${q} шт.</strong>`;
      document.getElementById('modal-w-product-body').innerHTML = `
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:5px 0;color:var(--text-muted);width:130px">Название</td><td><strong>${p.name}</strong></td></tr>
          <tr><td style="padding:5px 0;color:var(--text-muted)">Артикул</td><td><code>${p.sku}</code></td></tr>
          <tr><td style="padding:5px 0;color:var(--text-muted)">Категория</td><td>${p.category_name || '—'}</td></tr>
          <tr><td style="padding:5px 0;color:var(--text-muted)">Остаток</td><td>${qEl}</td></tr>
          <tr><td style="padding:5px 0;color:var(--text-muted)">Обновлено</td><td>${UI.formatDate(p.stock_updated_at)}</td></tr>
          <tr><td style="padding:5px 0;color:var(--text-muted)">Описание</td><td>${p.description || '—'}</td></tr>
        </table>`;
      UI.openModal('modal-w-product');
    } catch (err) { UI.toastError(err.message); }
  };

  const reset    = () => { page = 1; load(); };
  const prevPage = () => { if (page > 1) { page--; load(); } };
  const nextPage = () => { page++; load(); };
  const onSearch = () => { clearTimeout(timer); timer = setTimeout(reset, 350); };

  return { loadCats, reset, prevPage, nextPage, onSearch, openDetail };
})();

// ═══ ОСТАТКИ  GET /products/ ══════════════════════════════════════
const workerStockModule = (() => {
  let page = 1; const LIMIT = 20;
  let timer = null;
  let sortOrder = 'asc';

  const load = async () => {
    const search  = document.getElementById('w-stock-search')?.value.trim();
    const lowOnly = document.getElementById('w-stock-low')?.checked;
    const tbody   = document.getElementById('w-stock-tbody');
    tbody.innerHTML = UI.renderLoadingRow(5);
    try {
      const params = { limit: LIMIT, offset: (page - 1) * LIMIT, sort_by: 'quantity', sort_order: sortOrder };
      if (search) params.search = search;
      let list = await API.products.list(params);
      if (!Array.isArray(list)) list = [];
      if (lowOnly) list = list.filter(p => p.quantity <= 5);

      tbody.innerHTML = list.length ? list.map(p => {
        const q   = p.quantity;
        const qEl = q === 0 ? `<span class="badge badge-red">0</span>`
                  : q <= 5  ? `<span class="badge badge-warn">${q}</span>` : q;
        return `<tr>
          <td><code>${p.sku}</code></td>
          <td>${p.name}</td>
          <td>${p.category_name || '—'}</td>
          <td>${qEl}</td>
          <td>${UI.formatDate(p.stock_updated_at)}</td>
        </tr>`;
      }).join('') : UI.renderEmptyRow(5, 'Ничего не найдено');

      renderPagW('w-stock-pagination', list.length, LIMIT, page, 'workerStockModule');
    } catch (err) {
      tbody.innerHTML = UI.renderEmptyRow(5, 'Ошибка загрузки');
      UI.toastError(err.message);
    }
  };

  const reset    = () => { page = 1; load(); };
  const prevPage = () => { if (page > 1) { page--; load(); } };
  const nextPage = () => { page++; load(); };
  const onSearch = () => { clearTimeout(timer); timer = setTimeout(reset, 350); };
  const sortByQty = () => { sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'; reset(); };

  return { reset, prevPage, nextPage, onSearch, sortByQty };
})();

function renderPagW(cid, received, limit, cur, moduleName) {
  const el = document.getElementById(cid);
  if (!el) return;
  const hasMore = received >= limit;
  const hasPrev = cur > 1;
  if (!hasMore && !hasPrev) { el.innerHTML = ''; return; }
  let h = `<span class="text-muted" style="font-size:0.78rem;margin-right:8px">Стр. ${cur}</span>`;
  h += `<button class="page-btn" ${!hasPrev ? 'disabled' : ''} onclick="${moduleName}.prevPage()">‹ Назад</button>`;
  h += `<button class="page-btn active" style="pointer-events:none">${cur}</button>`;
  h += `<button class="page-btn" ${!hasMore ? 'disabled' : ''} onclick="${moduleName}.nextPage()">Вперёд ›</button>`;
  el.innerHTML = h;
}