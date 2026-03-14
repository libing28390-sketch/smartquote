
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Calendar, Trash2, FileSpreadsheet, FileText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { SalesOrder, OrderStatus, PaymentStatus } from '../types';
import { formatCurrency } from '../utils';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { generateOrderPDF } from '../orderPdfGenerator';

interface OrderListProps {
  orders: SalesOrder[];
  onViewOrder: (order: SalesOrder) => void;
  onCreateOrder: () => void;
  onDelete: (id: string) => void;
}

const OrderList: React.FC<OrderListProps> = ({ orders, onViewOrder, onCreateOrder, onDelete }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'All'>('All');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [jumpToPage, setJumpToPage] = useState('');

  const statusMap: Record<string, string> = {
    'Pending': '待处理',
    'Production': '生产中',
    'Shipped': '已发货',
    'Completed': '已完成',
    'Cancelled': '已取消',
    'All': '全部订单'
  };

  const paymentStatusMap: Record<string, string> = {
    'Unpaid': '未付款',
    'Deposit Received': '已付定金',
    'Fully Paid': '全额付清'
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = 
        order.id.toLowerCase().includes(search.toLowerCase()) ||
        order.customer.toLowerCase().includes(search.toLowerCase()) ||
        (order.customerPO && order.customerPO.toLowerCase().includes(search.toLowerCase()));
      
      const matchesStatus = statusFilter === 'All' || order.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, search, statusFilter]);

  const orderStats = useMemo(() => {
    const pendingCount = filteredOrders.filter(order => order.status === 'Pending' || order.status === 'Production').length;
    const shippedCount = filteredOrders.filter(order => order.status === 'Shipped' || order.status === 'Completed').length;
    const unpaidCount = filteredOrders.filter(order => order.paymentStatus === 'Unpaid').length;
    const totalAmount = filteredOrders.reduce((sum, order) => sum + (order.currency === 'RMB' ? (order.totalAmount || 0) / (order.exchangeRate || 7.1) : (order.totalAmount || 0)), 0);
    return { pendingCount, shippedCount, unpaidCount, totalAmount };
  }, [filteredOrders]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, pageSize]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const pageOrderStats = useMemo(() => {
    const now = new Date();
    const overdueCount = paginatedOrders.filter(order => order.deliveryDate && new Date(order.deliveryDate) < now && order.status !== 'Completed' && order.status !== 'Cancelled').length;
    const productionCount = paginatedOrders.filter(order => order.status === 'Production').length;
    const unpaidAmount = paginatedOrders.reduce((sum, order) => {
      if (order.paymentStatus !== 'Unpaid') return sum;
      return sum + (order.currency === 'RMB' ? (order.totalAmount || 0) / (order.exchangeRate || 7.1) : (order.totalAmount || 0));
    }, 0);
    return {
      overdueCount,
      productionCount,
      unpaidAmount,
    };
  }, [paginatedOrders]);

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpToPage);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p);
      setJumpToPage('');
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'Pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Production': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Shipped': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Cancelled': return 'bg-slate-100 text-slate-500 border-slate-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'Unpaid': return 'text-rose-500';
      case 'Deposit Received': return 'text-amber-600';
      case 'Fully Paid': return 'text-emerald-600';
      default: return 'text-slate-500';
    }
  };

  const handleExportExcel = async (e: React.MouseEvent, order: SalesOrder) => {
    e.stopPropagation();
    try {
        if (!order) {
            alert("订单数据无效");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Proforma Invoice');

        // Default font - fix undefined error
        // sheet.style is not a direct property on Worksheet in some versions of ExcelJS
        // Instead we can iterate or set default style on cells if needed, or rely on ExcelJS defaults.
        // For now, removing the problematic line: sheet.style.font = ...
        // We will set font on rows/cells as needed.


        // Column setup
        sheet.columns = [
          { key: 'A', width: 8 },  // ITEM No
          { key: 'B', width: 12 }, // Brand
          { key: 'C', width: 12 }, // ITEM Type
          { key: 'D', width: 20 }, // Model
          { key: 'E', width: 45 }, // Description
          { key: 'F', width: 15 }, // Quantity
          { key: 'G', width: 22 }, // Unit Price
          { key: 'H', width: 22 }, // Amount
        ];

        // --- Header Section ---
        // Logo
        try {
            const logoResponse = await fetch('/assets/logo.png');
            const logoBlob = await logoResponse.blob();
            const logoBuffer = await logoBlob.arrayBuffer();
            const logoId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
            
            // Insert logo at A1
            // Adjust position and size to match template
            // Assuming A1 is part of the header area.
            // Note: merging cells A1:H1 later might affect this, but images float over cells.
            sheet.addImage(logoId, {
                tl: { col: 0, row: 0 }, // Top-left corner of A1
                ext: { width: 144, height: 53 }, // Approximate size, same as quote export
                editAs: 'oneCell'
            });
        } catch (err) {
            console.error("Failed to load logo:", err);
        }

        // Company Header
        sheet.getRow(1).height = 42;
        sheet.mergeCells('A1:H1');
        const headerRow = sheet.getCell('A1');
        headerRow.value = 'KEBOS POWER CO.,LIMITED';
        headerRow.font = { name: 'Arial', size: 24, bold: true };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

        sheet.mergeCells('A2:H2');
        const addrRow = sheet.getCell('A2');
        addrRow.value = 'Add: Building A,No.16,Gu Da ROAD ,GUANG DONG,China';
        addrRow.alignment = { horizontal: 'center', vertical: 'middle' };
        addrRow.font = { name: 'DengXian', size: 12 };

        sheet.mergeCells('A3:H3');
        const contactRow = sheet.getCell('A3');
        contactRow.value = `Contact: ${order.salesInfo?.name || 'Ms.Alice He'}    Mob:${order.salesInfo?.phone || '+86-13927276161'}    E-mail: ${order.salesInfo?.email || 'alicehe@kebospower.com'}`;
        contactRow.alignment = { horizontal: 'center', vertical: 'middle' };
        contactRow.font = { name: 'DengXian', size: 12 };

        // Title
        sheet.mergeCells('A4:H4');
        const titleRow = sheet.getCell('A4');
        titleRow.value = 'PROFORMA    INVOICE';
        titleRow.font = { name: 'Arial', size: 20, bold: true };
        titleRow.alignment = { horizontal: 'center', vertical: 'middle' };

        // --- Bill To & Invoice Info ---
        // Row 5: Bill To Label & Date
        const row5 = sheet.getRow(5);
        row5.values = ['BILL TO: ' + (order.customerInfo?.companyName || order.customer)];
        sheet.mergeCells('A5:E5');
        sheet.getCell('A5').font = { name: 'Arial', size: 10, bold: true };
        
        sheet.getCell('G5').value = 'DATE:';
        sheet.getCell('G5').font = { name: 'Arial', size: 10, bold: true };
        sheet.getCell('G5').alignment = { horizontal: 'right' };
        
        // Custom date format: 20th,Jan,2026
        let dateStr = '20th,Jan,2026'; // Default fallback
        try {
            const date = new Date(order.createdAt);
            if (!isNaN(date.getTime())) {
                const day = date.getDate();
                const suffix = ["th", "st", "nd", "rd"][((day % 100) > 10 && (day % 100) < 20) ? 0 : (day % 10 < 4) ? day % 10 : 0];
                const month = date.toLocaleString('en-US', { month: 'short' });
                dateStr = `${day}${suffix},${month},${date.getFullYear()}`;
            }
        } catch (err) {
            console.error("Date formatting error:", err);
        }
        
        sheet.getCell('H5').value = dateStr;
        sheet.getCell('H5').font = { name: 'Arial', size: 10, bold: true };

        // Row 6: Address & Invoice No
        const row6 = sheet.getRow(6);
        sheet.mergeCells('A6:E6');
        sheet.getCell('A6').value = `Add: ${order.customerInfo?.address || ''}`;
        sheet.getCell('A6').font = { name: 'DengXian', size: 12 };
        
        sheet.mergeCells('G6:H6');
        const invoiceCell = sheet.getCell('G6');
        invoiceCell.value = `INVOICE No.: ${order.id}`;
        invoiceCell.font = { name: 'Arial', size: 10, bold: true };
        invoiceCell.alignment = { horizontal: 'right' };

        // Row 7: Attn & Payment
        const row7 = sheet.getRow(7);
        sheet.mergeCells('A7:E7');
        sheet.getCell('A7').value = `Atte: ${order.customerInfo?.contactPerson || ''}  TEL: ${order.customerInfo?.phone || ''}`;
        sheet.getCell('A7').font = { name: 'DengXian', size: 12 };

        sheet.getCell('G7').value = 'PAYMENT:';
        sheet.getCell('G7').font = { name: 'Arial', size: 10, bold: true };
        sheet.getCell('G7').alignment = { horizontal: 'center' };
        sheet.getCell('H7').value = 'T/T'; 
        sheet.getCell('H7').alignment = { horizontal: 'center' };
        sheet.getCell('H7').font = { name: 'DengXian', size: 12 };

        // --- Table Header ---
        const headerRowIdx = 9;
        const headerValues = ['ITEM NO.', 'Brand', 'ITEM', 'Model', 'DESCRIPTION OF GOODS', 'QUANTITY (PCS)', 'UNIT PRICE (USD)', 'AMOUNT (USD)'];
        const row9 = sheet.getRow(headerRowIdx);
        row9.values = headerValues;
        
        // Header Styling
        row9.eachCell((cell) => {
          cell.font = { name: 'Arial', size: 10, bold: true };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });

        // Sub-header for price (Ex Work)
        sheet.getCell('G10').value = 'EX Work';
        sheet.getCell('G10').alignment = { horizontal: 'center' };
        sheet.getCell('G10').font = { name: 'DengXian', size: 12 };
        // We won't merge G10:H10 to avoid conflict if we write data there later, 
        // but actually data starts at row 11.
        
        // --- Items ---
        let currentRowIdx = 11;
        let totalQty = 0;

        if (order.items && Array.isArray(order.items)) {
            order.items.forEach((item, index) => {
              const row = sheet.getRow(currentRowIdx);
              
              // Heuristic for Brand and Type based on template
              const isMainUnit = item.itemType === 'Normal';
              const brand = isMainUnit ? 'MASU' : '/';
              // Use category if available, otherwise fallback
              const type = item.category || (isMainUnit ? 'UPS' : 'Spare Parts');
              
              row.values = [
                index + 1,
                brand,
                type,
                item.kebosModel,
                item.description,
                item.quantity,
                item.unitPrice === 0 ? 0 : item.unitPrice, // Display 0 if FOC
                item.total === 0 ? 0 : item.total
              ];

              // Styling
              row.eachCell((cell, colNumber) => {
                cell.border = {
                  top: { style: 'thin' },
                  left: { style: 'thin' },
                  bottom: { style: 'thin' },
                  right: { style: 'thin' }
                };
                cell.alignment = { vertical: 'middle', wrapText: true };
                
                // Center align most columns except Description
                if (colNumber !== 5) { // Description is col 5
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                } else {
                    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
                }

                // Currency formatting
                if (colNumber === 7 || colNumber === 8) {
                   cell.numFmt = '"$"#,##0.00';
                }
                
                // Set Font
                cell.font = { name: 'DengXian', size: 12 };
              });
              
              totalQty += item.quantity;
              currentRowIdx++;
            });
        }

        // --- Total Row ---
        const totalRow = sheet.getRow(currentRowIdx);
        // Merge first few columns
        sheet.mergeCells(`A${currentRowIdx}:E${currentRowIdx}`);
        
        // Add TOTAL label
        const totalLabelCell = totalRow.getCell(1);
        totalLabelCell.value = 'TOTAL';
        totalLabelCell.alignment = { horizontal: 'left', vertical: 'middle' };
        totalLabelCell.font = { name: 'DengXian', size: 12, bold: true };
        
        // Apply border to the merged cells (A-E) to ensure the frame is complete
        for (let col = 1; col <= 5; col++) {
            const cell = totalRow.getCell(col);
            cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        }

        const qtyCell = totalRow.getCell(6);
        qtyCell.value = totalQty; // Qty column
        qtyCell.alignment = { horizontal: 'center', vertical: 'middle' };
        qtyCell.font = { name: 'DengXian', size: 12 };
        qtyCell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

        const balanceLabelCell = totalRow.getCell(7);
        balanceLabelCell.value = 'BALANCE AMOUNT:';
        balanceLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };
        balanceLabelCell.font = { name: 'Arial', size: 10, bold: true };
        balanceLabelCell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

        const amountCell = totalRow.getCell(8);
        amountCell.value = order.totalAmount;
        amountCell.numFmt = '"US$"#,##0.00';
        amountCell.font = { name: 'Arial', size: 10, bold: true };
        amountCell.alignment = { horizontal: 'center', vertical: 'middle' };
        amountCell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        
        currentRowIdx++;

        // --- Footer / Comments ---
        currentRowIdx++;
        const commentsStartRow = currentRowIdx;
        
            // Footer styling
            const addComment = (text: string, isRed: boolean = false) => {
                sheet.mergeCells(`A${currentRowIdx}:D${currentRowIdx}`);
                const row = sheet.getRow(currentRowIdx);
                row.getCell(1).value = text;
                const font: Partial<ExcelJS.Font> = { name: 'DengXian', size: 12 };
                if (isRed) {
                    font.color = { argb: 'FFFF0000' };
                }
                row.getCell(1).font = font;
                currentRowIdx++;
            };


        addComment('OTHER COMMENTS');
        addComment(`1. Payment terms: ${order.paymentTerms || 'T/T,30% in advance ,full payment before the shipment .'}`);
        
        // Custom date formatting logic
        let deliveryDateStr = 'Mar,15th,2026'; // fallback
        if (order.deliveryDate) {
            try {
                const d = new Date(order.deliveryDate);
                if (!isNaN(d.getTime())) {
                    const day = d.getDate();
                    const suffix = ["th", "st", "nd", "rd"][((day % 100) > 10 && (day % 100) < 20) ? 0 : (day % 10 < 4) ? day % 10 : 0];
                    const month = d.toLocaleString('en-US', { month: 'short' });
                    deliveryDateStr = `${month},${day}${suffix},${d.getFullYear()}`;
                } else {
                    // If parsing fails but string exists (e.g. manual text input), use it directly
                    deliveryDateStr = order.deliveryDate;
                }
            } catch (e) {
                deliveryDateStr = order.deliveryDate;
            }
        }
        
        addComment(`2. Delivery time:${deliveryDateStr}`, false); // Not Red
        addComment('3. DELIVERY:EX WORKS.');
        addComment('4. Beneficiary bank information:');
        addComment('Beneficiary: KEBOS POWER CO.,LIMITED');
        addComment('Bank Name:HSBC  HK');
        addComment("Bank Add:NO.1  Queen's  Road  Central  HongKong");
        addComment("SWIFT CODE:HSBC HK HHH");
        addComment("ACCOUNT NO: 801-366914-838");

        const signatureRow = sheet.getRow(currentRowIdx);
        sheet.mergeCells(`A${currentRowIdx}:D${currentRowIdx}`);
        signatureRow.getCell(1).value = `Buyer: ${order.customerInfo?.companyName || order.customer}`;
        signatureRow.getCell(1).font = { name: 'Arial', size: 10, bold: true };

        signatureRow.getCell(6).value = 'Seller:';
        signatureRow.getCell(6).font = { name: 'Arial', size: 10, bold: true };

        // Save
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Proforma_Invoice_${order.id}.xlsx`);
    } catch (error) {
        console.error("Export Excel Failed:", error);
        alert(`导出 Excel 失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleExportPDF = (e: React.MouseEvent, order: SalesOrder) => {
    e.stopPropagation();
    generateOrderPDF(order, '/assets/logo.png');
  };

  return (
    <div className="space-y-6">
      <section className="erp-panel rounded-[2rem] px-5 py-6 md:px-8 md:py-7 space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0f5f5b]/10 text-[#0f5f5b] text-[11px] font-black uppercase tracking-[0.24em]">
              <FileText size={14} />
              Order Execution Workspace
            </div>
            <div>
              <h1 className="erp-title text-3xl font-black text-slate-900 tracking-tight">销售订单执行中心</h1>
              <p className="text-sm text-slate-500 max-w-3xl mt-2">订单页的重点不是“列表展示”，而是让你快速判断哪些单待处理、哪些单可发货、哪些单未回款，以及是否可以继续推进执行。</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="搜订单号、客户名、客户 PO" 
                value={search} 
                title="搜索订单"
                onChange={e => setSearch(e.target.value)}
                className="pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[1.2rem] outline-none w-full text-sm font-bold shadow-sm focus:border-[#0f5f5b]" 
              />
            </div>
            <button 
              onClick={onCreateOrder} 
              className="px-5 py-4 bg-slate-900 text-white rounded-[1.2rem] flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
            >
              <Plus size={18} />
              <span className="text-sm font-black">新建订单</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">待执行</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{orderStats.pendingCount}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">待处理与生产中订单</div>
          </div>
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">已发运/完成</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{orderStats.shippedCount}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">已进入交付后段的订单</div>
          </div>
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">未付款</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{orderStats.unpaidCount}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">优先关注回款风险</div>
          </div>
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">筛选总额</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{formatCurrency(orderStats.totalAmount, 'USD')}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">已统一折算为 USD</div>
          </div>
        </div>
      </section>

      {/* Status Filter Tabs */}
      <div className="rounded-[1.6rem] bg-white/75 border border-slate-200 px-4 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {['All', 'Pending', 'Production', 'Shipped', 'Completed', 'Cancelled'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status as any)}
            className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
              statusFilter === status 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {statusMap[status] || status}
          </button>
        ))}
        </div>
        <div className="text-xs text-slate-500 font-bold">当前筛选: {statusMap[statusFilter] || statusFilter} · 共 {filteredOrders.length} 笔订单</div>
      </div>

      <div className="rounded-[1.6rem] bg-white border border-slate-200 px-4 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap gap-3 text-xs font-bold">
          <span className={`px-3 py-2 rounded-xl border ${pageOrderStats.overdueCount > 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>逾期待交 {pageOrderStats.overdueCount}</span>
          <span className="px-3 py-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">生产中 {pageOrderStats.productionCount}</span>
          <span className="px-3 py-2 rounded-xl bg-slate-50 text-slate-600 border border-slate-200">未回款金额 {formatCurrency(pageOrderStats.unpaidAmount, 'USD')}</span>
        </div>
        <div className="text-xs font-bold text-slate-500">当前页更适合做交付推进和回款风险核查。</div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {(paginatedOrders || []).length > 0 ? paginatedOrders.map(order => (
          <div 
            key={order.id} 
            onClick={() => onViewOrder(order)}
            className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex flex-col md:flex-row justify-between gap-6">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider ${getStatusColor(order.status)}`}>
                    {statusMap[order.status] || order.status}
                  </span>
                  <h3 className="text-lg font-black text-slate-900">{order.customer}</h3>
                  {order.customerPO && (
                    <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-500">PO: {order.customerPO}</span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">订单编号</p>
                    <p className="text-sm font-black text-slate-700">{order.id}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">交货日期</p>
                    <div className="flex items-center gap-1 text-slate-700">
                      <Calendar size={12} />
                      <span className="text-sm font-bold">{order.deliveryDate || '未定'}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">订单金额</p>
                    <p className="text-sm font-black text-slate-900">{formatCurrency(order.totalAmount, order.currency)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">付款状态</p>
                    <p className={`text-sm font-black ${getPaymentStatusColor(order.paymentStatus)}`}>
                      {paymentStatusMap[order.paymentStatus] || order.paymentStatus}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
                  <span className="px-2 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-200">条目 {order.items.length}</span>
                  <span className="px-2 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-200">利润 {formatCurrency(order.totalProfit || 0, order.currency)}</span>
                  <span className={`px-2 py-1 rounded-lg border ${order.paymentStatus === 'Unpaid' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{paymentStatusMap[order.paymentStatus] || order.paymentStatus}</span>
                  <span className={`px-2 py-1 rounded-lg border ${order.deliveryDate && new Date(order.deliveryDate) < new Date() && order.status !== 'Completed' && order.status !== 'Cancelled' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {order.deliveryDate && new Date(order.deliveryDate) < new Date() && order.status !== 'Completed' && order.status !== 'Cancelled' ? '交期关注' : '交期正常'}
                  </span>
                </div>

                <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">包含型号</p>
                    <div className="flex flex-wrap gap-2">
                        {order.items.map((item, i) => (
                            <span key={i} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-bold text-slate-600">
                                {item.kebosModel} <span className="text-slate-400">x{item.quantity}</span>
                            </span>
                        ))}
                    </div>
                </div>
              </div>

              <div className="flex flex-col justify-center gap-2 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                <button 
                  onClick={(e) => handleExportExcel(e, order)}
                  className="w-full md:w-auto px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  title="导出 Excel"
                >
                  <FileSpreadsheet size={16} />
                  <span className="text-xs font-bold">导出 Excel</span>
                </button>
                <button 
                  onClick={(e) => handleExportPDF(e, order)}
                  className="w-full md:w-auto px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  title="导出 PDF"
                >
                  <FileText size={16} />
                  <span className="text-xs font-bold">导出 PDF</span>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(order.id); }}
                  className="w-full md:w-auto px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  title="删除订单"
                >
                  <Trash2 size={16} />
                  <span className="text-xs font-bold">删除订单</span>
                </button>
              </div>
            </div>
          </div>
        )) : (
          <div className="py-20 text-center text-slate-400 italic bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
            暂无相关销售订单
          </div>
        )}
      </div>

      {filteredOrders.length > 0 && (
          <div className="flex items-center justify-between bg-white px-8 py-5 rounded-[2.5rem] border border-slate-100 shadow-sm mb-20 animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-6">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                正在显示 <span className="text-slate-900">{(currentPage-1)*pageSize + 1}-{Math.min(currentPage*pageSize, filteredOrders.length)}</span> / <span className="text-slate-900">{filteredOrders.length}</span> 个订单
              </p>
              <div className="h-4 w-px bg-slate-100 hidden sm:block" />
              <div className="hidden sm:flex items-center gap-3">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">每页行数</span>
                 <select 
                    title="每页行数"
                    value={pageSize} 
                    onChange={e => setPageSize(parseInt(e.target.value))}
                    className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 text-[11px] font-black outline-none cursor-pointer focus:ring-2 focus:ring-blue-500"
                 >
                   {[10, 25, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
                 </select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 bg-slate-50/50 p-1.5 rounded-2xl border border-slate-100 shadow-inner">
                <button title="跳到首页" aria-label="跳到首页" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-all rounded-xl hover:bg-white"><ChevronsLeft size={16}/></button>
                <button title="上一页" aria-label="上一页" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-all rounded-xl hover:bg-white"><ChevronLeft size={16}/></button>
                <div className="flex items-center gap-1 px-3"><span className="text-xs font-black text-slate-900">{currentPage}</span><span className="text-[10px] font-black text-slate-300">/</span><span className="text-xs font-black text-slate-400">{totalPages}</span></div>
                <button title="下一页" aria-label="下一页" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-all rounded-xl hover:bg-white"><ChevronRight size={16}/></button>
                <button title="跳到末页" aria-label="跳到末页" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-all rounded-xl hover:bg-white"><ChevronsRight size={16}/></button>
              </div>

              <div className="h-6 w-px bg-slate-100 hidden sm:block" />

              <form onSubmit={handleJumpToPage} className="hidden sm:flex items-center gap-2">
                <input type="text" placeholder="页码" value={jumpToPage} onChange={e => setJumpToPage(e.target.value.replace(/\D/g, ''))} className="w-12 h-9 bg-slate-50 border border-slate-100 rounded-xl px-2 text-center text-xs font-black outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
              </form>
            </div>
          </div>
        )}
    </div>
  );
};

export default OrderList;

