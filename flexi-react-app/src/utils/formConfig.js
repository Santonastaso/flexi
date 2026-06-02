export const cloneFormConfig = (config) => ({
  ...config,
  sections: config.sections.map(section => ({
    ...section,
    fields: section.fields.map(field => ({
      ...field,
      options: Array.isArray(field.options)
        ? field.options.map(option => ({ ...option }))
        : field.options
    }))
  }))
});

export const valueOrDefault = (value, fallback) => value ?? fallback;
