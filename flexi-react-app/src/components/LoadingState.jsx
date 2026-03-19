import React from 'react';

export default function LoadingState({ message = 'Caricamento...' }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin border-4 border-gray-200 border-t-blue-500 rounded-full w-8 h-8" />
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  );
}
