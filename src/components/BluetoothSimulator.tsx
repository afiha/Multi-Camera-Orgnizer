import React, { useState, useEffect, useRef } from "react";
import { 
  Wifi, 
  Tv, 
  Smartphone, 
  Camera, 
  Video, 
  VideoOff, 
  Clock, 
  RefreshCw, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Info,
  ShieldCheck,
  Zap,
  RotateCcw
} from "lucide-react";

interface SimulatedDevice {
  id: string;
  name: string;
  battery: number;
  rtt: number; // Simulated Bluetooth Round-Trip-Time (ms)
  offset: number; // Simulated Clock Offset (ms)
  status: "connected" | "syncing" | "synced" | "capturing" | "recording";
  photoUrl?: string;
  lastCapturedAt?: number;
}

const SAMPLE_PHOTOS = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=400&q=80"
];

export default function BluetoothSimulator() {
  const [role, setRole] = useState<"director" | "client">("director");
  const [pairedDevices, setPairedDevices] = useState<SimulatedDevice[]>([
    { id: "sim_1", name: "Galaxy S23 Ultra (کلاینت ۱)", battery: 88, rtt: 45, offset: -12, status: "synced" },
    { id: "sim_2", name: "iPhone 15 Pro Max (کلاینت ۲)", battery: 92, rtt: 62, offset: 8, status: "synced" },
    { id: "sim_3", name: "Pixel 8 Pro (کلاینت ۳)", battery: 74, rtt: 35, offset: -4, status: "synced" }
  ]);
  const [delayMs, setDelayMs] = useState<number>(1200);
  const [logs, setLogs] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  
  // Real-time synchronization state
  const [syncCountdown, setSyncCountdown] = useState<{ active: boolean; remaining: number; action: string }>({
    active: false,
    remaining: 0,
    action: ""
  });

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    addLog("سیستم همگام‌سازی آفلاین بلوتوث مقداردهی اولیه شد.");
    addLog("آماده برای جفت‌سازی محلی بدون نیاز به اینترنت (کاملا آفلاین).");
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString("fa-IR");
    setLogs((prev) => [`[${time}] ${message}`, ...prev.slice(0, 39)]);
  };

  // Simulate Bluetooth RTT and Clock Drift Measurement
  const triggerBluetoothSync = () => {
    setIsSyncing(true);
    addLog("🔄 در حال ارسال فریم‌های پینگ همگام‌سازی (Bluetooth Sync Frame Check)...");
    
    // Simulate updating offset and RTT over Bluetooth classic socket
    setPairedDevices(prev => prev.map(dev => ({ ...dev, status: "syncing" })));

    setTimeout(() => {
      setPairedDevices(prev => prev.map(dev => {
        // Generate small random variances
        const newRtt = Math.floor(Math.random() * 40) + 20; // 20-60 ms typical bluetooth classic latency
        const newOffset = Math.floor(Math.random() * 30) - 15; // -15 to +15 ms drift
        return {
          ...dev,
          rtt: newRtt,
          offset: newOffset,
          status: "synced"
        };
      }));
      setIsSyncing(false);
      addLog("✅ ناهمگامی ساعت‌ها با دقت میلی‌ثانیه محاسبه و آفست اعمال شد.");
    }, 1500);
  };

  // Simulate command propagation and target time trigger
  const triggerShutter = (action: "capture_photo" | "start_video" | "stop_video") => {
    const actionName = action === "capture_photo" ? "عکاسی" : action === "start_video" ? "شروع فیلم‌برداری" : "پایان فیلم‌برداری";
    addLog(`📣 ارسال دستور همگام: ${actionName} با تاخیر شاتر ${delayMs} میلی‌ثانیه`);

    const executionTime = Date.now() + delayMs;

    addLog(`⏱️ زمان دقیق شات هماهنگ روی برد: ${new Date(executionTime).toLocaleTimeString("fa-IR")}.${executionTime % 1000}`);

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = executionTime - now;

      if (remaining <= 0) {
        setSyncCountdown({ active: false, remaining: 0, action: "" });
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        
        // Execute capture physically in simulator
        if (action === "capture_photo") {
          setPairedDevices(prev => prev.map(dev => {
            const randomPhoto = SAMPLE_PHOTOS[Math.floor(Math.random() * SAMPLE_PHOTOS.length)];
            return {
              ...dev,
              status: "capturing",
              photoUrl: randomPhoto,
              lastCapturedAt: Date.now()
            };
          }));

          setTimeout(() => {
            setPairedDevices(prev => prev.map(dev => ({ ...dev, status: "synced" })));
            addLog("📸 تمام شات‌ها به طور هماهنگ در لحظه دقیق فشرده شدند!");
          }, 800);
        } else if (action === "start_video") {
          setIsRecording(true);
          setPairedDevices(prev => prev.map(dev => ({ ...dev, status: "recording" })));
          addLog("🔴 ضبط فیلم به طور هماهنگ روی تمامی گوشی‌ها آغاز شد.");
        } else if (action === "stop_video") {
          setIsRecording(false);
          setPairedDevices(prev => prev.map(dev => ({ ...dev, status: "synced" })));
          addLog("⬛ ضبط فیلم به طور هماهنگ روی تمامی گوشی‌ها خاتمه یافت.");
        }
      } else {
        setSyncCountdown({
          active: true,
          remaining: remaining / 1000,
          action
        });
      }
    };

    updateCountdown();
    countdownIntervalRef.current = setInterval(updateCountdown, 10);
  };

  const addSimulatedDevice = () => {
    const names = ["Xiaomi 13 Pro", "OnePlus 11", "iPad Air 5", "Honor Magic 6", "Redmi Note 12"];
    const randomName = names[Math.floor(Math.random() * names.length)];
    const id = "sim_" + Math.random().toString(36).substring(2, 6);
    
    const newDev: SimulatedDevice = {
      id,
      name: `${randomName} (کلاینت آفلاین)`,
      battery: Math.floor(Math.random() * 20) + 75,
      rtt: Math.floor(Math.random() * 30) + 15,
      offset: Math.floor(Math.random() * 20) - 10,
      status: "synced"
    };

    setPairedDevices([...pairedDevices, newDev]);
    addLog(`📱 دستگاه جدید "${randomName}" از طریق بلوتوث به شبکه کارگردان پیوست.`);
  };

  const resetSimulator = () => {
    setPairedDevices([
      { id: "sim_1", name: "Galaxy S23 Ultra (کلاینت ۱)", battery: 88, rtt: 45, offset: -12, status: "synced" },
      { id: "sim_2", name: "iPhone 15 Pro Max (کلاینت ۲)", battery: 92, rtt: 62, offset: 8, status: "synced" }
    ]);
    setIsRecording(false);
    setLogs([]);
    addLog("شبیه‌ساز بلوتوث به حالت اولیه بازنشانی شد.");
  };

  return (
    <div id="offline-bluetooth-simulator" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 max-w-4xl mx-auto my-6 text-slate-100">
      
      {/* Visual countdown modal for triggers */}
      {syncCountdown.active && (
        <div className="fixed inset-0 bg-slate-950/95 z-50 flex flex-col items-center justify-center text-white backdrop-blur-md">
          <div className="absolute top-10 flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-full">
            <Clock className="w-4 h-4 text-emerald-400 animate-spin" />
            <span className="text-sm font-sans text-slate-300 font-medium">همگام‌سازی بلادرنگ شات آفلاین</span>
          </div>
          <div className="text-8xl font-black tracking-widest text-emerald-400 font-mono select-none drop-shadow-2xl">
            {syncCountdown.remaining.toFixed(2)}s
          </div>
          <div className="text-xl font-sans text-slate-300 mt-6 tracking-wide">
            {syncCountdown.action === "capture_photo" ? "ثبت همزمان عکس" : "شروع همزمان ضبط ویدیو"} در ثانیه مقرر...
          </div>
          <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-6">
            <div 
              className="h-full bg-emerald-500 transition-all duration-75"
              style={{ width: `${(syncCountdown.remaining / (delayMs / 1000)) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md w-max font-sans">
            <Wifi className="w-3.5 h-3.5 animate-pulse" />
            شبیه‌ساز کارکرد آفلاین بلوتوث (کاملاً بدون اینترنت)
          </div>
          <h2 className="text-lg font-bold text-white font-sans">کارگاه و شبیه‌ساز عکاسی هماهنگ بلوتوثی</h2>
          <p className="text-xs text-slate-400 font-sans">
            با این کارگاه تعاملی، روند ارتباط بلوتوثی کلاسیک، اندازه‌گیری آفلاین تاخیر پکت‌ها و ثبت شات بدون نیاز به اینترنت را آزمایش کنید.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={resetSimulator} 
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all" 
            title="بازنشانی شبیه‌ساز"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button 
            onClick={addSimulatedDevice} 
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl font-sans transition-all"
          >
            جفت‌سازی گوشی جدید
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Local Controls */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-4 shadow-inner">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans flex items-center gap-2">
              <Tv className="w-4 h-4 text-emerald-400" />
              مدیریت شاتر هماهنگ
            </div>

            {/* Delay Slider */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-xs font-sans text-slate-400">
                <span>تاخیر ایمن شلیک بلوتوث</span>
                <span className="font-mono text-emerald-400 font-bold">{delayMs}ms</span>
              </div>
              <input 
                type="range" 
                min="400" 
                max="3000" 
                step="100" 
                value={delayMs} 
                onChange={(e) => setDelayMs(parseInt(e.target.value))}
                className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                این تاخیر فرصت می‌دهد تا فریم کنترل بلوتوثی با موفقیت به تمام کلاینت‌ها مخابره شود و همگی راس لحظه هدف عکس را ثبت کنند.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => triggerShutter("capture_photo")}
                disabled={pairedDevices.length === 0}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 font-sans shadow"
              >
                <Camera className="w-4 h-4 shrink-0" />
                ثبت تصویر هماهنگ آفلاین
              </button>

              {!isRecording ? (
                <button
                  onClick={() => triggerShutter("start_video")}
                  disabled={pairedDevices.length === 0}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-rose-400 font-semibold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 font-sans border border-rose-500/20"
                >
                  <Video className="w-4 h-4 shrink-0" />
                  شروع فیلم‌برداری هماهنگ
                </button>
              ) : (
                <button
                  onClick={() => triggerShutter("stop_video")}
                  disabled={pairedDevices.length === 0}
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 font-sans animate-pulse"
                >
                  <VideoOff className="w-4 h-4 shrink-0" />
                  پایان فیلم‌برداری هماهنگ
                </button>
              )}

              <button
                onClick={triggerBluetoothSync}
                disabled={isSyncing || pairedDevices.length === 0}
                className="w-full bg-slate-900 hover:bg-slate-800 text-emerald-400 font-medium py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 font-sans border border-emerald-500/20"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                کالیبره آفلاین ساعت بلوتوث
              </button>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-3 shadow-inner">
            <div className="text-xs font-semibold text-slate-300 font-sans flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              مکانیسم همگام‌سازی آفلاین
            </div>
            <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
              دستگاه اصلی (کارگردان) یک کانال امن بلوتوثی (RFCOMM) با سوکت‌های همزمان باز می‌کند. با ارسال پینگ-پونگ‌های فوق سریع، زمان رفت و برگشت پکت‌ها در کسری از ثانیه محاسبه شده و دوربین‌ها در زمان بومی دقیق شات عکاسی را به طور همزمان فشار می‌دهند.
            </p>
          </div>
        </div>

        {/* Right Columns: Connected Devices & Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 shadow-inner space-y-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans flex items-center gap-2 pb-2 border-b border-slate-900">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              دوربین‌های متصل به بلوتوث کارگردان ({pairedDevices.length})
            </div>

            {pairedDevices.length === 0 ? (
              <div className="text-center py-12 text-slate-600 font-sans text-sm">
                هیچ موبایلی از طریق بلوتوث جفت نشده است.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pairedDevices.map((dev) => (
                  <div key={dev.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5 relative">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-semibold text-white font-sans flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${dev.status === "recording" ? "bg-rose-500 animate-ping" : "bg-emerald-400"}`}></span>
                          {dev.name}
                        </h4>
                        <div className="flex gap-2 text-[9px] text-slate-500 font-mono mt-1">
                          <span>RTT: {dev.rtt}ms</span>
                          <span>انحراف: {dev.offset > 0 ? `+${dev.offset}` : dev.offset}ms</span>
                        </div>
                      </div>
                      <div className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-sans rounded font-medium">
                        {dev.status === "synced" ? "همگام" : dev.status === "syncing" ? "در حال محاسبه..." : dev.status === "recording" ? "در حال ضبط" : "شات ثبت شد"}
                      </div>
                    </div>

                    <div className="aspect-video bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center relative">
                      {dev.photoUrl ? (
                        <div className="absolute inset-0">
                          <img 
                            src={dev.photoUrl} 
                            alt={dev.name} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute bottom-1 right-1 bg-slate-950/80 text-emerald-400 text-[8px] px-1 py-0.5 font-mono rounded">
                            {dev.offset > 0 ? `+${dev.offset}` : dev.offset}ms Offset
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-slate-600 space-y-1">
                          <Camera className="w-5 h-5 mx-auto" />
                          <span className="text-[9px] font-sans">آماده عکاسی هماهنگ</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Local Logs Console */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 shadow-inner space-y-2">
            <div className="text-xs font-bold text-slate-400 font-sans">کنسول لاگ بلوتوث محلی (Local Log Console)</div>
            <div className="bg-slate-900 border border-slate-800/50 rounded-xl p-3 h-28 overflow-y-auto space-y-1.5 select-all text-left" dir="ltr">
              {logs.map((log, i) => (
                <div key={i} className="font-mono text-[10px] text-emerald-400/90 leading-normal border-l border-emerald-500/10 pl-2">
                  {log}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
