import type {Map} from 'maplibre-gl';

/** Frame explicit map actions in the area that is not covered by controls. */
export function mapPadding(map:Map) {
  const container=map.getContainer(),shell=container.closest('.climate-shell');
  const width=container.clientWidth,height=container.clientHeight;
  const panel=shell?.querySelector<HTMLElement>('.floating-detail');
  const open=panel&&!panel.hidden;
  const story=shell?.querySelector<HTMLElement>('.map-story-card');
  const storyBottom=story?.getClientRects().length?story.getBoundingClientRect().bottom-container.getBoundingClientRect().top+20:0;
  const timeline=shell?.querySelector<HTMLElement>('.timeline-dock');
  const markerSpace=shell?.getAttribute('data-hazard')==='typhoon'?90:40;
  const bottom=timeline?height-(timeline.getBoundingClientRect().top-container.getBoundingClientRect().top)+markerSpace:100;
  if(width<=760){
    const panelTop=open?panel.getBoundingClientRect().top-container.getBoundingClientRect().top:height;
    const legend=shell?.querySelector<HTMLElement>('.disaster-legend');
    const legendSpace=legend?.getClientRects().length?height-(legend.getBoundingClientRect().top-container.getBoundingClientRect().top)+markerSpace:0;
    const top=Math.max(165,storyBottom);
    return {top,bottom:Math.min(Math.max(0,height-top-140),Math.max(bottom,legendSpace,height-panelTop+markerSpace)),left:35,right:55};
  }
  return {top:Math.max(110,storyBottom),bottom,left:open?panel.getBoundingClientRect().width+48:80,right:85};
}

export function motionDuration(duration=500) {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:duration;
}
