import { action } from '@yung_papa/actionflow';
import type { Invoice } from '../api/fakeBackend';

export interface InvoiceTable {
  append(row: Invoice): void;
  remove(row: Invoice): void;
}

export const tableActions = (tables: { invoices: InvoiceTable }) => ({
  'table.append': action(
    (params: { table: 'invoices'; row: Invoice }) => {
      tables[params.table].append(params.row);
      return params.row;
    },
    { undo: (params, row) => tables[params.table].remove(row) },
  ),
});
