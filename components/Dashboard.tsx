
import React, { useMemo } from 'react';
import { TrendingUp, Users, Package, Wallet, FileText, AlertTriangle, Trash2, ArrowUpRight, Activity, Truck, CheckCircle, Clock, XCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, AreaChart, Area } from 'recharts';
import { Product, Quote, SalesOrder, View } from '../types';
import { formatCurrency, formatPercent } from '../utils';

interface DashboardProps {
  products: Product[];
  quotes: Quote[];
  orders: SalesOrder[];
  onClearQuotes: () => void;
  onNavigate: (view: View) => void;
}

const StatCard = ({ title, value, icon: Icon, color, trend, onClick }: any) => (
  <div 
    onClick={onClick}
    className={`bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-xl hover:scale-[1.01] transition-all group overflow-hidden relative ${onClick ? 'cursor-pointer' : ''}`}
  >
    <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
       <Icon size={120} />
    </div>
    <div className="relative z-10">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{title}</p>
        {trend && <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-lg flex items-center gap-0.5"><ArrowUpRight size={10}/> {trend}</span>}
      </div>
      <h3 className="text-3xl font-bold text-slate-900 tracking-tighter leading-none">{value}</h3>
    </div>
    <div className={`p-3 rounded-xl ${color} shadow-lg shadow-current/20 relative z-10`}>
      <Icon className="text-white" size={20} />
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ products, quotes, orders, onClearQuotes, onNavigate }) => {
  const getColorDotClass = (name: string) => {
    const colorMap: Record<string, string> = {
      '待处理': 'bg-amber-500',
      '生产中': 'bg-blue-500',
      '已发货': 'bg-indigo-500',
      '已完成': 'bg-emerald-500',
      '已取消': 'bg-slate-300',
      '低利润': 'bg-rose-500',
      '中利润': 'bg-amber-500',
      '高利润': 'bg-emerald-500',
    };
    return colorMap[name] || 'bg-slate-400';
  };

  const stats = useMemo(() => {
    const totalOrders = (orders || []).length;
    
    let totalSalesUSD = 0;
    let totalProfitUSD = 0;
    
    // Calculate total profit from ORDERS (Realized Profit)
    (orders || []).forEach((order) => {
        // Normalize amount to USD for aggregation
        const exchangeRate = order.exchangeRate || 7.1; // Fallback rate
        const isRMB = order.currency === 'RMB';
        
        const orderSalesUSD = isRMB ? (order.totalAmount || 0) / exchangeRate : (order.totalAmount || 0);
        totalSalesUSD += orderSalesUSD;
        
        let currentProfit = order.totalProfit;
        
        // If profit is missing, calculate it on the fly
        if (currentProfit === undefined || currentProfit === 0) {
           currentProfit = order.items.reduce((sum, item) => {
             if (item.itemType === 'FOC') return sum;
             
             let cost = item.costPrice;
             if (cost === undefined || cost === 0) {
               const product = products.find(p => p.id === item.productId || p.kebosModel === item.kebosModel);
               if (product && product.yearlyCosts) {
                  const orderYear = new Date(order.createdAt).getFullYear();
                  const costObj = product.yearlyCosts[orderYear] || product.yearlyCosts[new Date().getFullYear()];
                  if (costObj) {
                    cost = order.currency === 'USD' ? costObj.usd : costObj.rmb;
                  }
               }
             } else {
                // 智能修正：检查是否存在 RMB 订单存储了 USD 成本的情况
                if (order.currency === 'RMB') {
                   const product = products.find(p => p.id === item.productId || p.kebosModel === item.kebosModel);
                   if (product && product.yearlyCosts) {
                      const orderYear = new Date(order.createdAt).getFullYear();
                      const costObj = product.yearlyCosts[orderYear] || product.yearlyCosts[new Date().getFullYear()];
                      
                      if (costObj && costObj.usd > 0) {
                          // 如果存储的成本非常接近 USD 标准成本 (误差15%以内)，但远小于 RMB 标准成本
                          // 则判定为存错了币种，自动进行汇率修正
                          const isCloseToUsd = Math.abs(cost - costObj.usd) < (costObj.usd * 0.15);
                          const isFarFromRmb = Math.abs(cost - costObj.rmb) > (costObj.rmb * 0.5);
                          
                          if (isCloseToUsd && isFarFromRmb) {
                              const rate = order.exchangeRate || 7.1;
                              cost = cost * rate;
                          }
                      }
                   }
                }
             }
             
             cost = cost || 0;
             return sum + ((item.unitPrice || 0) - cost) * (item.quantity || 0);
           }, 0);
        }
        
        const orderProfitUSD = isRMB ? (currentProfit || 0) / exchangeRate : (currentProfit || 0);
        totalProfitUSD += orderProfitUSD;
    });

    // Calculate weighted average margin (Total Profit / Total Sales)
    const avgMargin = totalSalesUSD > 0 ? totalProfitUSD / totalSalesUSD : 0;

    return { totalOrders, avgMargin, totalProfit: totalProfitUSD };
  }, [orders, products]);

  const dashboardSummary = useMemo(() => {
    const pendingOrders = (orders || []).filter(order => order.status === 'Pending' || order.status === 'Production').length;
    const completedOrders = (orders || []).filter(order => order.status === 'Completed').length;
    const activeQuotes = (quotes || []).length;
    const productCoverage = products.filter(product => !!product.factoryPartNumber).length;
    return { pendingOrders, completedOrders, activeQuotes, productCoverage };
  }, [orders, quotes, products]);

  // 1. Sales Trend Data (Monthly)
  const salesTrendData = useMemo(() => {
    const monthlyData = new Map<string, { name: string; sales: number; profit: number; orderCount: number }>();
    
    // Initialize last 12 months with 0 values
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyData.set(key, { name: key, sales: 0, profit: 0, orderCount: 0 });
    }
    
    (orders || []).forEach(order => {
      if (!order.createdAt) return;
      const date = new Date(order.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (monthlyData.has(key)) {
        const entry = monthlyData.get(key)!;
        
        // Normalize sales amount to USD
        const exchangeRate = order.exchangeRate || 7.1; // Fallback rate
        const isRMB = order.currency === 'RMB';
        
        const orderSalesUSD = isRMB ? (order.totalAmount || 0) / exchangeRate : (order.totalAmount || 0);
        entry.sales += orderSalesUSD;
        
        // 智能利润计算：如果订单中没有存储利润，则尝试实时计算
        let currentProfit = order.totalProfit;
        
        if (currentProfit === undefined || currentProfit === 0) {
           // 实时计算利润
           currentProfit = order.items.reduce((sum, item) => {
             if (item.itemType === 'FOC') return sum;
             
             let cost = item.costPrice;
             // 如果 Item 也没有成本，尝试从产品库查找标准成本
             if (cost === undefined || cost === 0) {
               const product = products.find(p => p.id === item.productId || p.kebosModel === item.kebosModel);
               if (product && product.yearlyCosts) {
                  const orderYear = new Date(order.createdAt).getFullYear();
                  const costObj = product.yearlyCosts[orderYear] || product.yearlyCosts[today.getFullYear()];
                  if (costObj) {
                    cost = order.currency === 'USD' ? costObj.usd : costObj.rmb;
                  }
               }
             } else {
                // 智能修正：检查是否存在 RMB 订单存储了 USD 成本的情况
                if (order.currency === 'RMB') {
                   const product = products.find(p => p.id === item.productId || p.kebosModel === item.kebosModel);
                   if (product && product.yearlyCosts) {
                      const orderYear = new Date(order.createdAt).getFullYear();
                      const costObj = product.yearlyCosts[orderYear] || product.yearlyCosts[today.getFullYear()];
                      
                      if (costObj && costObj.usd > 0) {
                          // 如果存储的成本非常接近 USD 标准成本 (误差15%以内)，但远小于 RMB 标准成本
                          // 则判定为存错了币种，自动进行汇率修正
                          const isCloseToUsd = Math.abs(cost - costObj.usd) < (costObj.usd * 0.15);
                          const isFarFromRmb = Math.abs(cost - costObj.rmb) > (costObj.rmb * 0.5);
                          
                          if (isCloseToUsd && isFarFromRmb) {
                              const rate = order.exchangeRate || 7.1;
                              cost = cost * rate;
                          }
                      }
                   }
                }
             }
             
             cost = cost || 0;
             return sum + ((item.unitPrice || 0) - cost) * (item.quantity || 0);
           }, 0);
        }

        const orderProfitUSD = isRMB ? (currentProfit || 0) / exchangeRate : (currentProfit || 0);
        entry.profit += orderProfitUSD;
        
        entry.orderCount += 1;
      }
    });

    return Array.from(monthlyData.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orders, products]);

  // 2. Order Status Distribution
  const orderStatusData = useMemo(() => {
    const statusCounts: Record<string, number> = {
      'Pending': 0,
      'Production': 0,
      'Shipped': 0,
      'Completed': 0,
      'Cancelled': 0
    };

    (orders || []).forEach(o => {
      if (statusCounts[o.status] !== undefined) {
        statusCounts[o.status]++;
      } else {
        // Fallback for unknown statuses
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
      }
    });

    const config: Record<string, { label: string; color: string }> = {
      'Pending': { label: '待处理', color: '#f59e0b' },      // Amber
      'Production': { label: '生产中', color: '#3b82f6' },   // Blue
      'Shipped': { label: '已发货', color: '#6366f1' },      // Indigo
      'Completed': { label: '已完成', color: '#10b981' },    // Emerald
      'Cancelled': { label: '已取消', color: '#cbd5e1' },    // Slate
    };

    return Object.entries(statusCounts)
      .filter(([_, value]) => value > 0)
      .map(([key, value]) => ({
        name: config[key]?.label || key,
        value,
        color: config[key]?.color || '#94a3b8'
      }));
  }, [orders]);

  const barData = useMemo(() => {
    return (quotes || []).slice(0, 10).reverse().map(q => ({
      name: (q.customer || '未知').length > 6 ? q.customer.substring(0, 6) + '..' : q.customer,
      fullName: q.customer || '未知',
      profit: Math.round(q.totalProfit || 0),
      date: new Date(q.date).toLocaleDateString()
    }));
  }, [quotes]);

  const pieData = useMemo(() => {
    const groups = [
      { name: '低利润', value: 0, color: '#f43f5e' },
      { name: '中利润', value: 0, color: '#f59e0b' },
      { name: '高利润', value: 0, color: '#10b981' },
    ];
    (quotes || []).forEach(q => {
      const m = q.avgMargin || 0;
      if (m < 0.1) groups[0].value++;
      else if (m < 0.25) groups[1].value++;
      else groups[2].value++;
    });
    return groups.filter(g => g.value > 0);
  }, [quotes]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 backdrop-blur-xl p-4 rounded-xl shadow-2xl border border-white/20 ring-1 ring-slate-100">
          <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">{payload[0].payload.date || payload[0].payload.name}</p>
          <p className="text-sm font-bold text-slate-700 mb-2">{payload[0].payload.fullName || payload[0].payload.name}</p>
          <div className="flex items-center gap-2">
            <div className="w-1 h-8 rounded-full bg-blue-500"></div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">{payload[0].name === 'profit' ? 'Profit' : 'Value'}</p>
              <p className="text-xl font-bold text-blue-600 flex items-baseline gap-0.5">
                {payload[0].name === 'profit' && <span className="text-xs text-slate-400">$</span>}
                {typeof payload[0].value === 'number' ? formatCurrency(payload[0].value).replace('$', '') : payload[0].value}
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const TrendTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 backdrop-blur-xl p-4 rounded-xl shadow-2xl border border-white/20 ring-1 ring-slate-100 min-w-[150px]">
          <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">{label}</p>
          <div className="space-y-3">
             <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"/> Total Sales</p>
                <p className="text-lg font-black text-slate-800">{formatCurrency(payload[0].value)}</p>
             </div>
             <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/> Net Profit</p>
                <p className="text-lg font-black text-slate-800">{formatCurrency(payload[1].value)}</p>
             </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-10 px-1">
      <section className="erp-panel rounded-[2rem] px-5 py-6 md:px-8 md:py-7 space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0f5f5b]/10 text-[#0f5f5b] text-[11px] font-black uppercase tracking-[0.24em]">
              <Activity size={14} />
              Executive Dashboard
            </div>
            <div>
              <h1 className="erp-title text-3xl font-black text-slate-900 tracking-tight">经营驾驶舱</h1>
              <p className="text-sm text-slate-500 max-w-3xl mt-2">把订单、报价、利润和产品主数据放进同一个视图里，先帮助销售和管理者做判断，再引导他们进入下一步动作。</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
            <button onClick={() => onNavigate('orders')} className="px-5 py-4 rounded-[1.2rem] bg-[#0f5f5b] text-white font-black text-sm shadow-xl shadow-[#0f5f5b]/20 hover:bg-[#0d504d] transition-all">
              查看订单执行
            </button>
            <button onClick={onClearQuotes} className="px-5 py-4 rounded-[1.2rem] bg-rose-50 text-rose-600 font-black text-sm border border-rose-100 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center gap-2">
              <Trash2 size={16}/> 初始化存储
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">待执行订单</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{dashboardSummary.pendingOrders}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">状态含待处理与生产中</div>
          </div>
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">已完成订单</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{dashboardSummary.completedOrders}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">可用于评估交付闭环</div>
          </div>
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">在管报价</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{dashboardSummary.activeQuotes}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">当前系统中的报价记录总数</div>
          </div>
          <div className="erp-kpi-card rounded-[1.5rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">料号覆盖</div>
            <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{dashboardSummary.productCoverage}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">已维护工厂料号的产品数</div>
          </div>
        </div>
      </section>

      {/* Stats Cards: One column on mobile, two on small screens, four on large */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          title="累计成交笔数" 
          value={stats.totalOrders} 
          icon={FileText} 
          color="bg-blue-600" 
          trend="12%" 
          onClick={() => onNavigate('orders')}
        />
        <StatCard title="平均成交毛利" value={formatPercent(stats.avgMargin)} icon={TrendingUp} color="bg-emerald-500" />
        <StatCard title="累计成交利润" value={formatCurrency(stats.totalProfit)} icon={Wallet} color="bg-indigo-600" />
        <StatCard 
          title="系统在库型号" 
          value={products.length} 
          icon={Package} 
          color="bg-amber-500" 
          onClick={() => onNavigate('products')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Sales Trend Chart (New) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm min-h-[360px] flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <Activity size={160} />
          </div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><Activity size={18}/></div>
              销售趋势分析 (Sales Trend)
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last 12 Months</span>
          </div>
          <div className="flex-1 w-full min-h-[250px] relative z-10">
            {salesTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrendData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProfitTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} 
                  />
                  <Tooltip cursor={{fill: '#f8fafc', radius: 12}} content={<TrendTooltip />} />
                  <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                  <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfitTrend)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex flex-col items-center justify-center text-slate-400 italic text-xs border-2 border-dashed border-slate-100 rounded-2xl">暂无销售数据</div>}
          </div>
        </div>

        {/* 2. Order Status Distribution (New) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-3">
             <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Clock size={20}/></div>
             订单状态分布
          </h3>
          <div className="flex-1 w-full min-h-[200px]">
            {orderStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={orderStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value" stroke="none">
                    {orderStatusData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '12px', border: 'none', fontWeight: 700}} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex flex-col items-center justify-center text-slate-400 italic text-xs">暂无订单数据</div>}
          </div>
          <div className="mt-6 space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
            {orderStatusData.map((group: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-all">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getColorDotClass(group.name)}`} />
                  <span className="text-xs font-bold text-slate-600">{group.name}</span>
                </div>
                <span className="text-xs font-black text-slate-900">{group.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Recent Profit Chart (Existing) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm min-h-[360px] flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <TrendingUp size={160} />
          </div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><TrendingUp size={18}/></div>
              近期报价利润 (Quote Profit)
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last 10 Records</span>
          </div>
          <div className="flex-1 w-full min-h-[250px] relative z-10">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} barSize={30}>
                  <defs>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0.6}/>
                    </linearGradient>
                    <linearGradient id="colorProfitLast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} 
                  />
                  <Tooltip cursor={{fill: '#f8fafc', radius: 12}} content={<CustomTooltip />} />
                  <Bar dataKey="profit" radius={[8, 8, 8, 8]}>
                    {barData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === barData.length - 1 ? "url(#colorProfitLast)" : "url(#colorProfit)"} 
                        style={{ filter: 'drop-shadow(0px 4px 6px rgba(79, 70, 229, 0.2))' }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex flex-col items-center justify-center text-slate-400 italic text-xs border-2 border-dashed border-slate-100 rounded-2xl">等待第一笔数据生成...</div>}
          </div>
        </div>

        {/* 利润健康分布 */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-3">
             <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><AlertTriangle size={20}/></div>
             分布状况
          </h3>
          <div className="flex-1 w-full min-h-[200px]">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none">
                    {pieData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '12px', border: 'none', fontWeight: 700}} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex flex-col items-center justify-center text-slate-400 italic text-xs">数据统计中...</div>}
          </div>
          <div className="mt-6 space-y-2">
            {pieData.map((group: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${getColorDotClass(group.name)}`} />
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">{group.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded-lg shadow-sm border border-slate-100">{group.value} 笔</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;



