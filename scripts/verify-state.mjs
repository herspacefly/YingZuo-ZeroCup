import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const ledger = JSON.parse(readFileSync(path.join(root, 'docs/tasks.json'), 'utf8').replace(/^\uFEFF/, ''));
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const tasks = new Map();
check(ledger.schemaVersion === 1, 'Unknown ledger schema.');
check(Array.isArray(ledger.tasks), 'tasks must be an array.');
for (const task of ledger.tasks ?? []) {
  check(!tasks.has(task.id), `Duplicate task: ${task.id}`);
  tasks.set(task.id, task);
  check(/^T\d{2}$/.test(task.id), `Invalid task id: ${task.id}`);
  check(['todo', 'in_progress', 'blocked', 'done'].includes(task.status), `${task.id}: invalid status.`);
  check(typeof task.nextAction === 'string' && task.nextAction.trim(), `${task.id}: nextAction required.`);
  check(Array.isArray(task.touchFiles) && task.touchFiles.length > 0, `${task.id}: touchFiles required.`);
  check(Array.isArray(task.verification), `${task.id}: verification must be an array.`);
  check(task.acceptanceRefs?.includes(task.id), `${task.id}: self acceptance reference required.`);
  if (['in_progress', 'done'].includes(task.status)) {
    check(!!task.owner && !!task.branch, `${task.id}: owner and branch required.`);
  }
  if (task.status === 'blocked') check(!!task.blocker, `${task.id}: blocked without reason.`);
  if (task.status === 'done') check(task.verification?.length > 0, `${task.id}: done without verification.`);
  if (task.checkpointCommit !== null) {
    check(/^[a-f0-9]{40}$/.test(task.checkpointCommit ?? ''), `${task.id}: checkpoint must be a full SHA or null.`);
    try { execFileSync('git', ['cat-file', '-e', `${task.checkpointCommit}^{commit}`], { cwd: root, stdio: 'pipe' }); }
    catch { errors.push(`${task.id}: checkpoint commit does not exist.`); }
  }
}
const dependencies = (task, allFeatures = false) => {
  const deps = new Set(task.dependsOn ?? []);
  for (const dep of task.conditionalDependencies ?? []) {
    if (allFeatures || ledger.features[dep.feature] === dep.when) deps.add(dep.taskId);
  }
  for (const [feature, featureTasks] of Object.entries(ledger.conditionalDependencies?.[task.id] ?? {})) {
    if (allFeatures || ledger.features[feature] === 'enabled') featureTasks.forEach(id => deps.add(id));
  }
  return [...deps];
};
const plan = readFileSync(path.join(root, ledger.plan), 'utf8');
for (const task of tasks.values()) {
  check(plan.includes(`### ${task.id}：`), `${task.id}: missing plan section.`);
  for (const dependency of dependencies(task, true)) check(tasks.has(dependency), `${task.id}: unknown dependency ${dependency}.`);
  if (['in_progress', 'done'].includes(task.status)) {
    for (const dependency of dependencies(task)) check(tasks.get(dependency)?.status === 'done', `${task.id}: dependency ${dependency} is not done.`);
  }
}
// Also validate optional edges before those features are enabled.
const visited = new Set();
const visiting = new Set();
function visit(id) {
  if (visited.has(id) || !tasks.has(id)) return;
  if (visiting.has(id)) { errors.push(`Dependency cycle at ${id}.`); return; }
  visiting.add(id);
  dependencies(tasks.get(id), true).forEach(visit);
  visiting.delete(id); visited.add(id);
}
tasks.forEach((_, id) => visit(id));
if (ledger.activeTaskId !== null) check(tasks.get(ledger.activeTaskId)?.status === 'in_progress', 'activeTaskId must refer to an in_progress task.');
for (const feature of Object.values(ledger.features)) check(['planned_optional', 'enabled', 'omitted'].includes(feature), `Unknown feature state: ${feature}`);
for (const filename of ['START_HERE.md', 'AGENTS.md', 'docs/STATE.md', ledger.plan, ledger.storyBible]) {
  check(existsSync(path.join(root, filename)), `Missing handoff file: ${filename}`);
}
if (ledger.lastVerifiedCommit !== null) {
  check(/^[a-f0-9]{40}$/.test(ledger.lastVerifiedCommit ?? ''), 'lastVerifiedCommit must be a full SHA or null.');
  try { execFileSync('git', ['cat-file', '-e', `${ledger.lastVerifiedCommit}^{commit}`], { cwd: root, stdio: 'pipe' }); }
  catch { errors.push('lastVerifiedCommit does not exist.'); }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`PASS: ${tasks.size} tasks; dependencies, ownership, evidence and handoff files are consistent. This is not application acceptance.`);
