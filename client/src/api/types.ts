export interface Address {
  street: string;
  city: string;
  province?: string;
  postal_code: string;
  country: string;
}

export interface Branch {
  city: string;
  address: string;
  postal_code: string;
}

export interface Supplier {
  vat_number: string;
  fiscal_code?: string;
  name: string;
  tax_regime?: string;
  address: Address;
  phone?: string;
  email?: string;
  qualification?: string;
  share_capital?: string;
  registration_number?: string;
  rea_number?: string;
  branch?: Branch;
  fax?: string;
}

export interface Customer {
  vat_number: string;
  fiscal_code?: string;
  name: string;
  address: Address;
  pec?: string;
  customer_code?: string;
}

export interface LineItem {
  line_number: number;
  product_code?: string;
  description: string;
  quantity: number;
  unit_of_measure?: string | null;
  unit_price: number;
  discount?: number | null;
  vat_rate?: number;
  vat_type?: string;
  line_total: number;
  taxable_amount?: number;
  vat_amount?: number;
}

export interface VatRate {
  rate: number;
  rate_code?: string;
  taxable_amount: number;
  vat_amount: number;
}

export interface VatSummary {
  vat_exigibility?: string;
  vat_rates: VatRate[];
}

export interface Totals {
  stamp_duty?: number | null;
  virtual_stamp?: boolean | null;
  discount?: number | null;
  rounding?: number | null;
  subtotal?: number;
  social_security_contribution_rate?: number;
  social_security_contribution?: number;
  taxable_amount?: number;
  total_taxable?: number;
  total_vat?: number;
  total_amount: number;
  num_packages?: number;
  total_weight_kg?: number;
  num_empties?: number;
  sugar_kg?: number;
}

export interface PaymentDetails {
  payment_method?: string;
  payment_method_code?: string;
  payment_method_description?: string;
  bank_coordinates?: string | null;
  bank_name?: string | null;
  iban?: string;
  swift?: string;
  account_holder?: string;
  due_date?: string;
  amount?: number;
  cash_paid?: number;
  change?: number;
  original_invoice_number?: string | null;
}

export interface InvoiceDetails {
  recipient_code?: string;
  article_73?: boolean;
  causale?: string;
  copy_type?: string;
  currency?: string;
  purchase_order_number?: string | null;
  supplier_number?: string | null;
  tax_due_date?: string | null;
  internal_reference?: string;
  additional_reference?: string;
  page_number?: number;
}

export interface Invoice {
  file_name: string;
  invoice_id: string;
  document_type: string;
  document_date: string;
  supplier: Supplier;
  customer: Customer;
  invoice_details?: InvoiceDetails;
  line_items: LineItem[];
  vat_summary?: VatSummary;
  totals: Totals;
  payment_details?: PaymentDetails;
  notes?: string[];
}

// API Response types
export interface ExtractionResult {
  file_name: string;
  success: boolean;
  invoice?: Invoice | Record<string, never>;
  error?: string;
  errors?: string[];
  confidence?: number;
}

export interface ExtractionResponse {
  results: ExtractionResult[];
  total_processed: number;
  successful: number;
  failed: number;
}

// Document types (from Prisma model)
export interface Document {
  id: string;
  extractionDate: string;
  customerName: string;
  supplierName: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
