export const DEFAULT_APPOINTMENT_SLOTS = [
  { startTime: '09:00', endTime: '10:00' },
  { startTime: '10:00', endTime: '11:00' },
  { startTime: '11:00', endTime: '12:00' },
  { startTime: '13:00', endTime: '14:00' },
  { startTime: '14:00', endTime: '15:00' },
  { startTime: '15:00', endTime: '16:00' },
  { startTime: '16:00', endTime: '17:00' },
  { startTime: '17:00', endTime: '18:00' },
] as const;

export function isDefaultAppointmentSlot(startTime: string, endTime: string) {
  return DEFAULT_APPOINTMENT_SLOTS.some(
    (slot) => slot.startTime === startTime && slot.endTime === endTime,
  );
}
