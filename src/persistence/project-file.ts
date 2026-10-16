import { MAX_PROJECT_BYTES } from '../domain/limits';
import { parseProjectJSON, serializeProject } from '../domain/migrations';
import type { ProjectV1 } from '../domain/types';
import { validateProject } from '../domain/validation';

export function exportProjectJSON(project: ProjectV1): string { return serializeProject(project); }
export function importProjectJSON(text: string): ProjectV1 { return parseProjectJSON(text); }
export function importedAsNew(project: ProjectV1, projectId: string, writerId: string, now: string): ProjectV1 {
  // Keep the recorded run/choices; importing is a copy of the performance, not a new rehearsal.
  return validateProject({ ...project, projectId, writerId, saveRevision: 0, savedAt: now });
}
export function readProjectFile(file: File): Promise<ProjectV1> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_PROJECT_BYTES) { reject(new Error('项目文件超过 512 KiB，未导入。')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('文件读取失败，原项目未改变。'));
    reader.onabort = () => reject(new Error('文件读取已取消，原项目未改变。'));
    reader.onload = () => {
      try { resolve(parseProjectJSON(String(reader.result))); }
      catch (error) { reject(error); }
    };
    reader.readAsText(file, 'utf-8');
  });
}
/** The caller owns the returned cleanup for page disposal. Download requests are not reported as disk writes. */
export function downloadJSON(text: string, filename: string): () => void {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const legacy = navigator as Navigator & { msSaveOrOpenBlob?: (blob: Blob, name: string) => boolean };
  if (legacy.msSaveOrOpenBlob) {
    if (!legacy.msSaveOrOpenBlob(blob, filename)) throw new Error('浏览器拒绝下载请求。');
    return () => undefined;
  }
  const link = document.createElement('a');
  if (!window.URL?.createObjectURL || !('download' in link)) throw new Error('浏览器无法下载文件，请复制导出内容。');
  const url = URL.createObjectURL(blob);
  let timer: ReturnType<typeof setTimeout>;
  const cleanup = () => { clearTimeout(timer); URL.revokeObjectURL(url); };
  link.href = url; link.download = filename; link.hidden = true;
  document.body.appendChild(link);
  try { link.click(); }
  catch (error) { cleanup(); throw error; }
  finally { document.body.removeChild(link); }
  timer = setTimeout(cleanup, 1000);
  return cleanup;
}
