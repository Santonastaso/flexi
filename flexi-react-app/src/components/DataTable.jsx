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
      header: 'Azioni',
      cell: ({ row }) => {
        const isEditing = row.id === editingRowId;
        return (
          <div className="action-buttons">
            {isEditing ? (
              <>
                <button onClick={() => handleSave(row)} className="nav-btn today">Salva</button>
                <button onClick={() => setEditingRowId(null)} className="nav-btn today">Annulla</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditingRowId(row.id)} className="nav-btn today">Modifica</button>
                <button onClick={() => onDeleteRow(row.original)} className="nav-btn today">Elimina</button>
              </>
            )}
          </div>
        );
      },
    };
    return [...columns, actionColumn];
  }, [columns, editingRowId, editedData, onSaveRow, onDeleteRow]);

  const tableData = useMemo(() => {
    // Check for duplicate IDs
    if (data && data.length > 0) {
      const ids = data.map(item => item.id);
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        // Duplicate IDs detected but not logged
      }
      
      // Check for duplicate objects (same ID, same data)
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
    <div className="table-container">
      <table className="modern-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header, headerIndex) => {
                // Use header ID + index to ensure uniqueness across all header groups
                // This handles cases where multiple columns might have the same header ID
                const headerKey = `${headerGroup.id}_${header.id}_${headerIndex}`;
                return (
                  <th key={headerKey} onClick={header.column.getToggleSortingHandler()}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' 🔼', desc: ' 🔽' }[header.column.getIsSorted()] ?? null}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            // Use the row's unique ID from the data - TanStack Table ensures row.id is unique
            // This avoids the anti-pattern of using array index as key
            const rowKey = row.original.id || row.id;
            return (
              <tr key={rowKey}>
                {row.getVisibleCells().map((cell, cellIndex) => {
                  // Use row ID + column ID + cell index for truly unique cell keys
                  // This handles cases where column IDs might not be unique across all columns
                  const cellKey = `${rowKey}_${cell.column.id}_${cellIndex}`;
                  return (
                    <td key={cellKey}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;