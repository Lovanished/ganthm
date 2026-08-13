#!/usr/bin/env python3
"""
Local no-training rhythm chart generator.
Input: audio file + optional instrumental/MR file.
Output: charts/<name>.json

Install:
  python -m pip install numpy scipy librosa soundfile

If an MR/instrumental file is supplied, use it for onset/beat analysis.
"""
import argparse, json, os
import numpy as np
import librosa

def snap(t, bpm, subdivision=4, offset=0.0):
    step=60.0/bpm/subdivision
    return round((t-offset)/step)*step+offset

def main():
    p=argparse.ArgumentParser()
    p.add_argument("audio")
    p.add_argument("--mr", help="instrumental/MR audio used for analysis; strongly recommended")
    p.add_argument("--out", default="charts/generated.json")
    p.add_argument("--lanes", type=int, default=4, choices=[4,6,8])
    p.add_argument("--difficulty", type=str, default="normal", choices=["easy","normal","hard","expert"])
    args=p.parse_args()
    src=args.mr or args.audio
    y,sr=librosa.load(src,sr=None,mono=True)
    tempo,beats=librosa.beat.beat_track(y=y,sr=sr,units="time")
    bpm=float(np.asarray(tempo).reshape(-1)[0]) if np.asarray(tempo).size else 120.0
    onset_env=librosa.onset.onset_strength(y=y,sr=sr)
    times=librosa.times_like(onset_env,sr=sr)
    peaks=librosa.util.peak_pick(onset_env,pre_max=3,post_max=3,pre_avg=8,post_avg=8,delta=0.15,wait=3)
    raw=times[peaks]
    # Snap to 1/16 grid, remove duplicates and excessively dense hits.
    subdivision={"easy":2,"normal":4,"hard":4,"expert":8}[args.difficulty]
    min_gap={"easy":0.25,"normal":0.14,"hard":0.09,"expert":0.055}[args.difficulty]
    cand=sorted(set(round(snap(float(t),bpm,subdivision),4) for t in raw if t>0.15))
    out=[]; last=-1
    for t in cand:
        if t-last<min_gap: continue
        # deterministic lane walk with a slight pattern change every beat
        idx=len(out)
        lane=(idx + (idx//4)%2) % args.lanes
        out.append({"time":t,"lane":lane})
        last=t
    os.makedirs(os.path.dirname(args.out) or ".",exist_ok=True)
    data={"title":os.path.splitext(os.path.basename(args.audio))[0],"bpm":round(bpm,3),"audio":os.path.relpath(args.audio,os.path.dirname(args.out) or ".").replace("\\","/"),"notes":out}
    with open(args.out,"w",encoding="utf-8") as f: json.dump(data,f,ensure_ascii=False,indent=2)
    print(f"Generated {len(out)} notes, BPM={bpm:.2f} -> {args.out}")

if __name__=="__main__": main()
