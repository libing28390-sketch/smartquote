
import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, FileSpreadsheet, Maximize, Tag, Box, ArrowRight, Edit2 } from 'lucide-react';
import { Quote, QuoteItem } from '../types';
import { exportKebosQuotationXlsx } from '../utils';
import { generatePDF } from '../pdfGenerator';

interface QuoteDetailModalProps {
  quote: Quote;
  item?: QuoteItem;
  onClose: () => void;
  onEdit?: (quote: Quote) => void;
  logo: string;
}

const QuoteDetailModal: React.FC<QuoteDetailModalProps> = ({ quote, item, onClose, onEdit, logo }) => {
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const DOC_WIDTH = 800; 

  // If item is provided, we show item details view
  // If no item, we show the full quote view
  const isItemView = !!item; 

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        // 减去滚动条和边距
        const containerWidth = containerRef.current.offsetWidth - 32; 
        setScale(containerWidth < DOC_WIDTH ? containerWidth / DOC_WIDTH : 1);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatDateToEnglish = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = d.getDate();
      const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${day}${suffix} ${months[d.getMonth()]},${d.getFullYear()}`;
    } catch (e) {
      return dateStr;
    }
  };

  const currencyUnit = quote.quotedCurrency;
  const currencySymbol = currencyUnit === 'USD' ? '$' : '¥';
  const hasSampleItem = quote.items.some(item => item.isSample || item.moq < 2);
  const hasLowQtyItem = quote.items.some(item => !item.isSample && item.moq >= 2 && item.moq < item.standardMoq);
  
  let priceHeaderLabel = "NET PRICE";
  let moqHeaderLabel = "MOQ\n(PCS)";
  if (hasSampleItem) {
    priceHeaderLabel = "SAMPLE PRICE";
    moqHeaderLabel = "SAMPLE\n(PCS)";
  } else if (hasLowQtyItem) {
    priceHeaderLabel = "NET PRICE";
    moqHeaderLabel = "QUANTITY\n(PCS)";
  }

  const formatCurrency = (value: number, currency: 'USD' | 'RMB' = 'USD') => {
    const symbol = currency === 'USD' ? '$' : '¥';
    return `${symbol}${value.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
  };

  if (isItemView && item) {
    const unitCost = item.salesPrice - item.profit;
    
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 uppercase">{quote.id}</span>
                            <span className="text-slate-400 text-xs font-bold">{formatDateToEnglish(quote.date)}</span>
                        </div>
                        <h2 className="text-xl font-black text-slate-900">{quote.customer}</h2>
                    </div>
                    <div className="flex items-center">
                        <button onClick={() => { if(onEdit) onEdit(quote); }} className="p-2 bg-slate-100 text-amber-500 rounded-full hover:bg-slate-200 transition-colors mr-2" title="Edit Quote">
                            <Edit2 size={20}/>
                        </button>
                        <button onClick={onClose} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 transition-colors">
                            <X size={20}/>
                        </button>
                    </div>
                </div>
                
                <div className="p-8 overflow-y-auto space-y-8">
                    {/* Main Product Info */}
                    <div className="flex gap-6">
                        <div className="w-24 h-24 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 shrink-0 border border-slate-100">
                            <Box size={40} />
                        </div>
                        <div className="flex-1 space-y-2">
                            <div className="flex justify-between items-start">
                                <h3 className="text-2xl font-black text-slate-900">{item.kebosModel}</h3>
                                <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-black border border-emerald-100">
                                    MOQ: {item.moq}
                                </div>
                            </div>
                            <p className="text-sm text-slate-500 font-medium leading-relaxed whitespace-pre-wrap">
                                {item.description}
                            </p>
                            {item.batteryInfo && (
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mt-2">
                                    <Tag size={14} />
                                    <span>Battery: {item.batteryInfo}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Financials Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Unit Cost</div>
                            <div className="text-lg font-black text-slate-600">{formatCurrency(unitCost, quote.quotedCurrency)}</div>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                            <div className="text-[10px] font-black text-blue-400 uppercase mb-1">Unit Price</div>
                            <div className="text-lg font-black text-blue-600">{formatCurrency(item.salesPrice, quote.quotedCurrency)}</div>
                        </div>
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                            <div className="text-[10px] font-black text-amber-400 uppercase mb-1">Margin</div>
                            <div className="text-lg font-black text-amber-600">{(item.margin * 100).toFixed(2)}%</div>
                        </div>
                        <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
                            <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Total Amount</div>
                            <div className="text-lg font-black text-white">{formatCurrency(item.salesPrice * item.moq, quote.quotedCurrency)}</div>
                        </div>
                    </div>

                    {/* Cost Breakdown (Internal) */}
                    <div className="border-t border-slate-100 pt-6">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">Cost Structure (Internal)</h4>
                        <div className="flex items-center gap-8 text-sm">
                            <div>
                                <span className="text-slate-400 font-bold mr-2">Original Cost:</span>
                                <span className="font-mono font-bold text-slate-700">
                                    {formatCurrency(item.purchasePrice, quote.pricingMode.startsWith('RMB') ? 'RMB' : 'USD')}
                                </span>
                            </div>
                            <ArrowRight size={14} className="text-slate-300" />
                            <div>
                                <span className="text-slate-400 font-bold mr-2">Unit Profit:</span>
                                <span className="font-mono font-bold text-emerald-600">
                                    {formatCurrency(item.profit, quote.quotedCurrency)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] flex flex-col items-center bg-slate-900/90 backdrop-blur-xl overflow-y-auto no-scrollbar print:bg-white print:block print:!absolute print:!top-0 print:!left-0 print:!z-[99999] print:overflow-visible print:h-auto print:w-auto print:p-0 print:m-0">
      {/* 顶部控制栏 - 打印时隐藏 */}
      <div className="no-print w-full bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-lg sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg text-white shadow-md"><Maximize size={16} /></div>
          <span className="font-black text-slate-800 text-sm hidden sm:inline">报价单预览 - {quote.customer}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={() => { if(onEdit) onEdit(quote); }} className="px-4 py-2 bg-white border border-slate-200 text-amber-600 rounded-xl text-[10px] font-black flex items-center gap-2 hover:bg-amber-50 hover:border-amber-200 transition-all">
            <Edit2 size={16} /> <span className="hidden xs:inline">编辑报价</span>
          </button>
          <button onClick={() => exportKebosQuotationXlsx(quote, logo)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black flex items-center gap-2 hover:bg-emerald-700 transition-all">
            <FileSpreadsheet size={16} /> <span className="hidden xs:inline">导出 EXCEL</span>
          </button>
          <button onClick={() => generatePDF(quote, logo)} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black flex items-center gap-2 transition-all">
            <Printer size={16} /> <span className="hidden xs:inline">PDF 导出</span>
          </button>
          <button onClick={onClose} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 transition-colors"><X size={20}/></button>
        </div>
      </div>

      {/* 报价单内容容器 */}
      <div ref={containerRef} className="w-full flex flex-col items-center py-6 md:py-12 px-2 md:px-4 printable-wrapper print:py-0 print:px-0 print:block print:static print:m-0">
        <div 
          style={{ 
            width: `${DOC_WIDTH}px`, 
            transformOrigin: 'top center',
            // @ts-ignore
            '--print-scale': scale, // Store scale for potential use
          }}
          className="transition-transform duration-300 shadow-[0_30px_100px_rgba(0,0,0,0.5)] bg-white print:transform-none print:shadow-none print:m-0 print:w-full print:border-none print-preview-container"
        >
          {/* 在非打印模式下应用缩放 */}
          <style dangerouslySetInnerHTML={{__html: `
            @media screen {
              .print-preview-container {
                transform: scale(${scale});
                margin-bottom: calc(${DOC_WIDTH}px * ${1 - scale} * -1.05);
              }
            }
            @media print {
              @page { margin: 0; size: auto; }
              body { margin: 0; padding: 0; background: white; }
              .printable-wrapper { width: 100% !important; height: 100% !important; display: block !important; }
              .print-preview-container { width: 100% !important; max-width: none !important; box-shadow: none !important; margin: 0 !important; }
              /* 强制覆盖全局 index.html 中的 padding !important 设置 */
              .printable-area { padding-top: 30mm !important; padding-left: 15mm !important; padding-right: 15mm !important; padding-bottom: 15mm !important; }
            }
          `}} />
          <div className="printable-area p-[15mm] text-black border border-slate-200 print:border-none" style={{ fontFamily: 'Arial, sans-serif', lineHeight: '1.4' }}>
            {/* 页眉区 - 仿照 Excel 布局: Logo 悬浮左上, 文本居中 */}
            <div className="relative mb-8 pt-2 min-h-[120px]">
              <div 
                className="absolute left-0 top-0 w-[144px]"
                style={{ position: 'absolute', left: 0, top: 0, width: '144px', zIndex: 10 }}
              >
                <img 
                  src={logo} 
                  alt="Logo" 
                  className="w-full h-auto object-contain object-left" 
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              </div>
              <div className="text-center space-y-0.5 w-full pt-2">
                <h1 className="text-2xl font-black tracking-tight mb-1 text-slate-900">KEBOS  POWER CO.,LTD</h1>
                <p className="text-[10px] font-normal text-slate-900">1-4F, Building 5, Yusheng Industrial Park, No.467, Section Xixiang, Bao An District, Shenzhen, China</p>
                <p className="text-[10px] font-normal text-slate-900">Website: www.kebospower.com</p>
                <p className="text-[10px] font-normal text-slate-900">Email: alicehe@kebospower.com</p>
                <p className="text-[10px] font-normal text-slate-900">Contact: Alice He   Tel :86-0755-86016601 Ext.8511              Mobile/WhatsApp/Wechat: 0086-13927276161</p>
              </div>
            </div>

            {/* 客户与日期 */}
            <div className="flex justify-between items-end mb-4 px-1">
              <div className="space-y-1">
                <p className="text-[11px] font-normal text-slate-900">To: {quote.customer}</p>
                <p className="text-[11px] font-normal text-slate-900">From: Alice he</p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-[11px] font-normal text-slate-900">Date: {formatDateToEnglish(quote.date)}</p>
              </div>
            </div>

            <div className="text-center font-black py-4 text-base tracking-wide text-slate-900 mb-2">
              KEBOS  UPS Quotation
            </div>

            {/* 型号表格 */}
            <table className="w-full border-collapse border border-black text-center table-fixed bg-white">
              <thead className="print:display-table-header-group">
                <tr className="text-[10px] bg-[#F2F2F2]">
                  <th className="border border-black p-2 w-[5%] align-middle font-normal">Item</th>
                  <th className="border border-black p-2 w-[16%] align-middle font-normal">Model#</th>
                  <th className="border border-black p-2 w-[44%] text-center align-middle font-normal">Product description</th>
                  <th className="border border-black p-2 w-[12%] text-center align-middle leading-tight font-normal">
                    {priceHeaderLabel}<br/>({currencyUnit})
                  </th>
                  <th className="border border-black p-2 w-[10%] text-center align-middle leading-tight whitespace-pre-wrap font-normal">
                    {moqHeaderLabel}
                  </th>
                  <th className="border border-black p-2 w-[13%] text-center align-middle leading-tight whitespace-pre-wrap font-normal">Total<br/>PRICE({currencyUnit})</th>
                </tr>
              </thead>
              <tbody className="text-[10px]">
                {quote.items.map((item, idx) => (
                  <tr key={idx} className="print:break-inside-avoid">
                    <td className="border border-black p-2 align-middle">{idx + 1}</td>
                    <td className="border border-black p-2 align-middle font-normal break-all">{item.kebosModel}</td>
                    <td className="border border-black p-2 text-left whitespace-pre-wrap leading-relaxed align-middle break-words font-normal">
                      {item.description}
                    </td>
                    <td className="border border-black p-2 align-middle font-normal">{currencySymbol}{Math.round(item.salesPrice).toLocaleString()}</td>
                    <td className="border border-black p-2 align-middle font-normal">{item.moq}</td>
                    <td className="border border-black p-2 align-middle text-center font-normal">{currencySymbol}{Math.round(item.salesPrice * item.moq).toLocaleString()}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} className="border border-black p-2 text-center align-middle uppercase text-[10px] font-normal">TOTAL</td>
                  <td className="border border-black p-2 text-center align-middle text-[10px] font-normal">{currencySymbol}{Math.round(quote.totalAmount).toLocaleString('en-US')}</td>
                </tr>
              </tbody>
            </table>

            {/* 备注区 */}
            <div className="mt-8 space-y-1 print:break-inside-avoid" style={{ fontSize: '11px' }}>
              <div className="mb-1 text-[12px] font-normal text-slate-900">Remarks:</div>
              <div className="space-y-0.5 text-slate-900 font-normal">
                <div>1.This price is EX Factory.</div>
                <div>2.Order to determine 4-5 WEEKS of delivery.</div>
                <div>3.Payment: 30% deposit, to be settled before shipment.</div>
                <div>4.This offer open from {formatDateToEnglish(quote.date)} to {formatDateToEnglish(new Date(new Date(quote.date).getTime() + 30*86400000).toISOString())}.</div>
                <div>5.Warranty period: 1 years</div>
                {(hasSampleItem || hasLowQtyItem) && <div>6.For quantities less than MOQ, the price is for evaluation only.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteDetailModal;



