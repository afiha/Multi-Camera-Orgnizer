import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

interface Device {
  id: string;
  name: string;
  status: "idle" | "ready" | "capturing" | "recording" | "error";
  battery: number;
  cameraAvailable: boolean;
  offset: number; // clock offset in ms
  latency: number; // RTT in ms
  lastSeen: number;
  lastCaptureUrl?: string;
}

interface Room {
  id: string;
  devices: { [deviceId: string]: Device };
  controllerActive: boolean;
  lastSeen: number;
}

// In-memory state
const rooms: { [roomId: string]: Room } = {};

// SSE connections
const sseClients: { [roomId: string]: { deviceId: string; res: express.Response }[] } = {};

function broadcastSSE(roomId: string, data: any) {
  const clients = sseClients[roomId] || [];
  clients.forEach((client) => {
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// Clean up stale rooms and devices every 30 seconds
setInterval(() => {
  const now = Date.now();
  Object.keys(rooms).forEach((roomId) => {
    const room = rooms[roomId];
    // If the entire room has been idle for more than 10 minutes, delete it
    if (now - room.lastSeen > 10 * 60 * 1000) {
      delete rooms[roomId];
      delete sseClients[roomId];
      return;
    }

    // Clean up devices not seen for 15 seconds
    let changed = false;
    Object.keys(room.devices).forEach((deviceId) => {
      if (now - room.devices[deviceId].lastSeen > 15 * 1000) {
        delete room.devices[deviceId];
        changed = true;
      }
    });

    if (changed) {
      room.lastSeen = now;
      broadcastSSE(roomId, { type: "devices_update", devices: Object.values(room.devices) });
    }
  });
}, 10000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API: Get Server Time for NTP Synchronization
  app.get("/api/time", (req, res) => {
    // Return server time as precisely as possible
    res.json({ serverTime: Date.now() });
  });

  // API: Create a new synchronization room
  app.post("/api/room/create", (req, res) => {
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase(); // e.g. "A7E2"
    rooms[roomId] = {
      id: roomId,
      devices: {},
      controllerActive: true,
      lastSeen: Date.now(),
    };
    res.json({ roomId });
  });

  // API: Join a room
  app.post("/api/room/:roomId/join", (req, res) => {
    const { roomId } = req.params;
    const { deviceId, deviceName, cameraAvailable, battery } = req.body;

    const room = rooms[roomId];
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    room.lastSeen = Date.now();
    const device: Device = {
      id: deviceId,
      name: deviceName || "Unknown Device",
      status: "idle",
      battery: battery || 100,
      cameraAvailable: !!cameraAvailable,
      offset: 0,
      latency: 0,
      lastSeen: Date.now(),
    };

    room.devices[deviceId] = device;

    // Notify other clients (especially controller)
    broadcastSSE(roomId, { type: "devices_update", devices: Object.values(room.devices) });

    res.json({ success: true, device });
  });

  // API: Update device status
  app.post("/api/room/:roomId/device/:deviceId/update", (req, res) => {
    const { roomId, deviceId } = req.params;
    const { status, battery, offset, latency, lastCaptureUrl } = req.body;

    const room = rooms[roomId];
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const device = room.devices[deviceId];
    if (!device) {
      return res.status(404).json({ error: "Device not found in this room" });
    }

    room.lastSeen = Date.now();
    device.lastSeen = Date.now();
    if (status !== undefined) device.status = status;
    if (battery !== undefined) device.battery = battery;
    if (offset !== undefined) device.offset = offset;
    if (latency !== undefined) device.latency = latency;
    if (lastCaptureUrl !== undefined) device.lastCaptureUrl = lastCaptureUrl;

    broadcastSSE(roomId, { type: "devices_update", devices: Object.values(room.devices) });

    res.json({ success: true });
  });

  // API: Send trigger command (Capture photo or Start/Stop video)
  app.post("/api/room/:roomId/command", (req, res) => {
    const { roomId } = req.params;
    const { action, delayMs } = req.body; // e.g., 'capture_photo', 'start_video', 'stop_video', delayMs = 1500

    const room = rooms[roomId];
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    room.lastSeen = Date.now();
    const executionTime = Date.now() + (delayMs || 1500);

    const command = {
      type: "command",
      action,
      targetTime: executionTime, // Absolute synchronized server timestamp for command execution
      commandId: Math.random().toString(36).substring(2, 10),
    };

    broadcastSSE(roomId, command);

    res.json({ success: true, command });
  });

  // API: SSE endpoint for persistent real-time push connection
  app.get("/api/room/:roomId/events", (req, res) => {
    const { roomId } = req.params;
    const { deviceId } = req.query;

    if (!rooms[roomId]) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    res.write("retry: 2000\n\n");

    if (!sseClients[roomId]) {
      sseClients[roomId] = [];
    }

    const devId = typeof deviceId === "string" ? deviceId : "controller";
    sseClients[roomId].push({ deviceId: devId, res });

    // Send initial list of devices to the newly connected subscriber
    res.write(`data: ${JSON.stringify({ type: "init", devices: Object.values(rooms[roomId].devices) })}\n\n`);

    req.on("close", () => {
      sseClients[roomId] = sseClients[roomId].filter((c) => c.res !== res);
    });
  });

  // Vite development middleware vs Static Production files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
