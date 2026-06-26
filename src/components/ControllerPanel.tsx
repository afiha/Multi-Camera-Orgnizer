import React, { useState, useEffect, useRef } from "react";
import { Device, Command } from "../types";
import { 
  Camera, 
  Video, 
  VideoOff, 
  Clock, 
  RefreshCw, 
  Smartphone, 
  Battery, 
  Activity, 
  Wifi, 
  Zap,
  Info,
  ExternalLink
} from "lucide-react";

interface ControllerPanelProps {
  roomId: string;
  onExit: () => void;
}

export default function ControllerPanel({ roomId, onExit }: ControllerPanelProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [delayMs, setDelayMs] = useState<number>(1500);
  const [logs, setLogs] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<{ active: boolean; remaining: number; action: string }>({
    active: false,
    remaining: 0,
    action: ""
  });
  const [isConnecting, setIsConnecting] = useState<boolean>(true);

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    addLog(`در حال اتصال به اتاق همگام‌سازی ${roomId}...`);
    
    // Connect to Server-Sent Events (SSE) stream
    const es = new EventSource(`/api/room/${roomId}/events?deviceId=controller`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnecting(false);
      addLog(`با موفقیت به کنترلر اتاق ${roomId} متصل شد.`);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "init") {
          setDevices(data.devices || []);
          addLog(`کلاینت‌های اولیه دریافت شدند: ${data.devices.length} دستگاه`);
        } else if (data.type === "devices_update") {
          setDevices(data.devices || []);
          // Check if any device has new captured photo to log
          data.devices.forEach((dev: Device) => {
            const oldDev = devices.find(d => d.id === dev.id);
            if (dev.lastCaptureUrl && oldDev && oldDev.lastCaptureUrl !== dev.lastCaptureUrl) {
              addLog(`📸 تصویر جدید دریافت شد از دستگاه: ${dev.name}`);
            }
          });
        }
      } catch (err) {
        console.error("SSE parsing error", err);
      }
    };

    es.onerror = () => {
      addLog("⚠️ خطا در اتصال بلادرنگ به سرور. در حال تلاش مجدد...");
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [roomId]);

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString("fa-IR");
    setLogs((prev) => [`[${time}] ${message}`, ...prev.slice(0, 49)]);
  };

  const sendCommand = async (action: "capture_photo" | "start_video" | "stop_video") => {
    addLog(`انتشار دستور همگام: ${action === "capture_photo" ? "عکاسی" : action === "start_video" ? "شروع فیلم‌برداری" : "پایان فیلم‌برداری"}`);
    
    try {
      const response = await fetch(`/api/room/${roomId}/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action, delayMs })
      });
      
      const result = await response.json();
      if (result.success) {
        const targetTime = result.command.targetTime;
        startCountdown(action, targetTime);
        
        if (action === "start_video") {
          setIsRecording(true);
        } else if (action === "stop_video") {
          setIsRecording(false);
        }
      } else {
        addLog("❌ خطا در ارسال دستور به سرور.");
      }
    } catch (err) {
      addLog("❌ خطای ارتباطی در ارسال دستور.");
    }
  };

  const startCountdown = (action: string, targetTime: number) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    addLog(`ثبت زمان شلیک همزمان (Server Time): ${new Date(targetTime).toLocaleTimeString("fa-IR")}`);

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = targetTime - now;

      if (remaining <= 0) {
        setCountdown({ active: false, remaining: 0, action: "" });
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        addLog(`⚡ دستور ${action === "capture_photo" ? "عکاسی" : "فیلم‌برداری"} در زمان مشخص اجرا شد!`);
      } else {
        setCountdown({
          active: true,
          remaining: remaining / 1000,
          action
        });
      }
    };

    updateCountdown();
    countdownIntervalRef.current = setInterval(updateCountdown, 10);
  };

  const getBatteryIconColor = (level: number) => {
    if (level > 60) return "text-emerald-500";
    if (level > 20) return "text-amber-500";
    return "text-rose-500 animate-pulse";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "idle":
        return <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-sans font-medium rounded-full">آماده‌باش</span>;
      case "ready":
        return <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-sans font-medium rounded-full">دوربین متصل</span>;
      case "capturing":
        return <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-sans font-medium rounded-full animate-pulse">در حال ثبت...</span>;
      case "recording":
        return <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 text-[10px] font-sans font-medium rounded-full animate-pulse">ضبط فیلم</span>;
      case "error":
        return <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] font-sans font-medium rounded-full">خطای دوربین</span>;
      default:
        return null;
    }
  };

  const clientJoinUrl = `${window.location.origin}/?join=${roomId}`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 py-2 relative">
      {/* Real-time sync action visual overlay countdown */}
      {countdown.active && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 flex flex-col items-center justify-center text-white backdrop-blur-sm transition-all duration-150">
          <div className="absolute top-10 flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-full">
            <Clock className="w-4 h-4 text-emerald-400 animate-spin" />
            <span className="text-sm font-sans text-slate-300 font-medium">همگام‌سازی بلادرنگ شاتر</span>
          </div>
          <div className="text-8xl font-black tracking-widest text-emerald-400 font-mono select-none drop-shadow-2xl">
            {countdown.remaining.toFixed(2)}s
          </div>
          <div className="text-xl font-sans text-slate-300 mt-6 tracking-wide">
            {countdown.action === "capture_photo" ? "ثبت همزمان عکس" : "شروع همزمان ضبط ویدیو"} در ثانیه مقرر...
          </div>
          <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-6">
            <div 
              className="h-full bg-emerald-500 transition-all duration-75"
              style={{ width: `${(countdown.remaining / (delayMs / 1000)) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Header Info Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md w-max font-sans">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            پنل کنترل فعال (کارگردان)
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">همگام‌ساز دوربین‌های چندگانه</h1>
          <p className="text-xs text-slate-400 font-sans leading-relaxed">
            گوشی‌های تلفن همراه همکار را با کدهای QR به این اتاق متصل کنید. دستور شاتر بلافاصله زمان‌بندی شده و دقیقاً در یک میلی‌ثانیه مشخص اجرا می‌شود.
          </p>
        </div>

        <div className="flex flex-col items-center p-4 bg-slate-950 border border-slate-800 rounded-xl min-w-[200px] text-center shadow-inner">
          <span className="text-[10px] text-slate-500 font-sans tracking-wider uppercase mb-1">کد اتصال اتاق</span>
          <div className="text-3xl font-black tracking-wider text-emerald-400 font-mono">{roomId}</div>
          <div className="mt-2.5 flex flex-col gap-1 w-full">
            <a 
              href={clientJoinUrl} 
              target="_blank" 
              rel="noreferrer"
              className="text-[10px] text-emerald-400 hover:text-emerald-300 font-sans flex items-center justify-center gap-1 hover:underline"
            >
              لینک اتصال موبایل‌ها <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-[9px] text-slate-500 font-mono mt-0.5">اسکن QR یا باز کردن در تب دیگر</span>
          </div>
        </div>
      </div>

      {/* Grid: Live Control Actions & Device Monitors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Actions panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
            <h2 className="text-sm font-semibold text-white tracking-tight font-sans flex items-center gap-2 pb-3 border-b border-slate-800">
              <Zap className="w-4 h-4 text-emerald-400" />
              کنترل‌های یکپارچه همگام
            </h2>

            <div className="space-y-4">
              {/* Delay adjust Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-sans text-slate-400">
                  <span>تاخیر ایمن همگام‌سازی (میلی‌ثانیه)</span>
                  <span className="font-mono text-emerald-400 font-semibold">{delayMs}ms</span>
                </div>
                <input 
                  type="range" 
                  min="500" 
                  max="5000" 
                  step="100" 
                  value={delayMs} 
                  onChange={(e) => setDelayMs(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                  تاخیر برای تضمین دریافت دستور توسط تمامی گوشی‌ها قبل از لحظه عکاسی همزمان الزامی است.
                </p>
              </div>

              {/* Shot Triggers */}
              <div className="grid grid-cols-1 gap-3 pt-2">
                <button
                  onClick={() => sendCommand("capture_photo")}
                  disabled={devices.length === 0}
                  className="flex items-center justify-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-transparent text-slate-950 font-bold py-3.5 px-4 rounded-xl text-sm transition-all duration-150 shadow-lg shadow-emerald-500/10 font-sans w-full"
                >
                  <Camera className="w-4 h-4 shrink-0" />
                  گرفتن عکس همزمان (Capture)
                </button>

                {!isRecording ? (
                  <button
                    onClick={() => sendCommand("start_video")}
                    disabled={devices.length === 0}
                    className="flex items-center justify-center gap-2.5 bg-slate-800 hover:bg-slate-700 hover:text-white disabled:bg-slate-800 disabled:text-slate-600 text-rose-400 border border-rose-500/30 disabled:border-transparent font-semibold py-3.5 px-4 rounded-xl text-sm transition-all duration-150 font-sans w-full"
                  >
                    <Video className="w-4 h-4 shrink-0" />
                    شروع ضبط ویدیو همزمان
                  </button>
                ) : (
                  <button
                    onClick={() => sendCommand("stop_video")}
                    disabled={devices.length === 0}
                    className="flex items-center justify-center gap-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all duration-150 shadow-lg shadow-rose-500/20 font-sans w-full"
                  >
                    <VideoOff className="w-4 h-4 shrink-0 animate-pulse" />
                    قطع ضبط ویدیو همزمان
                  </button>
                )}
              </div>
            </div>

            {devices.length === 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-400 font-sans leading-relaxed flex gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>برای فعال شدن کنترل‌های شاتر همزمان، باید حداقل یک دستگاه تلفن همراه به این اتاق متصل شود.</span>
              </div>
            )}
          </div>

          {/* Sync Logic Information Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-sans flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              الگوریتم بدون لگی (Command & Sync)
            </h3>
            <div className="text-xs text-slate-400 space-y-2.5 font-sans leading-relaxed">
              <p>
                تاخیر بلوتوث و شبکه‌های وای‌فای متغیر است. ارسال مستقیم سیگنال "همین الان عکاسی کن" باعث ناهمگامی چشمگیر می‌شود.
              </p>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5 font-mono text-[10px] text-emerald-400">
                <div>1. محاسبه اختلاف ساعت هر موبایل با سرور مرکزی</div>
                <div>2. ارسال دستور: عکاسی در ثانیه <span className="text-white">T + {delayMs}ms</span></div>
                <div>3. شمارش معکوس محلی هر گوشی روی ساعت همگام</div>
                <div>4. اجرای ثبت سنسور دقیقا در همان میلی‌ثانیه‌</div>
              </div>
            </div>
          </div>
        </div>

        {/* Devices list panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-white tracking-tight font-sans flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                دوربین‌های متصل به اتاق ({devices.length})
              </h2>
              {isConnecting && (
                <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin" />
              )}
            </div>

            {devices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-slate-800 rounded-xl text-center space-y-3">
                <Smartphone className="w-12 h-12 text-slate-700 animate-bounce" />
                <div className="space-y-1">
                  <p className="text-sm text-slate-300 font-sans">هیچ دستگاهی متصل نشده است</p>
                  <p className="text-xs text-slate-500 font-sans">
                    لینک را در تلفن همراه خود باز کنید یا کد اتاق را وارد کنید.
                  </p>
                </div>
                <div className="pt-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <p className="text-[10px] text-emerald-400 font-mono font-bold select-all">
                    {clientJoinUrl}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {devices.map((device) => (
                  <div key={device.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 shadow-inner hover:border-slate-700 transition-all duration-200">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-white font-sans flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          {device.name}
                        </h4>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                          <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3 text-slate-500" />
                            {device.latency}ms RTT
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            آفست: {device.offset > 0 ? `+${device.offset}` : device.offset}ms
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(device.status)}
                        <div className="flex items-center gap-1 text-slate-400 font-mono text-xs">
                          <Battery className={`w-4 h-4 ${getBatteryIconColor(device.battery)}`} />
                          {device.battery}%
                        </div>
                      </div>
                    </div>

                    {/* Camera Feed Thumbnail */}
                    <div className="aspect-video bg-slate-900 border border-slate-800/80 rounded-lg overflow-hidden flex items-center justify-center relative">
                      {device.lastCaptureUrl ? (
                        <div className="absolute inset-0">
                          <img 
                            src={device.lastCaptureUrl} 
                            alt={`${device.name} Capture`} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute bottom-2 right-2 bg-emerald-500/95 text-slate-950 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-md font-sans">
                            آخرین شات همگام
                          </div>
                        </div>
                      ) : (
                        <div className="text-center space-y-1.5 text-slate-600">
                          <Camera className="w-7 h-7 mx-auto animate-pulse" />
                          <p className="text-[10px] font-sans">آماده برای عکاسی همزمان</p>
                        </div>
                      )}
                      
                      {device.status === "recording" && (
                        <div className="absolute top-2 left-2 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse font-sans">
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                          در حال ضبط...
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <h3 className="text-sm font-semibold text-white tracking-tight font-sans">لاگ و مانیتورینگ رویدادها</h3>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 h-40 overflow-y-auto space-y-2 select-all text-left" dir="ltr">
              {logs.length === 0 ? (
                <div className="text-slate-600 font-mono text-xs text-center py-8">No events logged yet. Waiting for triggers...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="font-mono text-xs text-slate-400 border-l border-emerald-500/20 pl-2 leading-relaxed">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end pt-4">
        <button 
          onClick={onExit}
          className="text-xs text-slate-500 hover:text-slate-400 font-sans hover:underline flex items-center gap-1"
        >
          بازگشت به صفحه اصلی
        </button>
      </div>
    </div>
  );
}
