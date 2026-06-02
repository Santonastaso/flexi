import React, { useState, useMemo, useEffect } from 'react';
import { useReactTable, getCoreRowModel, flexRender, getFilteredRowModel, getSortedRowModel } from '@tanstack/react-table';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  TableCell,
  TableHead,
  TableRow,
} from './ui/table';
import { Button } from './ui/button';
import FilterDropdown from './FilterDropdown';

const DEFAULT_COLUMN_SIZE = 140;
const PINNED_COLUMN_SIZES = {
  __drag: 40,
  odp_number: 96,
  article_code: 136,
  actions: 156,
};

const loadStoredFilters = (key) => {
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    }
  } catch {
    return {};
  }
  return {};
};

function DataTable({ data, columns, onEditRow, onDeleteRow, enableFiltering = false, filterableColumns = [], stickyColumns = [], renderRowActions, enableRowReorder = false, onRowReorder, filterStorageKey }) {
  const [filters, setFilters] = useState(() =>
    filterStorageKey ? loadStoredFilters(filterStorageKey) : {}
  );
  const [openFilter, setOpenFilter] = useState(null);
  const stickyColumnIds = useMemo(
    () => stickyColumns.filter(Boolean),
    [stickyColumns]
  );
  const stickyColumnSet = useMemo(
    () => new Set(stickyColumnIds),
    [stickyColumnIds]
  );

  useEffect(() => {
    if (filterStorageKey) {
      sessionStorage.setItem(filterStorageKey, JSON.stringify(filters));
    }
  }, [filterStorageKey, filters]);

  const columnFilters = useMemo(() => {
    if (!enableFiltering) return [];

    return Object.entries(filters)
      .filter(([, filterValue]) => Array.isArray(filterValue) ? filterValue.length > 0 : Boolean(filterValue))
      .map(([id, value]) => ({ id, value }));
  }, [enableFiltering, filters]);

  // Get unique values for each filterable column
  const filterOptions = useMemo(() => {
    if (!enableFiltering) return {};
    
    const options = {};
    filterableColumns.forEach(column => {
      options[column] = [...new Set(data.map(item => item[column]).filter(Boolean))].sort();
    });
    return options;
  }, [data, filterableColumns, enableFiltering]);

  const handleFilterChange = (column, value) => {
    setFilters(prev => ({
      ...prev,
      [column]: value
    }));
  };

  const toggleFilter = (column) => {
    setOpenFilter(openFilter === column ? null : column);
  };

  const tableColumns = useMemo(() => {
    const handleEdit = (row) => {
      onEditRow(row.original);
    };

    const dragColumn = enableRowReorder ? [{
      id: '__drag',
      header: '',
      size: PINNED_COLUMN_SIZES.__drag,
      cell: () => null
    }] : [];

    const actionColumn = {
      id: 'actions',
      header: 'Azioni',
      size: PINNED_COLUMN_SIZES.actions,
      cell: ({ row }) => {
        const extraActions = renderRowActions ? renderRowActions(row.original) : null;
        return (
          <div className="flex flex-row gap-1 items-center justify-start">
            {extraActions}
            <Button size="xs" variant="outline" onClick={() => handleEdit(row)}>
              Modifica
            </Button>
            <Button size="xs" variant="destructive" onClick={() => onDeleteRow(row.original)}>
              Elimina
            </Button>
          </div>
        );
      },
    };

    return [...dragColumn, ...columns, actionColumn].map((column) => {
      const columnId = column.id || column.accessorKey;
      const isPinned = stickyColumnSet.has(columnId);
      return {
        ...column,
        size: column.size ?? PINNED_COLUMN_SIZES[columnId] ?? (isPinned ? 132 : DEFAULT_COLUMN_SIZE),
        minSize: column.minSize ?? (columnId === 'actions' ? 148 : 72),
        maxSize: column.maxSize ?? 360,
      };
    });
  }, [columns, enableRowReorder, onEditRow, onDeleteRow, renderRowActions, stickyColumnSet]);

  const columnPinning = useMemo(() => ({
    left: stickyColumnIds,
  }), [stickyColumnIds]);

  const dataTableFilter = (row, columnId, filterValue) => {
    if (!filterValue) return true;
    
    const itemValue = row.getValue(columnId);
    if (itemValue == null) return false;
    
    if (Array.isArray(filterValue)) {
      return filterValue.includes(itemValue);
    }
    
    return itemValue.toString().toLowerCase().includes(filterValue.toLowerCase());
  };

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      columnFilters,
      columnPinning
    },
    enableColumnPinning: true,
    filterFns: {
      dataTableFilter
    },
    defaultColumn: {
      filterFn: 'dataTableFilter'
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const getColumnStyle = (column, isHeader = false) => {
    const size = column.getSize();
    const isPinned = column.getIsPinned();
    const isLeftPinned = isPinned === 'left';

    return {
      width: `${size}px`,
      minWidth: `${size}px`,
      ...(isLeftPinned ? {
        left: `${column.getStart('left')}px`,
        maxWidth: `${size}px`,
        position: 'sticky',
        zIndex: isHeader ? 40 : 30,
        boxShadow: column.getIsLastColumn('left')
          ? '2px 0 4px -2px rgba(15, 23, 42, 0.35)'
          : undefined,
      } : {}),
    };
  };

  const getPinnedClassName = (columnId, baseClassName) => {
    const isPinned = table.getColumn(columnId)?.getIsPinned();
    return isPinned
      ? `${baseClassName} overflow-hidden text-ellipsis`
      : baseClassName;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    })
  );

  const rowIds = table.getRowModel().rows.map((row) => row.original.id ?? row.id);

  const handleDragEnd = (event) => {
    if (!onRowReorder) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rowIds.indexOf(active.id);
    const newIndex = rowIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onRowReorder({ oldIndex, newIndex, activeId: active.id });
  };

  const DraggableRow = ({ row }) => {
    const sortableId = row.original.id ?? row.id;
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition
    } = useSortable({ id: sortableId });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition
    };

          return (
            <TableRow ref={setNodeRef} style={style}>
              {row.getVisibleCells().map((cell, cellIndex) => {
                const cellKey = `${row.id}_${cell.column.id}_${cellIndex}`;
                const columnId = cell.column.id;

                if (columnId === '__drag') {
                  return (
              <TableCell key={cellKey} style={getColumnStyle(cell.column)}>
                <div
                  className="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-100 text-gray-600"
                  {...attributes}
                  {...listeners}
                  title="Trascina per riordinare"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
                  </svg>
                </div>
              </TableCell>
            );
          }

          return (
            <TableCell
              key={cellKey}
              className={getPinnedClassName(columnId, cell.column.getIsPinned() ? 'bg-white shadow-sm' : '')}
              style={getColumnStyle(cell.column)}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          );
        })}
      </TableRow>
    );
  };

  const tableMarkup = (
    <table
      className="caption-bottom text-xs relative"
      style={{
        width: `max(100%, ${table.getTotalSize()}px)`,
        minWidth: '100%',
      }}
    >
      <colgroup>
        {table.getVisibleLeafColumns().map((column) => (
          <col key={column.id} style={{ width: `${column.getSize()}px` }} />
        ))}
      </colgroup>
      <thead className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header, headerIndex) => {
              const headerKey = `${headerGroup.id}_${header.id}_${headerIndex}`;
              const columnId = header.column.id;
              const isFilterable = enableFiltering && filterableColumns.includes(columnId);
              
              return (
                <TableHead 
                  key={headerKey} 
                  onClick={header.column.getToggleSortingHandler()}
                  className={getPinnedClassName(columnId, header.column.getIsPinned() ? 'top-0 bg-gray-50 shadow-sm' : '')}
                  style={getColumnStyle(header.column, true)}
                >
                  <div className="flex items-center gap-2">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' 🔼', desc: ' 🔽' }[header.column.getIsSorted()] ?? null}
                    {isFilterable && (
                      <FilterDropdown
                        column={columnId}
                        options={filterOptions[columnId] || []}
                        onFilterChange={handleFilterChange}
                        isOpen={openFilter === columnId}
                        onToggle={() => toggleFilter(columnId)}
                        activeFilter={filters[columnId]}
                      />
                    )}
                  </div>
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </thead>
      <tbody className="bg-white">
        {table.getRowModel().rows.map((row) => {
          const rowKey = row.original.id || row.id;
          return enableRowReorder ? (
            <DraggableRow key={rowKey} row={row} />
          ) : (
            <TableRow key={rowKey}>
              {row.getVisibleCells().map((cell, cellIndex) => {
                const cellKey = `${rowKey}_${cell.column.id}_${cellIndex}`;
                const columnId = cell.column.id;
                
                return (
                  <TableCell 
                    key={cellKey}
                    className={getPinnedClassName(columnId, cell.column.getIsPinned() ? 'bg-white shadow-sm' : '')}
                    style={getColumnStyle(cell.column)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="table-container">
      {enableRowReorder ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
            {tableMarkup}
          </SortableContext>
        </DndContext>
      ) : (
        tableMarkup
      )}
    </div>
  );
}

export default DataTable;
