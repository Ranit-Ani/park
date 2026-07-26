const { Server } = require('socket.io');

let io = null;

/**
 * Attach Socket.io to the existing HTTP server.
 * Call this once from server.js after creating the http server.
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // Optional: let clients join a room for their role, so admin-only
    // events don't need to be broadcast to every single user.
    socket.on('join', (room) => {
      if (['admin', 'staff', 'user'].includes(room)) {
        socket.join(room);
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });

  return io;
}

/**
 * Get the io instance from anywhere in the backend (controllers, services).
 * Throws if called before initSocket() — that would be a setup bug.
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initSocket(server) first.');
  }
  return io;
}

module.exports = { initSocket, getIO };
