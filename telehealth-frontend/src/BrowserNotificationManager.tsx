import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getAuthToken, getAuthUser } from "./auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const POLL_INTERVAL_MS = 30_000;

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
      if (!['PATIENT', 'DOCTOR'].includes(authUser.role)) return;

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
            !['PENDING', 'CONFIRMED', 'ACCEPTED'].includes(appointment.status)
          ) {
            continue;
          }

          const scheduledAt = appointmentDateTime(appointment);
          const millisecondsUntilAppointment = scheduledAt.getTime() - now.getTime();
          if (millisecondsUntilAppointment <= 0 || millisecondsUntilAppointment > twentyFourHours) {
            continue;
          }

          const isThirtyMinuteReminder = millisecondsUntilAppointment <= thirtyMinutes;
          const kind = isThirtyMinuteReminder ? '30m' : '24h';
          const deliveredKey = `telehealth-appointment-notified:${appointment.id}:${kind}`;
          if (localStorage.getItem(deliveredKey)) continue;

          const counterpart = authUser.role === 'PATIENT'
            ? appointment.doctor?.fullName
            : appointment.patient?.fullName;
          const timeLabel = appointment.startTime.slice(0, 5);
          const dateLabel = scheduledAt.toLocaleDateString('vi-VN');
          const title = isThirtyMinuteReminder
            ? 'Còn 30 phút đến lịch tư vấn'
            : 'Nhắc lịch tư vấn trong 24 giờ';
          const body = `${dateLabel} lúc ${timeLabel}${counterpart ? ` · ${counterpart}` : ''}`;

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
        console.warn('Không tải được lịch hẹn để nhắc trên trình duyệt:', error);
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

  if (!authUser || permission !== "default") {
    return null;
  }

  return (
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
  );
}
