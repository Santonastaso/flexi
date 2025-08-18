import React from 'react';

function EditableCell({ value, isEditing, onChange }) {
  if (isEditing) {
    return <input type="text" defaultValue={value} onChange={onChange} style={{ width: '100%' }} />;
  }

  return <span>{value}</span>;
}

export default EditableCell;