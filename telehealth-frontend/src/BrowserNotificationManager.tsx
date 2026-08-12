import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getAuthToken, getAuthUser } from "./auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const POLL_INTERVAL_MS = 30_000;

declare global {
  interface Window {
    __telehealthPeerConnection?: RTCPeerConnection;
    __telehealthPeerPatched?: boolean;
  }
}

function installPeerConnectionCapture() {
  if (
    typeof window === "undefined" ||
    typeof RTCPeerConnection === "undefined" ||
    window.__telehealthPeerPatched
  ) {
    return;
  }

  const NativeRTCPeerConnection = window.RTCPeerConnection;
  const originalAddTrack = NativeRTCPeerConnection.prototype.addTrack;

  NativeRTCPeerConnection.prototype.addTrack = function (
    track: MediaStreamTrack,
    ...streams: MediaStream[]
  ) {
    window.__telehealthPeerConnection = this;
    return originalAddTrack.call(this, track, ...streams);
  };

  const turnUrl = String(import.meta.env.VITE_TURN_URL ?? "").trim();
  const turnUsername = String(import.meta.env.VITE_TURN_USERNAME ?? "").trim();
  const turnCredential = String(import.meta.env.VITE_TURN_CREDENTIAL ?? "").trim();

  const PatchedRTCPeerConnection = new Proxy(NativeRTCPeerConnection, {
    construct(Target, args: [RTCConfiguration?]) {
      const currentConfig = args[0] ?? {};
      const existingIceServers = currentConfig.iceServers ?? [];
      const extraIceServers: RTCIceServer[] = [];

      if (turnUrl) {
        extraIceServers.push({
          urls: turnUrl,
          ...(turnUsername ? { username: turnUsername } : {}),
          ...(turnCredential ? { credential: turnCredential } : {}),
        });
      }

      const pc = Reflect.construct(Target, [
        {
          ...currentConfig,
          iceServers: [...existingIceServers, ...extraIceServers],
        },
      ]) as RTCPeerConnection;

      window.__telehealthPeerConnection = pc;
      return pc;
    },
  });

  window.RTCPeerConnection = PatchedRTCPeerConnection as typeof RTCPeerConnection;
  (globalThis as typeof globalThis & { RTCPeerConnection: typeof RTCPeerConnection }).RTCPeerConnection =
    PatchedRTCPeerConnection as typeof RTCPeerConnection;
  window.__telehealthPeerPatched = true;
}

installPeerConnectionCapture();

interface MedicationReminder {
  id: number;
  medicineName: string;
  reminderTime: string;
  isActive: boolean;
}

interface AppointmentReminder {
  id: number;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: string;
  patient?: { fullName?: string };
  doctor?: { fullName?: string };
}

function localDateKey(now: Date) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentTime(now: Date) {
  return `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;
}

function appointmentDateTime(appointment: AppointmentReminder) {
  const date = new Date(appointment.appointmentDate)
    .toISOString()
    .slice(0, 10);
  return new Date(`${date}T${appointment.startTime}:00+07:00`);
}

export function showBrowserNotification(
  title: string,
  options?: NotificationOptions,
) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return false;
  }

  const notification = new Notification(title, options);
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
  return true;
}

export default function BrowserNotificationManager() {
  const location = useLocation();
  const authUser = getAuthUser();
  const token = getAuthToken();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareStatus, setScreenShareStatus] = useState("");
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);

  const stopScreenShare = async () => {
    const pc = window.__telehealthPeerConnection;
    const originalTrack = originalVideoTrackRef.current;
    const videoSender = pc
      ?.getSenders()
      .find((sender) => sender.track?.kind === "video");

    if (videoSender && originalTrack && originalTrack.readyState === "live") {
      try {
        await videoSender.replaceTrack(originalTrack);
      } catch (error) {
        console.warn("Không thể trả video về camera:", error);
      }
    }

    displayStreamRef.current?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    displayStreamRef.current = null;
    originalVideoTrackRef.current = null;
    setIsScreenSharing(false);
    setScreenShareStatus("Đã quay lại camera.");
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
      return;
    }

    const pc = window.__telehealthPeerConnection;
    if (!pc || pc.connectionState !== "connected") {
      setScreenShareStatus("Hãy kết nối cuộc gọi trước khi chia sẻ màn hình.");
      return;
    }

    const videoSender = pc
      .getSenders()
      .find((sender) => sender.track?.kind === "video");
    if (!videoSender) {
      setScreenShareStatus("Không tìm thấy luồng video WebRTC.");
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const displayTrack = displayStream.getVideoTracks()[0];
      if (!displayTrack) {
        displayStream.getTracks().forEach((track) => track.stop());
        setScreenShareStatus("Không lấy được hình ảnh màn hình.");
        return;
      }

      originalVideoTrackRef.current = videoSender.track ?? null;
      await videoSender.replaceTrack(displayTrack);
      displayStreamRef.current = displayStream;
      setIsScreenSharing(true);
      setScreenShareStatus("Đang chia sẻ màn hình cho người bên kia.");

      displayTrack.onended = () => {
        void stopScreenShare();
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setScreenShareStatus("Bạn đã hủy chọn màn hình.");
        return;
      }
      console.error("Lỗi chia sẻ màn hình:", error);
      setScreenShareStatus("Không thể chia sẻ màn hình trên trình duyệt này.");
    }
  };

  useEffect(() => {
    if (location.pathname !== "/clinic" && displayStreamRef.current) {
      void stopScreenShare();
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!authUser || !token || permission !== "granted") {
      return;
    }

    let cancelled = false;

    const checkMedicationReminders = async () => {
      if (authUser.role !== "PATIENT") return;

      try {
        const response = await fetch(`${API_URL}/medication-reminders`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;

        const payload = await response.json();
        const reminders: MedicationReminder[] = Array.isArray(payload?.data)
          ? payload.data
          : [];
        const now = new Date();
        const minute = currentTime(now);

        for (const reminder of reminders) {
          if (
            cancelled ||
            !reminder.isActive ||
            reminder.reminderTime.slice(0, 5) !== minute
          ) {
            continue;
          }

          const deliveredKey = `telehealth-medication-notified:${reminder.id}:${localDateKey(
            now,
          )}:${minute}`;
          if (localStorage.getItem(deliveredKey)) continue;

          if (
            showBrowserNotification("Đến giờ uống thuốc", {
              body: `Bạn có lịch uống: ${reminder.medicineName} lúc ${minute}.`,
              tag: `medication-${reminder.id}-${localDateKey(now)}`,
              requireInteraction: true,
            })
          ) {
            localStorage.setItem(deliveredKey, new Date().toISOString());
          }
        }
      } catch (error) {
        console.warn("Không tải được lịch nhắc thuốc:", error);
      }
    };

    const checkAppointmentReminders = async () => {
      if (!["PATIENT", "DOCTOR"].includes(authUser.role)) return;

      try {
        const response = await fetch(`${API_URL}/appointments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;

        const payload = await response.json();
        const appointments: AppointmentReminder[] = Array.isArray(payload?.data)
          ? payload.data
          : [];
        const now = new Date();
        const thirtyMinutes = 30 * 60 * 1000;
        const twentyFourHours = 24 * 60 * 60 * 1000;

        for (const appointment of appointments) {
          if (
            cancelled ||
            !["PENDING", "CONFIRMED", "ACCEPTED"].includes(appointment.status)
          ) {
            continue;
          }

          const scheduledAt = appointmentDateTime(appointment);
          const millisecondsUntilAppointment = scheduledAt.getTime() - now.getTime();
          if (
            millisecondsUntilAppointment <= 0 ||
            millisecondsUntilAppointment > twentyFourHours
          ) {
            continue;
          }

          const isThirtyMinuteReminder =
            millisecondsUntilAppointment <= thirtyMinutes;
          const kind = isThirtyMinuteReminder ? "30m" : "24h";
          const deliveredKey = `telehealth-appointment-notified:${appointment.id}:${kind}`;
          if (localStorage.getItem(deliveredKey)) continue;

          const counterpart =
            authUser.role === "PATIENT"
              ? appointment.doctor?.fullName
              : appointment.patient?.fullName;
          const timeLabel = appointment.startTime.slice(0, 5);
          const dateLabel = scheduledAt.toLocaleDateString("vi-VN");
          const title = isThirtyMinuteReminder
            ? "Còn 30 phút đến lịch tư vấn"
            : "Nhắc lịch tư vấn trong 24 giờ";
          const body = `${dateLabel} lúc ${timeLabel}${
            counterpart ? ` · ${counterpart}` : ""
          }`;

          if (
            showBrowserNotification(title, {
              body,
              tag: `appointment-${appointment.id}-${kind}`,
              requireInteraction: isThirtyMinuteReminder,
            })
          ) {
            localStorage.setItem(deliveredKey, new Date().toISOString());
          }
        }
      } catch (error) {
        console.warn("Không tải được lịch hẹn để nhắc trên trình duyệt:", error);
      }
    };

    const checkAllReminders = async () => {
      await Promise.all([
        checkMedicationReminders(),
        checkAppointmentReminders(),
      ]);
    };

    void checkAllReminders();
    const timer = window.setInterval(
      () => void checkAllReminders(),
      POLL_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authUser?.id, authUser?.role, token, permission, location.pathname]);

  const showNotificationButton = Boolean(authUser && permission === "default");
  const showScreenShareButton = Boolean(
    authUser && location.pathname === "/clinic",
  );

  if (!showNotificationButton && !showScreenShareButton) {
    return null;
  }

  return (
    <>
      {showNotificationButton && (
        <button
          type="button"
          onClick={async () => {
            const result = await Notification.requestPermission();
            setPermission(result);
          }}
          className="fixed bottom-5 left-5 z-[120] rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-2xl transition hover:bg-sky-700"
          title="Bật thông báo lịch tư vấn, cuộc gọi và nhắc uống thuốc khi trang web đang mở"
        >
          🔔 Bật thông báo trình duyệt
        </button>
      )}

      {showScreenShareButton && (
        <div className="fixed bottom-5 right-5 z-[120] flex flex-col items-end gap-2">
          {screenShareStatus && (
            <div className="max-w-xs rounded-2xl bg-slate-950/90 px-4 py-2 text-xs font-semibold text-white shadow-xl">
              {screenShareStatus}
            </div>
          )}
          <button
            type="button"
            onClick={() => void toggleScreenShare()}
            className={`rounded-full px-5 py-3 text-sm font-bold text-white shadow-2xl transition ${
              isScreenSharing
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-sky-600 hover:bg-sky-700"
            }`}
            title={
              isScreenSharing ? "Dừng chia sẻ màn hình" : "Chia sẻ màn hình"
            }
          >
            {isScreenSharing ? "🖥️ Dừng chia sẻ" : "🖥️ Chia sẻ màn hình"}
          </button>
        </div>
      )}
    </>
  );
}
