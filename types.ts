
export interface User {
  username: string;
  role: 'admin' | 'staff';
  realName?: string;
  phoneNumber?: string;
  email?: string;
}

export interface Customer {
  id: string;
  customerId?: string; // 客户ID (e.g. CN001)
  companyName: string; // 公司名称 (英文)
  companyNameLocal?: string; // 公司名称 (中文/本地语)
  contactPerson: string; // 联系人姓名 (英文)
  position?: string; // 职位
  email: string;
  phone: string; // 电话 (带国家区号)
  country?: string; // 国家/地区
  address: string; // 国家/地区/城市地址
  website?: string; // 网站
  industry?: string; // 行业分类
  scale?: string; // 公司规模
  socialApp?: string; // WhatsApp / WeChat / Skype
  timezone?: string; // 时区
  communicationPreference?: string; // 偏好沟通方式
  languagePreference?: string; // 语言偏好
  stage?: string; // 客户阶段
  level?: string; // 客户等级 (A/B/C/D)
  firstContactDate?: string; // 首次接触日期
  lastContactDate?: string; // 最近沟通时间
  nextActionDate?: string; // 下次跟进计划日期
  nextActionPlan?: string; // 下次跟进计划内容
  createdAt: string;
  updatedAt: string;
}

export interface ProductCost {
  usd: number;
  rmb: number;
}

// 定义产品所属系列
export type ProductSeries = 'Offline' | 'Line-Interactive' | 'Online HF' | 'Online LF' | 'Inverter' | 'Others';

export interface Product {
  id: string;
  kebosModel: string;
  supplierModel: string;
  factoryPartNumber?: string;
  series: ProductSeries; // 新增系列字段
  category: 'UPS' | 'Spare Parts'; // 新增产品分类
  description: string;
  batteryInfo: string;
  moq: number;
  productSize: string;
  packingSize: string;
  pcsPerCtn: number; // 装箱数 (PCS/CTN)
  nw: number;
  gw: number;
  packaging: string;
  standardPrice?: number; // 标准建议售价 (新增)
  yearlyCosts: Record<number, ProductCost>;
  updatedAt?: string;
}

export interface ProductLog {
  id: string;
  timestamp: string;
  user: string;
  action: 'add' | 'update' | 'import' | 'delete';
  model: string;
  details: string;
}

export interface QuoteItem {
  id: string;
  productId: string;
  kebosModel: string;
  description: string;
  batteryInfo: string;
  purchasePrice: number;
  salesPrice: number;
  moq: number; // 当前报价单中的成交数量
  standardMoq: number; // 产品库中的标准起订量
  isSample?: boolean; // 是否为样品报价
  profit: number;
  margin: number;
}

export type PricingMode = 'USD_TO_RMB' | 'USD_TO_USD' | 'RMB_TO_RMB' | 'RMB_TO_USD';

export interface Quote {
  id: string;
  date: string;
  customer: string;
  items: QuoteItem[];
  quotedCurrency: 'USD' | 'RMB';
  pricingMode: PricingMode;
  exchangeRate: number;
  totalAmount: number;
  totalProfit: number;
  avgMargin: number;
}

export type OrderStatus = 'Pending' | 'Production' | 'Shipped' | 'Completed' | 'Cancelled';
export type PaymentStatus = 'Unpaid' | 'Deposit Received' | 'Fully Paid';
export type OrderItemType = 'Normal' | 'Sample' | 'FOC';

export interface OrderItem {
  id: string;
  productId: string;
  kebosModel: string;
  description: string;
  itemType: OrderItemType;
  category?: 'UPS' | 'Spare Parts'; // 新增产品分类快照
  quantity: number;
  unitPrice: number; // 最终成交单价
  costPrice?: number; // 成本单价 (新增)
  total: number;
  remark?: string; // 行备注
}

export interface OrderHistoryLog {
  timestamp: string;
  action: string; // e.g., "Created", "Status Change: Pending -> Production", "Updated Info"
  operator?: string;
}

export interface SalesOrder {
  id: string;
  sourceQuoteId?: string; // 关联的源报价单ID (可选)
  customer: string;
  customerInfo?: {
    companyName: string;
    address: string;
    contactPerson: string;
    phone: string;
    email: string;
  };
  salesInfo?: {
    name: string;
    phone: string;
    email: string;
  };
  customerPO?: string;    // 客户的采购单号
  
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  
  items: OrderItem[];
  
  currency: 'USD' | 'RMB';
  exchangeRate: number; // 下单时的汇率快照
  totalAmount: number;
  totalProfit?: number; // 订单总利润 (新增)
  paidAmount: number;   // 已收金额
  
  // 商务执行条款
  paymentTerms: string;    // 付款方式
  deliveryDate: string;    // 交货期
  createdAt: string;       // 下单时间
  updatedAt: string;
  history?: OrderHistoryLog[]; // 订单操作历史
}

export type View = 'dashboard' | 'products' | 'quotes' | 'new-quote' | 'users' | 'profile' | 'orders' | 'new-order';

