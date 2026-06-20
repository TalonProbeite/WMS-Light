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

  const get  = (path)       => request('GET',    path);
  const post = (path, body) => request('POST',   path, body);
  const put  = (path, body) => request('PUT',    path, body);
  const del  = (path)       => request('DELETE', path);

  // POST /users/login        → { username, role }
  // POST /users/workers      → { success: true }   (admin, superadmin)
  // POST /users/admins       → { success: true }   (superadmin only)
  // GET  /users/             → [UserInfo]           (admin, superadmin)
  // GET  /users/workers      → [UserInfo]
  // GET  /users/admins       → [UserInfo]
  // GET  /users/search?username=  → UserInfo
  const auth = {
    login: async (username, password) => {
      const data = await post('/users/login', { username, password });
      saveUser({ username: data.username, role: data.role });
      return data;
    },
    logout: () => {
      clearUser();
      window.location.href = '/index.html';
    },
  };

  const users = {
    list:         ()         => get('/users/'),
    listWorkers:  ()         => get('/users/workers'),
    listAdmins:   ()         => get('/users/admins'),
    search:       (username) => get(`/users/search?username=${encodeURIComponent(username)}`),
    createWorker: (body)     => post('/users/workers', body), // { username, password, phone? }
    createAdmin:  (body)     => post('/users/admins',  body), // { username, password, phone? }
  };

  // POST /products/create    { name, sku, qr_code_uuid, category_id?, category_name?, initial_quantity?, description? }
  // GET  /products/          [ProductDetail]  ?limit&offset&search&category_id&category_name&sort_by&sort_order
  // GET  /products/single    ProductDetail    ?product_id=  |  ?name=
  const products = {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return get(`/products/${q ? '?' + q : ''}`);
    },
    single: (params = {}) => {
      return get(`/products/single?${new URLSearchParams(params).toString()}`);
    },
    create: (body) => post('/products/create', body),
  };

  const categories = {
    list:   ()           => get('/categories'),
    create: (body)       => post('/categories', body),
    update: (id, body)   => put(`/categories/${id}`, body),
    remove: (id)         => del(`/categories/${id}`),
  };

  // POST /transactions/create     { quantity, transaction_type, product_id }
  // GET  /transactions/           история текущего юзера  (все роли)
  // GET  /transactions/get_all    история всех юзеров     (admin, superadmin)
  // GET  /transactions/user       история конкретного     (admin, superadmin)  ?user_name=
  // Общие параметры: limit, offset, date_from, date_to, sort_order
  const _txParams = (p) => {
    const out = {};
    if (p.limit)      out.limit      = p.limit;
    if (p.offset)     out.offset     = p.offset;
    if (p.date_from)  out.date_from  = p.date_from;
    if (p.date_to)    out.date_to    = p.date_to;
    if (p.sort_order) out.sort_order = p.sort_order;
    return out;
  };

  const transactions = {
    my: (params = {}) => {
      const q = new URLSearchParams(_txParams(params)).toString();
      return get(`/transactions/${q ? '?' + q : ''}`);
    },
    all: (params = {}) => {
      const q = new URLSearchParams(_txParams(params)).toString();
      return get(`/transactions/get_all${q ? '?' + q : ''}`);
    },
    byUser: (userName, params = {}) => {
      const p = _txParams(params);
      p.user_name = userName;
      return get(`/transactions/user?${new URLSearchParams(p).toString()}`);
    },
    create: (body) => post('/transactions/create', {
      quantity:         body.quantity,
      transaction_type: body.transaction_type,
      product_id:       body.product_id,
    }),
  };

  return { getUser, clearUser, auth, users, categories, products, transactions };
})();