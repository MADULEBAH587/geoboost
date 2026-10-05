import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "app/page.tsx", "app/guru/page.tsx", "app/murid/page.tsx",
  "components/PracticeRunner.tsx", "components/GeoStimulus.tsx", "components/HotspotChoice.tsx",
  "lib/questions.ts", "lib/questionEngine.ts", "lib/firebase.ts", "lib/repository.ts", "lib/classroom.ts",
  "firebase/firestore.rules", "firebase/firestore.indexes.json",
  "public/manifest.webmanifest", "public/sw.js", "public/icon-192.png", "public/icon-512.png",
  "vercel.json", ".env.example"
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
const source = fs.readFileSync(path.join(root, "lib/questions.ts"), "utf8");
const engine = fs.readFileSync(path.join(root, "lib/questionEngine.ts"), "utf8");
const total = (source.match(/q\("GB\d{2}-\d{3}"/g) || []).length;
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const repository = fs.readFileSync(path.join(root, "lib/repository.ts"), "utf8");
const teacher = fs.readFileSync(path.join(root, "app/guru/page.tsx"), "utf8");
const studentPortal = fs.readFileSync(path.join(root, "components/StudentPortal.tsx"), "utf8");
const studentLogin = fs.readFileSync(path.join(root, "app/murid/page.tsx"), "utf8");
const firestoreRules = fs.readFileSync(path.join(root, "firebase/firestore.rules"), "utf8");
const storageRules = fs.readFileSync(path.join(root, "firebase/storage.rules"), "utf8");
const checks = {
  totalQuestions: total === 390,
  optionShuffle: engine.includes("options: shuffle(question.options)"),
  version: pkg.version === "2.5.0",
  realtimeAttempts: repository.includes("watchRemoteAttempts") && teacher.includes("watchRemoteAttempts(setAttempts"),
  resilientTeacherFeed: repository.includes('where("classCode","==",code)') && teacher.includes("Teacher attempt recovery failed"),
  partialClassRecovery: repository.includes("Promise.allSettled") && repository.includes("Attempt class fetch failed"),
  teacherDataHealth: teacher.includes("Status jawapan murid") && teacher.includes("refreshTeacherAttempts") && teacher.includes("Tak sepadan"),
  rosterStudentCount: teacher.includes("rosterStudents=activeClasses.reduce"),
  studentRepairSync: repository.includes("repairCurrentStudentCloudRecords") && studentPortal.includes("repairCurrentStudentCloudRecords"),
  explicitStudentLogout: studentPortal.includes("Log Keluar Murid"),
  scopedStudentRetry: studentLogin.includes("repairCurrentStudentCloudRecords") && !studentLogin.includes("syncPendingAttempts"),
  studentAttemptIdentity: firestoreRules.includes("request.resource.data.localStudentId == currentStudentLocalId()") && firestoreRules.includes("request.resource.data.classCode == currentStudentClassCode()"),
  storageTeacherOnlyWrite: storageRules.includes("allow write: if activeTeacher()") && storageRules.includes("firestore.exists"),
  failedAttemptRecovery: repository.includes("saveAttempt cloud upload failed") && repository.includes("repairCurrentStudentCloudRecords"),
  fullStudentReconciliation: repository.includes("filter(attempt => attempt.studentId === profile.localStudentId)") && studentPortal.includes('setInterval(()=>void repair(),60000)'),
  submissionEnsuresCloudIdentity: repository.includes("saveAttempt profile prerequisite failed") && repository.indexOf("syncStudentProfile({", repository.indexOf("export async function saveAttempt")) > -1,
};

if (missing.length || Object.values(checks).some((value) => !value)) {
  console.error("Production check FAILED", { missing, checks, totalQuestions: total, version: pkg.version });
  process.exit(1);
}
console.log("Production check OK", { requiredFiles: required.length, totalQuestions: total, version: pkg.version, optionShuffle: true });
