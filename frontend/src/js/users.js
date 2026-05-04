const API_BASE_URL = 'https://translations-attorney-parliamentary-improvements.trycloudflare.com/api';

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (!token || role !== 'admin') {
    alert("Access denied. You must be an administrator.");
    window.location.href = 'index.html';
    return;
  }

  // UI Elements
  const errorEl = document.getElementById('adminError');
  const successEl = document.getElementById('adminSuccess');
  const logoutBtn = document.getElementById('logoutBtn');

  // Tabs logic
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.add('active');
    });
  });

  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = 'login.html';
  });

  const showMessage = (msg, isError = false) => {
    if (isError) {
      errorEl.textContent = msg;
      errorEl.removeAttribute('hidden');
      successEl.setAttribute('hidden', '');
    } else {
      successEl.textContent = msg;
      successEl.removeAttribute('hidden');
      errorEl.setAttribute('hidden', '');
      setTimeout(() => successEl.setAttribute('hidden', ''), 3000);
    }
  };

  // --- USERS CRUD ---
  let usersPage = 1;
  const usersLimit = 10;
  const usersTbody = document.getElementById('usersTableBody');
  const pageUsersEl = document.getElementById('pageUsers');
  const prevUsersBtn = document.getElementById('prevUsers');
  const nextUsersBtn = document.getElementById('nextUsers');

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/users?page=${usersPage}&limit=${usersLimit}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error loading users');
      
      renderUsers(data.users);
      
      prevUsersBtn.disabled = usersPage === 1;
      nextUsersBtn.disabled = data.users.length < usersLimit;
      pageUsersEl.textContent = `Page ${usersPage}`;
    } catch (err) {
      showMessage(err.message, true);
    }
  };

  const renderUsers = (users) => {
    usersTbody.innerHTML = '';
    if (users.length === 0) {
      usersTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No users.</td></tr>';
      return;
    }

    users.forEach(user => {
      const tr = document.createElement('tr');
      
      const tdId = document.createElement('td');
      tdId.textContent = user.id.split('-')[0] + '...';
      tdId.style.fontSize = '0.85em';
      tdId.style.color = 'var(--muted)';

      const tdEmail = document.createElement('td');
      tdEmail.textContent = user.email;

      const tdRole = document.createElement('td');
      const selectRole = document.createElement('select');
      selectRole.innerHTML = `
        <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
      `;
      selectRole.addEventListener('change', () => updateUserRole(user.id, selectRole.value));
      tdRole.appendChild(selectRole);

      const tdActions = document.createElement('td');
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'btn btn-small btn-danger';
      deleteBtn.addEventListener('click', () => deleteUser(user.id, user.email));
      tdActions.appendChild(deleteBtn);

      tr.append(tdId, tdEmail, tdRole, tdActions);
      usersTbody.appendChild(tr);
    });
  };

  const updateUserRole = async (id, newRole) => {
    try {
      const res = await fetch(`${API_BASE_URL}/users/${id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      if (!res.ok) throw new Error('Error updating role');
      showMessage('Role updated successfully');
    } catch (err) {
      showMessage(err.message, true);
      fetchUsers(); // reset select
    }
  };

  const deleteUser = async (id, email) => {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error during deletion');
      showMessage('User deleted');
      fetchUsers();
    } catch (err) {
      showMessage(err.message, true);
    }
  };

  prevUsersBtn.addEventListener('click', () => { if(usersPage > 1) { usersPage--; fetchUsers(); } });
  nextUsersBtn.addEventListener('click', () => { usersPage++; fetchUsers(); });

  // --- PRODUCTS (BUSINESS ENTITY) CRUD ---
  let productsPage = 1;
  const productsLimit = 10;
  const productsTbody = document.getElementById('productsTableBody');
  const pageProductsEl = document.getElementById('pageProducts');
  const prevProductsBtn = document.getElementById('prevProducts');
  const nextProductsBtn = document.getElementById('nextProducts');
  const createProductForm = document.getElementById('createProductForm');

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/products?page=${productsPage}&limit=${productsLimit}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error loading products');
      
      renderProducts(data.products);
      
      prevProductsBtn.disabled = productsPage === 1;
      nextProductsBtn.disabled = data.products.length < productsLimit;
      pageProductsEl.textContent = `Page ${productsPage}`;
    } catch (err) {
      showMessage(err.message, true);
    }
  };

  const renderProducts = (products) => {
    productsTbody.innerHTML = '';
    if (products.length === 0) {
      productsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No products.</td></tr>';
      return;
    }

    products.forEach(p => {
      const tr = document.createElement('tr');
      
      const tdBarcode = document.createElement('td');
      tdBarcode.textContent = p.barcode;
      
      const tdName = document.createElement('td');
      tdName.textContent = p.name;
      
      const tdBrand = document.createElement('td');
      tdBrand.textContent = p.brand || '-';

      const tdActions = document.createElement('td');
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'btn btn-small btn-danger';
      deleteBtn.addEventListener('click', () => deleteProduct(p.barcode, p.name));
      tdActions.appendChild(deleteBtn);

      tr.append(tdBarcode, tdName, tdBrand, tdActions);
      productsTbody.appendChild(tr);
    });
  };

  createProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      barcode: document.getElementById('pBarcode').value,
      name: document.getElementById('pName').value,
      brand: document.getElementById('pBrand').value || null,
      image_url: null, nutriscore: null, ecoscore: null, ingredients_text: null, additives_count: null
    };

    try {
      const res = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('This product may already exist or server error.');
      
      showMessage('Product (Business Entity) added successfully');
      createProductForm.reset();
      fetchProducts();
    } catch (err) {
      showMessage(err.message, true);
    }
  });

  const deleteProduct = async (barcode, name) => {
    if (!confirm(`Are you sure you want to delete ${name} (${barcode})?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/products/${barcode}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error during deletion');
      showMessage('Product deleted');
      fetchProducts();
    } catch (err) {
      showMessage(err.message, true);
    }
  };

  prevProductsBtn.addEventListener('click', () => { if(productsPage > 1) { productsPage--; fetchProducts(); } });
  nextProductsBtn.addEventListener('click', () => { productsPage++; fetchProducts(); });

  // Init
  fetchUsers();
  fetchProducts();
});
