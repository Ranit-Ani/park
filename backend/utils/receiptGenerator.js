const PDFDocument = require('pdfkit');

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

  // ─── Header ─────────────────────────────────────────────────────────────
  doc
    .fontSize(22)
    .fillColor('#0a0a0a')
    .text('AG PARKING', { align: 'left' })
    .fontSize(10)
    .fillColor('#555')
    .text('Smart Campus Car Parking System', { align: 'left' })
    .moveDown(1.5);

  doc
    .fontSize(16)
    .fillColor('#0a0a0a')
    .text('Payment Receipt', { align: 'left' })
    .moveDown(0.5);

  doc
    .fontSize(10)
    .fillColor('#555')
    .text(`Receipt No: ${booking._id.toString().slice(-8).toUpperCase()}`)
    .text(`Issued: ${new Date().toLocaleString('en-IN')}`)
    .moveDown(1);

  // ─── Divider ────────────────────────────────────────────────────────────
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke().moveDown(1);

  // ─── Customer & Slot Info ───────────────────────────────────────────────
  const startY = doc.y;
  doc.fontSize(11).fillColor('#0a0a0a').text('Billed To', 50, startY);
  doc.fontSize(10).fillColor('#333')
    .text(booking.userId?.name || '—', 50, startY + 16)
    .text(booking.userId?.email || '—', 50, startY + 32);

  doc.fontSize(11).fillColor('#0a0a0a').text('Parking Slot', 320, startY);
  doc.fontSize(10).fillColor('#333')
    .text(`${booking.slotId?.slotNumber || '—'} (${booking.slotId?.location || '—'})`, 320, startY + 16)
    .text(booking.carNumber ? `Vehicle: ${booking.carNumber}` : 'Vehicle: —', 320, startY + 32);

  doc.moveDown(4);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke().moveDown(1);

  // ─── Timing Table ───────────────────────────────────────────────────────
  const rows = [
    ['Booked At', booking.bookingTime ? new Date(booking.bookingTime).toLocaleString('en-IN') : '—'],
    ['Check-In', booking.checkInTime ? new Date(booking.checkInTime).toLocaleString('en-IN') : '—'],
    ['Check-Out', booking.checkOutTime ? new Date(booking.checkOutTime).toLocaleString('en-IN') : '—'],
    ['Duration Billed', `${booking.totalHours || 0} hour(s)`],
    ['Rate', `Rs. ${booking.slotId?.hourlyRate ?? '—'} / hour`],
  ];

  rows.forEach(([label, value]) => {
    doc.fontSize(10).fillColor('#555').text(label, 50, doc.y, { continued: true, width: 200 });
    doc.fillColor('#0a0a0a').text(value, { align: 'right' });
    doc.moveDown(0.4);
  });

  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke().moveDown(1);

  // ─── Total ──────────────────────────────────────────────────────────────
  doc
    .fontSize(13)
    .fillColor('#0a0a0a')
    .text('Total Amount Paid', 50, doc.y, { continued: true, width: 300 })
    .fontSize(16)
    .fillColor('#008a3e')
    .text(`Rs. ${booking.totalAmount ?? 0}`, { align: 'right' });

  doc.moveDown(3);

  // ─── Footer ─────────────────────────────────────────────────────────────
  doc
    .fontSize(9)
    .fillColor('#999')
    .text('This is a system-generated receipt and does not require a signature.', { align: 'center' })
    .text('Thank you for using AG Parking.', { align: 'center' });

  doc.end();
}

module.exports = { generateReceiptPDF };