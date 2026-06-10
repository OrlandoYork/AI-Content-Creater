import axios from 'axios';
import { message } from 'antd';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor — unwrap data, handle errors
api.interceptors.response.use(
  (res) => res.data,
  (error) => {
    const msg =
      error.response?.data?.detail || error.message || 'Network Error';
    message.error(msg);
    return Promise.reject(error);
  }
);

export default api;
