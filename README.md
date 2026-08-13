# Rhythm Web — 즉시 사용 가능한 GitHub Pages 리듬게임

## 1. GitHub Pages에서 게임 실행
이 폴더 전체를 GitHub 저장소에 올리고 Pages를 `main` 브랜치의 root로 설정한다.
`charts/index.json`에 곡을 추가하고 `charts/*.json`의 `audio` 경로를 실제 MP3 경로로 수정한다.

## 2. 자동 채보 생성기
Python 3.10+ 권장.

```bash
python -m pip install numpy scipy librosa soundfile
python generator.py songs/song.mp3 --mr songs/song_mr.mp3 --out charts/song.json --difficulty normal
```

MR이 있으면 `--mr`을 반드시 사용하는 것을 권장한다.

생성된 JSON을 `charts/index.json`에 등록:
```json
{"title":"Song","chart":"charts/song.json"}
```

주의: 브라우저는 로컬/원격 음원의 형식 및 CORS 정책에 영향을 받는다. GitHub Pages에 MP3를 저장할 경우 저장소 용량/트래픽 및 저작권을 확인해야 한다.
