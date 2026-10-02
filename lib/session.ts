export type StudentSession = {
  id: string;
  name: string;
  className: string;
  classCode: string;
  createdAt: number;
  verifiedAt: number;
  pendingRoster?: boolean;
};

const KEY = "geoboost_student_session";

export function getStudentSession(): StudentSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id || !parsed?.name || !parsed?.className || !parsed?.verifiedAt) return null;
    return {
      id: String(parsed.id),
      name: String(parsed.name),
      className: String(parsed.className),
      classCode: String(parsed.classCode || ""),
      createdAt: Number(parsed.createdAt || Date.now()),
      verifiedAt: Number(parsed.verifiedAt),
      pendingRoster: Boolean(parsed.pendingRoster),
    };
  } catch {
    return null;
  }
}

export function saveStudentSession(session: StudentSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearStudentSession() {
  localStorage.removeItem(KEY);
}
