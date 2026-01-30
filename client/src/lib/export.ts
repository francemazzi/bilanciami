import * as XLSX from 'xlsx';
import {
  Document as DocxDocument,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  Packer,
  WidthType,
  HeadingLevel,
  BorderStyle,
} from 'docx';
import { saveAs } from 'file-saver';
import type { Document as DocType } from '@/api/documents';
import { formatCurrency, formatDate } from './formatters';

export type ExportFormat = 'csv' | 'xlsx' | 'docx';

// Struttura per i dati della tabella (export multiplo)
interface ExportableRow {
  fileName: string;
  supplierName: string;
  customerName: string;
  invoiceId: string;
  documentDate: string;
  dueDate: string;
  totalAmount: string;
  vatAmount: string;
  taxableAmount: string;
  paymentMethod: string;
  iban: string;
}

// Headers per export tabella
const TABLE_HEADERS: Record<keyof ExportableRow, string> = {
  fileName: 'Nome File',
  supplierName: 'Fornitore',
  customerName: 'Cliente',
  invoiceId: 'N. Fattura',
  documentDate: 'Data Documento',
  dueDate: 'Scadenza',
  totalAmount: 'Totale',
  vatAmount: 'IVA',
  taxableAmount: 'Imponibile',
  paymentMethod: 'Metodo Pagamento',
  iban: 'IBAN',
};

// Struttura per export singolo documento (dettagliato)
interface DetailedExportData {
  fileName: string;
  invoiceId: string;
  documentType: string;
  documentDate: string;
  supplierName: string;
  supplierVat: string;
  supplierFiscalCode: string;
  supplierAddress: string;
  supplierCity: string;
  supplierProvince: string;
  supplierPostalCode: string;
  supplierPhone: string;
  supplierEmail: string;
  customerName: string;
  customerVat: string;
  customerFiscalCode: string;
  customerAddress: string;
  customerCity: string;
  customerProvince: string;
  customerPostalCode: string;
  customerPec: string;
  taxableAmount: string;
  vatAmount: string;
  totalAmount: string;
  paymentMethod: string;
  dueDate: string;
  iban: string;
  bankName: string;
  lineItems: Array<{
    lineNumber: number;
    description: string;
    quantity: number;
    unitOfMeasure: string;
    unitPrice: string;
    vatRate: string;
    lineTotal: string;
  }>;
  notes: string[];
}

// Helper per estrarre dati dal metadata
function extractMetadata(doc: DocType): Record<string, unknown> {
  return (doc.metadata as Record<string, unknown>) || {};
}

// Trasforma un documento in riga esportabile (per tabella)
function documentToExportRow(doc: DocType): ExportableRow {
  const metadata = extractMetadata(doc);
  const totals = (metadata.totals as Record<string, unknown>) || {};
  const payment = (metadata.payment_details as Record<string, unknown>) || {};

  return {
    fileName: doc.fileName,
    supplierName: doc.supplierName,
    customerName: doc.customerName,
    invoiceId: (metadata.invoice_id as string) || doc.invoiceId || '-',
    documentDate: formatDate(doc.documentDate || (metadata.document_date as string)),
    dueDate: formatDate(doc.dueDate || (payment.due_date as string)),
    totalAmount: formatCurrency(
      doc.totalAmount ? parseFloat(doc.totalAmount) : (totals.total_amount as number)
    ),
    vatAmount: formatCurrency(totals.total_vat as number),
    taxableAmount: formatCurrency(totals.total_taxable as number),
    paymentMethod: (payment.payment_method as string) || '-',
    iban: (payment.iban as string) || '-',
  };
}

// Trasforma un documento in dati dettagliati (per singolo export)
function documentToDetailedData(doc: DocType): DetailedExportData {
  const metadata = extractMetadata(doc);
  const supplier = (metadata.supplier as Record<string, unknown>) || {};
  const supplierAddress = (supplier.address as Record<string, unknown>) || {};
  const customer = (metadata.customer as Record<string, unknown>) || {};
  const customerAddress = (customer.address as Record<string, unknown>) || {};
  const totals = (metadata.totals as Record<string, unknown>) || {};
  const payment = (metadata.payment_details as Record<string, unknown>) || {};
  const lineItems = (metadata.line_items as Array<Record<string, unknown>>) || [];
  const notes = (metadata.notes as string[]) || [];

  return {
    fileName: doc.fileName,
    invoiceId: (metadata.invoice_id as string) || '-',
    documentType: (metadata.document_type as string) || '-',
    documentDate: formatDate(metadata.document_date as string),

    supplierName: (supplier.name as string) || doc.supplierName,
    supplierVat: (supplier.vat_number as string) || '-',
    supplierFiscalCode: (supplier.fiscal_code as string) || '-',
    supplierAddress: (supplierAddress.street as string) || '-',
    supplierCity: (supplierAddress.city as string) || '-',
    supplierProvince: (supplierAddress.province as string) || '-',
    supplierPostalCode: (supplierAddress.postal_code as string) || '-',
    supplierPhone: (supplier.phone as string) || '-',
    supplierEmail: (supplier.email as string) || '-',

    customerName: (customer.name as string) || doc.customerName,
    customerVat: (customer.vat_number as string) || '-',
    customerFiscalCode: (customer.fiscal_code as string) || '-',
    customerAddress: (customerAddress.street as string) || '-',
    customerCity: (customerAddress.city as string) || '-',
    customerProvince: (customerAddress.province as string) || '-',
    customerPostalCode: (customerAddress.postal_code as string) || '-',
    customerPec: (customer.pec as string) || '-',

    taxableAmount: formatCurrency(totals.total_taxable as number),
    vatAmount: formatCurrency(totals.total_vat as number),
    totalAmount: formatCurrency(totals.total_amount as number),

    paymentMethod: (payment.payment_method as string) || '-',
    dueDate: formatDate(payment.due_date as string),
    iban: (payment.iban as string) || '-',
    bankName: (payment.bank_name as string) || '-',

    lineItems: lineItems.map((item, index) => ({
      lineNumber: (item.line_number as number) || index + 1,
      description: (item.description as string) || '-',
      quantity: (item.quantity as number) || 0,
      unitOfMeasure: (item.unit_of_measure as string) || '-',
      unitPrice: formatCurrency(item.unit_price as number),
      vatRate: item.vat_rate ? `${item.vat_rate}%` : '-',
      lineTotal: formatCurrency(item.line_total as number),
    })),

    notes,
  };
}

// --- EXPORT MULTIPLO (TABELLA) ---

function exportToCSV(documents: DocType[], fileName: string): void {
  const rows = documents.map(documentToExportRow);

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: Object.keys(TABLE_HEADERS) as (keyof ExportableRow)[],
  });

  // Rinomina headers
  const headerRow = Object.values(TABLE_HEADERS);
  XLSX.utils.sheet_add_aoa(ws, [headerRow], { origin: 'A1' });

  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, `${fileName}.csv`);
}

function exportToExcel(documents: DocType[], fileName: string): void {
  const rows = documents.map(documentToExportRow);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: Object.keys(TABLE_HEADERS) as (keyof ExportableRow)[],
  });

  // Rinomina headers
  const headerRow = Object.values(TABLE_HEADERS);
  XLSX.utils.sheet_add_aoa(ws, [headerRow], { origin: 'A1' });

  // Imposta larghezza colonne
  ws['!cols'] = [
    { wch: 30 },
    { wch: 25 },
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 12 },
    { wch: 15 },
    { wch: 20 },
    { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Documenti');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `${fileName}.xlsx`);
}

function exportMultipleToWord(documents: DocType[], fileName: string): void {
  const rows = documents.map(documentToExportRow);

  const noBorder = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: Object.values(TABLE_HEADERS).map(
          (header) =>
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 20 })] }),
              ],
              borders: noBorder,
            })
        ),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: Object.values(row).map(
              (value) =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: value, size: 18 })] })],
                  borders: noBorder,
                })
            ),
          })
      ),
    ],
  });

  const wordDoc = new DocxDocument({
    sections: [
      {
        children: [
          new Paragraph({
            text: 'Elenco Documenti',
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 400 },
          }),
          new Paragraph({
            text: `Esportati ${documents.length} documenti`,
            spacing: { after: 200 },
          }),
          table,
        ],
      },
    ],
  });

  Packer.toBlob(wordDoc).then((blob) => {
    saveAs(blob, `${fileName}.docx`);
  });
}

// --- EXPORT SINGOLO (DETTAGLIATO) ---

function exportSingleToCSV(doc: DocType, fileName: string): void {
  const data = documentToDetailedData(doc);
  const rows: string[][] = [
    ['Campo', 'Valore'],
    ['Numero Fattura', data.invoiceId],
    ['Tipo Documento', data.documentType],
    ['Data Documento', data.documentDate],
    ['', ''],
    ['FORNITORE', ''],
    ['Nome', data.supplierName],
    ['P.IVA', data.supplierVat],
    ['Codice Fiscale', data.supplierFiscalCode],
    ['Indirizzo', data.supplierAddress],
    ['Città', data.supplierCity],
    ['Provincia', data.supplierProvince],
    ['CAP', data.supplierPostalCode],
    ['Telefono', data.supplierPhone],
    ['Email', data.supplierEmail],
    ['', ''],
    ['CLIENTE', ''],
    ['Nome', data.customerName],
    ['P.IVA', data.customerVat],
    ['Codice Fiscale', data.customerFiscalCode],
    ['Indirizzo', data.customerAddress],
    ['Città', data.customerCity],
    ['Provincia', data.customerProvince],
    ['CAP', data.customerPostalCode],
    ['PEC', data.customerPec],
    ['', ''],
    ['TOTALI', ''],
    ['Imponibile', data.taxableAmount],
    ['IVA', data.vatAmount],
    ['Totale', data.totalAmount],
    ['', ''],
    ['PAGAMENTO', ''],
    ['Metodo', data.paymentMethod],
    ['Scadenza', data.dueDate],
    ['IBAN', data.iban],
    ['Banca', data.bankName],
  ];

  if (data.lineItems.length > 0) {
    rows.push(['', '']);
    rows.push(['RIGHE FATTURA', '']);
    rows.push(['#', 'Descrizione', 'Qtà', 'U.M.', 'Prezzo', 'IVA', 'Totale']);
    data.lineItems.forEach((item) => {
      rows.push([
        String(item.lineNumber),
        item.description,
        String(item.quantity),
        item.unitOfMeasure,
        item.unitPrice,
        item.vatRate,
        item.lineTotal,
      ]);
    });
  }

  if (data.notes.length > 0) {
    rows.push(['', '']);
    rows.push(['NOTE', '']);
    data.notes.forEach((note) => {
      rows.push([note, '']);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, `${fileName}.csv`);
}

function exportSingleToExcel(doc: DocType, fileName: string): void {
  const data = documentToDetailedData(doc);
  const wb = XLSX.utils.book_new();

  // Sheet 1: Info generali
  const infoRows = [
    ['INFORMAZIONI DOCUMENTO', ''],
    ['Numero Fattura', data.invoiceId],
    ['Tipo', data.documentType],
    ['Data', data.documentDate],
    ['File', data.fileName],
    ['', ''],
    ['FORNITORE', ''],
    ['Nome', data.supplierName],
    ['P.IVA', data.supplierVat],
    ['Codice Fiscale', data.supplierFiscalCode],
    ['Indirizzo', `${data.supplierAddress}, ${data.supplierPostalCode} ${data.supplierCity} (${data.supplierProvince})`],
    ['Telefono', data.supplierPhone],
    ['Email', data.supplierEmail],
    ['', ''],
    ['CLIENTE', ''],
    ['Nome', data.customerName],
    ['P.IVA', data.customerVat],
    ['Codice Fiscale', data.customerFiscalCode],
    ['Indirizzo', `${data.customerAddress}, ${data.customerPostalCode} ${data.customerCity} (${data.customerProvince})`],
    ['PEC', data.customerPec],
    ['', ''],
    ['TOTALI', ''],
    ['Imponibile', data.taxableAmount],
    ['IVA', data.vatAmount],
    ['Totale', data.totalAmount],
    ['', ''],
    ['PAGAMENTO', ''],
    ['Metodo', data.paymentMethod],
    ['Scadenza', data.dueDate],
    ['IBAN', data.iban],
    ['Banca', data.bankName],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(infoRows);
  wsInfo['!cols'] = [{ wch: 20 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Info');

  // Sheet 2: Righe fattura
  if (data.lineItems.length > 0) {
    const lineHeaders = ['#', 'Descrizione', 'Quantità', 'U.M.', 'Prezzo', 'IVA', 'Totale'];
    const lineRows = data.lineItems.map((item) => [
      item.lineNumber,
      item.description,
      item.quantity,
      item.unitOfMeasure,
      item.unitPrice,
      item.vatRate,
      item.lineTotal,
    ]);
    const wsLines = XLSX.utils.aoa_to_sheet([lineHeaders, ...lineRows]);
    wsLines['!cols'] = [{ wch: 5 }, { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsLines, 'Righe');
  }

  // Sheet 3: Note
  if (data.notes.length > 0) {
    const noteRows = data.notes.map((note) => [note]);
    const wsNotes = XLSX.utils.aoa_to_sheet([['Note'], ...noteRows]);
    XLSX.utils.book_append_sheet(wb, wsNotes, 'Note');
  }

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `${fileName}.xlsx`);
}

function exportSingleToWord(doc: DocType, fileName: string): void {
  const data = documentToDetailedData(doc);

  const createField = (label: string, value: string): Paragraph => {
    return new Paragraph({
      children: [
        new TextRun({ text: `${label}: `, bold: true }),
        new TextRun({ text: value }),
      ],
      spacing: { after: 100 },
    });
  };

  const noBorder = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };

  const lineItemsTable =
    data.lineItems.length > 0
      ? new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: ['#', 'Descrizione', 'Qtà', 'Prezzo', 'IVA', 'Totale'].map(
                (header) =>
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: header, bold: true })] }),
                    ],
                    borders: noBorder,
                  })
              ),
            }),
            ...data.lineItems.map(
              (item) =>
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph(String(item.lineNumber))],
                      borders: noBorder,
                    }),
                    new TableCell({
                      children: [new Paragraph(item.description)],
                      borders: noBorder,
                    }),
                    new TableCell({
                      children: [new Paragraph(`${item.quantity} ${item.unitOfMeasure}`)],
                      borders: noBorder,
                    }),
                    new TableCell({ children: [new Paragraph(item.unitPrice)], borders: noBorder }),
                    new TableCell({ children: [new Paragraph(item.vatRate)], borders: noBorder }),
                    new TableCell({ children: [new Paragraph(item.lineTotal)], borders: noBorder }),
                  ],
                })
            ),
          ],
        })
      : null;

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      text: `Fattura ${data.invoiceId}`,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 400 },
    }),

    new Paragraph({ text: 'Informazioni Documento', heading: HeadingLevel.HEADING_2 }),
    createField('Tipo documento', data.documentType),
    createField('Data documento', data.documentDate),
    createField('File', data.fileName),

    new Paragraph({
      text: 'Fornitore',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400 },
    }),
    createField('Nome', data.supplierName),
    createField('P.IVA', data.supplierVat),
    createField('Codice Fiscale', data.supplierFiscalCode),
    createField(
      'Indirizzo',
      `${data.supplierAddress}, ${data.supplierPostalCode} ${data.supplierCity} (${data.supplierProvince})`
    ),
    createField('Telefono', data.supplierPhone),
    createField('Email', data.supplierEmail),

    new Paragraph({
      text: 'Cliente',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400 },
    }),
    createField('Nome', data.customerName),
    createField('P.IVA', data.customerVat),
    createField('Codice Fiscale', data.customerFiscalCode),
    createField(
      'Indirizzo',
      `${data.customerAddress}, ${data.customerPostalCode} ${data.customerCity} (${data.customerProvince})`
    ),
    createField('PEC', data.customerPec),

    new Paragraph({ text: 'Totali', heading: HeadingLevel.HEADING_2, spacing: { before: 400 } }),
    createField('Imponibile', data.taxableAmount),
    createField('IVA', data.vatAmount),
    createField('Totale', data.totalAmount),

    new Paragraph({ text: 'Pagamento', heading: HeadingLevel.HEADING_2, spacing: { before: 400 } }),
    createField('Metodo', data.paymentMethod),
    createField('Scadenza', data.dueDate),
    createField('IBAN', data.iban),
    createField('Banca', data.bankName),
  ];

  if (lineItemsTable) {
    children.push(
      new Paragraph({
        text: 'Righe Fattura',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400 },
      })
    );
    children.push(lineItemsTable);
  }

  if (data.notes.length > 0) {
    children.push(
      new Paragraph({ text: 'Note', heading: HeadingLevel.HEADING_2, spacing: { before: 400 } })
    );
    data.notes.forEach((note) => {
      children.push(new Paragraph({ text: note, spacing: { after: 100 } }));
    });
  }

  const wordDoc = new DocxDocument({
    sections: [{ children }],
  });

  Packer.toBlob(wordDoc).then((blob) => {
    saveAs(blob, `${fileName}.docx`);
  });
}

// --- FUNZIONI PUBBLICHE ---

export function exportDocuments(
  documents: DocType[],
  format: ExportFormat,
  fileName = 'documenti'
): void {
  switch (format) {
    case 'csv':
      exportToCSV(documents, fileName);
      break;
    case 'xlsx':
      exportToExcel(documents, fileName);
      break;
    case 'docx':
      exportMultipleToWord(documents, fileName);
      break;
  }
}

export function exportSingleDocument(document: DocType, format: ExportFormat): void {
  const baseName = document.fileName.replace(/\.[^/.]+$/, '') || 'documento';

  switch (format) {
    case 'csv':
      exportSingleToCSV(document, baseName);
      break;
    case 'xlsx':
      exportSingleToExcel(document, baseName);
      break;
    case 'docx':
      exportSingleToWord(document, baseName);
      break;
  }
}
