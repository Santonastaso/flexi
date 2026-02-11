export const normalizeOdpNumber = (value) => {
  if (value === null || value === undefined) return value;
  const raw = String(value).trim();
  if (!raw || raw.length <= 4) return raw;
  const afterFirst4 = raw.slice(4);
  const withoutLeadingZeros = afterFirst4.replace(/^0+/, '');
  return withoutLeadingZeros || afterFirst4;
};
