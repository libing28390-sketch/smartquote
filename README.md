# SmartQuote

SmartQuote 是一个面向 UPS 与备件业务的报价、订单、客户和产品管理系统。前端使用 React + Vite，后端使用 Node.js 原生 HTTP 服务，业务数据默认持久化在本地 JSON 文件中，适合单机部署、小团队内网使用和本地快速交付。

## 快速启动

最常用的启动方式如下。

仓库默认以“空数据模板”方式发布：

- 不附带客户、报价、订单等业务数据
- 首次启动后端时，会自动在 data 目录下初始化运行所需 JSON 文件
- 如果 data/users.json 为空，系统会自动生成默认管理员账号

分别启动前后端：

```bash
npm install
npm run server
npm run dev
```

启动后访问地址：

- 后端接口：http://127.0.0.1:5001
- 后端健康检查：http://127.0.0.1:5001/api/health
- 前端开发页：http://127.0.0.1:5174

说明：

- 如果 5174 被占用，Vite 会在命令行里显示实际启动端口，例如 5175、5176
- 如果你用的是一键脚本，直接双击 [start-smartquote.cmd](start-smartquote.cmd) 即可，它会自动启动并打开浏览器

## 核心能力

- 报价管理：新建、编辑、复制、预览报价，支持利润和毛利率计算
- 订单管理：从报价流转到订单，跟踪状态、回款和执行信息
- 产品管理：维护 UPS 与 Spare Parts 产品资料、系列、成本和销售价格
- 客户管理：维护客户档案、联系人和跟进字段
- 用户管理：支持 admin 和 staff 两类角色，已切换为服务端校验密码
- 导入导出：支持 Excel 导入导出和 PDF 输出
- 数据保护：服务端写入采用临时文件 + 原子替换，并带异常删减保护

## 技术栈

- 前端：React 18、TypeScript、React Router、Vite
- 图表与图标：Recharts、Lucide React
- 导出能力：ExcelJS、jsPDF、jspdf-autotable、file-saver
- 后端：Node.js 原生 HTTP API
- 数据存储：data 目录下的 JSON 文件

## 项目结构

```text
smartquote/
├─ App.tsx
├─ index.tsx
├─ server.js
├─ vite.config.ts
├─ components/
├─ hooks/
├─ services/
├─ data/
├─ backups/
├─ scripts/
│  └─ windows/
├─ public/
├─ pdfGenerator.ts
├─ orderPdfGenerator.ts
├─ types.ts
└─ utils.ts
```

主要目录说明：

- components：页面与业务组件
- services：前端 API 封装
- data：运行中的主数据文件
- backups：构建前自动生成的数据备份
- scripts/windows：Windows 一键启动与停止脚本

## 运行环境

- Node.js 18+
- npm 9+
- Windows 本地运行建议使用 PowerShell 或直接双击启动脚本

## 安装依赖

```bash
npm install
```

如果出现 vite 或其他依赖不存在的问题，先确认已经在项目根目录执行过 npm install。

## 本地开发启动

### 方式一：分别启动前后端

后端：

```bash
npm run server
```

前端：

```bash
npm run dev
```

默认配置：

- 后端地址：http://127.0.0.1:5001
- 前端优先端口：http://127.0.0.1:5174
- Vite 会将 /api 代理到 http://localhost:5001

说明：如果 5174 已被占用，手动执行 npm run dev 时 Vite 可能自动切换到下一个可用端口。

### 方式二：Windows 双击一键启动

根目录提供了两个 Windows 启动脚本：

- start-smartquote.cmd：启动后端、启动前端、等待就绪后自动打开 Chrome
- stop-smartquote.cmd：停止由启动脚本拉起的前后端进程

实际逻辑位于：

- scripts/windows/start-smartquote.ps1
- scripts/windows/stop-smartquote.ps1

一键启动脚本的行为：

- 优先复用已经健康运行的后端服务
- 前端优先尝试 5174，若占用则自动寻找 5174-5194 之间的可用端口
- 自动打开检测到的 Chrome
- 将 PID 和前端端口写入 scripts/windows/runtime 目录，便于停止和复用

如果 Chrome 安装目录变化，启动脚本会按以下顺序自动查找：

- 环境变量 SMARTQUOTE_CHROME_PATH
- Windows 注册表 App Paths
- PATH 中的 chrome 或 chrome.exe
- 常见安装目录

如果你需要手工指定 Chrome，可先设置：

```powershell
$env:SMARTQUOTE_CHROME_PATH = 'D:\Apps\Chrome\chrome.exe'
```

## 默认账号说明

后端会在 users.json 不存在或为空时自动创建初始管理员账号：

- 用户名：admin
- 密码：admin888

如果 data/users.json 已经存在，则以该文件中的实际账号为准，不会强行重置默认密码。

说明：

- GitHub 仓库默认不会保留你的真实业务数据和用户数据
- 首次在本地执行 npm run server 后，如果 users.json 为空，系统会自动写入 admin 初始账号
- 启动后如果你看到 data 目录里重新出现 JSON 文件，这属于正常初始化行为

## 数据文件

系统默认使用 data 目录下的 JSON 文件保存业务数据：

- data/users.json：用户
- data/products.json：产品
- data/customers.json：客户
- data/quotes.json：报价
- data/orders.json：订单

说明：

- GitHub 仓库默认提交的是空数据模板，运行后会在本地生成实际数据
- 当前项目既是源码目录，也承载运行数据
- 执行构建前会先做一次数据备份
- 不建议直接手改运行中的 JSON 文件，优先通过系统界面维护

## 构建与预览

构建：

```bash
npm run build
```

执行流程：

1. 先运行 scripts/backup_data.js，备份 data 目录
2. 再执行 Vite 构建，输出到 dist 目录

预览构建产物：

```bash
npm run preview
```

## 认证与用户管理

当前版本已经调整为服务端认证：

- 前端不再做本地密码比对
- 密码在服务端以 scrypt 哈希保存
- 旧版 Base64 密码会在登录或服务启动时自动迁移

当前提供的用户相关接口包括：

- POST /api/auth/login
- GET /api/users
- POST /api/users/create
- POST /api/users/delete
- POST /api/users/reset-password
- POST /api/users/profile
- POST /api/users/change-password

## 业务接口

基础健康检查：

- GET /api/health

集合类数据接口：

- GET /api/products
- POST /api/products
- GET /api/customers
- POST /api/customers
- GET /api/quotes
- POST /api/quotes
- GET /api/orders
- POST /api/orders

说明：

- 这些 POST 接口当前仍是整表覆盖写入
- 服务端带有简单的数据保护逻辑，防止异常性大幅删空
- 前端在部分场景下会读取本地缓存作为兜底

## 主要页面

- Dashboard：经营概览
- ProductList：产品库
- CustomerList：客户库
- QuoteList：报价列表
- QuoteForm：新建与编辑报价
- OrderList：订单列表
- OrderForm：新建与编辑订单
- UserManagement：用户管理
- ProfileSettings：个人设置
- Login：登录页

## 当前业务模型补充

近期已经完成的结构性调整包括：

- 产品库新增工厂料号字段 factoryPartNumber
- 报价页和产品页的销售价格与成本价格保留 2 位小数
- 用户认证从前端校验迁移到后端
- Windows 一键启动脚本支持自动识别 Chrome 安装路径

## 常用命令

```bash
npm run dev
npm run server
npm run backup
npm run build
npm run preview
```

## 运维脚本说明

scripts 目录下还保留了一些偏 Linux 服务器使用的脚本：

- scripts/start_pm2.sh：使用 PM2 启动服务
- scripts/stop.sh：停止服务
- scripts/restart.sh：重启服务
- scripts/status.sh：查看服务状态
- scripts/monitor.sh：监控脚本
- scripts/setup_mail_task.sh：设置邮件备份定时任务

这些脚本不是 Windows 本地开发的主流程。

## 使用建议

- 发布前先执行 npm run backup
- 构建前确认 data 目录中的 JSON 数据完整
- 如果要迁移环境，务必连同 data 和 backups 一并备份
- 如果 5001 或 5174 被占用，优先排查本机已有实例，而不是直接改代码端口

## 后续建议

从长期维护角度看，下一阶段更值得投入的方向是：

- 将整表覆盖接口逐步改造成单条增删改接口
- 增加真正的登录会话或 token 机制
- 将前端价格计算逻辑抽离成统一模块，避免多处重复
- 把 data 目录数据迁移到数据库，降低并发写入风险
