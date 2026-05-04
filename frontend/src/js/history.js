const API_BASE_URL = 'https://translations-attorney-parliamentary-improvements.trycloudflare.com/api';

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  const authLink = document.getElementById('authLink');
  const adminLink = document.getElementById('adminLink');
  const historyTable = document.getElementById('historyTable');
  const tbody = document.getElementById('historyTableBody');
  const errorEl = document.getElementById('historyError');
  const loginPrompt = document.getElementById('loginPrompt');

  const role = localStorage.getItem('role');

  if (token) {
    authLink.textContent = 'Logout';
    authLink.href = '#';
    authLink.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      window.location.reload();
    });
  } else {
    loginPrompt.removeAttribute('hidden');
    return;
  }

  if (role === 'admin' && adminLink) {
    adminLink.removeAttribute('hidden');
  }

  try {
    const res = await fetch(`${API_BASE_URL}/scans`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('token');
        loginPrompt.removeAttribute('hidden');
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      throw new Error(data.message || 'Impossible de charger l\'historique.');
    }

    historyTable.removeAttribute('hidden');
    tbody.innerHTML = '';

    if (data.scans.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Aucun scan enregistré pour le moment.</td></tr>';
      return;
    }

    data.scans.forEach(scan => {
      const tr = document.createElement('tr');
      
      const tdDate = document.createElement('td');
      const dateObj = new Date(scan.scanned_at);
      tdDate.textContent = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
      tdDate.style.fontSize = '0.9em';
      tdDate.style.color = 'var(--muted)';
      
      const tdBarcode = document.createElement('td');
      tdBarcode.textContent = scan.barcode;
      tdBarcode.style.fontFamily = 'monospace';

      const tdProduct = document.createElement('td');
      tdProduct.textContent = scan.product_name || 'Produit inconnu';
      tdProduct.style.fontWeight = '600';

      tr.appendChild(tdDate);
      tr.appendChild(tdBarcode);
      tr.appendChild(tdProduct);
      tbody.appendChild(tr);
    });
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.removeAttribute('hidden');
  }
});
