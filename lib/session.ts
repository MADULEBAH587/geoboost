export type StudentSession = {
  id: string;
  name: string;
  className: string;
  classCode: string;
  pin: string;
  createdAt: number;
};

const KEY = "geoboost_student_session";

export function getStudentSession(): StudentSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
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
