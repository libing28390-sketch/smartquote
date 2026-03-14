import React, { useState } from 'react';
import { Key, Save, AlertCircle, CheckCircle2, User as UserIcon } from 'lucide-react';
import { User } from '../types';
import ApiService from '../services/cloudService';

interface ProfileSettingsProps {
  user: User;
  onUserUpdated: (user: User) => void;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ user, onUserUpdated }) => {
  const [realName, setRealName] = useState(user.realName || '');
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [email, setEmail] = useState(user.email || '');
  
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' });

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    
    try {
      const updatedUser = await ApiService.updateProfile({
        username: user.username,
        realName,
        phoneNumber,
        email
      });
      if (!updatedUser) throw new Error('Profile update failed');
      
      localStorage.setItem('kebos_current_user', JSON.stringify(updatedUser));
      onUserUpdated(updatedUser);
      
      setMsg({ type: 'success', text: '个人资料已更新' });
    } catch (e) {
      setMsg({ type: 'error', text: '保存失败' });
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      return setMsg({ type: 'error', text: '两次输入的新密码不一致' });
    }

    try {
      const ok = await ApiService.changePassword(user.username, oldPassword, newPassword);
      if (!ok) {
        throw new Error('Password change failed');
      }
      setMsg({ type: 'success', text: '密码已成功更新，下次登录生效。' });
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (e) {
      setMsg({ type: 'error', text: '原密码错误或保存失败，请检查网络' });
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="text-center">
        <div className="inline-flex p-4 bg-white rounded-2xl shadow-sm border border-slate-100 mb-4">
          <UserIcon className="text-blue-600" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">个人设置</h1>
        <p className="text-slate-500 text-xs">账号: <span className="font-bold">{user.username}</span></p>
      </div>

      <div className="space-y-6">
        {/* Profile Info Form */}
        <form onSubmit={handleUpdateProfile} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-5">
           <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
             <span className="w-1 h-4 bg-blue-600 rounded-full"></span>
             基本资料
           </h2>
           <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">真实姓名 / 显示名称</label>
            <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700" value={realName} onChange={e => setRealName(e.target.value)} placeholder="例如: 张三" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">联系电话</label>
            <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="例如: 13800000000" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">电子邮箱</label>
            <input type="email" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700" value={email} onChange={e => setEmail(e.target.value)} placeholder="例如: sales@kebos.com" />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
            <Save size={18} /> 更新资料
          </button>
        </form>

        {/* Password Form */}
        <form onSubmit={handleUpdatePassword} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-5">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
             <span className="w-1 h-4 bg-rose-500 rounded-full"></span>
             安全设置
           </h2>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">当前旧密码</label>
            <input type="password" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">设置新密码</label>
            <input type="password" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">确认新密码</label>
            <input type="password" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          </div>

          {msg.text && (
            <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
              {msg.type === 'success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
              {msg.text}
            </div>
          )}

          <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
            <Key size={18} /> 更新密码
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfileSettings;