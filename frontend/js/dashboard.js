let currentUser = null;

(async () => {
  const user = API.getUser();
  if (!user) { window.location.href = '/index.html'; return; }
  if (user.role === 'worker') { window.location.href = '/worker.html'; return; }
  currentUser = user;
  document.getElementById('sidebar-username').textContent = user.username;
  document.getElementById('sidebar-role').textContent     = UI.roleLabel(user.role);
  document.getElementById('sidebar-avatar').textContent   = user.username[0].toUpperCase();
  if (user.role !== 'superadmin') {
    const o = document.getElementById('opt-admin');
    if (o) o.remove();
  }
  UI.initMobileSidebar();
  nav('overview');
})();

function nav(section) {
  const titles = {
    overview: 'Обзор', stock: 'Остатки на складе',
    transactions: 'Движение товаров', products: 'Справочник товаров',
    categories: 'Категории', users: 'Пользователи системы',
  };
  UI.showSection(section);
  document.getElementById('page-title').textContent = titles[section] || section;

  const actions = document.getElementById('page-actions');
  actions.innerHTML = '';
  if (section === 'transactions') {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-sm';
    btn.textContent = '+ Новая операция';
    btn.onclick = () => txModule.openCreate();
    actions.appendChild(btn);
  }

  switch (section) {
    case 'overview':     overviewModule.load();   break;
    case 'stock':        stockModule.reset();     break;
    case 'transactions': txModule.reset();        break;
    case 'products':     productsModule.init();   break;
    case 'categories':   categoriesModule.load(); break;
    case 'users':        usersModule.load();      break;
  }
}

// ═══ ОБЗОР ═══════════════════════════════════════════════════════
// GET /dashboard/stats → { total_products, out_of_stock_products, total_categories }
// GET /transactions/ с date_from=сегодня → для счётчика "сегодня"
// GET /transactions/ limit=10 → последние операции (username и product_name в ответе)
const overviewModule = {
  async load() {
    try {
      const todayISO = new Date().toISOString().slice(0, 10) + 'T00:00:00';
      const [stats, todayTxData, recentTxData] = await Promise.all([
        API.dashboard.stats(),
        API.transactions.all({ limit: 100, date_from: todayISO, sort_order: 'desc' }),
        API.transactions.all({ limit: 10, sort_order: 'desc' }),
      ]);

      const todayTxs  = Array.isArray(todayTxData)  ? todayTxData  : [];
      const recentTxs = Array.isArray(recentTxData) ? recentTxData : [];

      document.getElementById('stat-products').textContent   = stats.total_products        ?? '—';
      document.getElementById('stat-categories').textContent = stats.total_categories      ?? '—';
      document.getElementById('stat-today').textContent      = todayTxs.length;
      document.getElementById('stat-zero').textContent       = stats.out_of_stock_products ?? '—';

      const tbody = document.getElementById('recent-tx-tbody');
      tbody.innerHTML = recentTxs.length
        ? recentTxs.map(t => `
          <tr>
            <td>${UI.formatDate(t.created_at)}</td>
            <td>${t.product_name || '—'}</td>
            <td>${UI.txTypeBadge(t.transaction_type)}</td>
            <td>${t.quantity}</td>
            <td>${t.username || '—'}</td>
          </tr>`).join('')
        : UI.renderEmptyRow(5, 'Операций пока нет');
    } catch (err) {
      UI.toastError('Ошибка загрузки: ' + err.message);
    }
  }
};

// ═══ ОСТАТКИ ═════════════════════════════════════════════════════
// Пагинация: page-переменная внутри модуля, методы prevPage/nextPage доступны глобально
const stockModule = (() => {
  let page = 1; const LIMIT = 20;
  let timer = null;
  let sortBy = 'name', sortOrd = 'asc';

  const load = async () => {
    const search  = document.getElementById('stock-search')?.value.trim();
    const lowOnly = document.getElementById('stock-low')?.checked;
    const tbody   = document.getElementById('stock-tbody');
    tbody.innerHTML = UI.renderLoadingRow(6);
    try {
      const params = { limit: LIMIT, offset: (page - 1) * LIMIT, sort_by: sortBy, sort_order: sortOrd };
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
          <td><div class="td-actions">
            <button class="btn btn-secondary btn-sm" onclick="productsModule.openDetail(${p.id})">Карточка</button>
          </div></td>
        </tr>`;
      }).join('') : UI.renderEmptyRow(6, 'Позиции не найдены');

      renderPag('stock-pagination', list.length, LIMIT, page, 'stockModule');
    } catch (err) {
      tbody.innerHTML = UI.renderEmptyRow(6, 'Ошибка загрузки');
      UI.toastError(err.message);
    }
  };

  const reset   = () => { page = 1; load(); };
  const onSearch = () => { clearTimeout(timer); timer = setTimeout(reset, 350); };
  const onLow    = () => reset();
  const sortByFn = (field) => {
    sortOrd = (sortBy === field && sortOrd === 'asc') ? 'desc' : 'asc';
    sortBy = field; reset();
  };
  const prevPage = () => { if (page > 1) { page--; load(); } };
  const nextPage = () => { page++; load(); };

  return { load, reset, onSearch, onLow, sortBy: sortByFn, prevPage, nextPage };
})();

// ═══ ТРАНЗАКЦИИ ══════════════════════════════════════════════════
// GET /transactions/           — все транзакции (admin, superadmin)
// GET /transactions/user?user_name= — конкретный юзер (admin, superadmin)
// Ответ содержит username и product_name — prodMap не нужен
const txModule = (() => {
  let page = 1; const LIMIT = 25;
  let userTimer = null, pendingUser = '';

  const load = async () => {
    const from   = document.getElementById('tx-from')?.value;
    const to     = document.getElementById('tx-to')?.value;
    const txType = document.getElementById('tx-type-filter')?.value || '';
    const tbody  = document.getElementById('tx-tbody');
    tbody.innerHTML = UI.renderLoadingRow(5);
    try {
      const params = { limit: LIMIT, offset: (page - 1) * LIMIT, sort_order: 'desc' };
      if (from)   params.date_from        = from + 'T00:00:00';
      if (to)     params.date_to          = to   + 'T23:59:59';
      if (txType) params.transaction_type = txType; // 'incoming' | 'outgoing'

      let list = pendingUser
        ? await API.transactions.byUser(pendingUser, params)
        : await API.transactions.all(params);
      if (!Array.isArray(list)) list = [];

      tbody.innerHTML = list.length ? list.map(t => `
        <tr>
          <td>${UI.formatDate(t.created_at)}</td>
          <td>${t.product_name || '—'}</td>
          <td>${UI.txTypeBadge(t.transaction_type)}</td>
          <td><strong>${t.quantity}</strong></td>
          <td>${t.username || '—'}</td>
        </tr>`).join('') : UI.renderEmptyRow(5, 'Операций не найдено');

      renderPag('tx-pagination', list.length, LIMIT, page, 'txModule');
    } catch (err) {
      tbody.innerHTML = UI.renderEmptyRow(5, err.status === 404 ? 'Пользователь не найден' : 'Ошибка загрузки');
    }
  };

  const reset       = () => { page = 1; load(); };
  const prevPage    = () => { if (page > 1) { page--; load(); } };
  const nextPage    = () => { page++; load(); };
  const onUserFilter = (val) => {
    clearTimeout(userTimer);
    userTimer = setTimeout(() => { pendingUser = val.trim(); reset(); }, 500);
  };

  const openCreate = async () => {
    UI.clearForm('form-tx');
    document.querySelectorAll('#form-tx .field-error').forEach(e => e.textContent = '');
    document.getElementById('tx-stock-hint').style.display = 'none';
    try {
      let list = await API.products.list({ limit: 100, sort_by: 'name' });
      if (!Array.isArray(list)) list = [];
      const sel = document.getElementById('tx-product-sel');
      sel.innerHTML = '<option value="">— выберите товар —</option>';
      list.forEach(p => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = `${p.sku ? '['+p.sku+'] ' : ''}${p.name} (ост: ${p.quantity})`;
        sel.appendChild(o);
      });
      sel.onchange = () => {
        const hint  = document.getElementById('tx-stock-hint');
        const found = list.find(p => p.id === parseInt(sel.value));
        if (found) { hint.textContent = `Текущий остаток: ${found.quantity} шт.`; hint.style.display = 'block'; }
        else hint.style.display = 'none';
      };
    } catch {}
    UI.openModal('modal-tx');
  };

  const save = async () => {
    const btn  = document.getElementById('btn-save-tx');
    const data = UI.getFormData('form-tx');
    let ok = true;
    if (!data.transaction_type) { UI.showFieldError('transaction_type', 'Выберите тип');  ok = false; }
    if (!data.product_id)       { UI.showFieldError('product_id', 'Выберите товар');      ok = false; }
    if (!data.quantity || parseInt(data.quantity) < 1) { UI.showFieldError('quantity', 'Количество ≥ 1'); ok = false; }
    if (!ok) return;
    UI.btnLoading(btn, true);
    try {
      await API.transactions.create({
        product_id:       parseInt(data.product_id),
        quantity:         parseInt(data.quantity),
        transaction_type: data.transaction_type,
      });
      UI.closeModal('modal-tx');
      UI.toastSuccess('Операция проведена');
      reset();
    } catch (err) { UI.toastError(err.message); }
    finally       { UI.btnLoading(btn, false); }
  };

  return { load, reset, prevPage, nextPage, onUserFilter, openCreate, save };
})();

// ═══ ТОВАРЫ ══════════════════════════════════════════════════════
// GET /products/           — список
// GET /products/single     — карточка
// POST /products/create    — создать
// PATCH /products/{id}     — редактировать
// DELETE /products/{id}    — удалить (admin+)
const productsModule = (() => {
  let page = 1; const LIMIT = 20;
  let timer = null, catsList = [];

  const init = async () => {
    try {
      catsList = await API.categories.list();
      if (!Array.isArray(catsList)) catsList = [];
      const f = document.getElementById('prod-cat-filter');
      f.innerHTML = '<option value="">Все категории</option>';
      catsList.forEach(c => f.innerHTML += `<option value="${c.id}">${c.name}</option>`);
    } catch {}
    page = 1;
    load();
  };

  const load = async () => {
    const search  = document.getElementById('prod-search')?.value.trim();
    const catId   = document.getElementById('prod-cat-filter')?.value;
    const sortBy  = document.getElementById('prod-sort-by')?.value   || 'name';
    const sortOrd = document.getElementById('prod-sort-order')?.value || 'asc';
    const tbody   = document.getElementById('products-tbody');
    tbody.innerHTML = UI.renderLoadingRow(6);
    try {
      const params = { limit: LIMIT, offset: (page - 1) * LIMIT, sort_by: sortBy, sort_order: sortOrd };
      if (search) params.search = search;
      if (catId)  params.category_id = catId;
      let list = await API.products.list(params);
      if (!Array.isArray(list)) list = [];

      tbody.innerHTML = list.length ? list.map(p => {
        const q   = p.quantity;
        const qEl = q === 0 ? `<span class="badge badge-red">0</span>`
                  : q <= 5  ? `<span class="badge badge-warn">${q}</span>` : q;
        const canEdit = currentUser && currentUser.role !== 'worker';
        return `<tr>
          <td><code>${p.sku}</code></td>
          <td>${p.name}</td>
          <td>${p.category_name || '—'}</td>
          <td>${qEl}</td>
          <td class="text-muted" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.description || '—'}</td>
          <td><div class="td-actions">
            <button class="btn btn-secondary btn-sm" onclick="productsModule.openDetail(${p.id})">Просмотр</button>
            ${canEdit ? `<button class="btn btn-secondary btn-sm" onclick="productsModule.openEdit(${p.id})">Изм.</button>` : ''}
            ${canEdit ? `<button class="btn btn-danger btn-sm" onclick="productsModule.remove(${p.id},'${p.name.replace(/'/g,"\\'")}')">Удал.</button>` : ''}
          </div></td>
        </tr>`;
      }).join('') : UI.renderEmptyRow(6, 'Товары не найдены');

      renderPag('prod-pagination', list.length, LIMIT, page, 'productsModule');
    } catch (err) {
      tbody.innerHTML = UI.renderEmptyRow(6, 'Ошибка загрузки');
      UI.toastError(err.message);
    }
  };

  const reset    = () => { page = 1; load(); };
  const prevPage = () => { if (page > 1) { page--; load(); } };
  const nextPage = () => { page++; load(); };
  const onSearch = () => { clearTimeout(timer); timer = setTimeout(reset, 350); };

  const genUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });

  const fillCatSel = () => {
    const sel = document.querySelector('#form-product [name="category_id"]');
    sel.innerHTML = '<option value="">— без категории —</option>';
    catsList.forEach(c => sel.innerHTML += `<option value="${c.id}">${c.name}</option>`);
  };

  const setFieldsDisabled = (disabled) => {
    document.querySelectorAll('#form-product input, #form-product select, #form-product textarea')
      .forEach(el => el.disabled = disabled);
    document.getElementById('btn-save-product').style.display = disabled ? 'none' : '';
  };

  // Создание нового товара
  const openCreate = () => {
    document.getElementById('modal-product-title').textContent = 'Новый товар';
    document.querySelector('#form-product [name="id"]').value = '';
    UI.clearForm('form-product');
    document.querySelectorAll('#form-product .field-error').forEach(e => e.textContent = '');
    fillCatSel();
    document.querySelector('#form-product [name="qr_code_uuid"]').value = genUUID();
    document.querySelector('#form-product [name="initial_quantity"]').value = '0';
    setFieldsDisabled(false);
    UI.openModal('modal-product');
  };

  // Просмотр карточки (поля заблокированы)
  const openDetail = async (id) => {
    document.getElementById('modal-product-title').textContent = 'Карточка товара';
    try {
      const p = await API.products.single({ product_id: id });
      fillCatSel();
      UI.setFormData('form-product', {
        id: '', name: p.name, sku: p.sku, qr_code_uuid: p.qr_code_uuid,
        category_id: p.category_id || '', description: p.description || '',
        initial_quantity: p.quantity,
      });
      setFieldsDisabled(true);
      UI.openModal('modal-product');
    } catch (err) { UI.toastError(err.message); }
  };

  // Редактирование — PATCH /products/{id}
  const openEdit = async (id) => {
    document.getElementById('modal-product-title').textContent = 'Редактировать товар';
    try {
      const p = await API.products.single({ product_id: id });
      fillCatSel();
      UI.setFormData('form-product', {
        id: p.id, name: p.name, sku: p.sku, qr_code_uuid: p.qr_code_uuid,
        category_id: p.category_id || '', description: p.description || '',
        initial_quantity: p.quantity,
      });
      setFieldsDisabled(false);
      // Скрываем initial_quantity при редактировании — остаток меняется через транзакции
      const iqField = document.querySelector('#form-product [name="initial_quantity"]')?.closest('.form-group');
      if (iqField) iqField.style.display = 'none';
      UI.openModal('modal-product');
    } catch (err) { UI.toastError(err.message); }
  };

  // POST /products/create (новый) или PATCH /products/{id} (редактирование)
  const save = async () => {
    setFieldsDisabled(false);
    const btn  = document.getElementById('btn-save-product');
    const data = UI.getFormData('form-product');
    const editId = data.id;

    let ok = true;
    if (!data.name)         { UI.showFieldError('name', 'Введите название');     ok = false; }
    if (!data.sku)          { UI.showFieldError('sku', 'Введите артикул');       ok = false; }
    if (!data.qr_code_uuid) { UI.showFieldError('qr_code_uuid', 'Введите UUID'); ok = false; }
    if (!ok) return;

    UI.btnLoading(btn, true);
    try {
      if (editId) {
        // PATCH — передаём только изменяемые поля
        const body = { name: data.name, sku: data.sku, qr_code_uuid: data.qr_code_uuid, description: data.description || null };
        if (data.category_id) body.category_id = parseInt(data.category_id);
        await API.products.update(editId, body);
        UI.toastSuccess('Товар обновлён');
      } else {
        // POST create
        const body = { name: data.name, sku: data.sku, qr_code_uuid: data.qr_code_uuid, description: data.description || null, initial_quantity: parseInt(data.initial_quantity || 0) };
        if (data.category_id) body.category_id = parseInt(data.category_id);
        await API.products.create(body);
        UI.toastSuccess('Товар добавлен');
      }
      // Восстанавливаем видимость поля
      const iqField = document.querySelector('#form-product [name="initial_quantity"]')?.closest('.form-group');
      if (iqField) iqField.style.display = '';
      UI.closeModal('modal-product');
      load();
    } catch (err) { UI.toastError(err.message); }
    finally       { UI.btnLoading(btn, false); }
  };

  document.getElementById('modal-product').addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
      setFieldsDisabled(false);
      const iqField = document.querySelector('#form-product [name="initial_quantity"]')?.closest('.form-group');
      if (iqField) iqField.style.display = '';
    }
  });

  const remove = async (id, name) => {
    if (!UI.confirm(`Удалить товар «${name}»? Это действие необратимо.`)) return;
    try { await API.products.remove(id); UI.toastSuccess('Товар удалён'); load(); }
    catch (err) { UI.toastError(err.message); }
  };

  return { init, load, reset, prevPage, nextPage, onSearch, openCreate, openDetail, openEdit, save, remove };
})();

// ═══ КАТЕГОРИИ ═══════════════════════════════════════════════════
const categoriesModule = (() => {
  const load = async () => {
    const tbody = document.getElementById('categories-tbody');
    tbody.innerHTML = UI.renderLoadingRow(4);
    try {
      let items = await API.categories.list();
      if (!Array.isArray(items)) items = [];
      tbody.innerHTML = items.length ? items.map((c, i) => `
        <tr>
          <td class="text-muted">${i + 1}</td>
          <td><strong>${c.name}</strong></td>
          <td class="text-muted">${c.description || '—'}</td>
          <td><div class="td-actions">
            <button class="btn btn-secondary btn-sm" onclick="categoriesModule.openEdit(${c.id},'${c.name.replace(/'/g,"\\'")}','${(c.description||'').replace(/'/g,"\\'")}')">Изм.</button>
            <button class="btn btn-danger btn-sm" onclick="categoriesModule.remove('${c.name.replace(/'/g,"\\'")}')">Удал.</button>
          </div></td>
        </tr>`).join('') : UI.renderEmptyRow(4, 'Категорий нет');
    } catch (err) { tbody.innerHTML = UI.renderEmptyRow(4, 'Ошибка'); UI.toastError(err.message); }
  };

  const openCreate = () => {
    document.getElementById('modal-category-title').textContent = 'Новая категория';
    UI.clearForm('form-category');
    document.querySelectorAll('#form-category .field-error').forEach(e => e.textContent = '');
    UI.openModal('modal-category');
  };

  const openEdit = (id, name, desc) => {
    document.getElementById('modal-category-title').textContent = 'Редактировать категорию';
    UI.setFormData('form-category', { id, name, description: desc });
    UI.openModal('modal-category');
  };

  const save = async () => {
    const btn  = document.getElementById('btn-save-category');
    const data = UI.getFormData('form-category');
    if (!data.name) { UI.showFieldError('name', 'Введите название'); return; }
    UI.btnLoading(btn, true);
    try {
      if (data.id) {
        await API.categories.update(data.id, { name: data.name, description: data.description || null });
        UI.toastSuccess('Категория обновлена');
      } else {
        await API.categories.create({ name: data.name, description: data.description || null });
        UI.toastSuccess('Категория добавлена');
      }
      UI.closeModal('modal-category');
      load();
    } catch (err) { UI.toastError(err.message); }
    finally       { UI.btnLoading(btn, false); }
  };

  const remove = async (name) => {
    if (!UI.confirm(`Удалить категорию «${name}»?`)) return;
    try {
      await API.categories.remove(name);
      UI.toastSuccess('Категория удалена');
      load();
    } catch (err) {
      if (err.status === 400) {
        UI.toastError('Невозможно удалить категорию — в ней есть товары. Сначала перенесите их в другую категорию!');
      } else {
        UI.toastError(err.message);
      }
    }
  };

  return { load, openCreate, openEdit, save, remove };
})();

// ═══ ПОЛЬЗОВАТЕЛИ ════════════════════════════════════════════════
const usersModule = (() => {
  let allUsers = [], searchTimer = null;

  const load = async () => {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = UI.renderLoadingRow(5);
    try {
      allUsers = await API.users.list();
      if (!Array.isArray(allUsers)) allUsers = [];
      render(allUsers);
    } catch (err) { tbody.innerHTML = UI.renderEmptyRow(5, 'Ошибка'); UI.toastError(err.message); }
  };

  const render = (items) => {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = items.length ? items.map(u => {
      const isSelf = u.username === currentUser?.username;
      return `<tr>
        <td><strong>${u.username}</strong>${isSelf ? '<span class="badge badge-blue" style="margin-left:6px">Вы</span>' : ''}</td>
        <td>${UI.roleBadge(u.role)}</td>
        <td class="text-muted">${u.phone || '—'}</td>
        <td class="text-muted">${u.last_login ? UI.formatDate(u.last_login) : 'Никогда'}</td>
        <td></td>
      </tr>`;
    }).join('') : UI.renderEmptyRow(5, 'Пользователей нет');
  };

  const onSearch = (val) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = val.trim().toLowerCase();
      render(q ? allUsers.filter(u => u.username.toLowerCase().includes(q)) : allUsers);
    }, 250);
  };

  const openCreate = () => {
    document.getElementById('modal-user-title').textContent = 'Новый пользователь';
    UI.clearForm('form-user');
    document.querySelectorAll('#form-user .field-error').forEach(e => e.textContent = '');
    document.querySelector('#form-user [name="id"]').value = '';
    document.getElementById('pw-required').style.display = 'inline';
    document.getElementById('pw-hint').style.display = 'none';
    UI.openModal('modal-user');
  };

  const save = async () => {
    const btn  = document.getElementById('btn-save-user');
    const data = UI.getFormData('form-user');
    let ok = true;
    if (!data.username) { UI.showFieldError('username', 'Введите логин');  ok = false; }
    if (!data.password) { UI.showFieldError('password', 'Введите пароль'); ok = false; }
    if (!data.role)     { UI.showFieldError('role', 'Выберите роль');      ok = false; }
    if (!ok) return;
    UI.btnLoading(btn, true);
    const body = { username: data.username, password: data.password, phone: data.phone || null };
    try {
      if (data.role === 'worker') await API.users.createWorker(body);
      else                        await API.users.createAdmin(body);
      UI.toastSuccess('Пользователь создан');
      UI.closeModal('modal-user');
      load();
    } catch (err) { UI.toastError(err.message); }
    finally       { UI.btnLoading(btn, false); }
  };

  return { load, onSearch, openCreate, save };
})();

// ═══ ПАГИНАЦИЯ ═══════════════════════════════════════════════════
// Использует именованные методы модулей вместо анонимных колбэков в onclick,
// чтобы корректно работать после сериализации в HTML-атрибут.
function renderPag(cid, received, limit, cur, moduleName) {
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