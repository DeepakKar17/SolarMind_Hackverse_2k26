import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Button,
  Badge,
  StatCard,
  Input,
  Select,
  Checkbox,
  Modal,
  DataTable,
  Pagination,
  SearchInput,
  StatusIndicator,
  EmptyState,
} from '../components/common';

describe('SolarMind Design System Components', () => {
  describe('Button Component', () => {
    it('renders text and handles click events', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Generate Baseline</Button>);

      const btn = screen.getByRole('button', { name: /Generate Baseline/i });
      expect(btn).toBeInTheDocument();
      await user.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('respects disabled and loading states', () => {
      const { rerender } = render(<Button disabled>Disabled Button</Button>);
      expect(screen.getByRole('button', { name: /Disabled Button/i })).toBeDisabled();

      rerender(<Button isLoading>Loading Button</Button>);
      expect(screen.getByRole('button', { name: /Loading Button/i })).toBeDisabled();
    });
  });

  describe('Badge & StatusIndicator', () => {
    it('renders Badge with correct variant class', () => {
      render(<Badge variant="success">Online</Badge>);
      expect(screen.getByText('Online')).toHaveClass('sm-badge-success');
    });

    it('renders StatusIndicator with label', () => {
      render(<StatusIndicator status="NORMAL" label="Inverter Operating" />);
      expect(screen.getByText('Inverter Operating')).toBeInTheDocument();
    });
  });

  describe('StatCard Component', () => {
    it('renders title, value, unit, and subtext', () => {
      render(
        <StatCard
          title="Instantaneous AC Power"
          value="4.85"
          unit="kW"
          subtext="Clear sky expected: 4.90 kW"
          trend={2.4}
        />
      );
      expect(screen.getByText('Instantaneous AC Power')).toBeInTheDocument();
      expect(screen.getByText('4.85')).toBeInTheDocument();
      expect(screen.getByText('kW')).toBeInTheDocument();
      expect(screen.getByText('+2.4%')).toBeInTheDocument();
      expect(screen.getByText('Clear sky expected: 4.90 kW')).toBeInTheDocument();
    });
  });

  describe('Form Controls: Input, Select, Checkbox, SearchInput', () => {
    it('renders Input with label, error, and handles change', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(
        <Input
          label="Inverter Name"
          placeholder="Enter name"
          onChange={handleChange}
          error="Name is required"
        />
      );
      expect(screen.getByLabelText(/Inverter Name/i)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Name is required');

      const input = screen.getByPlaceholderText('Enter name');
      await user.type(input, 'A');
      expect(handleChange).toHaveBeenCalled();
    });

    it('renders Select and handles option changes', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(
        <Select
          label="String Selection"
          options={[
            { value: 'S1', label: 'String 1' },
            { value: 'S2', label: 'String 2' },
          ]}
          onChange={handleChange}
        />
      );
      const select = screen.getByLabelText(/String Selection/i);
      await user.selectOptions(select, 'S2');
      expect(handleChange).toHaveBeenCalled();
    });

    it('renders Checkbox and handles toggle', async () => {
      const user = userEvent.setup();
      const handleToggle = vi.fn();
      render(
        <Checkbox
          label="Enable Shading Alerts"
          checked={false}
          onChange={handleToggle}
        />
      );
      const checkbox = screen.getByLabelText(/Enable Shading Alerts/i);
      expect(checkbox).not.toBeChecked();
      await user.click(checkbox);
      expect(handleToggle).toHaveBeenCalled();
    });

    it('renders SearchInput and calls onClear when clear button is clicked', async () => {
      const user = userEvent.setup();
      const handleClear = vi.fn();
      render(
        <SearchInput
          value="Fault Query"
          onChange={() => {}}
          onClear={handleClear}
        />
      );
      const clearBtn = screen.getByLabelText('Clear search');
      await user.click(clearBtn);
      expect(handleClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('Modal & Overlays', () => {
    it('does not render when isOpen is false', () => {
      render(
        <Modal isOpen={false} title="Test Modal">
          <div>Hidden Modal Body</div>
        </Modal>
      );
      expect(screen.queryByText('Hidden Modal Body')).not.toBeInTheDocument();
    });

    it('renders content and calls onClose when close icon is clicked', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Inspection Modal">
          <div>Modal Body Content</div>
        </Modal>
      );
      expect(screen.getByText('Inspection Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal Body Content')).toBeInTheDocument();

      const closeBtn = screen.getByLabelText('Close modal');
      await user.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('DataTable & Pagination', () => {
    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'String Name' },
    ];
    const data = [
      { id: 1, name: 'String North' },
      { id: 2, name: 'String South' },
    ];

    it('renders table headers and rows', () => {
      render(<DataTable columns={columns} data={data} />);
      expect(screen.getByText('String Name')).toBeInTheDocument();
      expect(screen.getByText('String North')).toBeInTheDocument();
      expect(screen.getByText('String South')).toBeInTheDocument();
    });

    it('renders empty message when no data is provided', () => {
      render(<DataTable columns={columns} data={[]} emptyMessage="No solar strings found" />);
      expect(screen.getByText('No solar strings found')).toBeInTheDocument();
    });

    it('renders Pagination controls and triggers page change', async () => {
      const user = userEvent.setup();
      const handlePage = vi.fn();
      render(
        <Pagination
          currentPage={1}
          totalPages={3}
          pageSize={10}
          totalItems={30}
          onPageChange={handlePage}
        />
      );
      expect(screen.getByText(/1 \/ 3/i)).toBeInTheDocument();
      const nextBtn = screen.getByLabelText('Next page');
      await user.click(nextBtn);
      expect(handlePage).toHaveBeenCalledWith(2);
    });
  });

  describe('EmptyState Component', () => {
    it('renders title and description', () => {
      render(
        <EmptyState
          title="No Active Alerts"
          description="Your inverter has no recorded fault anomalies."
        />
      );
      expect(screen.getByText('No Active Alerts')).toBeInTheDocument();
      expect(screen.getByText('Your inverter has no recorded fault anomalies.')).toBeInTheDocument();
    });
  });
});
