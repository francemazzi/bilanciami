import type { Address } from "./invoice.js";

export interface DdtParty {
  vat_number?: string | null;
  fiscal_code?: string | null;
  name: string;
  address?: Address | null;
  phone?: string | null;
  email?: string | null;
  pec?: string | null;
}

export interface DeliveryDestination {
  name?: string | null;
  address?: Address | null;
}

export interface DdtTransportDetails {
  reason?: string | null;
  goods_appearance?: string | null;
  packages?: number | null;
  gross_weight?: number | null;
  net_weight?: number | null;
  volume?: number | null;
  transport_by?: string | null;
  freight_terms?: string | null;
  transport_datetime?: string | null;
  carrier?: string | null;
}

export interface DdtLineItem {
  line_number: number;
  product_code?: string | null;
  description: string;
  quantity?: number | null;
  unit_of_measure?: string | null;
  order_reference?: string | null;
  lot?: string | null;
  destination?: string | null;
}

export interface DdtDocument {
  file_name: string;
  document_kind: "ddt";
  ddt_id: string;
  document_type: string;
  document_date: string;
  supplier: DdtParty;
  recipient: DdtParty;
  delivery_destination?: DeliveryDestination | null;
  transport_details?: DdtTransportDetails | null;
  line_items: DdtLineItem[];
  notes?: string[];
}
