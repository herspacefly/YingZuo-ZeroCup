import {expect,it} from 'vitest';
import {reviewProblems} from '../../src/content/review-contract';
const sha='a'.repeat(64),proof={evidenceFile:'docs/reviews/author-confirmation.md',evidenceSha256:'b'.repeat(64)};
const subject={id:'asset:one',sha256:sha,rightsRequired:true,license:'project-authorized'};
const approved=()=>({id:subject.id,sha256:sha,review:{status:'approved',reviewer:'SpaceFly',reviewedAt:'2026-10-18',...proof},rights:{status:'granted',holder:'SpaceFly',terms:'project-authorized',...proof}});
it('requires individual author review and concrete rights evidence',()=>{expect(reviewProblems([subject],{schemaVersion:1,records:[approved()]})).toEqual([]);const record=approved();record.rights.terms='anything';expect(reviewProblems([subject],{schemaVersion:1,records:[record]})).toContain('asset:one: rights evidence pending');});
it('invalidates an old approval when the reviewed bytes change',()=>expect(reviewProblems([{...subject,sha256:'c'.repeat(64)}],{schemaVersion:1,records:[approved()]})).toContain('asset:one: review content changed'));
it('does not accept pending or absent review as approval',()=>{const record=approved();record.review.status='pending';expect(reviewProblems([subject],{schemaVersion:1,records:[record]})).toContain('asset:one: author review pending');expect(reviewProblems([subject],{schemaVersion:1,records:[]})).toContain('asset:one: review missing');});
it('rejects duplicate approval records and escaping evidence paths',()=>{const record=approved();record.review.evidenceFile='../approval.md';expect(reviewProblems([subject],{schemaVersion:1,records:[record,approved()]})).toContain('asset:one: duplicate review');expect(reviewProblems([subject],{schemaVersion:1,records:[record]})).toContain('asset:one: author review pending');});
