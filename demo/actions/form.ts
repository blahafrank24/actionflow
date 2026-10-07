import { action } from 'actionflow';
import type { NewInvoice } from '../api/fakeBackend';

export interface InvoiceForm {
  invoice: NewInvoice;
  notify: boolean;
}

export const formActions = (read: (form: 'invoice') => InvoiceForm) => ({
  'form.read': action((params: { form: 'invoice' }) => read(params.form)),
});
