
import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, User as UserIcon, Trash2, Key, CheckCircle2, X, Lock, RefreshCw } from 'lucide-react';
import { User } from '../types';
import ApiService from '../services/cloudService';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'staff' as const });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const data = await ApiService.getUsers();
    setUsers(data);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (users.some(u => u.username.toLowerCase() === newUser.username.toLowerCase())) {
      setMsg('错误：用户名已存在');
      return;
    }
    const updated = await ApiService.createUser(newUser.username, newUser.password, newUser.role);
    setUsers(updated);
    setIsAdding(false);
    setNewUser({ username: '', password: '', role: 'staff' });
    setMsg('用户创建成功');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !newPassword) return;
    
    const updated = await ApiService.resetUserPassword(resetPasswordUser, newPassword);
    setUsers(updated);
    setResetPasswordUser(null);
    setNewPassword('');
    setMsg(`用户 ${resetPasswordUser} 的密码已重置`);
    setTimeout(() => setMsg(''), 3000);
  };

  const deleteUser = async (username: string) => {
    if (username === 'admin') return alert('不能删除系统管理员');
    if (window.confirm(`确定删除用户 ${username} 吗？`)) {
      const updated = await ApiService.deleteUser(username);
      setUsers(updated);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">用户权限管理</h1>
          <p className="text-slate-500 text-xs font-medium mt-1 uppercase tracking-wider">USER ACCESS CONTROL</p>
        </div>
        <button onClick={() => setIsAdding(true)} className="bg-blue-600 text-white px-5 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all active:scale-95">
          <UserPlus size={18} /> 新增账号
        </button>
      </div>

      {msg && (
        <div className="p-4 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl text-xs font-bold flex items-center gap-3 animate-in slide-in-from-top-4">
          <div className="p-1 bg-emerald-600 text-white rounded-full"><CheckCircle2 size={12}/></div>
          {msg}
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">用户信息</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">角色权限</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">操作管理</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(user => (
                <tr key={user.username} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl text-slate-400 flex items-center justify-center font-black">
                        {user.username.substring(0, 1).toUpperCase()}
                      </div>
                      <span className="font-bold text-slate-800">{user.username}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${user.role === 'admin' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                      {user.role === 'admin' ? '系统管理员' : '普通员工'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setResetPasswordUser(user.username)}
                        title="重置密码"
                        className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-all shadow-sm"
                      >
                        <Key size={16} />
                      </button>
                      <button 
                        onClick={() => deleteUser(user.username)}
                        title="删除账号"
                        className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 rounded-xl transition-all shadow-sm"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 新增用户弹窗 */}
      {isAdding && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAdd} className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-2">
               <h2 className="text-xl font-black text-slate-900">创建新账号</h2>
               <button type="button" onClick={() => setIsAdding(false)} className="p-2 bg-slate-100 rounded-full"><X size={16}/></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">用户名</label>
                <input type="text" placeholder="输入识别ID" required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">初始密码</label>
                <input type="password" placeholder="建议使用复杂组合" required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">职权等级</label>
                <select className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})}>
                  <option value="staff">员工 (普通权限)</option>
                  <option value="admin">管理员 (最高权限)</option>
                </select>
              </div>
            </div>
            <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 active:scale-95 transition-all">立即激活账号</button>
          </form>
        </div>
      )}

      {/* 重置密码弹窗 */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleResetPassword} className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 space-y-6 animate-in zoom-in-95 duration-200 text-center">
            <div className="inline-flex p-4 bg-blue-50 text-blue-600 rounded-3xl mb-2">
               <RefreshCw size={32} />
            </div>
            <h2 className="text-xl font-black text-slate-900">重置用户密码</h2>
            <p className="text-xs text-slate-500">正在修改账号 <span className="text-blue-600 font-black">{resetPasswordUser}</span> 的登录凭证</p>
            <div className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">设置新密码</label>
                <div className="relative">
                   <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                   <input 
                    type="password" 
                    placeholder="输入新密码" 
                    required 
                    autoFocus
                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                   />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setResetPasswordUser(null)} className="flex-1 py-4 text-slate-400 font-bold">取消</button>
              <button type="submit" className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl active:scale-95">更新密码</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
