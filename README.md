# Voice Project — MossFormer2 (2-speaker) + TSE (any speaker count)

## What this is
Two separation models, routed by pyannote diarization:
- **MossFormer2** (via ClearerVoice-Studio) — fine-tuned, fixed at exactly 2 speakers
- **TSE** (Target-Speaker Extraction, built from scratch, SepFormer-style dual-path
  Transformer backbone) — no fixed count, run once per speaker pyannote detects

pyannote runs first and its speaker count decides which model handles the file.

## THE ONE THING YOU MUST NOT DO
**Never install `pyannote.audio` and `clearvoice` in the same Python
environment.** Their dependencies have directly contradictory numpy pins:
- `pyannote.audio` → depends on `pyannote-core`/`pyannote-metrics`, which
  require **`numpy>=2.0`**
- `clearvoice` requires **`numpy<2.0`**

No install order, restart, or clean reinstall fixes this — it's not
corruption, it's two hard version pins that can't both be satisfied. This
is why the project is split into two stages that never share an
environment.

## Folder structure
```
training/tse/
├── model.py            # TSE model (dual-path Transformer, no pretrained checkpoint)
├── dataset.py            # on-the-fly LibriSpeech mixing
├── losses.py               # SI-SDR + optional ID loss
├── train.py                  # training loop
├── evaluate.py                 # SI-SDRi + confusion-rate check
└── requirements.txt              # deps for TSE training (no clearvoice, no pyannote conflict)

mossformer2_train_test.py   # MossFormer2 fine-tuning (fixed 2 speakers), + smoke test
stage_a_diarize.py          # pyannote ONLY -- run in its own session/notebook
stage_b_separate.py         # clearvoice + TSE inference -- run in a SEPARATE session
```

## Datasets you need
- **Raw LibriSpeech** (`train-clean-100`, `dev-clean`, `test-clean`) from
  [openslr.org/12](https://www.openslr.org/12/) or Kaggle's LibriSpeech
  listings — for **TSE training** (`training/tse/train.py` builds mixtures
  on-the-fly from this, no pre-mixed data needed).
- **LibriMix** (Libri2Mix specifically, `train-clean-360` or `-100`) — for
  **MossFormer2 fine-tuning** (`mossformer2_train_test.py` expects CSVs with
  `mixture_path, source_1_path, source_2_path` columns, same format you were
  already using).

---

## Kaggle execution — 3 notebooks total

### Notebook 1: Train TSE (any speaker count)
No pyannote/clearvoice conflict here — only torch + speechbrain.
```bash
!pip install -q torch torchaudio speechbrain soundfile
```
```bash
!python model.py   # from training/tse/ -- smoke test, confirm "Shape check passed."
```
```bash
!python train.py \
    --train_dir /kaggle/input/<librispeech>/train-clean-100 \
    --val_dir   /kaggle/input/<librispeech>/dev-clean \
    --min_speakers 2 --max_speakers 6 \
    --epochs 40 --batch_size 8 \
    --checkpoint_dir /kaggle/working/checkpoints_tse
```
Download `checkpoints_tse/tse_best.pt` when done (or keep it in
`/kaggle/working/` if your later notebooks can read it, e.g. via a Kaggle
dataset made from this notebook's output).

### Notebook 2: Train MossFormer2 (fixed 2 speakers)
This is where clearvoice lives — **never install pyannote.audio here.**
```bash
!pip install -q git+https://github.com/modelscope/ClearerVoice-Studio.git#subdirectory=clearvoice
```
```bash
!pip install -q "numpy<2.0,>=1.24.3" torch torchaudio speechbrain torch-stoi soundfile pandas matplotlib
```
(clearvoice first, so numpy lands at `<2.0` before anything else builds
against it — installing in the other order is what caused the earlier
numpy corruption errors)

**Restart the session once** after both installs finish, then, with no
further installs:
```bash
!python mossformer2_train_test.py   # runs smoke_test() automatically, confirms output shape [2, 2, T]
```
If the printed shape is `[2, 2, T]` and no mismatch warning appears,
uncomment the `train()`/`plot_history()`/`test()` calls at the bottom of
the file and re-run for the real training run. Download
`checkpoints_mossformer2/mossformer2_best.pt` when done.

### Notebook 3: Run the combined pipeline on real audio (two stages, two sessions)

**Stage A — diarization (pyannote, no clearvoice):**
```bash
!pip install -q torch torchaudio pyannote.audio soundfile
```
```bash
!python stage_a_diarize.py --audio your_clip.wav --out_dir diarization_output
```
Requires `HF_TOKEN` env var set (from your Hugging Face account, after
accepting `pyannote/speaker-diarization-3.1`'s terms). This writes
`diarization_output/segments.json` + a copy of the audio.

**Restart the session completely** (or use a fresh notebook) before Stage B
— don't let pyannote's numpy>=2 install linger in the same environment.

**Stage B — separation (clearvoice + TSE, no pyannote):**
```bash
!pip install -q git+https://github.com/modelscope/ClearerVoice-Studio.git#subdirectory=clearvoice
!pip install -q "numpy<2.0,>=1.24.3" torch torchaudio speechbrain torch-stoi soundfile pandas
```
```bash
!python stage_b_separate.py \
    --diarization_dir diarization_output \
    --mossformer2_checkpoint checkpoints_mossformer2/mossformer2_best.pt \
    --tse_checkpoint training/tse/checkpoints_tse/tse_best.pt \
    --out_dir separation_output
```
This reads Stage A's `segments.json`, and automatically routes:
- exactly 2 speakers detected → MossFormer2, one pass
- any other count → TSE, one pass per speaker

Output `.wav` files land in `separation_output/`.

---

## Honest scoping — what's verified vs. not
- **TSE model.py**: shape-verified by you directly (you ran it locally,
  got "Shape check passed.", 6.5M params) — confirmed working.
- **MossFormer2 smoke test**: not yet confirmed passing on your end as of
  this delivery — the numpy/pyannote conflict was blocking it, now
  resolved by the two-stage split. Run it and confirm the `[2, 2, T]`
  shape before training.
- **stage_a_diarize.py / stage_b_separate.py**: not run in my sandbox
  (no torch/pyannote/clearvoice/network access here) — please run
  Stage A first (lighter, faster to fail) and confirm `segments.json`
  looks right before moving to Stage B.
- **speechbrain's own numpy requirements**: not verified against
  clearvoice's `<2.0` pin. If Stage B's install prints a version-conflict
  warning specifically naming speechbrain, stop and share it — that's a
  different problem from the pyannote one and would need its own fix.
