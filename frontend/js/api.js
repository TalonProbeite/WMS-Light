const API = (() => {
  const BASE_URL = '/api';

  const saveUser  = (u) => localStorage.setItem('wh_user', JSON.stringify(u));
  const clearUser = ()  => localStorage.removeItem('wh_user');
  const getUser   = ()  => { try { return JSON.parse(localStorage.getItem('wh_user')); } catch { return null; } };

  const request = async (method, path, body = null) => {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE_URL}${path}`, opts);

    if (res.status === 401 || res.status === 403) {
      clearUser();
      if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        window.location.href = '/index.html';
      }
      const err = new Error('Сессия истекла. Войдите снова.');
      err.status = res.status;
      throw err;
    }

    if (res.status === 204) return null;

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.detail || data.message || data.error || `Ошибка ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  };

  const get   = (path)       => request('GET',    path);
  const post  = (path, body) => request('POST',   path, body);
  const put   = (path, body) => request('PUT',    path, body);
  const patch = (path, body) => request('PATCH',  path, body);
  const del   = (path)       => request('DELETE', path);

  const auth = {
    login: async (username, password) => {
      const data = await post('/users/login', { username, password });
      saveUser({ username: data.username, role: data.role });
      return data;
    },
    me:     () => get('/users/me'),
    logout: async () => {
      try { await post('/users/logout', {}); } catch {}
      clearUser();
      window.location.href = '/index.html';
    },
  };

  const users = {
    list:         ()              => get('/users/'),
    listWorkers:  ()              => get('/users/workers'),
    listAdmins:   ()              => get('/users/admins'),
    search:       (username)      => get(`/users/search?username=${encodeURIComponent(username)}`),
    createWorker: (body)          => post('/users/workers', body),
    createAdmin:  (body)          => post('/users/admins',  body),
    // PATCH /users/update_info?user_id=N  { username?, phone? }  (admin, superadmin)
    updateInfo:   (userId, body)  => patch(`/users/update_info?user_id=${userId}`, body),
    // PATCH /users/update_role?user_id=N  { role: 'worker'|'admin' }  (superadmin only)
    updateRole:   (userId, body)  => patch(`/users/update_role?user_id=${userId}`, body),
    // DELETE /users/{user_id}  (superadmin only)
    remove:       (userId)        => del(`/users/${userId}`),
  };

  const products = {
    list:   (params = {}) => { const q = new URLSearchParams(params).toString(); return get(`/products/${q ? '?' + q : ''}`); },
    single: (params = {}) => get(`/products/single?${new URLSearchParams(params).toString()}`),
    create: (body)        => post('/products/create', body),
    update: (id, body)    => patch(`/products/${id}`, body),
    remove: (id)          => del(`/products/${id}`),
  };

  const categories = {
    list:   ()           => get('/categories/'),
    create: (body)       => post('/categories/create', body),
    update: (id, body)   => put(`/categories/${id}`, body),
    remove: (name)       => del(`/categories/${encodeURIComponent(name)}`),
  };

  // Строго: transaction_type = 'incoming' | 'outgoing'
  const _txParams = (p) => {
    const out = {};
    if (p.limit)            out.limit            = p.limit;
    if (p.offset)           out.offset           = p.offset;
    if (p.date_from)        out.date_from        = p.date_from;
    if (p.date_to)          out.date_to          = p.date_to;
    if (p.sort_order)       out.sort_order       = p.sort_order;
    if (p.transaction_type) out.transaction_type = p.transaction_type;
    return out;
  };

  const transactions = {
    // GET /transactions/my — своя история (worker, admin, superadmin)
    // Ответ: [{ username, product_name, quantity, transaction_type, created_at }]
    my: (params = {}) => {
      const q = new URLSearchParams(_txParams(params)).toString();
      return get(`/transactions/my${q ? '?' + q : ''}`);
    },
    // GET /transactions/ — все транзакции (только admin, superadmin)
    // Ответ: тот же формат с username и product_name
    all: (params = {}) => {
      const q = new URLSearchParams(_txParams(params)).toString();
      return get(`/transactions/${q ? '?' + q : ''}`);
    },
    // GET /transactions/user?user_name= (только admin, superadmin)
    byUser: (userName, params = {}) => {
      const p = _txParams(params);
      p.user_name = userName;
      return get(`/transactions/user?${new URLSearchParams(p).toString()}`);
    },
    // POST /transactions/create { quantity, transaction_type: 'incoming'|'outgoing', product_id }
    create: (body) => post('/transactions/create', {
      quantity:         body.quantity,
      transaction_type: body.transaction_type,
      product_id:       body.product_id,
    }),
  };

  // GET /dashboard/stats → { total_products, out_of_stock_products, total_categories }
  // Только admin, superadmin
  const dashboard = {
    stats: () => get('/dashboard/stats'),
  };

  return { getUser, clearUser, auth, users, categories, products, transactions, dashboard };
})();