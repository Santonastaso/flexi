import { formatDeliveryDate, formatInItalyTimezone, formatScheduledTime } from './dateFormatting';
import { normalizeOdpNumber } from './odpFormatting';

const materialAvailabilityClass = (value) => {
  if (value <= 39) return 'bg-gray-300';
  if (value <= 69) return 'bg-yellow-400';
  return 'bg-green-400';
};

const valueOrFallback = (value, fallback) => (
  value === null || value === undefined || value === '' ? fallback : value
);

export const simpleColumn = (header, accessorKey) => ({ header, accessorKey });

export const odpColumn = (header = 'Numero ODP', options = {}) => ({
  header,
  accessorKey: 'odp_number',
  cell: ({ row, getValue }) => {
    const content = normalizeOdpNumber(getValue());
    if (!options.highlightScheduled || row.original.status !== 'SCHEDULED') {
      return content;
    }
    return <span className="text-green-600 font-medium">{content}</span>;
  }
});

export const truncatedTextColumn = (header, accessorKey) => ({
  header,
  accessorKey,
  cell: info => {
    const value = info.getValue();
    if (!value) return 'N/A';
    return (
      <div className="max-w-[200px] truncate text-xs" title={value}>
        {value}
      </div>
    );
  }
});

export const italyDateColumn = (header, accessorKey, options = {}) => ({
  header,
  accessorKey,
  cell: info => info.getValue()
    ? formatInItalyTimezone(info.getValue(), options.format || 'dd/MM/yyyy')
    : (options.emptyValue || 'Non impostata')
});

export const deliveryDateColumn = (header, accessorKey, emptyValue = 'Non impostata') => ({
  header,
  accessorKey,
  cell: ({ row }) => row.original[accessorKey]
    ? formatDeliveryDate(row.original[accessorKey])
    : emptyValue
});

export const scheduledTimeColumn = (header, accessorKey, emptyValue = 'Non programmato') => ({
  header,
  accessorKey,
  cell: info => info.getValue() ? formatScheduledTime(info.getValue()) : emptyValue
});

export const fixedNumberColumn = (header, accessorKey, digits = 1, fallback = undefined) => ({
  header,
  accessorKey,
  cell: info => {
    const value = info.getValue();
    if (typeof value === 'number') return value.toFixed(digits);
    return fallback === undefined ? value : valueOrFallback(value, fallback);
  }
});

export const truthyFixedNumberColumn = (header, accessorKey, digits = 1, fallback = 'N/A') => ({
  header,
  accessorKey,
  cell: info => {
    const value = info.getValue();
    return value ? Number(value).toFixed(digits) : fallback;
  }
});

export const percentTextColumn = (header, accessorKey, fallback = 'N/A') => ({
  header,
  accessorKey,
  cell: ({ row }) => {
    const value = row.original[accessorKey];
    return value != null ? `${value}%` : fallback;
  }
});

export const materialBadgeColumn = (header, accessorKey) => ({
  header,
  accessorKey,
  cell: info => {
    const value = info.getValue();
    if (typeof value !== 'number') return value || 'N/A';
    return (
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${materialAvailabilityClass(value)} text-black text-[11px] font-medium`}>
        {value}
      </div>
    );
  }
});
