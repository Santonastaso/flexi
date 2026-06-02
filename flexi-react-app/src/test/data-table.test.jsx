import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DataTable from '../components/DataTable';

describe('DataTable pinned columns', () => {
  it('uses TanStack column pinning offsets for frozen ODP columns', () => {
    const columns = [
      { header: 'Numero ODP', accessorKey: 'odp_number' },
      { header: 'Codice Articolo', accessorKey: 'article_code' },
      { header: 'Nome Cliente', accessorKey: 'nome_cliente' },
    ];
    const data = [
      {
        id: 'order-1',
        odp_number: 'ODP-001',
        article_code: 'ART-001',
        nome_cliente: 'Cliente',
      },
    ];

    render(
      <DataTable
        columns={columns}
        data={data}
        onEditRow={vi.fn()}
        onDeleteRow={vi.fn()}
        stickyColumns={['odp_number', 'article_code']}
      />
    );

    const odpHeader = screen.getByRole('columnheader', { name: 'Numero ODP' });
    const articleHeader = screen.getByRole('columnheader', { name: 'Codice Articolo' });

    expect(odpHeader).toHaveStyle({
      left: '0px',
      position: 'sticky',
      width: '96px',
    });
    expect(articleHeader).toHaveStyle({
      left: '96px',
      position: 'sticky',
      width: '136px',
    });
  });
});
