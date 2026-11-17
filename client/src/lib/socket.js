import { io } from 'socket.io-client';
import { api } from './api.js';

const remoteSocketUrl = import.meta.env.VITE_SOCKET_URL
  || (import.meta.env.PROD ? 'https://pulse-chat-hecm-zzgt.onrender.com' : '');
const socketUrl = remoteSocketUrl || '/';
const socketOptions = {
  autoConnect: false,
  auth: (callback) => {
    api.get('/auth/socket-token')
      .then(({ data }) => callback({ token: data.token }))
      .catch(() => callback({ token: '' }));
  },
};

if (remoteSocketUrl) socketOptions.transports = ['websocket'];

export const socket = io(socketUrl, socketOptions);
