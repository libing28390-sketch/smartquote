const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const ExcelJS = require('exceljs');

// 配置 (可以通过环境变量注入)
const CONFIG = {
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.qq.com',
    port: process.env.SMTP_PORT || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER || '283904780@qq.com',
      pass: process.env.SMTP_PASS || 'pkjignkfptjwbhfd'
    }
  },
  to: process.env.MAIL_TO || '305586279@qq.com,283904780@qq.com',
  subject: `[SmartQuote] 每周数据备份 (${new Date().toISOString().split('T')[0]})`
};

// 路径配置
const ROOT_DIR = path.resolve(__dirname, '../../');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const BACKUP_DIR = path.join(ROOT_DIR, 'backups');

// 确保备份目录存在
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// 1. 读取 JSON 数据
const readJson = (file) => {
  try {
    const p = path.join(DATA_DIR, file);
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`Error reading ${file}:`, e);
    return [];
  }
};

// 辅助：获取产品库中出现的所有年份
function getAllYears(products) {
  const years = new Set();
  products.forEach(p => {
    if (p.yearlyCosts) {
      Object.keys(p.yearlyCosts).forEach(y => years.add(Number(y)));
    }
  });
  // 降序排列
  return Array.from(years).sort((a, b) => b - a);
}

// 生成产品库 Excel (全量导出)
async function generateProductExcel(products, filePath) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Product Library");

  // 动态获取所有年份
  const allYears = getAllYears(products);
  // 如果没有数据，默认显示当前年和去年
  if (allYears.length === 0) {
    const currentYear = new Date().getFullYear();
    allYears.push(currentYear, currentYear - 1);
  }

  const columns = [
    { header: "KEBOS型号", key: "kebos", width: 15 },
    { header: "系列", key: "series", width: 25 },
    { header: "供应商型号", key: "supplier", width: 15 },
    { header: "规格描述", key: "desc", width: 50 },
    { header: "内置电池", key: "battery", width: 15 },
    { header: "MOQ", key: "moq", width: 8 },
    { header: "产品尺寸(mm)", key: "psize", width: 20 },
    { header: "包装尺寸(mm)", key: "pksize", width: 20 },
    { header: "装箱数(PCS/CTN)", key: "pcs", width: 15 },
    { header: "净重(kg)", key: "nw", width: 10 },
    { header: "毛重(kg)", key: "gw", width: 10 },
  ];

  // 动态添加年份列
  allYears.forEach(year => {
    columns.push({ header: `${year}采购成本(USD)`, key: `cost_${year}_usd`, width: 18 });
    columns.push({ header: `${year}采购成本(RMB)`, key: `cost_${year}_rmb`, width: 18 });
  });

  ws.columns = columns;

  // 设置表头样式
  const headerRow = ws.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  products.forEach(p => {
    const rowData = {
      kebos: p.kebosModel,
      series: p.series,
      supplier: p.supplierModel,
      desc: p.description,
      battery: p.batteryInfo,
      moq: p.moq,
      psize: p.productSize,
      pksize: p.packingSize,
      pcs: p.pcsPerCtn || 1,
      nw: p.nw,
      gw: p.gw,
    };

    // 填充每年的成本
    allYears.forEach(year => {
      rowData[`cost_${year}_usd`] = p.yearlyCosts && p.yearlyCosts[year] ? p.yearlyCosts[year].usd : 0;
      rowData[`cost_${year}_rmb`] = p.yearlyCosts && p.yearlyCosts[year] ? p.yearlyCosts[year].rmb : 0;
    });

    ws.addRow(rowData);
  });

  await wb.xlsx.writeFile(filePath);
}

// 生成客户信息 Excel
async function generateCustomerExcel(customers, filePath) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Customers");

  ws.columns = [
    { header: "ID", key: "id", width: 25 },
    { header: "公司名称", key: "companyName", width: 30 },
    { header: "联系人", key: "contactPerson", width: 20 },
    { header: "电话", key: "phone", width: 20 },
    { header: "邮箱", key: "email", width: 25 },
    { header: "地址", key: "address", width: 40 },
    { header: "创建时间", key: "createdAt", width: 25 },
    { header: "更新时间", key: "updatedAt", width: 25 }
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 25;
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  customers.forEach(c => {
    ws.addRow({
      id: c.id,
      companyName: c.companyName,
      contactPerson: c.contactPerson,
      phone: c.phone,
      email: c.email,
      address: c.address,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    });
  });

  await wb.xlsx.writeFile(filePath);
}

// 生成报价记录 Excel (严格匹配导入模板)
async function generateQuoteExcel(quotes, filePath) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sales Item Ledger");

  // 根据导入模板标准定义列
  ws.columns = [
    { header: "报价单号", key: "id", width: 22 },
    { header: "日期", key: "date", width: 15 },
    { header: "客户名称", key: "customer", width: 25 },
    { header: "产品型号", key: "model", width: 15 },
    { header: "原币成本", key: "originalCost", width: 12 },
    { header: "单位成本", key: "unitCost", width: 12 },
    { header: "单价", key: "price", width: 12 }, // 注意：导入模板这里叫“单价”
    { header: "毛利率", key: "margin", width: 10 },
    { header: "数量", key: "qty", width: 12 },
    { header: "总报价额", key: "total", width: 15 },
    { header: "币种", key: "currency", width: 10 }, // 额外添加币种，方便识别
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 25;
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  quotes.forEach(quote => {
    if (!quote.items || !Array.isArray(quote.items)) return;
    quote.items.forEach(item => {
      // 逻辑：单位成本 = 售价 - 利润 (严格对应导入逻辑)
      const unitCost = item.salesPrice - item.profit;
      
      ws.addRow({
        id: quote.id,
        date: quote.date,
        customer: quote.customer,
        model: item.kebosModel,
        originalCost: Math.round(item.purchasePrice || 0),
        unitCost: Math.round(unitCost || 0),
        price: Math.round(item.salesPrice || 0),
        margin: item.margin,
        qty: item.moq,
        total: Math.round((item.salesPrice || 0) * (item.moq || 0)),
        currency: quote.quotedCurrency || 'USD'
      });
    });
  });

  // 设置格式
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    
    // 获取当前行的币种 (第11列)
    const currencyVal = row.getCell(11).value;
    const isRmb = currencyVal === 'RMB' || currencyVal === 'CNY' || currencyVal === '¥';
    const currencySymbol = isRmb ? '¥' : '$';
    
    // 格式字符串: "$#,##0" 或 "¥#,##0"
    const moneyFmt = `"${currencySymbol}"#,##0`;

    // 5: 原币成本, 6: 单位成本, 7: 单价, 10: 总额
    row.getCell(5).numFmt = moneyFmt;
    row.getCell(6).numFmt = moneyFmt;
    row.getCell(7).numFmt = moneyFmt;
    row.getCell(10).numFmt = moneyFmt;

    row.getCell(8).numFmt = '0.00%'; // Margin
  });

  await wb.xlsx.writeFile(filePath);
}

// 生成销售订单 Excel (Orders)
async function generateOrderExcel(orders, filePath) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Orders");
  
    // 定义订单表头 (根据 orders.json 结构推断)
    ws.columns = [
      { header: "订单号", key: "id", width: 20 },
      { header: "PI号码", key: "piNo", width: 20 },
      { header: "日期", key: "date", width: 15 },
      { header: "客户", key: "customer", width: 25 },
      { header: "状态", key: "status", width: 12 },
      { header: "总金额", key: "totalAmount", width: 15 },
      { header: "币种", key: "currency", width: 10 },
      { header: "条款", key: "paymentTerms", width: 30 },
      { header: "备注", key: "remarks", width: 30 }
    ];
  
    const headerRow = ws.getRow(1);
    headerRow.height = 25;
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  
    orders.forEach(order => {
      ws.addRow({
        id: order.id,
        piNo: order.piNo,
        date: order.date,
        customer: order.customer,
        status: order.status,
        totalAmount: order.totalAmount,
        currency: order.currency,
        paymentTerms: order.paymentTerms,
        remarks: order.remarks
      });
    });
  
    await wb.xlsx.writeFile(filePath);
}

// 主流程
const run = async () => {
  console.log('>>> 开始备份流程...');

  try {
    const products = readJson('products.json');
    const quotes = readJson('quotes.json');
    const orders = readJson('orders.json');
    const customers = readJson('customers.json');
    
    console.log(`[-] 读取到 ${products.length} 个产品, ${quotes.length} 条报价, ${orders.length} 条订单, ${customers.length} 个客户`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const productExcelPath = path.join(BACKUP_DIR, `Product_Library_${timestamp}.xlsx`);
    const quoteExcelPath = path.join(BACKUP_DIR, `Quotes_Record_${timestamp}.xlsx`);
    const orderExcelPath = path.join(BACKUP_DIR, `Orders_Record_${timestamp}.xlsx`);
    const customerExcelPath = path.join(BACKUP_DIR, `Customer_Info_${timestamp}.xlsx`);

    console.log('[-] 正在生成 Excel 文件...');
    await generateProductExcel(products, productExcelPath);
    await generateQuoteExcel(quotes, quoteExcelPath);
    await generateOrderExcel(orders, orderExcelPath);
    await generateCustomerExcel(customers, customerExcelPath);

    // 步骤 3: 发送邮件
    console.log('[-] 正在发送邮件...');
    const transporter = nodemailer.createTransport(CONFIG.smtp);

    await transporter.sendMail({
      from: `"SmartQuote Backup" <${CONFIG.smtp.auth.user}>`,
      to: CONFIG.to,
      subject: CONFIG.subject,
      text: `SmartQuote 数据备份\n\n日期: ${new Date().toLocaleString()}\n包含文件:\n1. 全量产品库 (xlsx)\n2. 报价记录 (xlsx)\n3. 销售订单 (xlsx)\n4. 客户信息 (xlsx)`,
      attachments: [
        {
          filename: `Product_Library_${timestamp}.xlsx`,
          path: productExcelPath
        },
        {
          filename: `Quotes_Record_${timestamp}.xlsx`,
          path: quoteExcelPath
        },
        {
          filename: `Orders_Record_${timestamp}.xlsx`,
          path: orderExcelPath
        },
        {
          filename: `Customer_Info_${timestamp}.xlsx`,
          path: customerExcelPath
        }
      ]
    });

    console.log('>>> 备份发送成功！');

    // 步骤 4: 清理临时文件 (可选)
    // fs.unlinkSync(productExcelPath);
    // fs.unlinkSync(quoteExcelPath);
    // fs.unlinkSync(orderExcelPath);

  } catch (error) {
    console.error('!!! 备份失败:', error);
    process.exit(1);
  }
};

run();

