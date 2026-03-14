
import React, { useState, useMemo, useEffect } from 'react';
import { Save, X, Plus, Trash2, Calendar, DollarSign, RefreshCw, FileText, CheckCircle, Package, Link as LinkIcon, Eye, AlertTriangle, ArrowUp, ArrowDown, User as UserIcon, Phone, Mail, MapPin } from 'lucide-react';
import { SalesOrder, OrderItem, Product, Quote, OrderStatus, PaymentStatus, OrderItemType, User, Customer } from '../types';
import { formatCurrency, getCountryCode } from '../utils';
import QuoteDetailModal from './QuoteDetailModal';

interface OrderFormProps {
  currentUser: User | null;
  initialOrder?: SalesOrder | null;
  initialQuote?: Quote | null; // 从报价单转入时使用
  products: Product[];
  quotes: Quote[];
  orders: SalesOrder[]; // 用于生成 PO 号序列
  customers?: Customer[];
  onSave: (order: SalesOrder) => void;
  onCancel: () => void;
}

const OrderForm: React.FC<OrderFormProps> = ({ currentUser, initialOrder, initialQuote, products, quotes, orders, customers = [], onSave, onCancel }) => {
  const [previewQuoteId, setPreviewQuoteId] = useState<string | null>(null);
  
  // 生成新订单号
  // 规则: KB + 日期(8位) + 国家(2位) + 业务员(3位) + _ + 客户序号(3位) + _ + 订单序号(4位)
  // 示例: KB20260124CN001_001_0001
  const generateOrderId = (selectedCustomer?: Customer, overrideName?: string) => {
    const now = new Date();
    const dateStr = now.getFullYear().toString() + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0');
    
    // Helper: 解析客户国家代码
    const resolveCode = (c?: Customer): string => {
        if (!c) return 'CN';
        // 1. 优先使用客户信息中录入的国家字段
        if (c.country) {
            const code = getCountryCode(c.country);
            if (code && code !== 'XX') return code;
        }
        // 2. 回退：根据地址推断
        if (c.address) {
           const addr = c.address.toLowerCase();
           if (addr.includes('usa') || addr.includes('united states') || addr.includes('美国')) return 'US';
           if (addr.includes('uk') || addr.includes('united kingdom') || addr.includes('英国')) return 'GB';
           if (addr.includes('russia') || addr.includes('俄罗斯')) return 'RU';
        }
        return 'CN';
    };

    // 1. 获取国家代码
    let countryCode = resolveCode(selectedCustomer);
    
    // 如果没有选中客户但有手动输入的名称 (尝试从历史订单推断)
    if (!selectedCustomer && overrideName) {
        const normalized = overrideName.trim().toLowerCase();
        const existingOrder = orders.find(o => (o.customer || '').trim().toLowerCase() === normalized);
        if (existingOrder) {
             if (existingOrder.id.length > 12) {
                 const code = existingOrder.id.substring(10, 12);
                 if (/^[A-Z]{2}$/.test(code)) countryCode = code;
             }
        }
    }

    // 2. 获取业务员代码 (3位)
    const salesMap: Record<string, string> = {
        'admin': '001',
        'alice': '002',
        'bob': '003'
    };
    const salesCode = (currentUser?.username && salesMap[currentUser.username.toLowerCase()]) || '001';

    // 3. 计算客户序号 (同国家下的第几个客户)
    let customerIndex = 1;
    const nameToCheck = selectedCustomer?.companyName || overrideName || '';

    if (selectedCustomer) {
        // 筛选同一国家的客户，并按创建时间排序
        const countryCustomers = customers.filter(c => resolveCode(c) === countryCode)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        const idx = countryCustomers.findIndex(c => c.id === selectedCustomer.id);
        if (idx !== -1) {
            customerIndex = idx + 1;
        } else {
             customerIndex = countryCustomers.length + 1;
        }
    } else if (nameToCheck) {
        // Fallback: 尝试从历史订单查找该客户的序号
        const normalized = nameToCheck.trim().toLowerCase();
        const existingOrder = orders.find(o => (o.customer || '').trim().toLowerCase() === normalized);
        
        if (existingOrder) {
            const parts = existingOrder.id.split('_');
            if (parts.length >= 3) {
                 const idx = parseInt(parts[parts.length - 2]); 
                 if (!isNaN(idx)) customerIndex = idx;
            }
        } else {
            // 新客户：找到当前国家代码下最大的客户序号 + 1
            let maxIdx = 0;
            orders.forEach(o => {
                if (o.id.startsWith('KB') && o.id.length >= 12 && o.id.substring(10, 12) === countryCode) {
                    const parts = o.id.split('_');
                    if (parts.length >= 3) {
                         const idx = parseInt(parts[parts.length - 2]);
                         if (!isNaN(idx) && idx > maxIdx) maxIdx = idx;
                    }
                }
            });
            // 同时也需要考虑 customers 列表里该国家已有多少个客户
            const existingCount = customers.filter(c => resolveCode(c) === countryCode).length;
            customerIndex = Math.max(maxIdx, existingCount) + 1;
        }
    }
    const customerIndexStr = customerIndex.toString().padStart(3, '0');

    // 4. 计算订单序号 (该客户的第几个订单)
    let orderIndex = 1;
    if (nameToCheck) {
        const normalized = nameToCheck.trim().toLowerCase();
        const customerOrders = orders.filter(o => 
            (o.customer || '').trim().toLowerCase() === normalized ||
            (o.customerInfo?.companyName || '').trim().toLowerCase() === normalized
        );
        orderIndex = customerOrders.length + 1;
    }
    const orderIndexStr = orderIndex.toString().padStart(4, '0');

    return `KB${dateStr}${countryCode}${salesCode}_${customerIndexStr}_${orderIndexStr}`;
  };

  // 自动生成 PO 号 (PO + 日期 + 序列号)
  const generatePO = () => {
    const now = new Date();
    const dateStr = now.getFullYear().toString() + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0');
    const prefix = `PO${dateStr}`;
    
    // 查找当天已有的最大序列号
    const existingPOs = orders
      .map(o => o.customerPO || '')
      .filter(po => po.startsWith(prefix));
    
    let maxSeq = 0;
    existingPOs.forEach(po => {
      const seqStr = po.replace(prefix, '');
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    });
    
    return `${prefix}${(maxSeq + 1).toString().padStart(3, '0')}`;
  };

  const [id, setId] = useState(() => {
    if (initialOrder?.id) return initialOrder.id;
    // Fix for ID conflict when creating from Quote:
    // If we have an initialQuote, try to find the customer immediately to generate a correct ID sequence
    if (initialQuote?.customer) {
        const name = initialQuote.customer;
        const normalizedName = name.trim().toLowerCase();
        const foundCustomer = customers.find(c => c.companyName.trim().toLowerCase() === normalizedName);
        // Pass either the found customer object OR the name string to ensure correct index calculation
        return generateOrderId(foundCustomer, name);
    }
    return generateOrderId();
  });
  const [customer, setCustomer] = useState(initialOrder?.customer || initialQuote?.customer || '');
  const [customerPO, setCustomerPO] = useState(initialOrder?.customerPO || generatePO());
  const [status, setStatus] = useState<OrderStatus>(initialOrder?.status || 'Pending');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(initialOrder?.paymentStatus || 'Unpaid');
  const [currency, setCurrency] = useState<'USD'|'RMB'>(initialOrder?.currency || initialQuote?.quotedCurrency || 'USD');
  const [exchangeRate, setExchangeRate] = useState(initialOrder?.exchangeRate || initialQuote?.exchangeRate || 7.1);
  
  const [paymentTerms, setPaymentTerms] = useState(initialOrder?.paymentTerms || '30% Deposit, 70% Before Shipment');
  const [deliveryDate, setDeliveryDate] = useState(initialOrder?.deliveryDate || '');
  
  // Customer Info State
  const [contactPerson, setContactPerson] = useState(initialOrder?.customerInfo?.contactPerson || '');
  const [phone, setPhone] = useState(initialOrder?.customerInfo?.phone || '');
  const [email, setEmail] = useState(initialOrder?.customerInfo?.email || '');
  const [address, setAddress] = useState(initialOrder?.customerInfo?.address || '');

  const [items, setItems] = useState<OrderItem[]>([]);
  const [sourceQuoteId, setSourceQuoteId] = useState(initialOrder?.sourceQuoteId || initialQuote?.id || '');

  // Auto-fill logic
  const handleCustomerChange = (name: string) => {
    setCustomer(name);
    const normalizedName = name.trim().toLowerCase();
    
    // 1. Exact match
    let foundCustomer = customers.find(c => c.companyName.trim().toLowerCase() === normalizedName);
    
    // 2. If not found and name length > 1, try partial match (starts with or includes)
    if (!foundCustomer && normalizedName.length > 1) {
       // Priority 1: Starts with
       const startsWithMatches = customers.filter(c => c.companyName.trim().toLowerCase().startsWith(normalizedName));
       if (startsWithMatches.length === 1) {
           foundCustomer = startsWithMatches[0];
           // Auto-correct input name to official name
           setCustomer(foundCustomer.companyName);
       } else if (startsWithMatches.length === 0) {
           // Priority 2: Includes
           const includesMatches = customers.filter(c => c.companyName.trim().toLowerCase().includes(normalizedName));
           if (includesMatches.length === 1) {
               foundCustomer = includesMatches[0];
               // Auto-correct input name to official name
               setCustomer(foundCustomer.companyName);
           }
       }
    } else if (foundCustomer) {
       // If exact match found (case-insensitive), set to official casing
       setCustomer(foundCustomer.companyName);
    }

    if (foundCustomer) {
      setContactPerson(foundCustomer.contactPerson || '');
      setPhone(foundCustomer.phone || '');
      setEmail(foundCustomer.email || '');
      setAddress(foundCustomer.address || '');
      
      // 当识别到客户时，如果是新订单，重新生成符合规则的订单号
      if (!initialOrder) {
          setId(generateOrderId(foundCustomer));
      }
    } else {
        // 如果没有匹配到客户（手动输入），也尝试更新订单号以避免冲突
        // 只要输入长度足够（避免每输入一个字都变），且不是初始化状态
        if (!initialOrder && name.length > 1) {
            setId(generateOrderId(undefined, name));
        }
    }
  };

  // 自动填充客户信息 (当从报价单创建时)
  useEffect(() => {
    if (initialQuote && !initialOrder && customers.length > 0) {
       const name = initialQuote.customer;
       const normalizedName = name.trim().toLowerCase();
       const foundCustomer = customers.find(c => c.companyName.trim().toLowerCase() === normalizedName);
       
       if (foundCustomer) {
         setContactPerson(foundCustomer.contactPerson || '');
         setPhone(foundCustomer.phone || '');
         setEmail(foundCustomer.email || '');
         setAddress(foundCustomer.address || '');
         
         // 再次确保 ID 是基于匹配到的客户生成的 (以防初始化时 customers 列表尚未加载完全)
         // 只有当 ID 还是默认格式（比如包含 _001_0001 且当前客户明显不止一个订单时）才更新，避免打断用户修改
         // 但简单起见，如果当前 ID 不包含该客户的正确索引，应该刷新。
         // 这里我们调用 generateOrderId 重新计算一下，如果跟当前 ID 不一样，就更新
         const correctId = generateOrderId(foundCustomer);
         // 仅当 ID 格式前缀（KB+Date）一致时才自动修正后缀，防止用户手动改了日期前缀被覆盖
         // 简单策略：如果是刚进来（ID 等于初始化计算值），则更新。
         // 由于 React state 更新是异步的，这里直接比较可能比较困难。
         // 采取安全策略：仅在 ID 还是默认值时更新。
         setId(prev => {
             // 如果用户手动改过 ID，通常不会是这个自动生成的格式，或者长度不同
             // 这里直接更新为“更准确”的 ID 是安全的，因为用户还没来得及改（useEffect 在 mount 后立即执行）
             return correctId;
         });
       }
    }
  }, [initialQuote, customers, initialOrder]);

  // 初始化加载 Items
  useEffect(() => {
    if (initialOrder) {
      // 尝试为旧订单数据回填成本价和分类 (如果缺失)
      const itemsWithCost = initialOrder.items.map(item => {
        // 尝试从产品库查找
        const product = products.find(p => p.id === item.productId || p.kebosModel === item.kebosModel);
        
        let cost = item.costPrice;
        if (cost === undefined) {
            cost = 0;
            if (product) {
               const currentYear = new Date().getFullYear();
               const costObj = product.yearlyCosts?.[currentYear];
               if (costObj) {
                 cost = initialOrder.currency === 'USD' ? costObj.usd : costObj.rmb;
               }
            }
        }
        
        const category = item.category || (product?.category || 'UPS');

        return { ...item, costPrice: cost, category };
      });
      setItems(itemsWithCost);
    } else if (initialQuote) {
      // 从报价单转换
      const newItems: OrderItem[] = initialQuote.items.map(qItem => {
        let cost = qItem.purchasePrice;
        
        // 修正逻辑：如果报价单是 RMB，说明 salesPrice 是 RMB。
        // 而 purchasePrice 通常是 USD (原币)。
        // 如果当前订单也是 RMB，我们需要把 USD 成本转换为 RMB 成本，以保持币种一致。
        if (initialQuote.quotedCurrency === 'RMB') {
             // 使用报价单时的汇率进行转换，确保利润计算准确
             cost = qItem.purchasePrice * (initialQuote.exchangeRate || 7.1);
        }
        
        return {
          id: `OI-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          productId: qItem.productId,
          kebosModel: qItem.kebosModel,
          description: qItem.description,
          itemType: 'Normal',
          category: products.find(p => p.id === qItem.productId)?.category || 'UPS', // 查找产品分类
          quantity: qItem.moq, // 默认用报价数量
          unitPrice: qItem.salesPrice, // 默认用报价单价
          costPrice: cost, // 修正后的成本
          total: qItem.moq * qItem.salesPrice,
          remark: ''
        };
      });
      setItems(newItems);
    }
  }, [initialOrder, initialQuote]);

  // 自动计算总额
  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      if (item.itemType === 'FOC') return sum; // 赠品不计入总额
      return sum + (item.quantity * item.unitPrice);
    }, 0);
  }, [items]);

  const orderInsights = useMemo(() => {
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const focItems = items.filter(item => item.itemType === 'FOC').length;
    const quotedItems = items.filter(item => Boolean(getQuoteFromRemark(item.remark || ''))).length;
    const totalCost = items.reduce((sum, item) => sum + ((item.costPrice || 0) * item.quantity), 0);
    const zeroPriceItems = items.filter(item => item.itemType !== 'FOC' && item.unitPrice <= 0).length;
    const sampleItems = items.filter(item => item.itemType === 'Sample').length;
    const lowMarginItems = items.filter(item => item.itemType !== 'FOC' && item.unitPrice > 0 && (((item.unitPrice - (item.costPrice || 0)) / item.unitPrice) < 0.15)).length;
    const totalProfit = items.reduce((sum, item) => {
      if (item.itemType === 'FOC') return sum;
      return sum + ((item.unitPrice - (item.costPrice || 0)) * item.quantity);
    }, 0);
    const marginRate = totalAmount > 0 ? (items.reduce((sum, item) => {
      if (item.itemType === 'FOC') return sum;
      return sum + ((item.unitPrice - (item.costPrice || 0)) * item.quantity);
    }, 0) / totalAmount) : 0;

    return {
      totalQuantity,
      focItems,
      quotedItems,
      totalCost,
      zeroPriceItems,
      sampleItems,
      lowMarginItems,
      totalProfit,
      marginRate,
    };
  }, [items, totalAmount]);

  const handleAddItem = (product: Product) => {
    // 查找该客户最近一次报价单中的该产品价格
    let lastPrice = 0;
    let lastCost = 0;
    let priceHint = '';
    
    if (customer) {
      // 1. 查找该客户的所有报价单
      const customerQuotes = quotes.filter(q => 
        q.customer.trim().toLowerCase() === customer.trim().toLowerCase()
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // 2. 查找该客户的历史订单
      const customerOrders = orders.filter(o =>
        o.customer.trim().toLowerCase() === customer.trim().toLowerCase() &&
        o.id !== (initialOrder?.id || '') // 排除当前订单
      ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // 3. 尝试从报价单中查找
      for (const q of customerQuotes) {
        const item = q.items.find(i => i.productId === product.id || i.kebosModel === product.kebosModel);
        if (item) {
          lastPrice = item.salesPrice;
          lastCost = item.purchasePrice;
          priceHint = `引用报价单 ${q.id} (${q.date}, 汇率: ${q.exchangeRate})`;
          break;
        }
      }

      // 4. 如果报价单没找到，尝试从历史订单中查找
      for (const o of customerOrders) {
        const item = o.items.find(i => i.productId === product.id || i.kebosModel === product.kebosModel);
        if (item) {
          // 如果之前没找到 Quote，或者 Order 日期晚于 Quote 日期
          const quoteDate = priceHint.match(/\((.*?),\s/)?.[1] || '';
          const orderDate = new Date(o.createdAt).toLocaleDateString();
          
          if (lastPrice === 0 || (quoteDate && new Date(o.createdAt).getTime() > new Date(quoteDate).getTime())) {
             lastPrice = item.unitPrice;
             lastCost = item.costPrice || 0;
             priceHint = `引用历史订单 ${o.id} (${orderDate})`;
          }
          break;
        }
      }
    }

    // fallback to product standard price if no quote found
    if (lastPrice === 0 && product.standardPrice) {
      lastPrice = product.standardPrice;
      
      // 尝试获取当前年份的成本作为估算
      const currentYear = new Date().getFullYear();
      const costObj = product.yearlyCosts?.[currentYear];
      if (costObj) {
        // 简单逻辑：根据当前订单币种选择对应成本
        lastCost = currency === 'USD' ? costObj.usd : costObj.rmb;
      }
      
      priceHint = '引用产品标准售价';
    }

    const newItem: OrderItem = {
      id: `OI-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      productId: product.id,
      kebosModel: product.kebosModel,
      description: product.description,
      itemType: 'Normal',
      category: product.category || 'UPS',
      quantity: product.moq || 1,
      unitPrice: lastPrice, // 自动填充最近报价
      costPrice: lastCost,  // 填充成本
      total: 0,
      remark: priceHint // 将价格来源作为备注提示
    };
    setItems([...items, newItem]);
  };

  const updateItem = (id: string, updates: Partial<OrderItem>) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, ...updates };
      // 自动重算行小计
      updated.total = updated.quantity * updated.unitPrice;
      return updated;
    }));
  };

  const removeItem = (id: string) => {
    if(window.confirm('确定移除此行吗？')) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  const [productSearch, setProductSearch] = useState('');
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!customer) {
      alert('请填写客户名称');
      return;
    }
    if (items.length === 0) {
      alert('订单不能为空');
      return;
    }

    try {
      setIsSaving(true);
      
      // 构建历史记录
      const currentHistory = initialOrder?.history || [];
      const newHistory = [...currentHistory];
      
      // 如果是新订单
      if (!initialOrder) {
        newHistory.push({
          timestamp: new Date().toISOString(),
          action: 'Created',
          operator: currentUser?.username || 'System'
        });
      } else {
        // 检查状态变化
        if (status !== initialOrder.status) {
          newHistory.push({
            timestamp: new Date().toISOString(),
            action: `Status Change: ${initialOrder.status} -> ${status}`,
            operator: currentUser?.username || 'System'
          });
        }
        // 也可以记录其他重要修改，这里暂只记录状态
        newHistory.push({
           timestamp: new Date().toISOString(),
           action: 'Updated Info',
           operator: currentUser?.username || 'System'
        });
      }

      // Calculate total profit
      const totalProfit = items.reduce((sum, item) => {
        if (item.itemType === 'FOC') return sum;
        const cost = item.costPrice || 0;
        const profit = (item.unitPrice - cost) * item.quantity;
        return sum + profit;
      }, 0);

      const order: SalesOrder = {
        id,
        customer,
        customerInfo: {
          companyName: customer,
          contactPerson,
          phone,
          email,
          address
        },
        customerPO,
        status,
        paymentStatus,
        currency,
        exchangeRate,
        items,
        totalAmount,
        totalProfit, // Save calculated profit
        paidAmount: initialOrder?.paidAmount || 0, // 暂不处理收款逻辑
        paymentTerms,
        deliveryDate,
        sourceQuoteId,
        createdAt: initialOrder?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: newHistory
      };
      await onSave(order);
    } catch (e) {
      console.error("Save order failed:", e);
      alert("保存订单失败");
      setIsSaving(false);
    }
  };

  const getProductPriceHint = (product: Product) => {
    let priceInfo = { price: 0, source: 'none', date: '' };

    if (customer) {
      const customerQuotes = quotes.filter(q => 
        q.customer.trim().toLowerCase() === customer.trim().toLowerCase()
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      for (const q of customerQuotes) {
        const item = q.items.find(i => i.productId === product.id || i.kebosModel === product.kebosModel);
        if (item) {
          priceInfo = { price: item.salesPrice, source: 'quote', date: q.date };
          break;
        }
      }
    }

    if (priceInfo.price === 0 && product.standardPrice) {
      priceInfo = { price: product.standardPrice, source: 'standard', date: '' };
    }

    // New logic: Check historical orders
    if (customer && priceInfo.source !== 'quote') {
        const customerOrders = orders.filter(o =>
            o.customer.trim().toLowerCase() === customer.trim().toLowerCase()
        ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        for (const o of customerOrders) {
            const item = o.items.find(i => i.productId === product.id || i.kebosModel === product.kebosModel);
            if (item) {
                // If we found a price, or if this order is newer than the quote we found
                const quoteDate = priceInfo.date;
                const orderDate = new Date(o.createdAt).toLocaleDateString();
                
                if (priceInfo.price === 0 || (quoteDate && new Date(o.createdAt).getTime() > new Date(quoteDate).getTime())) {
                   priceInfo = { price: item.unitPrice, source: 'order', date: orderDate };
                }
                break;
            }
        }
    }

    return priceInfo;
  };

  const filteredProducts = useMemo(() => {
    let list = products;
    if (productSearch) {
      list = products.filter(p => p.kebosModel.toLowerCase().includes(productSearch.toLowerCase()));
    }
    return list.slice(0, 20); // Limit to 20 for better performance
  }, [products, productSearch]);

  const getQuoteFromRemark = (remark: string) => {
    // 匹配 "引用报价单 Q2024..." 格式
    const match = remark?.match(/引用报价单\s+([A-Za-z0-9-]+)/);
    if (match) {
      return match[1];
    }
    return null;
  };

  const handlePreviewQuote = (quoteId: string) => {
    const quote = quotes.find(q => q.id === quoteId);
    if (quote) {
      setPreviewQuoteId(quoteId);
    } else {
      alert('未找到原始报价单数据');
    }
  };

  return (
    <div className="max-w-full pb-20 px-4 lg:px-8">
      {previewQuoteId && (
        <QuoteDetailModal 
          quote={quotes.find(q => q.id === previewQuoteId)!} 
          onClose={() => setPreviewQuoteId(null)} 
          logo="/assets/logo.png" 
        />
      )}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">
            Order Execution Desk
          </div>
          <h1 className="mt-4 text-3xl font-black text-slate-900 tracking-tight">{initialOrder ? '编辑订单' : '新建销售订单'}</h1>
          <p className="text-slate-500 text-xs font-medium mt-2 uppercase tracking-wider">{id}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="px-6 py-3 border border-slate-200 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all">取消</button>
          <button onClick={handleSave} disabled={isSaving} className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70">
            {isSaving ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18}/>} 保存订单
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-[1.6rem] border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">订单金额</div>
          <div className="mt-3 text-2xl font-black text-slate-900">{formatCurrency(totalAmount, currency)}</div>
        </div>
        <div className="rounded-[1.6rem] border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">总数量</div>
          <div className="mt-3 text-2xl font-black text-slate-900">{orderInsights.totalQuantity}</div>
        </div>
        <div className="rounded-[1.6rem] border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">引用报价行</div>
          <div className="mt-3 text-2xl font-black text-slate-900">{orderInsights.quotedItems}</div>
        </div>
        <div className="rounded-[1.6rem] border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">利润率</div>
          <div className="mt-3 text-2xl font-black text-slate-900">{(orderInsights.marginRate * 100).toFixed(1)}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.75fr] gap-6 mb-6">
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
             <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
               <div>
                 <h3 className="font-black text-slate-900 flex items-center gap-2">
                   <FileText size={18} className="text-blue-600"/> 基础信息
                 </h3>
                 <p className="mt-2 text-sm text-slate-500 leading-6">先锁定客户、联系人和客户 PO，再进入订单明细。这里是销售与跟单共享的订单主数据区。</p>
               </div>
               <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 min-w-[220px]">
                 <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">订单编号</div>
                 <div className="mt-2 text-lg font-black text-slate-900 break-all">{id}</div>
               </div>
             </div>

             <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
               <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-5 space-y-4">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.22em]">客户主档</div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">客户名称</label>
                   <input 
                     type="text" 
                     value={customer} 
                     onChange={e => handleCustomerChange(e.target.value)} 
                     list="customer-list"
                     className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-slate-900 transition-all" 
                     placeholder="输入或选择客户..."
                   />
                   <datalist id="customer-list">
                     {customers.map(c => (
                       <option key={c.id} value={c.companyName} />
                     ))}
                   </datalist>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">客户 PO 号</label>
                   <input type="text" value={customerPO} onChange={e => setCustomerPO(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-slate-900 transition-all" placeholder="例如: PO-2024-001" />
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><UserIcon size={10}/> 联系人</label>
                     <input type="text" title="联系人" placeholder="输入联系人" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-slate-900 transition-all" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Phone size={10}/> 联系电话</label>
                     <input type="text" title="联系电话" placeholder="输入联系电话" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-slate-900 transition-all" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Mail size={10}/> 电子邮箱</label>
                     <input type="text" title="电子邮箱" placeholder="输入电子邮箱" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-slate-900 transition-all" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><MapPin size={10}/> 地址</label>
                     <input type="text" title="地址" placeholder="输入客户地址" value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-slate-900 transition-all" />
                   </div>
                 </div>
               </div>

               <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 space-y-4">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.22em]">交付与结算</div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">付款条款</label>
                     <input type="text" title="付款条款" placeholder="输入付款条款" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-slate-900 transition-all" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">交货日期</label>
                     <input type="date" title="交货日期" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-slate-900 transition-all" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">执行状态</label>
                     <select title="执行状态" value={status} onChange={e => setStatus(e.target.value as OrderStatus)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none">
                        <option value="Pending">待处理 (Pending)</option>
                        <option value="Production">生产中 (Production)</option>
                        <option value="Shipped">已发货 (Shipped)</option>
                        <option value="Completed">已完成 (Completed)</option>
                        <option value="Cancelled">已取消 (Cancelled)</option>
                     </select>
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">资金状态</label>
                     <select title="资金状态" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as PaymentStatus)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none">
                        <option value="Unpaid">未付款 (Unpaid)</option>
                        <option value="Deposit Received">已收定金 (Deposit)</option>
                        <option value="Fully Paid">全款已付 (Paid)</option>
                     </select>
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">币种</label>
                     <select title="币种" value={currency} onChange={e => setCurrency(e.target.value as 'USD' | 'RMB')} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none">
                       <option value="USD">USD</option>
                       <option value="RMB">RMB</option>
                     </select>
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">锁定汇率</label>
                     <input type="number" title="锁定汇率" value={exchangeRate} onChange={e => setExchangeRate(parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-slate-900 transition-all" />
                   </div>
                 </div>
               </div>
             </div>
          </div>

          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
             <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-black text-slate-900 flex items-center gap-2">
                    <Package size={18} className="text-blue-600"/> 订单明细
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">录入产品、数量、成交价和备注。右侧摘要会实时反映订单收入、成本和风险条目。</p>
                </div>
                <button onClick={() => setShowProductSelector(!showProductSelector)} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-xl hover:bg-blue-100 transition-all">
                  + 添加产品
                </button>
             </div>

             <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
               <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                 <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">当前利润</div>
                 <div className="mt-2 text-xl font-black text-slate-900">{formatCurrency(orderInsights.totalProfit, currency)}</div>
               </div>
               <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                 <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">低毛利条目</div>
                 <div className="mt-2 text-xl font-black text-slate-900">{orderInsights.lowMarginItems}</div>
               </div>
               <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                 <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">未定价条目</div>
                 <div className="mt-2 text-xl font-black text-slate-900">{orderInsights.zeroPriceItems}</div>
               </div>
               <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                 <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">样品条目</div>
                 <div className="mt-2 text-xl font-black text-slate-900">{orderInsights.sampleItems}</div>
               </div>
             </div>

             <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50/70 p-5">
               <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                 <div>
                   <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">明细执行提示</div>
                   <div className="mt-2 text-sm text-slate-500">优先处理未定价、低毛利和样品条目。订单页的风险通常来自价格来源不一致，而不是录入动作本身。</div>
                 </div>
                 <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
                   <span className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600">共 {items.length} 行</span>
                   <span className={`px-3 py-2 rounded-xl ${orderInsights.zeroPriceItems > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                     {orderInsights.zeroPriceItems > 0 ? `待定价 ${orderInsights.zeroPriceItems}` : '价格完整'}
                   </span>
                   <span className={`px-3 py-2 rounded-xl ${orderInsights.lowMarginItems > 0 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                     {orderInsights.lowMarginItems > 0 ? `低毛利 ${orderInsights.lowMarginItems}` : '毛利稳定'}
                   </span>
                 </div>
               </div>
             </div>

             {showProductSelector && (
               <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 animate-in slide-in-from-top-2">
                 <input 
                   type="text" 
                   placeholder="搜索产品型号..." 
                   value={productSearch}
                   onChange={e => setProductSearch(e.target.value)}
                   className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold mb-3 outline-none focus:border-blue-500"
                 />
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
                   {filteredProducts.map(p => {
                     const hint = getProductPriceHint(p);
                     return (
                       <button key={p.id} onClick={() => { handleAddItem(p); setShowProductSelector(false); }} className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:border-blue-500 hover:shadow-sm transition-all text-left group">
                         <div>
                           <div className="font-black text-slate-700 group-hover:text-blue-600">{p.kebosModel}</div>
                           <div className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">{p.description}</div>
                         </div>
                         <div className="text-right">
                           {hint.price > 0 ? (
                             <>
                               <div className="text-blue-600 font-black">{formatCurrency(hint.price, currency)}</div>
                               <div className="text-[9px] text-slate-400 scale-90 origin-right">
                                 {hint.source === 'quote' ? `历史报价 (${hint.date})` : hint.source === 'order' ? `历史订单 (${hint.date})` : '标准售价'}
                               </div>
                             </>
                           ) : (
                             <div className="text-slate-300 text-[10px]">暂无参考价</div>
                           )}
                         </div>
                       </button>
                     );
                   })}
                 </div>
               </div>
             )}

             <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50/70 px-5 py-4">
               <div className="grid grid-cols-12 gap-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                 <div className="col-span-12 lg:col-span-4">型号与来源</div>
                 <div className="col-span-6 lg:col-span-4">录入字段</div>
                 <div className="col-span-6 lg:col-span-4">行级结果</div>
               </div>
             </div>

             <div className="space-y-3">
               {items.map((item, idx) => (
                 <div key={item.id} className="border border-slate-100 rounded-2xl bg-slate-50/50 hover:bg-white hover:shadow-md transition-all group overflow-hidden">
                    <div className="grid grid-cols-12 gap-4 p-4 items-start">
                      <div className="col-span-12 lg:col-span-4 flex items-start gap-3">
                         <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-black shrink-0">{idx + 1}</span>
                         <div className="min-w-0 flex-1">
                           <div className="flex items-center justify-between gap-3">
                             <div className="flex items-center gap-2 flex-wrap">
                               <p className="font-black text-slate-900">{item.kebosModel}</p>
                               {item.remark && getQuoteFromRemark(item.remark) && (
                                 <button 
                                   onClick={() => handlePreviewQuote(getQuoteFromRemark(item.remark)!)}
                                   className="flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[9px] font-bold hover:bg-violet-200 transition-colors"
                                   title="点击查看原始报价单"
                                 >
                                   <LinkIcon size={10} />
                                   <span>来自报价: {getQuoteFromRemark(item.remark)}</span>
                                 </button>
                               )}
                             </div>
                             <button onClick={() => removeItem(item.id)} title="移除当前明细" aria-label="移除当前明细" className="text-slate-300 hover:text-rose-500 transition-colors shrink-0"><X size={16}/></button>
                           </div>
                           <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
                             <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-600">行金额 {formatCurrency(item.total, currency)}</span>
                             <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-600">成本 {formatCurrency((item.costPrice || 0) * item.quantity, currency)}</span>
                             <span className={`px-2 py-1 rounded-lg ${item.itemType === 'FOC' ? 'bg-amber-50 text-amber-700' : item.unitPrice > 0 && (((item.unitPrice - (item.costPrice || 0)) / item.unitPrice) < 0.15) ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                               {item.itemType === 'FOC' ? 'FOC' : `利润 ${formatCurrency((item.unitPrice - (item.costPrice || 0)) * item.quantity, currency)}`}
                             </span>
                           </div>
                         </div>
                      </div>

                      <div className="col-span-12 lg:col-span-4 grid grid-cols-2 gap-3">
                       <div>
                          <label className="text-[9px] font-black text-slate-300 uppercase">产品分类</label>
                          <select 
                            title="产品分类"
                            value={item.category || 'UPS'} 
                            onChange={e => updateItem(item.id, { category: e.target.value as 'UPS' | 'Spare Parts' })}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-blue-500"
                          >
                            <option value="UPS">UPS</option>
                            <option value="Spare Parts">Spare Parts</option>
                          </select>
                       </div>
                       <div>
                          <label className="text-[9px] font-black text-slate-300 uppercase">类型</label>
                          <select 
                            title="明细类型"
                            value={item.itemType} 
                            onChange={e => updateItem(item.id, { itemType: e.target.value as OrderItemType })}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-blue-500"
                          >
                            <option value="Normal">正价品</option>
                            <option value="Sample">样品</option>
                            <option value="FOC">赠品/备件</option>
                          </select>
                       </div>
                       <div>
                          <label className="text-[9px] font-black text-slate-300 uppercase">数量</label>
                          <input 
                            type="number" 
                            title="数量"
                            value={item.quantity} 
                            onChange={e => updateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-blue-500"
                          />
                       </div>
                       <div>
                          <label className="text-[9px] font-black text-slate-300 uppercase">单价 ({currency})</label>
                          <input 
                            type="number" 
                            value={item.unitPrice} 
                            disabled={item.itemType === 'FOC'}
                            onChange={e => updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                            className={`w-full bg-white border rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-blue-500 disabled:opacity-50 ${item.unitPrice === 0 && item.itemType !== 'FOC' ? 'border-rose-500 ring-1 ring-rose-200 bg-rose-50' : 'border-slate-200'}`}
                            placeholder={item.itemType !== 'FOC' ? "0.00" : ""}
                          />
                          {/* Price Warning/Comparison Info */}
                          {item.itemType !== 'FOC' && (
                             <div className="mt-1 flex flex-col gap-0.5">
                                {item.unitPrice === 0 ? (
                                   <div className="text-[9px] text-rose-500 font-bold flex items-center gap-1 animate-pulse">
                                     <AlertTriangle size={10} /> 价格未定义
                                   </div>
                                ) : (() => {
                                   // Calculate price difference compared to standard price
                                   const prod = products.find(p => p.id === item.productId || p.kebosModel === item.kebosModel);
                                   if (!prod || !prod.standardPrice) return null;
                                   
                                   const diff = item.unitPrice - prod.standardPrice;
                                   const diffPercent = (diff / prod.standardPrice) * 100;
                                   
                                   // Only show if difference is significant (> 0.1%)
                                   if (Math.abs(diffPercent) < 0.1) return null;
                                   
                                   const isHigher = diff > 0;
                                   return (
                                     <div className={`text-[9px] font-bold flex items-center gap-1 ${isHigher ? 'text-orange-500' : 'text-green-600'}`}>
                                        {isHigher ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                                        <span>比正价{isHigher ? '高' : '低'} {Math.abs(diffPercent).toFixed(1)}%</span>
                                     </div>
                                   );
                                })()}
                             </div>
                          )}
                       </div>
                       <div>
                          <label className="text-[9px] font-black text-slate-300 uppercase">行备注</label>
                          <input 
                            type="text" 
                            value={item.remark || ''} 
                            onChange={e => updateItem(item.id, { remark: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-blue-500"
                            placeholder="如: 英标插头"
                          />
                       </div>
                      </div>

                      <div className="col-span-12 lg:col-span-4 rounded-xl border border-slate-200 bg-white px-4 py-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-sm font-bold">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-black">成交额</div>
                            <div className="mt-1 text-slate-900">{formatCurrency(item.total, currency)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-black">利润</div>
                            <div className="mt-1 text-slate-900">{formatCurrency((item.unitPrice - (item.costPrice || 0)) * item.quantity, currency)}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm font-bold">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-black">单件成本</div>
                            <div className="mt-1 text-slate-900">{formatCurrency(item.costPrice || 0, currency)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-black">毛利率</div>
                            <div className="mt-1 text-slate-900">{item.itemType === 'FOC' || item.unitPrice <= 0 ? '0.0%' : `${(((item.unitPrice - (item.costPrice || 0)) / item.unitPrice) * 100).toFixed(1)}%`}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                 </div>
               ))}
               {items.length === 0 && <div className="text-center py-10 text-slate-400 text-xs italic">暂无明细，请添加产品</div>}
             </div>
          </div>
          
          {initialOrder?.history && initialOrder.history.length > 0 && (
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
               <h3 className="font-black text-slate-900 flex items-center gap-2">
                 <RefreshCw size={18} className="text-blue-600"/> 操作历史
               </h3>
               <div className="space-y-3">
                 {initialOrder.history.slice().reverse().map((log, idx) => (
                   <div key={idx} className="flex gap-4 text-xs">
                     <div className="text-slate-400 font-mono w-32 shrink-0">{new Date(log.timestamp).toLocaleString()}</div>
                     <div className="font-bold text-slate-700 flex-1">{log.action}</div>
                     <div className="text-slate-400">{log.operator}</div>
                   </div>
                 ))}
               </div>
            </div>
          )}
        </div>

          <div className="space-y-6 xl:sticky xl:top-6 self-start">
            <div className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-xl">
              <h3 className="font-black text-slate-400 text-xs uppercase tracking-widest mb-6">财务汇总</h3>
              
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs font-bold">订单总额</span>
                  <span className="text-3xl font-black tracking-tight">{formatCurrency(totalAmount, currency)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4">
                   <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">成本合计</div>
                   <div className="mt-2 text-lg font-black text-white">{formatCurrency(orderInsights.totalCost, currency)}</div>
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4">
                   <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">FOC 条目</div>
                   <div className="mt-2 text-lg font-black text-white">{orderInsights.focItems}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-8 border-t border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm font-bold">利润率</span>
                  <span className="text-xl font-black tracking-tight">{(orderInsights.marginRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm font-bold">引用报价行</span>
                  <span className="text-xl font-black tracking-tight">{orderInsights.quotedItems}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">执行提醒</h3>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 leading-6">
               提交前优先核对客户 PO、币种、汇率和引用报价来源。订单执行最常见的偏差不是数量，而是价格口径与交付条件不一致。
              </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">待处理价格</div>
                    <div className="mt-2 text-xl font-black text-slate-900">{orderInsights.zeroPriceItems}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">低毛利</div>
                    <div className="mt-2 text-xl font-black text-slate-900">{orderInsights.lowMarginItems}</div>
                  </div>
                </div>
              <div className="space-y-2">
               {items.slice(0, 5).map(item => (
                <div key={item.id} className="rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                   <div className="text-sm font-black text-slate-900">{item.kebosModel}</div>
                   <div className="text-[11px] font-bold text-slate-500">{item.quantity} PCS · {formatCurrency(item.unitPrice, currency)}</div>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-[10px] font-black ${item.itemType === 'FOC' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                   {item.itemType}
                  </div>
                </div>
               ))}
               {items.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">尚未添加订单明细</div>
               )}
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default OrderForm;
