import { io } from 'socket.io-client';
import { api } from './api.js';

const socketUrl = import.meta.env.VITE_SOCKET_URL || '/';
const socketOptions = {
  autoConnect: false,
  auth: (callback) => {
    api.get('/auth/socket-token')
      .then(({ data }) => callback({ token: data.token }))
      .catch(() => callback({ token: '' }));
  },
};

if (import.meta.env.VITE_SOCKET_URL) socketOptions.transports = ['websocket'];

export const socket = io(socketUrl, socketOptions);
