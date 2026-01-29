import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { ArrowLeft, Edit, Save, X, Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDocument, getDocumentPdfUrl, updateDocumentMetadata, type Document as DocType } from '@/api/documents';
import { formatCurrency } from '@/lib/formatters';
import { useAuthStore } from '@/stores/auth.store';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Invoice {
  invoice_id?: string;
  document_type?: string;
  document_date?: string;
  supplier?: {
    name?: string;
    vat_number?: string;
    fiscal_code?: string;
    address?: {
      street?: string;
      city?: string;
      province?: string;
      postal_code?: string;
    };
    phone?: string;
    email?: string;
  };
  customer?: {
    name?: string;
    vat_number?: string;
    fiscal_code?: string;
    address?: {
      street?: string;
      city?: string;
      province?: string;
      postal_code?: string;
    };
    pec?: string;
  };
  line_items?: Array<{
    line_number?: number;
    description?: string;
    quantity?: number;
    unit_of_measure?: string;
    unit_price?: number;
    vat_rate?: number;
    line_total?: number;
  }>;
  totals?: {
    total_taxable?: number;
    total_vat?: number;
    total_amount?: number;
  };
  payment_details?: {
    payment_method?: string;
    due_date?: string;
    amount?: number;
    iban?: string;
    bank_name?: string;
  };
  notes?: string[];
}

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();

  const [document, setDocument] = useState<DocType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMetadata, setEditedMetadata] = useState<Invoice | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // PDF viewer state
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);

  useEffect(() => {
    async function loadDocument() {
      if (!id) return;

      try {
        setIsLoading(true);
        const doc = await getDocument(id);
        setDocument(doc);
        setEditedMetadata(doc.metadata as Invoice || {});
      } catch (err) {
        setError('Errore nel caricamento del documento');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDocument();
  }, [id]);

  const handleSave = async () => {
    if (!id || !editedMetadata) return;

    try {
      setIsSaving(true);
      await updateDocumentMetadata(id, editedMetadata as Record<string, unknown>);
      setDocument((prev) => prev ? { ...prev, metadata: editedMetadata as Record<string, unknown> } : prev);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Errore nel salvataggio');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedMetadata(document?.metadata as Invoice || {});
    setIsEditing(false);
  };

  const updateField = (path: string, value: unknown) => {
    setEditedMetadata((prev) => {
      if (!prev) return prev;

      const parts = path.split('.');
      const newData = { ...prev };
      let current: Record<string, unknown> = newData;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!(part in current) || typeof current[part] !== 'object') {
          current[part] = {};
        }
        current[part] = { ...(current[part] as Record<string, unknown>) };
        current = current[part] as Record<string, unknown>;
      }

      current[parts[parts.length - 1]] = value;
      return newData;
    });
  };

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  if (isLoading) {
    return (
      <div className="container py-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="container py-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Documento non trovato'}</p>
          <Button asChild variant="outline">
            <Link to="/documents">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Torna ai documenti
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const invoice = (isEditing ? editedMetadata : document.metadata) as Invoice || {};
  const pdfUrl = document.pdfStoragePath ? getDocumentPdfUrl(document.id) : null;

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/documents')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              Fattura {invoice.invoice_id || document.fileName}
            </h1>
            <p className="text-muted-foreground">
              {document.supplierName} - {document.customerName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                <X className="mr-2 h-4 w-4" />
                Annulla
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salva
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Modifica
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PDF Viewer */}
        <div className="border rounded-lg overflow-hidden bg-gray-100">
          {pdfUrl ? (
            <div className="flex flex-col h-[700px]">
              {/* PDF Controls */}
              <div className="flex items-center justify-between p-2 bg-white border-b">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    {currentPage} / {numPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                    disabled={currentPage >= numPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">{Math.round(scale * 100)}%</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScale((s) => Math.min(2, s + 0.1))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {/* PDF Document */}
              <div className="flex-1 overflow-auto p-4">
                <Document
                  file={pdfUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={<Loader2 className="h-8 w-8 animate-spin" />}
                  options={{
                    httpHeaders: {
                      Authorization: `Bearer ${accessToken}`,
                    },
                  }}
                >
                  <Page pageNumber={currentPage} scale={scale} />
                </Document>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[700px] text-gray-500">
              PDF non disponibile
            </div>
          )}
        </div>

        {/* Invoice Data */}
        <div className="space-y-4 overflow-y-auto max-h-[700px]">
          {/* Info generali */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-lg">Informazioni documento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field
                label="Numero fattura"
                value={invoice.invoice_id}
                path="invoice_id"
                isEditing={isEditing}
                onChange={updateField}
              />
              <Field
                label="Tipo documento"
                value={invoice.document_type}
                path="document_type"
                isEditing={isEditing}
                onChange={updateField}
              />
              <Field
                label="Data documento"
                value={invoice.document_date}
                path="document_date"
                type="date"
                isEditing={isEditing}
                onChange={updateField}
              />
            </CardContent>
          </Card>

          {/* Fornitore */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-lg">Fornitore</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field
                label="Nome"
                value={invoice.supplier?.name}
                path="supplier.name"
                isEditing={isEditing}
                onChange={updateField}
              />
              <Field
                label="P.IVA"
                value={invoice.supplier?.vat_number}
                path="supplier.vat_number"
                isEditing={isEditing}
                onChange={updateField}
              />
              <Field
                label="Indirizzo"
                value={invoice.supplier?.address?.street}
                path="supplier.address.street"
                isEditing={isEditing}
                onChange={updateField}
              />
              <div className="grid grid-cols-3 gap-2">
                <Field
                  label="Città"
                  value={invoice.supplier?.address?.city}
                  path="supplier.address.city"
                  isEditing={isEditing}
                  onChange={updateField}
                />
                <Field
                  label="Prov"
                  value={invoice.supplier?.address?.province}
                  path="supplier.address.province"
                  isEditing={isEditing}
                  onChange={updateField}
                />
                <Field
                  label="CAP"
                  value={invoice.supplier?.address?.postal_code}
                  path="supplier.address.postal_code"
                  isEditing={isEditing}
                  onChange={updateField}
                />
              </div>
            </CardContent>
          </Card>

          {/* Cliente */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-lg">Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field
                label="Nome"
                value={invoice.customer?.name}
                path="customer.name"
                isEditing={isEditing}
                onChange={updateField}
              />
              <Field
                label="P.IVA"
                value={invoice.customer?.vat_number}
                path="customer.vat_number"
                isEditing={isEditing}
                onChange={updateField}
              />
              <Field
                label="Indirizzo"
                value={invoice.customer?.address?.street}
                path="customer.address.street"
                isEditing={isEditing}
                onChange={updateField}
              />
              <div className="grid grid-cols-3 gap-2">
                <Field
                  label="Città"
                  value={invoice.customer?.address?.city}
                  path="customer.address.city"
                  isEditing={isEditing}
                  onChange={updateField}
                />
                <Field
                  label="Prov"
                  value={invoice.customer?.address?.province}
                  path="customer.address.province"
                  isEditing={isEditing}
                  onChange={updateField}
                />
                <Field
                  label="CAP"
                  value={invoice.customer?.address?.postal_code}
                  path="customer.address.postal_code"
                  isEditing={isEditing}
                  onChange={updateField}
                />
              </div>
            </CardContent>
          </Card>

          {/* Totali */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-lg">Totali</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field
                label="Imponibile"
                value={invoice.totals?.total_taxable}
                path="totals.total_taxable"
                type="number"
                isEditing={isEditing}
                onChange={updateField}
                formatter={(v) => formatCurrency(Number(v))}
              />
              <Field
                label="IVA"
                value={invoice.totals?.total_vat}
                path="totals.total_vat"
                type="number"
                isEditing={isEditing}
                onChange={updateField}
                formatter={(v) => formatCurrency(Number(v))}
              />
              <Field
                label="Totale"
                value={invoice.totals?.total_amount}
                path="totals.total_amount"
                type="number"
                isEditing={isEditing}
                onChange={updateField}
                formatter={(v) => formatCurrency(Number(v))}
              />
            </CardContent>
          </Card>

          {/* Pagamento */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-lg">Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field
                label="Metodo"
                value={invoice.payment_details?.payment_method}
                path="payment_details.payment_method"
                isEditing={isEditing}
                onChange={updateField}
              />
              <Field
                label="Scadenza"
                value={invoice.payment_details?.due_date}
                path="payment_details.due_date"
                type="date"
                isEditing={isEditing}
                onChange={updateField}
              />
              <Field
                label="IBAN"
                value={invoice.payment_details?.iban}
                path="payment_details.iban"
                isEditing={isEditing}
                onChange={updateField}
              />
            </CardContent>
          </Card>

          {/* Righe fattura */}
          {invoice.line_items && invoice.line_items.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-lg">Righe ({invoice.line_items.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {invoice.line_items.map((item, index) => (
                    <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-gray-600">
                        {item.quantity} {item.unit_of_measure} x {formatCurrency(item.unit_price || 0)} = {formatCurrency(item.line_total || 0)}
                        {item.vat_rate && ` (IVA ${item.vat_rate}%)`}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// Field component for editable/readonly display
interface FieldProps {
  label: string;
  value: unknown;
  path: string;
  type?: 'text' | 'number' | 'date';
  isEditing: boolean;
  onChange: (path: string, value: unknown) => void;
  formatter?: (value: unknown) => string;
}

function Field({ label, value, path, type = 'text', isEditing, onChange, formatter }: FieldProps) {
  const displayValue = value != null ? String(value) : '';
  const formattedValue = formatter && value != null ? formatter(value) : displayValue;

  if (isEditing) {
    return (
      <div>
        <label className="text-xs text-gray-500">{label}</label>
        <input
          type={type}
          value={displayValue}
          onChange={(e) => {
            const newValue = type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
            onChange(path, newValue);
          }}
          className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    );
  }

  return (
    <div>
      <span className="text-xs text-gray-500">{label}</span>
      <p className="text-sm font-medium">{formattedValue || '-'}</p>
    </div>
  );
}
