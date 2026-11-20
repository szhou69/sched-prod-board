import { fetchIncidents, ack } from './api.js';

const REFRESH_MS = 2000; // R4

const board = document.querySelector('[data-testid="board"]');
const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');

/** id -> row element. Rows are kept, not rebuilt, so ack state and focus survive a refresh. */
const rows = new Map();
/** ids acked in this session (R2). */
const acked = new Set();

// R5: viewer's locale and time zone. Intl puts day before month for EU locales (dd/mm).
const timeFmt = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
});
const localTime = (iso) => timeFmt.format(new Date(iso));

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function makeRow(i) {
  const li = el('li', { 'data-testid': 'incident-row', 'data-id': i.id, class: `row ${i.severity}` });
  li.append(
    el('span', { class: 'id' }, i.id),
    el('span', { class: 'sev' }, i.severity),
    el('span', { class: 'what' }, `${i.service} · ${i.region} · ${i.summary}`),
    el('time', { datetime: i.openedAt, title: i.openedAt }, localTime(i.openedAt)),
    el('span', { class: 'act' }),
  );
  setAckCell(li, i.id);
  return li;
}

function setAckCell(li, id) {
  const cell = li.querySelector('.act');
  cell.replaceChildren();
  if (acked.has(id)) {
    li.classList.add('is-acked');
    cell.append(el('span', { 'data-testid': 'acked', class: 'acked' }, '✓ acked'));
  } else {
    const btn = el('button', { 'data-testid': 'ack', type: 'button' }, 'Ack');
    btn.addEventListener('click', () => onAck(li, id, btn));
    cell.append(btn);
  }
}

async function onAck(li, id, btn) {
  btn.disabled = true;
  try {
    await ack(id);
    acked.add(id);
    setAckCell(li, id);
  } catch (err) {
    console.error(err);
    btn.disabled = false;
  }
}

// R1: newest first; new incidents go on top; existing rows stay as they are.
function render(incidents) {
  const seen = new Set();
  let prev = null;
  for (const i of incidents) {
    seen.add(i.id);
    let li = rows.get(i.id);
    if (!li) {
      li = makeRow(i);
      rows.set(i.id, li);
    }
    const want = prev ? prev.nextSibling : list.firstChild;
    if (want !== li) list.insertBefore(li, want);
    prev = li;
  }
  for (const [id, li] of rows) {
    if (!seen.has(id)) {
      li.remove();
      rows.delete(id);
    }
  }
  empty.hidden = incidents.length > 0;
  list.hidden = incidents.length === 0;
}

let loaded = false;
async function tick() {
  try {
    const page = await fetchIncidents();
    render(page.incidents);
    if (!loaded) {
      loaded = true;
      loader.remove(); // R3: gone once incidents load
      board.setAttribute('aria-busy', 'false');
    }
  } catch (err) {
    console.error(err);
  } finally {
    setTimeout(tick, REFRESH_MS); // R4
  }
}

tick();
