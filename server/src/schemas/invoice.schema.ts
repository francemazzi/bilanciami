import { z } from "zod";

// Helper for optional fields that need to be nullable for OpenAI structured outputs
const optionalString = () => z.string().nullable().optional();
const optionalNumber = () => z.number().nullable().optional();
const optionalBoolean = () => z.boolean().nullable().optional();

const addressSchema = z.object({
  street: z.string().describe("Street address including number"),
  city: z.string().describe("City name"),
  province: optionalString().describe("Province code (e.g., MI, RM)"),
  postal_code: z.string().describe("Postal/ZIP code"),
  country: z.string().describe("Country code (e.g., IT)"),
});

const branchSchema = z.object({
  city: z.string(),
  address: z.string(),
  postal_code: z.string(),
});

const supplierSchema = z.object({
  vat_number: z.string().describe("VAT number with country prefix (e.g., IT01234567890)"),
  fiscal_code: optionalString().describe("Fiscal code if different from VAT"),
  name: z.string().describe("Company or person name"),
  tax_regime: optionalString().describe("Tax regime code (e.g., RF01)"),
  address: addressSchema,
  phone: optionalString(),
  email: optionalString(),
  qualification: optionalString().describe("Professional qualification"),
  share_capital: optionalString(),
  registration_number: optionalString(),
  rea_number: optionalString(),
  branch: branchSchema.nullable().optional(),
  fax: optionalString(),
});

const customerSchema = z.object({
  vat_number: z.string().describe("VAT number with country prefix"),
  fiscal_code: optionalString(),
  name: z.string().describe("Company or person name"),
  address: addressSchema,
  pec: optionalString().describe("Certified email (PEC)"),
  customer_code: optionalString(),
});

const lineItemSchema = z.object({
  line_number: z.number().describe("Sequential line number starting from 1"),
  product_code: optionalString().describe("Product/article code"),
  description: z.string().describe("Product or service description"),
  quantity: z.number().describe("Quantity"),
  unit_of_measure: optionalString().describe("Unit (KG, LT, NR, etc.)"),
  unit_price: z.number().describe("Price per unit"),
  discount: optionalNumber().describe("Discount percentage or amount"),
  vat_rate: optionalNumber().describe("VAT rate percentage (e.g., 10, 22)"),
  vat_type: optionalString().describe("VAT type code"),
  line_total: z.number().describe("Total for this line (quantity * unit_price - discount)"),
  taxable_amount: optionalNumber(),
  vat_amount: optionalNumber(),
});

const vatRateSchema = z.object({
  rate: z.number().describe("VAT rate percentage"),
  rate_code: optionalString(),
  taxable_amount: z.number().describe("Taxable amount for this rate"),
  vat_amount: z.number().describe("VAT amount for this rate"),
});

const vatSummarySchema = z.object({
  vat_exigibility: optionalString().describe("VAT exigibility (I=immediate, D=deferred)"),
  vat_rates: z.array(vatRateSchema),
});

const totalsSchema = z.object({
  stamp_duty: optionalNumber(),
  virtual_stamp: optionalBoolean(),
  discount: optionalNumber(),
  rounding: optionalNumber(),
  subtotal: optionalNumber(),
  social_security_contribution_rate: optionalNumber().describe("Social security rate %"),
  social_security_contribution: optionalNumber().describe("Social security amount"),
  taxable_amount: optionalNumber(),
  total_taxable: optionalNumber().describe("Total taxable amount before VAT"),
  total_vat: optionalNumber().describe("Total VAT amount"),
  total_amount: z.number().describe("Final total including VAT"),
  num_packages: optionalNumber(),
  total_weight_kg: optionalNumber(),
  num_empties: optionalNumber(),
  sugar_kg: optionalNumber(),
});

const paymentDetailsSchema = z.object({
  payment_method: optionalString().describe("Payment method description"),
  payment_method_code: optionalString().describe("Payment method code (MP01, MP05, etc.)"),
  payment_method_description: optionalString(),
  bank_coordinates: optionalString().describe("IBAN or bank coordinates"),
  bank_name: optionalString(),
  iban: optionalString(),
  swift: optionalString(),
  account_holder: optionalString(),
  due_date: optionalString().describe("Payment due date (YYYY-MM-DD)"),
  amount: optionalNumber(),
  cash_paid: optionalNumber(),
  change: optionalNumber(),
  original_invoice_number: optionalString(),
});

const invoiceDetailsSchema = z.object({
  recipient_code: optionalString().describe("SDI recipient code"),
  article_73: optionalBoolean(),
  causale: optionalString().describe("Invoice reason/description"),
  copy_type: optionalString(),
  currency: optionalString(),
  purchase_order_number: optionalString(),
  supplier_number: optionalString(),
  tax_due_date: optionalString(),
  internal_reference: optionalString(),
  additional_reference: optionalString(),
  page_number: optionalNumber(),
});

const attachmentSchema = z.object({
  filename: z.string(),
  type: z.string(),
});

const transmissionDetailsSchema = z.object({
  sent_by: optionalString(),
  sent_date: optionalString(),
  tungsten_supplier_transaction: optionalString(),
  sdi_identifier: optionalString(),
  tn_supplier_number: optionalString(),
  tn_buyer_number: optionalString(),
  status: optionalString(),
});

const transportDetailsSchema = z.object({
  transport_document_number: optionalString(),
  transport_document_date: optionalString(),
  permit_date: optionalString(),
});

const contactInfoSchema = z.object({
  free_phone: optionalString(),
  phone_hours: optionalString(),
  promo_website: optionalString(),
});

const invoiceInfoSchema = z.object({
  supplier_registration_number: optionalString(),
  customer_registration_number: optionalString(),
  legal_form: optionalString(),
  tax_regime: optionalString(),
  permit_number: optionalString(),
});

export const invoiceSchema = z.object({
  invoice_id: z.string().describe("Invoice number/identifier"),
  document_type: z.string().describe("Document type (Fattura, TD24, Nota Pro-forma, etc.)"),
  document_date: z.string().describe("Invoice date in YYYY-MM-DD format"),
  supplier: supplierSchema.describe("Supplier/vendor information"),
  customer: customerSchema.describe("Customer/buyer information"),
  invoice_details: invoiceDetailsSchema.nullable().optional(),
  line_items: z.array(lineItemSchema).describe("Invoice line items/products"),
  vat_summary: vatSummarySchema.nullable().optional(),
  totals: totalsSchema.describe("Invoice totals"),
  payment_details: paymentDetailsSchema.nullable().optional(),
  attachments: z.array(attachmentSchema).nullable().optional(),
  transmission_details: transmissionDetailsSchema.nullable().optional(),
  transport_details: transportDetailsSchema.nullable().optional(),
  contact_info: contactInfoSchema.nullable().optional(),
  invoice_info: invoiceInfoSchema.nullable().optional(),
  notes: z.array(z.string()).nullable().optional().describe("Additional notes on the invoice"),
});

export type InvoiceSchema = z.infer<typeof invoiceSchema>;
