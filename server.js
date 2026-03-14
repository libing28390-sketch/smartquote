
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5001;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
const QUOTES_FILE = path.join(DATA_DIR, 'quotes.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

const PASSWORD_PREFIX = 'scrypt';
const DEFAULT_ADMIN = {
  username: 'admin',
  passwordHash: null,
  role: 'admin'
};

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
};

const readData = (file, fallback = []) => {
  if (!fs.existsSync(file)) return fallback;
  try {
    const content = fs.readFileSync(file, 'utf8');
    return content ? JSON.parse(content) : fallback;
  } catch (e) {
    console.error(`读取文件失败: ${file}`, e);
    return fallback;
  }
};

const safeWriteData = (file, data, allowEmpty = false) => {
  const tempFile = `${file}.tmp`;
  try {
    if (!allowEmpty && fs.existsSync(file)) {
      const existingContent = fs.readFileSync(file, 'utf8');
      if (existingContent) {
        try {
          const existingData = JSON.parse(existingContent);
          if (Array.isArray(existingData) && existingData.length > 5) {
            if (!Array.isArray(data) || data.length === 0) {
              console.error(`[DLP] 拒绝写入：试图将 ${existingData.length} 条数据覆盖为空数组。File: ${file}`);
              return false;
            }
            if (data.length < existingData.length * 0.2) {
              console.error(`[DLP] 拒绝写入：数据量骤减警告 (${existingData.length} -> ${data.length})。File: ${file}`);
              return false;
            }
          }
        } catch {
          console.warn(`[DLP] 现有文件损坏，允许覆盖: ${file}`);
        }
      }
    }

    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, file);
    return true;
  } catch (e) {
    console.error(`原子写入失败: ${file}`, e);
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    return false;
  }
};

const parseRequestBody = (req) => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });
  req.on('end', () => {
    if (!body) {
      resolve({});
      return;
    }
    try {
      resolve(JSON.parse(body));
    } catch (error) {
      reject(error);
    }
  });
  req.on('error', reject);
});

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${PASSWORD_PREFIX}$${salt}$${hash}`;
};

const isLegacyBase64Password = (storedValue) => {
  if (typeof storedValue !== 'string' || !storedValue) return false;
  try {
    const decoded = Buffer.from(storedValue, 'base64').toString('utf8');
    return Buffer.from(decoded, 'utf8').toString('base64') === storedValue;
  } catch {
    return false;
  }
};

const verifyPassword = (password, storedHash) => {
  if (!storedHash || typeof storedHash !== 'string') {
    return { matched: false, upgradedHash: null };
  }

  if (storedHash.startsWith(`${PASSWORD_PREFIX}$`)) {
    const [, salt, hash] = storedHash.split('$');
    if (!salt || !hash) return { matched: false, upgradedHash: null };
    const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
    const matched = crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
    return { matched, upgradedHash: null };
  }

  if (!isLegacyBase64Password(storedHash)) {
    return { matched: false, upgradedHash: null };
  }

  const legacyPassword = Buffer.from(storedHash, 'base64').toString('utf8');
  if (legacyPassword !== password) {
    return { matched: false, upgradedHash: null };
  }

  return { matched: true, upgradedHash: hashPassword(password) };
};

const sanitizeUser = (user) => ({
  username: user.username,
  role: user.role,
  realName: user.realName,
  phoneNumber: user.phoneNumber,
  email: user.email,
});

const ensureUsersFile = () => {
  if (fs.existsSync(USERS_FILE)) return;
  const defaultUsers = [{ ...DEFAULT_ADMIN, passwordHash: hashPassword('admin888') }];
  safeWriteData(USERS_FILE, defaultUsers, true);
};

const loadUsers = () => {
  ensureUsersFile();
  const users = readData(USERS_FILE, []);
  if (Array.isArray(users) && users.length > 0) {
    return users;
  }
  const defaultUsers = [{ ...DEFAULT_ADMIN, passwordHash: hashPassword('admin888') }];
  safeWriteData(USERS_FILE, defaultUsers, true);
  return defaultUsers;
};

const saveUsers = (users) => safeWriteData(USERS_FILE, users, true);

const migrateLegacyUserPasswords = () => {
  const users = loadUsers();
  let changed = false;
  const migratedUsers = users.map(user => {
    if (!isLegacyBase64Password(user.passwordHash)) return user;
    changed = true;
    const plainPassword = Buffer.from(user.passwordHash, 'base64').toString('utf8');
    return { ...user, passwordHash: hashPassword(plainPassword) };
  });

  if (changed) {
    saveUsers(migratedUsers);
    console.log('[Auth] 已自动迁移旧版 Base64 密码为 scrypt 哈希。');
  }
};

migrateLegacyUserPasswords();

const handleCollectionGet = (res, file, fallback = []) => {
  const data = readData(file, fallback);
  sendJson(res, 200, data);
};

const handleCollectionSave = async (req, res, file) => {
  try {
    const payload = await parseRequestBody(req);
    const success = safeWriteData(file, payload);
    if (!success) {
      sendJson(res, 409, { ok: false, message: 'Data Protection Block: Potential data loss detected. Write rejected.' });
      return;
    }
    sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error('Invalid JSON body', error);
    sendJson(res, 400, { ok: false, message: 'Invalid JSON' });
  }
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const pathname = req.url.split('?')[0];

  try {
    if (pathname === '/api/health') {
      sendJson(res, 200, { status: 'ok', timestamp: Date.now() });
      return;
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const { username, password } = await parseRequestBody(req);
      if (!username || !password) {
        sendJson(res, 400, { ok: false, message: '用户名和密码不能为空。' });
        return;
      }

      const users = loadUsers();
      const userIndex = users.findIndex(user => user.username.toLowerCase() === String(username).toLowerCase());
      if (userIndex === -1) {
        sendJson(res, 401, { ok: false, message: '账号或密码不匹配。' });
        return;
      }

      const user = users[userIndex];
      const { matched, upgradedHash } = verifyPassword(String(password), user.passwordHash);
      if (!matched) {
        sendJson(res, 401, { ok: false, message: '账号或密码不匹配。' });
        return;
      }

      if (upgradedHash) {
        users[userIndex] = { ...user, passwordHash: upgradedHash };
        saveUsers(users);
      }

      sendJson(res, 200, { ok: true, user: sanitizeUser(users[userIndex]) });
      return;
    }

    if (pathname === '/api/users' && req.method === 'GET') {
      sendJson(res, 200, loadUsers().map(sanitizeUser));
      return;
    }

    if (pathname === '/api/users/create' && req.method === 'POST') {
      const { username, password, role = 'staff' } = await parseRequestBody(req);
      if (!username || !password) {
        sendJson(res, 400, { ok: false, message: '用户名和密码不能为空。' });
        return;
      }

      const users = loadUsers();
      if (users.some(user => user.username.toLowerCase() === String(username).toLowerCase())) {
        sendJson(res, 409, { ok: false, message: '用户名已存在。' });
        return;
      }

      users.push({
        username: String(username).trim(),
        passwordHash: hashPassword(String(password)),
        role: role === 'admin' ? 'admin' : 'staff'
      });

      saveUsers(users);
      sendJson(res, 200, { ok: true, users: users.map(sanitizeUser) });
      return;
    }

    if (pathname === '/api/users/delete' && req.method === 'POST') {
      const { username } = await parseRequestBody(req);
      if (!username) {
        sendJson(res, 400, { ok: false, message: '缺少用户名。' });
        return;
      }
      if (String(username).toLowerCase() === 'admin') {
        sendJson(res, 403, { ok: false, message: '不能删除系统管理员。' });
        return;
      }

      const users = loadUsers().filter(user => user.username !== username);
      saveUsers(users);
      sendJson(res, 200, { ok: true, users: users.map(sanitizeUser) });
      return;
    }

    if (pathname === '/api/users/reset-password' && req.method === 'POST') {
      const { username, newPassword } = await parseRequestBody(req);
      if (!username || !newPassword) {
        sendJson(res, 400, { ok: false, message: '缺少必要参数。' });
        return;
      }

      const users = loadUsers();
      const userIndex = users.findIndex(user => user.username === username);
      if (userIndex === -1) {
        sendJson(res, 404, { ok: false, message: '用户不存在。' });
        return;
      }

      users[userIndex] = { ...users[userIndex], passwordHash: hashPassword(String(newPassword)) };
      saveUsers(users);
      sendJson(res, 200, { ok: true, users: users.map(sanitizeUser) });
      return;
    }

    if (pathname === '/api/users/profile' && req.method === 'POST') {
      const { username, realName = '', phoneNumber = '', email = '' } = await parseRequestBody(req);
      if (!username) {
        sendJson(res, 400, { ok: false, message: '缺少用户名。' });
        return;
      }

      const users = loadUsers();
      const userIndex = users.findIndex(user => user.username === username);
      if (userIndex === -1) {
        sendJson(res, 404, { ok: false, message: '用户不存在。' });
        return;
      }

      users[userIndex] = {
        ...users[userIndex],
        realName: String(realName),
        phoneNumber: String(phoneNumber),
        email: String(email),
      };

      saveUsers(users);
      sendJson(res, 200, { ok: true, user: sanitizeUser(users[userIndex]) });
      return;
    }

    if (pathname === '/api/users/change-password' && req.method === 'POST') {
      const { username, oldPassword, newPassword } = await parseRequestBody(req);
      if (!username || !oldPassword || !newPassword) {
        sendJson(res, 400, { ok: false, message: '缺少必要参数。' });
        return;
      }

      const users = loadUsers();
      const userIndex = users.findIndex(user => user.username === username);
      if (userIndex === -1) {
        sendJson(res, 404, { ok: false, message: '用户不存在。' });
        return;
      }

      const user = users[userIndex];
      const { matched } = verifyPassword(String(oldPassword), user.passwordHash);
      if (!matched) {
        sendJson(res, 401, { ok: false, message: '原密码错误。' });
        return;
      }

      users[userIndex] = { ...user, passwordHash: hashPassword(String(newPassword)) };
      saveUsers(users);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pathname === '/api/products') {
      if (req.method === 'GET') {
        handleCollectionGet(res, PRODUCTS_FILE);
        return;
      }
      if (req.method === 'POST') {
        await handleCollectionSave(req, res, PRODUCTS_FILE);
        return;
      }
    }

    if (pathname === '/api/customers') {
      if (req.method === 'GET') {
        const data = readData(CUSTOMERS_FILE);
        console.log(`[GET] /api/customers - Returning ${data.length} records`);
        sendJson(res, 200, data);
        return;
      }
      if (req.method === 'POST') {
        await handleCollectionSave(req, res, CUSTOMERS_FILE);
        return;
      }
    }

    if (pathname === '/api/quotes') {
      if (req.method === 'GET') {
        handleCollectionGet(res, QUOTES_FILE);
        return;
      }
      if (req.method === 'POST') {
        await handleCollectionSave(req, res, QUOTES_FILE);
        return;
      }
    }

    if (pathname === '/api/orders') {
      if (req.method === 'GET') {
        handleCollectionGet(res, ORDERS_FILE);
        return;
      }
      if (req.method === 'POST') {
        await handleCollectionSave(req, res, ORDERS_FILE);
        return;
      }
    }

    res.writeHead(404);
    res.end('Not Found');
  } catch (err) {
    console.error('API Error:', err);
    sendJson(res, 500, { ok: false, message: 'Server Error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n====================================================');
  console.log('SmartQuote 安全增强型后端正在运行...');
  console.log('数据落盘模式: 原子化覆写 (Atomic Write Enabled)');
  console.log(`存储路径: ${DATA_DIR}`);
  console.log('认证模式: 服务端校验 + scrypt 密码哈希');
  console.log(`后端服务地址: http://127.0.0.1:${PORT}`);
  console.log(`健康检查地址: http://127.0.0.1:${PORT}/api/health`);
  console.log('前端开发地址: http://127.0.0.1:5174 (如果端口被占用，Vite 可能自动切换到下一个可用端口)');
  console.log('启动方式: 先执行 npm run server，再在另一个终端执行 npm run dev');
  console.log('====================================================\n');
});

