#!/bin/bash
# 3区間に分けて書き出し、つないで音を入れる
set -e
cd /home/user/yorozuya-tenro-apps/studio
P=projects/S04-06-ban
for seg in "0 5" "5 5"; do   # 10〜15秒は前回の書き出しをそのまま使う set -- $seg
  node tools/render.mjs $P/ban.html $P/out/seg_$1.mp4 --w 1080 --h 1920 --fps 30 --from $1 --dur $2 --workers 3 --data $P/audio/S04-06-bgm_15s.beats.json
done
printf "file 'seg_0.mp4'\nfile 'seg_5.mp4'\nfile 'seg_10.mp4'\n" > $P/out/list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i $P/out/list.txt -c copy $P/out/video.mp4
ffmpeg -y -loglevel error -i $P/out/video.mp4 -i $P/audio/S04-06-bgm_15s.wav -map 0:v -map 1:a -c:v libx264 -crf 18 -preset slow -maxrate 8M -bufsize 16M -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 192k -shortest $P/out/S04-06.mp4
echo done
