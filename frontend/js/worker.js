let currentUser = null;

(async () => {
  const user = API.getUser();
  if (!user) { window.location.href = '/index.html'; return; }
  if (user.role !== 'worker') { window.location.href = '/dashboard.html'; return; }
  currentUser = user;
  document.getElementById('sidebar-username').textContent = user.username;
  document.getElementById('sidebar-avatar').textContent   = user.username[0].toUpperCase();
  UI.initMobileSidebar();
  await newTxModule.loadProducts();
  nav('my-tx');
})();

function nav(section) {
  const titles = { 'my-tx': 'История моих операций', 'new-tx': 'Новая операция', 'stock-view': 'Остатки на складе' };
  UI.showSection(section);
  document.getElementById('page-title').textContent = titles[section] || section;
  if (section === 'my-tx')      myTxModule.reset();
  if (section === 'stock-view') workerStockModule.reset();
}

// GET /transactions/my — своя история (не /transactions/ — тот только для admin+)
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
      if (type) params.transaction_type = type; // 'incoming' | 'outgoing'

      let list = await API.transactions.my(params);
      if (!Array.isArray(list)) list = [];

      // Ответ содержит username и product_name — не нужен prodMap
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

// POST /transactions/create  transaction_type: 'incoming' | 'outgoing'
const newTxModule = (() => {
  let productsList = [];

  const loadProducts = async () => {
    try {
      const items = await API.products.list({ limit: 100, sort_by: 'name' });
      productsList = Array.isArray(items) ? items : [];
      const sel = document.getElementById('new-tx-product');
      sel.innerHTML = '<option value="">— выберите товар —</option>';
      productsList.forEach(p => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = `${p.sku ? '['+p.sku+'] ' : ''}${p.name}`;
        sel.appendChild(o);
      });
      sel.onchange = () => {
        const hint  = document.getElementById('product-stock-hint');
        const found = productsList.find(p => p.id === parseInt(sel.value));
        if (found) { hint.textContent = `Текущий остаток: ${found.quantity} шт.`; hint.style.display = 'block'; }
        else hint.style.display = 'none';
      };
    } catch { UI.toastError('Не удалось загрузить список товаров'); }
  };

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
    if (!data.product_id)       { UI.showFieldError('product_id', 'Выберите товар');              valid = false; }
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
      UI.clearForm('form-new-tx');
      document.getElementById('product-stock-hint').style.display = 'none';
      await loadProducts();
      setTimeout(() => okEl.style.display = 'none', 5000);
    } catch (err) {
      alertEl.textContent = err.message;
      alertEl.style.display = 'block';
    } finally { UI.btnLoading(btn, false); }
  };

  return { loadProducts, submit };
})();

// GET /products/
const workerStockModule = (() => {
  let page = 1; const LIMIT = 20; let timer = null;

  const load = async () => {
    const search = document.getElementById('w-stock-search')?.value.trim();
    const tbody  = document.getElementById('w-stock-tbody');
    tbody.innerHTML = UI.renderLoadingRow(5);
    try {
      const params = { limit: LIMIT, offset: (page - 1) * LIMIT, sort_by: 'name' };
      if (search) params.search = search;
      const list  = await API.products.list(params);
      const items = Array.isArray(list) ? list : [];
      tbody.innerHTML = items.length ? items.map(p => {
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
      renderPagW('w-stock-pagination', items.length, LIMIT, page, 'workerStockModule');
    } catch (err) {
      tbody.innerHTML = UI.renderEmptyRow(5, 'Ошибка загрузки');
      UI.toastError(err.message);
    }
  };

  const reset    = () => { page = 1; load(); };
  const prevPage = () => { if (page > 1) { page--; load(); } };
  const nextPage = () => { page++; load(); };
  const onSearch = () => { clearTimeout(timer); timer = setTimeout(reset, 350); };
  return { reset, prevPage, nextPage, onSearch };
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