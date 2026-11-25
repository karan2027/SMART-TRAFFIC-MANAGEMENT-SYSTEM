import logging
from typing import Dict, Any

logger = logging.getLogger("EnvironmentalTelemetry")

class EnvironmentalTelemetryEngine:
    """
    Stage 3: Environmental & Carbon Offset Telemetry Calculator.
    Quantifies sustainability gains produced by adaptive signal optimization:
    - Fuel saved from eliminated idle time (0.00035 L/sec idling per vehicle)
    - CO2 emissions prevented (2.31 kg CO2 per litre gasoline/diesel)
    - PM2.5 particulate emission reduction (0.024 grams per minute idling)
    """

    FUEL_CONSUMPTION_RATE_L_PER_SEC = 0.00035 # Litres per second of idling engine
    CO2_KG_PER_LITRE_FUEL = 2.31 # kg CO2 produced per litre burned
    PM25_GRAMS_PER_MIN_IDLE = 0.024 # grams of PM2.5 prevented per idle minute

    def __init__(self):
        self.cumulative_idle_time_saved_sec = 0.0
        self.cumulative_vehicles_benefited = 0

    def record_cycle_savings(self, vehicles_serviced: int, avg_delay_reduction_seconds: float = 14.5) -> Dict[str, Any]:
        """
        Calculates environmental savings achieved in a single signal cycle.
        """
        total_time_saved = max(0.0, float(vehicles_serviced) * float(avg_delay_reduction_seconds))
        fuel_saved_l = total_time_saved * self.FUEL_CONSUMPTION_RATE_L_PER_SEC
        co2_prevented_kg = fuel_saved_l * self.CO2_KG_PER_LITRE_FUEL
        pm25_reduced_g = (total_time_saved / 60.0) * self.PM25_GRAMS_PER_MIN_IDLE

        self.cumulative_idle_time_saved_sec += total_time_saved
        self.cumulative_vehicles_benefited += vehicles_serviced

        cum_fuel = self.cumulative_idle_time_saved_sec * self.FUEL_CONSUMPTION_RATE_L_PER_SEC
        cum_co2 = cum_fuel * self.CO2_KG_PER_LITRE_FUEL
        cum_pm25 = (self.cumulative_idle_time_saved_sec / 60.0) * self.PM25_GRAMS_PER_MIN_IDLE

        return {
            "cycle_savings": {
                "vehicles_serviced": vehicles_serviced,
                "idle_time_reduced_seconds": round(total_time_saved, 1),
                "fuel_saved_litres": round(fuel_saved_l, 3),
                "co2_prevented_kg": round(co2_prevented_kg, 3),
                "pm25_reduced_grams": round(pm25_reduced_g, 3)
            },
            "cumulative_totals": {
                "total_idle_time_saved_hours": round(self.cumulative_idle_time_saved_sec / 3600.0, 2),
                "total_fuel_saved_litres": round(cum_fuel, 2),
                "total_co2_prevented_kg": round(cum_co2, 2),
                "total_pm25_reduced_grams": round(cum_pm25, 2),
                "total_vehicles_benefited": self.cumulative_vehicles_benefited
            }
        }
