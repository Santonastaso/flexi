import React, { useState, useMemo, useEffect } from 'react';
import { useReactTable, getCoreRowModel, flexRender, getSortedRowModel } from '@tanstack/react-table';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Button } from './ui/button';
import FilterDropdown from './FilterDropdown';

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

  useEffect(() => {
    if (filterStorageKey) {
      sessionStorage.setItem(filterStorageKey, JSON.stringify(filters));
    }
  }, [filterStorageKey, filters]);

  // Apply column filters
  const filteredData = useMemo(() => {
    if (!enableFiltering || Object.keys(filters).length === 0) return data;
    
    return data.filter(item => {
      return Object.entries(filters).every(([column, filterValue]) => {
        if (!filterValue) return true;
        
        const itemValue = item[column];
        if (itemValue == null) return false;
        
        // Handle array of selected values (multi-selection)
        if (Array.isArray(filterValue)) {
          return filterValue.includes(itemValue);
        }
        
        // Handle single value (legacy support)
        return itemValue.toString().toLowerCase().includes(filterValue.toLowerCase());
      });
    });
  }, [data, filters, enableFiltering]);

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
      cell: () => null
    }] : [];

    const actionColumn = {
      id: 'actions',
      header: 'Azioni',
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
    return [...dragColumn, ...columns, actionColumn];
  }, [columns, enableRowReorder, onEditRow, onDeleteRow, renderRowActions]);

  // Calculate sticky column positions
  const getStickyLeftPosition = (columnId, columnIndex) => {
    if (!stickyColumns.includes(columnId)) return 0;
    
    let leftPosition = 0;
    for (let i = 0; i < columnIndex; i++) {
      const colId = tableColumns[i]?.id || tableColumns[i]?.accessorKey;
      if (stickyColumns.includes(colId)) {
        // Approximate column widths based on content - adjusted for actual column widths
        if (colId === 'odp_number') leftPosition += 71; // Numero ODP
        else if (colId === 'article_code') leftPosition += 80; // Codice Articolo
        else leftPosition += 100; // Default width
      }
    }
    return leftPosition;
  };

  const tableData = useMemo(() => filteredData, [filteredData]);

  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

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
          const isSticky = stickyColumns.includes(columnId);

          if (columnId === '__drag') {
            return (
              <TableCell key={cellKey} className="w-8">
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
              className={isSticky ? 'sticky z-10 bg-white shadow-sm' : ''}
              style={isSticky ? { left: `${getStickyLeftPosition(columnId, cellIndex)}px` } : {}}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          );
        })}
      </TableRow>
    );
  };

  const tableMarkup = (
    <table className="caption-bottom text-xs relative" style={{ width: 'max-content', minWidth: '100%' }}>
      <thead className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header, headerIndex) => {
              const headerKey = `${headerGroup.id}_${header.id}_${headerIndex}`;
              const columnId = header.column.id;
              const isFilterable = enableFiltering && filterableColumns.includes(columnId);
              const isSticky = stickyColumns.includes(columnId);
              
              return (
                <TableHead 
                  key={headerKey} 
                  onClick={header.column.getToggleSortingHandler()}
                  className={isSticky ? 'sticky top-0 z-30 bg-gray-50 shadow-sm' : ''}
                  style={isSticky ? { 
                    left: `${getStickyLeftPosition(columnId, headerIndex)}px`
                  } : {}}
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
                const isSticky = stickyColumns.includes(columnId);
                
                return (
                  <TableCell 
                    key={cellKey}
                    className={isSticky ? 'sticky z-10 bg-white shadow-sm' : ''}
                    style={isSticky ? { 
                      left: `${getStickyLeftPosition(columnId, cellIndex)}px`
                    } : {}}
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
