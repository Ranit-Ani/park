import { io } from 'socket.io-client';
import { getUser } from './api';

// One shared socket for the whole app. Since backend + frontend are served
// from the same Render Web Service, no URL/CORS config is needed here —
// io() with no args connects to the same origin the page was loaded from.
let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io({
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      const user = getUser();
      // Join a room matching the user's role so admin-only events
      // (e.g. new bookings, revenue) don't get sent to every visitor.
      if (user?.role) socket.emit('join', user.role);
    });
  }
  return socket;
}
