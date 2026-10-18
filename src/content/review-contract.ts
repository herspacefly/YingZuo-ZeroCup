/** Evidence completeness only; these fields cannot substitute for the author's actual decision. */
export interface ReviewSubject { id:string; sha256:string; rightsRequired:boolean; license?:string }
export interface ReviewRecord {
  id:string;sha256:string;
  review:{status:string;reviewer:string|null;reviewedAt:string|null;evidenceFile:string|null;evidenceSha256:string|null};
  rights?:{status:string;holder:string|null;terms:string|null;evidenceFile:string|null;evidenceSha256:string|null};
}
const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const named=(value:unknown)=>typeof value==='string'&&value.trim().length>0;
const evidence=(value:{evidenceFile?:unknown;evidenceSha256?:unknown})=>typeof value.evidenceFile==='string'&&/^docs\/reviews\/[a-z0-9-]+\.md$/.test(value.evidenceFile)&&hash(value.evidenceSha256);
export function reviewProblems(subjects:readonly ReviewSubject[],value:unknown):string[]{
  const problems:string[]=[];
  if(!value||typeof value!=='object'||!('schemaVersion'in value)||value.schemaVersion!==1||!('records'in value)||!Array.isArray(value.records))return ['review ledger missing or unsupported'];
  const records=new Map<string,ReviewRecord>();
  for(const entry of value.records){
    if(!entry||typeof entry!=='object'||typeof entry.id!=='string'){problems.push('invalid review record');continue;}
    if(records.has(entry.id))problems.push(`${entry.id}: duplicate review`);records.set(entry.id,entry as ReviewRecord);
  }
  for(const subject of subjects){
    const record=records.get(subject.id),review=record?.review;
    if(!record){problems.push(`${subject.id}: review missing`);continue;}
    if(!hash(record.sha256)||record.sha256!==subject.sha256)problems.push(`${subject.id}: review content changed`);
    if(!review||review.status!=='approved'||!named(review.reviewer)||!/^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt??'')||!evidence(review))problems.push(`${subject.id}: author review pending`);
    if(subject.rightsRequired){
      const rights=record.rights,allowed=['project-authorized','CC0-1.0','CC-BY-4.0','CC-BY-SA-4.0'];
      if(!rights||rights.status!=='granted'||!named(rights.holder)||!allowed.includes(rights.terms??'')||rights.terms!==subject.license||!evidence(rights))problems.push(`${subject.id}: rights evidence pending`);
    }
  }return problems;
}
