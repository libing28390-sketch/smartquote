
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const renderApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("Critical: Root element not found");
    return;
  }

  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>
    );
  } catch (err) {
    console.error("Mounting error:", err);
    rootElement.innerHTML = `<div style="padding:20px; color:red; font-family:sans-serif;">
      <h2>系统启动失败</h2>
      <p>模块解析冲突，请尝试刷新页面。如果问题持续，请检查网络连接。</p>
      <pre>${err instanceof Error ? err.message : String(err)}</pre>
    </div>`;
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderApp);
} else {
  renderApp();
}

