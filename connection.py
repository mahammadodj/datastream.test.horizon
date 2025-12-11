import json

from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd

# Global cache for rates dataframe
_RATES_DF_CACHE = None

def _get_rates_df():
    global _RATES_DF_CACHE
    if _RATES_DF_CACHE is None:
        # print("Loading rates.csv into memory...")
        _RATES_DF_CACHE = pd.read_csv("rates.csv", parse_dates=["date"], dayfirst=True)
    return _RATES_DF_CACHE

def _invalidate_rates_cache():
    global _RATES_DF_CACHE
    _RATES_DF_CACHE = None

def extract_formation(d, formation="Bal_IX"):
    if isinstance(d, str):
        try:
            d = json.loads(d)
        except json.JSONDecodeError:
            return None
    return d.get(formation) if isinstance(d, dict) else None

#!!! Create "get_formation_names" function to list available formations in the data. Return list of strings
def get_formations():
    # return json.dumps(['Fasila',
	# 'Balakhany',
	# 'Surakhani',
	# 'Sabunchi'])
    data = json.load(open("wells.geojson", encoding="utf-8"))
    formations = set()
    for feature in data["features"]:
        horizon = feature["properties"].get("horizon")
        if isinstance(horizon, dict):
            formations.update(horizon.keys())
        elif isinstance(horizon, str):
            formations.add(horizon)
    return list(formations)

# wells = gpd.read_parquet(Path(dbpth)/"wells.geoparquet")
# wells = wells.set_geometry("geometry")

# target_geom = "geometry"
# geom_cols = [c for c in wells.columns if wells[c].dtype.name == "geometry"]

# for c in geom_cols:
#     if c != target_geom:
#         wells[c] = wells[c].to_wkt()

# wells = wells.drop(columns=['casing','tubing'])

# subset = wells.head(3)

# subset.to_json()

# json_str = subset.to_json()

# with open("wells.json", "w") as f:
#     f.write(json_str)

def get_wells(formation:str="Bal_IX") -> str:
    # -----------------------------------------------
    # gdf = gpd.read_file("wells.json")

    # data = gdf["formation"].map(lambda d: extract_formation(d, formation))

    # props = pd.json_normalize(data)

    # formation_gdf = gpd.GeoDataFrame(
    #     pd.concat([gdf.drop(columns=["id","formation"]), props], axis=1),
    #     geometry=gpd.points_from_xy(props["lon"], props["lat"]),
    #     crs="EPSG:4326"  # lat/lon
    # )
    # formation_gdf['formation'] = formation
    # -----------------------------------------------
    gdf = gpd.read_file("wells.geojson")
    if "horizon" in gdf.columns:
        gdf = gdf[gdf['horizon']==formation]
    
    # Extract lon/lat
    gdf["lon"] = gdf.geometry.x
    gdf["lat"] = gdf.geometry.y
    
    # Ensure spud_date is formatted correctly if it exists
    if "spud_date" in gdf.columns:
        # Convert to datetime first to handle various input formats, then format to string
        gdf["spud_date"] = pd.to_datetime(gdf["spud_date"], errors='coerce').dt.strftime("%Y-%m-%d")

    # -----------------------------------------------
    # wells = gpd.read_parquet(Path(dbpth)/"wells.geoparquet")

    # wells = wells.set_geometry("geometry")

    # target_geom = "geometry"
    # geom_cols = [c for c in wells.columns if wells[c].dtype.name == "geometry"]

    # for c in geom_cols:
    #     if c != target_geom:
    #         wells[c] = wells[c].to_wkt()

    # wells = wells.drop(columns=['casing','tubing'])

    # # wells['casing'] = wells['casing'].apply(lambda x: x.tolist() if isinstance(x, np.ndarray) else x)
    # # wells['tubing'] = wells['tubing'].apply(lambda x: x.tolist() if isinstance(x, np.ndarray) else x)

    return gdf.to_json()

def get_rates(*, date: str | None = None, well: str | None = None) -> str:
    # Use cached dataframe
    rates = _get_rates_df()

    if date is not None:
        # Normalize string input to date; strips time component if supplied
        date_to_filter = pd.to_datetime(date)
        rates = rates[rates["date"].dt.date == date_to_filter.date()]

    if well is not None:
        if well == "All":
            # Aggregate rates for all wells by date
            # We only sum the rate columns as requested
            numeric_cols = ["orate", "wrate", "grate"]
            # Filter for columns that actually exist
            numeric_cols = [c for c in numeric_cols if c in rates.columns]
            
            if numeric_cols:
                rates = rates.groupby("date")[numeric_cols].sum().reset_index()
                rates["well"] = "All"
                # Add other columns with default values or first values if needed?
                # For now, just the rates and date are sufficient for the chart.
        else:
            rates = rates[rates["well"] == well]

    return rates.reset_index(drop=True).to_json(orient="records", date_format="iso")

def get_latest_rates() -> str:
    # Use cached dataframe
    rates = _get_rates_df()
    
    # Sort by date descending and drop duplicates keeping the first (latest)
    latest = rates.sort_values("date", ascending=False).drop_duplicates("well")
    
    return latest.reset_index(drop=True).to_json(orient="records", date_format="iso")

def update_rates(updates: list[dict]) -> bool:
    """
    Update rates in the CSV file.
    updates: list of dicts containing 'well', 'date', and fields to update.
    """
    try:
        # Read with dayfirst=True to match existing format
        # We can use the cache here too, but for safety in writing, maybe read fresh?
        # Or just update the cache and write it out.
        # Let's read fresh to be safe against race conditions (though this is single threaded mostly)
        # But to keep it simple and consistent:
        df = pd.read_csv("rates.csv", parse_dates=["date"], dayfirst=True)
        
        for update in updates:
            well = update.get("well")
            date_str = update.get("date")
            
            if not well or not date_str:
                continue
                
            # Parse date to match dataframe format
            # The input date string is likely ISO (YYYY-MM-DD) from JSON
            date_val = pd.to_datetime(date_str)
            
            # Find the row
            # We need to compare dates carefully. 
            # df['date'] are timestamps.
            mask = (df["well"] == well) & (df["date"] == date_val)
            
            if mask.any():
                # Update fields
                for key, value in update.items():
                    if key in df.columns and key not in ["well", "date"]:
                        df.loc[mask, key] = value
        
        # Save back to CSV
        # Use the original format %d.%m.%Y
        df.to_csv("rates.csv", index=False, date_format="%d.%m.%Y")
        
        # Invalidate cache so next read gets new data
        _invalidate_rates_cache()
        
        return True
    except Exception as e:
        print(f"Error updating rates: {e}")
        return False
