
import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, Package, FileText, PlusCircle, LogOut, Menu, Users, X, Clock, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Home, List as ListIcon, User as UserIcon, Globe, Lock, Edit3, Trash2, StickyNote, ShoppingCart, PlusSquare, ChevronDown } from 'lucide-react';
import { Routes, Route, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Product, Quote, View, User, SalesOrder, Customer } from './types';
import Dashboard from './components/Dashboard';
import ProductList from './components/ProductList';
import CustomerList from './components/CustomerList';
import QuoteList from './components/QuoteList';
import QuoteForm from './components/QuoteForm';
import OrderList from './components/OrderList';
import OrderForm from './components/OrderForm';
import UserManagement from './components/UserManagement';
import ProfileSettings from './components/ProfileSettings';
import QuoteDetailModal from './components/QuoteDetailModal';
import Login from './components/Login';
import ApiService from './services/cloudService';
import { useIdleTimeout } from './hooks/useIdleTimeout';

const WindowsCalendar = () => {
  const [viewDate, setViewDate] = useState(new Date());
  const today = new Date();
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const days = [];
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const prevMonthDays = daysInMonth(year, month - 1);
    for (let i = startDay - 1; i >= 0; i--) days.push({ day: prevMonthDays - i, currentMonth: false });
    for (let i = 1; i <= totalDays; i++) days.push({ day: i, currentMonth: true });
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) days.push({ day: i, currentMonth: false });
    return days;
  }, [viewDate]);
  const changeMonth = (offset: number) => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  return (
    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{viewDate.getFullYear()}年 {viewDate.getMonth() + 1}月</span>
        <div className="flex gap-2">
          <button onClick={() => changeMonth(-1)} title="上个月" aria-label="上个月" className="p-1 hover:bg-white/10 rounded-lg text-slate-400 transition-colors"><ChevronLeft size={14}/></button>
          <button onClick={() => changeMonth(1)} title="下个月" aria-label="下个月" className="p-1 hover:bg-white/10 rounded-lg text-slate-400 transition-colors"><ChevronRight size={14}/></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['日', '一', '二', '三', '四', '五', '六'].map(d => (<div key={d} className="text-[9px] font-bold text-slate-600 text-center py-1">{d}</div>))}
        {calendarDays.map((d, i) => {
          const isToday = d.currentMonth && d.day === today.getDate() && viewDate.getMonth() === today.getMonth() && viewDate.getFullYear() === today.getFullYear();
          return (
            <div key={i} className={`aspect-square flex items-center justify-center text-[10px] font-medium rounded-full transition-all cursor-default ${d.currentMonth ? 'text-slate-300' : 'text-slate-700 opacity-40'} ${isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40' : 'hover:bg-white/5'}`}>{d.day}</div>
          );
        })}
      </div>
    </div>
  );
};

const Scratchpad = () => {
  const [note, setNote] = useState(() => localStorage.getItem('kebos_scratchpad') || '');
  useEffect(() => {
    const handler = setTimeout(() => localStorage.setItem('kebos_scratchpad', note), 500);
    return () => clearTimeout(handler);
  }, [note]);
  return (
    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2"><Edit3 size={12} className="text-blue-400" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">业务随手记</span></div>
        <button onClick={() => setNote('')} title="清空便签" aria-label="清空便签" className="text-slate-600 hover:text-rose-500 transition-colors"><Trash2 size={12} /></button>
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="记录今日工作要点..." className="w-full h-32 bg-transparent text-slate-300 text-[11px] leading-relaxed resize-none outline-none font-medium placeholder:text-slate-700 no-scrollbar" />
    </div>
  );
};

type MenuItem = {
  id: string;
  icon: React.ElementType;
  label: string;
  path: string;
  children?: { label: string; path: string; icon?: React.ElementType }[];
};

const SidebarItem = ({ item, isSidebarOpen }: { item: MenuItem; isSidebarOpen: boolean }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname.startsWith(item.path);
  const [isExpanded, setIsExpanded] = useState(isActive);

  // Auto-expand when active
  useEffect(() => {
    if (isActive) setIsExpanded(true);
  }, [isActive]);

  if (item.children) {
    return (
      <div className="space-y-1">
        <button 
          onClick={() => {
            if (isSidebarOpen) {
              // If not currently in this section, navigate to first child
              if (!isActive && item.children && item.children.length > 0) {
                navigate(item.children[0].path);
              }
              // Toggle expansion state
              setIsExpanded(!isExpanded);
            } else {
              // Collapsed sidebar: navigate to first child
              navigate(item.children![0].path);
            }
          }}
          className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-300 ${isActive ? 'bg-blue-600/10 text-blue-600' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
        >
          <div className="flex items-center gap-3">
            <item.icon size={20} className={isActive ? "stroke-[2.5px]" : "stroke-2"} />
            {isSidebarOpen && <span className="font-bold tracking-tight">{item.label}</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={16} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />}
        </button>
        
        {isSidebarOpen && (
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="pl-4 pr-2 space-y-1 mt-1">
              {item.children.map(child => (
                <NavLink
                  key={child.path}
                  to={child.path}
                  end={child.path === item.path}
                  className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
                >
                  {child.icon && <child.icon size={16} />}
                  <span>{child.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink 
      to={item.path} 
      className={({ isActive }) => `w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-300 ${isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
    >
      <item.icon size={20} />
      {isSidebarOpen && <span className="font-bold tracking-tight">{item.label}</span>}
    </NavLink>
  );
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // 核心修复：从本地存储初始化用户状态
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('kebos_current_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersError, setCustomersError] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesError, setQuotesError] = useState(false);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [ordersError, setOrdersError] = useState(false);
  const [productsError, setProductsError] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [globalPreviewQuote, setGlobalPreviewQuote] = useState<Quote | null>(null);
  const [globalPreviewItem, setGlobalPreviewItem] = useState<any | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const logoPath = "/assets/logo.png";

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Security: Handle BFCache (Back-Forward Cache) restoration
  // This prevents users from accessing protected pages via the "Back" button after logout
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      // If page is restored from bfcache (event.persisted) or simply shown
      // Check if we should be logged in but aren't
      const saved = localStorage.getItem('kebos_current_user');
      if (!saved && currentUser) {
        // User is logged out in storage but state says logged in -> Force reload/logout
        window.location.reload();
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [currentUser]);

  // 当用户登录状态改变时同步到本地存储
  const handleSetUser = (user: User | null) => {
    if (user) {
      // Login: Force reload to avoid React render race conditions and blank screen
      // This mimics a manual refresh which is known to work perfectly
      localStorage.setItem('kebos_current_user', JSON.stringify(user));
      window.location.href = '/dashboard';
    } else {
      localStorage.removeItem('kebos_current_user');
      // Force hard reload to prevent routing glitches with Nginx/Cloudflare
      // Use replace() to overwrite the current history entry so "Back" doesn't return to dashboard
      window.location.replace('/login');
    }
  };

  // 仅更新用户状态而不刷新页面 (用于个人设置更新)
  const handleUpdateUser = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('kebos_current_user', JSON.stringify(user));
  };

  // Auto-logout after inactivity (20 minutes)
  useIdleTimeout(() => {
    if (currentUser) {
      handleSetUser(null);
      alert('Due to 20 minutes of inactivity, you have been automatically logged out for security.');
    }
  }, 20 * 60 * 1000);

  useEffect(() => {
    const init = async () => {
      // Load data independently and in parallel so one failure doesn't block others
      const loadProducts = async () => {
        try {
          const remoteProducts = await ApiService.fetchProducts();
          if (remoteProducts !== null) {
              setProducts(remoteProducts);
          } else {
              console.error("Failed to load products: Server returned null");
              setProductsError(true);
          }
        } catch (e) { 
            console.error("Failed to load products", e); 
            setProductsError(true);
        }
      };

      const loadQuotes = async () => {
        try {
          const remoteQuotes = await ApiService.fetchQuotes();
          if (remoteQuotes !== null) {
              setQuotes(remoteQuotes);
          } else {
              console.error("Failed to load quotes: Server returned null");
              setQuotesError(true);
          }
        } catch (e) { 
            console.error("Failed to load quotes", e); 
            setQuotesError(true);
        }
      };

      const loadOrders = async () => {
        try {
          const remoteOrders = await ApiService.fetchOrders();
          if (remoteOrders !== null) {
              setOrders(remoteOrders);
          } else {
              console.error("Failed to load orders: Server returned null");
              setOrdersError(true);
          }
        } catch (e) { 
            console.error("Failed to load orders", e); 
            setOrdersError(true);
        }
      };

      const loadCustomers = async () => {
        try {
          const remoteCustomers = await ApiService.fetchCustomers();
          if (remoteCustomers !== null) {
              setCustomers(remoteCustomers);
          } else {
              console.error("Failed to load customers: Server returned null");
              setCustomersError(true);
          }
        } catch (e) { 
            console.error("Failed to load customers", e); 
            setCustomersError(true);
        }
      };

      const syncUser = async () => {
        try {
          // 同步最新的用户信息 (防止本地存储过期)
          const users = await ApiService.getUsers();
          const updatedUser = users.find(u => u.username === currentUser?.username);
          if (updatedUser && JSON.stringify(updatedUser) !== JSON.stringify(currentUser)) {
             handleUpdateUser(updatedUser);
          }
        } catch (e) { console.error("Failed to sync user profile", e); }
      };

      // Execute all loading tasks in parallel
      await Promise.all([
        loadProducts(),
        loadQuotes(),
        loadOrders(),
        loadCustomers(),
        syncUser()
      ]);
    };
    if (currentUser) init();
  }, [currentUser?.username]); // Only re-run if username changes (or on mount if user exists)

  const getWeekNumber = (d: Date) => {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  };

  const handleSaveQuote = async (q: Quote) => {
    if (quotesError) {
        alert("无法保存报价单：数据加载失败。请刷新页面重试，以防止数据丢失。");
        return;
    }
    
    let updated;
    const exists = quotes.some(existing => existing.id === q.id);
    if (exists) {
        updated = quotes.map(existing => existing.id === q.id ? q : existing);
    } else {
        updated = [q, ...quotes];
    }
    
    // Prevent data loss: Save before switching view
    await ApiService.saveQuotes(updated);
    setQuotes(updated);
    navigate('/quotes');
  };

  const handleSaveOrder = async (o: SalesOrder) => {
    if (ordersError) {
        alert("无法保存订单：数据加载失败。请刷新页面重试，以防止数据丢失。");
        return;
    }

    let updated;
    const exists = orders.some(existing => existing.id === o.id);
    if (exists) {
      updated = orders.map(existing => existing.id === o.id ? o : existing);
    } else {
      updated = [o, ...orders];
    }
    // Prevent data loss: Save before switching view
    await ApiService.saveOrders(updated);
    setOrders(updated);
    navigate('/orders');
  };

  const handleDeleteQuote = async (id: string) => {
    const updated = quotes.filter(q => q.id !== id);
    setQuotes(updated);
    await ApiService.saveQuotes(updated);
  };

  const handleBatchDeleteQuotes = async (ids: string[]) => {
    if (!window.confirm(`确定要删除选中的 ${ids.length} 条报价单吗？`)) return;
    const updated = quotes.filter(q => !ids.includes(q.id));
    setQuotes(updated);
    await ApiService.saveQuotes(updated);
  };

  const handleBatchDeleteQuoteItems = async (itemIds: string[]) => {
      if (!window.confirm(`确定要删除选中的 ${itemIds.length} 条报价明细吗？如果某个报价单的所有明细都被删除，该报价单也将被删除。`)) return;
      
      let updatedQuotes = quotes.map(q => {
          // Filter out deleted items
          const newItems = (q.items || []).filter(item => !itemIds.includes(item.id));
          
          // Recalculate totals
          const totalAmount = newItems.reduce((sum, item) => sum + Math.round(item.salesPrice) * item.moq, 0);
          const totalProfit = newItems.reduce((sum, item) => sum + (item.profit * item.moq), 0);
          const weightedMargin = totalAmount > 0 ? totalProfit / totalAmount : 0;

          return {
              ...q,
              items: newItems,
              totalAmount,
              totalProfit,
              avgMargin: weightedMargin
          };
      });

      // Remove quotes with no items left
      updatedQuotes = updatedQuotes.filter(q => q.items.length > 0);

      setQuotes(updatedQuotes);
      await ApiService.saveQuotes(updatedQuotes);
  };

  const handleDeleteOrder = async (id: string) => {
    if (!window.confirm('确定要删除这个订单吗？')) return;
    const updated = orders.filter(o => o.id !== id);
    setOrders(updated);
    await ApiService.saveOrders(updated);
  };

  if (!currentUser) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={handleSetUser} logo={logoPath} />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const menuItems: MenuItem[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: '概览', path: '/dashboard' },
    { 
      id: 'orders', 
      icon: ShoppingCart, 
      label: '销售订单', 
      path: '/orders',
      children: [
        { label: '订单列表', path: '/orders/list', icon: ListIcon },
        { label: '新建订单', path: '/orders/new', icon: PlusCircle }
      ]
    },
    { id: 'products', icon: Package, label: '产品库', path: '/products' },
    { id: 'customers', icon: Users, label: '客户管理', path: '/customers' },
    { 
      id: 'quotes', 
      icon: FileText, 
      label: '报价管理', 
      path: '/quotes',
      children: [
        { label: '报价记录', path: '/quotes/list', icon: ListIcon },
        { label: '新建报价', path: '/quotes/new', icon: PlusCircle }
      ]
    },
  ];

  const workspaceMeta = useMemo(() => {
    if (location.pathname.startsWith('/products')) {
      return { title: '产品主数据工作台', subtitle: '统一管理系列、工厂料号、成本年度档案与导入导出。' };
    }
    if (location.pathname.startsWith('/quotes/new')) {
      return { title: '报价编制中心', subtitle: '围绕客户、计价模式、利润核算完成一笔标准业务报价。' };
    }
    if (location.pathname.startsWith('/quotes/edit')) {
      return { title: '报价修订中心', subtitle: '在原始报价基础上校正价格、数量和利润参数。' };
    }
    if (location.pathname.startsWith('/quotes')) {
      return { title: '报价管理中心', subtitle: '聚合历史报价、预览、导出和订单流转。' };
    }
    if (location.pathname.startsWith('/orders')) {
      return { title: '订单执行中心', subtitle: '跟踪订单状态、交付节点与回款进度。' };
    }
    if (location.pathname.startsWith('/customers')) {
      return { title: '客户经营中心', subtitle: '维护客户档案、阶段信息与后续行动计划。' };
    }
    if (location.pathname.startsWith('/users')) {
      return { title: '账号权限管理', subtitle: '维护账号权限、密码重置和人员基础资料。' };
    }
    if (location.pathname.startsWith('/profile')) {
      return { title: '个人工作设置', subtitle: '更新个人资料、密码与常用配置。' };
    }
    return { title: '经营概览驾驶舱', subtitle: '集中查看报价、订单、产品与客户的经营状态。' };
  }, [location.pathname]);

  return (
    <div className="erp-shell flex h-screen overflow-hidden text-sm text-slate-800">
      <aside className={`hidden lg:flex flex-col bg-[linear-gradient(180deg,#102238_0%,#132b33_42%,#102238_100%)] transition-all duration-500 border-r border-white/10 relative z-40 ${isSidebarOpen ? 'w-72' : 'w-24'}`}>
        <div className="p-8"><div className="bg-white rounded-[1.5rem] h-14 p-3 flex items-center justify-center overflow-hidden shadow-xl shadow-blue-900/20"><img src={logoPath} alt="KEBOS" className="max-h-full object-contain" /></div></div>
        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto no-scrollbar pb-10">
          {menuItems.map(item => <SidebarItem key={item.id} item={item} isSidebarOpen={isSidebarOpen} />)}
          
          <div className="pt-4 mt-4 border-t border-white/5">
            <NavLink to="/profile" className={({ isActive }) => `w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
              <UserIcon size={20} />
              {isSidebarOpen && <span className="font-bold tracking-tight">个人设置</span>}
            </NavLink>

            {currentUser.role === 'admin' && (
              <NavLink to="/users" className={({ isActive }) => `w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
                <Lock size={20} />
                {isSidebarOpen && <span className="font-bold tracking-tight">账号管理</span>}
              </NavLink>
            )}
          </div>
          {isSidebarOpen && (<div className="mt-10 px-2 space-y-4 animate-in fade-in slide-in-from-left duration-700">
            <div className="p-5 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-md"><div className="flex items-center justify-between mb-3"><span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Business Time</span><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /></div><div className="text-2xl font-black text-white tracking-tighter tabular-nums mb-1">{currentTime.toLocaleTimeString('zh-CN', { hour12: false })}</div><div className="flex items-center justify-between text-[10px] text-slate-500 font-bold"><span>Week {getWeekNumber(currentTime)}</span><span>{currentTime.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</span></div></div>
            <WindowsCalendar /><Scratchpad />
          </div>)}
        </nav>
        <div className="p-8 shrink-0"><button onClick={() => handleSetUser(null)} className="w-full flex items-center gap-3 px-5 py-4 text-slate-500 hover:text-rose-500 transition-all font-bold"><LogOut size={20} />{isSidebarOpen && <span>退出系统</span>}</button></div>
      </aside>

      <div className="flex-1 flex flex-col min-0 overflow-hidden relative">
        <header className="lg:hidden bg-white/90 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between z-30 shrink-0 sticky top-0 shadow-sm"><div className="flex items-center gap-3"><div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black">K</div><div><h2 className="text-sm font-black text-slate-900 tracking-tighter uppercase leading-none">SmartQuote</h2><p className="text-[8px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Global ERP</p></div></div><button onClick={() => navigate('/profile')} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-blue-600 font-black text-xs">{currentUser.username[0].toUpperCase()}</button></header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-28 lg:pb-10 no-print no-scrollbar bg-transparent">
          <div className="w-full mx-auto space-y-6">
            <section className="hidden lg:flex items-center justify-between rounded-[2rem] px-7 py-5 erp-panel">
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#0f5f5b]">SmartQuote ERP Workspace</p>
                <h1 className="erp-title text-[28px] font-black text-slate-900">{workspaceMeta.title}</h1>
                <p className="text-sm erp-muted max-w-2xl">{workspaceMeta.subtitle}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="erp-kpi-card rounded-[1.5rem] px-4 py-3 min-w-[170px]">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">当前操作人</div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#0f5f5b] text-white flex items-center justify-center font-black">
                      {currentUser.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900">{currentUser.realName || currentUser.username}</div>
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.18em]">{currentUser.role}</div>
                    </div>
                  </div>
                </div>
                <div className="erp-kpi-card rounded-[1.5rem] px-4 py-3 min-w-[170px]">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">系统时间</div>
                  <div className="mt-2 text-2xl font-black tracking-tight text-slate-900 tabular-nums">
                    {currentTime.toLocaleTimeString('zh-CN', { hour12: false })}
                  </div>
                  <div className="text-[11px] font-bold text-slate-500">{currentTime.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
              </div>
            </section>
            <div className="w-full mx-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard products={products} quotes={quotes} orders={orders} onNavigate={(view) => {
                // Map legacy view names to paths if needed, or update Dashboard to pass paths
                const pathMap: Record<string, string> = { 'quotes': '/quotes', 'orders': '/orders', 'new-quote': '/quotes/new', 'products': '/products' };
                navigate(pathMap[view] || '/dashboard');
              }} onClearQuotes={() => {}} />} />
              <Route path="/products" element={<ProductList products={products} logs={[]} onBulkAdd={async p => { const u = [...products, ...p]; setProducts(u); await ApiService.saveProducts(u); }} onDelete={async id => { const u = products.filter(p => p.id !== id); setProducts(u); await ApiService.saveProducts(u); }} onUpdate={async p => { const u = products.map(x => x.id === p.id ? p : x); setProducts(u); await ApiService.saveProducts(u); }} onAdd={async p => { const u = [...products, p]; setProducts(u); await ApiService.saveProducts(u); }} onBatchImport={async (newProds, updatedProds) => {
                let current = [...products];
                if (updatedProds.length > 0) {
                  const updateMap = new Map(updatedProds.map(p => [p.id, p]));
                  current = current.map(p => updateMap.get(p.id) || p);
                }
                if (newProds.length > 0) {
                  current = [...current, ...newProds];
                }
                setProducts(current);
                await ApiService.saveProducts(current);
              }} />} />
              <Route path="/customers" element={<CustomerList customers={customers} isError={customersError} onAdd={async c => {
                if (customersError) { alert("服务器连接异常，无法保存数据"); return; }
                const u = [...customers, c];
                setCustomers(u);
                await ApiService.saveCustomers(u);
              }} onUpdate={async (id, c) => {
                if (customersError) { alert("服务器连接异常，无法保存数据"); return; }
                const u = customers.map(x => x.id === id ? c : x);
                setCustomers(u);
                await ApiService.saveCustomers(u);
              }} onDelete={async id => {
                if (customersError) { alert("服务器连接异常，无法保存数据"); return; }
                const u = customers.filter(x => x.id !== id);
                setCustomers(u);
                await ApiService.saveCustomers(u);
              }} onBulkAdd={async (newCustomers) => {
                if (customersError) { alert("服务器连接异常，无法保存数据"); return; }
                // Merge logic: Update existing by companyName, add new ones
                let updatedList = [...customers];
                const existingMap = new Map(updatedList.map(c => [c.companyName.trim().toLowerCase(), c]));
                
                newCustomers.forEach(nc => {
                    const key = nc.companyName.trim().toLowerCase();
                    if (existingMap.has(key)) {
                        // Update existing
                        const existing = existingMap.get(key)!;
                        const merged = { ...existing, ...nc, id: existing.id, updatedAt: new Date().toISOString() };
                        updatedList = updatedList.map(c => c.id === existing.id ? merged : c);
                    } else {
                        // Add new
                        updatedList.push(nc);
                    }
                });
                
                setCustomers(updatedList);
                await ApiService.saveCustomers(updatedList);
              }} />} />
              <Route path="/quotes" element={<Navigate to="/quotes/list" replace />} />
              <Route path="/quotes/list" element={<QuoteList quotes={quotes} products={products} customers={customers} onDelete={handleDeleteQuote} onBatchDelete={handleBatchDeleteQuoteItems} onPreview={(q, item) => { setGlobalPreviewQuote(q); setGlobalPreviewItem(item || null); }} onImport={async (qs) => { const u = [...qs, ...quotes]; setQuotes(u); await ApiService.saveQuotes(u); }} onCreateOrder={(q) => { navigate('/orders/new', { state: { initialQuote: q } }); }} onEdit={(q) => { navigate('/quotes/edit', { state: { initialQuote: q } }); }} />} />
              <Route path="/quotes/new" element={<QuoteForm products={products} quotes={quotes} onSave={handleSaveQuote} onCancel={() => navigate('/quotes/list')} onPreview={(q) => { setGlobalPreviewQuote(q); setGlobalPreviewItem(null); }} />} />
              <Route path="/quotes/edit" element={<QuoteFormWrapper products={products} quotes={quotes} onSave={handleSaveQuote} onCancel={() => navigate('/quotes/list')} onPreview={(q) => { setGlobalPreviewQuote(q); setGlobalPreviewItem(null); }} />} />
              <Route path="/orders" element={<Navigate to="/orders/list" replace />} />
              <Route path="/orders/list" element={<OrderList orders={orders} onViewOrder={(o) => { navigate('/orders/edit', { state: { initialOrder: o } }); }} onCreateOrder={() => { navigate('/orders/new'); }} onDelete={handleDeleteOrder} />} />
              <Route path="/orders/new" element={<OrderFormWrapper currentUser={currentUser} products={products} quotes={quotes} orders={orders} customers={customers} onSave={handleSaveOrder} onCancel={() => navigate('/orders/list')} />} />
              <Route path="/orders/edit" element={<OrderFormWrapper currentUser={currentUser} products={products} quotes={quotes} orders={orders} customers={customers} onSave={handleSaveOrder} onCancel={() => navigate('/orders/list')} />} />
              <Route path="/users" element={<UserManagement />} />
              <Route path="/profile" element={<ProfileSettings user={currentUser} onUserUpdated={handleUpdateUser} />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            </div>
          </div>
        </main>
        
        {/* Mobile Navigation Bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 flex items-center justify-around pb-safe pt-3 pb-3 px-2 z-50 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
          {menuItems.map(item => {
            if (item.children) {
              const isActive = location.pathname.startsWith(item.path);
              const [showSubmenu, setShowSubmenu] = useState(false);
              
              return (
                <div key={item.id} className="relative">
                  {showSubmenu && (
                    <>
                      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-10" onClick={() => setShowSubmenu(false)} />
                      <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 min-w-[140px] z-20 animate-in slide-in-from-bottom-5 fade-in duration-200 flex flex-col gap-1">
                        {item.children.map(child => (
                          <NavLink
                            key={child.path}
                            to={child.path}
                            onClick={() => setShowSubmenu(false)}
                            className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-600 hover:bg-slate-50'}`}
                          >
                            {child.icon && <child.icon size={16} />}
                            <span>{child.label}</span>
                          </NavLink>
                        ))}
                        <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 border-b border-r border-slate-100"></div>
                      </div>
                    </>
                  )}
                  <button
                    onClick={() => setShowSubmenu(!showSubmenu)}
                    className={`relative flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-95 ${isActive ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:bg-slate-50'} ${showSubmenu ? 'z-30 bg-white shadow-lg ring-1 ring-slate-100' : ''}`}
                  >
                    <item.icon size={20} className={isActive ? "stroke-[2.5px]" : "stroke-2"} />
                    <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
                  </button>
                </div>
              );
            }

            return (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) => `flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-95 ${isActive ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:bg-slate-50'}`}
              >
                <item.icon size={20} className={({ isActive }: any) => isActive ? "stroke-[2.5px]" : "stroke-2"} />
                <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
              </NavLink>
            );
          })}
          {currentUser.role === 'admin' && (
            <NavLink
              to="/users"
              className={({ isActive }) => `flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-95 ${isActive ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <Users size={20} className={({ isActive }: any) => isActive ? "stroke-[2.5px]" : "stroke-2"} />
              <span className="text-[10px] font-bold tracking-tight">管理</span>
            </NavLink>
          )}
        </nav>
      </div>
      {globalPreviewQuote && <QuoteDetailModal quote={globalPreviewQuote} item={globalPreviewItem} onClose={() => { setGlobalPreviewQuote(null); setGlobalPreviewItem(null); }} logo={logoPath} onEdit={(q) => { setGlobalPreviewQuote(null); setGlobalPreviewItem(null); navigate('/quotes/edit', { state: { initialQuote: q } }); }} />}
      {customersError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="bg-white p-8 rounded-2xl shadow-2xl border border-rose-100 text-center max-w-md mx-4 animate-in zoom-in-95">
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <LogOut size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">连接服务器失败</h3>
                <p className="text-slate-500 mb-6 font-medium">无法加载客户数据。为防止数据丢失，系统已暂时锁定写入功能。</p>
                <button onClick={() => window.location.reload()} className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95">
                    重新加载页面
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

// Wrapper component to handle location state for QuoteForm
const QuoteFormWrapper: React.FC<any> = (props) => {
  const location = useLocation();
  const state = location.state as { initialQuote?: Quote } | null;
  
  return (
    <QuoteForm 
      {...props} 
      initialQuote={state?.initialQuote} 
    />
  );
};

// Wrapper component to handle location state for OrderForm
const OrderFormWrapper: React.FC<any> = (props) => {
  const location = useLocation();
  const state = location.state as { initialOrder?: SalesOrder; initialQuote?: Quote } | null;
  
  return (
    <OrderForm 
      {...props} 
      initialOrder={state?.initialOrder} 
      initialQuote={state?.initialQuote} 
    />
  );
};

export default App;

