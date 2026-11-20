import { fetchIncidents, ack } from './api.js';

const REFRESH_MS = 2000; // R4

const board = document.querySelector('[data-testid="board"]');
const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const newBar = document.querySelector('[data-testid="new-bar"]');

/** id -> row element. Rows on screen are never moved or removed by a refresh (R1). */
const rows = new Map();
/** Incidents that arrived after the list was shown, newest first, waiting behind the "N new" bar (R7). */
let pending = [];
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
    const btn = el('button', { 'data-testid': 'ack', type: 'button', 'aria-label': `Ack ${id}` }, 'Ack');
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

/** Puts incidents (newest first) on top of the list, above the rows already there. */
function prepend(incidents) {
  const first = list.firstChild;
  for (const i of incidents) {
    const li = makeRow(i);
    rows.set(i.id, li);
    list.insertBefore(li, first);
  }
  syncEmpty();
}

function syncEmpty() {
  const none = rows.size === 0;
  empty.hidden = !none;
  list.hidden = none;
}

function syncBar() {
  const n = pending.length;
  newBar.hidden = n === 0;
  newBar.textContent = n === 1 ? '1 new incident · show' : `${n} new incidents · show`;
}

// R7: new incidents wait behind the bar; one click brings them in on top. Rows on screen hold still.
newBar.addEventListener('click', () => {
  const incoming = pending;
  pending = [];
  syncBar();
  prepend(incoming);
});

function take(page) {
  if (rows.size === 0 && pending.length === 0) {
    // First answer with incidents (or none yet): show them as the list.
    prepend(page.incidents);
    return;
  }
  const known = new Set([...rows.keys(), ...pending.map((i) => i.id)]);
  const fresh = page.incidents.filter((i) => !known.has(i.id));
  if (fresh.length) {
    pending = [...fresh, ...pending];
    syncBar();
  }
}

let loaded = false;
async function tick() {
  try {
    const page = await fetchIncidents();
    take(page);
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
