/** Independent paper/leather study shapes, never attached to a puppet costume. */
export const CARVING_CUTS=[
  {name:'心瓣',path:'M150 151 C127 125 130 91 150 66 C170 91 173 125 150 151Z',x:150,y:112},
  {name:'左内瓣',path:'M142 156 C107 153 91 123 94 98 C123 104 142 124 142 156Z',x:117,y:130},
  {name:'右内瓣',path:'M158 156 C193 153 209 123 206 98 C177 104 158 124 158 156Z',x:183,y:130},
  {name:'左外瓣',path:'M133 167 C95 182 67 161 54 134 C86 130 119 142 133 167Z',x:91,y:153},
  {name:'右外瓣',path:'M167 167 C205 182 233 161 246 134 C214 130 181 142 167 167Z',x:209,y:153},
  {name:'左水纹',path:'M139 193 C111 182 85 188 68 204 C92 217 123 216 139 193Z',x:104,y:200},
  {name:'右水纹',path:'M161 193 C189 182 215 188 232 204 C208 217 177 216 161 193Z',x:196,y:200},
  {name:'灯心',path:'M150 222 C133 240 136 252 150 260 C164 252 167 240 150 222Z',x:150,y:242},
] as const;
export function cutSample(cuts:readonly number[],index:number):number[]{return Number.isInteger(index)&&index>=0&&index<CARVING_CUTS.length?Array.from(new Set([...cuts,index])).sort((a,b)=>a-b):[...cuts];}
