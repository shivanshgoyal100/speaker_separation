"""
backend/main.py — HTTP API wrapping the pyannote (diarization) + MossFormer2/TSE
(separation) pipeline, returning base64-encoded WAV stems -- the same
contract the "Polyphony"-style frontend expects ("any HTTP endpoint that
returns base64 WAV stems works").

WHY THIS SHELLS OUT TO TWO SEPARATE VENVS, RATHER THAN IMPORTING DIRECTLY:
pyannote.audio's own dependencies (pyannote-core, pyannote-metrics) require
numpy>=2.0. clearvoice requires numpy<2.0. These are directly contradictory
pins -- no single Python process can have both installed. So this API
process itself stays dependency-light (FastAPI + stdlib only) and calls out
to two pre-built virtualenvs via subprocess, one per stage -- reusing
stage_a_diarize.py and stage_b_separate.py exactly as built earlier, rather
than reimplementing their logic here.

Endpoints:
    POST /api/separate
        multipart/form-data: file=<audio file>
        -> {"detected_count": int, "stems": [{"speaker": str, "audio_base64": str}, ...]}

Run:
    uvicorn main:app --host 0.0.0.0 --port 8000

Required environment variables:
    HF_TOKEN                    -- HuggingFace token, for pyannote (see stage_a_diarize.py)
    PYANNOTE_VENV_PYTHON         -- path to the pyannote-only venv's python binary
    CLEARVOICE_VENV_PYTHON       -- path to the clearvoice+TSE venv's python binary
    STAGE_A_SCRIPT                -- path to stage_a_diarize.py
    STAGE_B_SCRIPT                -- path to stage_b_separate.py
    MOSSFORMER2_CHECKPOINT         -- path to your trained mossformer2_best.pt
    TSE_CHECKPOINT                  -- path to your trained tse_best.pt

See README.md in this folder for how to build the two venvs and where to
get each of these paths.
"""

import base64
import os
import shutil
import subprocess
import tempfile
import uuid

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="Voice Separation API")

# Allow the frontend (served from a different origin during local dev) to call this.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this to your actual frontend origin before deploying publicly
    allow_methods=["*"],
    allow_headers=["*"],
)

REQUIRED_ENV = [
    "PYANNOTE_VENV_PYTHON", "CLEARVOICE_VENV_PYTHON",
    "STAGE_A_SCRIPT", "STAGE_B_SCRIPT",
    "MOSSFORMER2_CHECKPOINT", "TSE_CHECKPOINT",
]


def _check_env():
    missing = [k for k in REQUIRED_ENV if not os.environ.get(k)]
    if missing:
        raise RuntimeError(
            f"Missing required environment variables: {missing}. "
            f"See backend/README.md for what each one should point to."
        )


@app.on_event("startup")
def startup_check():
    # Fail loudly at startup rather than on the first request -- a missing
    # path here means the server is misconfigured, not that the audio was bad.
    _check_env()


@app.post("/api/separate")
async def separate(file: UploadFile = File(...)):
    _check_env()
    work_dir = tempfile.mkdtemp(prefix="voicesep_")
    try:
        input_path = os.path.join(work_dir, file.filename or "input.wav")
        with open(input_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        diarization_dir = os.path.join(work_dir, "diarization_output")
        separation_dir = os.path.join(work_dir, "separation_output")

        # ---- Stage A: diarization (pyannote venv) ----
        stage_a_cmd = [
            os.environ["PYANNOTE_VENV_PYTHON"], os.environ["STAGE_A_SCRIPT"],
            "--audio", input_path, "--out_dir", diarization_dir,
        ]
        result_a = subprocess.run(stage_a_cmd, capture_output=True, text=True,
                                   env={**os.environ})
        if result_a.returncode != 0:
            raise HTTPException(status_code=500, detail=(
                f"Diarization stage failed:\n{result_a.stdout[-2000:]}\n{result_a.stderr[-2000:]}"
            ))

        # ---- Stage B: separation (clearvoice/TSE venv) ----
        stage_b_cmd = [
            os.environ["CLEARVOICE_VENV_PYTHON"], os.environ["STAGE_B_SCRIPT"],
            "--diarization_dir", diarization_dir,
            "--mossformer2_checkpoint", os.environ["MOSSFORMER2_CHECKPOINT"],
            "--tse_checkpoint", os.environ["TSE_CHECKPOINT"],
            "--out_dir", separation_dir,
        ]
        result_b = subprocess.run(stage_b_cmd, capture_output=True, text=True,
                                   env={**os.environ})
        if result_b.returncode != 0:
            raise HTTPException(status_code=500, detail=(
                f"Separation stage failed:\n{result_b.stdout[-2000:]}\n{result_b.stderr[-2000:]}"
            ))

        # ---- Collect output stems as base64 ----
        if not os.path.isdir(separation_dir):
            raise HTTPException(status_code=500, detail="Separation stage produced no output directory.")

        stems = []
        for fname in sorted(os.listdir(separation_dir)):
            if not fname.lower().endswith(".wav"):
                continue
            with open(os.path.join(separation_dir, fname), "rb") as f:
                audio_b64 = base64.b64encode(f.read()).decode("ascii")
            speaker_label = os.path.splitext(fname)[0]
            stems.append({"speaker": speaker_label, "audio_base64": audio_b64})

        if not stems:
            raise HTTPException(status_code=500, detail="No .wav stems were produced.")

        # detected_count is embedded in stage A's segments.json -- surface it
        # so the frontend can show "N speakers detected" without re-parsing
        import json
        with open(os.path.join(diarization_dir, "segments.json")) as f:
            segments = json.load(f)

        return JSONResponse({
            "detected_count": segments["detected_count"],
            "stems": stems,
        })

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


@app.get("/api/health")
def health():
    try:
        _check_env()
        return {"status": "ok"}
    except RuntimeError as e:
        return JSONResponse(status_code=503, content={"status": "misconfigured", "detail": str(e)})
