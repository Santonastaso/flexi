import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMachines } from '../hooks';
import { useUIStore } from '../store';
import { apiService } from '../services';
import { schedulerV2Client } from '../services/schedulerV2Client';
import { beforeTaskIdAfterMove } from '../scheduling-v2/queueOrder';
import { formatInItalyTimezone } from '../utils/dateFormatting';
import { normalizeOdpNumber } from '../utils';
import { showError, showSuccess } from '../utils/toast';

const smallButton = 'rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40';
const primaryButton = 'rounded bg-navy-700 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-600 disabled:cursor-not-allowed disabled:opacity-40';

function formatTime(value) {
  return value ? formatInItalyTimezone(value, 'dd/MM HH:mm') : '—';
}

function hours(minutes) {
  return `${(Number(minutes || 0) / 60).toFixed(1)}h`;
}

function PoolDragHandle({ task, disabled }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool-${task.id}`,
    data: { type: 'pool-task', task },
    disabled,
  });
  return <button ref={setNodeRef} {...listeners} {...attributes} className={`${smallButton} cursor-grab ${isDragging ? 'opacity-30' : ''}`} title="Trascina su una macchina">☰</button>;
}

function QueueCard({ task, index, machineId, segments, busy, onRemove, onDuration }) {
  const running = task.status === 'IN PROGRESS';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `queued-${task.id}`,
    data: { type: 'queue-task', task, machineId, index },
    disabled: running || Boolean(busy),
  });
  const start = segments[0]?.starts_at;
  const end = segments.at(-1)?.ends_at;
  const color = task.task_kind === 'pause' ? 'border-l-slate-500' : task.material_availability_global > 70 ? 'border-l-emerald-600' : task.material_availability_global >= 40 ? 'border-l-amber-500' : 'border-l-red-500';

  return (
    <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`rounded border border-gray-200 border-l-4 ${color} bg-white p-2 shadow-sm ${isDragging ? 'opacity-30' : ''}`}>
      <div className="flex items-start gap-2">
        <button {...listeners} {...attributes} className="mt-0.5 cursor-grab text-gray-400 disabled:cursor-not-allowed" disabled={running || Boolean(busy)} title="Trascina per riordinare o spostare">☰</button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <strong className="truncate text-xs">{normalizeOdpNumber(task.odp_number)}</strong>
            <span className="rounded bg-navy-800 px-1.5 py-0.5 text-[9px] font-bold text-white">#{index + 1}</span>
          </div>
          <p className="truncate text-[10px] text-gray-500">{task.article_code || '—'}</p>
          {task.task_kind === 'pause' && <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700">PAUSA</span>}
          {task.asd_notes && <p className="mt-1 rounded border border-amber-200 bg-amber-50 p-1 text-[9px] text-amber-900" title={task.asd_notes}>Nota ASD: {task.asd_notes}</p>}
          <div className="mt-1 grid grid-cols-2 gap-1 text-[9px] text-gray-600">
            <span>Durata: {hours(task.duration_minutes)}</span>
            <span>Segmenti: {segments.length}</span>
            <span>Inizio: {formatTime(start)}</span>
            <span>Fine: {formatTime(end)}</span>
          </div>
          <div className="mt-2 flex justify-end gap-1">
            <button className={smallButton} disabled={running || Boolean(busy)} onClick={() => onDuration(task)}>Durata</button>
            <button className={smallButton} disabled={running || Boolean(busy)} onClick={() => onRemove(task)}>×</button>
          </div>
        </div>
      </div>
    </article>
  );
}

function MachineColumn({ machine, queue, segmentsByTask, busy, onRemove, onDuration }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `machine-${machine.id}`,
    data: { type: 'queue-column', machineId: machine.id },
  });
  const totalMinutes = queue.reduce((sum, task) => sum + Number(task.duration_minutes || 0), 0);
  const lastSegments = queue.length ? segmentsByTask.get(queue.at(-1).id) || [] : [];

  return (
    <section ref={setNodeRef} className={`flex h-[650px] w-[292px] flex-none flex-col overflow-hidden rounded-md border bg-gray-50 ${isOver ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'}`}>
      <header className="bg-navy-700 px-3 py-2 text-white">
        <h3 className="truncate text-xs font-bold">{machine.machine_name}</h3>
        <p className="truncate text-[9px] text-navy-200">{machine.department || machine.work_center}</p>
        <p className="mt-1 text-[9px]">Lavori: {queue.length} · Durata: {hours(totalMinutes)}{lastSegments.length ? ` · Fine: ${formatTime(lastSegments.at(-1).ends_at)}` : ''}</p>
      </header>
      <SortableContext items={queue.map((task) => `queued-${task.id}`)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2 overflow-y-auto p-2">
          {queue.map((task, index) => <QueueCard key={task.id} task={task} index={index} machineId={machine.id} segments={segmentsByTask.get(task.id) || []} busy={busy} onRemove={onRemove} onDuration={onDuration} />)}
          {!queue.length && <div className="flex h-full items-center justify-center px-4 text-center text-[10px] text-gray-400">Nessun lavoro in coda<br />Trascina qui un lavoro</div>}
        </div>
      </SortableContext>
    </section>
  );
}

export default function SchedulerV2BoardPage() {
  const navigate = useNavigate();
  const selectedWorkCenter = useUIStore((state) => state.selectedWorkCenter);
  const { data: allMachines = [], isLoading: machinesLoading } = useMachines();
  const [filters, setFilters] = useState({ department: '', type: '', name: '' });
  const [poolSearch, setPoolSearch] = useState('');
  const [pauseMachine, setPauseMachine] = useState('');
  const [pauseMinutes, setPauseMinutes] = useState('60');
  const [busy, setBusy] = useState('');
  const [draggedTask, setDraggedTask] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const snapshotQuery = useQuery({ queryKey: ['scheduler-v2-workspace'], queryFn: schedulerV2Client.snapshot, staleTime: 5_000 });
  const snapshot = snapshotQuery.data || { revisions: {}, queue: [], segments: [], pool: [] };
  const revision = (machineId) => Number(snapshot.revisions?.[machineId] ?? 0);

  const baseMachines = useMemo(() => allMachines
    .filter((machine) => machine.status === 'ACTIVE')
    .filter((machine) => !selectedWorkCenter || selectedWorkCenter === 'BOTH' || machine.work_center === selectedWorkCenter), [allMachines, selectedWorkCenter]);
  const machines = useMemo(() => baseMachines
    .filter((machine) => !filters.department || machine.department === filters.department)
    .filter((machine) => !filters.type || machine.machine_type === filters.type)
    .filter((machine) => !filters.name || machine.machine_name === filters.name), [baseMachines, filters]);
  const options = (key) => [...new Set(baseMachines.map((machine) => machine[key]).filter(Boolean))].sort();

  const queues = useMemo(() => {
    const result = new Map(baseMachines.map((machine) => [machine.id, []]));
    for (const task of snapshot.queue) result.get(task.machine_id)?.push(task);
    for (const queue of result.values()) queue.sort((a, b) => a.position - b.position);
    return result;
  }, [baseMachines, snapshot.queue]);
  const segmentsByTask = useMemo(() => {
    const result = new Map();
    for (const segment of snapshot.segments) {
      const list = result.get(segment.task_id) || [];
      list.push(segment);
      result.set(segment.task_id, list);
    }
    for (const segments of result.values()) segments.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    return result;
  }, [snapshot.segments]);
  const pool = useMemo(() => {
    const needle = poolSearch.trim().toLowerCase();
    return snapshot.pool
      .filter((task) => !selectedWorkCenter || selectedWorkCenter === 'BOTH' || task.work_center === selectedWorkCenter)
      .filter((task) => !needle || [task.odp_number, task.article_code, task.nome_cliente, task.asd_notes].some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [poolSearch, selectedWorkCenter, snapshot.pool]);

  const run = async (key, operation, message) => {
    setBusy(key);
    try {
      await operation();
      await snapshotQuery.refetch();
      showSuccess(message);
    } catch (error) {
      showError(error.message || 'Operazione non riuscita');
      await snapshotQuery.refetch();
    } finally {
      setBusy('');
    }
  };

  const remove = (task) => {
    if (!window.confirm(`Rimuovere ${normalizeOdpNumber(task.odp_number)} dalla coda? I lavori successivi verranno anticipati.`)) return;
    run(`remove-${task.id}`, () => schedulerV2Client.unschedule({ taskId: task.id, revision: revision(task.machine_id) }), 'Lavoro rimosso e coda anticipata');
  };
  const changeDuration = (task) => {
    const value = window.prompt('Durata in minuti', String(task.duration_minutes));
    if (value === null) return;
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes <= 0) return showError('Inserisci minuti interi e positivi');
    run(`duration-${task.id}`, () => schedulerV2Client.setDuration({ taskId: task.id, durationMinutes: minutes, revision: revision(task.machine_id) }), 'Durata e coda aggiornate');
  };

  const handleDragEnd = ({ active, over }) => {
    setDraggedTask(null);
    if (!over || busy) return;
    const source = active.data.current;
    const target = over.data.current;
    if (!source || !target) return;
    if (target.type === 'pool' && source.type === 'queue-task') return remove(source.task);

    const targetMachineId = target.type === 'queue-task' ? target.machineId : target.type === 'queue-column' ? target.machineId : null;
    if (!targetMachineId) return;
    const beforeTaskId = target.type === 'queue-task' ? target.task.id : null;

    if (source.type === 'pool-task') {
      return run(`schedule-${source.task.id}`, () => schedulerV2Client.schedule({ machineId: targetMachineId, taskId: source.task.id, beforeTaskId, revision: revision(targetMachineId) }), 'Lavoro pianificato');
    }
    if (source.type !== 'queue-task' || source.task.status === 'IN PROGRESS') return;

    if (source.machineId !== targetMachineId) {
      return run(`move-${source.task.id}`, () => schedulerV2Client.move({ taskId: source.task.id, targetMachineId, beforeTaskId, sourceRevision: revision(source.machineId), targetRevision: revision(targetMachineId) }), 'Lavoro spostato; entrambe le code sono state ricalcolate');
    }
    if (target.type !== 'queue-task') return;
    const anchor = beforeTaskIdAfterMove(queues.get(source.machineId) || [], source.task.id, target.task.id);
    if (anchor === undefined) return;
    run(`reorder-${source.task.id}`, () => schedulerV2Client.schedule({ machineId: source.machineId, taskId: source.task.id, beforeTaskId: anchor, revision: revision(source.machineId) }), 'Coda riordinata');
  };

  const repairVisible = async () => {
    setBusy('repair-all');
    try {
      for (const machine of machines) await schedulerV2Client.repair({ machineId: machine.id, revision: revision(machine.id) });
      await snapshotQuery.refetch();
      showSuccess('Code visibili ricalcolate');
    } catch (error) {
      showError(error.message || 'Ricalcolo non riuscito');
      await snapshotQuery.refetch();
    } finally {
      setBusy('');
    }
  };

  const { setNodeRef: setPoolRef, isOver: poolOver } = useDroppable({ id: 'v2-pool', data: { type: 'pool' } });
  if (machinesLoading || snapshotQuery.isLoading) return <div className="p-6 text-sm text-gray-600">Caricamento pianificazione v2…</div>;
  if (snapshotQuery.error) return <div className="p-6 text-sm text-red-700">{snapshotQuery.error.message}</div>;

  return (
    <DndContext sensors={sensors} onDragStart={({ active }) => setDraggedTask(active.data.current?.task || null)} onDragCancel={() => setDraggedTask(null)} onDragEnd={handleDragEnd}>
      <main className="min-h-full bg-gray-100 p-2">
        <div className="space-y-3">
          <section ref={setPoolRef} className={`overflow-hidden rounded-lg border bg-white shadow-sm ${poolOver ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2"><div><h2 className="text-sm font-bold text-gray-900">Pool Lavori</h2><p className="text-[10px] text-gray-500">{pool.length} lavori disponibili · trascina sulle code</p></div><input className="w-72 rounded border border-gray-300 px-3 py-1.5 text-xs" value={poolSearch} onChange={(event) => setPoolSearch(event.target.value)} placeholder="Cerca ODP, articolo, cliente o nota" /></div>
            <div className="max-h-56 overflow-auto">
              <table className="min-w-[1450px] w-full text-left text-[10px]">
                <thead className="sticky top-0 bg-gray-50 text-gray-600"><tr>{['ODP','Codice Articolo','Nome Cliente','Quantità','Completata','Durata','Costo','Material ISP','Material Lotti','Material Global','Note ASD','Gantt','Azioni'].map((title) => <th key={title} className="border-b border-r border-gray-200 px-2 py-2 font-semibold">{title}</th>)}</tr></thead>
                <tbody>{pool.map((task) => <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50"><td className="px-2 py-1.5 font-medium">{normalizeOdpNumber(task.odp_number)}</td><td className="px-2">{task.article_code || '—'}</td><td className="max-w-40 truncate px-2">{task.nome_cliente || '—'}</td><td className="px-2">{task.quantity ?? '—'}</td><td className="px-2">{task.quantity_completed ?? '—'}</td><td className="px-2">{hours(task.duration_minutes)}</td><td className="px-2">{Number(task.cost || 0).toFixed(2)}</td><td className="px-2">{task.material_availability_isp ?? 'N/A'}</td><td className="px-2">{task.material_availability_lotti ?? 'N/A'}</td><td className="px-2">{task.material_availability_global ?? 'N/A'}</td><td className="max-w-52 truncate px-2" title={task.asd_notes}>{task.asd_notes || '—'}</td><td className="px-2"><PoolDragHandle task={task} disabled={Boolean(busy)} /></td><td className="whitespace-nowrap px-2"><button className={smallButton} onClick={() => navigate(`/backlog/${task.id}/edit`)}>Modifica</button> <button className={smallButton} disabled={Boolean(busy)} onClick={() => { if (window.confirm(`Eliminare ${normalizeOdpNumber(task.odp_number)}?`)) run(`delete-${task.id}`, () => apiService.removeOdpOrder(task.id), 'Lavoro eliminato'); }}>Elimina</button></td></tr>)}</tbody>
              </table>
              {!pool.length && <p className="p-6 text-center text-xs text-gray-500">Nessun lavoro disponibile</p>}
            </div>
          </section>

          <section className="rounded-lg border border-gray-300 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="mb-2 text-sm font-bold text-gray-900">Filtri Macchine & Aggiungi Pausa</h2><div className="flex flex-wrap gap-2"><select className="rounded border border-gray-300 px-2 py-1.5 text-xs" value={pauseMachine} onChange={(event) => setPauseMachine(event.target.value)}><option value="">Seleziona macchina</option>{baseMachines.map((machine) => <option key={machine.id} value={machine.id}>{machine.machine_name}</option>)}</select><input className="w-24 rounded border border-gray-300 px-2 py-1.5 text-xs" type="number" min="1" step="1" value={pauseMinutes} onChange={(event) => setPauseMinutes(event.target.value)} title="Durata pausa in minuti" /><button className={primaryButton} disabled={!pauseMachine || Boolean(busy)} onClick={() => { const minutes = Number(pauseMinutes); if (!Number.isInteger(minutes) || minutes <= 0) return showError('Durata pausa non valida'); run('pause', () => schedulerV2Client.createPause({ machineId: pauseMachine, durationMinutes: minutes, revision: revision(pauseMachine) }), 'Pausa creata e pianificata'); }}>+ Pausa</button><button className={smallButton} onClick={() => setFilters({ department: '', type: '', name: '' })}>Cancella filtri</button><button className={smallButton} disabled={Boolean(busy)} onClick={repairVisible}>↻ Aggiorna code</button></div></div>
              <div className="flex flex-wrap gap-2"><label className="text-[10px] font-semibold text-gray-600">Reparto<select className="mt-1 block w-40 rounded border border-gray-300 px-2 py-1.5 text-xs" value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}><option value="">Tutti</option>{options('department').map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-[10px] font-semibold text-gray-600">Tipo macchina<select className="mt-1 block w-40 rounded border border-gray-300 px-2 py-1.5 text-xs" value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}><option value="">Tutti</option>{options('machine_type').map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-[10px] font-semibold text-gray-600">Nome macchina<select className="mt-1 block w-44 rounded border border-gray-300 px-2 py-1.5 text-xs" value={filters.name} onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))}><option value="">Tutte</option>{options('machine_name').map((value) => <option key={value}>{value}</option>)}</select></label></div>
            </div>
          </section>

          <div className="overflow-x-auto pb-3"><div className="flex min-w-max gap-2">{machines.map((machine) => <MachineColumn key={machine.id} machine={machine} queue={queues.get(machine.id) || []} segmentsByTask={segmentsByTask} busy={busy} onRemove={remove} onDuration={changeDuration} />)}</div></div>
        </div>
      </main>
      <DragOverlay>{draggedTask && <div className="w-64 rounded border border-blue-300 bg-white p-2 text-xs font-semibold shadow-xl">{normalizeOdpNumber(draggedTask.odp_number)} · {draggedTask.article_code || '—'}</div>}</DragOverlay>
    </DndContext>
  );
}
