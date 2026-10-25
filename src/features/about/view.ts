import { append, element, link } from '../shared/dom';
import { heading } from '../shared/pieces';
import type { PageFactory } from '../../app/view';
export const mountAbout:PageFactory=host=>{
 append(host,heading('关于影作','借一张幕，讲一次回家。','《影作·一幕团圆》据传统故事《劈山救母》改编，由零组创作。'));
 const article=element('article','reading-column about-cards');
 const rows=[['故事，从一盏灯开始','沉香远行救母，二郎守山，母亲等待着重获自由。灯下记忆与山前争辩，让一次回家也成为关于责任、勇气和选择的追问。'],['把手交给幕后的你','从故事缘起出发，为沉香制偶、调灯、练习，再正式开演。你可以选择先呼唤或先开山，并在五种终章中决定母子的去向。'],['看一场戏，也走进一座馆','五个展区、八件展品，带你从实物照片认识材料、刻制、操演与地方风貌。随时入馆，回到剧场还能接续这一场。']];
 for(const [title,text]of rows){const card=element('section','surface-card');append(card,element('h2','',title),element('p','',text));article.appendChild(card);}
 append(article,link('素材、音乐与字体致谢 →','./credits.html'));host.appendChild(article);
 return {update(){},dispose(){}};
};
