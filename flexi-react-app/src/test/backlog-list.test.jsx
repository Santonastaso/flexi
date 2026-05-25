import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BacklogListPage from '../pages/BacklogListPage';
import { WORK_CENTERS } from '../constants';
import { useUIStore } from '../store';

const mockRemoveOrder = vi.fn();

vi.mock('../hooks', () => ({
  useOrders: () => ({
    data: [
      {
        id: 'order-1',
        odp_number: 'ODP-000123',
        article_code: 'ART-1',
        nome_cliente: 'Cliente Demo',
        quantity: 100,
        quantity_completed: 0,
        work_center: 'ZANICA',
        department: 'STAMPA',
        status: 'NOT SCHEDULED',
        duration: 2,
        cost: 10,
        fase: 'phase-1',
        scheduled_machine_id: 'machine-1',
        delivery_date: '2025-01-15T00:00:00.000Z',
      },
    ],
    isLoading: false,
    error: null,
  }),
  useMachines: () => ({
    data: [{ id: 'machine-1', machine_name: 'Macchina Demo' }],
    isLoading: false,
  }),
  usePhases: () => ({
    data: [{ id: 'phase-1', name: 'Fase Demo' }],
    isLoading: false,
  }),
  useRemoveOrder: () => ({
    mutateAsync: mockRemoveOrder,
    isPending: false,
  }),
}));

describe('BacklogListPage', () => {
  beforeEach(() => {
    useUIStore.setState({
      selectedWorkCenter: WORK_CENTERS.ZANICA,
      showConfirmDialog: vi.fn(),
    });
  });

  it('renders backlog rows from mocked query data', () => {
    render(
      <MemoryRouter>
        <BacklogListPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
    expect(screen.getByText('ART-1')).toBeInTheDocument();
    expect(screen.getByText('Cliente Demo')).toBeInTheDocument();
    expect(screen.getByText('Macchina Demo')).toBeInTheDocument();
    expect(screen.getByText('Fase Demo')).toBeInTheDocument();
  });
});
