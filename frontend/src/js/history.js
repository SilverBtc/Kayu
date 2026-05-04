const API_BASE_URL = 'https://translations-attorney-parliamentary-improvements.trycloudflare.com/api';

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  const authLink = document.getElementById('authLink');
  const historyTable = document.getElementById('historyTable');
  const tbody = document.getElementById('historyTableBody');
  const errorEl = document.getElementById('historyError');
  const loginPrompt = document.getElementById('loginPrompt');

  if (token) {
    authLink.textContent = 'Log out';
    authLink.href = '#';
    authLink.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      window.location.reload();
    });
  } else {
    loginPrompt.removeAttribute('hidden');
    return;
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
        throw new Error('Session expired. Please log in again.');
      }
      throw new Error(data.message || 'Unable to load history.');
    }

    historyTable.removeAttribute('hidden');
    tbody.innerHTML = '';

    if (data.scans.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No scans saved yet.</td></tr>';
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
      tdProduct.textContent = scan.product_name || 'Unknown product';
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