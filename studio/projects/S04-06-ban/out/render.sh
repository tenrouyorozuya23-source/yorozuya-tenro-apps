#!/bin/bash
# 0〜10秒を1区間で書き出し（このコンテナの CPU では並列にすると1フレーム 14 秒かかり失敗するので 1 ワーカー）、前回の 10〜15 秒とつないで音を入れる
set -e
cd /home/user/yorozuya-tenro-apps/studio
P=projects/S04-06-ban
node tools/render.mjs $P/ban.html $P/out/seg_0.mp4 --w 1080 --h 1920 --fps 30 --from 0 --dur 10 --workers 1 --data $P/audio/S04-06-bgm_15s.beats.json
printf "file 'seg_0.mp4'\nfile 'seg_10.mp4'\n" > $P/out/list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i $P/out/list.txt -c copy $P/out/video.mp4
ffmpeg -y -loglevel error -i $P/out/video.mp4 -i $P/audio/S04-06-bgm_15s.wav -map 0:v -map 1:a -c:v libx264 -crf 18 -preset slow -maxrate 8M -bufsize 16M -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 192k -shortest $P/out/S04-06.mp4
echo done
