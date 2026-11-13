#!/bin/bash
# 9:16 だけを書き出し直す（コンテナの再起動で途中で止まったとき用）
set -e
cd /home/user/yorozuya-tenro-apps/studio
P=projects/P019-brandfilm
pkill -f chrom || true
node tools/render.mjs $P/scene.html $P/out/video_9x16.mp4 --w 1080 --h 1920 --fps 30 --from 0 --dur 30 --workers 1 --data $P/audio/P019-bgm_30s.beats.json
ffmpeg -y -loglevel error -i $P/out/video_9x16.mp4 -i $P/audio/P019-bgm_30s.wav -map 0:v -map 1:a -c:v libx264 -crf 17 -preset slow -maxrate 12M -bufsize 24M -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 192k -shortest $P/out/P019_9x16.mp4
echo done
