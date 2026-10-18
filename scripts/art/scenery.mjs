/** Original, deterministic shadow-theatre scenery. Coordinates are a 1024 × 768 stage. */
export function drawDesignedScenery(ctx, spec) {
  const {width,height,id}=spec;ctx.save();ctx.scale(width/1024,height/768);
  const ink='#30291e',gold='#bd8b48',pale='#d8bc83',blue='#536d70',teal='#8ba6a4',red='#8c3f30';
  const path=(d,fill,stroke=ink,line=2)=>{const p=new Path2D(d);if(fill){ctx.fillStyle=fill;ctx.fill(p);}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke(p);}return p;};
  const line=(d,color=gold,width=2)=>path(d,null,color,width);
  const oval=(x,y,rx,ry,fill,stroke=null)=>{ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}};
  function cloud(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);line('M0 14 C-22 10 -22 -7 -8 -9 C-12 -29 18 -35 26 -17 C41 -29 62 -14 53 0 C78 -4 86 16 62 19 L4 19 M8 6 C-1 -6 16 -16 23 -6 C28 -16 44 -10 39 0 M12 27 L60 27',gold,2);ctx.restore();}
  function pine(x,y,s=1,flip=1){ctx.save();ctx.translate(x,y);ctx.scale(s*flip,s);path('M-8 94 C2 39 9 -1 39 -45 L48 -45 C19 2 19 47 10 94 Z',ink,gold,1.5);line('M9 42 Q-21 10 -67 -8 M23 10 Q62 -8 92 -38 M30 -11 Q6 -39 -18 -54 M38 -34 Q62 -61 91 -62',ink,7);for(const [cx,cy,rx]of [[-65,-9,47],[-31,-23,40],[80,-39,51],[107,-50,35],[-10,-58,41],[63,-65,45]]){path(`M${cx-rx} ${cy+10} Q${cx-rx*.8} ${cy-22} ${cx-rx*.28} ${cy-13} Q${cx} ${cy-32} ${cx+rx*.28} ${cy-13} Q${cx+rx*.8} ${cy-20} ${cx+rx} ${cy+10} Z`,ink,gold,1);for(let j=-2;j<3;j++)line(`M${cx+j*rx*.22} ${cy+6} l${j*2} -12`,'#786441',1);}ctx.restore();}
  function ridge(d,fill,contours){path(d,fill,gold,2);ctx.save();ctx.clip(new Path2D(d));for(const c of contours)line(c,'#ba9964',1.5);ctx.restore();}
  function rosette(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);for(let n=0;n<6;n++){ctx.rotate(Math.PI/3);path('M0 0 C-13 -20 -8 -32 0 -34 C8 -32 13 -20 0 0',null,gold,1.5);}oval(0,0,4,gold);ctx.restore();}
  switch(id){
    case 'home-window': {
      path('M32 102 L255 102 L255 479 L32 479 Z','#b9975d22',gold,5);path('M43 114 H244 V467 H43 Z',null,red,2);
      for(let x=62;x<246;x+=36)line(`M${x} 115 V468`,gold,3);
      for(let y=144;y<468;y+=44)line(`M43 ${y} H244`,gold,3);
      for(let y=144;y<445;y+=88)for(let x=62;x<240;x+=72)line(`M${x-15} ${y} l15 -15 l15 15 l-15 15 Z`,red,1.5);
      path('M18 90 Q135 20 270 90 L274 103 H15 Z',red,gold,2);cloud(90,62,.7);
      line('M838 0 V113',ink,3);path('M798 114 Q838 90 878 114 L887 178 Q838 207 789 178 Z','#cc7d38',red,3);
      for(const offset of [-24,-12,0,12,24])line(`M${838+offset*.6} 110 Q${838+offset*1.5} 149 ${838+offset*.6} 187`,pale,1.3);
      path('M798 113 H878 M797 185 H879 M833 196 H844 V213 H833 Z',gold,red,2);line('M838 214 V250 M832 221 V245 M845 221 V245',red,2);
      path('M944 0 L1024 0 L1024 520 Q992 487 969 402 Q948 279 944 0 Z',red,gold,3);for(let y=30;y<390;y+=70){cloud(970,y,.32);line(`M1007 ${y-20} Q983 ${y+20} 1002 ${y+50}`,gold,1);}
      path('M59 560 H237 L228 574 H65 Z',ink,gold,2);path('M80 574 H92 L86 663 H78 Z M206 574 H218 L221 663 H214 Z',ink,gold,2);
      path('M160 520 C145 532 144 546 158 557 L191 557 C206 541 200 530 188 520 L185 506 H163 Z',blue,gold,2);
      line('M174 512 Q174 475 198 452 M178 482 Q148 468 145 440 M187 467 Q216 465 223 438',ink,2);for(const [x,y]of [[198,452],[145,440],[223,438],[182,480]]){rosette(x,y,.33);oval(x,y,3,red);}
      break;
    }
    case 'home-floor':
      path('M0 659 Q510 651 1024 659 V768 H0 Z','#b19a6b',gold,2);line('M0 673 H1024 M0 681 H1024 M0 752 H1024',ink,2);
      for(let x=0;x<1024;x+=128){line(`M${x} 684 L${x-50} 750`,gold,1);line(`M${x+8} 712 h80 m-70 8 h80`,'#c4ae7b',1);}break;
    case 'mountain-far':
      ridge('M0 499 L42 371 L99 398 L159 242 L205 292 L242 167 L289 218 L337 435 L392 387 L452 504 L503 380 L538 336 L587 415 L647 307 L690 139 L726 98 L763 177 L801 333 L851 274 L905 420 L948 335 L1024 490 V768 H0 Z','#a6b9ad',[
        'M42 371 L74 529 L99 398 M159 242 L174 477 L205 292 M242 167 L225 501 M289 218 L276 480 M690 139 L703 469 M726 98 L746 386 M763 177 L750 475 M948 335 L963 582']);
      ridge('M0 575 Q90 490 179 558 L248 442 L292 510 L358 460 L409 570 L504 516 L601 569 L677 416 L732 516 L798 470 L864 550 L934 463 L1024 548 V768 H0 Z','#7d9996',[
        'M248 442 L237 640 M358 460 L340 622 M677 416 L655 646 M798 470 L820 643 M934 463 L913 663']);
      cloud(360,234,.75);cloud(806,199,.6);cloud(502,336,.5);pine(95,557,.48);pine(923,541,.58,-1);break;
    case 'road-near':
      ridge('M0 596 Q70 554 109 588 L168 479 L218 506 L250 630 L313 659 L365 768 H0 Z','#395759',['M168 479 L157 647 M218 506 L208 657 M40 611 Q104 601 130 686']);
      ridge('M747 768 L799 645 L861 604 L894 483 L940 441 L963 518 L1024 559 V768 Z','#395759',['M940 441 L921 681 M894 483 L878 691 M1000 571 L971 673']);
      pine(101,594,.76);pine(945,570,.75,-1);cloud(265,657,.58);cloud(783,697,.62);break;
    case 'road-path':
      path('M361 768 C453 705 438 650 529 600 Q566 578 598 537 L639 537 Q618 579 578 610 C501 661 536 727 642 768 Z','#c4aa70',gold,2);
      line('M391 768 Q524 685 483 656 M541 611 Q582 591 611 555',pale,4);for(let j=0;j<7;j++){const y=641+j*18,x=493+(j-2)*2;line(`M${x} ${y} q21 -5 42 1`,ink,1);}break;
    case 'road-ledge':
      ridge('M682 615 L814 611 L832 630 L875 651 L899 713 L678 714 L697 661 Z','#8a704e',['M698 631 L811 628 L824 667 L879 684 M707 641 L729 703 M813 668 L805 711 M746 680 L775 682']);
      for(let x=719;x<845;x+=28)line(`M${x} 619 l5 -15 l7 15`,blue,2);break;
    case 'mountain-left':
      ridge('M0 303 L70 261 L111 190 L170 204 L223 123 L277 147 L329 76 L390 87 L454 29 L497 43 L489 143 L516 216 L492 312 L523 393 L498 471 L478 552 L503 630 L493 700 L522 768 H0 Z','#425858',[
        'M70 261 L89 430 L64 590 L85 741 M111 190 L131 366 L117 476 L140 635 M170 204 L200 339 L177 469 L210 578 L188 750 M223 123 L244 261 L231 417 L256 535 L247 734 M277 147 L296 323 L274 484 L308 659 M329 76 L346 245 L330 410 L357 584 L340 750 M390 87 L415 204 L397 339 L428 515 L409 680 M454 29 L460 178 L443 303 L471 411 L451 570 L476 716']);
      pine(173,269,.67);pine(347,177,.45);cloud(56,609,.94);cloud(280,707,.64);break;
    case 'mountain-right':
      ridge('M497 43 L557 76 L611 93 L659 158 L711 139 L762 215 L824 197 L875 289 L932 278 L1024 348 V768 H522 L537 701 L517 628 L548 552 L533 464 L519 390 L543 313 L526 217 L508 143 Z','#425858',[
        'M557 76 L573 211 L552 368 L584 518 L567 711 M611 93 L627 265 L607 410 L639 595 L623 733 M659 158 L679 323 L653 467 L689 641 M711 139 L735 277 L714 410 L753 602 L741 750 M762 215 L787 380 L770 521 L803 717 M824 197 L846 349 L828 485 L860 653 M875 289 L899 435 L881 599 L909 748 M932 278 L958 439 L942 578 L980 731']);
      pine(793,301,.68,-1);pine(633,222,.43,-1);cloud(829,651,.82);cloud(588,728,.58);break;
    case 'mountain-dust':
      for(let n=0;n<6;n++){ctx.save();ctx.globalAlpha=.36;oval(206+n*124,623+(n%2)*35,138,67,'#c9af7c');ctx.restore();cloud(150+n*124,622+(n%2)*35,.9);}break;
    default:throw new Error('Unknown scene layer '+id);
  }
  ctx.restore();
}

/** Original three-piece carve-away patterns, normalized to preserve the existing placements. */
export function drawDesignedMotif(ctx,spec){
  const {width,height,pattern,segment}=spec;ctx.save();ctx.scale(width,height);ctx.translate(0,segment*.32);
  ctx.strokeStyle='#fff';ctx.fillStyle='#fff';ctx.lineWidth=.018;ctx.lineCap='round';ctx.lineJoin='round';
  const stroke=d=>ctx.stroke(new Path2D(d));const fill=d=>ctx.fill(new Path2D(d));
  if(pattern==='cloud-v1'){
    fill('M.12 .17 C.05 .13 .12 .08 .23 .10 C.20 .02 .40 .01 .46 .08 C.55 .02 .73 .05 .72 .12 C.89 .09 .98 .16 .85 .19 L.17 .19 Z');
    ctx.globalCompositeOperation='destination-out';ctx.lineWidth=.013;stroke('M.21 .14 C.17 .08 .38 .08 .39 .12 M.42 .14 C.47 .06 .66 .08 .62 .14 M.28 .23 L.78 .23');
  }else if(pattern==='wave-v1'){
    stroke('M.08 .18 C.22 .17 .25 .07 .39 .07 C.53 .07 .51 .19 .65 .19 C.79 .19 .84 .09 .93 .10 M.10 .23 C.24 .22 .33 .13 .42 .13 M.59 .24 C.75 .26 .85 .17 .94 .17');
    fill('M.25 .12 C.26 .04 .38 .015 .44 .06 C.37 .035 .31 .08 .34 .12 C.39 .15 .43 .12 .42 .10 C.49 .14 .39 .20 .32 .16 Z');
  }else{
    for(let n=0;n<5;n++){ctx.save();ctx.translate(.5,.15);ctx.scale(1,.42);ctx.rotate(n*Math.PI*2/5);fill('M0 0 C-.19 -.05 -.17 -.25 0 -.26 C.17 -.25 .19 -.05 0 0');ctx.restore();}
    ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.ellipse(.5,.15,.03,.013,0,0,Math.PI*2);ctx.fill();
  }ctx.restore();
}

export function drawDesignedProp(ctx,spec){
  ctx.save();ctx.scale(spec.width/122,spec.height/218);ctx.lineJoin='round';ctx.lineWidth=2;
  const p=(d,fill,stroke='#30291e',lw=2)=>{const shape=new Path2D(d);ctx.fillStyle=fill;ctx.fill(shape);ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke(shape);};
  p('M46 28 Q51 21 56 28 L53 212 Q48 217 44 211 Z','#9d6138','#483322',2);
  if(spec.id==='chenxiang-axe'){
    p('M51 24 Q75 19 105 30 Q111 61 96 88 Q74 75 52 72 Z','#58767a','#342b20',3);
    p('M91 30 L104 32 Q109 61 96 83 L87 77 Q101 53 91 30 Z','#d6bc7c','#d7a253',1);
    p('M53 34 L80 39 L76 65 L52 61 Z','#b83b30','#d7a253',2);
    ctx.strokeStyle='#d7a253';ctx.lineWidth=2;ctx.stroke(new Path2D('M59 42 Q75 45 66 55 Q57 59 58 49 M46 97 L54 97 M46 109 L54 109 M45 121 L54 121'));
  }else{
    p('M48 4 Q61 25 59 43 L74 29 L85 14 Q94 45 66 59 L56 69 L43 69 L31 56 Q10 44 19 14 L29 29 L41 43 Q39 24 48 4 Z','#c39b53','#30291e',2);
    p('M45 62 L55 62 L56 84 L44 84 Z','#b83b30','#d7a253',2);
  }ctx.restore();
}
