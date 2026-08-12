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
    if (
      !authUser ||
      authUser.role !== "PATIENT" ||
      !token ||
      permission !== "granted"
    ) {
      return;
    }

    let cancelled = false;

    const checkMedicationReminders = async () => {
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

    void checkMedicationReminders();
    const timer = window.setInterval(
      () => void checkMedicationReminders(),
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
      title="Bật thông báo cuộc gọi và nhắc uống thuốc khi trang web đang mở"
    >
      🔔 Bật thông báo trình duyệt
    </button>
  );
}
