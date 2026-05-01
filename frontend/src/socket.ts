import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function joinSessionRoom(sessionId: string) {
  getSocket().emit('join:session', sessionId);
}

export function leaveSessionRoom(sessionId: string) {
  getSocket().emit('leave:session', sessionId);
}
