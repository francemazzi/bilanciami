export type DocumentKind = "invoice" | "ddt";

export interface DocumentClassification {
  documentKind: DocumentKind;
  confidence: number;
  reason?: string;
}
