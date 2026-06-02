import { describe, expect, it } from 'vitest';
import {
  cloneFormConfig,
  formatTaskInfoTooltip,
  getExternalArticleCode,
  valueOrDefault
} from '../utils';

describe('lean refactor helpers', () => {
  it('preserves valid zero values when applying defaults', () => {
    expect(valueOrDefault(0, 12)).toBe(0);
    expect(valueOrDefault(null, 12)).toBe(12);
    expect(valueOrDefault(undefined, 12)).toBe(12);
  });

  it('clones form config fields and options before mutation', () => {
    const config = {
      sections: [
        {
          title: 'Section',
          fields: [
            { name: 'field', options: [{ value: 'A', label: 'A' }] }
          ]
        }
      ]
    };

    const clone = cloneFormConfig(config);
    clone.sections[0].fields[0].options[0].label = 'Changed';

    expect(config.sections[0].fields[0].options[0].label).toBe('A');
  });

  it('uses production lot as the external article code source', () => {
    const task = {
      article_code: 'ART-1',
      production_lot: 'EXT-1',
      external_article_code: 'OLD-EXT',
      nome_cliente: 'Cliente',
      quantity: 10
    };

    expect(getExternalArticleCode(task)).toBe('EXT-1');
    expect(formatTaskInfoTooltip(task)).toContain('Codice Articolo Esterno: EXT-1');
  });
});
