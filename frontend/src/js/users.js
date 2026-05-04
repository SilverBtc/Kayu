const API_BASE_URL = 'https://translations-attorney-parliamentary-improvements.trycloudflare.com/api';

document.addEventListener('DOMContentLoaded', async () => {
  const tbody = document.getElementById('usersTableBody');
  const errorEl = document.getElementById('usersError');

  try {
    const res = await fetch(`${API_BASE_URL}/users`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Unable to load users.');
    }

    tbody.innerHTML = '';

    if (data.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" style="text-align: center;">No users found.</td></tr>';
      return;
    }

    data.users.forEach(user => {
      const tr = document.createElement('tr');
      
      const tdName = document.createElement('td');
      tdName.textContent = user.username;
      
      const tdId = document.createElement('td');
      tdId.textContent = user.id.split('-')[0] + '...';
      tdId.style.color = 'var(--muted)';
      tdId.style.fontSize = '0.9em';

      tr.appendChild(tdName);
      tr.appendChild(tdId);
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = '';
    errorEl.textContent = err.message;
    errorEl.removeAttribute('hidden');
  }
});