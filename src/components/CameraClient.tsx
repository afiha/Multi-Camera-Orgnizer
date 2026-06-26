import React, { useState, useEffect, useRef } from "react";
import { Device, Command } from "../types";
import { 
  Camera, 
  Smartphone, 
  Battery, 
  Activity, 
  Clock, 
  RefreshCw, 
  AlertCircle, 
  Volume2, 
  VolumeX,
  Sparkles,
  ArrowRight
} from "lucide-react";

interface CameraClientProps {
  roomId: string;
  onExit: () => void;
}

export default function CameraClient({ roomId, onExit }: CameraClientProps) {
  const [deviceName, setDeviceName] = useState<string>("");
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [deviceId] = useState<string>(() => "dev_" + Math.random().toString(36).substring(2, 10));
  
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [latency, setLatency] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<"not_synced" | "syncing" | "synced">("not_synced");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [clientStatus, setClientStatus] = useState<Device["status"]>("idle");
  const [flashActive, setFlashActive] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  const [countdown, setCountdown] = useState<{ active: boolean; remaining: number }>({
    active: false,
    remaining: 0
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Safe list of typical phone models for user suggestions
  const phoneSuggestions = ["iPhone 15 Pro", "Samsung S24 Ultra", "Pixel 8 Pro", "Xiaomi 14 Ultra", "OnePlus 12"];

  // Initialize camera and battery APIs
  useEffect(() => {
    // Battery status
    if ("getBattery" in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener("levelchange", () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      });
    } else {
      // Fake slow battery drains
      setBatteryLevel(Math.floor(Math.random() * 15) + 80);
    }

    // Auto-suggest name
    const randomSuggestion = phoneSuggestions[Math.floor(Math.random() * phoneSuggestions.length)];
    setDeviceName(randomSuggestion);

    return () => {
      stopCamera();
      cleanupIntervals();
    };
  }, []);

  const cleanupIntervals = () => {
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    if (eventSourceRef.current) eventSourceRef.current.close();
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  };

  const startCamera = async () => {
    try {
      // Prefer back camera ("environment") for multi-angle capturing
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasCameraPermission(true);
      return true;
    } catch (err) {
      console.warn("Back camera failed, trying front camera...", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false
        });
        setCameraStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
        setHasCameraPermission(true);
        return true;
      } catch (e) {
        setHasCameraPermission(false);
        return false;
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  };

  // Perform precise NTP-like Clock Sync with Server
  const performClockSync = async () => {
    setSyncStatus("syncing");
    let latencies: number[] = [];
    let offsets: number[] = [];

    // Run 4 quick NTP loops to average network jitter
    for (let i = 0; i < 4; i++) {
      const t0 = Date.now();
      try {
        const response = await fetch("/api/time");
        const data = await response.json();
        const t3 = Date.now();

        const serverTime = data.serverTime;
        // Simple accurate NTP clock calculations:
        // RTT = t3 - t0
        // Offset = serverTime - (t0 + RTT/2)
        const roundTrip = t3 - t0;
        const clockOffset = serverTime - (t0 + roundTrip / 2);

        latencies.push(roundTrip);
        offsets.push(clockOffset);
      } catch (err) {
        // fail silently
      }
      // wait 200ms between probes
      await new Promise((r) => setTimeout(r, 200));
    }

    if (latencies.length > 0) {
      const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
      const avgOffset = Math.round(offsets.reduce((a, b) => a + b, 0) / offsets.length);

      setLatency(avgLatency);
      setOffset(avgOffset);
      setSyncStatus("synced");

      // Push sync parameters to server immediately
      if (isJoined) {
        updateDeviceOnServer({ offset: avgOffset, latency: avgLatency });
      }
    }
  };

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) return;

    const cameraStarted = await startCamera();
    if (!cameraStarted) {
      alert("برای اتصال به اتاق، دسترسی به دوربین الزامی است.");
      return;
    }

    try {
      const response = await fetch(`/api/room/${roomId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          deviceId,
          deviceName,
          cameraAvailable: true,
          battery: batteryLevel
        })
      });

      const result = await response.json();
      if (result.success) {
        setIsJoined(true);
        setClientStatus("idle");

        // Perform initial clock sync
        await performClockSync();

        // Start listening to real-time sync commands (SSE)
        connectToSSE();

        // Periodic sync clock (every 6 seconds) to maintain millisecond drift protection
        syncIntervalRef.current = setInterval(performClockSync, 6000);

        // Periodic heartbeat (every 5 seconds)
        heartbeatIntervalRef.current = setInterval(() => {
          updateDeviceOnServer({ battery: batteryLevel });
        }, 5000);
      } else {
        alert("خطا در ورود به اتاق همگام‌سازی: " + (result.error || "ناشناخته"));
        stopCamera();
      }
    } catch (err) {
      alert("امکان اتصال به سرور همگام‌سازی وجود ندارد.");
      stopCamera();
    }
  };

  const updateDeviceOnServer = async (fields: Partial<Device>) => {
    try {
      await fetch(`/api/room/${roomId}/device/${deviceId}/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(fields)
      });
    } catch (err) {
      // Silent error
    }
  };

  const connectToSSE = () => {
    const es = new EventSource(`/api/room/${roomId}/events?deviceId=${deviceId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "command") {
          const command = data as Command;
          scheduleTrigger(command);
        }
      } catch (err) {
        console.error("SSE Client parsing error", err);
      }
    };

    es.onerror = () => {
      console.warn("SSE disconnected, retrying...");
    };
  };

  // Schedule trigger action precisely on synchronized local clock
  const scheduleTrigger = (command: Command) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    // Local trigger time = target server time - client's calculated clock offset
    const targetLocalTime = command.targetTime - offset;

    const updateInterval = () => {
      const now = Date.now();
      const remaining = targetLocalTime - now;

      if (remaining <= 0) {
        setCountdown({ active: false, remaining: 0 });
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        
        // Execute trigger precisely
        executeTrigger(command.action);
      } else {
        setCountdown({
          active: true,
          remaining: remaining / 1000
        });
      }
    };

    updateInterval();
    countdownIntervalRef.current = setInterval(updateInterval, 10);
  };

  const executeTrigger = (action: "capture_photo" | "start_video" | "stop_video") => {
    if (action === "capture_photo") {
      capturePhoto();
    } else if (action === "start_video") {
      startRecording();
    } else if (action === "stop_video") {
      stopRecording();
    }
  };

  const playShutterSound = () => {
    if (!soundEnabled) return;
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.connect(gain);
      gain.connect(context.destination);
      
      // Mimic high-pitched camera snap
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, context.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, context.currentTime + 0.15);
      
      gain.gain.setValueAtTime(0.3, context.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, context.currentTime + 0.15);
      
      osc.start();
      osc.stop(context.currentTime + 0.16);
    } catch (e) {
      // Audio context block
    }
  };

  const capturePhoto = () => {
    setClientStatus("capturing");
    setFlashActive(true);
    playShutterSound();

    setTimeout(() => setFlashActive(false), 200);

    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (canvas && video && cameraStream) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        
        // Draw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Add watermark with exact local & offset timestamp
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(10, canvas.height - 35, 290, 25);
        ctx.fillStyle = "#10b981";
        ctx.font = "11px monospace";
        const d = new Date();
        ctx.fillText(
          `SYNCED: ${d.toLocaleTimeString("fa-IR")} (${offset > 0 ? "+" : ""}${offset}ms Offset)`,
          15,
          canvas.height - 18
        );

        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        
        // Upload thumbnail frame to Controller
        updateDeviceOnServer({ 
          status: "idle", 
          lastCaptureUrl: dataUrl 
        });

        setTimeout(() => {
          setClientStatus("idle");
        }, 1000);
      }
    } else {
      updateDeviceOnServer({ status: "idle" });
      setClientStatus("idle");
    }
  };

  const startRecording = () => {
    if (!cameraStream) return;
    recordedChunksRef.current = [];
    
    try {
      const recorder = new MediaRecorder(cameraStream, { mimeType: "video/webm" });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        setIsRecording(false);
        setClientStatus("idle");
        updateDeviceOnServer({ status: "idle" });
        playShutterSound();
      };

      recorder.start();
      setIsRecording(true);
      setClientStatus("recording");
      updateDeviceOnServer({ status: "recording" });
      playShutterSound();
    } catch (err) {
      console.error("MediaRecorder initialization failed", err);
      setIsRecording(true);
      setClientStatus("recording");
      updateDeviceOnServer({ status: "recording" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      setIsRecording(false);
      setClientStatus("idle");
      updateDeviceOnServer({ status: "idle" });
    }
  };

  const exitRoom = () => {
    cleanupIntervals();
    stopCamera();
    onExit();
  };

  return (
    <div className="max-w-md mx-auto px-4 py-3 relative">
      {/* Screen flash emulation on capture */}
      {flashActive && (
        <div className="fixed inset-0 bg-white z-50 animate-fade-out" />
      )}

      {/* Countdown HUD Overlay */}
      {countdown.active && (
        <div className="absolute inset-x-4 top-4 bg-emerald-500 text-slate-950 px-4 py-3 rounded-2xl z-40 shadow-2xl flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 animate-spin" />
            <span className="text-sm font-bold font-sans">زمان ثبت شات همگام</span>
          </div>
          <span className="text-2xl font-black font-mono tracking-wider">{countdown.remaining.toFixed(2)}s</span>
        </div>
      )}

      {!isJoined ? (
        // JOIN ROOM FORM VIEW
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center">
              <Camera className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white font-sans">اتصال به عنوان دوربین کلاینت</h2>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              با همگام‌سازی ساعت داخلی با سرور، این دوربین آماده شات‌های یکپارچه و بدون تاخیر با دیگر دوربین‌های متصل می‌شود.
            </p>
          </div>

          <form onSubmit={joinRoom} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-sans block">کد اتاق همگام‌سازی</label>
              <input 
                type="text" 
                value={roomId} 
                disabled 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-emerald-400 text-center font-mono font-bold text-xl disabled:opacity-75"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-sans block">نام نمایشی دستگاه</label>
              <input 
                type="text" 
                value={deviceName} 
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="مثلاً iPhone 15 Pro"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 font-sans text-center text-sm focus:border-emerald-500 focus:outline-none transition-all"
              />
            </div>

            {/* Quick Suggestions list */}
            <div className="flex flex-wrap gap-2 justify-center pt-1">
              {phoneSuggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setDeviceName(name)}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 py-1 px-2.5 rounded-full font-sans transition-all"
                >
                  {name}
                </button>
              ))}
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 font-sans"
            >
              اتصال دوربین و همگام‌سازی ساعت
              <ArrowRight className="w-4 h-4 shrink-0 rotate-180" />
            </button>
          </form>

          <button
            onClick={onExit}
            className="w-full text-xs text-slate-500 hover:text-slate-400 font-sans py-2 text-center"
          >
            لغو و بازگشت
          </button>
        </div>
      ) : (
        // ACTIVE CAMERA VIEWER HUD
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
          
          {/* Header Info */}
          <div className="flex justify-between items-center bg-slate-950/80 p-3 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white font-sans">{deviceName}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-slate-400 font-mono text-xs">
                <Battery className="w-4 h-4 text-emerald-400" />
                {batteryLevel}%
              </div>
              <button 
                onClick={() => setSoundEnabled(!soundEnabled)} 
                className="text-slate-400 hover:text-white transition-all"
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-600" />}
              </button>
            </div>
          </div>

          {/* Sync status parameters HUD */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-2.5 flex items-center gap-2.5 shadow-inner">
              <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[9px] text-slate-500 block font-sans">تأخیر رفت و برگشت (RTT)</span>
                <span className="text-xs font-mono text-white font-bold">{latency}ms</span>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-2.5 flex items-center gap-2.5 shadow-inner">
              <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[9px] text-slate-500 block font-sans">انحراف از سرور (Offset)</span>
                <span className="text-xs font-mono text-white font-bold">
                  {offset > 0 ? `+${offset}` : offset}ms
                </span>
              </div>
            </div>
          </div>

          {/* Camera Canvas Stream Frame Viewport */}
          <div className="aspect-[3/4] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden relative shadow-inner">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover scale-x-[-1]"
            />
            
            {/* Countdown overlay indicator on stream */}
            {countdown.active && (
              <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center">
                <div className="text-6xl font-black font-mono text-emerald-400 tracking-wider">
                  {countdown.remaining.toFixed(2)}s
                </div>
              </div>
            )}

            {/* Rec indicator HUD */}
            {isRecording && (
              <div className="absolute top-3 left-3 bg-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse font-sans">
                <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>
                فیلم‌برداری فعال
              </div>
            )}

            {/* Sync Active Sparkles Badge */}
            <div className="absolute bottom-3 right-3 bg-emerald-500/90 text-slate-950 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow font-sans">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              همگام‌ با کارگردان
            </div>
          </div>

          {/* Hidden Canvas used to generate snapshot JPEG base64 updates */}
          <canvas ref={canvasRef} className="hidden" />

          <div className="flex gap-2">
            <button
              onClick={performClockSync}
              className="flex-1 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700/50 text-slate-300 py-3 rounded-xl text-xs font-medium font-sans flex items-center justify-center gap-1.5 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
              بروزرسانی ساعت محلی
            </button>
            <button
              onClick={exitRoom}
              className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 py-3 rounded-xl text-xs font-medium font-sans transition-all"
            >
              قطع اتصال دوربین
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
