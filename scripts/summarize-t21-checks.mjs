// Keep initial failures and latest focused results, rather than claiming one all-green full run.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const files=process.argv.slice(2);if(!files.length)throw new Error('Pass browser JSON reports in chronological acceptance order');
const sha=value=>createHash('sha256').update(value).digest('hex'),latest=new Map(),runs=[];
for(const file of files){const bytes=readFileSync(file),report=JSON.parse(bytes);runs.push({file,sha256:sha(bytes),stats:report.stats,globalErrors:report.errors??[]});
 function walk(suite){for(const spec of suite.specs??[])for(const test of spec.tests??[]){const key=[test.projectName,spec.file,spec.title].join('|'),result=test.results.at(-1);latest.set(key,{project:test.projectName,file:spec.file,title:spec.title,expected:test.expectedStatus,status:result?.status,report:file});}for(const child of suite.suites??[])walk(child);}for(const suite of report.suites??[])walk(suite);
}
const unresolved=[...latest.values()].filter(t=>t.status!==t.expected),result={clientReviewDate:'2026-10-23',machineUTC:new Date().toISOString(),baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),indexSha256:sha(readFileSync('dist/index.html')),statement:'Latest observation of each unique browser case across explicitly ordered reports. This is not a single all-green final full run. Native duration, visual review and loading are separate evidence.',runs,uniqueCases:latest.size,latestPassing:latest.size-unresolved.length,unresolved,checks:[...latest.values()]};
writeFileSync('docs/evidence/t21-t24-functional-checks.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({uniqueCases:result.uniqueCases,latestPassing:result.latestPassing,unresolved},null,2));if(unresolved.length||runs.some(r=>r.globalErrors.length))process.exitCode=1;
