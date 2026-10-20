/** One opaque buffer. Moving backgrounds draw directly until their key stabilizes. */
export class BackdropCache {
  private surface: {canvas:HTMLCanvasElement;context:CanvasRenderingContext2D}|null=null;
  private candidate:string|null=null;
  private cached:string|null=null;
  private unavailableSize:string|null=null;

  draw(target:CanvasRenderingContext2D,key:string,width:number,height:number,paint:(context:CanvasRenderingContext2D)=>void) {
    if(this.surface&&(this.surface.canvas.width!==width||this.surface.canvas.height!==height))this.clear();
    if(this.surface&&this.cached===key){target.drawImage(this.surface.canvas,0,0);return;}
    if(this.candidate!==key){this.candidate=key;this.cached=null;paint(target);return;}
    const size=`${width}/${height}`;
    if(!this.surface&&this.unavailableSize!==size){
      const canvas=document.createElement('canvas');
      try{
        canvas.width=width;canvas.height=height;
        const context=canvas.getContext('2d');
        if(context)this.surface={canvas,context};
        else{canvas.width=canvas.height=0;this.unavailableSize=size;}
      }catch{
        // Caching is optional. The existing target still draws the full scene.
        canvas.width=canvas.height=0;this.unavailableSize=size;
      }
    }
    if(!this.surface){paint(target);return;}
    try{
      paint(this.surface.context);this.cached=key;
      target.drawImage(this.surface.canvas,0,0);
    }catch(error){this.clear();throw error;}
  }
  clear(){
    if(this.surface)this.surface.canvas.width=this.surface.canvas.height=0;
    this.surface=null;this.candidate=this.cached=this.unavailableSize=null;
  }
}
