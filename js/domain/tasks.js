// Tareas de los socios: lo que hay pendiente por hacer, quién lo anotó, para
// quién es y cuándo se hizo. Se guardan junto a las notas (tipo "nota" con
// kind "tarea") para que un celular con la versión 1.2 las conserve intactas
// aunque no las muestre.
import { newId } from '../core/ids.js';
import { diffDays, isValidDate, localDate } from '../core/dates.js';
import { assert, audit, cleanText, getOrFail, nowOf } from './common.js';

export const TASK_FILTERS = { pendientes: 'Pendientes', mias: 'Para mí', hechas: 'Hechas', todas: 'Todas' };

export const isTask = (n) => n?.kind === 'tarea';
const notes = (s) => s.pethome.notes;
const by = (ctx) => cleanText(ctx?.user, 60) || null;

export function tasksOf(s) {
  return (s.pethome?.notes || []).filter(isTask);
}

const getTask = (s, id) => getOrFail(tasksOf(s), id, 'la tarea');

/** Crea o edita una tarea. `owner`: id de un socio, o vacío = cualquiera de los dos. */
export function saveTask(s, input, ctx) {
  const text = cleanText(input.text, 200);
  assert(text, 'Escribe qué hay que hacer.', 'text');
  const dueDate = input.dueDate || null;
  if (dueDate) assert(isValidDate(dueDate), 'La fecha límite no es válida.', 'date');
  const owner = input.owner && (s.socios || []).some((x) => x.id === input.owner) ? input.owner : null;
  const data = { text, details: cleanText(input.details, 1000), owner, dueDate };
  if (input.id) {
    const t = getTask(s, input.id);
    Object.assign(t, data, { updatedAt: nowOf(ctx), updatedBy: by(ctx) });
    audit(s, ctx, 'editar', 'tarea', t.id, text.slice(0, 80));
    return t;
  }
  const t = { id: newId('tar'), kind: 'tarea', ...data, done: false, doneAt: null, doneBy: null, createdBy: by(ctx), createdAt: nowOf(ctx) };
  notes(s).push(t);
  audit(s, ctx, 'crear', 'tarea', t.id, text.slice(0, 80));
  return t;
}

/** Marca una tarea como hecha (queda tachada) o la vuelve a abrir. */
export function setTaskDone(s, { taskId, done = true }, ctx) {
  const t = getTask(s, taskId);
  t.done = !!done;
  t.doneAt = t.done ? nowOf(ctx) : null;
  t.doneBy = t.done ? by(ctx) : null;
  audit(s, ctx, t.done ? 'hecha' : 'reabrir', 'tarea', t.id, t.text.slice(0, 80));
  return t;
}

export function deleteTask(s, { taskId }, ctx) {
  const t = getTask(s, taskId);
  const list = notes(s);
  list.splice(list.indexOf(t), 1);
  audit(s, ctx, 'borrar', 'tarea', t.id, t.text.slice(0, 80));
  return t;
}

/** Borra de una vez todas las tareas hechas. Devuelve cuántas. */
export function clearDoneTasks(s, _input, ctx) {
  const list = notes(s);
  const done = list.filter((n) => isTask(n) && n.done);
  for (const t of done) list.splice(list.indexOf(t), 1);
  if (done.length) audit(s, ctx, 'borrar', 'tarea', '', `${done.length} hechas`);
  return done.length;
}

/** Días que faltan para la fecha límite (negativo = vencida); null si no tiene. */
export function taskDueIn(t, today = localDate()) {
  return t.dueDate ? diffDays(today, t.dueDate) : null;
}

/**
 * Lista para mostrar. Pendientes primero: las vencidas y las de fecha más
 * cercana arriba, las sin fecha después (la más vieja primero). Las hechas al
 * final, la más reciente primero.
 */
export function taskList(s, { filter = 'pendientes', meId = null } = {}) {
  let list = tasksOf(s);
  if (filter === 'pendientes') list = list.filter((t) => !t.done);
  else if (filter === 'hechas') list = list.filter((t) => t.done);
  else if (filter === 'mias') list = list.filter((t) => !t.done && (!t.owner || t.owner === meId));
  const open = list.filter((t) => !t.done).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || String(a.createdAt).localeCompare(String(b.createdAt)));
  const done = list.filter((t) => t.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
  return [...open, ...done];
}

export function taskSummary(s, { meId = null, today = localDate() } = {}) {
  const open = tasksOf(s).filter((t) => !t.done);
  return {
    pending: open.length,
    overdue: open.filter((t) => t.dueDate && t.dueDate < today).length,
    mine: open.filter((t) => !t.owner || t.owner === meId).length,
    done: tasksOf(s).length - open.length,
  };
}
