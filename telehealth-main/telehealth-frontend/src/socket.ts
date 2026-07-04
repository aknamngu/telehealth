import { io } from 'socket.io-client';

// Kết nối thẳng tới cổng Backend NestJS WebSocket
export const socket = io('http://localhost:3000', {
  autoConnect: false, // Mình sẽ chủ động connect khi user vào phòng khám
});