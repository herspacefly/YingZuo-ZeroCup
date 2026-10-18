/** Request a file download; the caller owns this idempotent URL/timer cleanup. */
export function downloadResultBlob(blob:Blob,filename:string):()=>void{
  const legacy=navigator as Navigator&{msSaveOrOpenBlob?:(blob:Blob,name:string)=>boolean};
  if(legacy.msSaveOrOpenBlob){if(!legacy.msSaveOrOpenBlob(blob,filename))throw new Error('浏览器拒绝了文件下载请求。');return()=>undefined;}
  const a=document.createElement('a');
  if(!window.URL?.createObjectURL||!('download'in a))throw new Error('此浏览器无法下载留影；可先导出本场 JSON 保存作品。');
  const url=URL.createObjectURL(blob);let timer:ReturnType<typeof setTimeout>|undefined,cleaned=false;
  const cleanup=()=>{if(cleaned)return;cleaned=true;if(timer!==undefined)clearTimeout(timer);URL.revokeObjectURL(url);};
  try{a.href=url;a.download=filename;a.hidden=true;document.body.appendChild(a);a.click();timer=setTimeout(cleanup,1000);}
  catch(error){cleanup();throw error;}finally{if(a.parentNode)a.parentNode.removeChild(a);}
  return cleanup;
}
