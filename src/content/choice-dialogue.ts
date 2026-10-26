import type { StoryNode } from '../domain/story-types';
import type { StoryProgress } from '../domain/types';

/** Recall choices on the authored timebase, without changing checkpoints. */
export function presentChoiceDialogue(node:StoryNode,story:StoryProgress):StoryNode {
  if(story.definitionVersion!==5||!story.choices||!['mountain-listen','ending-choice'].includes(node.id))return node;
  const {journeyIntent,mountainPact}=story.choices;
  if(!journeyIntent||!mountainPact||!story.approach)return node;
  const wish=journeyIntent==='home'?'接母亲回家':'为后来人留路';
  const pact=mountainPact==='shared'?'与二郎神共同稳住山势':'独自承山，承担永久化为山影的代价';
  const opening=story.approach==='call-first'?'先举灯呼唤，再挥斧开山':'先挥斧开山，再举灯寻她';
  const mother=mountainPact==='self'?'我想自由，也想你继续过自己的日子。永久承山会夺去你的未来；你没有欠我这样一生，今日仍可以暂缓。':story.approach==='split-first'?'你先为我开出了路。解印以后，我想和你并肩走一段，看看山外的天，再慢慢商量往后的生活。':journeyIntent==='home'?'若能解开封印，我愿和你回家。我要的不是一位永远举斧的英雄，是能一起吃饭、一起说话的孩子。':'若能先解开封印，我愿在山门留一盏灯，为后来人照路。守灯是我自己的选择，来去仍由我，你也能自由远行。';
  const full=node.subtitles.map(cue=>({...cue})),guide=node.guidedSubtitles?.map(cue=>({...cue}));
  if(node.id==='mountain-listen'){
    const first=full.find(cue=>cue.speaker==='narrator')??full[0];if(first){first.speaker='narrator';first.text=`你在途中说要${wish}，山前约定${pact}；你又选择了${opening}。这些话，此刻都还算数。`;}
    const response=full.find(cue=>cue.speaker==='mother');if(response)response.text=mother;
    if(guide?.[0]){guide[0].speaker='narrator';guide[0].text=`你想${wish}，也约定${mountainPact==='shared'?'合力稳山':'独自承受永久化山的代价'}。此刻先听母亲的愿望。`;}
    const shortResponse=guide?.find(cue=>cue.speaker==='mother');if(shortResponse)shortResponse.text=mountainPact==='self'?'我愿自由，也愿你活自己的未来；你仍可以暂缓最后一斧。':story.approach==='split-first'?'解印以后，我愿先与你同行，慢慢商量未来。':journeyIntent==='home'?'解印以后，我愿和你回家，重新过寻常日子。':'解印以后，我自愿留灯照路，来去仍由我。';
  }else{
    if(full[0]){full[0].speaker='narrator';full[0].text=`你曾决定${wish}，也选择${pact}。最后一斧，可以暂缓，也可以照说清的约定落下。`;}
    if(guide?.[0]){guide[0].speaker='narrator';guide[0].text=mountainPact==='self'?'继续解印意味着沉香永久化为山影，失去人间未来；仍可暂缓，留灯相守。':'暂缓会保留最后封印；继续则请二郎神共同稳山，兑现你与母亲说清的约定。';}
  }
  return {...node,lead:`来时愿望：${wish}；承山约定：${pact}。`,subtitles:full,...(guide?{guidedSubtitles:guide}:{})};
}
