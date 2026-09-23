import math
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

Mode = Literal['sgis', 'sample']
AnalysisLevel = Literal['children', 'dong']


class Observation(BaseModel):
    model_config = ConfigDict(extra='forbid')
    region_code: str = Field(pattern=r'^\d{2}(?:\d{3}(?:\d{3})?)?$')
    reference_year: int
    avg_summer_temperature: float | None = None
    heatwave_intensity: float | None = None
    heatwave_history_index: float | None = Field(default=None, ge=0)
    total_population: float | None = Field(default=None, ge=0)
    population_density: float | None = Field(default=None, ge=0)
    elderly_population: float | None = Field(default=None, ge=0)
    elderly_ratio: float | None = Field(default=None, ge=0, le=100)
    total_households: float | None = Field(default=None, ge=0)
    single_household_count: float | None = Field(default=None, ge=0)
    single_household_ratio: float | None = Field(default=None, ge=0, le=100)
    total_houses: float | None = Field(default=None, ge=0)
    old_house_count: float | None = Field(default=None, ge=0)
    old_house_ratio: float | None = Field(default=None, ge=0, le=100)
    source: str = 'SGIS OpenAPI'
    source_detail: dict = Field(default_factory=dict)
    is_sample: bool = False

    @model_validator(mode='after')
    def finite_values(self):
        for value in self.model_dump().values():
            if isinstance(value, float) and not math.isfinite(value):
                raise ValueError('Non-finite observations are not allowed')
        for num, den in [('elderly_population', 'total_population'), ('single_household_count', 'total_households'), ('old_house_count', 'total_houses')]:
            a, b = getattr(self, num), getattr(self, den)
            if a is not None and b is not None and a > b:
                raise ValueError(f'{num} exceeds {den}')
        return self


class ExplainRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    region_code: str = Field(pattern=r'^\d{2}(?:\d{3}(?:\d{3})?)?$')
    parent_code: str = Field(default='21', pattern=r'^(?:00|\d{2}|\d{5})$')
    mode: Mode = 'sgis'
    level: AnalysisLevel = 'children'
