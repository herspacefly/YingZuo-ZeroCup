/** Hide native scrolling without fixing body: authored steps can still position their controls. */
export function lockGuideScroll(){
  const properties=['overflow','overscroll-behavior','scroll-behavior','scrollbar-gutter','overflow-anchor'];
  const saved=[document.documentElement,document.body].map(node=>({node,values:properties.map(name=>({name,value:node.style.getPropertyValue(name),priority:node.style.getPropertyPriority(name)}))}));
  for(const {node}of saved){node.style.setProperty('overflow','hidden','important');node.style.setProperty('overscroll-behavior','none','important');node.style.setProperty('scroll-behavior','auto','important');node.style.setProperty('overflow-anchor','none','important');}
  document.documentElement.style.setProperty('scrollbar-gutter','stable');
  let released=false;
  return()=>{if(released)return;released=true;for(const {node,values}of saved)for(const {name,value,priority}of values)if(value)node.style.setProperty(name,value,priority);else node.style.removeProperty(name);};
}
