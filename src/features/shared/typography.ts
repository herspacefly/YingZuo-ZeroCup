export const KAI_FONT_FAMILY = '"Yingzuo Kai", KaiTi, "Kaiti SC", STKaiti, serif';
/** The same web font as HTML, with a system Kai fallback if loading is unavailable. */
export function loadKaiFont():{ready:Promise<boolean>;dispose():void}{
  let cancel=()=>{};
  const ready=new Promise<boolean>(resolve=>{
    let settled=false;
    const finish=(ok:boolean)=>{if(settled)return;settled=true;clearTimeout(timer);resolve(ok);};
    const timer=setTimeout(()=>finish(false),3000);cancel=()=>finish(false);
    if(!document.fonts?.load){finish(false);return;}
    try{void document.fonts.load('17px "Yingzuo Kai"').then(fonts=>finish(fonts.length>0),()=>finish(false));}
    catch{finish(false);}
  });
  return{ready,dispose(){cancel();}};
}
