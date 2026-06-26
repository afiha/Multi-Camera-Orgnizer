import React, { useState, useEffect } from "react";
import ControllerPanel from "./components/ControllerPanel";
import CameraClient from "./components/CameraClient";
import AndroidCodeCenter from "./components/AndroidCodeCenter";
import BluetoothSimulator from "./components/BluetoothSimulator";
import { 
  Camera, 
  Tv, 
  Smartphone, 
  Cpu, 
  CheckCircle, 
  ArrowRight,
  Sparkles,
  Info,
  Wifi,
  SmartphoneNfc,
  Laptop
} from "lucide-react";

export default function App() {
  const [view, setView] = useState<"home" | "controller" | "client">("home");
  const [roomId, setRoomId] = useState<string>("");
  const [joinCodeInput, setJoinCodeInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeSyncMethod, setActiveSyncMethod] = useState<"bluetooth_native" | "wifi_web">("bluetooth_native");

  // Parse query parameter to support instant scan-and-join QR links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get("join");
    if (joinCode) {
      setRoomId(joinCode.toUpperCase());
      setView("client");
    }
  }, []);

  const createRoom = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/room/create", { method: "POST" });
      const data = await response.json();
      if (data.roomId) {
        setRoomId(data.roomId);
        setView("controller");
      }
    } catch (err) {
      alert("خطا در برقراری ارتباط با سرور. لطفاً مجدداً تلاش کنید.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setRoomId(joinCodeInput.trim().toUpperCase());
    setView("client");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between" dir="rtl">
      
      {/* Top Header Navigation */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-sm tracking-tight text-white font-sans block">MultiCam Sync Offline</span>
              <span className="text-[10px] text-slate-500 font-sans mt-0.5 block">سامانه عکاسی و همگام‌سازی چندگوشی بلوتوث و شبکه</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-mono hidden sm:inline">V2.0.0 (Native Blueprint)</span>
            <div className="px-2.5 py-1 bg-emerald-500/15 text-emerald-400 text-[10px] font-sans font-bold rounded-lg border border-emerald-500/10">
              بدون نیاز به اینترنت (آفلاین)
            </div>
          </div>
        </div>
      </header>

      {/* Main Dynamic Viewport Container */}
      <main className="flex-grow py-8 px-4 flex flex-col justify-center">
        {view === "home" && (
          <div className="max-w-4xl mx-auto w-full space-y-8">
            
            {/* Visual Hero Intro */}
            <div className="text-center space-y-3.5 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full font-sans mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                توسعه بومی اندروید عکاسی بلوتوثی (کاملاً بدون اینترنت)
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white font-sans tracking-tight leading-tight">
                عکاسی چند زاویه‌ای همزمان آفلاین
              </h1>
              <p className="text-sm text-slate-400 font-sans leading-relaxed max-w-xl mx-auto">
                برای کارکرد کاملاً آفلاین و بدون نیاز به اینترنت، تلفن‌های همراه باید از طریق فرکانس بلوتوث جفت شوند. شما می‌توانید کدهای کاتلین بومی اندروید را کپی کرده و روی گوشی‌ها نصب کنید.
              </p>
            </div>

            {/* Sync Method Switch Tabs */}
            <div className="max-w-2xl mx-auto bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800 grid grid-cols-2 gap-2">
              <button
                onClick={() => setActiveSyncMethod("bluetooth_native")}
                className={`py-3 px-4 rounded-xl text-xs font-bold font-sans flex items-center justify-center gap-2 transition-all ${
                  activeSyncMethod === "bluetooth_native"
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <SmartphoneNfc className="w-4 h-4" />
                روش اول: اپلیکیشن بومی بلوتوثی (آفلاین)
              </button>
              <button
                onClick={() => setActiveSyncMethod("wifi_web")}
                className={`py-3 px-4 rounded-xl text-xs font-bold font-sans flex items-center justify-center gap-2 transition-all ${
                  activeSyncMethod === "wifi_web"
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Wifi className="w-4 h-4" />
                روش دوم: وب اپلیکیشن بی‌سیم (مودم/Wi-Fi)
              </button>
            </div>

            {activeSyncMethod === "bluetooth_native" ? (
              <div className="space-y-6">
                {/* Note about Browser Limitations & Offline capability */}
                <div className="max-w-4xl mx-auto bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-sans text-xs font-bold">
                    <Info className="w-4 h-4 shrink-0" />
                    راهنمای اجرای برنامه روی گوشی به عنوان اپلیکیشن واقعی:
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    به دلیل محدودیت‌های امنیتی مرورگرهای وب، یک وب‌سایت در آی‌فریم نمی‌تواند سوکت‌های بلوتوثی کلاسیک موبایل را به صورت آفلاین کنترل کند. به همین دلیل ما کدهای کامل کاتلین اندروید را برای شما آماده کرده‌ایم. با اجرای شبیه‌ساز زیر، روند آفست‌گیری ساعت بلوتوثی و شلیک شاتر را آزمایش کنید و سپس کدها را برای ساخت اپلیکیشن نهایی در اندروید استودیو استفاده کنید.
                  </p>
                </div>

                {/* Bluetooth Interactive Simulator */}
                <BluetoothSimulator />

                {/* Android Native Source Code Hub */}
                <AndroidCodeCenter />
              </div>
            ) : (
              <div className="space-y-8">
                {/* Core Action Cards Grid for Wi-Fi Syncing */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                  
                  {/* Card 1: Create Director Room */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-6 hover:border-slate-700 transition-all duration-200">
                    <div className="space-y-4">
                      <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center">
                        <Tv className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-lg font-bold text-white font-sans">ایجاد اتاق کنترلر (کارگردان)</h2>
                        <p className="text-xs text-slate-400 font-sans leading-relaxed">
                          یک اتاق جدید باز کنید تا کد QR و پنل مانیتورینگ دوربین‌های دیگر را دریافت کنید و دکمه شاتر عکاسی یا دکمه فیلم‌برداری همزمان را فشار دهید.
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={createRoom}
                      disabled={isLoading}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold py-3.5 px-4 rounded-2xl text-sm transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 font-sans"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          در حال ساخت اتاق...
                        </span>
                      ) : (
                        <>
                          شروع ساخت اتاق کنترلر
                          <ArrowRight className="w-4 h-4 shrink-0 rotate-180" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Card 2: Join as Camera Client */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-6 hover:border-slate-700 transition-all duration-200">
                    <div className="space-y-4">
                      <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center">
                        <Smartphone className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-lg font-bold text-white font-sans">اتصال به عنوان دوربین (کلاینت)</h2>
                        <p className="text-xs text-slate-400 font-sans leading-relaxed">
                          اگر کد اتاق کنترلر را دارید، آن را در زیر وارد کنید تا به عنوان یکی از دوربین‌های فرعی متصل شده و پیش‌نمایش را آغاز کنید.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleJoinClient} className="space-y-3">
                      <div className="relative">
                        <input
                          type="text"
                          maxLength={4}
                          value={joinCodeInput}
                          onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                          placeholder="کد ۴ رقمی اتاق (مثال: A7E2)"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-center font-mono font-bold text-lg text-emerald-400 placeholder:text-slate-700 focus:outline-none focus:border-emerald-500 uppercase transition-all"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={joinCodeInput.length < 4}
                        className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/40 disabled:text-slate-600 text-slate-200 border border-slate-800 font-semibold py-3 px-4 rounded-xl text-sm transition-all font-sans"
                      >
                        اتصال به اتاق به عنوان دوربین
                      </button>
                    </form>
                  </div>

                </div>

                {/* Wi-Fi Synchronizer Info */}
                <div className="max-w-3xl mx-auto bg-slate-900/40 border border-slate-900 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-slate-300 font-sans text-xs font-semibold">
                    <Info className="w-4 h-4 text-emerald-400" />
                    چگونه تاخیر شبکه را از بین می‌بریم؟
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                    از آنجایی که دستورات فشرده شدن دکمه شاتر به طور همزمان به دلیل نوسان پینگ شبکه (وای‌فای، دیتا یا بلوتوث) با تاخیرهای متفاوت به گوشی‌ها می‌رسند، این سیستم از معماری <strong className="text-slate-300">Command & Sync</strong> استفاده می‌کند. ابتدا هر دستگاه با زمان‌سنجی مکرر پکت‌ها، میزان انحراف ساعت داخلی خود را با سرور همگام می‌کند (NTP). سپس کنترلر، فرمان عکاسی را برای یک ساعت مطلق آینده صادر می‌کند. همه گوشی‌ها شمارش معکوس محلی کرده و دقیقاً در یک میلی‌ثانیه واقعی عکس را ثبت می‌کنند.
                  </p>
                </div>
              </div>
            )}

          </div>
        )}

        {view === "controller" && (
          <ControllerPanel roomId={roomId} onExit={() => setView("home")} />
        )}

        {view === "client" && (
          <CameraClient roomId={roomId} onExit={() => setView("home")} />
        )}
      </main>

      {/* Footer Branding */}
      <footer className="border-t border-slate-900 bg-slate-950/40 py-6 px-6 text-center text-xs text-slate-600 font-sans leading-relaxed">
        <p>سیستم کنترل عکاسی چند زاویه‌ای همگام • توسعه داده شده با قوانین Zero-Delay Sync</p>
        <p className="mt-1 text-[10px] text-slate-700">حقوق کدهای بومی کاتلین محفوظ و قابل کپی برداری رایگان می‌باشد.</p>
      </footer>

    </div>
  );
}
