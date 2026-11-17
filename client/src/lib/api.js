import axios from 'axios';
export const api = axios.create({ baseURL: '/api', withCredentials: true });
export const errMsg = (e, fallback = 'Une erreur est survenue') => {
  if (e?.response?.data?.error) return e.response.data.error;
  if (e?.response?.status === 404) return 'Le serveur de messagerie est introuvable. Vérifiez que l’API Render est déployée et que son adresse est correcte.';
  if (!e?.response) return 'Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.';
  if (e.response.status >= 500) return `Le serveur rencontre un problème (HTTP ${e.response.status}). Réessayez plus tard.`;
  return fallback;
};
