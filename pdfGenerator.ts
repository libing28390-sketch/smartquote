
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quote } from './types';

// Helper to format date (copied from utils/QuoteDetailModal logic)
const formatDateToEnglish = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${day}${suffix} ${months[d.getMonth()]},${d.getFullYear()}`;
  } catch (e) {
    return dateStr;
  }
};

// Optimization helper: resize image to reduce PDF size
const getOptimizedLogoData = (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      // 25mm width @ 300dpi ~= 300 pixels. Let's use 600px for high quality.
      const targetWidth = 600; 
      let width = img.width;
      let height = img.height;

      if (width > targetWidth) {
        height = Math.round(height * (targetWidth / width));
        width = targetWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
        // Fallback to fetch if Image load fails
        fetch(url)
            .then(res => res.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            })
            .catch(() => resolve(null));
    };
    img.src = url;
  });
};

export const generatePDF = async (quote: Quote, logoUrl: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // Load Logo
  let logoData: string | null = null;
  if (logoUrl) {
    logoData = await getOptimizedLogoData(logoUrl);
  }

  // --- Header Section ---
  if (logoData) {
    // Logo: Adjusted size to avoid overlap
    doc.addImage(logoData, 'PNG', margin, 10, 25, 9); 
  }

  // Centered Header Info
  // We use standard fonts. Note: Chinese characters will not render correctly with standard fonts.
  // Ideally, we would load a custom font here.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("KEBOS POWER CO.,LTD", pageWidth / 2, 15, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let yPos = 22;
  const lineHeight = 4;

  doc.text("1-4F, Building 5, Yusheng Industrial Park, No.467, Section Xixiang, Bao An District, Shenzhen, China", pageWidth / 2, yPos, { align: "center" });
  yPos += lineHeight;
  doc.text("Website: www.kebospower.com", pageWidth / 2, yPos, { align: "center" });
  yPos += lineHeight;
  doc.text("Email: alicehe@kebospower.com", pageWidth / 2, yPos, { align: "center" });
  yPos += lineHeight;
  doc.text("Contact: Alice He   Tel :86-0755-86016601 Ext.8511              Mobile/WhatsApp/Wechat: 0086-13927276161", pageWidth / 2, yPos, { align: "center" });

  // --- Customer & Date Section ---
  yPos += 8;
  doc.setFontSize(9);
  
  // Left: To & From
  doc.text(`To: ${quote.customer}`, margin, yPos);
  doc.text(`From: Alice he`, margin, yPos + 5);

  // Right: Date
  doc.text(`Date: ${formatDateToEnglish(quote.date)}`, pageWidth - margin, yPos, { align: "right" });

  // --- Title ---
  yPos += 12;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("KEBOS UPS Quotation", pageWidth / 2, yPos, { align: "center" });

  // --- Table Logic ---
  const currencyUnit = quote.quotedCurrency;
  const currencySymbol = currencyUnit === 'USD' ? '$' : '¥'; // Note: '¥' might not render in standard font
  // Use 'Y' or 'RMB' if symbol fails? Standard Helvetica supports '¥' (U+00A5) usually.

  const hasSampleItem = quote.items.some(item => item.isSample || item.moq < 2);
  const hasLowQtyItem = quote.items.some(item => !item.isSample && item.moq >= 2 && item.moq < item.standardMoq);
  
  let priceHeaderLabel = "NET PRICE";
  let moqHeaderLabel = "MOQ\n(PCS)";
  if (hasSampleItem) {
    priceHeaderLabel = "SAMPLE PRICE";
    moqHeaderLabel = "SAMPLE\n(PCS)";
  } else if (hasLowQtyItem) {
    priceHeaderLabel = "NET PRICE";
    moqHeaderLabel = "QUANTITY\n(PCS)";
  }

  yPos += 5;

  autoTable(doc, {
    startY: yPos,
    head: [[
      'Item',
      'Model#',
      'Product description',
      `${priceHeaderLabel}\n(${currencyUnit})`,
      moqHeaderLabel,
      `Total\nPRICE(${currencyUnit})`
    ]],
    body: [
      ...quote.items.map((item, index) => [
        index + 1,
        item.kebosModel,
        item.description,
        `${currencySymbol}${Math.round(item.salesPrice).toLocaleString()}`,
        item.moq,
        `${currencySymbol}${Math.round(item.salesPrice * item.moq).toLocaleString()}`
      ]),
      // Total Row
      [
        { content: 'TOTAL', colSpan: 5, styles: { halign: 'center', fontStyle: 'bold' } },
        `${currencySymbol}${Math.round(quote.totalAmount).toLocaleString('en-US')}`
      ]
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      textColor: [0, 0, 0]
    },
    headStyles: {
      fillColor: [242, 242, 242], // #F2F2F2
      textColor: [0, 0, 0],
      fontStyle: 'normal',
      halign: 'center',
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center', valign: 'middle' },
      1: { cellWidth: 32, halign: 'center', valign: 'middle' },
      2: { cellWidth: 70, halign: 'left', valign: 'middle' },
      3: { cellWidth: 21, halign: 'center', valign: 'middle' },
      4: { cellWidth: 18, halign: 'center', valign: 'middle' },
      5: { cellWidth: 24, halign: 'center', valign: 'middle' }
    },
    margin: { left: margin, right: margin }
  });

  // --- Remarks Section ---
  // @ts-ignore
  const finalY = doc.lastAutoTable.finalY || yPos;
  yPos = finalY + 10;

  // Check if we need a page break for remarks
  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Remarks:", margin, yPos);
  yPos += 5;

  const remarks = [
    "1.This price is EX Factory.",
    "2.Order to determine 4-5 WEEKS of delivery.",
    "3.Payment: 30% deposit, to be settled before shipment.",
    `4.This offer open from ${formatDateToEnglish(quote.date)} to ${formatDateToEnglish(new Date(new Date(quote.date).getTime() + 30 * 86400000).toISOString())}.`,
    "5.Warranty period: 1 years"
  ];

  if (hasSampleItem || hasLowQtyItem) {
    remarks.push("6.For quantities less than MOQ, the price is for evaluation only.");
  }

  remarks.forEach(r => {
    // Check page break
    if (yPos > pageHeight - 15) {
        doc.addPage();
        yPos = 20;
    }
    doc.text(r, margin, yPos);
    yPos += 5;
  });

  // Format date as YYYYMMDD for filename
  let dateStr = '';
  // Try to parse YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const dateMatch = quote.date.match(/(\d{4})[\-\/\.](\d{1,2})[\-\/\.](\d{1,2})/);
  if (dateMatch) {
    const year = dateMatch[1];
    const month = dateMatch[2].padStart(2, '0');
    const day = dateMatch[3].padStart(2, '0');
    dateStr = `${year}${month}${day}`;
  } else {
    // Fallback to Date object parsing
    const d = new Date(quote.date);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dateStr = `${year}${month}${day}`;
    } else {
       // Last resort: remove non-digits
       dateStr = quote.date.replace(/[^0-9]/g, '');
    }
  }
  doc.save(`KEBOS_Quotation_${dateStr}.pdf`);
};
