import React, { useState, useMemo } from 'react';
import { useReactTable, getCoreRowModel, flexRender, getSortedRowModel } from '@tanstack/react-table';
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

function DataTable({ data, columns, onEditRow, onDeleteRow, enableFiltering = false, filterableColumns = [] }) {
  // Filter state management
  const [filters, setFilters] = useState({});
  const [openFilter, setOpenFilter] = useState(null);

  // Apply column filters
  const filteredData = useMemo(() => {
    if (!enableFiltering || Object.keys(filters).length === 0) return data;
    
    return data.filter(item => {
      return Object.entries(filters).every(([column, filterValue]) => {
        if (!filterValue) return true;
        
        const itemValue = item[column];
        if (!itemValue) return false;
        
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

    const actionColumn = {
      id: 'actions',
      header: 'Azioni',
      cell: ({ row }) => {
        return (
          <div className="flex flex-row gap-1 items-center justify-start">
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
    return [...columns, actionColumn];
  }, [columns, onEditRow, onDeleteRow]);

  const tableData = useMemo(() => {
    // Check for duplicate IDs
    if (filteredData && filteredData.length > 0) {
      const ids = filteredData.map(item => item.id);
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        // Duplicate IDs detected but not logged
      }
      
      // Check for duplicate objects (same ID, same data)
      const seenIds = new Set();
      const duplicates = [];
      filteredData.forEach((item, index) => {
        if (seenIds.has(item.id)) {
          duplicates.push({ id: item.id, index, item });
        } else {
          seenIds.add(item.id);
        }
      });
      
      if (duplicates.length > 0) {
        // Duplicate objects detected but not logged
      }
    }
    return filteredData;
  }, [filteredData]);

  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <div className="rounded-md border overflow-visible">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header, headerIndex) => {
                const headerKey = `${headerGroup.id}_${header.id}_${headerIndex}`;
                const columnId = header.column.id;
                const isFilterable = enableFiltering && filterableColumns.includes(columnId);
                
                return (
                  <TableHead key={headerKey} onClick={header.column.getToggleSortingHandler()}>
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
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => {
            const rowKey = row.original.id || row.id;
            return (
              <TableRow key={rowKey}>
                {row.getVisibleCells().map((cell, cellIndex) => {
                  const cellKey = `${rowKey}_${cell.column.id}_${cellIndex}`;
                  return (
                    <TableCell key={cellKey}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default DataTable;