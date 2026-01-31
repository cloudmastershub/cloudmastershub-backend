import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import logger from '../utils/logger';

export interface ExportResult {
  content: string | Buffer;
  contentType: string;
  filename: string;
}

interface ReportColumn {
  label: string;
  key: string;
}

/**
 * Generate CSV content from data
 */
export const generateCSV = (data: any[], fields?: string[]): string => {
  try {
    if (!data || data.length === 0) {
      return '';
    }

    // Auto-detect fields from first item if not provided
    const actualFields = fields || Object.keys(data[0]);

    const parser = new Parser({ fields: actualFields });
    return parser.parse(data);
  } catch (error) {
    logger.error('Failed to generate CSV:', error);
    throw new Error('Failed to generate CSV');
  }
};

/**
 * Generate PDF content from data
 */
export const generatePDF = async (
  title: string,
  data: any[],
  columns: ReportColumn[]
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' });
      doc.moveDown(0.5);

      // Metadata
      doc.fontSize(10).font('Helvetica').fillColor('#666666');
      doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.text(`CloudMastersHub Analytics Report`, { align: 'center' });
      doc.moveDown(1.5);

      // Reset color for content
      doc.fillColor('#000000');

      if (!data || data.length === 0) {
        doc.fontSize(12).text('No data available for this report.', { align: 'center' });
        doc.end();
        return;
      }

      // Table setup
      const pageWidth = doc.page.width - 100;
      const columnWidth = pageWidth / Math.min(columns.length, 5);
      const startX = 50;
      let currentY = doc.y;

      // Table header
      doc.font('Helvetica-Bold').fontSize(10);
      doc.rect(startX, currentY, pageWidth, 25).fill('#f0f0f0').stroke();
      doc.fillColor('#000000');

      columns.slice(0, 5).forEach((col, index) => {
        doc.text(
          truncateText(col.label, 15),
          startX + index * columnWidth + 5,
          currentY + 8,
          { width: columnWidth - 10, align: 'left' }
        );
      });

      currentY += 30;
      doc.font('Helvetica').fontSize(9);

      // Table rows
      data.forEach((row, rowIndex) => {
        // Check if we need a new page
        if (currentY > doc.page.height - 100) {
          doc.addPage();
          currentY = 50;

          // Repeat header on new page
          doc.font('Helvetica-Bold').fontSize(10);
          doc.rect(startX, currentY, pageWidth, 25).fill('#f0f0f0').stroke();
          doc.fillColor('#000000');

          columns.slice(0, 5).forEach((col, index) => {
            doc.text(
              truncateText(col.label, 15),
              startX + index * columnWidth + 5,
              currentY + 8,
              { width: columnWidth - 10, align: 'left' }
            );
          });

          currentY += 30;
          doc.font('Helvetica').fontSize(9);
        }

        // Alternate row colors
        if (rowIndex % 2 === 0) {
          doc.rect(startX, currentY, pageWidth, 20).fill('#fafafa').stroke('#e0e0e0');
        } else {
          doc.rect(startX, currentY, pageWidth, 20).stroke('#e0e0e0');
        }
        doc.fillColor('#000000');

        columns.slice(0, 5).forEach((col, index) => {
          const value = formatValue(row[col.key]);
          doc.text(
            truncateText(value, 20),
            startX + index * columnWidth + 5,
            currentY + 5,
            { width: columnWidth - 10, align: 'left' }
          );
        });

        currentY += 20;
      });

      // Summary
      doc.moveDown(2);
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text(`Total Records: ${data.length}`, { align: 'left' });

      doc.end();
    } catch (error) {
      logger.error('Failed to generate PDF:', error);
      reject(new Error('Failed to generate PDF'));
    }
  });
};

/**
 * Format a value for display
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return '-';
  }

  if (value instanceof Date) {
    return value.toLocaleDateString();
  }

  if (typeof value === 'number') {
    // Format as currency if it looks like money
    if (value >= 100 || String(value).includes('.')) {
      return value.toLocaleString();
    }
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Truncate text to fit column width
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return '-';
  const str = String(text);
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Get column definitions for a report type
 */
export const getReportColumns = (reportType: string): ReportColumn[] => {
  switch (reportType) {
    case 'user_activity':
      return [
        { label: 'User ID', key: 'userId' },
        { label: 'Email', key: 'email' },
        { label: 'Name', key: 'name' },
        { label: 'Last Active', key: 'lastActiveAt' },
        { label: 'Status', key: 'status' }
      ];
    case 'revenue':
      return [
        { label: 'Date', key: 'date' },
        { label: 'Amount', key: 'amount' },
        { label: 'Type', key: 'type' },
        { label: 'User', key: 'userEmail' },
        { label: 'Status', key: 'status' }
      ];
    case 'content_performance':
      return [
        { label: 'Title', key: 'title' },
        { label: 'Type', key: 'type' },
        { label: 'Views', key: 'views' },
        { label: 'Completions', key: 'completions' },
        { label: 'Rating', key: 'rating' }
      ];
    case 'subscription_analytics':
      return [
        { label: 'Plan', key: 'plan' },
        { label: 'Subscribers', key: 'count' },
        { label: 'MRR', key: 'mrr' },
        { label: 'Churn', key: 'churnRate' },
        { label: 'Growth', key: 'growth' }
      ];
    default:
      return [
        { label: 'ID', key: 'id' },
        { label: 'Name', key: 'name' },
        { label: 'Value', key: 'value' },
        { label: 'Date', key: 'date' },
        { label: 'Status', key: 'status' }
      ];
  }
};

/**
 * Flatten nested data for export
 */
export const flattenData = (data: any): any[] => {
  if (Array.isArray(data)) {
    return data;
  }

  // If it's an object with nested arrays, try to find the main data array
  if (typeof data === 'object' && data !== null) {
    // Common keys that contain the main data
    const dataKeys = ['items', 'records', 'data', 'users', 'courses', 'transactions'];
    for (const key of dataKeys) {
      if (Array.isArray(data[key])) {
        return data[key];
      }
    }

    // If it's a summary object, wrap it in an array
    return [data];
  }

  return [];
};
