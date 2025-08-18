import React, { useState, useMemo } from 'react';
import { useReactTable, getCoreRowModel, flexRender, getSortedRowModel } from '@tanstack/react-table';

function DataTable({ data, columns, onSaveRow, onDeleteRow }) {
  const [editingRowId, setEditingRowId] = useState(null);
  const [editedData, setEditedData] = useState({});

  const tableColumns = useMemo(() => {
    const handleSave = (row) => {
      // Only send the fields that were actually edited
      const validEditedData = {};
      Object.keys(editedData).forEach(key => {
        if (editedData[key] !== undefined && editedData[key] !== '') {
          // Include all edited fields, including nested ones
          validEditedData[key] = editedData[key];
        }
      });
      
      // Create a clean version of the original row data
      const cleanOriginalData = { ...row.original };
      
      // Remove computed/display-only fields that shouldn't be saved
      const displayOnlyFields = ['machines', 'progress', 'n_boxes', 'time_remaining'];
      displayOnlyFields.forEach(field => {
        delete cleanOriginalData[field];
      });
      
      // Merge the valid edited data with the cleaned original row
      const updatedRow = { ...cleanOriginalData, ...validEditedData };
      onSaveRow(updatedRow);
      setEditingRowId(null);
      setEditedData({});
    };

    const actionColumn = {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const isEditing = row.id === editingRowId;
        return (
          <div className="action-buttons">
            {isEditing ? (
              <>
                <button onClick={() => handleSave(row)} className="btn-save">Save</button>
                <button onClick={() => setEditingRowId(null)} className="btn-cancel">Cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditingRowId(row.id)} className="btn-edit">Edit</button>
                <button onClick={() => onDeleteRow(row.original)} className="btn-delete">Delete</button>
              </>
            )}
          </div>
        );
      },
    };
    return [...columns, actionColumn];
  }, [columns, editingRowId, editedData, onSaveRow, onDeleteRow]);

  const tableData = useMemo(() => data, [data]);

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
    <div className="table-container">
      <table className="modern-table">
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id} onClick={header.column.getToggleSortingHandler()}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{ asc: ' 🔼', desc: ' 🔽' }[header.column.getIsSorted()] ?? null}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;