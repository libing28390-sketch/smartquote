
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Search, Plus, Package, Battery, Box, X, Info, Trash2, Edit2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Layers, Calendar, Copy, TrendingUp, TrendingDown, Minus, History, Weight, ExternalLink, Clock, ArrowLeft, ArrowRight, FileSpreadsheet, Download, CheckCircle, AlertCircle, RefreshCw, FileText, LayoutGrid, Zap, Activity, Cpu, Settings, FileBox, Tag, Calculator, Ruler, Scale, Upload } from 'lucide-react';
import { Product, ProductLog, ProductCost, ProductSeries } from '../types';
import { formatCurrency, formatPercent, getPriceTrend, calcRmbCost, parseProductExcel, generateProductTemplateXlsx, exportProductsToXlsx } from '../utils';

const SERIES_OPTIONS: ProductSeries[] = ['Offline', 'Line-Interactive', 'Online HF', 'Online LF', 'Inverter', 'Others'];
const CATEGORY_OPTIONS: ('UPS' | 'Spare Parts')[] = ['UPS', 'Spare Parts'];

const getSeriesIcon = (series: ProductSeries) => {
  switch (series) {
    case 'Offline': return <Zap size={14} />;
    case 'Line-Interactive': return <Activity size={14} />;
    case 'Online HF': return <Cpu size={14} />;
    case 'Online LF': return <Settings size={14} />;
    case 'Inverter': return <RefreshCw size={14} />;
    default: return <Package size={14} />;
  }
};

const highlightTechSpecs = (text: string) => {
  if (!text) return '-';
  const regex = /(\d+\s*(?:VA|W|Vac|Hz|ms|AH|V))/gi;
  const parts = text.split(regex);
  return parts.map((part, i) => 
    regex.test(part) ? <span key={i} className="text-blue-600 font-black bg-blue-50/50 px-1 rounded mx-0.5">{part}</span> : part
  );
};

interface ProductListProps {
  products: Product[];
  logs: ProductLog[];
  onBulkAdd: (newProducts: Product[]) => void;
  onUpdate: (product: Product) => void;
  onBatchImport?: (newProducts: Product[], updatedProducts: Product[]) => void;
  onAdd: (product: Product) => void;
  onDelete: (id: string) => void;
}

const ImportWizard = ({ productsInDb, onClose, onConfirm }: { productsInDb: Product[], onClose: () => void, onConfirm: (results: Product[]) => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [previewData, setPreviewData] = useState<Product[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setParsing(true);
      try {
        const results = await parseProductExcel(selected);
        if (results.length === 0) {
           alert("未识别到有效数据！\n请检查Excel文件：\n1. 是否包含'KEBOS型号'或'Model'列头\n2. 数据是否在第一个工作表");
        }
        setPreviewData(results);
      } catch (err) {
        console.error("Import Error:", err);
        alert("文件解析失败，请检查模板格式");
      } finally {
        setParsing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const getImportStatus = (model: string) => {
    // 增加 trim() 确保状态判断与 App.tsx 覆盖逻辑一致
    const exists = productsInDb.some(p => p.kebosModel.trim().toLowerCase() === model.trim().toLowerCase());
    return exists ? 'update' : 'new';
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300">
        <header className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-inner">
               <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-none">批量导入向导</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">Excel Smart Batch Processor</p>
            </div>
          </div>
          <button onClick={onClose} title="关闭导入向导" aria-label="关闭导入向导" className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X size={18}/>
          </button>
        </header>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar bg-slate-50/50">
          {previewData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-8">
              <div className="text-center space-y-3 max-w-md">
                <h3 className="text-xl font-bold text-slate-900">同步您的产品清单</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  请先下载标准模板填入产品数据，系统将自动识别系列、年度成本并匹配已有档案。
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg">
                <button onClick={() => generateProductTemplateXlsx()} className="group relative overflow-hidden p-5 bg-white border border-slate-200 rounded-2xl text-left hover:border-blue-200 hover:shadow-lg hover:shadow-blue-50 transition-all duration-300 active:scale-95">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Download size={60} />
                  </div>
                  <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Download size={18}/>
                  </div>
                  <div className="font-bold text-slate-900 mb-0.5">下载标准模板</div>
                  <div className="text-[10px] text-slate-400 font-medium">获取最新的 Excel 导入格式</div>
                </button>
                
                <button onClick={() => fileInputRef.current?.click()} className="group relative overflow-hidden p-5 bg-slate-900 text-white rounded-2xl text-left hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-200 transition-all duration-300 active:scale-95">
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Upload size={60} />
                  </div>
                  <div className="w-9 h-9 bg-white/10 text-white rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    {parsing ? <RefreshCw className="animate-spin" size={18}/> : <FileBox size={18}/>}
                  </div>
                  <div className="font-bold text-white mb-0.5">{parsing ? '正在分析...' : '上传文件'}</div>
                  <div className="text-[10px] text-slate-400 font-medium">支持 .xlsx 格式文件</div>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center shadow-lg shadow-emerald-200"><CheckCircle size={16}/></div>
                   <div>
                     <p className="text-sm font-bold text-emerald-900">解析成功</p>
                     <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-0.5">共识别到 {previewData.length} 个独立型号档案</p>
                   </div>
                 </div>
                 <button onClick={() => onConfirm(previewData)} className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-200 active:scale-95 transition-all hover:bg-emerald-700">
                    确认入库
                 </button>
              </div>
              
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3 font-bold text-slate-400 uppercase tracking-widest w-16">状态</th>
                      <th className="px-6 py-3 font-bold text-slate-400 uppercase tracking-widest">型号</th>
                      <th className="px-6 py-3 font-bold text-slate-400 uppercase tracking-widest">系列</th>
                      <th className="px-6 py-3 font-bold text-slate-400 uppercase tracking-widest text-right">最新成本</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {previewData.map((p, idx) => {
                      const status = getImportStatus(p.kebosModel);
                      const years = Object.keys(p.yearlyCosts).map(Number).sort((a,b)=>b-a);
                      const latestUsd = p.yearlyCosts[years[0]]?.usd || 0;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${status === 'update' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                              {status === 'update' ? '更新' : '新增'}
                            </span>
                          </td>
                          <td className="px-6 py-3 font-bold text-slate-700">{p.kebosModel}</td>
                          <td className="px-6 py-3 font-medium text-slate-500">{p.series}</td>
                          <td className="px-6 py-3 text-right font-bold text-slate-900 tabular-nums">${latestUsd.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        
        <input ref={fileInputRef} type="file" accept=".xlsx" title="选择导入文件" className="hidden" onChange={handleFileChange} />
      </div>
    </div>
  );
};

const ProductDetailView = ({ product, onClose, onEdit, onClone }: { product: Product, onClose: () => void, onEdit: () => void, onClone: () => void }) => {
  const sortedYears = Object.keys(product.yearlyCosts || {}).map(Number).sort((a, b) => b - a);
  const trend = getPriceTrend(product);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-0 md:p-6 lg:p-10">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#f8fafc] h-full md:h-auto md:max-h-[90vh] md:rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden border border-white/10">
        <div className="p-6 bg-white/90 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-xl shadow-slate-200">
              <Package size={20}/>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 leading-none">{product.kebosModel}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1.5 tracking-widest">{product.series} SERIES</p>
            </div>
          </div>
          <button onClick={onClose} title="关闭详情" aria-label="关闭详情" className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 transition-colors"><X size={18}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">产品分类 (ITEM)</p>
              <p className="text-sm font-bold text-slate-700">{product.category || 'UPS'}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">供应商型号</p>
              <p className="text-sm font-bold text-slate-700">{product.supplierModel || '-'}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">工厂料号</p>
              <p className="text-sm font-bold text-slate-700">{product.factoryPartNumber || '-'}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MOQ</p>
              <p className="text-sm font-bold text-slate-700">{product.moq} PCS</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-blue-500 rounded-full"/>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">技术规格</h3>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-sm text-slate-600 leading-relaxed">
              {highlightTechSpecs(product.description)}
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-emerald-500 rounded-full"/>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">物流参数</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: '电池', value: product.batteryInfo, icon: Battery },
                { label: '产品尺寸', value: product.productSize, icon: Ruler },
                { label: '包装尺寸', value: product.packingSize, icon: Box },
                { label: '装箱数', value: `${product.pcsPerCtn} PCS/CTN`, icon: Layers },
                { label: '净重', value: `${product.nw} KG`, icon: Weight },
                { label: '毛重', value: `${product.gw} KG`, icon: Weight },
              ].map((item, i) => (
                <div key={i} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-slate-400">
                    <item.icon size={14}/>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 truncate" title={String(item.value)}>{item.value || '-'}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-amber-500 rounded-full"/>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">成本走势</h3>
            </div>
            <div className="space-y-2">
              {sortedYears.map(year => {
                const cost = product.yearlyCosts[year];
                const isLatest = year === sortedYears[0];
                return (
                  <div key={year} className={`flex items-center justify-between p-4 rounded-2xl border ${isLatest ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-100'}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isLatest ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{year}</span>
                      {isLatest && <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1"><CheckCircle size={10}/> 当前生效</span>}
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-bold text-slate-900 tabular-nums">${cost.usd.toFixed(2)}</p>
                       <p className="text-[10px] font-medium text-slate-400 tabular-nums">¥{cost.rmb.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white border-t border-slate-100 flex gap-3 sticky bottom-0 z-20">
          <button onClick={() => { onClone(); onClose(); }} className="flex-1 py-3 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
            <Copy size={16}/> 复制型号
          </button>
          <button onClick={() => { onEdit(); onClose(); }} className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors flex items-center justify-center gap-2">
            <Edit2 size={16}/> 编辑档案
          </button>
        </div>
      </div>
    </div>
  );
};

const ProductEditModal = ({ product, onClose, onSave, isNew }: { product: Product, onClose: () => void, onSave: (p: Product) => void, isNew: boolean }) => {
  const roundTo2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const [form, setForm] = useState<Product>({ ...product });
  const sortedYears = Object.keys(form.yearlyCosts || {}).map(Number).sort((a, b) => b - a);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleAddYear = () => {
    const nextYear = sortedYears.length > 0 ? sortedYears[0] + 1 : new Date().getFullYear();
    setForm({ ...form, yearlyCosts: { ...form.yearlyCosts, [nextYear]: { usd: 0, rmb: 0 } } });
  };

  const updateCostField = (yr: number, field: 'usd' | 'rmb', value: number) => {
    setForm({ ...form, yearlyCosts: { ...form.yearlyCosts, [yr]: { ...form.yearlyCosts[yr], [field]: roundTo2(value) } } });
  };

  const autoFillRmb = (yr: number) => {
    const currentUsd = form.yearlyCosts[yr]?.usd || 0;
    updateCostField(yr, 'rmb', calcRmbCost(currentUsd));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-lg animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative bg-[#f8fafc] w-full max-w-2xl h-full md:h-auto md:max-h-[90vh] md:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner"><Settings size={24} /></div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">{isNew ? '录入新档案' : '修订主数据'}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">MASTER DATA</p>
            </div>
          </div>
          <button onClick={onClose} title="关闭编辑窗口" aria-label="关闭编辑窗口" className="p-2.5 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-10 no-scrollbar">
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-1">1. 物理参数与规格</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">所属系列</label>
                <select title="所属系列" value={form.series || 'Others'} onChange={e => setForm({...form, series: e.target.value as ProductSeries})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-sm shadow-sm transition-all appearance-none">
                  {SERIES_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">ITEM (Category)</label>
                <select title="产品分类" value={form.category || 'UPS'} onChange={e => setForm({...form, category: e.target.value as any})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-sm shadow-sm transition-all appearance-none">
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">KEBOS 型号</label>
                <input type="text" value={form.kebosModel} onChange={e => setForm({...form, kebosModel: e.target.value})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-sm shadow-sm" placeholder="如: PG1200" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">工厂料号</label>
                <input type="text" value={form.factoryPartNumber || ''} onChange={e => setForm({...form, factoryPartNumber: e.target.value})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-sm shadow-sm" placeholder="如: KB-LG2000VA-A01" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">规格描述</label>
                <textarea rows={3} title="规格描述" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs shadow-sm" />
              </div>
              
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Size (mm)</label>
                <input type="text" value={form.productSize} onChange={e => setForm({...form, productSize: e.target.value})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-sm shadow-sm" placeholder="如: 350*146*160" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Packing Size (mm)</label>
                <input type="text" value={form.packingSize} onChange={e => setForm({...form, packingSize: e.target.value})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-sm shadow-sm" placeholder="如: 450*220*250" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">PCS/CTN (装箱数)</label>
                <input type="number" title="装箱数" value={form.pcsPerCtn || 1} onChange={e => setForm({...form, pcsPerCtn: parseInt(e.target.value) || 1})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-sm shadow-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">N.W. (KG)</label>
                <input type="number" step="0.1" title="净重" value={form.nw} onChange={e => setForm({...form, nw: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-sm shadow-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">G.W. (KG)</label>
                <input type="number" step="0.1" title="毛重" value={form.gw} onChange={e => setForm({...form, gw: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-sm shadow-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">最小订量 (PCS)</label>
                <input type="number" title="最小订量" value={form.moq} onChange={e => setForm({...form, moq: parseInt(e.target.value) || 0})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-sm shadow-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">内置电池</label>
                <input type="text" title="内置电池" value={form.batteryInfo} onChange={e => setForm({...form, batteryInfo: e.target.value})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-sm shadow-sm" />
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-1">2. 成本与售价管理</h4>
            
            {/* Standard Price Field */}
            <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100">
              <div className="space-y-2">
                 <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                   <Tag size={10} /> 标准建议售价 (Standard Price)
                 </label>
                 <div className="relative">
                   <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                   <input 
                     type="number" 
                     step="0.01"
                     value={form.standardPrice || ''} 
                     onChange={e => setForm({...form, standardPrice: roundTo2(parseFloat(e.target.value) || 0)})}
                     placeholder="0.00"
                     className="w-full pl-10 pr-5 py-4 bg-white border border-blue-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-black text-xl text-blue-700 shadow-sm transition-all placeholder:text-slate-200" 
                   />
                 </div>
                 <p className="text-[10px] text-blue-400/80 font-medium px-2">当无历史报价记录时，系统将默认引用此价格</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">年度采购成本记录</label>
                <button onClick={handleAddYear} className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors">
                  <Plus size={12} strokeWidth={3}/> 添加年份
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {sortedYears.map(yr => (
                <div key={yr} className="p-6 md:p-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-400 text-[10px] tracking-widest">{yr} YEAR</span>
                    <button onClick={() => { const nc = {...form.yearlyCosts}; delete nc[yr]; setForm({...form, yearlyCosts: nc}); }} title="删除该年份成本" aria-label="删除该年份成本" className="p-2 text-rose-300 hover:text-rose-600 transition-all"><Trash2 size={16}/></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-400">USD $</span>
                      <input type="number" title="美元成本" step="0.01" value={form.yearlyCosts[yr]?.usd || 0} onChange={e => updateCostField(yr, 'usd', parseFloat(e.target.value) || 0)} className="w-full pl-16 pr-6 py-4 bg-slate-50 rounded-2xl outline-none font-black text-sm" />
                    </div>
                    <div className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-400">RMB ¥</span>
                        <input type="number" title="人民币成本" step="0.01" value={form.yearlyCosts[yr]?.rmb || 0} onChange={e => updateCostField(yr, 'rmb', parseFloat(e.target.value) || 0)} className="w-full pl-16 pr-6 py-4 bg-slate-50 rounded-2xl outline-none font-black text-sm" />
                      </div>
                      <button type="button" onClick={() => autoFillRmb(yr)} title="按汇率回填人民币成本" aria-label="按汇率回填人民币成本" className="p-4 bg-slate-50 text-slate-300 hover:text-blue-500 rounded-2xl transition-all"><Calculator size={18} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-6 md:p-8 bg-white border-t border-slate-100 flex justify-end gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
          <button onClick={onClose} className="px-6 py-4 text-slate-400 font-black text-xs uppercase">放弃</button>
          <button onClick={() => onSave(form)} className="px-10 py-4 bg-slate-900 text-white rounded-[2rem] font-black text-sm shadow-2xl active:scale-95 transition-all">立即同步档案</button>
        </div>
      </div>
    </div>
  );
};

const ProductList = ({ products, logs, onBulkAdd, onUpdate, onBatchImport, onAdd, onDelete }: ProductListProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeries, setSelectedSeries] = useState<ProductSeries | 'All'>('All');
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [jumpToPage, setJumpToPage] = useState('');

  const seriesCounts = useMemo(() => {
    const counts: Record<string, number> = { All: products.length };
    SERIES_OPTIONS.forEach(s => counts[s] = 0);
    products.forEach(p => { const s = p.series || 'Others'; counts[s] = (counts[s] || 0) + 1; });
    return counts;
  }, [products]);

  const filteredProducts = useMemo(() => products.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = p.kebosModel.toLowerCase().includes(term)
      || (p.supplierModel || '').toLowerCase().includes(term)
      || (p.factoryPartNumber || '').toLowerCase().includes(term);
    const matchesSeries = selectedSeries === 'All' || p.series === selectedSeries;
    return matchesSearch && matchesSeries;
  }), [products, searchTerm, selectedSeries]);

  const dashboardStats = useMemo(() => {
    const latestUsdValues = filteredProducts.map(product => {
      const years = Object.keys(product.yearlyCosts || {}).map(Number).sort((a, b) => b - a);
      return product.yearlyCosts[years[0]]?.usd || 0;
    });
    const avgUsd = latestUsdValues.length > 0
      ? latestUsdValues.reduce((sum, value) => sum + value, 0) / latestUsdValues.length
      : 0;
    const withFactoryPartNumber = filteredProducts.filter(product => !!product.factoryPartNumber).length;
    const sparePartsCount = filteredProducts.filter(product => product.category === 'Spare Parts').length;

    return {
      filteredCount: filteredProducts.length,
      avgUsd,
      withFactoryPartNumber,
      sparePartsCount,
    };
  }, [filteredProducts]);

  // 重置搜索/筛选时的页码
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSeries, pageSize]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  const activeProduct = useMemo(() => products.find(p => p.id === activeProductId), [products, activeProductId]);

  const handleBulkConfirm = (imported: Product[]) => {
    const currentProductsMap = new Map(products.map(p => [p.kebosModel.toLowerCase(), p]));
    const toAdd: Product[] = [];
    const toUpdate: Product[] = [];

    imported.forEach(imp => {
      const existing = currentProductsMap.get(imp.kebosModel.toLowerCase());
      if (existing) {
        toUpdate.push({ 
          ...existing, 
          ...imp, 
          id: existing.id, 
          category: imp.category || existing.category,
          yearlyCosts: { ...existing.yearlyCosts, ...imp.yearlyCosts } 
        });
      } else {
        toAdd.push(imp);
      }
    });

    if (onBatchImport) {
      onBatchImport(toAdd, toUpdate);
    } else {
      if (toAdd.length > 0) onBulkAdd(toAdd);
      toUpdate.forEach(p => onUpdate(p));
    }
    setIsImporting(false);
  };

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpToPage);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p);
      setJumpToPage('');
    }
  };

  return (
    <div className="animate-in fade-in duration-700 pb-20">
      <section className="erp-panel rounded-[2rem] px-5 py-5 md:px-7 md:py-6 mb-6 space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0f5f5b]/10 text-[#0f5f5b] text-[11px] font-black uppercase tracking-[0.24em]">
              <Package size={14} />
              Product Master Workspace
            </div>
            <div>
              <h1 className="erp-title text-3xl font-black text-slate-900 tracking-tight">产品主数据工作台</h1>
              <p className="text-sm text-slate-500 max-w-3xl mt-2">围绕型号、供应商型号、工厂料号、系列与年度成本做统一维护，让产品资料更适合销售与供应链协同使用。</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:w-auto">
            <div className="relative group flex-1 md:flex-none">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="按型号、供应商型号、工厂料号搜索" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[1.2rem] outline-none w-full md:w-80 text-sm font-bold shadow-sm focus:border-[#0f5f5b]" />
            </div>
            <div className="flex items-center gap-2 bg-white p-1 rounded-[1.3rem] shadow-sm border border-slate-200">
              <button 
                onClick={() => exportProductsToXlsx(filteredProducts)} 
                className="px-5 py-3 bg-emerald-600 text-white rounded-[1rem] shadow-lg shadow-emerald-100 active:scale-95 transition-all hover:bg-emerald-700 flex items-center gap-2" 
                title="导出当前产品清单"
              >
                <Download size={18}/>
                <span className="text-[11px] font-black uppercase tracking-tight">导出结果</span>
              </button>
              <button 
                onClick={() => setIsImporting(true)} 
                className="px-5 py-3 bg-[#0f5f5b] text-white rounded-[1rem] shadow-lg shadow-[#0f5f5b]/20 active:scale-95 transition-all hover:bg-[#0d504d] flex items-center gap-2" 
                title="批量导入 Excel"
              >
                <FileSpreadsheet size={18}/>
                <span className="text-[11px] font-black uppercase tracking-tight">批量导入</span>
              </button>
            </div>
            <button onClick={() => setIsAddingNew(true)} className="hidden md:flex px-6 py-4 bg-slate-900 text-white rounded-[1.2rem] font-black text-xs shadow-xl active:scale-95 transition-all items-center gap-2 hover:bg-black"><Plus size={18}/> 新建主数据</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">筛选结果</div>
            <div className="mt-3 flex items-end justify-between">
              <div className="text-3xl font-black text-slate-900 tabular-nums">{dashboardStats.filteredCount}</div>
              <div className="text-[11px] font-bold text-slate-500">总库 {products.length}</div>
            </div>
          </div>
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">平均最新成本</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">${dashboardStats.avgUsd.toFixed(2)}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">基于当前筛选型号最新年度成本</div>
          </div>
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">已补工厂料号</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{dashboardStats.withFactoryPartNumber}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">便于和工厂及采购侧对齐型号</div>
          </div>
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">备件占比</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{dashboardStats.sparePartsCount}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">当前筛选中 Spare Parts 条目数量</div>
          </div>
        </div>

        <div className="rounded-[1.6rem] bg-slate-50/90 border border-slate-200 px-4 py-4 md:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">当前筛选上下文</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
              <span className="px-3 py-1.5 rounded-full bg-white border border-slate-200">系列: {selectedSeries === 'All' ? '全部' : selectedSeries}</span>
              <span className="px-3 py-1.5 rounded-full bg-white border border-slate-200">关键词: {searchTerm || '未输入'}</span>
              <span className="px-3 py-1.5 rounded-full bg-white border border-slate-200">分页: 第 {currentPage} / {Math.max(totalPages, 1)} 页</span>
            </div>
          </div>
          <div className="text-sm text-slate-500 lg:text-right max-w-xl">建议将产品库视为 ERP 主数据，而不是简单清单。优先维护料号、系列、年度成本和尺寸字段，这些信息会直接影响报价准确性与后续执行效率。</div>
        </div>
      </section>

      <div className="mb-8 px-1 overflow-x-auto no-scrollbar pb-2">
        <div className="bg-white/70 backdrop-blur-md p-1.5 rounded-[2.5rem] shadow-sm flex items-center gap-1 w-max border border-slate-200">
           <button onClick={() => setSelectedSeries('All')} className={`flex items-center gap-2 px-6 py-3.5 rounded-[2rem] font-black text-[11px] transition-all ${selectedSeries === 'All' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'}`}> 全部型号 <span className="opacity-40">{seriesCounts.All}</span></button>
           {SERIES_OPTIONS.map(series => (
             <button key={series} onClick={() => setSelectedSeries(series)} className={`flex items-center gap-2 px-6 py-3.5 rounded-[2rem] font-black text-[11px] transition-all whitespace-nowrap ${selectedSeries === series ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'}`}> {getSeriesIcon(series)} {series} <span className="opacity-40">{seriesCounts[series]}</span></button>
           ))}
        </div>
      </div>

      <div className="px-1">
        <div className="hidden lg:block bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden mb-6 transition-all">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <thead className="bg-[#f5f7f7] border-b border-slate-100 sticky top-0 z-10">
              <tr>
                <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-widest w-[8%]">ITEM</th>
                <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-widest w-[22%]">型号与标识</th>
                <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-widest w-[40%]">核心规格与参数详情</th>
                <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-widest text-right w-[12%]">标准成本</th>
                <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-widest text-center w-[10%]">走势</th>
                <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-widest text-right w-[8%]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedProducts.length > 0 ? paginatedProducts.map(p => {
                const years = Object.keys(p.yearlyCosts).map(Number).sort((a,b)=>b-a);
                const latest = p.yearlyCosts[years[0]] || { usd: 0, rmb: 0 };
                const trend = getPriceTrend(p);
                return (
                  <tr key={p.id} onClick={() => setActiveProductId(p.id)} className="hover:bg-slate-50/80 transition-all cursor-pointer group">
                    <td className="px-8 py-7">
                       <span className="font-black text-slate-900 text-[13px]">{p.category || 'UPS'}</span>
                    </td>
                    <td className="px-8 py-7">
                       <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                             <span className="font-black text-slate-900 text-[13px] leading-none">{p.kebosModel}</span>
                             <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md uppercase border border-blue-100/50 tracking-tighter">
                                {p.series}
                             </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase">
                             <Tag size={10} className="text-slate-300" /> {p.supplierModel || 'INTERNAL-ID'}
                          </div>
                          {p.factoryPartNumber && (
                            <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase">
                              <Package size={10} className="text-slate-300" /> {p.factoryPartNumber}
                            </div>
                          )}
                       </div>
                    </td>
                    <td className="px-8 py-7">
                       <div className="space-y-2.5">
                          <div className="text-slate-500 leading-relaxed font-medium line-clamp-2 text-[11px] pr-4">
                             {highlightTechSpecs(p.description)}
                          </div>
                          <div className="flex flex-wrap gap-2">
                             {p.batteryInfo && (
                               <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black border border-slate-200/50 shadow-sm">
                                  <Battery size={10} className="text-blue-500" /> {p.batteryInfo}
                               </div>
                             )}
                             {p.productSize && (
                               <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black border border-slate-200/50 shadow-sm">
                                  <Ruler size={10} className="text-purple-500" /> {p.productSize}
                               </div>
                             )}
                             {p.gw > 0 && (
                               <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black border border-slate-200/50 shadow-sm">
                                  <Scale size={10} className="text-rose-500" /> {p.gw}KG (GW)
                               </div>
                             )}
                          </div>
                       </div>
                    </td>
                    <td className="px-8 py-7 text-right">
                       <div className="flex flex-col items-end gap-1">
                          <span className="font-black text-slate-900 text-sm tabular-nums tracking-tight">${latest.usd.toFixed(2)}</span>
                          <span className="text-[9px] font-black text-slate-400 tabular-nums">¥{(latest.rmb || 0).toLocaleString()}</span>
                       </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                       <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-black text-[10px] ${trend.direction === 'up' ? 'text-rose-500 bg-rose-50 border border-rose-100' : 'text-emerald-600 bg-emerald-50 border border-emerald-100'}`}>
                          {trend.direction === 'up' ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                          {formatPercent(Math.abs(trend.percent))}
                       </div>
                    </td>
                    <td className="px-8 py-7 text-right" onClick={e => e.stopPropagation()}>
                       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                          <button onClick={() => setEditingProduct(p)} title="编辑产品" aria-label="编辑产品" className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-slate-900 rounded-xl transition-all shadow-sm"><Edit2 size={16}/></button>
                          <button onClick={() => onDelete(p.id)} title="删除产品" aria-label="删除产品" className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 rounded-xl transition-all shadow-sm"><Trash2 size={16}/></button>
                       </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-400 italic font-medium">未发现匹配的记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile List View */}
        <div className="lg:hidden space-y-4 mb-6">
          {paginatedProducts.length > 0 ? paginatedProducts.map(p => {
             const years = Object.keys(p.yearlyCosts).map(Number).sort((a,b)=>b-a);
             const latest = p.yearlyCosts[years[0]] || { usd: 0, rmb: 0 };
             const trend = getPriceTrend(p);
             return (
               <div key={p.id} onClick={() => setActiveProductId(p.id)} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm active:scale-95 transition-all">
                 <div className="flex justify-between items-start mb-3">
                    <div>
                       <div className="flex items-center gap-2 mb-1">
                          <span className="font-black text-slate-900 text-lg">{p.kebosModel}</span>
                          <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md uppercase">{p.series}</span>
                       </div>
                       <div className="text-xs text-slate-400 font-bold">{p.supplierModel || 'INTERNAL-ID'}</div>
                        {p.factoryPartNumber && <div className="text-[11px] text-slate-400 font-bold">工厂料号: {p.factoryPartNumber}</div>}
                    </div>
                    <div className="text-right">
                       <div className="font-black text-slate-900 text-lg">${latest.usd.toFixed(2)}</div>
                       <div className="text-xs text-slate-400">¥{(latest.rmb || 0).toLocaleString()}</div>
                    </div>
                 </div>
                 <div className="text-xs text-slate-500 line-clamp-2 mb-4 bg-slate-50 p-3 rounded-xl">
                    {p.description || '暂无描述'}
                 </div>
                 <div className="flex items-center justify-between">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-black text-[10px] ${trend.direction === 'up' ? 'text-rose-500 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>
                       {trend.direction === 'up' ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                       {formatPercent(Math.abs(trend.percent))}
                    </div>
                    <div className="flex gap-2">
                       <button onClick={(e) => { e.stopPropagation(); setEditingProduct(p); }} title="编辑产品" aria-label="编辑产品" className="p-2 bg-slate-100 text-slate-500 rounded-xl"><Edit2 size={16}/></button>
                       <button onClick={(e) => { e.stopPropagation(); onDelete(p.id); }} title="删除产品" aria-label="删除产品" className="p-2 bg-rose-50 text-rose-500 rounded-xl"><Trash2 size={16}/></button>
                    </div>
                 </div>
               </div>
             );
          }) : (
             <div className="py-20 text-center text-slate-400 italic">未发现匹配的记录</div>
          )}
        </div>

        {filteredProducts.length > 0 && (
          <div className="hidden lg:flex items-center justify-between bg-white px-8 py-5 rounded-[2.5rem] border border-slate-100 shadow-sm mb-20 animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-6">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                正在显示 <span className="text-slate-900">{(currentPage-1)*pageSize + 1}-{Math.min(currentPage*pageSize, filteredProducts.length)}</span> / <span className="text-slate-900">{filteredProducts.length}</span> 个型号
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
                <button onClick={() => setCurrentPage(1)} title="跳到首页" aria-label="跳到首页" disabled={currentPage === 1} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-all rounded-xl hover:bg-white"><ChevronsLeft size={16}/></button>
                <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} title="上一页" aria-label="上一页" disabled={currentPage === 1} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-all rounded-xl hover:bg-white"><ChevronLeft size={16}/></button>
                <div className="flex items-center gap-1 px-3"><span className="text-xs font-black text-slate-900">{currentPage}</span><span className="text-[10px] font-black text-slate-300">/</span><span className="text-xs font-black text-slate-400">{totalPages}</span></div>
                <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} title="下一页" aria-label="下一页" disabled={currentPage === totalPages} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-all rounded-xl hover:bg-white"><ChevronRight size={16}/></button>
                <button onClick={() => setCurrentPage(totalPages)} title="跳到末页" aria-label="跳到末页" disabled={currentPage === totalPages} className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-all rounded-xl hover:bg-white"><ChevronsRight size={16}/></button>
              </div>

              <div className="h-6 w-px bg-slate-100" />

              <form onSubmit={handleJumpToPage} className="flex items-center gap-2">
                <input type="text" placeholder="页码" value={jumpToPage} onChange={e => setJumpToPage(e.target.value.replace(/\D/g, ''))} className="w-12 h-9 bg-slate-50 border border-slate-100 rounded-xl px-2 text-center text-xs font-black outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
              </form>
            </div>
          </div>
        )}
      </div>

      {isImporting && (
        <ImportWizard 
          productsInDb={products} 
          onClose={() => setIsImporting(false)} 
          onConfirm={handleBulkConfirm} 
        />
      )}

      {activeProduct && (
        <ProductDetailView 
          product={activeProduct} 
          onClose={() => setActiveProductId(null)} 
          onEdit={() => { setActiveProductId(null); setEditingProduct(activeProduct); }}
          onClone={() => { setActiveProductId(null); setEditingProduct({...activeProduct, id: '', kebosModel: `${activeProduct.kebosModel}-COPY`}); setIsAddingNew(true); }}
        />
      )}

      {(isAddingNew || editingProduct) && (
        <ProductEditModal 
          product={editingProduct || {
            id: '',
            kebosModel: '',
            supplierModel: '',
            factoryPartNumber: '',
            series: 'Others',
            description: '',
            batteryInfo: '',
            moq: 1,
            productSize: '',
            packingSize: '',
            pcsPerCtn: 1,
            nw: 0,
            gw: 0,
            packaging: '',
            yearlyCosts: { [new Date().getFullYear()]: { usd: 0, rmb: 0 } }
          }} 
          isNew={!!isAddingNew || !editingProduct?.id}
          onClose={() => { setIsAddingNew(false); setEditingProduct(null); }}
          onSave={(p) => {
            if (isAddingNew || !p.id) onAdd(p);
            else onUpdate(p);
            setIsAddingNew(false);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
};

export default ProductList;

