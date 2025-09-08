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

function DataTable({ data, columns, onEditRow, onDeleteRow }) {

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
            <Button size="sm" variant="outline" onClick={() => handleEdit(row)}>
              Modifica
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onDeleteRow(row.original)}>
              Elimina
            </Button>
          </div>
        );
      },
    };
    return [...columns, actionColumn];
  }, [columns, onEditRow, onDeleteRow]);

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
    getSortedRowModel: getSortedRowModel()
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
