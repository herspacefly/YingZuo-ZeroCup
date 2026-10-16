/** IE11 exposes Web Crypto as msCrypto. No weak random fallback for persistent identities. */
export function newIdentifier(prefix: 'project' | 'writer' | 'run'): string {
  const crypto = window.crypto ?? (window as Window & { msCrypto?: Crypto }).msCrypto;
  if (!crypto?.getRandomValues) throw new Error('此浏览器无法生成可靠的项目标识，未创建或覆盖存档。');
  const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
  let result = `${prefix}-`;
  for (let i = 0; i < bytes.length; i++) result += (`0${bytes[i]!.toString(16)}`).slice(-2);
  return result;
}
