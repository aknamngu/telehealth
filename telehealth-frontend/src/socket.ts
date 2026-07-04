import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000';

// Kết nối tới backend WebSocket, có thể đổi bằng VITE_SOCKET_URL
export const socket = io(SOCKET_URL, {
  autoConnect: false, // Mình sẽ chủ động connect khi user vào phòng khám
});