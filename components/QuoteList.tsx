
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Search, Trash2, FileText, Download, Calendar, ArrowUpRight, ArrowDownRight, MoreVertical, Eye, Printer, AlertTriangle, Package, Tag, Wallet, FileSpreadsheet, RefreshCw, Upload, CheckCircle, Calculator, TrendingUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowRight, Clipboard, ShoppingCart, Edit2, Check, X } from 'lucide-react';
import { Quote, QuoteItem, Product, Customer, SalesOrder, OrderItem } from '../types';
import { formatCurrency, formatPercent, exportAllQuotesSummaryXlsx, generateHistoricalTemplateXlsx, parseHistoricalQuotesExcel, generatePackingListXlsx, exportKebosQuotationXlsx, exportSalesOrderXlsx } from '../utils';
import { generatePDF } from '../pdfGenerator';
import { generateOrderPDF } from '../orderPdfGenerator';

interface QuoteListProps {
  quotes: Quote[];
  products: Product[];
  customers?: Customer[];
  onDelete: (id: string) => void;
  onBatchDelete?: (ids: string[]) => void;
  onPreview: (quote: Quote, item?: QuoteItem) => void;
  onImport: (quotes: Quote[]) => void;
  onCreateOrder: (quote: Quote) => void;
  onEdit?: (quote: Quote) => void;
}

const QuoteList: React.FC<QuoteListProps> = ({ quotes, products, customers = [], onDelete, onBatchDelete, onPreview, onImport, onCreateOrder, onEdit }) => {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importingFile, setImportingFile] = useState(false);
  const [marginFilter, setMarginFilter] = useState<'All' | 'Low' | 'Mid' | 'High'>('All');
  const [currencyFilter, setCurrencyFilter] = useState<'All' | 'USD' | 'RMB'>('All');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [jumpToPage, setJumpToPage] = useState('');

  // 展平报价单明细：每个型号一行
  const flattenedItems = useMemo(() => {
    const items: Array<{ quote: Quote, item: QuoteItem }> = [];
    (quotes || []).forEach(q => {
      (q.items || []).forEach(it => {
        if (it) items.push({ quote: q, item: it });
      });
    });
    return items;
  }, [quotes]);

  const filteredItems = useMemo(() => {
    const term = search.toLowerCase();
    return flattenedItems.filter(entry => {
      const customerMatch = (entry.quote.customer || '').toLowerCase().includes(term);
      const modelMatch = (entry.item.kebosModel || '').toLowerCase().includes(term);
      const idMatch = (entry.quote.id || '').toLowerCase().includes(term);
      const searchMatch = customerMatch || modelMatch || idMatch;

      const marginMatch = marginFilter === 'All'
        || (marginFilter === 'Low' && entry.item.margin < 0.15)
        || (marginFilter === 'Mid' && entry.item.margin >= 0.15 && entry.item.margin < 0.25)
        || (marginFilter === 'High' && entry.item.margin >= 0.25);

      const quoteCurrency = entry.quote.quotedCurrency || 'USD';
      const currencyMatch = currencyFilter === 'All' || quoteCurrency === currencyFilter;

      return searchMatch && marginMatch && currencyMatch;
    });
  }, [flattenedItems, search, marginFilter, currencyFilter]);

  const quoteStats = useMemo(() => {
    const totalAmount = filteredItems.reduce((sum, entry) => {
      const lineTotal = entry.item.salesPrice * entry.item.moq;
      return sum + (entry.quote.quotedCurrency === 'RMB' ? lineTotal / (entry.quote.exchangeRate || 7.1) : lineTotal);
    }, 0);
    const lowMarginCount = filteredItems.filter(entry => entry.item.margin < 0.15).length;
    const highMarginCount = filteredItems.filter(entry => entry.item.margin >= 0.25).length;
    const uniqueCustomers = new Set(filteredItems.map(entry => entry.quote.customer)).size;
    return {
      totalAmount,
      lowMarginCount,
      highMarginCount,
      uniqueCustomers,
    };
  }, [filteredItems]);

  // 重置搜索时的页码
  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, marginFilter, currencyFilter]);

  const totalPages = Math.ceil(filteredItems.length / pageSize);
  
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const pageQuoteStats = useMemo(() => {
    const pageAmount = paginatedItems.reduce((sum, entry) => sum + (entry.item.salesPrice * entry.item.moq), 0);
    const pageLowMargin = paginatedItems.filter(entry => entry.item.margin < 0.15).length;
    const crossCurrencyCount = paginatedItems.filter(entry => entry.quote.pricingMode === 'USD_TO_RMB' || entry.quote.pricingMode === 'RMB_TO_USD').length;
    return {
      pageAmount,
      pageLowMargin,
      crossCurrencyCount,
    };
  }, [paginatedItems]);

  const getMarginStyle = (m: number) => {
    if (m >= 0.25) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    if (m >= 0.15) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-rose-600 bg-rose-50 border-rose-100';
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation(); 
    if (window.confirm('警告：确定要永久删除这整笔成交记录吗？操作不可撤销。')) {
      onDelete(id);
    }
  };

  const handleDeleteItem = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('确定要删除这条报价明细吗？删除后将自动重新计算报价单总额。')) {
        if (onBatchDelete) {
            onBatchDelete([itemId]);
        }
    }
  };

  const handleImportHistory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingFile(true);
    try {
      const results = await parseHistoricalQuotesExcel(file, products);
      onImport(results);
      setIsImporting(false);
      alert(`成功导入 ${results.length} 条历史成交记录`);
    } catch (err) {
      alert("导入失败，请检查 Excel 格式");
    } finally {
      setImportingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpToPage);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p);
      setJumpToPage('');
    }
  };

  // Selection Logic
   const toggleSelection = (itemId: string) => {
     const newSet = new Set(selectedIds);
     if (newSet.has(itemId)) {
       newSet.delete(itemId);
     } else {
       newSet.add(itemId);
     }
     setSelectedIds(newSet);
   };
 
   const toggleSelectAll = () => {
      const allOnPageSelected = paginatedItems.length > 0 && paginatedItems.every(entry => selectedIds.has(entry.item.id));
      
      const newSet = new Set(selectedIds);
      if (allOnPageSelected) {
        paginatedItems.forEach(entry => newSet.delete(entry.item.id));
      } else {
        paginatedItems.forEach(entry => newSet.add(entry.item.id));
      }
      setSelectedIds(newSet);
    };
 
   const handleMergeExport = (type: 'pdf' | 'excel') => {
     // Filter entries based on selected item IDs
     const selectedEntries = flattenedItems.filter(entry => selectedIds.has(entry.item.id));
     
     if (selectedEntries.length === 0) return;
 
     // Validation: Check if customers match
     const firstCustomer = selectedEntries[0].quote.customer;
     const isSameCustomer = selectedEntries.every(entry => entry.quote.customer === firstCustomer);
     
     if (!isSameCustomer) {
       if (!window.confirm(`选中的报价明细属于不同的客户 (例如: ${firstCustomer} vs ${selectedEntries.find(entry => entry.quote.customer !== firstCustomer)?.quote.customer})。\n\n确定要合并吗？合并后将使用 "${firstCustomer}" 作为客户名称。`)) {
         return;
       }
     }
 
     // Merge logic: Extract items and reconstruct a quote
     const mergedItems = selectedEntries.map(entry => entry.item);
     
     // Recalculate totals for the merged quote
     const mergedTotalAmount = mergedItems.reduce((sum, item) => sum + Math.round(item.salesPrice) * item.moq, 0);
     const mergedTotalProfit = mergedItems.reduce((sum, item) => sum + (item.profit * item.moq), 0);
     
     // Use the first quote's metadata as base
     const baseQuote = selectedEntries[0].quote;

     const mergedQuote: Quote = {
       ...baseQuote,
       id: `MERGED-${new Date().getTime()}`, // Temporary ID
       items: mergedItems,
       totalAmount: mergedTotalAmount,
       totalProfit: mergedTotalProfit,
       avgMargin: mergedTotalAmount > 0 ? mergedTotalProfit / mergedTotalAmount : 0,
       // Preserve other metadata from the first quote
       date: new Date().toLocaleDateString(), // Use current date for new merged quote? Or keep original? Usually new date.
     };
 
     if (type === 'pdf') {
         generatePDF(mergedQuote, "/assets/logo.png");
     } else {
         exportKebosQuotationXlsx(mergedQuote, "/assets/logo.png");
     }
   };

   const handleGenerateDocs = async (docType: 'packing-list' | 'sales-order-pdf' | 'sales-order-excel') => {
     // Filter entries based on selected item IDs
     const selectedEntries = flattenedItems.filter(entry => selectedIds.has(entry.item.id));
     
     if (selectedEntries.length === 0) return;
 
     // Validation: Check if customers match
     const firstCustomer = selectedEntries[0].quote.customer;
     const isSameCustomer = selectedEntries.every(entry => entry.quote.customer === firstCustomer);
     
     if (!isSameCustomer) {
       alert(`所选条目属于不同的客户，无法生成同一份${docType === 'packing-list' ? '装箱单' : '销售订单'}。请先筛选客户。`);
       return;
     }
 
     // Merge items
     const mergedItems = selectedEntries.map(entry => entry.item);
     
     // Recalculate totals
     const mergedTotalAmount = mergedItems.reduce((sum, item) => sum + Math.round(item.salesPrice) * item.moq, 0);
     const mergedTotalProfit = mergedItems.reduce((sum, item) => sum + (item.profit * item.moq), 0);
     
     // Base metadata
     const baseQuote = selectedEntries[0].quote;
 
     if (docType === 'packing-list') {
         const mergedQuote: Quote = {
             ...baseQuote,
             id: `PL-${new Date().getTime()}`,
             items: mergedItems,
             totalAmount: mergedTotalAmount,
             totalProfit: mergedTotalProfit,
             avgMargin: mergedTotalAmount > 0 ? mergedTotalProfit / mergedTotalAmount : 0,
             date: new Date().toLocaleDateString(),
         };
         await generatePackingListXlsx(mergedQuote, products);
     } else if (docType === 'sales-order-pdf' || docType === 'sales-order-excel') {
         // Find customer info
         const customerInfo = customers.find(c => 
             c.companyName === firstCustomer || 
             c.companyNameLocal === firstCustomer
         );
 
         const order: SalesOrder = {
             id: `SO-${new Date().getTime().toString().slice(-6)}`,
             customer: firstCustomer,
             customerInfo: customerInfo ? {
                 companyName: customerInfo.companyName,
                 address: customerInfo.address,
                 contactPerson: customerInfo.contactPerson,
                 phone: customerInfo.phone,
                 email: customerInfo.email
             } : undefined,
             items: mergedItems.map(item => ({
                 id: item.id,
                 productId: item.productId,
                 kebosModel: item.kebosModel,
                 description: item.description,
                 itemType: 'Normal',
                 category: 'UPS', 
                 quantity: item.moq,
                 unitPrice: item.salesPrice,
                 total: item.salesPrice * item.moq,
             })),
             currency: baseQuote.quotedCurrency,
             exchangeRate: baseQuote.exchangeRate,
             totalAmount: mergedTotalAmount,
             totalProfit: mergedTotalProfit,
             paidAmount: 0,
             status: 'Pending',
             paymentStatus: 'Unpaid',
             paymentTerms: '30% Deposit, 70% Before Shipment',
             deliveryDate: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
             createdAt: new Date().toISOString(),
             updatedAt: new Date().toISOString()
         };
 
         if (docType === 'sales-order-pdf') {
             await generateOrderPDF(order, "/assets/logo.png");
         } else {
             await exportSalesOrderXlsx(order, "/assets/logo.png");
         }
     }
   };

  return (
    <div className="space-y-6">
      <section className="erp-panel rounded-[2rem] px-5 py-6 md:px-8 md:py-7 space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0f5f5b]/10 text-[#0f5f5b] text-[11px] font-black uppercase tracking-[0.24em]">
              <Clipboard size={14} />
              Quote Ledger Workspace
            </div>
            <div>
              <h1 className="erp-title text-3xl font-black text-slate-900 tracking-tight">业务报价明细台账</h1>
              <p className="text-sm text-slate-500 max-w-3xl mt-2">报价页真正高频操作的对象不是“整单”，而是单据里的具体型号明细。这个台账要支持按客户、型号、毛利区间和币种快速查到问题明细并批量输出。</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                title="搜索报价明细"
                placeholder="搜索客户、型号、报价单号" 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                className="pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[1.2rem] outline-none w-full text-sm font-bold shadow-sm focus:border-[#0f5f5b]" 
              />
            </div>
            <button 
              onClick={() => setIsImporting(true)} 
              className="px-5 py-4 bg-emerald-600 text-white rounded-[1.2rem] flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
            >
              <Upload size={18} />
              <span className="text-sm font-black">导入历史</span>
            </button>
            <button 
              onClick={() => exportAllQuotesSummaryXlsx(quotes)} 
              className="px-5 py-4 bg-slate-900 text-white rounded-[1.2rem] flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
            >
              <Download size={18} />
              <span className="text-sm font-black">导出台账</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">筛选明细</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{filteredItems.length}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">当前筛选下的报价行数</div>
          </div>
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">低毛利条目</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{quoteStats.lowMarginCount}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">毛利率低于 15%</div>
          </div>
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">高毛利条目</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{quoteStats.highMarginCount}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">毛利率大于等于 25%</div>
          </div>
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">折算总额</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{formatCurrency(quoteStats.totalAmount, 'USD')}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">统一折算为 USD 口径</div>
          </div>
        </div>

        <div className="rounded-[1.6rem] bg-white/75 border border-slate-200 px-4 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'All', label: '全部毛利' },
              { key: 'Low', label: '低毛利' },
              { key: 'Mid', label: '中毛利' },
              { key: 'High', label: '高毛利' },
            ].map(filter => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setMarginFilter(filter.key as 'All' | 'Low' | 'Mid' | 'High')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${marginFilter === filter.key ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-white'}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {['All', 'USD', 'RMB'].map(currency => (
              <button
                key={currency}
                type="button"
                onClick={() => setCurrencyFilter(currency as 'All' | 'USD' | 'RMB')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${currencyFilter === currency ? 'bg-[#0f5f5b] text-white' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-white'}`}
              >
                币种 {currency === 'All' ? '全部' : currency}
              </button>
            ))}
            <div className="text-xs font-bold text-slate-500 ml-2">客户覆盖 {quoteStats.uniqueCustomers} 家</div>
          </div>
        </div>
      </section>

      {selectedIds.size > 0 && (
          <div className="bg-blue-50/80 border border-blue-100 rounded-[1.6rem] px-6 py-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2 shadow-sm">
             <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                     <div className="bg-blue-600 text-white w-6 h-6 rounded-lg text-[11px] font-black flex items-center justify-center shadow-lg shadow-blue-500/30">
                         {selectedIds.size}
                     </div>
                     <span className="text-sm font-bold text-slate-700">项已选择</span>
                 </div>
                 <div className="h-4 w-px bg-blue-200"></div>
                 <button onClick={() => setSelectedIds(new Set())} className="text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors">
                     取消选择
                 </button>
             </div>
             
             <div className="flex items-center gap-3">
                 <button onClick={() => handleMergeExport('excel')} className="px-4 py-2 bg-white border border-blue-100 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 rounded-xl transition-all shadow-sm flex items-center gap-2 text-xs font-bold">
                     <FileSpreadsheet size={16} /> 
                     <span>合并导出报价单 Excel</span>
                 </button>
                 
                 <button onClick={() => handleMergeExport('pdf')} className="px-4 py-2 bg-white border border-blue-100 text-slate-600 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all shadow-sm flex items-center gap-2 text-xs font-bold">
                     <Printer size={16} /> 
                     <span>合并导出报价单 PDF</span>
                 </button>

                 <div className="h-4 w-px bg-blue-200 mx-1"></div>

                 <button onClick={() => handleGenerateDocs('packing-list')} className="px-4 py-2 bg-white border border-blue-100 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 rounded-xl transition-all shadow-sm flex items-center gap-2 text-xs font-bold">
                     <Package size={16} /> 
                     <span>合并导出装箱单 Excel</span>
                 </button>

                 <button onClick={() => handleGenerateDocs('sales-order-excel')} className="px-4 py-2 bg-white border border-blue-100 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 rounded-xl transition-all shadow-sm flex items-center gap-2 text-xs font-bold">
                     <FileSpreadsheet size={16} /> 
                     <span>合并导出销售单 Excel</span>
                 </button>

                 <button onClick={() => handleGenerateDocs('sales-order-pdf')} className="px-4 py-2 bg-white border border-blue-100 text-slate-600 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all shadow-sm flex items-center gap-2 text-xs font-bold">
                     <ShoppingCart size={16} /> 
                     <span>合并导出销售单 PDF</span>
                 </button>
                 
                 <div className="h-4 w-px bg-blue-200 mx-1"></div>
                 
                 <button 
                     onClick={() => {
                         if (onBatchDelete) {
                             onBatchDelete(Array.from(selectedIds));
                             setSelectedIds(new Set());
                         }
                     }} 
                     className="px-4 py-2 bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-100 hover:border-rose-200 rounded-xl transition-all shadow-sm flex items-center gap-2 text-xs font-bold"
                 >
                     <Trash2 size={16} /> 
                     <span>批量删除</span>
                 </button>
             </div>
          </div>
      )}

      <div className="rounded-[1.6rem] bg-slate-50/90 border border-slate-200 px-4 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="text-xs font-bold text-slate-500">筛选上下文: 毛利 {marginFilter} · 币种 {currencyFilter} · 关键词 {search || '未输入'} </div>
        <div className="text-xs font-bold text-slate-500">分页: 第 {currentPage} / {Math.max(totalPages, 1)} 页</div>
      </div>

      <div className="rounded-[1.6rem] bg-white border border-slate-200 px-4 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap gap-3 text-xs font-bold">
          <span className="px-3 py-2 rounded-xl bg-slate-50 text-slate-600 border border-slate-200">当前页金额 {formatCurrency(pageQuoteStats.pageAmount, currencyFilter === 'All' ? 'USD' : currencyFilter)}</span>
          <span className={`px-3 py-2 rounded-xl border ${pageQuoteStats.pageLowMargin > 0 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>低毛利 {pageQuoteStats.pageLowMargin}</span>
          <span className={`px-3 py-2 rounded-xl border ${pageQuoteStats.crossCurrencyCount > 0 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>跨币种 {pageQuoteStats.crossCurrencyCount}</span>
        </div>
        <div className="text-xs font-bold text-slate-500">当前页更适合处理批量预览、合并导出和问题明细核查。</div>
      </div>

      <div className="hidden lg:block bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden mb-6">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse min-w-[1300px]">
            <thead className="bg-[#f5f7f7] border-b border-slate-100 sticky top-0 z-10">
              <tr>
                <th className="pl-6 py-6 w-14">
                    <button 
                      title="全选当前页"
                      aria-label="全选当前页"
                      onClick={toggleSelectAll} 
                      className="group flex items-center justify-center w-full"
                    >
                      <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${
                        selectedIds.size > 0 && paginatedItems.every(entry => selectedIds.has(entry.item.id))
                          ? 'bg-blue-600 border-blue-600 shadow-md shadow-blue-200 scale-100' 
                          : 'bg-white border-slate-300 group-hover:border-blue-400 scale-95'
                      }`}>
                        {selectedIds.size > 0 && paginatedItems.every(entry => selectedIds.has(entry.item.id)) && (
                          <Check size={12} className="text-white" strokeWidth={4} />
                        )}
                      </div>
                    </button>
                </th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest">报价单号</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest">日期</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest">客户名称</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest">产品型号</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-right">原币成本</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-right">单位成本</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-right">单价</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-center">毛利率</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-center">数量</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-right">总报价额</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-right">管理</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedItems.length > 0 ? paginatedItems.map((entry, idx) => {
                const { quote, item } = entry;
                // 计算报价时的换算后成本 = 成交价 - 利润
                const unitCost = item.salesPrice - item.profit;
                const sourceCurrency = quote.pricingMode?.startsWith('RMB') ? 'RMB' : 'USD';
                const isCrossCurrency = quote.pricingMode === 'USD_TO_RMB' || quote.pricingMode === 'RMB_TO_USD';
                
                return (
                  <tr key={`${quote.id}-${item.id}`} onClick={() => onPreview(quote, item)} className={`hover:bg-slate-50/50 transition-colors cursor-pointer group ${selectedIds.has(item.id) ? 'bg-blue-50/30' : ''}`}>
                    <td className="pl-6 py-5" onClick={(e) => e.stopPropagation()}>
                        <button 
                          title="选择当前明细"
                          aria-label="选择当前明细"
                          onClick={() => toggleSelection(item.id)} 
                          className="group flex items-center justify-center w-full"
                        >
                           <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${
                             selectedIds.has(item.id) 
                               ? 'bg-blue-600 border-blue-600 shadow-md shadow-blue-200 scale-100' 
                               : 'bg-white border-slate-200 group-hover:border-blue-400 scale-95'
                           }`}>
                             {selectedIds.has(item.id) && (
                               <Check size={12} className="text-white" strokeWidth={4} />
                             )}
                           </div>
                        </button>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 uppercase">{quote.id}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-slate-500 font-bold">{quote.date}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="font-black text-slate-900 text-sm tracking-tight">{quote.customer}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1">
                        <span className="font-bold text-slate-700">{item.kebosModel}</span>
                        <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
                          <span className="px-2 py-1 rounded-lg bg-slate-50 text-slate-500 border border-slate-200">{quote.pricingMode}</span>
                          {isCrossCurrency && <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">跨币种</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right font-bold text-slate-500 tabular-nums">
                   {formatCurrency(item.purchasePrice || 0, sourceCurrency)}
                </td>
                <td className="px-6 py-5 text-right font-bold text-slate-400 tabular-nums">
                  <div className="flex flex-col items-end">
                    <span>{formatCurrency(unitCost, quote.quotedCurrency)}</span>
                  </div>
                </td>
                    <td className="px-6 py-5 text-right font-black text-blue-600 text-sm tabular-nums">
                      {formatCurrency(item.salesPrice, quote.quotedCurrency)}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black border transition-colors ${getMarginStyle(item.margin)}`}>
                        {formatPercent(item.margin)}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center font-black text-slate-900">
                      {item.moq} PCS
                    </td>
                    <td className="px-6 py-5 text-right font-black text-slate-900 text-sm tabular-nums">
                      <div className="space-y-1">
                        <div>{formatCurrency(item.salesPrice * item.moq, quote.quotedCurrency)}</div>
                        <div className="text-[10px] font-bold text-slate-400">利润 {formatCurrency(item.profit * item.moq, quote.quotedCurrency)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2">
                         <button onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(quote); }} className="p-2 bg-white border border-slate-100 text-amber-500 hover:text-amber-600 hover:border-amber-200 rounded-xl transition-all shadow-sm" title="编辑报价"><Edit2 size={16}/></button>
                         <button onClick={(e) => { e.stopPropagation(); onCreateOrder(quote); }} className="p-2 bg-white border border-slate-100 text-emerald-500 hover:text-emerald-600 hover:border-emerald-200 rounded-xl transition-all shadow-sm" title="转为销售订单"><ShoppingCart size={16}/></button>
                         <button onClick={(e) => { e.stopPropagation(); generatePackingListXlsx(quote, products); }} className="p-2 bg-white border border-slate-100 text-indigo-400 hover:text-indigo-600 hover:border-indigo-200 rounded-xl transition-all shadow-sm" title="导出装箱单"><Clipboard size={16}/></button>
                         <button onClick={(e) => { e.stopPropagation(); onPreview(quote, item); }} title="预览报价" aria-label="预览报价" className="p-2 bg-white border border-slate-100 text-blue-400 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-all shadow-sm"><Eye size={16}/></button>
                         <button onClick={(e) => handleDeleteItem(e, item.id)} className="p-2 bg-white border border-slate-100 text-rose-300 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all shadow-sm" title="删除此明细"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={10} className="py-24 text-center text-slate-400 italic font-medium">未发现匹配的记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile List View */}
      <div className="lg:hidden space-y-4 mb-6">
        {paginatedItems.length > 0 ? paginatedItems.map((entry, idx) => {
           const { quote, item } = entry;
           const unitCost = item.salesPrice - item.profit;
           const sourceCurrency = quote.pricingMode?.startsWith('RMB') ? 'RMB' : 'USD';
           const isCrossCurrency = quote.pricingMode === 'USD_TO_RMB' || quote.pricingMode === 'RMB_TO_USD';

           return (
             <div key={`${quote.id}-${item.id}`} onClick={() => onPreview(quote, item)} className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm active:scale-95 transition-all">
                <div className="flex justify-between items-start mb-3">
                   <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 uppercase">{quote.id}</span>
                      <span className="text-xs text-slate-400 font-bold">{quote.date}</span>
                   </div>
                   <div className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${getMarginStyle(item.margin)}`}>
                      {formatPercent(item.margin)}
                   </div>
                </div>
                
                <div className="mb-3">
                   <h4 className="font-black text-slate-900 text-base mb-1">{quote.customer}</h4>
                   <div className="flex items-center gap-2 text-slate-600 text-xs font-bold">
                      <Package size={12}/> {item.kebosModel}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl mb-3">
                   <div className="text-left">
                      <div className="text-[10px] text-slate-400 font-black uppercase">原币成本</div>
                      <div className="text-[10px] font-black text-slate-600">{formatCurrency(item.purchasePrice || 0, sourceCurrency)}</div>
                   </div>
                   <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-black uppercase">单位成本</div>
                      <div className="text-[10px] font-black text-slate-600">{formatCurrency(unitCost, quote.quotedCurrency)}</div>
                   </div>
                   <div className="text-left">
                      <div className="text-[10px] text-slate-400 font-black uppercase">单价</div>
                      <div className="text-sm font-black text-blue-600">{formatCurrency(item.salesPrice, quote.quotedCurrency)}</div>
                   </div>
                   <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-black uppercase">总额 ({item.moq} PCS)</div>
                      <div className="text-sm font-black text-slate-900">{formatCurrency(item.salesPrice * item.moq, quote.quotedCurrency)}</div>
                   </div>
                </div>

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-50">
                   <button onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(quote); }} className="p-2 bg-slate-100 text-amber-500 rounded-xl" title="编辑报价"><Edit2 size={16}/></button>
                   <button onClick={(e) => { e.stopPropagation(); onCreateOrder(quote); }} className="p-2 bg-slate-100 text-emerald-500 rounded-xl" title="转为销售订单"><ShoppingCart size={16}/></button>
                   <button onClick={(e) => { e.stopPropagation(); generatePackingListXlsx(quote, products); }} title="导出装箱单" aria-label="导出装箱单" className="p-2 bg-slate-100 text-indigo-400 rounded-xl"><Clipboard size={16}/></button>
                   <button onClick={(e) => { e.stopPropagation(); onPreview(quote, item); }} title="预览报价" aria-label="预览报价" className="p-2 bg-slate-100 text-blue-400 rounded-xl"><Eye size={16}/></button>
                   <button onClick={(e) => handleDeleteItem(e, item.id)} title="删除明细" aria-label="删除明细" className="p-2 bg-rose-50 text-rose-400 rounded-xl"><Trash2 size={16}/></button>
                </div>
             </div>
           );
        }) : (
           <div className="py-20 text-center text-slate-400 italic">未发现匹配的记录</div>
        )}
      </div>

      {/* 分页条 Pagination Bar (Desktop) */}
      {filteredItems.length > 0 && (
        <div className="hidden lg:flex items-center justify-between bg-white px-8 py-5 rounded-[2.5rem] border border-slate-200 shadow-sm mb-20 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-6">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
              正在显示 <span className="text-slate-900">{(currentPage-1)*pageSize + 1}-{Math.min(currentPage*pageSize, filteredItems.length)}</span> / <span className="text-slate-900">{filteredItems.length}</span> 条记录
            </p>
            <div className="h-4 w-px bg-slate-100" />
            <div className="flex items-center gap-3">
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
              <button 
                title="跳到首页"
                aria-label="跳到首页"
                onClick={() => setCurrentPage(1)} 
                disabled={currentPage === 1}
                className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-all rounded-xl hover:bg-white"
              >
                <ChevronsLeft size={16}/>
              </button>
              <button 
                title="上一页"
                aria-label="上一页"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                disabled={currentPage === 1}
                className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-all rounded-xl hover:bg-white"
              >
                <ChevronLeft size={16}/>
              </button>
              
              <div className="flex items-center gap-1 px-3">
                <span className="text-xs font-black text-slate-900">{currentPage}</span>
                <span className="text-[10px] font-black text-slate-300">/</span>
                <span className="text-xs font-black text-slate-400">{totalPages}</span>
              </div>

              <button 
                title="下一页"
                aria-label="下一页"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                disabled={currentPage === totalPages}
                className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-all rounded-xl hover:bg-white"
              >
                <ChevronRight size={16}/>
              </button>
              <button 
                title="跳到末页"
                aria-label="跳到末页"
                onClick={() => setCurrentPage(totalPages)} 
                disabled={currentPage === totalPages}
                className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-all rounded-xl hover:bg-white"
              >
                <ChevronsRight size={16}/>
              </button>
            </div>

            <div className="h-6 w-px bg-slate-100" />

            <form onSubmit={handleJumpToPage} className="flex items-center gap-2">
              <input 
                type="text" 
                placeholder="页码" 
                value={jumpToPage}
                onChange={e => setJumpToPage(e.target.value.replace(/\D/g, ''))}
                className="w-12 h-9 bg-slate-50 border border-slate-100 rounded-xl px-2 text-center text-xs font-black outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              <button type="submit" title="跳转到指定页码" aria-label="跳转到指定页码" className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg active:scale-90 transition-all">
                <ArrowRight size={14}/>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Pagination (Simplified) */}
      {totalPages > 1 && (
        <div className="lg:hidden flex items-center justify-center gap-4 py-6 mb-20">
          <button 
            title="上一页"
            aria-label="上一页"
            onClick={() => setCurrentPage(p => Math.max(1, p-1))} 
            disabled={currentPage === 1}
            className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-400 active:bg-slate-50 disabled:opacity-20"
          >
            <ChevronLeft size={20}/>
          </button>
          <span className="font-black text-slate-900 text-sm">{currentPage} / {totalPages}</span>
          <button 
            title="下一页"
            aria-label="下一页"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} 
            disabled={currentPage === totalPages}
            className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-400 active:bg-slate-50 disabled:opacity-20"
          >
            <ChevronRight size={20}/>
          </button>
        </div>
      )}

      {isImporting && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-8 space-y-6 text-center animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full inline-block mb-2">
              <FileSpreadsheet size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900">历史记录批量导入</h2>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              支持将外部 Excel 历史记录批量录入系统台账。
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => generateHistoricalTemplateXlsx()} 
                className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[11px] flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
              >
                <Download size={14}/> 下载标准模板
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="py-4 bg-emerald-600 text-white rounded-2xl font-black text-[11px] flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 active:scale-95 transition-all"
              >
                {importingFile ? <RefreshCw className="animate-spin" size={14}/> : <Upload size={14}/>}
                上传文件开始同步
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx" title="选择历史报价导入文件" className="hidden" onChange={handleImportHistory} />
            <button onClick={() => setIsImporting(false)} className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-4">放弃并返回</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuoteList;

