
import React, { useState, useMemo } from 'react';
import { Plus, Trash2, CheckCircle, ChevronRight, Loader2, RefreshCw, AlertTriangle, Eye, DollarSign, Percent, ArrowRight, X, Check, Minus, Search, FileText } from 'lucide-react';
import { Product, Quote, QuoteItem, PricingMode } from '../types';
import { formatCurrency, formatPercent } from '../utils';

interface QuoteFormProps {
  products: Product[];
  quotes: Quote[];
  initialQuote?: Quote; // Added for edit mode
  onSave: (quote: Quote) => void;
  onCancel: () => void;
  onPreview: (quote: Quote) => void;
}

// 内部毛利率调节组件，支持 0% - 99.9%
const MarginScrubber = ({ value, onChange, realCost, quotedCurrency }: { value: number, onChange: (val: number) => void, realCost: number, quotedCurrency: string }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">毛利率控制 (0% - 100%)</label>
        <div className="flex items-center gap-2">
           <div className={`text-xs font-bold tabular-nums px-2 py-1 rounded-lg border ${value < 15 ? 'text-rose-600 bg-rose-50 border-rose-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>
             {value.toFixed(1)}%
           </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <button 
          onClick={() => onChange(Math.max(0, Math.round((value - 0.1) * 10) / 10))}
          title="降低毛利率"
          aria-label="降低毛利率"
          className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 active:scale-90 transition-all hover:bg-slate-200"
        >
          <Minus size={16} strokeWidth={2.5} />
        </button>

        <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-inner">
          <input
            type="range"
            min="0"
            max="99.9"
            step="0.1"
            value={value}
            title="毛利率控制"
            aria-label="毛利率控制"
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="w-full accent-emerald-600"
          />
          <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>成本 {quotedCurrency === 'USD' ? '$' : '¥'}{realCost.toFixed(2)}</span>
            <span>建议区间 15% - 35%</span>
            <span>上限 99.9%</span>
          </div>
        </div>

        <button 
          onClick={() => onChange(Math.min(99.9, Math.round((value + 0.1) * 10) / 10))}
          title="提高毛利率"
          aria-label="提高毛利率"
          className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 active:scale-90 transition-all hover:bg-slate-200"
        >
          <Plus size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};

const QuoteForm: React.FC<QuoteFormProps> = ({ products, quotes, initialQuote, onSave, onCancel, onPreview }) => {
  const roundTo2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState(initialQuote?.customer || '');
  const [pricingMode, setPricingMode] = useState<PricingMode>(initialQuote?.pricingMode || 'USD_TO_USD');
  const [exchangeRate, setExchangeRate] = useState(initialQuote?.exchangeRate || 7.1);
  const [items, setItems] = useState<QuoteItem[]>(initialQuote?.items?.map(i => ({...i})) || []);
  const [targetMargin, setTargetMargin] = useState(25);
  const [isSaving, setIsSaving] = useState(false);
  const [modelSearch, setModelSearch] = useState('');

  const quotedCurrency = (pricingMode === 'USD_TO_RMB' || pricingMode === 'RMB_TO_RMB') ? 'RMB' : 'USD';

  const calculateBaseAndPrice = (product: Product, marginPercent: number) => {
    const years = Object.keys(product.yearlyCosts).map(Number).sort((a,b)=>b-a);
    const costData = product.yearlyCosts[years[0]] || { usd: 0, rmb: 0 };
    
    let baseCostInQuotedCurrency = 0;
    let purchasePriceSource = 0;

    switch (pricingMode) {
      case 'USD_TO_USD':
        purchasePriceSource = costData.usd;
        baseCostInQuotedCurrency = costData.usd;
        break;
      case 'RMB_TO_RMB':
        purchasePriceSource = costData.rmb;
        baseCostInQuotedCurrency = costData.rmb;
        break;
      case 'RMB_TO_USD':
        purchasePriceSource = costData.rmb;
        baseCostInQuotedCurrency = (costData.rmb / exchangeRate / 1.13);
        break;
      case 'USD_TO_RMB':
        purchasePriceSource = costData.usd;
        baseCostInQuotedCurrency = (costData.usd * exchangeRate * 1.13);
        break;
    }

    const factor = 1 - (marginPercent / 100);
    const salesPrice = factor > 0.001 ? baseCostInQuotedCurrency / factor : baseCostInQuotedCurrency * 1000;
    return { 
      salesPrice: roundTo2(salesPrice), 
      purchasePriceSource,
      realCost: baseCostInQuotedCurrency
    };
  };

  const handleToggleItem = (productId: string) => {
    const existingIndex = items.findIndex(it => it.productId === productId);
    if (existingIndex !== -1) {
      setItems(items.filter((_, idx) => idx !== existingIndex));
    } else {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      const { salesPrice, purchasePriceSource, realCost } = calculateBaseAndPrice(product, targetMargin);
      const newItem: QuoteItem = {
        id: `ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        productId: product.id,
        kebosModel: product.kebosModel,
        description: product.description,
        batteryInfo: product.batteryInfo,
        purchasePrice: purchasePriceSource,
        salesPrice,
        moq: product.moq || 1,
        standardMoq: product.moq,
        isSample: false,
        profit: salesPrice - realCost,
        margin: targetMargin / 100
      };
      setItems([...items, newItem]);
    }
  };

  const totals = useMemo(() => {
    const totalAmount = items.reduce((sum, item) => sum + item.salesPrice * item.moq, 0);
    const totalProfit = items.reduce((sum, item) => sum + (item.profit * item.moq), 0);
    const weightedMargin = totalAmount > 0 ? totalProfit / totalAmount : 0;
    return {
      totalAmount: roundTo2(totalAmount),
      totalProfit: roundTo2(totalProfit),
      weightedMargin
    };
  }, [items]);

  const quoteKpis = useMemo(() => {
    const totalQuantity = items.reduce((sum, item) => sum + item.moq, 0);
    return {
      totalQuantity,
      selectedModels: items.length,
      quotedCurrency: quotedCurrency as 'USD' | 'RMB',
    };
  }, [items, quotedCurrency]);

  const quoteInsights = useMemo(() => {
    const lowMarginCount = items.filter(item => item.margin < 0.15).length;
    const highMarginCount = items.filter(item => item.margin >= 0.25).length;
    const totalCost = items.reduce((sum, item) => sum + (item.salesPrice - item.profit) * item.moq, 0);
    return {
      lowMarginCount,
      highMarginCount,
      totalCost: roundTo2(totalCost),
    };
  }, [items]);

  const quoteAudit = useMemo(() => {
    const zeroPriceCount = items.filter(item => item.salesPrice <= 0).length;
    const sampleCount = items.filter(item => item.isSample).length;
    const lowQuantityCount = items.filter(item => item.moq <= 1).length;
    const averageUnitPrice = items.length > 0 ? roundTo2(items.reduce((sum, item) => sum + item.salesPrice, 0) / items.length) : 0;

    return {
      zeroPriceCount,
      sampleCount,
      lowQuantityCount,
      averageUnitPrice,
    };
  }, [items]);

  // ERP 风格专业编号：KB + YYYYMMDD + 3位流水 (如 KB20240520001)
  const currentStandardId = useMemo(() => {
    if (initialQuote?.id) return initialQuote.id;

    const now = new Date();
    const dateStr = now.getFullYear().toString() + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0');
    const prefix = `KB${dateStr}`;
    const todayQuotes = quotes.filter(q => q.id && q.id.startsWith(prefix));
    let serial = 1;
    if (todayQuotes.length > 0) {
      const serials = todayQuotes.map(q => {
        const sPart = q.id.replace(prefix, '');
        return parseInt(sPart) || 0;
      });
      serial = Math.max(...serials) + 1;
    }
    return `${prefix}${serial.toString().padStart(3, '0')}`;
  }, [quotes, step, initialQuote]);

  const filteredModels = useMemo(() => {
    if (!modelSearch) return products;
    const term = modelSearch.toLowerCase();
    return products.filter(p => p.kebosModel.toLowerCase().includes(term));
  }, [products, modelSearch]);

  const updateByPrice = (id: string, newPrice: number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      const product = products.find(p => p.id === item.productId);
      if (!product) return item;
      const { realCost } = calculateBaseAndPrice(product, 0); 
      const roundedPrice = roundTo2(newPrice);
      const profit = roundTo2(roundedPrice - realCost);
      const margin = roundedPrice > 0 ? Math.min(0.999, profit / roundedPrice) : 0;
      return { ...item, salesPrice: roundedPrice, profit, margin };
    }));
  };

  const handleScrubberChange = (id: string, marginPercent: number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      const product = products.find(p => p.id === item.productId);
      if (!product) return item;
      const { realCost } = calculateBaseAndPrice(product, 0);
      const factor = 1 - (marginPercent / 100);
      const newPrice = roundTo2(factor > 0.001 ? realCost / factor : realCost * 1000);
      return { 
        ...item, 
        salesPrice: newPrice, 
        profit: roundTo2(newPrice - realCost), 
        margin: marginPercent / 100 
      };
    }));
  };

  const applyTargetMarginToAll = () => {
    setItems(items.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return item;
      const { realCost } = calculateBaseAndPrice(product, 0);
      const factor = 1 - (targetMargin / 100);
      const salesPrice = roundTo2(factor > 0.001 ? realCost / factor : realCost * 1000);
      return {
        ...item,
        salesPrice,
        profit: roundTo2(salesPrice - realCost),
        margin: targetMargin / 100,
      };
    }));
  };

  const assembleQuote = (): Quote => ({
    id: currentStandardId,
    date: initialQuote?.date || new Date().toLocaleDateString(),
    customer,
    items: items.map(item => ({...item})), // Ensure items are deep copied or at least new references
    quotedCurrency,
    pricingMode,
    exchangeRate,
    totalAmount: totals.totalAmount,
    totalProfit: totals.totalProfit,
    avgMargin: totals.weightedMargin
  });

  return (
    <div className="max-w-full pb-20 px-4 lg:px-8">
      <section className="erp-panel rounded-[2rem] px-5 py-6 md:px-8 md:py-7 mb-6 space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#c67c2f]/10 text-[#9a5e1f] text-[11px] font-black uppercase tracking-[0.24em]">
              <FileText size={14} />
              Quotation Control Center
            </div>
            <div>
              <h1 className="erp-title text-3xl font-black text-slate-900 tracking-tight">{initialQuote ? '报价修订中心' : '报价编制中心'}</h1>
              <p className="text-sm text-slate-500 max-w-3xl mt-2">围绕客户、计价模式、数量、利润率和报价总额完成一笔标准业务报价。页面布局优先服务录入效率和核算判断，而不是装饰感。</p>
            </div>
          </div>
          <div className="erp-kpi-card rounded-[1.6rem] px-5 py-4 min-w-[260px]">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">报价编号</div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-900">{currentStandardId}</div>
            <div className="mt-2 text-[11px] font-bold text-slate-500">{customer ? `客户: ${customer}` : '等待录入客户名称'}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">选中型号</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{quoteKpis.selectedModels}</div>
          </div>
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">总数量</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{quoteKpis.totalQuantity}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">PCS</div>
          </div>
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">报价总额</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{formatCurrency(totals.totalAmount, quoteKpis.quotedCurrency)}</div>
          </div>
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">加权毛利率</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{formatPercent(totals.weightedMargin)}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">计价模式: {pricingMode}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { id: 1, title: '客户与计价', hint: '先锁定客户和成本换算方式' },
            { id: 2, title: '型号与数量', hint: '建立报价的产品结构' },
            { id: 3, title: '利润与存档', hint: '核算毛利后确认输出单据' },
          ].map(stage => (
            <button
              key={stage.id}
              type="button"
              onClick={() => setStep(stage.id)}
              className={`rounded-[1.5rem] border px-4 py-4 text-left transition-all ${step === stage.id ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}
            >
              <div className="flex items-center justify-between">
                <span className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-black ${step === stage.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {step > stage.id ? <Check size={16}/> : stage.id}
                </span>
                <span className={`text-[10px] font-black uppercase tracking-[0.24em] ${step === stage.id ? 'text-slate-200' : 'text-slate-400'}`}>Step {stage.id}</span>
              </div>
              <div className="mt-4 text-lg font-black tracking-tight">{stage.title}</div>
              <div className={`mt-1 text-xs font-medium ${step === stage.id ? 'text-slate-300' : 'text-slate-500'}`}>{stage.hint}</div>
            </button>
          ))}
        </div>
      </section>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden p-8 md:p-12">
        {step === 1 && (
          <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.75fr] gap-8 animate-in fade-in">
            <div className="space-y-10">
              <header>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">1. 基本信息</h2>
                <p className="text-slate-400 text-xs mt-1">设置客户名称及成本换算逻辑</p>
              </header>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">客户名称</label>
                  <input type="text" value={customer} onChange={e => setCustomer(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-slate-900 font-bold text-lg" placeholder="输入客户名称..." />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">计价模式</label>
                      <div className="grid grid-cols-1 gap-3">
                        {[
                          { id: 'USD_TO_USD', label: 'USD 成本报 USD' },
                          { id: 'RMB_TO_RMB', label: 'RMB 成本报 RMB' },
                          { id: 'RMB_TO_USD', label: 'RMB 成本报 USD' },
                          { id: 'USD_TO_RMB', label: 'USD 成本报 RMB' },
                        ].map(m => (
                          <button key={m.id} onClick={() => setPricingMode(m.id as any)} className={`p-4 rounded-2xl border-2 text-left font-black transition-all ${pricingMode === m.id ? 'border-blue-600 bg-blue-50/50 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                            <span className="text-xs">{m.label}</span>
                          </button>
                        ))}
                      </div>
                   </div>

                   <div className="space-y-3">
                      <div className="flex items-center justify-between">
                         <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">汇率设置 (USD/RMB)</label>
                         <button onClick={async () => {
                            try {
                              const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
                              const data = await res.json();
                              if(data.rates.CNY) {
                                 setExchangeRate(data.rates.CNY);
                                 alert(`已更新为实时汇率: ${data.rates.CNY}`);
                              }
                            } catch(e) {
                              alert('获取实时汇率失败，请检查网络');
                            }
                         }} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1">
                            <RefreshCw size={10} /> 获取实时汇率
                         </button>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-center gap-2">
                         <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold text-slate-400">1 USD =</span>
                            <input 
                              type="number" 
                              step="0.01" 
                              value={exchangeRate} 
                              title="汇率设置"
                              onChange={e => setExchangeRate(parseFloat(e.target.value) || 0)} 
                              className="flex-1 bg-transparent text-2xl font-black text-slate-900 outline-none border-b border-dashed border-slate-300 focus:border-blue-500 transition-colors py-1"
                            />
                            <span className="text-sm font-bold text-slate-400">RMB</span>
                         </div>
                         <p className="text-[10px] text-slate-400">默认汇率 7.1，可手动修改或获取实时数据</p>
                         <p className="text-[9px] text-slate-300">实时数据来源: api.exchangerate-api.com</p>
                      </div>
                   </div>
                </div>
              </div>
              <button onClick={() => setStep(2)} disabled={!customer} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black shadow-xl disabled:opacity-30 transition-all">下一步：挑选型号</button>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-6 self-start">
              <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50/80 p-6">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">录入摘要</div>
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">报价编号</div>
                    <div className="mt-1 text-xl font-black text-slate-900">{currentStandardId}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">目标客户</div>
                    <div className="mt-1 text-base font-black text-slate-900">{customer || '待录入'}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white border border-slate-200 px-4 py-4">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">报价币种</div>
                      <div className="mt-2 text-lg font-black text-slate-900">{quotedCurrency}</div>
                    </div>
                    <div className="rounded-2xl bg-white border border-slate-200 px-4 py-4">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">汇率</div>
                      <div className="mt-2 text-lg font-black text-slate-900">{exchangeRate.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.8rem] bg-slate-900 text-white p-6">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">操作建议</div>
                <div className="mt-4 space-y-4 text-sm">
                  <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4">
                    先确认客户名，再确认计价模式。ERP 场景里最容易出错的不是价格本身，而是币种和汇率口径。
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4">
                    如果这单最终要转销售订单，建议在这一页就把汇率、客户名和报价编号定准，减少后续二次修订。
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.75fr] gap-8 animate-in fade-in">
            <div className="space-y-8">
              <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">2. 挑选型号</h2>
                  <p className="text-slate-400 text-xs mt-1">点击即可选中，再次点击即可移除</p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                  <input 
                    type="text" 
                    placeholder="搜索型号..." 
                    value={modelSearch} 
                    onChange={e => setModelSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-slate-900 font-bold text-sm shadow-inner"
                  />
                </div>
              </header>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[640px] overflow-y-auto pr-2 no-scrollbar border-t border-slate-50 pt-4">
                {filteredModels.map(p => {
                  const isSelected = items.some(it => it.productId === p.id);
                  return (
                    <button key={p.id} onClick={() => handleToggleItem(p.id)} className={`p-5 rounded-2xl border-2 text-left flex justify-between items-center transition-all ${isSelected ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-slate-100 hover:border-slate-300'}`}>
                      <div>
                        <p className={`font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>{p.kebosModel}</p>
                        <p className={`text-[9px] font-bold uppercase tracking-wider ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>{p.series}</p>
                      </div>
                      {isSelected ? <X size={18} /> : <Plus size={18} className="text-slate-300" />}
                    </button>
                  );
                })}
                {filteredModels.length === 0 && (
                  <div className="col-span-full py-20 text-center text-slate-400 italic">未发现匹配型号</div>
                )}
              </div>
              <div className="flex gap-4">
                <button onClick={() => setStep(1)} className="px-10 py-5 border border-slate-200 rounded-2xl font-black text-slate-500 hover:bg-slate-50 transition-all">上一步</button>
                <button onClick={() => setStep(3)} disabled={items.length === 0} className="flex-1 py-5 bg-slate-900 text-white rounded-2xl font-black shadow-xl">进入核算阶段 ({items.length})</button>
              </div>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-6 self-start">
              <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50/80 p-6">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">选型摘要</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white border border-slate-200 px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">型号数</div>
                    <div className="mt-2 text-2xl font-black text-slate-900">{quoteKpis.selectedModels}</div>
                  </div>
                  <div className="rounded-2xl bg-white border border-slate-200 px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">总数量</div>
                    <div className="mt-2 text-2xl font-black text-slate-900">{quoteKpis.totalQuantity}</div>
                  </div>
                </div>
                <div className="mt-4 space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {items.length > 0 ? items.map(item => (
                    <div key={item.id} className="rounded-2xl bg-white border border-slate-200 px-4 py-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-slate-900">{item.kebosModel}</div>
                        <div className="text-[11px] font-bold text-slate-500">{item.moq} PCS · {formatCurrency(item.salesPrice, quotedCurrency)}</div>
                      </div>
                      <div className={`px-2 py-1 rounded-lg text-[10px] font-black ${item.margin < 0.15 ? 'bg-rose-50 text-rose-600' : item.margin >= 0.25 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {formatPercent(item.margin)}
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">尚未选中任何型号</div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.8fr] gap-8 animate-in fade-in">
            <div className="space-y-10">
              <header className="flex justify-between items-start border-b border-slate-50 pb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">3. 利润核算</h2>
                  <p className="text-slate-400 text-xs mt-1">使用滑块微调毛利率，售价将平滑重算</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">单号: {currentStandardId}</p>
                  <p className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(totals.totalAmount, quotedCurrency)}</p>
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/80 px-5 py-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">客户</div>
                  <div className="mt-3 text-xl font-black text-slate-900">{customer || '未填写'}</div>
                </div>
                <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/80 px-5 py-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">利润总额</div>
                  <div className="mt-3 text-xl font-black text-slate-900">{formatCurrency(totals.totalProfit, quotedCurrency)}</div>
                </div>
                <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/80 px-5 py-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">汇率快照</div>
                  <div className="mt-3 text-xl font-black text-slate-900">1 USD = {exchangeRate.toFixed(2)} RMB</div>
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50/70 p-5">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">批量毛利策略</div>
                    <div className="mt-2 text-sm text-slate-500">设定统一目标毛利后，可一键重算当前所有条目，再逐条微调特殊型号。</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 min-w-[132px]">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">目标毛利</div>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          title="目标毛利率"
                          min="0"
                          max="99.9"
                          step="0.1"
                          value={targetMargin}
                          onChange={e => setTargetMargin(parseFloat(e.target.value) || 0)}
                          className="w-20 bg-transparent text-xl font-black text-slate-900 outline-none"
                        />
                        <span className="text-sm font-black text-slate-400">%</span>
                      </div>
                    </div>
                    <button onClick={applyTargetMarginToAll} className="px-5 py-4 rounded-2xl bg-slate-900 text-white font-black shadow-lg hover:bg-slate-800 transition-colors">
                      应用到全部条目
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50/70 px-5 py-4">
                <div className="grid grid-cols-12 gap-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                  <div className="col-span-12 lg:col-span-4">型号与核算上下文</div>
                  <div className="col-span-6 lg:col-span-2">数量</div>
                  <div className="col-span-6 lg:col-span-2">单价</div>
                  <div className="col-span-12 lg:col-span-4">毛利控制</div>
                </div>
              </div>

              <div className="space-y-4">
                {items.map((item, idx) => {
                  const product = products.find(p => p.id === item.productId);
                  const { realCost } = product ? calculateBaseAndPrice(product, 0) : { realCost: 0 };
                  const lineTotal = roundTo2(item.salesPrice * item.moq);
                  const lineProfit = roundTo2(item.profit * item.moq);
                  
                  return (
                    <div key={item.id} className="border border-slate-100 rounded-[2rem] bg-white shadow-sm group transition-all hover:border-slate-200 overflow-hidden">
                      <div className="grid grid-cols-12 gap-4 p-6 items-start">
                        <div className="col-span-12 lg:col-span-4 flex items-start gap-4">
                          <span className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">{idx + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h4 className="font-black text-slate-900 text-lg leading-none">{item.kebosModel}</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                  单机成本: <span className="text-slate-600">{quotedCurrency === 'USD' ? '$' : '¥'}{realCost.toFixed(2)}</span>
                                </p>
                              </div>
                              <button onClick={() => handleToggleItem(item.productId)} title="移除当前型号" aria-label="移除当前型号" className="text-slate-300 hover:text-rose-500 transition-colors shrink-0"><Trash2 size={20}/></button>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
                              <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600">行金额 {formatCurrency(lineTotal, quotedCurrency)}</span>
                              <span className={`px-2 py-1 rounded-lg ${lineProfit < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>行利润 {formatCurrency(lineProfit, quotedCurrency)}</span>
                              <span className={`px-2 py-1 rounded-lg ${item.margin < 0.15 ? 'bg-rose-50 text-rose-600' : item.margin >= 0.25 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>毛利 {formatPercent(item.margin)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="col-span-6 lg:col-span-2 space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">订单数量 (PCS)</label>
                          <input type="number" title="订单数量" value={item.moq} onChange={e => setItems(items.map(it => it.id === item.id ? { ...it, moq: parseInt(e.target.value) || 1 } : it))} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-black outline-none focus:border-slate-900 transition-all shadow-inner" />
                        </div>

                        <div className="col-span-6 lg:col-span-2 space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">销售单价 ({quotedCurrency})</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold">{quotedCurrency === 'USD' ? '$' : '¥'}</span>
                            <input type="number" title="销售单价" step="0.01" value={item.salesPrice} onChange={e => updateByPrice(item.id, parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-3 font-black text-blue-600 outline-none focus:border-slate-900 transition-all shadow-inner" />
                          </div>
                        </div>

                        <div className="col-span-12 lg:col-span-4">
                          <MarginScrubber 
                            value={item.margin * 100} 
                            onChange={(val) => handleScrubberChange(item.id, val)}
                            realCost={realCost}
                            quotedCurrency={quotedCurrency}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-6 self-start">
              <div className="rounded-[1.8rem] bg-slate-900 text-white p-6">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">实时财务摘要</div>
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">总报价额</div>
                    <div className="mt-2 text-3xl font-black text-white">{formatCurrency(totals.totalAmount, quotedCurrency)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">总成本</div>
                      <div className="mt-2 text-lg font-black text-white">{formatCurrency(quoteInsights.totalCost, quotedCurrency)}</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">总利润</div>
                      <div className="mt-2 text-lg font-black text-white">{formatCurrency(totals.totalProfit, quotedCurrency)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">低毛利</div>
                      <div className="mt-2 text-lg font-black text-white">{quoteInsights.lowMarginCount}</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">高毛利</div>
                      <div className="mt-2 text-lg font-black text-white">{quoteInsights.highMarginCount}</div>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 text-sm text-slate-300 leading-6">
                    如果低毛利条目偏多，建议优先回看成本口径、汇率和 MOQ，再决定是否继续下发给客户。
                  </div>
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50/80 p-6">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">审查清单</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white border border-slate-200 px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">零价格</div>
                    <div className="mt-2 text-xl font-black text-slate-900">{quoteAudit.zeroPriceCount}</div>
                  </div>
                  <div className="rounded-2xl bg-white border border-slate-200 px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">样品条目</div>
                    <div className="mt-2 text-xl font-black text-slate-900">{quoteAudit.sampleCount}</div>
                  </div>
                  <div className="rounded-2xl bg-white border border-slate-200 px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">低数量</div>
                    <div className="mt-2 text-xl font-black text-slate-900">{quoteAudit.lowQuantityCount}</div>
                  </div>
                  <div className="rounded-2xl bg-white border border-slate-200 px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">平均单价</div>
                    <div className="mt-2 text-xl font-black text-slate-900">{formatCurrency(quoteAudit.averageUnitPrice, quotedCurrency)}</div>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className={`rounded-2xl px-4 py-3 ${quoteAudit.zeroPriceCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {quoteAudit.zeroPriceCount > 0 ? '存在未定价条目，建议先补齐售价后再预览或输出。' : '所有条目均已形成售价。'}
                  </div>
                  <div className={`rounded-2xl px-4 py-3 ${quoteInsights.lowMarginCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-600'}`}>
                    {quoteInsights.lowMarginCount > 0 ? '当前存在低毛利条目，建议逐条校验成本和报价口径。' : '当前毛利结构稳定，可进入预览或存档。'}
                  </div>
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50/80 p-6 space-y-3">
                <button onClick={() => setStep(2)} className="w-full px-6 py-4 border border-slate-200 rounded-2xl font-black text-slate-500 hover:bg-slate-50 transition-all">回退重选</button>
                <button onClick={() => onPreview(assembleQuote())} className="w-full py-4 border border-blue-600 rounded-2xl font-black text-blue-600 hover:bg-blue-50 transition-all">预览单据</button>
                <button onClick={async () => { 
                  try {
                    setIsSaving(true); 
                    await onSave(assembleQuote()); 
                  } catch (e) {
                    console.error("Save failed:", e);
                    alert("保存失败，请检查数据完整性");
                    setIsSaving(false);
                  }
                }} disabled={isSaving || items.length === 0} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95">
                  {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Check size={18}/>} 
                  确认存档并导出
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuoteForm;


