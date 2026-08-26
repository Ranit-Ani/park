import { io } from 'socket.io-client';
import { getUser } from './api';

// One shared socket for the whole app. On Render, backend + frontend are
// served from the same origin, so io() with no URL connects to the page's
// own origin. Inside the Capacitor Android app the page is loaded from
// capacitor://localhost (no backend there), so we need to point the socket
// at the real backend explicitly via VITE_API_BASE_URL — same variable used
// by api.js. Leave it unset for the web build to keep the old behavior.
const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || undefined;

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
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
