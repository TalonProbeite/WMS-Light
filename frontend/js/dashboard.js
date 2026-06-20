let currentUser = null;

(async () => {
  const user = API.getUser();
  if (!user) { window.location.href = '/index.html'; return; }
  if (user.role === 'worker') { window.location.href = '/worker.html'; return; }

  currentUser = user;
  document.getElementById('sidebar-username').textContent = user.username;
  document.getElementById('sidebar-role').textContent     = UI.roleLabel(user.role);
  document.getElementById('sidebar-avatar').textContent   = user.username[0].toUpperCase();

  // Суперадмин видит опцию создания admin, обычный admin — только worker
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
    btn.onclick = txModule.openCreate;
    actions.appendChild(btn);
  }

  switch (section) {
    case 'overview':     overviewModule.load();   break;
    case 'stock':        stockModule.load();      break;
    case 'transactions': txModule.load();         break;
    case 'products':     productsModule.init();   break;
    case 'categories':   categoriesModule.load(); break;
    case 'users':        usersModule.load();      break;
  }
}

// ─── ОБЗОР ────────────────────────────────────────────────────
// Использует GET /products/ и GET /transactions/my (единственная доступная ручка истории)
const overviewModule = {
  async load() {
    try {
      const [prodData, txData, catData] = await Promise.all([
        API.products.list({ limit: 100 }),
        API.transactions.all({ limit: 100, sort_order: 'desc' }),
        API.categories.list(),
      ]);
      const prods = Array.isArray(prodData) ? prodData : [];
      const txs   = Array.isArray(txData)   ? txData   : [];
      const cats  = Array.isArray(catData)  ? catData  : [];

      const today   = new Date().toISOString().slice(0, 10);
      const todayTx = txs.filter(t => (t.created_at || '').startsWith(today));
      const zero    = prods.filter(p => p.quantity === 0);

      document.getElementById('stat-products').textContent   = prods.length;
      document.getElementById('stat-categories').textContent = cats.length;
      document.getElementById('stat-today').textContent      = todayTx.length;
      document.getElementById('stat-zero').textContent       = zero.length;

      // Строим быстрый словарь product_id → name из уже загруженных продуктов
      const prodMap = {};
      prods.forEach(p => { prodMap[p.id] = p.name; });

      const tbody = document.getElementById('recent-tx-tbody');
      tbody.innerHTML = txs.length
        ? txs.slice(0, 10).map(t => `
          <tr>
            <td>${UI.formatDate(t.created_at)}</td>
            <td>${prodMap[t.product_id] || '#' + t.product_id}</td>
            <td>${UI.txTypeBadge(t.transaction_type)}</td>
            <td>${t.quantity}</td>
            <td>ID ${t.user_id}</td>
          </tr>`).join('')
        : UI.renderEmptyRow(5, 'Операций пока нет');
    } catch (err) {
      UI.toastError('Ошибка загрузки: ' + err.message);
    }
  }
};

// ─── ОСТАТКИ ──────────────────────────────────────────────────
// Данные берём из GET /products/ — там есть поле quantity
const stockModule = (() => {
  let offset = 0; const LIMIT = 20;
  let timer = null;
  let sortBy = 'name', sortOrder = 'asc';

  const load = async () => {
    const search  = document.getElementById('stock-search')?.value.trim();
    const lowOnly = document.getElementById('stock-low')?.checked;
    const tbody   = document.getElementById('stock-tbody');
    tbody.innerHTML = UI.renderLoadingRow(6);
    try {
      const params = { limit: LIMIT, offset, sort_by: sortBy, sort_order: sortOrder };
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
            <button class="btn btn-secondary btn-sm"
              onclick="productsModule.openDetail(${p.id})">Карточка</button>
          </div></td>
        </tr>`;
      }).join('') : UI.renderEmptyRow(6, 'Позиции не найдены');

      renderPagination('stock-pagination', list.length, LIMIT, offset / LIMIT + 1,
        pg => { offset = (pg - 1) * LIMIT; load(); });
    } catch (err) {
      tbody.innerHTML = UI.renderEmptyRow(6, 'Ошибка загрузки');
      UI.toastError(err.message);
    }
  };

  const onSearch = () => { clearTimeout(timer); timer = setTimeout(() => { offset = 0; load(); }, 350); };
  const onLow    = () => { offset = 0; load(); };
  const sortByFn = (field) => {
    sortOrder = (sortBy === field && sortOrder === 'asc') ? 'desc' : 'asc';
    sortBy = field; offset = 0; load();
  };

  return { load, onSearch, onLow, sortBy: sortByFn };
})();

// ─── ТРАНЗАКЦИИ ───────────────────────────────────────────────
// GET /transactions/my        — если фильтр по юзеру не задан
// GET /transactions/user?user_name= — если задан конкретный юзер (admin+)
// Ответ не содержит product_name — подгружаем карту продуктов отдельно
const txModule = (() => {
  let offset = 0; const LIMIT = 25;
  let userTimer = null, pendingUser = '';
  let prodMap = {}; // product_id → name, кешируем

  const loadProdMap = async () => {
    try {
      const list = await API.products.list({ limit: 100 });
      if (Array.isArray(list)) list.forEach(p => { prodMap[p.id] = p.name; });
    } catch {}
  };

  const load = async () => {
    const from  = document.getElementById('tx-from')?.value;
    const to    = document.getElementById('tx-to')?.value;
    const tbody = document.getElementById('tx-tbody');
    tbody.innerHTML = UI.renderLoadingRow(6);

    // Подгружаем карту продуктов если пустая
    if (!Object.keys(prodMap).length) await loadProdMap();

    try {
      const params = { limit: LIMIT, offset, sort_order: 'desc' };
      if (from) params.date_from = from + 'T00:00:00';
      if (to)   params.date_to   = to   + 'T23:59:59';

      // Если задан фильтр по юзеру — используем /transactions/user, иначе /transactions/my
      let list;
      if (pendingUser) {
        list = await API.transactions.byUser(pendingUser, params);
      } else {
        list = await API.transactions.all(params);
      }
      if (!Array.isArray(list)) list = [];

      tbody.innerHTML = list.length ? list.map(t => `
        <tr>
          <td>${UI.formatDate(t.created_at)}</td>
          <td>${prodMap[t.product_id] || `#${t.product_id}`}</td>
          <td>${UI.txTypeBadge(t.transaction_type)}</td>
          <td><strong>${t.quantity}</strong></td>
          <td>#${t.user_id}</td>
        </tr>`).join('') : UI.renderEmptyRow(5, 'Операций не найдено');

      renderPagination('tx-pagination', list.length, LIMIT, offset / LIMIT + 1,
        pg => { offset = (pg - 1) * LIMIT; load(); });
    } catch (err) {
      tbody.innerHTML = UI.renderEmptyRow(5, err.status === 404 ? 'Пользователь не найден' : 'Ошибка загрузки');
    }
  };

  const onUserFilter = (val) => {
    clearTimeout(userTimer);
    userTimer = setTimeout(() => { pendingUser = val.trim(); offset = 0; load(); }, 500);
  };

  const openCreate = async () => {
    UI.clearForm('form-tx');
    document.querySelectorAll('#form-tx .field-error').forEach(e => e.textContent = '');
    document.getElementById('tx-stock-hint').style.display = 'none';
    try {
      let list = await API.products.list({ limit: 100, sort_by: 'name' });
      if (!Array.isArray(list)) list = [];
      // Обновляем карту заодно
      list.forEach(p => { prodMap[p.id] = p.name; });

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
      prodMap = {}; // сбрасываем кеш — остатки изменились
      load();
    } catch (err) { UI.toastError(err.message); }
    finally       { UI.btnLoading(btn, false); }
  };

  return { load, onUserFilter, openCreate, save };
})();

// ─── ТОВАРЫ ───────────────────────────────────────────────────
const productsModule = (() => {
  let offset = 0; const LIMIT = 20;
  let timer = null, catsList = [];

  const init = async () => {
    try {
      catsList = await API.categories.list();
      if (!Array.isArray(catsList)) catsList = [];
      const f = document.getElementById('prod-cat-filter');
      f.innerHTML = '<option value="">Все категории</option>';
      catsList.forEach(c => f.innerHTML += `<option value="${c.id}">${c.name}</option>`);
    } catch {}
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
      const params = { limit: LIMIT, offset, sort_by: sortBy, sort_order: sortOrd };
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
          <td class="text-muted" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.description || '—'}</td>
          <td><div class="td-actions">
            <button class="btn btn-secondary btn-sm" onclick="productsModule.openDetail(${p.id})">Карточка</button>
          </div></td>
        </tr>`;
      }).join('') : UI.renderEmptyRow(6, 'Товары не найдены');

      renderPagination('prod-pagination', list.length, LIMIT, offset / LIMIT + 1,
        pg => { offset = (pg - 1) * LIMIT; load(); });
    } catch (err) {
      tbody.innerHTML = UI.renderEmptyRow(6, 'Ошибка загрузки');
      UI.toastError(err.message);
    }
  };

  const onSearch = () => { clearTimeout(timer); timer = setTimeout(() => { offset = 0; load(); }, 350); };

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

  const openCreate = () => {
    document.getElementById('modal-product-title').textContent = 'Новый товар';
    UI.clearForm('form-product');
    document.querySelectorAll('#form-product .field-error').forEach(e => e.textContent = '');
    fillCatSel();
    document.querySelector('#form-product [name="qr_code_uuid"]').value = genUUID();
    document.querySelector('#form-product [name="initial_quantity"]').value = '0';
    setFieldsDisabled(false);
    UI.openModal('modal-product');
  };

  // GET /products/single?product_id=N
  const openDetail = async (id) => {
    document.getElementById('modal-product-title').textContent = 'Карточка товара';
    try {
      const p = await API.products.single({ product_id: id });
      fillCatSel();
      UI.setFormData('form-product', {
        id: p.id, name: p.name, sku: p.sku, qr_code_uuid: p.qr_code_uuid,
        category_id: p.category_id || '', description: p.description || '',
        initial_quantity: p.quantity,
      });
      setFieldsDisabled(true);
      UI.openModal('modal-product');
    } catch (err) { UI.toastError(err.message); }
  };

  // POST /products/create
  const save = async () => {
    setFieldsDisabled(false);
    const btn  = document.getElementById('btn-save-product');
    const data = UI.getFormData('form-product');
    let ok = true;
    if (!data.name)         { UI.showFieldError('name', 'Введите название');     ok = false; }
    if (!data.sku)          { UI.showFieldError('sku', 'Введите артикул');       ok = false; }
    if (!data.qr_code_uuid) { UI.showFieldError('qr_code_uuid', 'Введите UUID'); ok = false; }
    if (!ok) return;
    UI.btnLoading(btn, true);
    const body = {
      name: data.name, sku: data.sku, qr_code_uuid: data.qr_code_uuid,
      description: data.description || null,
      initial_quantity: parseInt(data.initial_quantity || 0),
    };
    if (data.category_id) body.category_id = parseInt(data.category_id);
    try {
      await API.products.create(body);
      UI.toastSuccess('Товар добавлен');
      UI.closeModal('modal-product');
      load();
    } catch (err) { UI.toastError(err.message); }
    finally       { UI.btnLoading(btn, false); }
  };

  document.getElementById('modal-product').addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
      setFieldsDisabled(false);
    }
  });

  return { init, load, onSearch, openCreate, openDetail, save };
})();

// ─── КАТЕГОРИИ ────────────────────────────────────────────────
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
            <button class="btn btn-danger btn-sm" onclick="categoriesModule.remove(${c.id},'${c.name.replace(/'/g,"\\'")}')">Удал.</button>
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
      if (data.id) { await API.categories.update(data.id, { name: data.name, description: data.description }); UI.toastSuccess('Обновлено'); }
      else         { await API.categories.create({ name: data.name, description: data.description });          UI.toastSuccess('Добавлено'); }
      UI.closeModal('modal-category');
      load();
    } catch (err) { UI.toastError(err.message); }
    finally       { UI.btnLoading(btn, false); }
  };

  const remove = async (id, name) => {
    if (!UI.confirm(`Удалить категорию «${name}»?`)) return;
    try { await API.categories.remove(id); UI.toastSuccess('Удалено'); load(); }
    catch (err) { UI.toastError(err.message); }
  };

  return { load, openCreate, openEdit, save, remove };
})();

// ─── ПОЛЬЗОВАТЕЛИ ─────────────────────────────────────────────
// GET /users/workers + /users/admins — объединяем

const usersModule = (() => {
  let allUsers = [], searchTimer = null;

  const load = async () => {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = UI.renderLoadingRow(5);
    try {
      allUsers = await API.users.list(); 
      render(allUsers);
    } catch (err) { tbody.innerHTML = UI.renderEmptyRow(5, 'Ошибка'); UI.toastError(err.message); }
  };

  const render = (items) => {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = items.length ? items.map(u => {
      const isSelf = u.username === currentUser?.username;
      return `<tr>
        <td>
          <strong>${u.username}</strong>
          ${isSelf ? '<span class="badge badge-blue" style="margin-left:6px">Вы</span>' : ''}
        </td>
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

// ─── ПАГИНАЦИЯ ────────────────────────────────────────────────
function renderPagination(cid, count, limit, cur, cb) {
  const el = document.getElementById(cid);
  if (!el) return;
  const pages = Math.ceil(count / limit) || 1;
  if (pages <= 1) { el.innerHTML = ''; return; }
  let h = `<span class="text-muted" style="font-size:0.78rem;margin-right:8px">Стр. ${cur}</span>`;
  h += `<button class="page-btn" ${cur===1?'disabled':''} onclick="(${cb.toString()})(${cur-1})">‹</button>`;
  const s = Math.max(1, cur-2), e = Math.min(pages, cur+2);
  if (s > 1) h += `<button class="page-btn" onclick="(${cb.toString()})(1)">1</button>`;
  if (s > 2) h += `<span style="padding:0 4px">…</span>`;
  for (let p = s; p <= e; p++) h += `<button class="page-btn ${p===cur?'active':''}" onclick="(${cb.toString()})(${p})">${p}</button>`;
  if (e < pages-1) h += `<span style="padding:0 4px">…</span>`;
  if (e < pages)   h += `<button class="page-btn" onclick="(${cb.toString()})(${pages})">${pages}</button>`;
  h += `<button class="page-btn" ${cur===pages?'disabled':''} onclick="(${cb.toString()})(${cur+1})">›</button>`;
  el.innerHTML = h;
}