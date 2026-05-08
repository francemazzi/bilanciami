import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { ArrowLeft, Edit, Save, X, Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Trash2, CheckCircle2, Circle, Mail, Copy, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { getDocument, getDocumentPdfUrl, updateDocumentMetadata, deleteDocument, updateDocumentDone, updateDocumentUserNotes, generateSollecito, type Document as DocType, type SollecitoResponse } from '@/api/documents';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { exportSingleDocument, type ExportFormat } from '@/lib/export';
import { ExportDropdown } from '@/components/documents/ExportDropdown';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Invoice {
  document_kind?: string;
  ddt_id?: string;
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
  recipient?: Invoice['customer'];
  delivery_destination?: {
    name?: string;
    address?: NonNullable<Invoice['customer']>['address'];
  };
  transport_details?: {
    reason?: string;
    goods_appearance?: string;
    packages?: number;
    gross_weight?: number;
    net_weight?: number;
    volume?: number;
    transport_by?: string;
    freight_terms?: string;
    transport_datetime?: string;
    carrier?: string;
  };
  line_items?: Array<{
    line_number?: number;
    product_code?: string;
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

  const [document, setDocument] = useState<DocType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMetadata, setEditedMetadata] = useState<Invoice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingSollecito, setIsSendingSollecito] = useState(false);
  const [sollecitoData, setSollecitoData] = useState<SollecitoResponse | null>(null);
  const [showSollecitoDialog, setShowSollecitoDialog] = useState(false);

  // PDF viewer state
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);

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

  const handleExport = (format: ExportFormat) => {
    if (document) {
      exportSingleDocument(document, format);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm('Sei sicuro di voler eliminare questo documento? L\'operazione non è reversibile.')) return;

    try {
      setIsDeleting(true);
      await deleteDocument(id);
      navigate(document?.documentKind === 'ddt' ? '/ddt' : '/documents');
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('Errore nell\'eliminazione del documento');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleDone = useCallback(async () => {
    if (!document || !id) return;
    const newDone = !document.done;
    setDocument((prev) => prev ? { ...prev, done: newDone } : prev);
    try {
      await updateDocumentDone(id, newDone);
      toast.success(newDone ? 'Segnato come fatto' : 'Segnato come da fare');
    } catch {
      setDocument((prev) => prev ? { ...prev, done: !newDone } : prev);
      toast.error('Errore nell\'aggiornamento');
    }
  }, [document, id]);

  const handleSollecito = useCallback(async () => {
    if (!id) return;

    try {
      setIsSendingSollecito(true);
      const result = await generateSollecito(id);
      setSollecitoData(result);
      setShowSollecitoDialog(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore nella generazione del sollecito';
      toast.error(message);
    } finally {
      setIsSendingSollecito(false);
    }
  }, [id]);

  const handleCopyField = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiato`);
    } catch {
      toast.error('Errore nella copia');
    }
  }, []);

  const handleSendSollecito = useCallback(() => {
    if (!sollecitoData) return;
    const mailtoUrl = `mailto:${encodeURIComponent(sollecitoData.emailTo)}?subject=${encodeURIComponent(sollecitoData.subject)}&body=${encodeURIComponent(sollecitoData.body)}`;
    const link = window.document.createElement('a');
    link.href = mailtoUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  }, [sollecitoData]);

  const [userNotes, setUserNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    if (document) {
      setUserNotes(document.userNotes || '');
    }
  }, [document]);

  const handleSaveNotes = useCallback(async () => {
    if (!id) return;
    try {
      setIsSavingNotes(true);
      const notes = userNotes.trim() || null;
      await updateDocumentUserNotes(id, notes);
      setDocument((prev) => prev ? { ...prev, userNotes: notes } : prev);
      toast.success('Note salvate');
    } catch {
      toast.error('Errore nel salvataggio delle note');
    } finally {
      setIsSavingNotes(false);
    }
  }, [id, userNotes]);

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
    setPdfError(null);
    setPdfLoaded(true);
  }

  function onDocumentLoadError(error: Error) {
    console.error('PDF load error:', error);
    setPdfLoaded(false);
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      setPdfError('Sessione scaduta. Ricarica la pagina o effettua nuovamente il login.');
    } else {
      setPdfError('Errore nel caricamento del PDF');
    }
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
  const isDdt = document.documentKind === 'ddt' || invoice.document_kind === 'ddt';
  const recipient = isDdt ? invoice.recipient : invoice.customer;
  const backPath = isDdt ? '/ddt' : '/documents';
  const documentNumber = isDdt ? invoice.ddt_id : invoice.invoice_id;
  const pdfUrl = document.pdfStoragePath ? getDocumentPdfUrl(document.id) : null;

  return (
    <div className="container py-4 md:py-8 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(backPath)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-bold truncate">
              {isDdt ? 'DDT' : 'Fattura'} {documentNumber || document.fileName}
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              {document.supplierName} - {document.customerName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                <X className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Annulla</span>
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                ) : (
                  <Save className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">Salva</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant={document.done ? 'default' : 'outline'}
                onClick={handleToggleDone}
                className={document.done ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {document.done ? (
                  <CheckCircle2 className="h-4 w-4 sm:mr-2" />
                ) : (
                  <Circle className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">{document.done ? 'Fatto' : 'Da fare'}</span>
              </Button>
              <ExportDropdown onExport={handleExport} />
              {!isDdt && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSollecito}
                  disabled={isSendingSollecito}
                >
                  {isSendingSollecito ? (
                    <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                  ) : (
                    <Mail className="h-4 w-4 sm:mr-2" />
                  )}
                  <span className="hidden sm:inline">Sollecito</span>
                </Button>
              )}
              <Button size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Modifica</span>
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">Elimina</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* PDF Viewer */}
        <div className="border rounded-lg overflow-hidden bg-gray-100 order-2 lg:order-1">
          {pdfUrl ? (
            <div className="flex flex-col h-[400px] sm:h-[500px] lg:h-[700px]">
              {/* PDF Controls */}
              <div className="flex items-center justify-between p-2 bg-white border-b">
                <div className="flex items-center gap-1 sm:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs sm:text-sm min-w-[60px] text-center">
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
                <div className="flex items-center gap-1 sm:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-xs sm:text-sm min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
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
                {pdfError ? (
                  <div className="flex items-center justify-center h-full text-red-600 p-4 text-center">
                    {pdfError}
                  </div>
                ) : (
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={<Loader2 className="h-8 w-8 animate-spin" />}
                    error={
                      <div className="flex items-center justify-center h-full text-red-600 p-4 text-center">
                        Errore nel caricamento del PDF
                      </div>
                    }
                    options={{
                      withCredentials: true,
                    }}
                  >
                    {pdfLoaded && <Page pageNumber={currentPage} scale={scale} />}
                  </Document>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] sm:h-[300px] lg:h-[700px] text-gray-500">
              PDF non disponibile
            </div>
          )}
        </div>

        {/* Invoice Data */}
        <div className="space-y-4 overflow-y-auto lg:max-h-[700px] order-1 lg:order-2">
          {/* Info generali */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-lg">Informazioni documento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field
                label={isDdt ? "Numero DDT" : "Numero fattura"}
                value={documentNumber}
                path={isDdt ? "ddt_id" : "invoice_id"}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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

          {/* Cliente / destinatario */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-lg">{isDdt ? 'Destinatario' : 'Cliente'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field
                label="Nome"
                value={recipient?.name}
                path={isDdt ? "recipient.name" : "customer.name"}
                isEditing={isEditing}
                onChange={updateField}
              />
              <Field
                label="P.IVA"
                value={recipient?.vat_number}
                path={isDdt ? "recipient.vat_number" : "customer.vat_number"}
                isEditing={isEditing}
                onChange={updateField}
              />
              <Field
                label="Indirizzo"
                value={recipient?.address?.street}
                path={isDdt ? "recipient.address.street" : "customer.address.street"}
                isEditing={isEditing}
                onChange={updateField}
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Field
                  label="Città"
                  value={recipient?.address?.city}
                  path={isDdt ? "recipient.address.city" : "customer.address.city"}
                  isEditing={isEditing}
                  onChange={updateField}
                />
                <Field
                  label="Prov"
                  value={recipient?.address?.province}
                  path={isDdt ? "recipient.address.province" : "customer.address.province"}
                  isEditing={isEditing}
                  onChange={updateField}
                />
                <Field
                  label="CAP"
                  value={recipient?.address?.postal_code}
                  path={isDdt ? "recipient.address.postal_code" : "customer.address.postal_code"}
                  isEditing={isEditing}
                  onChange={updateField}
                />
              </div>
            </CardContent>
          </Card>

          {isDdt ? (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-lg">Trasporto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field
                  label="Causale"
                  value={invoice.transport_details?.reason}
                  path="transport_details.reason"
                  isEditing={isEditing}
                  onChange={updateField}
                />
                <Field
                  label="Aspetto beni"
                  value={invoice.transport_details?.goods_appearance}
                  path="transport_details.goods_appearance"
                  isEditing={isEditing}
                  onChange={updateField}
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Field
                    label="Colli"
                    value={invoice.transport_details?.packages}
                    path="transport_details.packages"
                    type="number"
                    isEditing={isEditing}
                    onChange={updateField}
                  />
                  <Field
                    label="Peso lordo"
                    value={invoice.transport_details?.gross_weight}
                    path="transport_details.gross_weight"
                    type="number"
                    isEditing={isEditing}
                    onChange={updateField}
                  />
                  <Field
                    label="Peso netto"
                    value={invoice.transport_details?.net_weight}
                    path="transport_details.net_weight"
                    type="number"
                    isEditing={isEditing}
                    onChange={updateField}
                  />
                </div>
                <Field
                  label="Trasporto a cura"
                  value={invoice.transport_details?.transport_by}
                  path="transport_details.transport_by"
                  isEditing={isEditing}
                  onChange={updateField}
                />
                <Field
                  label="Porto"
                  value={invoice.transport_details?.freight_terms}
                  path="transport_details.freight_terms"
                  isEditing={isEditing}
                  onChange={updateField}
                />
                <Field
                  label="Data e ora trasporto"
                  value={invoice.transport_details?.transport_datetime}
                  path="transport_details.transport_datetime"
                  isEditing={isEditing}
                  onChange={updateField}
                />
              </CardContent>
            </Card>
          ) : (
            <>
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
            </>
          )}

          {/* Righe documento */}
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
                        {isDdt ? (
                          <>
                            {item.product_code && `${item.product_code} - `}
                            {item.quantity ?? '-'} {item.unit_of_measure || ''}
                          </>
                        ) : (
                          <>
                            {item.quantity} {item.unit_of_measure} x {formatCurrency(item.unit_price || 0)} = {formatCurrency(item.line_total || 0)}
                            {item.vat_rate && ` (IVA ${item.vat_rate}%)`}
                          </>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Note utente */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-lg">Note personali</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder={isDdt ? "Aggiungi note su questo DDT..." : "Aggiungi note su questa fattura..."}
                rows={3}
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes || userNotes === (document.userNotes || '')}
                >
                  {isSavingNotes ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salva note
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sollecito Dialog */}
      <Dialog open={showSollecitoDialog} onOpenChange={setShowSollecitoDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sollecito di pagamento</DialogTitle>
            <DialogDescription>
              Email generata automaticamente. Puoi copiare i campi o inviare direttamente.
            </DialogDescription>
          </DialogHeader>

          {sollecitoData && (
            <div className="space-y-4">
              {/* Destinatario */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Destinatario</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleCopyField(sollecitoData.emailTo, 'Destinatario')}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copia
                  </Button>
                </div>
                <input
                  type="email"
                  value={sollecitoData.emailTo}
                  onChange={(e) => setSollecitoData({ ...sollecitoData, emailTo: e.target.value })}
                  placeholder="Inserisci indirizzo email..."
                  className="w-full px-3 py-2 bg-gray-50 rounded-md text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Oggetto */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Oggetto</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleCopyField(sollecitoData.subject, 'Oggetto')}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copia
                  </Button>
                </div>
                <div className="px-3 py-2 bg-gray-50 rounded-md text-sm border">
                  {sollecitoData.subject}
                </div>
              </div>

              {/* Corpo */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Corpo email</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleCopyField(sollecitoData.body, 'Corpo email')}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copia
                  </Button>
                </div>
                <div className="px-3 py-2 bg-gray-50 rounded-md text-sm border whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {sollecitoData.body}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSollecitoDialog(false)}>
              Chiudi
            </Button>
            <Button onClick={handleSendSollecito}>
              <Send className="h-4 w-4 mr-2" />
              Invia email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
