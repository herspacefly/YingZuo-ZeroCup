export function downloadSample(value: unknown): () => void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
  const filename = 'yingzuo-light-probe.json';
  const legacyNavigator = navigator as Navigator & { msSaveOrOpenBlob?: (blob: Blob, name: string) => boolean };
  if (legacyNavigator.msSaveOrOpenBlob) {
    if (!legacyNavigator.msSaveOrOpenBlob(blob, filename)) throw new Error('浏览器未接受下载请求。');
    return () => undefined;
  }
  const link = document.createElement('a');
  if (!window.URL?.createObjectURL || !('download' in link)) throw new Error('此浏览器不支持文件下载。');
  const url = URL.createObjectURL(blob);
  let timer: ReturnType<typeof setTimeout>;
  const cleanup = () => { clearTimeout(timer); URL.revokeObjectURL(url); };
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  try { link.click(); }
  catch (error) { cleanup(); throw error; }
  finally { document.body.removeChild(link); }
  timer = setTimeout(cleanup, 1000);
  return cleanup;
}
