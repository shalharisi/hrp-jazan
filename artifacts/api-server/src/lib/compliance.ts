/**
 * Booking compliance logic:
 * - Count working days between visitDate and appointmentDate
 * - Friday (5) and Saturday (6) are excluded
 * - <= 2 working days: compliant
 * - > 2 working days: non_compliant
 * - no appointment: pending
 */
export function countWorkingDays(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

  let count = 0;
  const current = new Date(start);

  // Don't count the start date itself, count days from day after
  current.setDate(current.getDate() + 1);

  while (current <= end) {
    const day = current.getDay(); // 0=Sun, 5=Fri, 6=Sat
    if (day !== 5 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

export function calculateCompliance(
  visitDate: string,
  appointmentDate: string | null | undefined,
): {
  compliance: "compliant" | "non_compliant" | "pending";
  workingDays: number | null;
} {
  if (!appointmentDate) {
    return { compliance: "pending", workingDays: null };
  }

  const days = countWorkingDays(visitDate, appointmentDate);

  return {
    compliance: days <= 2 ? "compliant" : "non_compliant",
    workingDays: days,
  };
}
