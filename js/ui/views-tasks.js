// Tareas de los socios: lista con filtros, agregar rápido, marcar hecha
// (queda tachada) y el cuadro de pendientes del Resumen.
import { formatDate, formatDateTime, localDate } from '../core/dates.js';
import { saveTask, TASK_FILTERS, taskDueIn, taskList, taskSummary, tasksOf } from '../domain/tasks.js';
import { getState } from '../store/store.js';
import { empty, esc, exec, field, openModal } from './dom.js';
import { icon } from './icons.js';
import { phLogo } from './views-pethome.js';

const S = () => getState();
const socioName = (id) => S().socios.find((x) => x.id === id)?.nombre || 'Socio';

function dueLabel(t, today) {
  const d = taskDueIn(t, today);
  if (d === null) return '';
  if (t.done) return `era para el ${formatDate(t.dueDate)}`;
  if (d < 0) return `<b class="danger">vencida hace ${-d} día${d === -1 ? '' : 's'}</b>`;
  if (d === 0) return '<b class="warn-text">es para hoy</b>';
  if (d === 1) return 'es para mañana';
  return `para el ${formatDate(t.dueDate)} (en ${d} días)`;
}

function taskRow(t, today) {
  const meta = [
    t.owner ? `Le toca a ${esc(socioName(t.owner))}` : 'Cualquiera de los dos',
    dueLabel(t, today),
    t.done ? `hecha por ${esc(t.doneBy || 'un socio')} · ${formatDateTime(t.doneAt)}` : `anotó ${esc(t.createdBy || 'un socio')}`,
  ].filter(Boolean);
  const late = !t.done && t.dueDate && t.dueDate < today;
  return `<li class="task${t.done ? ' done' : ''}${late ? ' late' : ''}">
    <button type="button" class="task-check" data-act="task-toggle" data-id="${t.id}" role="checkbox" aria-checked="${t.done}" aria-label="${t.done ? 'Volver a abrir' : 'Marcar como hecha'}: ${esc(t.text)}">${icon('check', { size: 16 })}</button>
    <div class="task-main"><b>${esc(t.text)}</b>${t.details ? `<p>${esc(t.details)}</p>` : ''}<small>${meta.join(' · ')}</small></div>
    <button type="button" class="icon-btn" data-act="task-edit" data-id="${t.id}" aria-label="Editar: ${esc(t.text)}">${icon('sliders', { size: 16 })}</button>
  </li>`;
}

export function renderTareas(params) {
  const today = localDate();
  const me = S().me;
  const f = TASK_FILTERS[params.get('f')] ? params.get('f') : 'pendientes';
  const sum = taskSummary(S(), { meId: me.id, today });
  const counts = { pendientes: sum.pending, mias: sum.mine, hechas: sum.done, todas: sum.pending + sum.done };
  const list = taskList(S(), { filter: f, meId: me.id });
  const emptyText = {
    pendientes: ['No hay nada pendiente', 'Anota aquí lo que tienen por hacer. Tu socio lo ve en su celular.'],
    mias: ['Nada para ti', 'Las tareas que son para ti o para cualquiera de los dos aparecen aquí.'],
    hechas: ['Aún no han tachado nada', 'Cuando marquen una tarea como hecha, queda aquí tachada.'],
    todas: ['Aún no hay tareas', 'Anota la primera arriba.'],
  }[f];
  return `<div class="page-head ph-head"><div class="ph-title">${phLogo(46)}<div><p class="eyebrow">Pendientes de los socios</p><h1>Tareas</h1></div></div>
    <button class="btn btn-primary btn-small" data-act="task-new">${icon('plus', { size: 16 })} Con detalles</button></div>
  <form class="task-quick" data-form="task-quick" novalidate>
    <label for="task-q" class="sr-only">Nueva tarea</label>
    <input id="task-q" name="text" maxlength="200" autocomplete="off" placeholder="Ej. Pedir cotización de bolsas" required>
    <button class="btn btn-primary" type="submit">Anotar</button>
  </form>
  ${sum.overdue ? `<div class="notice warn">${icon('alert', { size: 16 })} ${sum.overdue} tarea(s) vencida(s).</div>` : ''}
  <div class="chips">${Object.entries(TASK_FILTERS).map(([k, l]) => `<a class="chip ${f === k ? 'active' : ''}" href="#/tareas?f=${k}">${l} <span>${counts[k]}</span></a>`).join('')}</div>
  ${list.length ? `<ul class="tasks">${list.map((t) => taskRow(t, today)).join('')}</ul>` : empty('clipboard', emptyText[0], emptyText[1])}
  ${f === 'hechas' && list.length ? '<div class="row-gap"><button class="btn btn-plain btn-small" data-act="task-clear">Borrar las hechas</button></div>' : ''}`;
}

/** Cuadro del Resumen: hasta 4 pendientes, las más urgentes primero. */
export function tasksCard() {
  const today = localDate();
  const open = taskList(S(), { filter: 'pendientes' });
  const sum = taskSummary(S(), { meId: S().me.id, today });
  if (!tasksOf(S()).length) {
    return `<section class="panel"><div class="panel-head"><h2>Tareas</h2><a class="btn btn-plain btn-small" href="#/tareas">Abrir</a></div><p class="muted small">Anoten aquí lo que tienen pendiente y táchenlo cuando lo hagan.</p></section>`;
  }
  return `<section class="panel"><div class="panel-head"><h2>Tareas pendientes <small class="muted">${sum.pending}${sum.overdue ? ` · <span class="danger">${sum.overdue} vencida(s)</span>` : ''}</small></h2><a class="btn btn-plain btn-small" href="#/tareas">Ver todas</a></div>
    ${open.length ? `<ul class="tasks compact">${open.slice(0, 4).map((t) => taskRow(t, today)).join('')}</ul>` : '<p class="muted small">Todo al día. 🎉</p>'}</section>`;
}

export function taskForm(existing = null) {
  const x = existing || {};
  const owners = [{ value: '', label: 'Cualquiera de los dos' }, ...S().socios.map((so) => ({ value: so.id, label: so.nombre }))];
  openModal({
    title: existing ? 'Editar tarea' : 'Nueva tarea',
    subtitle: existing ? `Anotó ${esc(x.createdBy || 'un socio')} · ${formatDateTime(x.createdAt)}` : 'Tu socio la ve en su celular en cuanto se sincronice.',
    body: `<div class="grid2">
      ${field({ name: 'text', label: '¿Qué hay que hacer?', value: x.text, required: true, full: true, attrs: 'maxlength="200"' })}
      ${field({ name: 'owner', label: '¿A quién le toca?', type: 'select', value: x.owner || '', options: owners })}
      ${field({ name: 'dueDate', label: 'Fecha límite (opcional)', type: 'date', value: x.dueDate || '' })}
      ${field({ name: 'details', label: 'Detalles (opcional)', type: 'textarea', value: x.details, full: true, placeholder: 'Ej. Proveedor, teléfono, cantidades…' })}
      ${existing ? `<div class="field full"><button type="button" class="btn btn-plain btn-small danger" data-act="task-delete" data-id="${x.id}">Borrar esta tarea</button></div>` : ''}
    </div>`,
    submitText: existing ? 'Guardar' : 'Anotar',
    onSubmit: async (fd) => ((await exec(saveTask, { id: x.id, text: fd.get('text'), owner: fd.get('owner'), dueDate: fd.get('dueDate') || null, details: fd.get('details') }, { success: existing ? 'Tarea actualizada' : 'Tarea anotada' })) ? undefined : false),
  });
}
