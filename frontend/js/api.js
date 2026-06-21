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

  const auth = {
    // POST /users/login → { username, role }
    login: async (username, password) => {
      const data = await post('/users/login', { username, password });
      saveUser({ username: data.username, role: data.role });
      return data;
    },
    // GET /users/me → { username, role, phone, last_login }
    // Используется для проверки живости сессии (кука валидна?)
    me: () => get('/users/me'),
    logout: () => {
      clearUser();
      window.location.href = '/index.html';
    },
  };

  const users = {
    // GET /users/              → [UserInfo]
    list:         ()         => get('/users/'),
    // GET /users/workers       → [UserInfo]
    listWorkers:  ()         => get('/users/workers'),
    // GET /users/admins        → [UserInfo]
    listAdmins:   ()         => get('/users/admins'),
    // GET /users/search?username=
    search:       (username) => get(`/users/search?username=${encodeURIComponent(username)}`),
    // POST /users/workers  { username, password, phone? }  (admin, superadmin)
    createWorker: (body)     => post('/users/workers', body),
    // POST /users/admins   { username, password, phone? }  (superadmin only)
    createAdmin:  (body)     => post('/users/admins',  body),
  };

  const products = {
    // GET /products/?limit&offset&search&category_id&category_name&sort_by&sort_order
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return get(`/products/${q ? '?' + q : ''}`);
    },
    // GET /products/single?product_id=  |  ?name=
    single: (params = {}) => {
      return get(`/products/single?${new URLSearchParams(params).toString()}`);
    },
    // POST /products/create
    create: (body) => post('/products/create', body),
  };

  const categories = {
    // GET /categories/  → [{ id, name, description }]  — весь список, без пагинации
    list: () => get('/categories/'),
    // POST /categories/create  { name, description? }
    create: (body) => post('/categories/create', body),
    // PUT /categories/{cat_id}  { name, description? }
    update: (id, body) => put(`/categories/${id}`, body),
    // DELETE /categories/{cat_name}  — удаление по ИМЕНИ, не по ID
    // 400 если в категории ещё есть товары
    remove: (name) => del(`/categories/${encodeURIComponent(name)}`),
  };

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
    // GET /transactions/  — своя история (все роли)
    my: (params = {}) => {
      const q = new URLSearchParams(_txParams(params)).toString();
      return get(`/transactions/${q ? '?' + q : ''}`);
    },
    // GET /transactions/get_all  — история всех (admin, superadmin)
    all: (params = {}) => {
      const q = new URLSearchParams(_txParams(params)).toString();
      return get(`/transactions/get_all${q ? '?' + q : ''}`);
    },
    // GET /transactions/user?user_name=  (admin, superadmin)
    byUser: (userName, params = {}) => {
      const p = _txParams(params);
      p.user_name = userName;
      return get(`/transactions/user?${new URLSearchParams(p).toString()}`);
    },
    // POST /transactions/create  { quantity, transaction_type, product_id }
    create: (body) => post('/transactions/create', {
      quantity:         body.quantity,
      transaction_type: body.transaction_type,
      product_id:       body.product_id,
    }),
  };

  return { getUser, clearUser, auth, users, categories, products, transactions };
})();