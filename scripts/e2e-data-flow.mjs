import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const repository=fs.readFileSync(path.join(root,"lib/repository.ts"),"utf8");
const classroom=fs.readFileSync(path.join(root,"lib/classroom.ts"),"utf8");
const teacher=fs.readFileSync(path.join(root,"app/guru/page.tsx"),"utf8");
const practice=fs.readFileSync(path.join(root,"components/PracticeRunner.tsx"),"utf8");
const session=fs.readFileSync(path.join(root,"lib/session.ts"),"utf8");

const checks={
  attemptWriter: repository.includes("saveAttempt") && repository.includes('collection(services.db, "attempts")'),
  cloudReader: repository.includes("getRemoteAttempts") && repository.includes("watchRemoteAttempts"),
  retryQueue: repository.includes("repairCurrentStudentCloudRecords") && repository.includes("markAttemptSynced"),
  stableStudentIdentity: repository.includes("studentId:attempt.studentId") && session.includes("id:string"),
  classOwnership: classroom.includes("ownerUid") && classroom.includes("getRemoteClasses"),
  teacherRealtime: teacher.includes("watchRemoteAttempts(setAttempts"),
  teacherRosterCount: teacher.includes("rosterStudents=activeClasses.reduce"),
  practiceSubmit: practice.includes("saveAttempt") && practice.includes("studentId:student?.id"),
  qaIsolation: repository.includes('item.className==="__QA__"') || repository.includes('item.mode==="qa"'),
};
const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
console.log(JSON.stringify({suite:"GeoBoost data-flow contract",checks,failed},null,2));
if(failed.length) process.exit(1);
