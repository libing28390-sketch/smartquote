
import React, { useState } from 'react';
import { User as UserIcon, Lock, ArrowRight, Server, RefreshCw, FileText, Info, AlertTriangle } from 'lucide-react';
import { User } from '../types';
import ApiService from '../services/cloudService';

interface LoginProps {
  onLogin: (user: User) => void;
  logo: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, logo }) => {
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await ApiService.authenticate(username, password);
      if (user) {
        onLogin(user);
      } else {
        setError('认证失败：账号或密码不匹配。');
      }
    } catch (err) {
      setError('连接服务超时，请检查后端状态。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,95,91,0.24),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(198,124,47,0.18),transparent_24%),linear-gradient(180deg,#0f172a_0%,#09111d_100%)] flex items-center justify-center p-4 z-[200]">
      <div className="w-full max-w-6xl grid lg:grid-cols-[1.1fr_0.9fr] bg-white/8 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden backdrop-blur-xl">
        <section className="hidden lg:flex flex-col justify-between p-10 bg-[linear-gradient(180deg,rgba(15,95,91,0.34),rgba(15,23,42,0.25))] border-r border-white/10">
          <div>
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 text-white text-[11px] font-black uppercase tracking-[0.24em]">
              <Server size={14} />
              SmartQuote ERP Portal
            </div>
            <div className="mt-8 inline-flex p-5 rounded-[1.6rem] bg-white shadow-xl">
              <img src={logo} alt="KEBOS Logo" className="h-12 object-contain" />
            </div>
            <h1 className="mt-8 text-4xl font-black text-white tracking-tight leading-tight">让报价、订单、客户与产品数据在同一工作台里协同。</h1>
            <p className="mt-4 text-sm text-slate-200/80 leading-7 max-w-xl">如果这是一个真正拿来做业务的 ERP，登录页就不该只是一个表单，而应该先告诉用户他即将进入什么系统、处理什么工作，以及这套系统的操作重心是什么。</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-[1.4rem] bg-white/10 border border-white/10 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-200/60">报价</div>
              <div className="mt-3 text-2xl font-black text-white">Quote</div>
              <div className="mt-1 text-xs text-slate-200/70">利润、汇率、型号统一核算</div>
            </div>
            <div className="rounded-[1.4rem] bg-white/10 border border-white/10 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-200/60">订单</div>
              <div className="mt-3 text-2xl font-black text-white">Order</div>
              <div className="mt-1 text-xs text-slate-200/70">跟踪状态、发运和回款</div>
            </div>
            <div className="rounded-[1.4rem] bg-white/10 border border-white/10 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-200/60">主数据</div>
              <div className="mt-3 text-2xl font-black text-white">Master</div>
              <div className="mt-1 text-xs text-slate-200/70">产品、客户与账号统一维护</div>
            </div>
          </div>
        </section>

        <section className="p-8 sm:p-10 lg:p-12 bg-[linear-gradient(180deg,rgba(9,17,29,0.92),rgba(15,23,42,0.94))]">
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex p-4 rounded-3xl bg-white shadow-xl mb-6">
              <img src={logo} alt="KEBOS Logo" className="h-10 object-contain" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight uppercase">SmartQuote 报价系统</h1>
            <p className="text-slate-500 text-[10px] mt-2 font-black uppercase tracking-[0.2em]">Enterprise Power Solutions</p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="mb-8">
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#8dc8c3]">Sign In Workspace</div>
              <h2 className="mt-3 text-3xl font-black text-white tracking-tight">进入业务工作台</h2>
              <p className="mt-2 text-sm text-slate-400">登录后即可进入报价、订单、客户和产品的统一 ERP 工作区。</p>
            </div>

            {mode === 'login' ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="relative group">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-[#8dc8c3] transition-colors" size={18} />
                    <input type="text" title="用户名" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-slate-800/70 border border-slate-700 text-white pl-12 pr-4 py-4 rounded-2xl outline-none focus:border-[#8dc8c3] font-bold transition-all" placeholder="用户名" required />
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-[#8dc8c3] transition-colors" size={18} />
                    <input type="password" title="登录密码" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-800/70 border border-slate-700 text-white pl-12 pr-4 py-4 rounded-2xl outline-none focus:border-[#8dc8c3] font-bold transition-all" placeholder="登录密码" required />
                  </div>
                </div>

                {error && <div className="text-rose-400 text-xs font-bold text-center bg-rose-500/10 py-3 rounded-xl border border-rose-500/20">{error}</div>}

                <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4 text-xs text-slate-300 leading-6">
                  <div className="flex items-center gap-2 font-black text-slate-200 mb-2"><FileText size={14} /> 登录提示</div>
                  <div>推荐使用管理员维护后的正式账号。若 users.json 为空，系统才会自动生成初始管理员账号。</div>
                </div>

                <button type="submit" disabled={loading} className="w-full bg-[#0f5f5b] hover:bg-[#11716c] text-white font-black py-4 rounded-2xl shadow-xl shadow-[#0f5f5b]/20 flex items-center justify-center gap-3 transition-all active:scale-95">
                  {loading ? <RefreshCw className="animate-spin" /> : <>进入系统 <ArrowRight size={20} /></>}
                </button>

                <button type="button" onClick={() => setMode('forgot')} className="w-full text-slate-500 text-xs font-bold hover:text-slate-300">忘记密码？</button>
              </form>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-bottom duration-300">
                <div className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-3xl space-y-4">
                  <div className="inline-flex p-3 bg-blue-600 text-white rounded-2xl shadow-lg">
                    <Info size={24} />
                  </div>
                  <h2 className="text-white font-black text-lg">无法访问账号？</h2>
                  <p className="text-slate-400 text-xs leading-relaxed">出于安全考虑，系统未开放自助找回密码功能。</p>
                  <div className="bg-slate-950/50 p-6 rounded-2xl border border-white/5">
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      请直接联系您的<span className="text-white font-bold">系统管理员</span>重置凭证。
                      <br/><br/>
                      如果是管理员账号丢失，请联系技术支持团队进行物理重置。
                    </p>
                  </div>
                </div>
                <button onClick={() => setMode('login')} className="w-full text-slate-500 text-xs font-bold py-2">返回登录界面</button>
              </div>
            )}

            <div className="mt-10 pt-6 border-t border-slate-800 text-center flex items-center justify-center gap-2 text-slate-700 font-black text-[10px] tracking-widest">
              <Server size={12} /> ENCRYPTED LOCAL SESSION
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Login;
