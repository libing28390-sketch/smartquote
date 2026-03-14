import React, { useState, useMemo, useRef } from 'react';
import { Search, Plus, Edit3, Trash2, X, Save, MapPin, User as UserIcon, Phone, Mail, Building, FileSpreadsheet, Download, Upload, RefreshCw, FileBox, CheckCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Customer } from '../types';
import { generateCustomerTemplateXlsx, exportCustomersToXlsx, parseCustomerExcel, getCountryCode } from '../utils';

interface CustomerListProps {
  customers: Customer[];
  onAdd: (customer: Customer) => void;
  onUpdate: (id: string, customer: Customer) => void;
  onDelete: (id: string) => void;
  onBulkAdd?: (customers: Customer[]) => void;
  isError?: boolean;
}

const ImportWizard = ({ customersInDb, onClose, onConfirm }: { customersInDb: Customer[], onClose: () => void, onConfirm: (results: Customer[]) => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [previewData, setPreviewData] = useState<Customer[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setParsing(true);
      try {
        const results = await parseCustomerExcel(selected);
        setPreviewData(results);
      } catch (err) {
        alert("文件解析失败，请检查模板格式");
      } finally {
        setParsing(false);
      }
    }
  };

  const getImportStatus = (name: string) => {
    const exists = customersInDb.some(c => c.companyName.trim().toLowerCase() === name.trim().toLowerCase());
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
              <h2 className="text-lg font-bold text-slate-900 leading-none">批量导入客户</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">Customer Batch Processor</p>
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
                <h3 className="text-xl font-bold text-slate-900">同步您的客户列表</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  请先下载标准模板填入客户数据，系统将自动识别并匹配已有客户。
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg">
                <button onClick={() => generateCustomerTemplateXlsx()} className="group relative overflow-hidden p-5 bg-white border border-slate-200 rounded-2xl text-left hover:border-blue-200 hover:shadow-lg hover:shadow-blue-50 transition-all duration-300 active:scale-95">
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
                     <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-0.5">共识别到 {previewData.length} 个客户档案</p>
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
                      <th className="px-6 py-3 font-bold text-slate-400 uppercase tracking-widest">客户名称</th>
                      <th className="px-6 py-3 font-bold text-slate-400 uppercase tracking-widest">联系人</th>
                      <th className="px-6 py-3 font-bold text-slate-400 uppercase tracking-widest">电话</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {previewData.map((c, idx) => {
                      const status = getImportStatus(c.companyName);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${status === 'update' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                              {status === 'update' ? '更新' : '新增'}
                            </span>
                          </td>
                          <td className="px-6 py-3 font-bold text-slate-700">{c.companyName}</td>
                          <td className="px-6 py-3 font-medium text-slate-500">{c.contactPerson}</td>
                          <td className="px-6 py-3 font-medium text-slate-500">{c.phone}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        
        <input ref={fileInputRef} type="file" accept=".xlsx" title="选择客户导入文件" className="hidden" onChange={handleFileChange} />
      </div>
    </div>
  );
};

const CustomerList: React.FC<CustomerListProps> = ({ customers, onAdd, onUpdate, onDelete, onBulkAdd, isError }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showImportWizard, setShowImportWizard] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form state
  const [formData, setFormData] = useState<Partial<Customer>>({});

  const STAGE_MAP: Record<string, string> = {
    'Potential': '潜在客户',
    'Quoting': '报价中',
    'Sample': '样品测试',
    'First Order': '首单成交',
    'Long-term': '长期合作'
  };

  const LEVEL_MAP: Record<string, string> = {
    'A': '核心',
    'B': '重点',
    'C': '普通',
    'D': '休眠'
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
    );
  }, [customers, searchTerm]);

  const customerStats = useMemo(() => {
    const aLevelCount = filteredCustomers.filter(customer => customer.level === 'A').length;
    const quotingCount = filteredCustomers.filter(customer => customer.stage === 'Quoting' || customer.stage === 'Sample').length;
    const longTermCount = filteredCustomers.filter(customer => customer.stage === 'Long-term').length;
    const upcomingActions = filteredCustomers.filter(customer => {
      if (!customer.nextActionDate) return false;
      const actionDate = new Date(customer.nextActionDate).getTime();
      const now = new Date();
      const sevenDaysLater = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).getTime();
      return actionDate >= now.setHours(0, 0, 0, 0) && actionDate <= sevenDaysLater;
    }).length;
    return { aLevelCount, quotingCount, longTermCount, upcomingActions };
  }, [filteredCustomers]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData(customer);
    } else {
      setEditingCustomer(null);
      setFormData({
        customerId: '',
        companyName: '',
        companyNameLocal: '',
        country: '',
        address: '',
        website: '',
        industry: '',
        scale: 'Small',
        contactPerson: '',
        position: '',
        email: '',
        phone: '',
        socialApp: '',
        timezone: '',
        communicationPreference: '',
        languagePreference: '',
        stage: 'Potential',
        level: 'C',
        firstContactDate: '',
        nextActionDate: '',
        nextActionPlan: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    setFormData({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName) return;

    const now = new Date().toISOString();

    if (editingCustomer) {
      onUpdate(editingCustomer.id, {
        ...editingCustomer,
        ...formData as Customer,
        updatedAt: now
      });
    } else {
      onAdd({
        id: `CUST-${Date.now()}`,
        ...formData as Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>,
        createdAt: now,
        updatedAt: now
      } as Customer);
    }
    handleCloseModal();
  };

  const handleBulkImport = (newCustomers: Customer[]) => {
    // Merge logic: Update existing, add new
    // We rely on parent's onBulkAdd if available, or just call onAdd/onUpdate in loop
    // Ideally onBulkAdd should handle this.
    // If onBulkAdd is not provided (App.tsx might not have it yet), we can loop.
    // However, App.tsx usually doesn't have onBulkAdd for customers yet. 
    // I should probably check App.tsx later or assume I can use onAdd/onUpdate.
    // But better to use onBulkAdd if I add it to props. I added it to props.
    
    if (onBulkAdd) {
        onBulkAdd(newCustomers);
    } else {
        // Fallback if no bulk add prop
        newCustomers.forEach(c => {
            const existing = customers.find(ex => ex.companyName === c.companyName);
            if (existing) {
                onUpdate(existing.id, { ...existing, ...c, id: existing.id });
            } else {
                onAdd(c);
            }
        });
    }
    setShowImportWizard(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {isError && (
        <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center gap-3 text-rose-700 animate-pulse">
          <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center shrink-0">
            <X size={20} />
          </div>
          <div>
            <h3 className="font-bold">数据加载失败</h3>
            <p className="text-xs opacity-80">无法连接到服务器获取客户数据。为防止数据丢失，编辑功能已暂时禁用。</p>
          </div>
        </div>
      )}

      {showImportWizard && <ImportWizard customersInDb={customers} onClose={() => setShowImportWizard(false)} onConfirm={handleBulkImport} />}

      <section className="erp-panel rounded-[2rem] px-5 py-6 md:px-8 md:py-7 space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0f5f5b]/10 text-[#0f5f5b] text-[11px] font-black uppercase tracking-[0.24em]">
              <Building size={14} />
              Customer Growth Workspace
            </div>
            <div>
              <h1 className="erp-title text-3xl font-black text-slate-900 tracking-tight">客户经营中心</h1>
              <p className="text-sm text-slate-500 max-w-3xl mt-2">客户页不只是名片库，而是销售跟进入口。这里应该让你快速识别核心客户、报价推进中的客户和近期需要行动的客户。</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
             <button 
               onClick={() => setShowImportWizard(true)} 
               disabled={isError}
               className="px-4 py-3 bg-slate-100 text-slate-600 rounded-[1rem] text-sm font-bold hover:bg-slate-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
             >
               <Upload size={16} /> 导入
             </button>
             <button onClick={() => exportCustomersToXlsx(filteredCustomers)} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-[1rem] text-sm font-bold hover:bg-slate-200 transition-all flex items-center gap-2">
               <Download size={16} /> 导出
             </button>
             <button 
               onClick={() => handleOpenModal()}
               disabled={isError}
               className="px-5 py-3 bg-[#0f5f5b] text-white rounded-[1rem] text-sm font-bold hover:bg-[#0d504d] transition-all shadow-lg shadow-[#0f5f5b]/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
             >
               <Plus size={18} /> 新增客户
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">核心客户</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{customerStats.aLevelCount}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">A级客户数量</div>
          </div>
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">推进中</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{customerStats.quotingCount}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">报价中与样品阶段客户</div>
          </div>
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">长期合作</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{customerStats.longTermCount}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">已进入稳定合作阶段</div>
          </div>
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">7 日待跟进</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{customerStats.upcomingActions}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">近期需要推进的客户</div>
          </div>
        </div>

        <div className="rounded-[1.6rem] bg-white/75 border border-slate-200 px-4 py-4 flex items-center gap-3">
          <Search className="text-slate-400" size={20} />
          <input 
            type="text" 
            title="搜索客户"
            placeholder="搜索客户名称、联系人、电话、国家或阶段" 
            className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
          <div className="text-xs font-bold text-slate-500 whitespace-nowrap">当前结果 {filteredCustomers.length} 条</div>
        </div>
      </section>

      {/* Customer Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                    <th className="px-4 py-3 font-bold text-slate-500 text-xs whitespace-nowrap">客户ID</th>
                    <th className="px-4 py-3 font-bold text-slate-500 text-xs text-left min-w-[200px]">公司名称 (英文)</th>
                    <th className="px-4 py-3 font-bold text-slate-500 text-xs text-left min-w-[180px]">国家/地区/城市地址</th>
                    <th className="px-4 py-3 font-bold text-slate-500 text-xs text-left whitespace-nowrap">联系人姓名 (英文)</th>
                    <th className="px-4 py-3 font-bold text-slate-500 text-xs text-left">邮箱</th>
                    <th className="px-4 py-3 font-bold text-slate-500 text-xs text-left whitespace-nowrap">电话 (带国家区号)</th>
                    <th className="px-4 py-3 font-bold text-slate-500 text-xs text-left whitespace-nowrap">客户阶段</th>
                    <th className="px-4 py-3 font-bold text-slate-500 text-xs text-right whitespace-nowrap">操作</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {paginatedCustomers.map(customer => (
                <tr 
                  key={customer.id} 
                  onClick={() => handleOpenModal(customer)}
                  className="hover:bg-slate-50/80 transition-colors group border-b border-slate-50 last:border-0 cursor-pointer"
                >
                    {/* Customer ID */}
                    <td className="px-4 py-3 align-middle">
                        <span className="text-[10px] px-2 py-1 bg-slate-100 text-slate-600 rounded font-mono border border-slate-200 font-bold">
                            {customer.customerId || 'N/A'}
                        </span>
                    </td>

                    {/* Company Name */}
                    <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                                {customer.companyName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-700 text-sm">{customer.companyName}</span>
                        </div>
                    </td>

                    {/* Country / Address */}
                    <td className="px-4 py-3 align-middle">
                        <div className="flex flex-col">
                            {customer.country && (
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="font-bold text-slate-700 text-xs">{customer.country}</span>
                                </div>
                            )}
                            <span className="text-xs text-slate-500 line-clamp-2" title={customer.address}>{customer.address || '-'}</span>
                        </div>
                    </td>

                    {/* Contact Person */}
                    <td className="px-4 py-3 align-middle">
                         <div className="flex flex-col">
                             <div className="flex items-center gap-1.5 font-bold text-slate-700 text-sm">
                                 <UserIcon size={14} className="text-slate-400 shrink-0" />
                                 {customer.contactPerson}
                             </div>
                             {customer.position && <span className="text-xs text-slate-400 pl-5">{customer.position}</span>}
                         </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 align-middle">
                         <div className="flex items-center gap-2 text-xs text-slate-600">
                             <Mail size={14} className="text-slate-400 shrink-0"/>
                             <span className="truncate max-w-[150px]" title={customer.email}>{customer.email || '-'}</span>
                         </div>
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-3 align-middle">
                         <div className="flex items-center gap-2 text-xs text-slate-600">
                             <Phone size={14} className="text-slate-400 shrink-0"/>
                             <span className="font-mono">{customer.phone || '-'}</span>
                         </div>
                    </td>

                    {/* Stage */}
                    <td className="px-4 py-3 align-middle">
                        <div className="flex flex-col items-start gap-1">
                             <span className={`px-2 py-1 rounded-md text-[10px] font-bold border inline-block whitespace-nowrap ${
                                 (customer.stage || 'Potential') === 'First Order' || (customer.stage || 'Potential') === 'Long-term' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                 (customer.stage || 'Potential') === 'Potential' ? 'bg-slate-50 text-slate-500 border-slate-100' :
                                 'bg-blue-50 text-blue-600 border-blue-100'
                             }`}>
                                 {STAGE_MAP[customer.stage || 'Potential'] || customer.stage}
                             </span>
                             {/* Level Badge */}
                             <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                (customer.level === 'A') ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-100'
                             }`}>
                                {customer.level || 'C'}级
                             </span>
                        </div>
                    </td>

                    {/* Operations */}
                    <td className="px-4 py-3 align-middle text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenModal(customer);
                            }}
                            disabled={isError}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="编辑"
                            >
                            <Edit3 size={16} />
                            </button>
                            <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('确定要删除该客户吗？')) {
                                onDelete(customer.id);
                                }
                            }}
                            disabled={isError}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="删除"
                            >
                            <Trash2 size={16} />
                            </button>
                        </div>
                    </td>
                </tr>
                ))}
                
                {paginatedCustomers.length === 0 && (
                <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Building size={48} className="mx-auto mb-4 opacity-20" />
                        <p>未找到匹配的客户</p>
                    </td>
                </tr>
                )}
            </tbody>
            </table>
        </div>
        
        {/* Pagination */}
        {filteredCustomers.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
                <div className="text-xs text-slate-500 font-medium">
                    显示 {Math.min((currentPage - 1) * itemsPerPage + 1, filteredCustomers.length)} - {Math.min(currentPage * itemsPerPage, filteredCustomers.length)} 共 {filteredCustomers.length} 条
                </div>
                <div className="flex items-center gap-2">
                    <button
                      title="跳到首页"
                      aria-label="跳到首页"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                        <ChevronsLeft size={16} />
                    </button>
                    <button
                      title="上一页"
                      aria-label="上一页"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                        {currentPage} / {totalPages}
                    </span>
                    <button
                      title="下一页"
                      aria-label="下一页"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                        <ChevronRight size={16} />
                    </button>
                    <button
                      title="跳到末页"
                      aria-label="跳到末页"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                        <ChevronsRight size={16} />
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* Edit/Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-lg">
                {editingCustomer ? '编辑客户' : '新增客户'}
              </h3>
              <button onClick={handleCloseModal} title="关闭客户编辑" aria-label="关闭客户编辑" className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[70vh] no-scrollbar">
              
              {/* Section 1: 基本信息 */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">基本信息 (Basic Info)</h4>
                
                {/* 第一行：公司名称（必填）和 国家/地区 */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">公司名称 (英文) <span className="text-rose-500">*</span></label>
                        <input type="text" required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.companyName || ''} onChange={e => setFormData({...formData, companyName: e.target.value})} placeholder="ABC Trading Co., Ltd." />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">国家/地区</label>
                        <input 
                            type="text" 
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" 
                            value={formData.country || ''} 
                            onChange={e => {
                                const newCountry = e.target.value;
                                const code = getCountryCode(newCountry);
                                
                                // Calculate ID
                                // Filter existing customers with this country code
                                // Exclude current editing customer to avoid self-counting issues
                                const existingCount = customers.filter(c => 
                                    c.id !== editingCustomer?.id && 
                                    c.customerId && 
                                    c.customerId.startsWith(code)
                                ).length;
                                
                                const newId = `${code}${String(existingCount + 1).padStart(3, '0')}`;
                                
                                setFormData({
                                    ...formData, 
                                    country: newCountry,
                                    customerId: newId
                                });
                            }} 
                            placeholder="China" 
                        />
                    </div>
                </div>

                {/* 第二行：客户ID (自动生成) 和 公司名称 (本地语) */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">客户ID (自动生成)</label>
                        <input type="text" title="客户ID" disabled className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed" value={formData.customerId || ''} readOnly />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">公司名称 (本地语)</label>
                        <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.companyNameLocal || ''} onChange={e => setFormData({...formData, companyNameLocal: e.target.value})} placeholder="ABC贸易有限公司" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">网站</label>
                        <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.website || ''} onChange={e => setFormData({...formData, website: e.target.value})} placeholder="https://..." />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">行业分类</label>
                        <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.industry || ''} onChange={e => setFormData({...formData, industry: e.target.value})} placeholder="e.g. Electronics" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">公司规模</label>
                        <select title="公司规模" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.scale || 'Small'} onChange={e => setFormData({...formData, scale: e.target.value})}>
                            <option value="Small">小型 (&lt;50人)</option>
                            <option value="Medium">中型 (50-500人)</option>
                            <option value="Large">大型 (&gt;500人)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">详细地址</label>
                        <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="City, Street..." />
                    </div>
                </div>
              </div>

              {/* Section 2: 联系人信息 */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">联系人信息 (Contact Info)</h4>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">联系人姓名 (英文)</label>
                        <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.contactPerson || ''} onChange={e => setFormData({...formData, contactPerson: e.target.value})} placeholder="Mr. Name" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">职位</label>
                        <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.position || ''} onChange={e => setFormData({...formData, position: e.target.value})} placeholder="Manager" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">邮箱</label>
                        <input type="email" title="邮箱" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">电话 (带区号)</label>
                        <input type="text" title="电话" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">社交账号 (WhatsApp/WeChat)</label>
                    <input type="text" title="社交账号" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.socialApp || ''} onChange={e => setFormData({...formData, socialApp: e.target.value})} />
                </div>
              </div>

              {/* Section 3: 偏好与设置 */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">偏好与设置 (Preferences)</h4>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">时区</label>
                        <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.timezone || ''} onChange={e => setFormData({...formData, timezone: e.target.value})} placeholder="UTC+1" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">沟通偏好</label>
                        <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.communicationPreference || ''} onChange={e => setFormData({...formData, communicationPreference: e.target.value})} placeholder="Email/Zoom" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">语言偏好</label>
                        <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.languagePreference || ''} onChange={e => setFormData({...formData, languagePreference: e.target.value})} placeholder="English" />
                    </div>
                </div>
              </div>

              {/* Section 4: 销售管理 */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">销售管理 (Sales Info)</h4>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">客户阶段</label>
                        <select title="客户阶段" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.stage || 'Potential'} onChange={e => setFormData({...formData, stage: e.target.value})}>
                            <option value="Potential">潜在客户 (Potential)</option>
                            <option value="Quoting">报价中 (Quoting)</option>
                            <option value="Sample">样品测试 (Sample)</option>
                            <option value="First Order">首单成交 (First Order)</option>
                            <option value="Long-term">长期合作 (Long-term)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">客户等级</label>
                        <select title="客户等级" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.level || 'C'} onChange={e => setFormData({...formData, level: e.target.value})}>
                            <option value="A">A (核心)</option>
                            <option value="B">B (重点)</option>
                            <option value="C">C (普通)</option>
                            <option value="D">D (休眠)</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">首次接触日期</label>
                        <input type="date" title="首次接触日期" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.firstContactDate || ''} onChange={e => setFormData({...formData, firstContactDate: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">下次跟进日期</label>
                        <input type="date" title="下次跟进日期" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.nextActionDate || ''} onChange={e => setFormData({...formData, nextActionDate: e.target.value})} />
                    </div>
                </div>
                
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">下次跟进计划</label>
                    <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={formData.nextActionPlan || ''} onChange={e => setFormData({...formData, nextActionPlan: e.target.value})} placeholder="e.g. Send new catalog" />
                </div>
              </div>

              <div className="pt-4 flex gap-3 sticky bottom-0 bg-white border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  保存客户
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerList;