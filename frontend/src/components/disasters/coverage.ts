import type {Disaster} from '@/types/disasters';

// Registry of collected local datasets, not a promise of nationwide coverage.
// Add a province only after its collectors, APIs and validation support it.
export const LOCAL_DATA_AREAS:Record<Disaster,{code:string;name:string}[]>={
  heat:[{code:'21',name:'부산광역시'}],flood:[{code:'21',name:'부산광역시'}],
  landslide:[{code:'21',name:'부산광역시'}],typhoon:[{code:'21',name:'부산광역시'}],cold:[{code:'21',name:'부산광역시'}],
};
export function hasLocalData(hazard:Disaster,region:string) {return LOCAL_DATA_AREAS[hazard].some(area=>region.startsWith(area.code));}
