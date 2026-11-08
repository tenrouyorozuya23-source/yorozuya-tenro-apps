#!/bin/bash
# 全尺を1ワーカーで書き出し（並列にすると CPU が足りず失敗する。S04-06 の知見）、音を入れ、6秒のバンパーも切り出す
set -e
cd /home/user/yorozuya-tenro-apps/studio
P=projects/P018-live-mic
pkill -f chrom || true
node tools/render.mjs $P/scene.html $P/out/video.mp4 --w 1080 --h 1920 --fps 30 --from 0 --dur 15 --workers 1 --data $P/audio/P018-bgm_15s.beats.json
ffmpeg -y -loglevel error -i $P/out/video.mp4 -i $P/audio/P018-final.wav -map 0:v -map 1:a -c:v libx264 -crf 18 -preset slow -maxrate 8M -bufsize 16M -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 192k -shortest $P/out/P018.mp4
# 6秒バンパー：4小節目の頭（7.5秒）から6秒。音は最後の0.4秒でフェードアウト
ffmpeg -y -loglevel error -ss 7.5 -t 6 -i $P/out/P018.mp4 -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -af "afade=t=out:st=5.6:d=0.4" -c:a aac -b:a 192k $P/out/P018_6s.mp4
echo done
