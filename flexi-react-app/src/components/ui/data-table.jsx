import React, { useState, useMemo } from 'react';
import { useReactTable, getCoreRowModel, flexRender, getSortedRowModel } from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';
import { Button } from './button';

function DataTable({ data, columns, onSaveRow, onDeleteRow }) {
  const [editingRowId, setEditingRowId] = useState(null);
  const [editedData, setEditedData] = useState({});

  const tableColumns = useMemo(() => {
    const handleSave = (row) => {
      const validEditedData = {};
      Object.keys(editedData).forEach(key => {
        if (editedData[key] !== undefined && editedData[key] !== '') {
          validEditedData[key] = editedData[key];
        }
      });
      
      const cleanOriginalData = { ...row.original };
      const displayOnlyFields = ['machines', 'progress', 'n_boxes', 'time_remaining'];
      displayOnlyFields.forEach(field => {
        delete cleanOriginalData[field];
      });
      
      const updatedRow = { ...cleanOriginalData, ...validEditedData };
      onSaveRow(updatedRow);
      setEditingRowId(null);
      setEditedData({});
    };

    const actionColumn = {
      id: 'actions',
      header: 'Azioni',
      cell: ({ row }) => {
        const isEditing = row.id === editingRowId;
        return (
          <div className="flex flex-row gap-2 items-center justify-start">
            {isEditing ? (
              <>
                <Button size="sm" onClick={() => handleSave(row)}>
                  Salva
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingRowId(null)}>
                  Annulla
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditingRowId(row.id)}>
                  Modifica
                </Button>
                <Button size="sm" variant="destructive" onClick={() => onDeleteRow(row.original)}>
                  Elimina
                </Button>
              </>
            )}
          </div>
        );
      },
    };
    return [...columns, actionColumn];
  }, [columns, editingRowId, editedData, onSaveRow, onDeleteRow]);

  const tableData = useMemo(() => {
    if (data && data.length > 0) {
      const ids = data.map(item => item.id);
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        // Duplicate IDs detected but not logged
      }
      
      const seenIds = new Set();
      const duplicates = [];
      data.forEach((item, index) => {
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
    return data;
  }, [data]);

  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    meta: {
      editingRowId,
      setEditedData,
    }
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header, headerIndex) => {
                const headerKey = `${headerGroup.id}_${header.id}_${headerIndex}`;
                return (
                  <TableHead key={headerKey} onClick={header.column.getToggleSortingHandler()}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' 🔼', desc: ' 🔽' }[header.column.getIsSorted()] ?? null}
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
              <TableRow key={rowKey} className={editingRowId === row.id ? 'bg-blue-50' : ''}>
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
