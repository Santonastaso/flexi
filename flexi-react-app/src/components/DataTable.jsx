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
          {table.getHeaderGroups().map((headerGroup, groupIndex) => (
            <tr key={`${headerGroup.id}_${groupIndex}`}>
              {headerGroup.headers.map((header, headerIndex) => {
                // Use a combination of header.id, groupIndex, and headerIndex to ensure unique keys
                const uniqueHeaderKey = `${header.id}_${groupIndex}_${headerIndex}`;
                return (
                  <th key={uniqueHeaderKey} onClick={header.column.getToggleSortingHandler()}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' 🔼', desc: ' 🔽' }[header.column.getIsSorted()] ?? null}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, rowIndex) => {
            // Use a combination of row.id and rowIndex to ensure unique keys
            const uniqueRowKey = `${row.id}_${rowIndex}`;
            return (
              <tr key={uniqueRowKey}>
                {row.getVisibleCells().map((cell, cellIndex) => {
                  // Use a combination of row.id, rowIndex, and cellIndex to ensure unique cell keys
                  const uniqueCellKey = `${row.id}_${rowIndex}_${cellIndex}`;
                  return (
                    <td key={uniqueCellKey}>
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