#!/bin/bash
# 16:9（1920×1080）と 9:16（1080×1920）を同じシーンから1ワーカーずつ書き出し、音を入れる
set -e
cd /home/user/yorozuya-tenro-apps/studio
P=projects/P019-brandfilm
pkill -f chrom || true
for spec in "1920 1080 16x9" "1080 1920 9x16"; do set -- $spec
  node tools/render.mjs $P/scene.html $P/out/video_$3.mp4 --w $1 --h $2 --fps 30 --from 0 --dur 30 --workers 1 --data $P/audio/P019-bgm_30s.beats.json
  ffmpeg -y -loglevel error -i $P/out/video_$3.mp4 -i $P/audio/P019-bgm_30s.wav -map 0:v -map 1:a -c:v libx264 -crf 17 -preset slow -maxrate 12M -bufsize 24M -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 192k -shortest $P/out/P019_$3.mp4
done
echo done
