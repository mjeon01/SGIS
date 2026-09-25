import type {FloodRecord, WeatherComparison, DailyWeather, WeatherStation} from './index';

export type Disaster = 'heat' | 'flood' | 'landslide' | 'typhoon' | 'cold';
export type PendingDisaster = Exclude<Disaster, 'heat' | 'flood'>;
export type MapCamera = {longitude:number; latitude:number; zoom:number};

// Official snapshot contracts. Units and timestamp zones are explicit.
export type TyphoonPoint = {
  timestamp:string; latitude:number; longitude:number;
  pressure_hpa:number|null; wind_speed_ms:number|null;
  reported_at:string; classification:string|null; distance_km:number|null;
};
export type LandslidePoint = {
  id:string; latitude:number; longitude:number; type:string|null;
  designated_date:string|null; status:string|null;
  region_code:string|null; region_name:string|null;
  name:string; current_status:string|null; source_district:string|null;
};
export type ClimateObservation = {
  station_id:string; station_name:string; latitude:number|null; longitude:number|null;
  date:string; maximum:number|null; minimum:number|null;
};
export type DatasetProvenance = {
  source:string; source_url:string; collected_at:string;
  reference_date?:string|null; period?:[string,string]|null;
};
export type LayerAvailability<T> =
  | {status:'unavailable'; reason:string}
  | {status:'loading'}
  | {status:'error'; message:string}
  | {status:'ready'; data:T; meta:DatasetProvenance};

export type FloodMapLayer = {
  kind:'flood'; tab:'history'|'forecast'; records:FloodRecord[];
  selected:FloodRecord|null; onSelect:(id:string)=>void;
  imageUrl:string|null; bbox:[number,number,number,number];
};
export type WeatherMapLayer = {
  kind:'weather'; observed_on:string; stations:WeatherComparison['stations'];
  selectedStationId:string; onSelect:(id:string)=>void;
  focus:{id:number;longitude:number;latitude:number}|null;
};
export type DisasterMapLayer =
  | {kind:'base'} | {kind:'heat'} | {kind:'facilities'} | FloodMapLayer | WeatherMapLayer
  | LandslideMapLayer | TyphoonMapLayer | ColdMapLayer
  | {kind:'unavailable'; hazard:PendingDisaster};

export type LandslideData={meta:DatasetProvenance&{source_count:number;excluded_count:number;unassigned_count:number;boundary_year:number};records:LandslidePoint[]};
export type Storm={id:string;year:number;number:number;name:string;name_en:string;period:[string,string];point_count:number;closest_distance_km?:number;closest_timestamp?:string};
export type TyphoonList={meta:DatasetProvenance&{years:number[]};storms:Storm[]};
export type RegionReference={region_code:string;region_name:string;longitude:number;latitude:number};
export type TyphoonData={meta:DatasetProvenance;storm:Storm&{points:TyphoonPoint[]};region:RegionReference|null;closest:TyphoonPoint|null};
export type WinterStation={station_id:string;station_name:string;kind:string;locations:NonNullable<WeatherStation['location']>[];daily:DailyWeather['daily'];summary:DailyWeather['summary'];freezing_days:number|null;observed_freezing_days:number};
export type WinterData={meta:DatasetProvenance&{period:[string,string];season:string};stations:WinterStation[];region:RegionReference|null;nearby_stations:{station_id:string;station_name:string;distance_km:number}[];nearest:{station_id:string;distance_km:number}|null};
export type LandslideMapLayer={kind:'landslide';records:LandslidePoint[];selected:string;onSelect:(id:string)=>void;focus:{id:number;longitude:number;latitude:number}|null;fitRequest:number};
export type TyphoonMapLayer={kind:'typhoon';points:TyphoonPoint[];timestamp:string;onSelect:(timestamp:string)=>void;region:RegionReference|null;stormName:string;closest:TyphoonPoint|null;approach:TyphoonPoint[];viewRequest:{id:number;scope:'full'|'approach'|'moment'}|null};
export type ColdMapLayer={kind:'cold';stations:WinterStation[];date:string;selected:string;onSelect:(id:string)=>void};
export type DisasterProfile={region:RegionReference;reference_year:number;boundary_year:number;spatial_scope:string;source_url:string;stats:Record<string,number|null>;hazards:{heat:{station_name:string;period:string[];maximum:DailyWeather['summary']['maximum']}|null;flood:{count:number}|null;landslide:{count:number}|null;cold:{station_name:string;minimum:DailyWeather['summary']['minimum'];freezing_days:number|null}|null;typhoon:{name:string;year:number;closest:TyphoonPoint}|null}};
