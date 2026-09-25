// Shared by map markers and the time strip; values and thresholds are unchanged.
export const thermalColor=(value:number|null)=>value==null?'#86918b':value>=33?'#b74132':value>=30?'#c76b30':value>=27?'#ad8432':'#477f93';
export const coldColor=(value:number|null)=>value==null?'#86918b':value<=-9?'#344c94':value<=-6?'#437fbd':value<=-3?'#56a2b8':value<0?'#6fb9bc':'#748985';
