import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SalesOrder } from './types';

// Helper to format date
const formatDateToEnglish = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const suffix = ["th", "st", "nd", "rd"][((day % 100) > 10 && (day % 100) < 20) ? 0 : (day % 10 < 4) ? day % 10 : 0];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${day}${suffix},${months[d.getMonth()]},${d.getFullYear()}`;
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

// Function to load Chinese font
const loadChineseFont = async (doc: jsPDF) => {
  try {
    // 优先尝试从本地加载字体 (public/fonts/SimHei.ttf)
    // 如果本地不存在，则尝试从网络加载
    const fontUrls = [
        '/fonts/SimHei.ttf', 
        'https://raw.githubusercontent.com/gmeyer/simhei/master/simhei.ttf'
    ];

    let fontData: string | null = null;

    for (const url of fontUrls) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                const blob = await response.blob();
                fontData = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const res = reader.result as string;
                        resolve(res.split(',')[1]);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                console.log(`Loaded font from ${url}`);
                break; 
            }
        } catch (err) {
            console.warn(`Failed to load font from ${url}`, err);
        }
    }

    if (fontData) {
        // 添加字体到 VFS
        doc.addFileToVFS('SimHei.ttf', fontData);
        // 注册字体 (Normal 和 Bold 都使用同一个文件，模拟粗体)
        doc.addFont('SimHei.ttf', 'SimHei', 'normal');
        doc.addFont('SimHei.ttf', 'SimHei', 'bold');
        console.log('Chinese font registered successfully');
    } else {
        console.warn('All font sources failed. Chinese characters may not render correctly.');
    }
  } catch (e) {
    console.warn('Error in loadChineseFont:', e);
  }
};

export const generateOrderPDF = async (order: SalesOrder, logoUrl: string) => {
  const doc = new jsPDF();
  
  // Load Chinese Font first
  await loadChineseFont(doc);

  // Determine available Chinese font
  // @ts-ignore
  const fontList = doc.getFontList();
  const chineseFontName = (fontList && fontList['SimHei']) ? 'SimHei' : 'helvetica';
  
  const getFont = (text: string) => {
      return /[\u4e00-\u9fa5]/.test(text) ? chineseFontName : 'helvetica';
  };

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  
  // Load Logo
  let logoData: string | null = null;
  if (logoUrl) {
    logoData = await getOptimizedLogoData(logoUrl);
  }

  // --- Header Section (Matched with Quote) ---
  if (logoData) {
    // Logo: Adjusted size to avoid overlap
    doc.addImage(logoData, 'PNG', margin, 10, 38, 13); 
  }

  // Centered Header Info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("KEBOS POWER CO.,LIMITED", pageWidth / 2, 15, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let yPos = 22;
  const lineHeight = 5;

  doc.text("Add: Building A,No.16,Gu Da ROAD ,GUANG DONG,China", pageWidth / 2, yPos, { align: "center" });
  yPos += lineHeight;
  doc.text("Contact: Ms.Alice He  Mob:+86-13927276161  E-mail: alicehe@kebospower.com", pageWidth / 2, yPos, { align: "center" });
  
  // --- Title ---
  yPos += 10;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("PROFORMA INVOICE", pageWidth / 2, yPos, { align: "center" });

  // --- Customer & Date Section ---
  yPos += 10;
  doc.setFontSize(9);
  
  // Grid layout for Order Info
  const leftX = margin;
  const rightX = pageWidth - margin;

  // Anchor for Right Side values (Invoice ID, Date, Payment)
  // PageWidth (210) - Margin (15) = 195. 
  // Max Invoice ID length approx 50mm. 
  // Let's set value start at 140mm (RightX - 55).
  const rightValueX = rightX - 55;
  const rightLabelX = rightValueX - 2;

  // Row 1: Bill To & Date
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO:", leftX, yPos);
  const billToWidth = doc.getTextWidth("BILL TO:");
  const billToVal = order.customerInfo?.companyName || order.customer;
  doc.setFont(getFont(billToVal), "normal");
  doc.text(billToVal, leftX + billToWidth + 2, yPos);

  doc.setFont("helvetica", "bold");
  doc.text("DATE:", rightLabelX, yPos, { align: 'right' });
  doc.setFont("helvetica", "normal");
  doc.text(formatDateToEnglish(order.createdAt), rightValueX, yPos, { align: 'left' });

  // Row 2: Address & Invoice No
  yPos += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Add:", leftX, yPos);
  const addWidth = doc.getTextWidth("Add:");
  const address = order.customerInfo?.address || '';
  doc.setFont(getFont(address), "normal");
  doc.text(address, leftX + addWidth + 2, yPos);
  
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE No.:", rightLabelX, yPos, { align: 'right' });
  doc.setFont("helvetica", "normal");
  doc.text(order.id, rightValueX, yPos, { align: 'left' });

  // Row 3: Atte & TEL & Payment
  yPos += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Atte:", leftX, yPos);
  const atteWidth = doc.getTextWidth("Atte:");
  const atte = order.customerInfo?.contactPerson || '';
  const tel = order.customerInfo?.phone || '';
  const atteText = `${atte}  TEL: ${tel}`;
  doc.setFont(getFont(atteText), "normal");
  // Use user's preferred spacing: "Atte: sa  TEL: fajf"
  doc.text(atteText, leftX + atteWidth + 2, yPos);

  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT:", rightLabelX, yPos, { align: 'right' });
  doc.setFont("helvetica", "normal");
  doc.text("T/T", rightValueX, yPos, { align: 'left' });

  // --- Table Logic ---
  yPos += 8;
  const currencySymbol = order.currency === 'USD' ? '$' : '¥';

  autoTable(doc, {
    startY: yPos,
    head: [
        [
          'ITEM NO.',
          'Brand',
          'ITEM',
          'Model',
          'DESCRIPTION OF GOODS',
          'QUANTITY\n(PCS)',
          'UNIT PRICE\n(USD)',
          'AMOUNT\n(USD)'
        ],
        // Sub-header for EX Work (Row 10 in Excel)
        [
            '', '', '', '', '', '', 'EX Work', ''
        ]
    ],
    body: [
      ...order.items.map((item, index) => {
        const isMainUnit = item.itemType === 'Normal';
        const brand = isMainUnit ? 'MASU' : '/';
        const type = item.category || (isMainUnit ? 'UPS' : 'Spare Parts');
        return [
            index + 1,
            brand,
            type,
            item.kebosModel,
            (item.description || '').normalize('NFKC'), // Normalize to fix potential full-width/special char issues
            item.quantity,
            `${currencySymbol}${item.unitPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}`,
            `${currencySymbol}${item.total.toLocaleString(undefined, {minimumFractionDigits: 2})}`
        ];
      }),
      // Total Row matching Excel format:
      // | TOTAL (col 0-4 merged) | Total Qty (col 5) | BALANCE AMOUNT: (col 6) | Total Amount (col 7) |
      [
        { content: 'TOTAL', colSpan: 5, styles: { halign: 'left', fontStyle: 'bold' } },
        { content: order.items.reduce((sum, item) => sum + item.quantity, 0).toString(), styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'BALANCE AMOUNT:', styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `${currencySymbol}${order.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}`, styles: { halign: 'center', fontStyle: 'bold' } }
      ]
    ],
    theme: 'grid', 
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.05, // Consistent ultra-thin line for entire table
      textColor: [0, 0, 0]
    },
    headStyles: {
      fillColor: [238, 167, 39], // #EEA727 Orange
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.05, // Consistent ultra-thin line
      lineColor: [0, 0, 0]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', valign: 'middle' }, // ITEM NO.
      1: { cellWidth: 12, halign: 'center', valign: 'middle' }, // Brand
      2: { cellWidth: 16, halign: 'center', valign: 'middle' }, // ITEM
      3: { cellWidth: 26, halign: 'center', valign: 'middle' }, // Model
      4: { cellWidth: 'auto', halign: 'left', valign: 'middle' }, // Description
      5: { cellWidth: 14, halign: 'center', valign: 'middle' }, // Quantity
      6: { cellWidth: 20, halign: 'center', valign: 'middle' }, // Unit Price
      7: { cellWidth: 20, halign: 'center', valign: 'middle' }  // Amount
    },
    didParseCell: (data) => {
         // Handle the "EX Work" row styling (Second row of header)
         if (data.section === 'head' && data.row.index === 1) {
             data.cell.styles.fillColor = [255, 255, 255]; // No fill for EX Work row
             if (data.column.index !== 6) {
                 data.cell.styles.lineWidth = 0; // Hide borders for non-EX Work cells
                 data.cell.styles.lineColor = [255, 255, 255]; // Hide borders
                 data.cell.text = []; 
             } else {
                 data.cell.styles.fontStyle = 'normal';
                 data.cell.styles.lineWidth = 0; // Remove border for EX Work cell itself to match look? 
                 // Actually, let's keep it clean.
             }
         }
         
         // Font Check for Chinese characters
         const cellText = Array.isArray(data.cell.text) ? data.cell.text.join('') : data.cell.text;
         if (/[\u4e00-\u9fa5]/.test(cellText)) {
             data.cell.styles.font = chineseFontName;
         }
    },
    margin: { left: margin, right: margin }
  });

  // --- Remarks / Footer Section ---
  // @ts-ignore
  const finalY = doc.lastAutoTable.finalY || yPos;
  yPos = finalY + 10;

  // Check page break
  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  
  const addText = (text: string, isRed = false) => {
      if (yPos > pageHeight - 15) {
          doc.addPage();
          yPos = 20;
      }
      if (isRed) doc.setTextColor(255, 0, 0);
      else doc.setTextColor(0, 0, 0);
      
      doc.setFont(getFont(text), "normal");
      doc.text(text, margin, yPos);
      yPos += 5;
  };

  // OTHER COMMENTS with Orange Background
  // Draw Rect
  if (yPos > pageHeight - 15) {
      doc.addPage();
      yPos = 20;
  }
  doc.setFillColor(238, 167, 39); // #EEA727
  doc.rect(margin, yPos - 3.5, pageWidth - margin * 2, 5, 'F'); 
  
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold"); // Bold for the header
  doc.text("OTHER COMMENTS", margin + 1, yPos); // Indent slightly
  doc.setFont("helvetica", "normal");
  yPos += 6; // Move down a bit more after the filled row

  addText(`1. Payment terms: ${order.paymentTerms || '30% Deposit, 70% Before Shipment'}`, false);
  
  // Delivery date formatting
  let deliveryDateStr = 'Mar,15th,2026'; // Default fallback? Or maybe calculate from now?
  if (order.deliveryDate) {
      deliveryDateStr = formatDateToEnglish(order.deliveryDate);
  } else {
      // Default to 4-5 weeks if not specified, similar to Quote?
      // But Order usually has specific date.
      // Let's use the one from Quote remarks if missing: "Order to determine 4-5 WEEKS"
      deliveryDateStr = "4-5 WEEKS"; 
  }
  addText(`2. Delivery time: ${deliveryDateStr}`);
  addText('3. DELIVERY: EX WORKS.');
  addText('4. Beneficiary bank information:');
  addText('Beneficiary: KEBOS POWER CO.,LIMITED');
  addText('Bank Name: HSBC HK');
  addText("Bank Add: NO.1 Queen's Road Central HongKong");
  addText("SWIFT CODE: HSBC HK HHH");
  addText("ACCOUNT NO: 801-366914-838");

  // Signatures
  yPos += 15;
  if (yPos > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
  }
  
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  const buyerText = `Buyer: ${order.customerInfo?.companyName || order.customer}`;
  doc.setFont(getFont(buyerText), "bold");
  doc.text(buyerText, margin, yPos);
  doc.setFont("helvetica", "bold");
  doc.text("Seller: KEBOS POWER CO.,LIMITED", pageWidth / 2 + 20, yPos);

  // Save
  doc.save(`Proforma_Invoice_${order.id}.pdf`);
};
