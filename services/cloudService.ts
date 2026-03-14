
import { Product, Quote, User, Customer } from '../types';

class ApiService {
  private static get BASE_URL() {
    return '/api';
  }

  private static getLocal<T>(key: string): T | null {
    const data = localStorage.getItem(`kebos_storage_${key}`);
    return data ? JSON.parse(data) : null;
  }

  private static setLocal(key: string, data: any) {
    localStorage.setItem(`kebos_storage_${key}`, JSON.stringify(data));
  }

  private static async request(endpoint: string, options: any = {}) {
    const url = `${this.BASE_URL}/${endpoint}`;
    const cacheableCollections = new Set(['products', 'customers', 'quotes', 'orders']);
    
    if (options.method === 'POST' && options.body && cacheableCollections.has(endpoint)) {
      try {
        this.setLocal(endpoint, JSON.parse(options.body));
      } catch (e) {
        console.error(`[ApiService] Failed to save local cache for ${endpoint}`, e);
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentType = response.headers.get('content-type') || '';
      let data: any = null;
      if (response.status !== 204) {
        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          if (text) {
            try {
              data = JSON.parse(text);
            } catch {
              data = text;
            }
          }
        }
      }

      if (cacheableCollections.has(endpoint) && Array.isArray(data) && data.length === 0 && (!options.method || options.method === 'GET')) {
        const localData = this.getLocal<any[]>(endpoint);
        if (localData && Array.isArray(localData) && localData.length > 0) {
          console.log(`[ApiService] 检测到服务器无数据，正在自动同步本地 ${endpoint} 数据到云端...`);
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localData)
          });
          return localData;
        }
      }
      
      if (cacheableCollections.has(endpoint) && (!options.method || options.method === 'GET')) {
        this.setLocal(endpoint, data);
      }
      
      return data;
    } catch (e: any) {
      console.error(`[ApiService] 同步失败: ${url}`, e);
      
      const cached = this.getLocal(endpoint);
      if (cached) return cached;

      return null;
    }
  }

  static async authenticate(username: string, password: string): Promise<User | null> {
    const result = await this.request('auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    return result?.user || null;
  }

  static async getUsers(): Promise<User[]> {
    return (await this.request('users')) || [];
  }

  static async createUser(username: string, password: string, role: User['role']): Promise<User[]> {
    const result = await this.request('users/create', {
      method: 'POST',
      body: JSON.stringify({ username, password, role })
    });
    return result?.users || [];
  }

  static async resetUserPassword(username: string, newPassword: string): Promise<User[]> {
    const result = await this.request('users/reset-password', {
      method: 'POST',
      body: JSON.stringify({ username, newPassword })
    });
    return result?.users || [];
  }

  static async deleteUser(username: string): Promise<User[]> {
    const result = await this.request('users/delete', {
      method: 'POST',
      body: JSON.stringify({ username })
    });
    return result?.users || [];
  }

  static async updateProfile(payload: Pick<User, 'username' | 'realName' | 'phoneNumber' | 'email'>): Promise<User | null> {
    const result = await this.request('users/profile', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return result?.user || null;
  }

  static async changePassword(username: string, oldPassword: string, newPassword: string): Promise<boolean> {
    const result = await this.request('users/change-password', {
      method: 'POST',
      body: JSON.stringify({ username, oldPassword, newPassword })
    });
    return !!result?.ok;
  }

  static async fetchProducts(): Promise<Product[] | null> {
    return await this.request('products');
  }

  static async saveProducts(products: Product[]): Promise<void> {
    await this.request('products', { method: 'POST', body: JSON.stringify(products) });
  }

  static async fetchCustomers(): Promise<Customer[] | null> {
    return await this.request('customers');
  }

  static async saveCustomers(customers: Customer[]): Promise<void> {
    await this.request('customers', { method: 'POST', body: JSON.stringify(customers) });
  }

  static async fetchQuotes(): Promise<Quote[] | null> {
    return await this.request('quotes');
  }

  static async saveQuotes(quotes: Quote[]): Promise<void> {
    await this.request('quotes', { method: 'POST', body: JSON.stringify(quotes) });
  }

  static async fetchOrders(): Promise<any[] | null> {
    return await this.request('orders');
  }

  static async saveOrders(orders: any[]): Promise<void> {
    await this.request('orders', { method: 'POST', body: JSON.stringify(orders) });
  }
}

export default ApiService;
