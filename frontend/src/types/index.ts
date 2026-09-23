import type { FeatureCollection, Geometry } from 'geojson';

export type Mode = 'sgis' | 'sample';
export type Layer = 'risk' | 'hazard' | 'exposure' | 'vulnerability' | 'heatwave_intensity' | 'heatwave_history_index' | 'total_population' | 'population_density' | 'elderly_ratio' | 'single_household_ratio' | 'old_house_ratio';
export type Comparison = { key: string; name: string; unit: string; value: number | null; comparison_average: number | null; difference: number | null; difference_pp: number | null; relative_ratio: number | null; comparison_region: string };
export type Factor = Comparison & { group: string; normalized_value: number | null; contribution: number | null; weight: number; source: string; source_detail: { endpoint?: string; reason?: string; station_id?: string; station_name?: string; distance_km?: number; valid_mean_days?: number; valid_max_days?: number; expected_days?: number }; reference_year: number | null };
export type RiskRegion = {
  region_code: string; region_name: string; full_name: string; parent_region_code: string; region_level: 'sido' | 'sigungu' | 'dong';
  risk_score: number | null; risk_level: string; risk_raw: number | null; hazard_score: number | null; exposure_score: number | null; vulnerability_score: number | null;
  data_completeness: number; missing_indicators: string[]; top_factors: Factor[]; factors: Factor[]; is_sample: boolean;
  reference_year: number | null; comparison_region: string; comparison_risk_average: number | null; risk_difference: number | null; no_variation: boolean;
  busan_comparison?: Comparison[]; source: string;
};
export type RegionOption = { region_code: string; region_name: string; parent_region_code: string; region_level: string };
export type MapProperties = { region_code: string; region_name: string; value: number | null; risk_score: number | null; risk_level: string; is_sample: boolean };
export type GeoData = FeatureCollection<Geometry, MapProperties>;
export type ViewData = {
  meta: { mode: Mode; reference_year: number; boundary_year: number; source: string; available_indicator_count: number; notes: string[]; collected_at?: string; alignment_notes?: string[] };
  level: 'children' | 'dong'; parent_code: string; breadcrumbs: { region_code: string; region_name: string }[]; layer: Layer; regions: RiskRegion[]; ranking: RiskRegion[];
  geojson: GeoData; scored_count: number; in_analysis_scope: boolean;
};
export type Explanation = {
  engine_label: string; summary: string; causes: { factor_key: string; text: string }[];
  actions: { factor_key: string; factor_name: string; title: string; text: string }[]; disclaimer: string; is_sample: boolean;
};

export type Facility = {
  id: string; kind: 'shelter' | 'shade'; name: string; address: string; longitude: number; latitude: number;
  reference_year: number; reference_date: string; source: string; source_url: string; access: string;
  capacity: number | null; hours: string; operating: string | null; installed_at?: string;
  region_code: string | null; region_name: string | null; filter_status?: 'matched'|'unknown';
};
export type FacilityData = {meta: {reference_year: number; boundary_year: number; collected_at: string; source_counts: Record<string,number>; mapped_counts: Record<string,number>; excluded_coordinate_count: number; unassigned_region_count: number; notes: string[]}; regions: (RegionOption & {full_name: string})[]; facilities: Facility[]};

type TemperatureExtreme = {value:number|null; dates:string[]; valid_days:number; complete:boolean};
export type DailyWeather = {available:boolean; reason?:string; reference_year:number; period:string[]; station_name:string; station_id:string; distance_km:number; source:string; source_url:string; heatwave_days:number|null; daily:{date:string; maximum:number|null; minimum:number|null}[]; summary:{expected_days:number; maximum:TemperatureExtreme; minimum:TemperatureExtreme}};
export type GuidanceSource = {id:string; publisher:string; title:string; url:string; checked_on:string; summary:string};
export type ResponsePlan = {id:string; title:string; factor_keys:string[]; factor_names:string[]; reason:string; basis:string; steps:string[]; condition:string; partners:string; completion:string; sources:GuidanceSource[]};
export type PreparedReport = {status:'prepared'|'not_prepared'|'stale'|'sample'|'insufficient'; narrative:{overview:string; next_step:string}|null; prepared_at:string|null; plans:ResponsePlan[]; sources:GuidanceSource[]; guidance_note:string};
export type ReviewSheet = {region:RiskRegion; rank:number|null; scored_count:number; total_count:number; rank_method:string; scope:string; explanation:Explanation; field_checks:{id:string; factor_name:string; text:string}[]; generated_at:string; facility_note:string; purpose:string; report:PreparedReport};

export type WeatherSeries={period:string[];daily:DailyWeather['daily'];summary:DailyWeather['summary'];heatwave_days:number|null};
export type WeatherStation={station_id:string;station_name:string;kind:string;location:{latitude:number;longitude:number;address:string}|null;source_url:string;recent:WeatherSeries;summer:WeatherSeries|null;latest:DailyWeather['daily'][number]|null};
export type CurrentWeather={meta:{reference_year:number;requested_through:string;latest_observation_date:string;collected_at:string;source:string;outdated:boolean};stations:WeatherStation[]};
export type RegionalCurrentWeather={region_code:string;region_name:string;meta:CurrentWeather['meta'];available:boolean;reason?:string;station?:WeatherStation;distance_km?:number;is_local_measurement:false};
export type WeatherComparison={meta:CurrentWeather['meta'];observed_on:string;observed_count:number;station_count:number;stations:(WeatherStation&{maximum:number|null;minimum:number|null;regions:{region_code:string;region_name:string;full_name:string;distance_km:number}[]})[]};
export type FacilityFilters={access:string;day:string;time:string};

export type FloodRecord={id:string;name:string;longitude:number;latitude:number;year:number|null;period:string|null;event:string;cause:string;depth:string;area:string;source_district:string|null;region_code:string|null;region_name:string|null};
export type FloodData={meta:{source:string;source_url:string;history_collected_at:string;collected_at:string;bbox:[number,number,number,number];source_count:number;excluded_count:number;unknown_year_count:number;unassigned_count:number;scenarios:{years:number;rainfall_mm_hour:number;layer:string}[]};records:FloodRecord[];regions:{region_code:string;region_name:string;full_name:string}[]};
