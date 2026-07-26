const PDFDocument = require('pdfkit');

// The frontend always renders dates using the browser's local time (which,
// for this app's users, is IST). The backend server (Render) runs in UTC by
// default, so without an explicit timeZone here, the PDF and the website
// used to disagree by ~5.5 hours. Every date on this receipt is now
// explicitly formatted in Asia/Kolkata to match what the user sees on-site.
const TZ = 'Asia/Kolkata';

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PAGE_LEFT = 50;
const PAGE_RIGHT = 545;
const PAGE_WIDTH = PAGE_RIGHT - PAGE_LEFT;

/**
 * Streams a parking receipt PDF directly to the HTTP response.
 * Expects a fully-populated booking (userId, slotId) with status 'Completed'.
 */
function generateReceiptPDF(booking, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="receipt-${booking._id.toString().slice(-8).toUpperCase()}.pdf"`
  );
  doc.pipe(res);

  const receiptNo = booking._id.toString().slice(-8).toUpperCase();

  // ─── Header band ────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 90).fill('#0a0a0a');
  doc
    .fillColor('#00ff9d')
    .fontSize(22)
    .font('Helvetica-Bold')
    .text('AG PARKING', PAGE_LEFT, 28);
  doc
    .fillColor('#aaaaaa')
    .fontSize(9)
    .font('Helvetica')
    .text('Smart Campus Car Parking System', PAGE_LEFT, 54);
  doc
    .fillColor('#ffffff')
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('PAYMENT RECEIPT', PAGE_LEFT, 28, { width: PAGE_WIDTH, align: 'right' });
  doc
    .fillColor('#00ff9d')
    .fontSize(11)
    .text(`#${receiptNo}`, PAGE_LEFT, 46, { width: PAGE_WIDTH, align: 'right' });

  doc.y = 115;
  doc.fillColor('#000000');

  // ─── Meta row: issued date, status ──────────────────────────────────────
  doc.fontSize(9).fillColor('#666666')
    .text(`Issued: ${fmtDateTime(new Date())}  |  Status: PAID`, PAGE_LEFT, doc.y);
  doc.moveDown(1.2);

  // ─── Two-column info card: Customer | Vehicle & Slot ────────────────────
  const cardTop = doc.y;
  const cardHeight = 90;
  doc.rect(PAGE_LEFT, cardTop, PAGE_WIDTH, cardHeight).fillAndStroke('#f7f7f7', '#e0e0e0');

  const col1X = PAGE_LEFT + 15;
  const col2X = PAGE_LEFT + PAGE_WIDTH / 2 + 5;
  const textTop = cardTop + 14;

  doc.fillColor('#888888').fontSize(8).font('Helvetica-Bold').text('BILLED TO', col1X, textTop);
  doc.fillColor('#0a0a0a').fontSize(11).font('Helvetica-Bold').text(booking.userId?.name || '—', col1X, textTop + 13);
  doc.fillColor('#555555').fontSize(9).font('Helvetica').text(booking.userId?.email || '—', col1X, textTop + 30);

  doc.fillColor('#888888').fontSize(8).font('Helvetica-Bold').text('PARKING SLOT', col2X, textTop);
  doc.fillColor('#0a0a0a').fontSize(11).font('Helvetica-Bold')
    .text(`${booking.slotId?.slotNumber || '—'}  (${booking.slotId?.location || '—'})`, col2X, textTop + 13);
  doc.fillColor('#555555').fontSize(9).font('Helvetica')
    .text(
      `${booking.carNumber || 'Vehicle No. not recorded'}${booking.vehicleType ? '  ·  ' + booking.vehicleType : ''}`,
      col2X,
      textTop + 30
    );

  doc.y = cardTop + cardHeight + 25;

  // ─── Section title ───────────────────────────────────────────────────────
  doc.fontSize(11).fillColor('#0a0a0a').font('Helvetica-Bold').text('Session Details', PAGE_LEFT, doc.y);
  doc.moveDown(0.6);

  // ─── Bordered table ─────────────────────────────────────────────────────
  const rows = [
    ['Booked At', fmtDateTime(booking.bookingTime)],
    ['Check-In', fmtDateTime(booking.checkInTime)],
    ['Check-Out', fmtDateTime(booking.checkOutTime)],
    ['Duration Billed', `${booking.totalHours || 0} hour(s)`],
    ['Hourly Rate', `Rs. ${booking.slotId?.hourlyRate ?? '—'} / hour`],
  ];

  const rowHeight = 24;
  const tableTop = doc.y;
  const labelWidth = 180;

  rows.forEach(([label, value], i) => {
    const y = tableTop + i * rowHeight;
    if (i % 2 === 0) {
      doc.rect(PAGE_LEFT, y, PAGE_WIDTH, rowHeight).fill('#fafafa');
    }
    doc.fillColor('#555555').fontSize(9).font('Helvetica').text(label, PAGE_LEFT + 12, y + 7, { width: labelWidth });
    doc.fillColor('#0a0a0a').fontSize(9).font('Helvetica-Bold')
      .text(value, PAGE_LEFT + labelWidth, y + 7, { width: PAGE_WIDTH - labelWidth - 12, align: 'right' });
  });

  doc.rect(PAGE_LEFT, tableTop, PAGE_WIDTH, rows.length * rowHeight).stroke('#e0e0e0');

  doc.y = tableTop + rows.length * rowHeight + 20;

  // ─── Total due band ─────────────────────────────────────────────────────
  const totalTop = doc.y;
  doc.rect(PAGE_LEFT, totalTop, PAGE_WIDTH, 50).fill('#0a0a0a');
  doc.fillColor('#aaaaaa').fontSize(9).font('Helvetica').text('TOTAL AMOUNT PAID', PAGE_LEFT + 15, totalTop + 12);
  doc.fillColor('#00ff9d').fontSize(20).font('Helvetica-Bold')
    .text(`Rs. ${booking.totalAmount ?? 0}`, PAGE_LEFT, totalTop + 10, { width: PAGE_WIDTH - 15, align: 'right' });

  doc.y = totalTop + 50 + 35;

  // ─── Footer ─────────────────────────────────────────────────────────────
  doc.moveTo(PAGE_LEFT, doc.y).lineTo(PAGE_RIGHT, doc.y).strokeColor('#e0e0e0').stroke();
  doc.moveDown(1);
  doc
    .fontSize(8)
    .fillColor('#999999')
    .font('Helvetica')
    .text('This is a system-generated receipt and does not require a signature.', PAGE_LEFT, doc.y, { width: PAGE_WIDTH, align: 'center' })
    .text('Thank you for using AG Parking.', { width: PAGE_WIDTH, align: 'center' });

  doc.end();
}

module.exports = { generateReceiptPDF };