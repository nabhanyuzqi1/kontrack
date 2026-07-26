// src/utils/pdfGenerator.js
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate, getStatusLabel, calculateProjectProgress, calculateDaysLeft } from './formatters';

// Company information
const COMPANY_INFO = {
  name: 'PT Permata Energi Borneo',
  address: 'Jl. Gatot Subroto (Gedung Permata)',
  city: 'Sampit, Kalimantan Tengah',
  phone: '08115188808',
  email: 'permataenergiborneo@gmail.com'
};


// Helper function to format date shorter for tables
const formatDateShort = (date) => {
  if (!date) return '-';
  
  const dateObj = date && typeof date === 'object' && date.seconds
    ? new Date(date.seconds * 1000)
    : new Date(date);
    
  return dateObj.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};


// Helper function to add header
const addHeader = (doc, title, isNewPage = false) => {
  // Clear area if it's a new page to prevent overlapping
  if (isNewPage) {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 55, 'F');
  }
  
  // Company name
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(COMPANY_INFO.name, 105, 20, { align: 'center' });
  
  // Title
  doc.setFontSize(14);
  doc.text(title, 105, 32, { align: 'center' });
  
  // Company info
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${COMPANY_INFO.address}, ${COMPANY_INFO.city}`, 105, 40, { align: 'center' });
  doc.text(`${COMPANY_INFO.phone} | ${COMPANY_INFO.email}`, 105, 46, { align: 'center' });
  
  // Line separator
  doc.setLineWidth(0.5);
  doc.line(20, 50, 190, 50);
  
  return 60; // Return Y position for content with more space
};

// Helper function to add header for landscape
const addHeaderLandscape = (doc, title, isNewPage = false) => {
  // Clear area if it's a new page
  if (isNewPage) {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 297, 55, 'F');
  }
  
  // Company name
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(COMPANY_INFO.name, 148.5, 20, { align: 'center' });
  
  // Title
  doc.setFontSize(14);
  doc.text(title, 148.5, 32, { align: 'center' });
  
  // Company info
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${COMPANY_INFO.address}, ${COMPANY_INFO.city}`, 148.5, 40, { align: 'center' });
  doc.text(`${COMPANY_INFO.phone} | ${COMPANY_INFO.email}`, 148.5, 46, { align: 'center' });
  
  // Line separator
  doc.setLineWidth(0.5);
  doc.line(20, 50, 277, 50);
  
  return 60;
};

// Helper function to add footer
const addFooter = (doc, pageNumber) => {
  const pageHeight = doc.internal.pageSize.height;
  
  // Line separator
  doc.setLineWidth(0.3);
  doc.line(20, pageHeight - 20, doc.internal.pageSize.width - 20, pageHeight - 20);
  
  // Page number and date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(
    `Halaman ${pageNumber}`,
    doc.internal.pageSize.width / 2,
    pageHeight - 10,
    { align: 'center' }
  );
  doc.text(
    `Dicetak pada: ${formatDate(new Date())}`,
    20,
    pageHeight - 10
  );
};

/**
 * Generate Project Report PDF
 * @param {Object} project - Project data
 * @param {Array} transactions - Project transactions
 */
export const generateProjectPDF = (project, transactions = []) => {
  const doc = new jsPDF();
  let yPos = addHeader(doc, 'LAPORAN PROYEK');
  
  // Project Title - Centered
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(project.name.toUpperCase(), 105, yPos, { align: 'center' });
  yPos += 10;
  
  // Partner name - Centered
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(project.partner, 105, yPos, { align: 'center' });
  yPos += 15;
  
  // Project Info Box
  doc.setFillColor(248, 249, 250);
  doc.rect(15, yPos - 5, 180, 35, 'F');
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.rect(15, yPos - 5, 180, 35);
  
  // Project details in box
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  
  // Two columns in the box
  let infoY = yPos + 2;
  
  // Left column
  doc.setFont('helvetica', 'bold');
  doc.text('Status:', 25, infoY);
  doc.setFont('helvetica', 'normal');
  
  // Status badge style
  const statusText = getStatusLabel(project.status);
  const statusColors = {
    'akan-datang': [108, 117, 125],
    'ongoing': [0, 123, 255],
    'retensi': [255, 193, 7],
    'selesai': [40, 167, 69]
  };
  const statusColor = statusColors[project.status] || [108, 117, 125];
  doc.setTextColor(...statusColor);
  doc.text(statusText, 50, infoY);
  doc.setTextColor(0, 0, 0);
  
  infoY += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Periode:', 25, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${formatDateShort(project.startDate)} - ${formatDateShort(project.endDate)}`, 50, infoY);
  
  infoY += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Progress:', 25, infoY);
  doc.setFont('helvetica', 'normal');
  const progress = calculateProjectProgress(project);
  doc.text(`${progress}%`, 50, infoY);
  
  // Right column
  infoY = yPos + 2;
  doc.setFont('helvetica', 'bold');
  doc.text('No. SPK/MOU:', 110, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(project.contractNumber || '-', 150, infoY);
  
  infoY += 8;
  const daysLeft = calculateDaysLeft(project.endDate);
  if (project.status === 'ongoing') {
    doc.setFont('helvetica', 'bold');
    doc.text('Sisa Waktu:', 110, infoY);
    doc.setFont('helvetica', 'normal');
    if (daysLeft > 0) {
      doc.text(`${daysLeft} hari`, 150, infoY);
    } else if (daysLeft === 0) {
      doc.setTextColor(255, 0, 0);
      doc.text('Hari ini!', 150, infoY);
      doc.setTextColor(0, 0, 0);
    } else {
      doc.setTextColor(255, 0, 0);
      doc.text(`Terlambat ${Math.abs(daysLeft)} hari`, 150, infoY);
      doc.setTextColor(0, 0, 0);
    }
  }
  
  yPos += 40;
  
  // Financial Summary
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('RINGKASAN KEUANGAN', 105, yPos, { align: 'center' });
  yPos += 12;
  
  // Calculate totals
  const totalValue = project.value * (1 + project.taxRate / 100);
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const expense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const balance = income - expense;
  
  // Financial table
  const financialData = [
    ['Nilai Proyek', formatCurrency(project.value)],
    [`Pajak (${project.taxRate}%)`, formatCurrency(project.value * project.taxRate / 100)],
    ['Total Nilai', formatCurrency(totalValue)],
    ['', ''],
    ['Total Pemasukan', formatCurrency(income)],
    ['Total Pengeluaran', formatCurrency(expense)],
    ['Saldo', formatCurrency(balance)],
    ['', ''],
    ['Terbayar', formatCurrency(project.paidAmount || 0)],
    ['Sisa Pembayaran', formatCurrency(project.value - (project.paidAmount || 0))]
  ];
  
  autoTable(doc, {
    startY: yPos,
    body: financialData,
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'normal', halign: 'left' },
      1: { cellWidth: 60, halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 35 },
    tableWidth: 140,
    didParseCell: function(data) {
      // Make empty rows smaller
      if (data.row.raw[0] === '' && data.row.raw[1] === '') {
        data.cell.styles.minCellHeight = 2;
      }
      // Style total row
      if (data.row.raw[0] === 'Total Nilai' || data.row.raw[0] === 'Saldo') {
        data.cell.styles.fillColor = [240, 240, 240];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });
  
  yPos = doc.lastAutoTable.finalY + 15;
  
  // Project Description
  if (project.description) {
    if (yPos > 200) {
      doc.addPage();
      yPos = addHeader(doc, 'LAPORAN PROYEK (Lanjutan)', true);
    }
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DESKRIPSI PROYEK', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(project.description, 170);
    lines.forEach(line => {
      if (yPos > 250) {
        doc.addPage();
        yPos = addHeader(doc, 'LAPORAN PROYEK (Lanjutan)', true);
      }
      doc.text(line, 20, yPos);
      yPos += 6;
    });
    yPos += 10;
  }
  
  // Transaction Details
  if (transactions.length > 0) {
    // Check if need new page
    if (yPos > 180) {
      doc.addPage();
      yPos = addHeader(doc, 'LAPORAN PROYEK (Lanjutan)', true);
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DETAIL TRANSAKSI', 105, yPos, { align: 'center' });
    yPos += 12;
    
    // Prepare transaction data
    const transactionData = transactions.map((t, index) => [
      (index + 1).toString(),
      formatDateShort(t.date),
      t.type === 'income' ? 'Masuk' : 'Keluar',
      t.category && t.category.length > 15 ? t.category.substring(0, 15) + '..' : (t.category || '-'),
      t.description && t.description.length > 35 ? t.description.substring(0, 35) + '...' : (t.description || '-'),
      t.type === 'income' ? formatCurrency(t.amount) : `(${formatCurrency(t.amount)})`
    ]);
    
    // Add empty row before totals
    if (transactionData.length > 0) {
      transactionData.push(['', '', '', '', '', '']);
    }
    
    // Add totals row
    transactionData.push([
      '',
      '',
      '',
      '',
      'TOTAL',
      formatCurrency(income - expense)
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['No', 'Tanggal', 'Jenis', 'Kategori', 'Deskripsi', 'Jumlah']],
      body: transactionData,
      theme: 'striped',
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'center'
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        overflow: 'linebreak'
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'left' },
        4: { cellWidth: 58, halign: 'left' },
        5: { cellWidth: 35, halign: 'right' }
      },
      margin: { left: 15, right: 15 },
      tableWidth: 180,
      showHead: 'firstPage',
      didDrawPage: function(data) {
        // Clear top area and add header for new pages
        if (data.pageNumber > 1) {
          doc.setFillColor(255, 255, 255);
          doc.rect(0, 0, 210, 60, 'F');
          addHeader(doc, 'LAPORAN PROYEK (Lanjutan)', true);
        }
      },
      willDrawCell: function(data) {
        // Style the empty row
        if (data.row.index === transactionData.length - 2 && transactionData.length > 1) {
          data.cell.styles.fillColor = [255, 255, 255];
          data.cell.styles.minCellHeight = 3;
        }
        // Style the total row
        if (data.row.index === transactionData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      }
    });
  } else {
    // No transactions message
    if (yPos > 220) {
      doc.addPage();
      yPos = addHeader(doc, 'LAPORAN PROYEK (Lanjutan)', true);
    }
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('Belum ada transaksi untuk proyek ini', 105, yPos, { align: 'center' });
  }
  
  // Add footer to all pages
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter(doc, i);
  }
  
  // Save
  const fileName = `Laporan_${project.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
};

/**
 * Generate Invoice PDF
 * @param {Object} project - Project data
 * @param {Object} invoiceData - Invoice specific data
 */
export const generateInvoice = (project, invoiceData = {}) => {
  const doc = new jsPDF();
  let yPos = 30;
  
  // Invoice Header
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('INVOICE', 105, yPos, { align: 'center' });
  yPos += 20;
  
  // Company Info - Left Side
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY_INFO.name, 20, yPos);
  yPos += 7;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY_INFO.address, 20, yPos);
  yPos += 5;
  doc.text(COMPANY_INFO.city, 20, yPos);
  yPos += 5;
  doc.text(`${COMPANY_INFO.phone} | ${COMPANY_INFO.email}`, 20, yPos);
  
  // Invoice Info - Right Side
  const invoiceNumber = invoiceData.number || `INV-${project.id.slice(-6).toUpperCase()}-${new Date().getMonth() + 1}${new Date().getFullYear()}`;
  const invoiceDate = invoiceData.date || new Date();
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`No. Invoice: ${invoiceNumber}`, 190, 55, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Tanggal: ${formatDateShort(invoiceDate)}`, 190, 62, { align: 'right' });
  
  yPos += 15;
  
  // Line separator
  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(20, yPos, 190, yPos);
  yPos += 10;
  
  // Bill To
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Kepada:', 20, yPos);
  yPos += 8;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(project.partner, 20, yPos);
  yPos += 25;
  
  // Invoice Items
  const items = [];
  
  // Main project item - format description properly
  const projectDescription = project.name.toUpperCase();
  items.push([
    projectDescription,
    '1',
    formatCurrency(project.value),
    formatCurrency(project.value)
  ]);
  
  // Calculate totals
  const subtotal = project.value;
  const taxAmount = project.value * project.taxRate / 100;
  const total = subtotal + taxAmount;
  
  // Invoice table with better styling
  autoTable(doc, {
    startY: yPos,
    head: [['Deskripsi', 'Qty', 'Harga Satuan', 'Total']],
    body: items,
    theme: 'grid',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 11,
      halign: 'center'
    },
    styles: {
      fontSize: 10,
      cellPadding: 6,
      lineWidth: 0.1,
      lineColor: [200, 200, 200]
    },
    columnStyles: {
      0: { cellWidth: 100, halign: 'left' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' }
    },
    margin: { left: 10, right: 10 },
    tableWidth: 190,
    didDrawCell: function(data) {
      // Make cells look cleaner
      data.cell.styles.lineWidth = 0.1;
    }
  });
  
  yPos = doc.lastAutoTable.finalY + 15;
  
  // Subtotal section with box
  const boxStartY = yPos - 5;
  const boxWidth = 80;
  const boxX = 110;
  
  // Draw box for totals
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  
  // Subtotal
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', boxX + 5, yPos);
  doc.text(formatCurrency(subtotal), boxX + boxWidth - 5, yPos, { align: 'right' });
  yPos += 8;
  
  // Tax if applicable
  if (project.taxRate > 0) {
    doc.text(`Pajak (${project.taxRate}%):`, boxX + 5, yPos);
    doc.text(formatCurrency(taxAmount), boxX + boxWidth - 5, yPos, { align: 'right' });
    yPos += 8;
  }
  
  // Draw line before total
  doc.setLineWidth(0.5);
  doc.line(boxX, yPos - 3, boxX + boxWidth, yPos - 3);
  yPos += 2;
  
  // Total with highlight
  doc.setFillColor(240, 240, 240);
  doc.rect(boxX, yPos - 5, boxWidth, 10, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', boxX + 5, yPos + 2);
  doc.text(formatCurrency(total), boxX + boxWidth - 5, yPos + 2, { align: 'right' });
  
  // Draw box around totals
  const boxHeight = yPos - boxStartY + 8;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.rect(boxX, boxStartY, boxWidth, boxHeight);
  
  yPos += 20;
  
  // Payment Terms
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Syarat Pembayaran:', 20, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('• Pembayaran dilakukan dalam 30 hari setelah tanggal invoice', 25, yPos);
  yPos += 6;
  doc.text('• Transfer ke rekening yang tertera di bawah', 25, yPos);
  
  // Bank Information in a box
  yPos += 12;
  doc.setFillColor(245, 245, 245);
  doc.rect(20, yPos - 5, 170, 30, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.rect(20, yPos - 5, 170, 30);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Informasi Bank:', 25, yPos + 2);
  yPos += 8;
  
  doc.setFont('helvetica', 'normal');
  doc.text('Bank: [Nama Bank]', 25, yPos);
  yPos += 6;
  doc.text('No. Rekening: [Nomor Rekening]', 25, yPos);
  yPos += 6;
  doc.text('Atas Nama: ' + COMPANY_INFO.name, 25, yPos);
  
  // Signature area aligned to right
  yPos = 230;
  doc.setFont('helvetica', 'normal');
  doc.text('Hormat kami,', 140, yPos);
  yPos += 25;
  doc.text('_____________________', 140, yPos);
  yPos += 6;
  doc.text('[Nama Penandatangan]', 140, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'italic');
  doc.text('[Jabatan]', 140, yPos);
  
  // Footer
  addFooter(doc, 1);
  
  // Save
  const fileName = `Invoice_${project.name.replace(/[^a-z0-9]/gi, '_')}_${invoiceNumber}.pdf`;
  doc.save(fileName);
};

/**
 * Generate Full Financial Report PDF
 * @param {Array} projects - All projects
 * @param {Array} transactions - All transactions
 * @param {Object} stats - Calculated statistics
 */
export const generateFullReportPDF = (projects, transactions, stats) => {
  const doc = new jsPDF();
  let yPos = addHeader(doc, 'LAPORAN KEUANGAN');
  
  // Report Period
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Per tanggal: ${formatDate(new Date())}`, 105, yPos, { align: 'center' });
  yPos += 20;
  
  // Summary Statistics Card
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('RINGKASAN KEUANGAN', 105, yPos, { align: 'center' });
  yPos += 15;
  
  // Draw summary box
  doc.setFillColor(248, 249, 250);
  doc.rect(15, yPos - 5, 180, 65, 'F');
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.rect(15, yPos - 5, 180, 65);
  
  // Summary data in two columns
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Left column
  let leftX = 25;
  let rightX = 110;
  let tempY = yPos + 5;
  
  // Total Projects
  doc.setFont('helvetica', 'bold');
  doc.text('Total Proyek:', leftX, tempY);
  doc.setFont('helvetica', 'normal');
  doc.text(stats.totalProjects.toString() + ' proyek', leftX + 45, tempY);
  tempY += 8;
  
  // Total Value
  doc.setFont('helvetica', 'bold');
  doc.text('Nilai Proyek:', leftX, tempY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(stats.totalValue), leftX + 45, tempY);
  tempY += 8;
  
  // Total Paid
  doc.setFont('helvetica', 'bold');
  doc.text('Terbayar:', leftX, tempY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(stats.totalPaid), leftX + 45, tempY);
  tempY += 8;
  
  // Total Tax
  doc.setFont('helvetica', 'bold');
  doc.text('Total Pajak:', leftX, tempY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(stats.totalTax || 0), leftX + 45, tempY);
  
  // Right column
  tempY = yPos + 5;
  
  // Total Income
  doc.setFont('helvetica', 'bold');
  doc.text('Pemasukan:', rightX, tempY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(stats.totalIncome), rightX + 45, tempY);
  tempY += 8;
  
  // Total Expense
  doc.setFont('helvetica', 'bold');
  doc.text('Pengeluaran:', rightX, tempY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(stats.totalExpense), rightX + 45, tempY);
  tempY += 8;
  
  // Profit
  doc.setFont('helvetica', 'bold');
  doc.text('Keuntungan:', rightX, tempY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(stats.totalProfit), rightX + 45, tempY);
  tempY += 8;
  
  // Margin
  doc.setFont('helvetica', 'bold');
  doc.text('Margin:', rightX, tempY);
  doc.setFont('helvetica', 'normal');
  doc.text(stats.margin + '%', rightX + 45, tempY);
  
  yPos += 75;
  
  // Projects by Status
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('STATUS PROYEK', 105, yPos, { align: 'center' });
  yPos += 12;
  
  const statusData = Object.entries(stats.projectsByStatus).map(([status, data]) => [
    getStatusLabel(status),
    data.count.toString(),
    formatCurrency(data.value)
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [['Status', 'Jumlah', 'Total Nilai']],
    body: statusData,
    theme: 'striped',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 11,
      halign: 'center'
    },
    styles: {
      fontSize: 10,
      cellPadding: 5
    },
    columnStyles: {
      0: { cellWidth: 70, halign: 'left' },
      1: { cellWidth: 40, halign: 'center' },
      2: { cellWidth: 70, halign: 'right' }
    },
    margin: { left: 15, right: 15 },
    tableWidth: 180
  });
  
  // Check if need new page for project list
  yPos = doc.lastAutoTable.finalY + 20;
  if (yPos > 220) {
    doc.addPage();
    yPos = addHeader(doc, 'DAFTAR PROYEK', true);
  } else {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DAFTAR PROYEK', 105, yPos, { align: 'center' });
    yPos += 12;
  }
  
  // Project list table
  const projectData = projects.map((p, index) => [
    (index + 1).toString(),
    p.name.length > 30 ? p.name.substring(0, 30) + '...' : p.name,
    p.partner.length > 20 ? p.partner.substring(0, 20) + '...' : p.partner,
    getStatusLabel(p.status),
    formatCurrency(p.value),
    formatCurrency(p.paidAmount || 0),
    `${calculateProjectProgress(p)}%`
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [['No', 'Nama Proyek', 'Partner', 'Status', 'Nilai', 'Terbayar', 'Progress']],
    body: projectData,
    theme: 'striped',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center'
    },
    styles: {
      fontSize: 8,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 50, halign: 'left' },
      2: { cellWidth: 35, halign: 'left' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' },
      6: { cellWidth: 15, halign: 'center' }
    },
    margin: { left: 7.5, right: 7.5 },
    tableWidth: 195,
    showHead: 'firstPage',
    didDrawPage: function(data) {
      if (data.pageNumber > 1) {
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, 210, 60, 'F');
        addHeader(doc, 'DAFTAR PROYEK (Lanjutan)', true);
      }
    }
  });
  
  // Add footer to all pages
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter(doc, i);
  }
  
  // Save
  doc.save(`Laporan_Keuangan_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// Export new names alongside old names for backward compatibility
export const generateProjectReport = generateProjectPDF;
export const generateFinancialReport = generateFullReportPDF;

// New function for transaction report
export const generateTransactionReport = (transactions, filters = {}) => {
  const doc = new jsPDF('l'); // landscape agar kolom muat
  const pageW = doc.internal.pageSize.width; // 297
  const marginX = 12;
  let yPos = addHeaderLandscape(doc, 'LAPORAN TRANSAKSI');

  if (filters.dateRange) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Periode: ${formatDate(filters.dateRange.start)} - ${formatDate(filters.dateRange.end)}`,
      pageW / 2,
      yPos,
      { align: 'center' }
    );
    yPos += 10;
  }
  doc.setTextColor(0, 0, 0);

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  // Teks TIDAK dipotong — autoTable membungkus baris (overflow: linebreak)
  // sehingga tidak ada informasi yang hilang.
  const tableData = transactions.map((t, index) => [
    String(index + 1),
    formatDateShort(t.date),
    t.projectName || '-',
    t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
    t.category || '-',
    t.description || '-',
    t.type === 'income' ? formatCurrency(t.amount) : `(${formatCurrency(t.amount)})`
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['No', 'Tanggal', 'Proyek', 'Jenis', 'Kategori', 'Keterangan', 'Jumlah']],
    body: tableData,
    foot: [[
      { content: 'TOTAL', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } },
      {
        content: formatCurrency(totalIncome - totalExpense),
        styles: { halign: 'right', fontStyle: 'bold' }
      }
    ]],
    theme: 'striped',
    headStyles: {
      fillColor: [51, 88, 244],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center'
    },
    footStyles: { fillColor: [240, 243, 250], textColor: 20, fontSize: 9 },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      overflow: 'linebreak', // bungkus teks panjang, jangan dipotong
      valign: 'top'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 52 },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 32 },
      5: { cellWidth: 'auto' },
      6: { cellWidth: 32, halign: 'right' }
    },
    margin: { left: marginX, right: marginX, top: 22, bottom: 18 },
    showHead: 'everyPage', // header kolom berulang di tiap halaman
    rowPageBreak: 'avoid', // baris tidak terbelah antar halaman
    didDrawPage: (data) => {
      // Judul ringkas di halaman lanjutan (tanpa menimpa tabel)
      if (data.pageNumber > 1) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(120, 120, 120);
        doc.text(`LAPORAN TRANSAKSI — hal. ${data.pageNumber}`, marginX, 12);
        doc.setTextColor(0, 0, 0);
      }
    }
  });

  // Ringkasan di halaman terakhir
  let sumY = doc.lastAutoTable.finalY + 10;
  const pageH = doc.internal.pageSize.height;
  if (sumY > pageH - 45) {
    doc.addPage();
    sumY = 25;
  }

  const boxW = 95;
  const boxX = pageW - marginX - boxW;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.rect(boxX, sumY - 5, boxW, 34, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Total Pemasukan', boxX + 5, sumY + 1);
  doc.text(formatCurrency(totalIncome), boxX + boxW - 5, sumY + 1, { align: 'right' });

  doc.text('Total Pengeluaran', boxX + 5, sumY + 9);
  doc.text(formatCurrency(totalExpense), boxX + boxW - 5, sumY + 9, { align: 'right' });

  doc.setLineWidth(0.4);
  doc.line(boxX + 5, sumY + 13, boxX + boxW - 5, sumY + 13);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Saldo', boxX + 5, sumY + 21);
  doc.text(formatCurrency(totalIncome - totalExpense), boxX + boxW - 5, sumY + 21, {
    align: 'right'
  });

  // Info jumlah transaksi (kiri)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(`Jumlah transaksi: ${transactions.length}`, marginX, sumY + 1);

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter(doc, i);
  }

  doc.save(`Laporan_Transaksi_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// Export all functions
export default {
  generateProjectPDF,
  generateProjectReport,
  generateInvoice,
  generateFinancialReport,
  generateFullReportPDF,
  generateTransactionReport
};