export interface Device {
  id: string;
  name: string;
  status: "idle" | "ready" | "capturing" | "recording" | "error";
  battery: number;
  cameraAvailable: boolean;
  offset: number; // clock offset relative to server in ms
  latency: number; // RTT in ms
  lastSeen: number;
  lastCaptureUrl?: string;
}

export interface Command {
  type: string;
  action: "capture_photo" | "start_video" | "stop_video";
  targetTime: number; // absolute synchronized server timestamp
  commandId: string;
}
