import ExcelJS from "exceljs";
import * as FileSaver from "file-saver";
import { Quote, Product, QuoteItem, ProductCost, ProductSeries, SalesOrder } from "./types";



const saveAs = (FileSaver as any).saveAs || (FileSaver as any).default?.saveAs || (FileSaver as any).default || FileSaver;

const roundTo2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const calcRmbCost = (usd: number): number => {
  return roundTo2(usd * 7.1 * 1.13);
};

export const cleanNumericValue = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export const getCellText = (cellValue: any): string => {
  if (cellValue === null || cellValue === undefined) return '';
  if (typeof cellValue === 'object') {
    if (cellValue.richText && Array.isArray(cellValue.richText)) {
      return cellValue.richText.map((rt: any) => rt.text).join('');
    }
    if (cellValue.text) {
      return String(cellValue.text);
    }
    if (cellValue.result !== undefined) {
        return String(cellValue.result);
    }
  }
  return String(cellValue).trim();
};

const calculateCbm = (sizeStr: string): number => {
  if (!sizeStr) return 0;
  // Assume format: L*W*H or LxWxH in mm. Also support comma separator.
  const parts = sizeStr.toLowerCase().replace(/[,x×]/g, '*').split('*').map(s => parseFloat(s.trim()));
  if (parts.length < 3 || parts.some(isNaN)) return 0;
  const [l, w, h] = parts;
  return (l * w * h) / 1000000000;
};

const formatDate = (val: any): string => {
  if (!val) return new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
  
  let date: Date;
  if (val instanceof Date) {
    date = val;
  } else if (typeof val === 'number' && val > 30000) {
    date = new Date((val - 25569) * 86400 * 1000);
  } else {
    const s = String(val).trim();
    if (s.includes('GMT')) {
      date = new Date(s);
    } else {
      date = new Date(s.replace(/\./g, '-').replace(/\//g, '-'));
    }
  }

  if (isNaN(date.getTime())) {
    return String(val).split(' ')[0] || new Date().toISOString().split('T')[0];
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const predictSeries = (model: string, seriesInput: string): ProductSeries => {
  const s = String(seriesInput || '').toLowerCase();
  const m = model.toUpperCase();
  
  // 1. 优先检查明确的关键字 (Inverter)
  // 只要系列、描述或型号中包含 INVERTER，就判定为 Inverter
  if (s.includes('inverter') || m.includes('INVERTER')) return 'Inverter';
  
  if (s.includes('offline')) return 'Offline';
  // 优先匹配 Online 系列，因为 "Online" 包含 "line" 关键字
  if (s.includes('hf') || s.includes('high')) return 'Online HF';
  if (s.includes('lf') || s.includes('low') || s.includes('power')) return 'Online LF';
  if (s.includes('interactive') || s.includes('line')) return 'Line-Interactive';
  
  if (m.startsWith('PG')) return 'Line-Interactive';
  if (m.startsWith('PH')) return 'Online HF';
  if (m.startsWith('PL')) return 'Online LF';
  // 针对用户反馈的 Inverter 系列型号前缀 KH 增加识别规则
  if (m.startsWith('KH')) return 'Inverter';
  
  return 'Others';
};

export const formatCurrency = (value: number, currency: 'USD' | 'RMB' = 'USD') => {
  const validCurrencyCode = currency === 'RMB' ? 'CNY' : currency;
  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: validCurrencyCode,
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0,
    }).format(value);
  } catch (e) {
    const symbol = currency === 'USD' ? '$' : '¥';
    return `${symbol}${value.toLocaleString('zh-CN')}`;
  }
};

export const formatPercent = (value: number) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const getPriceTrend = (product: Product) => {
  const years = Object.keys(product.yearlyCosts || {}).map(Number).sort((a, b) => b - a);
  if (years.length < 2) return { diff: 0, percent: 0, direction: 'new' };
  const current = product.yearlyCosts[years[0]].usd;
  const previous = product.yearlyCosts[years[1]].usd;
  if (previous === 0) return { diff: 0, percent: 0, direction: 'stable' };
  const diff = current - previous;
  const percent = diff / previous;
  return { diff, percent, direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'stable' };
};

// 导出全量产品库
export async function exportProductsToXlsx(products: Product[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Product Library");
  
  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;

  ws.columns = [
    { header: "KEBOS型号", key: "kebos", width: 15 },
    { header: "系列", key: "series", width: 25 },
    { header: "分类(UPS/Spare Parts)", key: "category", width: 20 },
    { header: "供应商型号", key: "supplier", width: 15 },
    { header: "工厂料号", key: "factoryPartNumber", width: 18 },
    { header: "规格描述", key: "desc", width: 50 },
    { header: "内置电池", key: "battery", width: 15 },
    { header: "MOQ", key: "moq", width: 8 },
    { header: "产品尺寸(mm)", key: "psize", width: 20 },
    { header: "包装尺寸(mm)", key: "pksize", width: 20 },
    { header: "装箱数(PCS/CTN)", key: "pcs", width: 15 },
    { header: "净重(kg)", key: "nw", width: 10 },
    { header: "毛重(kg)", key: "gw", width: 10 },
    { header: `${currentYear}采购成本(USD)`, key: "c_usd", width: 18 },
    { header: `${currentYear}采购成本(RMB)`, key: "c_rmb", width: 18 },
    { header: `${prevYear}采购成本(USD)`, key: "p_usd", width: 18 },
    { header: `${prevYear}采购成本(RMB)`, key: "p_rmb", width: 18 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  products.forEach(p => {
    ws.addRow({
      kebos: p.kebosModel,
      series: p.series,
      category: p.category || 'UPS',
      supplier: p.supplierModel,
      factoryPartNumber: p.factoryPartNumber || '',
      desc: p.description,
      battery: p.batteryInfo,
      moq: p.moq,
      psize: p.productSize,
      pksize: p.packingSize,
      pcs: p.pcsPerCtn || 1,
      nw: p.nw,
      gw: p.gw,
      c_usd: p.yearlyCosts[currentYear]?.usd || 0,
      c_rmb: p.yearlyCosts[currentYear]?.rmb || 0,
      p_usd: p.yearlyCosts[prevYear]?.usd || 0,
      p_rmb: p.yearlyCosts[prevYear]?.rmb || 0,
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `KEBOS_Product_Database_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function generateProductTemplateXlsx() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Product Template");
  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;

  ws.columns = [
    { header: "KEBOS型号", key: "kebos", width: 15 },
    { header: "系列", key: "series", width: 25 },
    { header: "分类(UPS/Spare Parts)", key: "category", width: 20 },
    { header: "供应商型号", key: "supplier", width: 15 },
    { header: "工厂料号", key: "factoryPartNumber", width: 18 },
    { header: "规格描述", key: "desc", width: 50 },
    { header: "内置电池", key: "battery", width: 15 },
    { header: "MOQ", key: "moq", width: 8 },
    { header: "产品尺寸(mm)", key: "psize", width: 20 },
    { header: "包装尺寸(mm)", key: "pksize", width: 20 },
    { header: "净重(kg)", key: "nw", width: 10 },
    { header: "毛重(kg)", key: "gw", width: 10 },
    { header: "装箱数(PCS/CTN)", key: "pcs", width: 15 },
    { header: `${currentYear}采购成本(USD)`, key: "c_usd", width: 18 },
    { header: `${currentYear}采购成本(RMB)`, key: "c_rmb", width: 18 },
    { header: `${prevYear}采购成本(USD)`, key: "p_usd", width: 18 },
    { header: `${prevYear}采购成本(RMB)`, key: "p_rmb", width: 18 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 35;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `KEBOS_Product_Import_Template.xlsx`);
}

export async function generateHistoricalTemplateXlsx() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("History Template");
  ws.columns = [
    { header: "报价单号", key: "id", width: 22 },
    { header: "日期", key: "date", width: 15 },
    { header: "客户名称", key: "customer", width: 25 },
    { header: "产品型号", key: "model", width: 20 },
    { header: "原币成本", key: "originalCost", width: 15 },
    { header: "单位成本", key: "unitCost", width: 15 },
    { header: "单价", key: "price", width: 15 },
    { header: "毛利率", key: "margin", width: 10 },
    { header: "数量", key: "qty", width: 10 },
    { header: "总报价额", key: "total", width: 18 },
  ];
  const headerRow = ws.getRow(1);
  headerRow.height = 25;
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `KEBOS_Historical_Import_Template.xlsx`);
}

export async function parseProductExcel(file: File): Promise<Product[]> {
  const wb = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await wb.xlsx.load(arrayBuffer);
  const ws = wb.worksheets[0];
  const products: Product[] = [];
  const headerRow = ws.getRow(1);
  const colMap: Record<string, number> = {};

  headerRow.eachCell((cell, colNumber) => {
    const val = getCellText(cell.value);
    if (val.includes('KEBOS型号') || val.toLowerCase().includes('model')) colMap['kebos'] = colNumber;
    else if (val.includes('系列') || val.toLowerCase().includes('series')) colMap['series'] = colNumber;
    else if (val.includes('分类') || val.toLowerCase().includes('category') || val.toUpperCase().includes('ITEM')) colMap['category'] = colNumber;
    else if (val.includes('供应商型号') || val.toLowerCase().includes('supplier')) colMap['supplier'] = colNumber;
    else if (val.includes('工厂料号') || val.toLowerCase().includes('factory')) colMap['factoryPartNumber'] = colNumber;
    else if (val.includes('规格描述') || val.toLowerCase().includes('desc')) colMap['desc'] = colNumber;
    else if (val.includes('内置电池') || val.toLowerCase().includes('battery')) colMap['battery'] = colNumber;
    else if (val.includes('MOQ') || val.toLowerCase().includes('moq')) colMap['moq'] = colNumber;
    else if (val.includes('Product Size') || val.includes('产品尺寸')) colMap['psize'] = colNumber;
    else if (val.includes('Packing Size') || val.includes('包装尺寸')) colMap['pksize'] = colNumber;
    else if (val.includes('PCS/CTN') || val.includes('PCS') || val.includes('装箱数')) colMap['pcs'] = colNumber;
    else if (val.includes('N.W.') || val.includes('净重')) colMap['nw'] = colNumber;
    else if (val.includes('G.W.') || val.includes('毛重')) colMap['gw'] = colNumber;
    // else if (val.includes('包装')) colMap['pkg'] = colNumber; // Removed as per user request
  });

  const costCols: { col: number, year: number, currency: 'usd' | 'rmb' }[] = [];
  headerRow.eachCell((cell, colNumber) => {
    const val = getCellText(cell.value);
    if (val.includes('采购成本')) {
      const yearMatch = val.match(/\d{4}/);
      const isRmb = val.toLowerCase().includes('rmb');
      const currency = isRmb ? 'rmb' : 'usd';
      if (yearMatch) costCols.push({ col: colNumber, year: parseInt(yearMatch[0]), currency });
    }
  });

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const kebosModel = getCellText(row.getCell(colMap['kebos'] || 1).value).trim();
    if (!kebosModel) return;
    const seriesVal = colMap['series'] ? getCellText(row.getCell(colMap['series']).value) : '';
    // 如果系列为空，尝试从描述中推断，或者依赖型号
    const descVal = colMap['desc'] ? getCellText(row.getCell(colMap['desc']).value) : '';
    // 修复：将系列和描述合并传入，确保 predictSeries 能获取所有信息
    const productSeries = predictSeries(kebosModel, seriesVal + ' ' + descVal);
    
    // Parse category
    let category: 'UPS' | 'Spare Parts' = 'UPS';
    if (colMap['category']) {
      const catVal = getCellText(row.getCell(colMap['category']).value).trim().toLowerCase();
      if (catVal.includes('spare') || catVal.includes('part') || catVal.includes('配件')) {
        category = 'Spare Parts';
      }
    }

    const yearlyCosts: Record<number, ProductCost> = {};
    costCols.forEach(({ col, year, currency }) => {
      if (!yearlyCosts[year]) yearlyCosts[year] = { usd: 0, rmb: 0 };
      const val = cleanNumericValue(row.getCell(col).value);
      yearlyCosts[year][currency] = roundTo2(val);
    });

    products.push({
      id: `PROD-${Date.now()}-${rowNumber}`,
      kebosModel,
      supplierModel: colMap['supplier'] ? getCellText(row.getCell(colMap['supplier']).value) : '',
      factoryPartNumber: colMap['factoryPartNumber'] ? getCellText(row.getCell(colMap['factoryPartNumber']).value) : '',
      series: productSeries,
      category,
      description: descVal,
      batteryInfo: colMap['battery'] ? getCellText(row.getCell(colMap['battery']).value) : '',
      moq: colMap['moq'] ? cleanNumericValue(row.getCell(colMap['moq']).value) : 0,
      productSize: colMap['psize'] ? getCellText(row.getCell(colMap['psize']).value) : '',
      packingSize: colMap['pksize'] ? getCellText(row.getCell(colMap['pksize']).value) : '',
      pcsPerCtn: colMap['pcs'] ? cleanNumericValue(row.getCell(colMap['pcs']).value) || 1 : 1,
      nw: colMap['nw'] ? cleanNumericValue(row.getCell(colMap['nw']).value) : 0,
      gw: colMap['gw'] ? cleanNumericValue(row.getCell(colMap['gw']).value) : 0,
      packaging: colMap['pkg'] ? getCellText(row.getCell(colMap['pkg']).value) : '',
      yearlyCosts,
      updatedAt: new Date().toISOString()
    });
  });
  return products;
}

export async function parseHistoricalQuotesExcel(file: File, products: Product[]): Promise<Quote[]> {
  const wb = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await wb.xlsx.load(arrayBuffer);
  const ws = wb.worksheets[0];
  const quotes: Quote[] = [];
  const modelMap = new Map<string, Product>();
  products.forEach(p => {
    modelMap.set(p.kebosModel.trim().toLowerCase(), p);
  });

  const headerRow = ws.getRow(1);
  const colMap: Record<string, number> = {};
  
  headerRow.eachCell((cell, colNumber) => {
    const val = getCellText(cell.value);
    if (val === '报价单号') colMap['id'] = colNumber;
    else if (val === '日期') colMap['date'] = colNumber;
    else if (val === '客户名称') colMap['customer'] = colNumber;
    else if (val === '产品型号') colMap['model'] = colNumber;
    else if (val === '原币成本') colMap['originalCost'] = colNumber;
    else if (val === '单位成本') colMap['unitCost'] = colNumber;
    else if (val === '单价') colMap['price'] = colNumber;
    else if (val === '数量') colMap['qty'] = colNumber;
    else if (val === '币种') colMap['currency'] = colNumber;
  });

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    
    // Parse ID
    let quoteId = colMap['id'] ? getCellText(row.getCell(colMap['id']).value) : '';
    if (!quoteId) quoteId = `QT-HIST-${Date.now()}-${rowNumber}`;

    const rawDate = colMap['date'] ? row.getCell(colMap['date']).value : null;
    const dateText = formatDate(rawDate);
    const customer = colMap['customer'] ? getCellText(row.getCell(colMap['customer']).value) || '未知客户' : '未知客户';
    const rawModel = colMap['model'] ? getCellText(row.getCell(colMap['model']).value) : '';
    
    // Helper to detect currency from cell
    const detectCurrency = (cell: ExcelJS.Cell): 'RMB' | 'USD' | null => {
      const valStr = getCellText(cell.value);
      const numFmt = cell.numFmt || '';
      if (valStr.includes('¥') || valStr.includes('CNY') || numFmt.includes('¥') || numFmt.includes('CNY')) return 'RMB';
      if (valStr.includes('$') || valStr.includes('USD') || numFmt.includes('$') || numFmt.includes('USD')) return 'USD';
      return null;
    };

    // Detect Sales Currency
    let salesCurrency: 'USD' | 'RMB' = 'USD'; // Default
    // 1. Check explicit '币种' column
    if (colMap['currency']) {
      const cVal = getCellText(row.getCell(colMap['currency']).value).toUpperCase();
      if (cVal === 'RMB' || cVal === 'CNY' || cVal === '¥') salesCurrency = 'RMB';
      else if (cVal === 'USD' || cVal === '$') salesCurrency = 'USD';
    }
    // 2. Check Price column if not determined by column (or confirm consistency? let's stick to column if present, else cell)
    if (!colMap['currency']) {
      const detected = colMap['price'] ? detectCurrency(row.getCell(colMap['price'])) : null;
      if (detected) salesCurrency = detected;
    }

    // Detect Cost Currency
    // Default cost currency: if sales is RMB, assume RMB. If sales is USD, it could be USD or RMB.
    // We check the Original Cost column for explicit signals.
    let costCurrency: 'USD' | 'RMB' = salesCurrency === 'RMB' ? 'RMB' : 'USD';
    if (colMap['originalCost']) {
      const detected = detectCurrency(row.getCell(colMap['originalCost']));
      if (detected) costCurrency = detected;
    }

    // Determine Pricing Mode
    let pricingMode: 'USD_TO_RMB' | 'USD_TO_USD' | 'RMB_TO_RMB' | 'RMB_TO_USD' = 'USD_TO_USD';
    if (costCurrency === 'RMB' && salesCurrency === 'RMB') pricingMode = 'RMB_TO_RMB';
    else if (costCurrency === 'RMB' && salesCurrency === 'USD') pricingMode = 'RMB_TO_USD';
    else if (costCurrency === 'USD' && salesCurrency === 'RMB') pricingMode = 'USD_TO_RMB';
    else pricingMode = 'USD_TO_USD';

    // Parse numeric values
    const priceCellVal = colMap['price'] ? getCellText(row.getCell(colMap['price']).value) : '';
    const price = cleanNumericValue(priceCellVal); // Remove Math.round
    
    const originalCostVal = colMap['originalCost'] ? cleanNumericValue(row.getCell(colMap['originalCost']).value) : 0;
    const unitCostVal = colMap['unitCost'] ? cleanNumericValue(row.getCell(colMap['unitCost']).value) : 0;
    const qty = colMap['qty'] ? (Math.round(cleanNumericValue(row.getCell(colMap['qty']).value)) || 1) : 1;

    if (!rawModel) return;
    const matchedProd = modelMap.get(rawModel.toLowerCase());
    
    let costToUse = originalCostVal; // Remove Math.round
    // If no original cost provided, try to find from product library
    if (costToUse <= 0 && matchedProd) {
      const years = Object.keys(matchedProd.yearlyCosts).map(Number).sort((a,b)=>b-a);
      const latestCost = matchedProd.yearlyCosts[years[0]] || { usd: 0, rmb: 0 };
      costToUse = costCurrency === 'USD' ? latestCost.usd : latestCost.rmb;
    }

    // If unitCost is provided in Excel, calculate profit to match that unitCost
    // because unitCost = salesPrice - profit
    // so profit = salesPrice - unitCost
    let profitPerUnit = 0;
    if (colMap['unitCost'] && unitCostVal > 0) {
       profitPerUnit = price - unitCostVal;
    } else {
       profitPerUnit = price - costToUse; // Fallback to standard profit calc
    }

    const margin = price > 0 ? profitPerUnit / price : 0;

    const item: QuoteItem = {
      id: `ITEM-HIST-${Date.now()}-${rowNumber}`,
      productId: matchedProd?.id || 'manual',
      kebosModel: rawModel,
      description: matchedProd ? matchedProd.description : '',
      batteryInfo: matchedProd ? matchedProd.batteryInfo : '',
      purchasePrice: costToUse,
      salesPrice: price,
      moq: qty,
      standardMoq: matchedProd?.moq || 0,
      profit: profitPerUnit,
      margin: margin
    };

    quotes.push({
      id: quoteId,
      date: dateText,
      customer,
      items: [item],
      quotedCurrency: salesCurrency,
      pricingMode: pricingMode,
      exchangeRate: 7.1,
      totalAmount: price * qty,
      totalProfit: profitPerUnit * qty,
      avgMargin: margin
    });
  });
  return quotes;
}

const formatDateToEnglish = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = d.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day}${suffix} ${months[d.getMonth()]},${d.getFullYear()}`;
};

export async function exportCustomersToXlsx(customers: any[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Customer List");
  
  ws.columns = [
    { header: "客户ID", key: "customerId", width: 15 },
    { header: "公司名称", key: "companyName", width: 30 },
    { header: "公司名称(本地语)", key: "companyNameLocal", width: 30 },
    { header: "联系人", key: "contactPerson", width: 20 },
    { header: "职位", key: "position", width: 15 },
    { header: "联系电话", key: "phone", width: 20 },
    { header: "电子邮箱", key: "email", width: 25 },
    { header: "网站", key: "website", width: 25 },
    { header: "国家/地区", key: "country", width: 15 },
    { header: "地址", key: "address", width: 40 },
    { header: "行业分类", key: "industry", width: 15 },
    { header: "公司规模", key: "scale", width: 15 },
    { header: "社交账号", key: "socialApp", width: 20 },
    { header: "时区", key: "timezone", width: 10 },
    { header: "偏好沟通方式", key: "communicationPreference", width: 15 },
    { header: "语言偏好", key: "languagePreference", width: 10 },
    { header: "客户阶段", key: "stage", width: 15 },
    { header: "客户等级", key: "level", width: 10 },
    { header: "首次接触日期", key: "firstContactDate", width: 15 },
    { header: "最近沟通时间", key: "lastContactDate", width: 15 },
    { header: "下次跟进计划日期", key: "nextActionDate", width: 15 },
    { header: "下次跟进计划内容", key: "nextActionPlan", width: 30 },
    { header: "创建时间", key: "createdAt", width: 15 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  customers.forEach(c => {
    ws.addRow({
      customerId: c.customerId,
      companyName: c.companyName,
      companyNameLocal: c.companyNameLocal,
      contactPerson: c.contactPerson,
      position: c.position,
      phone: c.phone,
      email: c.email,
      website: c.website,
      address: c.address,
      industry: c.industry,
      scale: c.scale,
      socialApp: c.socialApp,
      timezone: c.timezone,
      communicationPreference: c.communicationPreference,
      languagePreference: c.languagePreference,
      stage: c.stage,
      level: c.level,
      firstContactDate: c.firstContactDate,
      lastContactDate: c.lastContactDate,
      nextActionDate: c.nextActionDate,
      nextActionPlan: c.nextActionPlan,
      createdAt: formatDate(c.createdAt)
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `KEBOS_Customer_List_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function generateCustomerTemplateXlsx() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Customer Template");

  ws.columns = [
    { header: "客户ID", key: "customerId", width: 15 },
    { header: "公司名称", key: "companyName", width: 30 },
    { header: "公司名称(本地语)", key: "companyNameLocal", width: 30 },
    { header: "联系人", key: "contactPerson", width: 20 },
    { header: "职位", key: "position", width: 15 },
    { header: "联系电话", key: "phone", width: 20 },
    { header: "电子邮箱", key: "email", width: 25 },
    { header: "网站", key: "website", width: 25 },
    { header: "地址", key: "address", width: 40 },
    { header: "行业分类", key: "industry", width: 15 },
    { header: "公司规模", key: "scale", width: 15 },
    { header: "社交账号", key: "socialApp", width: 20 },
    { header: "时区", key: "timezone", width: 10 },
    { header: "偏好沟通方式", key: "communicationPreference", width: 15 },
    { header: "语言偏好", key: "languagePreference", width: 10 },
    { header: "客户阶段", key: "stage", width: 15 },
    { header: "客户等级", key: "level", width: 10 },
    { header: "首次接触日期", key: "firstContactDate", width: 15 },
    { header: "最近沟通时间", key: "lastContactDate", width: 15 },
    { header: "下次跟进计划日期", key: "nextActionDate", width: 15 },
    { header: "下次跟进计划内容", key: "nextActionPlan", width: 30 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Add a sample row
  ws.addRow({
    customerId: "CN001",
    companyName: "Sample Company Ltd.",
    companyNameLocal: "样本公司",
    contactPerson: "John Doe",
    position: "Manager",
    phone: "+1 123 456 7890",
    email: "john@example.com",
    website: "www.example.com",
    address: "123 Business Rd, Tech City",
    industry: "IT",
    scale: "50-100",
    socialApp: "WhatsApp: +1...",
    timezone: "UTC+8",
    communicationPreference: "Email",
    languagePreference: "English",
    stage: "Potential",
    level: "B",
    firstContactDate: "2023-01-01",
    lastContactDate: "2023-12-01",
    nextActionDate: "2024-01-15",
    nextActionPlan: "Follow up on proposal",
  });

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `KEBOS_Customer_Import_Template.xlsx`);
}

export async function parseCustomerExcel(file: File): Promise<any[]> {
  const wb = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await wb.xlsx.load(arrayBuffer);
  const ws = wb.worksheets[0];
  const customers: any[] = [];
  const headerRow = ws.getRow(1);
  const colMap: Record<string, number> = {};

  headerRow.eachCell((cell, colNumber) => {
    const val = getCellText(cell.value);
    if (val.includes('客户ID') || val.toLowerCase().includes('customerid')) colMap['customerId'] = colNumber;
    else if (val.includes('公司名称(本地语)') || val.toLowerCase().includes('local')) colMap['companyNameLocal'] = colNumber;
    else if (val.includes('客户名称') || val.includes('公司名称') || val.toLowerCase().includes('company') || val.toLowerCase().includes('name')) colMap['companyName'] = colNumber;
    else if (val.includes('联系人') || val.toLowerCase().includes('contact') || val.toLowerCase().includes('person')) colMap['contactPerson'] = colNumber;
    else if (val.includes('职位') || val.toLowerCase().includes('position')) colMap['position'] = colNumber;
    else if (val.includes('联系电话') || val.toLowerCase().includes('phone') || val.toLowerCase().includes('tel')) colMap['phone'] = colNumber;
    else if (val.includes('电子邮箱') || val.toLowerCase().includes('email') || val.toLowerCase().includes('mail')) colMap['email'] = colNumber;
    else if (val.includes('网站') || val.toLowerCase().includes('website')) colMap['website'] = colNumber;
    else if (val.includes('地址') || val.toLowerCase().includes('address') || val.toLowerCase().includes('location')) colMap['address'] = colNumber;
    else if (val.includes('行业分类') || val.toLowerCase().includes('industry')) colMap['industry'] = colNumber;
    else if (val.includes('公司规模') || val.toLowerCase().includes('scale')) colMap['scale'] = colNumber;
    else if (val.includes('社交账号') || val.toLowerCase().includes('social')) colMap['socialApp'] = colNumber;
    else if (val.includes('时区') || val.toLowerCase().includes('timezone')) colMap['timezone'] = colNumber;
    else if (val.includes('偏好沟通方式') || val.toLowerCase().includes('communication')) colMap['communicationPreference'] = colNumber;
    else if (val.includes('语言偏好') || val.toLowerCase().includes('language')) colMap['languagePreference'] = colNumber;
    else if (val.includes('客户阶段') || val.toLowerCase().includes('stage')) colMap['stage'] = colNumber;
    else if (val.includes('客户等级') || val.toLowerCase().includes('level')) colMap['level'] = colNumber;
    else if (val.includes('首次接触日期') || val.toLowerCase().includes('first')) colMap['firstContactDate'] = colNumber;
    else if (val.includes('最近沟通时间') || val.toLowerCase().includes('last')) colMap['lastContactDate'] = colNumber;
    else if (val.includes('下次跟进计划日期') || val.toLowerCase().includes('next date')) colMap['nextActionDate'] = colNumber;
    else if (val.includes('下次跟进计划内容') || val.toLowerCase().includes('next plan')) colMap['nextActionPlan'] = colNumber;
  });

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const companyName = colMap['companyName'] ? getCellText(row.getCell(colMap['companyName']).value).trim() : '';
    if (!companyName) return;

    customers.push({
      id: `CUST-${Date.now()}-${rowNumber}`,
      customerId: colMap['customerId'] ? getCellText(row.getCell(colMap['customerId']).value) : '',
      companyName,
      companyNameLocal: colMap['companyNameLocal'] ? getCellText(row.getCell(colMap['companyNameLocal']).value) : '',
      contactPerson: colMap['contactPerson'] ? getCellText(row.getCell(colMap['contactPerson']).value) : '',
      position: colMap['position'] ? getCellText(row.getCell(colMap['position']).value) : '',
      phone: colMap['phone'] ? getCellText(row.getCell(colMap['phone']).value) : '',
      email: colMap['email'] ? getCellText(row.getCell(colMap['email']).value) : '',
      website: colMap['website'] ? getCellText(row.getCell(colMap['website']).value) : '',
      country: colMap['country'] ? getCellText(row.getCell(colMap['country']).value) : '',
      address: colMap['address'] ? getCellText(row.getCell(colMap['address']).value) : '',
      industry: colMap['industry'] ? getCellText(row.getCell(colMap['industry']).value) : '',
      scale: colMap['scale'] ? getCellText(row.getCell(colMap['scale']).value) : '',
      socialApp: colMap['socialApp'] ? getCellText(row.getCell(colMap['socialApp']).value) : '',
      timezone: colMap['timezone'] ? getCellText(row.getCell(colMap['timezone']).value) : '',
      communicationPreference: colMap['communicationPreference'] ? getCellText(row.getCell(colMap['communicationPreference']).value) : '',
      languagePreference: colMap['languagePreference'] ? getCellText(row.getCell(colMap['languagePreference']).value) : '',
      stage: colMap['stage'] ? getCellText(row.getCell(colMap['stage']).value) : '',
      level: colMap['level'] ? getCellText(row.getCell(colMap['level']).value) : '',
      firstContactDate: colMap['firstContactDate'] ? formatDate(row.getCell(colMap['firstContactDate']).value) : '',
      lastContactDate: colMap['lastContactDate'] ? formatDate(row.getCell(colMap['lastContactDate']).value) : '',
      nextActionDate: colMap['nextActionDate'] ? formatDate(row.getCell(colMap['nextActionDate']).value) : '',
      nextActionPlan: colMap['nextActionPlan'] ? getCellText(row.getCell(colMap['nextActionPlan']).value) : '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });
  return customers;
}

export async function exportKebosQuotationXlsx(quote: Quote, logoSource: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Quotation");
  const totalCols = 6;
  ws.columns = [
    { width: 6 }, { width: 22 }, { width: 60 }, { width: 16 }, { width: 13 }, { width: 18 }
  ];
  ws.getRow(1).height = 65; 
  for (let i = 1; i <= 8; i++) ws.mergeCells(i, 1, i, totalCols);
  try {
    const response = await fetch(logoSource);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const logoId = wb.addImage({ buffer: arrayBuffer, extension: 'png' });
    // 1.41cm ~= 53px, 3.81cm ~= 144px
    ws.addImage(logoId, { tl: { col: 0.1, row: 0.1 } as any, ext: { width: 144, height: 53 }, editAs: 'oneCell' });
  } catch (err) {}

  const headerRows = [
    { text: "KEBOS  POWER CO.,LTD", font: { size: 24, bold: true }, align: 'center' }, 
    { text: "1-4F, Building 5, Yusheng Industrial Park, No.467, Section Xixiang, Bao An District, Shenzhen, China", font: { size: 10, bold: false }, align: 'center' },
    { text: "Website: www.kebospower.com", font: { size: 10, bold: false }, align: 'center' },
    { text: "Email: alicehe@kebospower.com", font: { size: 10, bold: false }, align: 'center' },
    { text: "Contact: Alice He   Tel :86-0755-86016601 Ext.8511              Mobile/WhatsApp/Wechat: 0086-13927276161", font: { size: 10, bold: false }, align: 'center' },
    { text: `To: ${quote.customer}`, font: { size: 11, bold: false }, align: 'left' },
    { text: "From: Alice he", font: { size: 11, bold: false }, align: 'left' },
    { text: `Date: ${formatDateToEnglish(quote.date)}`, font: { size: 11, bold: false }, align: 'right' }
  ];

  headerRows.forEach((row, idx) => {
    const cell = ws.getCell(idx + 1, 1);
    cell.value = row.text;
    cell.font = { ...row.font, name: 'Arial' };
    cell.alignment = { horizontal: row.align as any, vertical: 'middle' };
  });

  ws.mergeCells(9, 1, 9, totalCols);
  const titleCell = ws.getCell(9, 1);
  titleCell.value = "KEBOS  UPS Quotation"; 
  titleCell.font = { size: 16, bold: true, name: 'Arial' };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  const currencyUnit = quote.quotedCurrency;
  const currencySymbol = currencyUnit === 'USD' ? '$' : '¥';
  const numFormat = `"${currencySymbol}"#,##0`;
  const hasSample = quote.items.some(i => i.isSample || i.moq < 2);
  const hasLowQty = quote.items.some(i => !i.isSample && i.moq >= 2 && i.moq < i.standardMoq);
  let labelPrice = "NET PRICE";
  let labelMoq = "MOQ\n(PCS)";
  if (hasSample) {
    labelPrice = "SAMPLE PRICE";
    labelMoq = "SAMPLE\n(PCS)";
  } else if (hasLowQty) {
    labelPrice = "NET PRICE";
    labelMoq = "QUANTITY\n(PCS)";
  }

  const headers = ['Item', 'Model#', 'Product description', `${labelPrice}\n(${currencyUnit})`, labelMoq, `Total\nPRICE(${currencyUnit})` ];
  ws.getRow(10).height = 40;
  headers.forEach((h, i) => {
    const cell = ws.getCell(10, i + 1);
    cell.value = h;
    cell.font = { name: 'Arial Unicode MS', size: 10, bold: false }; 
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }; 
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  quote.items.forEach((item, idx) => {
    const rowNum = 11 + idx;
    const row = ws.getRow(rowNum);
    row.getCell(1).value = idx + 1;
    row.getCell(2).value = item.kebosModel;
    row.getCell(3).value = item.description;
    row.getCell(4).value = Math.round(item.salesPrice);
    row.getCell(5).value = item.moq;
    row.getCell(6).value = Math.round(item.salesPrice) * item.moq;
    row.eachCell({ includeEmpty: false }, (cell, colNum) => {
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      cell.alignment = { 
        vertical: 'middle', 
        horizontal: colNum === 3 ? 'left' : 'center', 
        wrapText: true 
      };
      cell.font = { size: 10, name: colNum === 3 ? 'DengXian' : 'Arial', bold: false }; 
    });
    row.getCell(4).numFmt = numFormat;
    row.getCell(6).numFmt = numFormat;
  });

  const totalRowNum = 11 + quote.items.length;
  ws.mergeCells(totalRowNum, 1, totalRowNum, 5);
  ws.getCell(totalRowNum, 1).value = "TOTAL";
  ws.getCell(totalRowNum, 1).font = { bold: false, italic: false, name: 'Arial' }; 
  ws.getCell(totalRowNum, 1).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell(totalRowNum, 6).value = quote.items.reduce((s, i) => s + Math.round(i.salesPrice) * i.moq, 0);
  ws.getCell(totalRowNum, 6).font = { bold: false, italic: false, name: 'Arial' }; 
  ws.getCell(totalRowNum, 6).numFmt = numFormat;
  for (let i = 1; i <= 6; i++) ws.getCell(totalRowNum, i).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

  const remarksStartRow = totalRowNum + 2;
  ws.mergeCells(remarksStartRow, 1, remarksStartRow, totalCols);
  ws.getCell(remarksStartRow, 1).value = "Remarks:";
  ws.getCell(remarksStartRow, 1).font = { bold: false, name: 'Arial', size: 12 };
  const remarks = [
    "1.This price is EX Factory.",
    "2.Order to determine 4-5 WEEKS of delivery.",
    "3.Payment: 30% deposit, to be settled before shipment.",
    `4.This offer open from ${formatDateToEnglish(quote.date)} to ${formatDateToEnglish(new Date(Date.now() + 30*86400000).toISOString())}.`,
    "5.Warranty period: 1 years"
  ];
  if (hasSample || hasLowQty) remarks.push("6.For quantities less than MOQ, the price is for evaluation only.");
  remarks.forEach((text, i) => {
    const rowNum = remarksStartRow + 1 + i;
    ws.mergeCells(rowNum, 1, rowNum, totalCols);
    ws.getCell(rowNum, 1).value = text;
    ws.getCell(rowNum, 1).font = { name: 'Arial', size: 11, bold: false };
  });
  saveAs(new Blob([await wb.xlsx.writeBuffer()]), `KEBOS_Quote_${quote.customer}.xlsx`);
}

export async function exportAllQuotesSummaryXlsx(quotes: Quote[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sales Item Ledger");

  ws.columns = [
    { header: "报价单号", key: "id", width: 22 },
    { header: "日期", key: "date", width: 15 },
    { header: "客户名称", key: "customer", width: 25 },
    { header: "产品型号", key: "model", width: 15 },
    { header: "原币成本", key: "originalCost", width: 12 },
    { header: "单位成本", key: "unitCost", width: 12 },
    { header: "单价", key: "unitPrice", width: 12 },
    { header: "毛利率", key: "margin", width: 10 },
    { header: "数量", key: "qty", width: 12 },
    { header: "总报价额", key: "total", width: 15 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 25;
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  quotes.forEach(quote => {
    quote.items.forEach(item => {
      const unitCost = item.salesPrice - item.profit;
      const currencySymbol = quote.quotedCurrency === 'RMB' ? '¥' : '$';
      const sourceCurrencySymbol = (quote.pricingMode?.startsWith('RMB')) ? '¥' : '$';

      const row = ws.addRow({
        id: quote.id,
        date: quote.date,
        customer: quote.customer,
        model: item.kebosModel,
        originalCost: Math.round(item.purchasePrice),
        unitCost: Math.round(unitCost),
        unitPrice: Math.round(item.salesPrice),
        margin: item.margin, 
        qty: item.moq,
        total: Math.round(item.salesPrice * item.moq),
      });

      row.eachCell((cell, colNum) => {
        cell.alignment = { vertical: 'middle', horizontal: (colNum <= 4 || colNum === 9) ? 'center' : 'right' };
        if (colNum === 8) { // Margin
           cell.numFmt = '0.00%';
        } else if (colNum === 5) { // Original Cost
           cell.numFmt = `"${sourceCurrencySymbol}"#,##0`;
        } else if (colNum === 6 || colNum === 7 || colNum === 10) { // Unit Cost, Unit Price, Total
           cell.numFmt = `"${currencySymbol}"#,##0`;
        }
      });
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `KEBOS_Sales_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function generatePackingListXlsx(quote: Quote, products: Product[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Packing List");

  // Style helpers
  const commonAlignment: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const borderStyle: Partial<ExcelJS.Borders> = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

  // Title
  ws.mergeCells('A1:G1');
  const title = ws.getCell('A1');
  title.value = 'PACKING LIST';
  title.font = { name: 'Arial', size: 20, bold: true };
  title.alignment = commonAlignment;
  ws.getRow(1).height = 40;

  // Headers
  const headers = ['NO.', 'Parts No.&Description', 'QTY.\n(PCS)', 'LIST OF\nPKGS.\n(carton)', 'N.W.\n(kgs)', 'G.W.\n(kgs)', 'MEAS.\n(CBM)'];
  const headerRow = ws.getRow(2);
  headerRow.height = 40;
  
  // Set column widths
  ws.columns = [
    { width: 8 },  // NO.
    { width: 40 }, // Description
    { width: 12 }, // QTY
    { width: 12 }, // PKGS
    { width: 12 }, // NW
    { width: 12 }, // GW
    { width: 12 }, // CBM
  ];

  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Arial', size: 10, bold: true };
    cell.alignment = commonAlignment;
    cell.border = borderStyle;
  });

  // Data
  let totalQty = 0;
  let totalCartons = 0;
  let totalNw = 0;
  let totalGw = 0;
  let totalCbm = 0;

  const productMap = new Map(products.map(p => [p.kebosModel.toLowerCase(), p]));
  const productIdMap = new Map(products.map(p => [p.id, p]));

  quote.items.forEach((item, idx) => {
    const rowIdx = 3 + idx;
    const row = ws.getRow(rowIdx);
    
    // Find product
    const product = productMap.get(item.kebosModel.toLowerCase()) || productIdMap.get(item.productId);
    const pcsPerCtn = product?.pcsPerCtn || 1;
    const cartons = Math.ceil(item.moq / pcsPerCtn);
    
    const unitNw = product?.nw || 0;
    const cartonGw = product?.gw || 0;
    const packingSize = product?.packingSize || '';
    const cartonCbm = calculateCbm(packingSize);

    // Calculate line totals
    // N.W. is usually per unit * qty
    const lineNw = cartons * unitNw;
    // G.W. is usually per carton * cartons
    const lineGw = cartons * cartonGw; 
    // Volume is per carton * cartons
    const lineCbm = cartons * cartonCbm;

    row.getCell(1).value = idx + 1;
    row.getCell(2).value = item.kebosModel;
    row.getCell(3).value = item.moq;
    row.getCell(4).value = cartons;
    row.getCell(5).value = lineNw;
    row.getCell(5).numFmt = '0.000';
    row.getCell(6).value = lineGw;
    row.getCell(6).numFmt = '0.000';
    row.getCell(7).value = lineCbm;
    row.getCell(7).numFmt = '0.000';

    // Styles
    row.eachCell((cell) => {
        cell.border = borderStyle;
        cell.alignment = commonAlignment;
        cell.font = { name: 'Arial', size: 10 };
    });

    totalQty += item.moq;
    totalCartons += cartons;
    totalNw += lineNw;
    totalGw += lineGw;
    totalCbm += lineCbm;
  });

  // Total Row
  const totalRowIdx = 3 + quote.items.length;
  const totalRow = ws.getRow(totalRowIdx);
  
  ws.mergeCells(`A${totalRowIdx}:B${totalRowIdx}`);
  const totalLabel = totalRow.getCell(1);
  totalLabel.value = 'Total';
  totalLabel.alignment = commonAlignment;
  totalLabel.font = { name: 'Arial', size: 10, bold: true };
  totalLabel.border = borderStyle;
  totalRow.getCell(2).border = borderStyle;

  const setTotal = (col: number, val: number, isFloat = false) => {
      const cell = totalRow.getCell(col);
      cell.value = val;
      if (isFloat) cell.numFmt = '0.000';
      cell.alignment = commonAlignment;
      cell.font = { name: 'Arial', size: 10, bold: true };
      cell.border = borderStyle;
  };

  setTotal(3, totalQty);
  setTotal(4, totalCartons);
  setTotal(5, totalNw, true);
  setTotal(6, totalGw, true);
  setTotal(7, totalCbm, true);

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `PackingList_${quote.customer}_${quote.date}.xlsx`);
}

export async function exportSalesOrderXlsx(order: SalesOrder, logoSource: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Proforma Invoice");
  const totalCols = 6;
  ws.columns = [
    { width: 6 }, { width: 22 }, { width: 60 }, { width: 16 }, { width: 13 }, { width: 18 }
  ];
  ws.getRow(1).height = 65; 
  for (let i = 1; i <= 8; i++) ws.mergeCells(i, 1, i, totalCols);
  try {
    const response = await fetch(logoSource);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const logoId = wb.addImage({ buffer: arrayBuffer, extension: 'png' });
    ws.addImage(logoId, { tl: { col: 0.1, row: 0.1 } as any, ext: { width: 144, height: 53 }, editAs: 'oneCell' });
  } catch (err) {}

  const headerRows = [
    { text: "KEBOS  POWER CO.,LTD", font: { size: 24, bold: true }, align: 'center' }, 
    { text: "1-4F, Building 5, Yusheng Industrial Park, No.467, Section Xixiang, Bao An District, Shenzhen, China", font: { size: 10, bold: false }, align: 'center' },
    { text: "Website: www.kebospower.com", font: { size: 10, bold: false }, align: 'center' },
    { text: "Email: alicehe@kebospower.com", font: { size: 10, bold: false }, align: 'center' },
    { text: "Contact: Alice He   Tel :86-0755-86016601 Ext.8511              Mobile/WhatsApp/Wechat: 0086-13927276161", font: { size: 10, bold: false }, align: 'center' },
    { text: `To: ${order.customerInfo?.companyName || order.customer}`, font: { size: 11, bold: false }, align: 'left' },
    { text: `Attn: ${order.customerInfo?.contactPerson || ''} / Invoice No: ${order.id}`, font: { size: 11, bold: false }, align: 'left' },
    { text: `Date: ${formatDateToEnglish(order.createdAt)}`, font: { size: 11, bold: false }, align: 'right' }
  ];

  headerRows.forEach((row, idx) => {
    const cell = ws.getCell(idx + 1, 1);
    cell.value = row.text;
    cell.font = { ...row.font, name: 'Arial' };
    cell.alignment = { horizontal: row.align as any, vertical: 'middle' };
  });

  ws.mergeCells(9, 1, 9, totalCols);
  const titleCell = ws.getCell(9, 1);
  titleCell.value = "PROFORMA INVOICE"; 
  titleCell.font = { size: 16, bold: true, name: 'Arial' };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  const currencyUnit = order.currency;
  const currencySymbol = currencyUnit === 'USD' ? '$' : '¥';
  const numFormat = `"${currencySymbol}"#,##0`;
  
  const labelPrice = "UNIT PRICE";
  const labelQty = "QUANTITY\n(PCS)";

  const headers = ['Item', 'Model#', 'Product description', `${labelPrice}\n(${currencyUnit})`, labelQty, `Total\nAMOUNT(${currencyUnit})` ];
  ws.getRow(10).height = 40;
  headers.forEach((h, i) => {
    const cell = ws.getCell(10, i + 1);
    cell.value = h;
    cell.font = { name: 'Arial Unicode MS', size: 10, bold: false }; 
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }; 
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  order.items.forEach((item, idx) => {
    const rowNum = 11 + idx;
    const row = ws.getRow(rowNum);
    row.getCell(1).value = idx + 1;
    row.getCell(2).value = item.kebosModel;
    row.getCell(3).value = item.description;
    row.getCell(4).value = Math.round(item.unitPrice);
    row.getCell(5).value = item.quantity;
    row.getCell(6).value = Math.round(item.unitPrice) * item.quantity;
    row.eachCell({ includeEmpty: false }, (cell, colNum) => {
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      cell.alignment = { 
        vertical: 'middle', 
        horizontal: colNum === 3 ? 'left' : 'center', 
        wrapText: true 
      };
      cell.font = { size: 10, name: colNum === 3 ? 'DengXian' : 'Arial', bold: false }; 
    });
    row.getCell(4).numFmt = numFormat;
    row.getCell(6).numFmt = numFormat;
  });

  const totalRowNum = 11 + order.items.length;
  ws.mergeCells(totalRowNum, 1, totalRowNum, 5);
  ws.getCell(totalRowNum, 1).value = "TOTAL";
  ws.getCell(totalRowNum, 1).font = { bold: false, italic: false, name: 'Arial' }; 
  ws.getCell(totalRowNum, 1).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell(totalRowNum, 6).value = order.totalAmount;
  ws.getCell(totalRowNum, 6).font = { bold: false, italic: false, name: 'Arial' }; 
  ws.getCell(totalRowNum, 6).numFmt = numFormat;
  for (let i = 1; i <= 6; i++) ws.getCell(totalRowNum, i).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

  const remarksStartRow = totalRowNum + 2;
  ws.mergeCells(remarksStartRow, 1, remarksStartRow, totalCols);
  ws.getCell(remarksStartRow, 1).value = "Remarks:";
  ws.getCell(remarksStartRow, 1).font = { bold: false, name: 'Arial', size: 12 };
  
  const remarks = [
    `1. Payment terms: ${order.paymentTerms || '30% Deposit, 70% Before Shipment'}`,
    `2. Delivery time: ${order.deliveryDate ? formatDateToEnglish(order.deliveryDate) : '4-5 WEEKS'}`,
    "3. DELIVERY: EX WORKS.",
    "4. Beneficiary bank information:",
    "   Beneficiary: KEBOS POWER CO.,LIMITED",
    "   Bank Name: HSBC HK",
    "   Bank Add: NO.1 Queen's Road Central HongKong",
    "   SWIFT CODE: HSBC HK HHH",
    "   ACCOUNT NO: 801-366914-838",
    "5. Warranty period: 1 years"
  ];
  
  remarks.forEach((text, i) => {
    const rowNum = remarksStartRow + 1 + i;
    ws.mergeCells(rowNum, 1, rowNum, totalCols);
    ws.getCell(rowNum, 1).value = text;
    ws.getCell(rowNum, 1).font = { name: 'Arial', size: 11, bold: false };
  });
  
  saveAs(new Blob([await wb.xlsx.writeBuffer()]), `KEBOS_PI_${order.id}.xlsx`);
}

export const COUNTRY_CODE_MAP: Record<string, string> = {
  // Asia
  "china": "CN", "中国": "CN", "cn": "CN",
  "hong kong": "HK", "香港": "HK", "hk": "HK",
  "macao": "MO", "macau": "MO", "澳门": "MO", "mo": "MO",
  "taiwan": "TW", "台湾": "TW", "tw": "TW",
  "japan": "JP", "日本": "JP", "jp": "JP",
  "korea": "KR", "south korea": "KR", "韩国": "KR", "kr": "KR", "kp": "KP", "north korea": "KP", "朝鲜": "KP",
  "india": "IN", "印度": "IN", "in": "IN",
  "indonesia": "ID", "印尼": "ID", "印度尼西亚": "ID", "id": "ID",
  "malaysia": "MY", "马来西亚": "MY", "my": "MY",
  "philippines": "PH", "菲律宾": "PH", "ph": "PH",
  "singapore": "SG", "新加坡": "SG", "sg": "SG",
  "thailand": "TH", "泰国": "TH", "th": "TH",
  "vietnam": "VN", "越南": "VN", "vn": "VN",
  "pakistan": "PK", "巴基斯坦": "PK", "pk": "PK",
  "bangladesh": "BD", "孟加拉": "BD", "bd": "BD",
  "sri lanka": "LK", "斯里兰卡": "LK", "lk": "LK",
  "nepal": "NP", "尼泊尔": "NP", "np": "NP",
  "myanmar": "MM", "缅甸": "MM", "mm": "MM",
  "cambodia": "KH", "柬埔寨": "KH", "kh": "KH",
  "laos": "LA", "老挝": "LA", "la": "LA",
  "mongolia": "MN", "蒙古": "MN", "mn": "MN",
  "kazakhstan": "KZ", "哈萨克斯坦": "KZ", "kz": "KZ",
  "uzbekistan": "UZ", "乌兹别克斯坦": "UZ", "uz": "UZ",
  
  // Europe
  "uk": "GB", "united kingdom": "GB", "great britain": "GB", "英国": "GB", "gb": "GB", "england": "GB",
  "germany": "DE", "deutschland": "DE", "德国": "DE", "de": "DE",
  "france": "FR", "法国": "FR", "fr": "FR",
  "italy": "IT", "意大利": "IT", "it": "IT",
  "spain": "ES", "西班牙": "ES", "es": "ES",
  "portugal": "PT", "葡萄牙": "PT", "pt": "PT",
  "netherlands": "NL", "holland": "NL", "荷兰": "NL", "nl": "NL",
  "belgium": "BE", "比利时": "BE", "be": "BE",
  "switzerland": "CH", "瑞士": "CH", "ch": "CH",
  "sweden": "SE", "瑞典": "SE", "se": "SE",
  "norway": "NO", "挪威": "NO", "no": "NO",
  "denmark": "DK", "丹麦": "DK", "dk": "DK",
  "finland": "FI", "芬兰": "FI", "fi": "FI",
  "ireland": "IE", "爱尔兰": "IE", "ie": "IE",
  "austria": "AT", "奥地利": "AT", "at": "AT",
  "poland": "PL", "波兰": "PL", "pl": "PL",
  "czech": "CZ", "czech republic": "CZ", "捷克": "CZ", "cz": "CZ",
  "hungary": "HU", "匈牙利": "HU", "hu": "HU",
  "greece": "GR", "希腊": "GR", "gr": "GR",
  "romania": "RO", "罗马尼亚": "RO", "ro": "RO",
  "bulgaria": "BG", "保加利亚": "BG", "bg": "BG",
  "ukraine": "UA", "乌克兰": "UA", "ua": "UA",
  "russia": "RU", "俄罗斯": "RU", "ru": "RU",
  "belarus": "BY", "白俄罗斯": "BY", "by": "BY",
  "turkey": "TR", "土耳其": "TR", "tr": "TR",
  "serbia": "RS", "塞尔维亚": "RS", "rs": "RS",
  "croatia": "HR", "克罗地亚": "HR", "hr": "HR",
  
  // North America
  "usa": "US", "united states": "US", "america": "US", "美国": "US", "us": "US",
  "canada": "CA", "加拿大": "CA", "ca": "CA",
  "mexico": "MX", "墨西哥": "MX", "mx": "MX",
  
  // South America
  "brazil": "BR", "巴西": "BR", "br": "BR",
  "argentina": "AR", "阿根廷": "AR", "ar": "AR",
  "chile": "CL", "智利": "CL", "cl": "CL",
  "colombia": "CO", "哥伦比亚": "CO", "co": "CO",
  "peru": "PE", "秘鲁": "PE", "pe": "PE",
  "venezuela": "VE", "委内瑞拉": "VE", "ve": "VE",
  "ecuador": "EC", "厄瓜多尔": "EC", "ec": "EC",
  "uruguay": "UY", "乌拉圭": "UY", "uy": "UY",
  "paraguay": "PY", "巴拉圭": "PY", "py": "PY",
  
  // Oceania
  "australia": "AU", "澳大利亚": "AU", "澳洲": "AU", "au": "AU",
  "new zealand": "NZ", "新西兰": "NZ", "nz": "NZ",
  
  // Middle East
  "uae": "AE", "united arab emirates": "AE", "阿联酋": "AE", "ae": "AE",
  "saudi arabia": "SA", "沙特": "SA", "沙特阿拉伯": "SA", "sa": "SA",
  "iran": "IR", "伊朗": "IR", "ir": "IR",
  "iraq": "IQ", "伊拉克": "IQ", "iq": "IQ",
  "israel": "IL", "以色列": "IL", "il": "IL",
  "jordan": "JO", "约旦": "JO", "jo": "JO",
  "lebanon": "LB", "黎巴嫩": "LB", "lb": "LB",
  "kuwait": "KW", "科威特": "KW", "kw": "KW",
  "qatar": "QA", "卡塔尔": "QA", "qa": "QA",
  "oman": "OM", "阿曼": "OM", "om": "OM",
  "yemen": "YE", "也门": "YE", "ye": "YE",
  "egypt": "EG", "埃及": "EG", "eg": "EG",
  
  // Africa
  "south africa": "ZA", "南非": "ZA", "za": "ZA",
  "nigeria": "NG", "尼日利亚": "NG", "ng": "NG",
  "kenya": "KE", "肯尼亚": "KE", "ke": "KE",
  "ethiopia": "ET", "埃塞俄比亚": "ET", "et": "ET",
  "morocco": "MA", "摩洛哥": "MA", "ma": "MA",
  "algeria": "DZ", "阿尔及利亚": "DZ", "dz": "DZ",
  "ghana": "GH", "加纳": "GH", "gh": "GH",
  "tanzania": "TZ", "坦桑尼亚": "TZ", "tz": "TZ",
  "uganda": "UG", "乌干达": "UG", "ug": "UG",
  "zimbabwe": "ZW", "津巴布韦": "ZW", "zw": "ZW",
  "zambia": "ZM", "赞比亚": "ZM", "zm": "ZM",
  "angola": "AO", "安哥拉": "AO", "ao": "AO",
  
  // Others
  "china mainland": "CN",
  "prc": "CN",
  "usa.": "US",
  "u.s.a.": "US",
  "u.s.": "US",
  "uk.": "GB",
  "u.k.": "GB",
};

export const getCountryCode = (country: string): string => {
  if (!country) return 'XX';
  const c = country.trim().toLowerCase();
  
  // 1. Direct map lookup
  if (COUNTRY_CODE_MAP[c]) return COUNTRY_CODE_MAP[c];

  // 2. Try lookup by removing spaces/periods for some variations (e.g. "U.S.A.")
  const cleanC = c.replace(/[\.\s]/g, '');
  if (COUNTRY_CODE_MAP[cleanC]) return COUNTRY_CODE_MAP[cleanC];

  // 3. Fallback: If input is exactly 2 letters, assume it is a valid ISO code
  if (/^[a-z]{2}$/.test(c)) return c.toUpperCase();

  return 'XX';
};



