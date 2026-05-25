import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('exports rows whose timestamp delivery date falls inside the selected date range', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:test-csv');
    const revokeObjectURL = vi.fn();
    const linkClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    render(
      <MemoryRouter>
        <BacklogListPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /export csv/i }));
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2025-01-15' } });
    fireEvent.change(dateInputs[1], { target: { value: '2025-01-15' } });
    await user.click(screen.getByRole('button', { name: 'Esporta CSV' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(linkClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-csv');

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    linkClick.mockRestore();
  });
});
