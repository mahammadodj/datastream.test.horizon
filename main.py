"""FastAPI application exposing data access helpers defined in connection.py."""

from __future__ import annotations

import json
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Body, Response
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from pydantic import BaseModel
from typing import List, Any, Dict

from connection import get_rates, get_wells, get_formations, get_latest_rates, update_rates

app = FastAPI(title="OneMap API", version="0.1.0")

parent_path = Path(__file__).parent

app.mount("/onemap", StaticFiles(directory=parent_path / "onemap", html=True), name="frontend")
app.mount("/tile", StaticFiles(directory=parent_path / "tile"), name="tiles")

@app.get("/", response_class=HTMLResponse)
def root():
    """Serve the main HTML page."""
    index_path = parent_path / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="index.html not found")
    return HTMLResponse(index_path.read_text(encoding="utf-8"))

@app.get("/wells")
def list_wells(formation: str = "Bal_IX"):
    """Return well metadata as JSON."""
    try:
        payload = get_wells(formation)
        return Response(content=payload, media_type="application/json")
    except Exception as exc:  # pragma: no cover - surface unexpected IO/parsing issues
        raise HTTPException(status_code=500, detail=str(exc)) from exc

@app.get("/formations")
def list_formations():
    """Return well metadata as JSON."""
    try:
        payload = get_formations()
        return payload
    except Exception as exc:  # pragma: no cover - surface unexpected IO/parsing issues
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/rates")
def list_rates(
    date: Optional[str] = Query(default=None, description="Filter by ISO date (YYYY-MM-DD)"),
    well: Optional[str] = Query(default=None, description="Filter by well identifier"),
):
    """Return production rates optionally filtered by date and/or well."""
    try:
        payload = get_rates(date=date, well=well)
        return Response(content=payload, media_type="application/json")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - surface unexpected IO/parsing issues
        raise HTTPException(status_code=500, detail=str(exc)) from exc

@app.get("/rates/latest")
def list_latest_rates():
    """Return the latest production rate for each well."""
    try:
        payload = get_latest_rates()
        return Response(content=payload, media_type="application/json")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

@app.post("/rates")
def update_rates_endpoint(updates: List[Dict[str, Any]] = Body(...)):
    """Update production rates."""
    try:
        success = update_rates(updates)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update rates")
        return {"status": "success", "updated": len(updates)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

@app.get("/health")
def healthcheck():
    """Minimal health endpoint for readiness probes."""
    return {"status": "ok"}
