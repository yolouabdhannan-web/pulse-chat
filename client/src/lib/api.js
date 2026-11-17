import axios from 'axios';
export const api = axios.create({ baseURL: '/api', withCredentials: true });
export const errMsg = (e, fallback = 'Une erreur est survenue') => e?.response?.data?.error || fallback;
