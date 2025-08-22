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

  const tableData = useMemo(() => {
    // Log data for debugging
    if (data && data.length > 0) {
      console.log('📊 DataTable received data:', data.length, 'rows');
      
      // Check for duplicate IDs
      const ids = data.map(item => item.id);
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        console.warn('⚠️ DataTable: Duplicate IDs detected:', duplicateIds);
        console.warn('⚠️ DataTable: Full data with duplicates:', data);
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
        console.warn('⚠️ DataTable: Duplicate objects detected:', duplicates);
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
              {headerGroup.headers.map((header) => {
                // Use the header's unique ID - TanStack Table ensures these are unique
                // No need for array indices since header.id is already unique within the group
                return (
                  <th key={header.id} onClick={header.column.getToggleSortingHandler()}>
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
                {row.getVisibleCells().map((cell) => {
                  // Use row ID + column ID for cell keys - no need for array indices
                  // This ensures stable keys that don't change when data is reordered
                  const cellKey = `${rowKey}_${cell.column.id}`;
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