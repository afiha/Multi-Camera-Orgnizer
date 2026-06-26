import React, { useState } from "react";
import { Copy, Check, Code, Phone, Wifi, ShieldAlert, Cpu, Layers } from "lucide-react";

export default function AndroidCodeCenter() {
  const [activeTab, setActiveTab] = useState<"bluetooth_offline" | "camera" | "manifest">("bluetooth_offline");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const bluetoothOfflineCode = `// 1. OFFLINE BLUETOOTH RFCOMM SYNC ENGINE (No Internet Required)
package com.example.multicam

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothServerSocket
import android.bluetooth.BluetoothSocket
import android.util.Log
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID

class OfflineBluetoothSyncEngine(private val adapter: BluetoothAdapter) {
    private val MY_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    private var serverThread: ServerThread? = null
    private var clientThread: ClientThread? = null

    // For Client: Calculated Clock Offset relative to the Director (Server)
    var clockOffsetMs: Long = 0
        private set

    // --- DIRECTOR (SERVER) ROLE ---
    fun startDirectorServer(onClientConnected: (BluetoothSocket) -> Unit) {
        serverThread = ServerThread(onClientConnected)
        serverThread?.start()
    }

    private inner class ServerThread(val onClientConnected: (BluetoothSocket) -> Unit) : Thread() {
        private val serverSocket: BluetoothServerSocket? by lazy(LazyThreadSafetyMode.NONE) {
            adapter.listenUsingRfcommWithServiceRecord("MultiCamDirector", MY_UUID)
        }

        override fun run() {
            var shouldLoop = true
            while (shouldLoop) {
                val socket: BluetoothSocket? = try {
                    serverSocket?.accept()
                } catch (e: IOException) {
                    shouldLoop = false
                    null
                }
                socket?.let {
                    onClientConnected(it)
                    // Start offline RTT clock sync session with this client
                    measureOffsetWithClient(it)
                }
            }
        }
    }

    private fun measureOffsetWithClient(socket: BluetoothSocket) {
        Thread {
            val outputStream: OutputStream = socket.outputStream
            val inputStream: InputStream = socket.inputStream
            val buffer = ByteArray(1024)

            try {
                // 1. Measure Round-Trip-Time (RTT) Offline over Bluetooth
                val t0 = System.currentTimeMillis()
                outputStream.write("PING".toByteArray()) // Send Sync Probe

                val bytes = inputStream.read(buffer)
                val response = String(buffer, 0, bytes)
                if (response == "PONG") {
                    val t3 = System.currentTimeMillis()
                    val rtt = t3 - t0
                    
                    // 2. Send Director's current clock time with RTT info
                    val syncMessage = "SYNC_TIME:\${System.currentTimeMillis()}:\${rtt}"
                    outputStream.write(syncMessage.toByteArray())
                }
            } catch (e: IOException) {
                Log.e("OFFLINE_SYNC", "Sync failed", e)
            }
        }.start()
    }

    // --- CAMERA CLIENT ROLE ---
    fun connectToDirector(deviceAddress: String, onCommandReceived: (String) -> Unit) {
        val device = adapter.getRemoteDevice(deviceAddress)
        clientThread = ClientThread(device, onCommandReceived)
        clientThread?.start()
    }

    private inner class ClientThread(val device: android.bluetooth.BluetoothDevice, val onCommandReceived: (String) -> Unit) : Thread() {
        private val socket: BluetoothSocket? by lazy(LazyThreadSafetyMode.NONE) {
            device.createRfcommSocketToServiceRecord(MY_UUID)
        }

        override fun run() {
            adapter.cancelDiscovery()
            try {
                socket?.connect()
                val inputStream = socket!!.inputStream
                val outputStream = socket!!.outputStream
                val buffer = ByteArray(1024)

                while (true) {
                    val bytes = inputStream.read(buffer)
                    val message = String(buffer, 0, bytes)

                    if (message == "PING") {
                        outputStream.write("PONG".toByteArray())
                    } else if (message.startsWith("SYNC_TIME:")) {
                        // Calculate offline clock offset
                        val parts = message.split(":")
                        val serverTime = parts[1].toLong()
                        val rtt = parts[2].toLong()
                        
                        // Local receive time
                        val tReceive = System.currentTimeMillis()
                        // Calculated Offset: Server Time + 1/2 RTT - Client local time
                        clockOffsetMs = (serverTime + (rtt / 2)) - tReceive
                        Log.i("OFFLINE_SYNC", "Calculated Offset relative to Director: \${clockOffsetMs}ms")
                    } else {
                        // Receive Action Command (e.g. "TRIGGER_CAPTURE:1687790310000")
                        onCommandReceived(message)
                    }
                }
            } catch (e: IOException) {
                Log.e("OFFLINE_SYNC", "Client socket disconnected", e)
            }
        }
    }
}`;

  const cameraCode = `// 2. CAMERA2 API WITH PRECISE TIME TRIGGER (Offline Capture Execution)
package com.example.multicam

import android.content.Context
import android.hardware.camera2.*
import android.media.ImageReader
import android.os.Handler
import android.os.Looper
import android.util.Log

class OfflineCameraTrigger(private val context: Context, private val clockOffsetMs: Long) {
    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var imageReader: ImageReader? = null

    // Receive a synchronized server timestamp and trigger local capture
    fun handleIncomingTrigger(targetServerTimeMs: Long) {
        // Local clock target time = Server Target Time - Client Clock Offset
        val targetLocalTimeMs = targetServerTimeMs - clockOffsetMs
        val now = System.currentTimeMillis()
        val delay = targetLocalTimeMs - now

        if (delay <= 0) {
            triggerShutter()
        } else {
            val handler = Handler(Looper.getMainLooper())
            handler.postDelayed({
                triggerShutter()
            }, delay)
            Log.i("NATIVE_CAM", "Offline Trigger scheduled in \${delay}ms")
        }
    }

    private fun triggerShutter() {
        try {
            val captureBuilder = cameraDevice?.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE)
            imageReader?.surface?.let { captureBuilder?.addTarget(it) }
            
            // Set locking triggers to ensure synchronized auto-focus/exposure
            captureBuilder?.set(CaptureRequest.CONTROL_AF_TRIGGER, CameraMetadata.CONTROL_AF_TRIGGER_START)
            
            captureSession?.capture(captureBuilder!!.build(), object : CameraCaptureSession.CaptureCallback() {
                override fun onCaptureCompleted(session: CameraCaptureSession, request: CaptureRequest, result: TotalCaptureResult) {
                    super.onCaptureCompleted(session, request, result)
                    Log.i("NATIVE_CAM", "Photo taken exactly at synchronized epoch: \${System.currentTimeMillis()}")
                }
            }, null)
        } catch (e: Exception) {
            Log.e("NATIVE_CAM", "Trigger failed", e)
        }
    }
}`;

  const manifestCode = `<!-- 3. ANDROID MANIFEST PERMISSIONS FOR OFFLINE BLUETOOTH & CAMERA -->
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.multicam">

    <!-- Camera Permissions -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" />

    <!-- Bluetooth Classic & P2P Offline Permissions (Android 12+) -->
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" 
                     android:usesPermissionFlags="neverForLocation" />
    
    <!-- Legacy Bluetooth Permissions for Older Android Versions -->
    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="MultiCam Sync Offline"
        android:theme="@style/Theme.MaterialComponents.DayNight.NoActionBar">
        
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

  return (
    <div id="android-developer-center" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100 max-w-4xl mx-auto my-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
          <Cpu className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white font-sans">
            راهنمای برنامه‌نویسان اندروید (کدهای کاتلین)
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            دستورالعمل‌ها و کدهای بومی اندروید برای پیاده‌سازی سخت‌افزاری عکاسی و فیلم‌برداری همزمان
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <button
          onClick={() => setActiveTab("bluetooth_offline")}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 font-sans ${
            activeTab === "bluetooth_offline"
              ? "bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/10"
              : "bg-slate-800/50 text-slate-300 hover:bg-slate-800 border border-slate-800/80"
          }`}
        >
          <Wifi className="w-4 h-4" />
          همگام‌سازی آفلاین بلوتوث (RFCOMM)
        </button>
        <button
          onClick={() => setActiveTab("camera")}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 font-sans ${
            activeTab === "camera"
              ? "bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/10"
              : "bg-slate-800/50 text-slate-300 hover:bg-slate-800 border border-slate-800/80"
          }`}
        >
          <Phone className="w-4 h-4" />
          کنترل دوربین (Camera2 API)
        </button>
        <button
          onClick={() => setActiveTab("manifest")}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 font-sans ${
            activeTab === "manifest"
              ? "bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/10"
              : "bg-slate-800/50 text-slate-300 hover:bg-slate-800 border border-slate-800/80"
          }`}
        >
          <Layers className="w-4 h-4" />
          تنظیمات مانیفست و مجوزها
        </button>
      </div>

      <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden mb-6">
        <div className="flex justify-between items-center px-4 py-2 bg-slate-900 border-b border-slate-800">
          <span className="text-xs text-slate-400 font-mono">Kotlin / Android Source Code</span>
          <button
            onClick={() =>
              copyToClipboard(
                activeTab === "bluetooth_offline"
                  ? bluetoothOfflineCode
                  : activeTab === "camera"
                  ? cameraCode
                  : manifestCode,
                activeTab === "bluetooth_offline" ? 1 : activeTab === "camera" ? 2 : 3
              )
            }
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 py-1 px-2.5 rounded-md hover:bg-slate-800 transition-all font-sans"
          >
            {copiedIndex !== null ? (
              <>
                <Check className="w-3.5 h-3.5" />
                کپی شد
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                کپی کد
              </>
            )}
          </button>
        </div>

        <div className="p-4 max-h-[380px] overflow-y-auto">
          <pre className="text-xs font-mono leading-relaxed text-emerald-300/95 text-left select-all" dir="ltr">
            <code>
              {activeTab === "bluetooth_offline" && bluetoothOfflineCode}
              {activeTab === "camera" && cameraCode}
              {activeTab === "manifest" && manifestCode}
            </code>
          </pre>
        </div>
      </div>

      <div className="bg-slate-800/40 border border-slate-800/80 rounded-xl p-4 flex gap-3 text-slate-300 text-xs font-sans leading-relaxed">
        <ShieldAlert className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-emerald-300 font-medium block mb-1">توضیح فنی همگام‌سازی کاملاً آفلاین (Offline Sync):</strong>
          {activeTab === "bluetooth_offline" && (
            <p>
              در عکاسی و فیلم‌برداری آفلاین، گوشی‌ها از طریق سوکت بلوتوث RFCOMM با یکدیگر ارتباط برقرار می‌کنند. برای حل مشکل تاخیر متغیر فرستادن اطلاعات در بلوتوث، دستگاه کارگردان یک سیگنال PING به دستگاه همکار می‌فرستد. همکار بلافاصله با PONG پاسخ می‌دهد. به این ترتیب زمان رفت‌وبرگشت (RTT) اندازه‌گیری شده و انحراف ساعت داخلی همکار بدون نیاز به سرور یا اینترنت محاسبه می‌شود (Offset).
            </p>
          )}
          {activeTab === "camera" && (
            <p>
              با ترکیب آفست بلوتوثی به دست آمده، زمان شاتر دقیقاً روی ساعت بومی اندروید زمان‌بندی می‌شود. وقتی فرمان عکاسی همزمان فرستاده می‌شود، مثلاً برای زمان <code className="bg-slate-900 px-1 py-0.5 text-emerald-400 rounded">T + 1500ms</code>، تلفن‌های همراه با کمک Handler بومی اندروید و ترد بسیار سریع، شاتر فیزیکی را بدون لگ عکاسی می‌کنند.
            </p>
          )}
          {activeTab === "manifest" && (
            <p>
              در نسخه‌های اندروید ۱۲ و بالاتر (Android 12+)، مجوزهای بلوتوث به مجوزهای دقیق اتصال (<code className="bg-slate-900 px-1 py-0.5 text-emerald-400 rounded">BLUETOOTH_CONNECT</code>)، اسکن و برودکست تقسیم شده‌اند. داشتن این مجوزها و کسب تأییدیه کاربر در هنگام اجرای برنامه برای کارکرد صحیح آفلاین دوربین الزامی است.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
