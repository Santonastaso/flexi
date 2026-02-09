export const normalizeOdpNumber = (value) => {
  if (value === null || value === undefined) return value;
  const raw = String(value).trim();
  if (!raw) return raw;

  if (!/^\d{4}/.test(raw)) {
    return raw;
  }

  if (raw.length <= 4) {
    return raw;
  }

  const withoutYear = raw.slice(4);
  const withoutLeadingZeros = withoutYear.replace(/^0+/, '');

  if (withoutLeadingZeros) {
    return withoutLeadingZeros;
  }

  return withoutYear;
};
