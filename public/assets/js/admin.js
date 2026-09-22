import { request, ApiError } from './modules/api.js';

/**
 * Minimal inbox for GET /api/leads. The token lives in sessionStorage only,
 * so closing the tab forgets it.
 */

const KEY = 'dt.adminToken';

const form = document.querySelector('#token-form');
const input = document.querySelector('#token');
const status = document.querySelector('[data-status]');
const count = document.querySelector('[data-count]');
const wrap = document.querySelector('[data-table-wrap]');
const rows = document.querySelector('[data-rows]');

const setStatus = (message, tone = 'neutral') => {
  status.textContent = message;
  status.className = `mb-6 text-sm ${tone === 'error' ? 'text-red-400' : 'text-mist'}`;
};

const formatDate = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

function renderRows(items) {
  rows.replaceChildren();

  for (const lead of items) {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-edge/60 align-top';

    const cells = [
      { text: formatDate(lead.createdAt), className: 'font-mono text-[12px] text-ash whitespace-nowrap' },
      { text: lead.name, className: 'font-medium' },
      { text: lead.email, className: 'font-mono text-[12px]' },
      { text: lead.plan, className: 'font-mono text-[12px] text-flare-hi uppercase' },
      { text: lead.profileUrl ?? '—', className: 'max-w-[220px] truncate text-[12px] text-mist' },
      { text: lead.message ?? '—', className: 'max-w-[380px] text-[13px] text-mist' },
    ];

    for (const cell of cells) {
      const td = document.createElement('td');
      td.className = `p-3 ${cell.className}`;
      td.textContent = cell.text; // textContent, never innerHTML: this is visitor input
      tr.append(td);
    }

    rows.append(tr);
  }
}

async function load(token) {
  setStatus('Loading…');

  try {
    const data = await request('/api/leads?limit=200', { headers: { 'x-admin-token': token } });

    sessionStorage.setItem(KEY, token);
    renderRows(data.items);
    wrap.hidden = data.items.length === 0;
    count.textContent = `${data.total} total`;
    setStatus(data.items.length ? `Showing ${data.items.length} of ${data.total}.` : 'No leads yet.');
  } catch (error) {
    wrap.hidden = true;
    count.textContent = '—';
    setStatus(
      error instanceof ApiError && error.status === 401
        ? 'That token was rejected.'
        : `Could not load leads: ${error.message}`,
      'error',
    );
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const token = input.value.trim();
  if (!token) {
    setStatus('Paste the admin token first.', 'error');
    return;
  }
  void load(token);
});

document.querySelector('[data-forget]').addEventListener('click', () => {
  sessionStorage.removeItem(KEY);
  input.value = '';
  wrap.hidden = true;
  count.textContent = '—';
  setStatus('Token forgotten.');
});

const saved = sessionStorage.getItem(KEY);
if (saved) {
  input.value = saved;
  void load(saved);
}
