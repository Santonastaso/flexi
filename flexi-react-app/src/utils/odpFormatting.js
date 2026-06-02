import { formatDeliveryDate, formatScheduledTime } from './dateFormatting';

export const normalizeOdpNumber = (value) => {
  if (value === null || value === undefined) return value;
  const raw = String(value).trim();
  if (!raw || raw.length <= 4) return raw;
  const afterFirst4 = raw.slice(4);
  const withoutLeadingZeros = afterFirst4.replace(/^0+/, '');
  return withoutLeadingZeros || afterFirst4;
};

export const getExternalArticleCode = (task) => (
  task?.production_lot || task?.external_article_code
);

const scheduledTooltipLine = (label, value) => (
  value ? `${label}: ${formatScheduledTime(value)}` : 'Non programmato'
);

export const formatTaskInfoTooltip = (task, options = {}) => {
  const {
    includeBagDetails = false,
    includeScheduledStart = false,
    includeScheduledEnd = false,
    blankLineBeforeScheduledEnd = false,
  } = options;

  const lines = [
    `Codice Articolo: ${task.article_code || 'Non specificato'}`,
    `Codice Articolo Esterno: ${getExternalArticleCode(task) || 'Non specificato'}`,
    `Nome Cliente: ${task.nome_cliente || 'Non specificato'}`,
    `Data Consegna: ${task.delivery_date ? formatDeliveryDate(task.delivery_date) : 'Non impostata'}`,
    `Quantità: ${task.quantity || 'Non specificata'}`,
  ];

  if (includeBagDetails) {
    lines.push(
      `Altezza Busta: ${task.bag_height || 'Non specificata'} mm`,
      `Passo Busta: ${task.bag_step || 'Non specificato'} mm`
    );
  }

  lines.push(
    `Note Libere: ${task.user_notes || 'Nessuna nota'}`,
    `Note ASD: ${task.asd_notes || 'Nessuna nota'}`,
    `Material Global: ${task.material_availability_global || 'N/A'}%`
  );

  if (includeScheduledStart) {
    lines.push(scheduledTooltipLine('Inizio Programmato', task.scheduled_start_time));
  }

  if (blankLineBeforeScheduledEnd) {
    lines.push('');
  }

  if (includeScheduledEnd) {
    lines.push(scheduledTooltipLine('Fine Programmata', task.scheduled_end_time));
  }

  return lines.join('\n');
};
