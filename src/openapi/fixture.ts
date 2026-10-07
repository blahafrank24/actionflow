// Hand-written in the shape `openapi-typescript` generates, so the adapter's types are tested without codegen.
export interface Invoice {
  id: string;
  customer: string;
  amount: number;
}

export interface NewInvoice {
  customer: string;
  amount: number;
}

export interface Problem {
  message: string;
}

type Absent = { header?: never; cookie?: never };

export interface paths {
  '/invoices': {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: { query?: { status?: 'open' | 'paid' } } & Absent & { path?: never };
      requestBody?: never;
      responses: { 200: { content: { 'application/json': Invoice[] } } };
    };
    put?: never;
    post: {
      parameters: { query?: never; path?: never } & Absent;
      requestBody: { content: { 'application/json': NewInvoice } };
      responses: {
        201: { content: { 'application/json': Invoice } };
        422: { content: { 'application/json': Problem } };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/invoices/{id}': {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: {
      parameters: { path: { id: string }; query?: never } & Absent;
      requestBody?: never;
      responses: {
        200: { content: { 'application/json': Invoice } };
        404: { content: { 'application/json': Problem } };
      };
    };
    put?: never;
    post?: never;
    delete: {
      parameters: { path: { id: string }; query?: never } & Absent;
      requestBody?: never;
      responses: { 204: { content?: never } };
    };
    options?: never;
    head?: never;
    patch: {
      parameters: { path: { id: string }; query?: never } & Absent;
      requestBody?: { content: { 'application/json': Partial<NewInvoice> } };
      responses: { 200: { content: { 'application/json': Invoice } } };
    };
    trace?: never;
  };
}
