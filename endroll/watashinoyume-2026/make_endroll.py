"""credits.txt と音源から、黒地に白文字が下から上へ流れるエンドロール動画を作る。

- 1行 = 1行、空行 = 1行分の余白。すべて中央揃え・明朝体（太字）。
- 最後の見出し（【事務局】）から末尾までのブロックが、--stop-at 秒（音源のインパクト）で
  画面中央に来てピタッと止まるよう、一定速度でスクロールする。
- 止まった画面に前の行が残らないよう、必要なら最後のブロックの前の余白を広げる。
- --fade-start から --fade 秒かけて文字と音を同時にフェードアウトし、黒画面のまま --end 秒で終わる。
- 1ピクセル未満の位置も補間するので、スクロールがガタつかない。

使い方:
  python3 make_endroll.py --audio 音源.wav --font NotoSerifJP-Bold.ttf --out endroll.mp4
"""
import argparse
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent


def render_sheet(lines, font, width, line_height):
    """全行を縦長の1枚に描く（上下に画面1枚分ずつ黒い余白を付けない素の高さ）。"""
    sheet = Image.new('L', (width, line_height * len(lines)), 0)
    draw = ImageDraw.Draw(sheet)
    for i, line in enumerate(lines):
        if line:
            # anchor='mm' で行の中心に揃える（中央揃え）
            draw.text((width / 2, i * line_height + line_height / 2), line,
                      font=font, fill=255, anchor='mm')
    return np.asarray(sheet, dtype=np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--audio', required=True)
    ap.add_argument('--font', required=True)
    ap.add_argument('--out', default='endroll.mp4')
    ap.add_argument('--credits', default=str(HERE / 'credits.txt'))
    ap.add_argument('--width', type=int, default=1920)
    ap.add_argument('--height', type=int, default=1080)
    ap.add_argument('--fps', default='30000/1001')
    ap.add_argument('--font-size', type=int, default=39)
    ap.add_argument('--line-height', type=int, default=62)
    ap.add_argument('--lead', type=float, default=0.5, help='最初の行が出始めるまでの秒数')
    ap.add_argument('--stop-at', type=float, default=139.4,
                    help='スクロールが止まる秒数（音源 2:19.4 のインパクト）')
    ap.add_argument('--fade-start', type=float, default=146.0, help='文字と音のフェードアウト開始秒')
    ap.add_argument('--fade', type=float, default=2.0, help='フェードアウトの長さ（秒）')
    ap.add_argument('--end', type=float, default=149.0, help='動画の終わり（秒）。フェード後は黒・無音')
    args = ap.parse_args()

    lines = Path(args.credits).read_text(encoding='utf-8').splitlines()
    font = ImageFont.truetype(args.font, args.font_size)
    widest = max(font.getlength(line) for line in lines)
    if widest > args.width * 0.92:
        raise SystemExit(f'一番長い行が画面幅に収まりません（{widest:.0f}px）。--font-size を下げてください')

    W, H, LH = args.width, args.height, args.line_height
    # 最後のブロック = 最後の【見出し】から末尾まで
    block_start = max(i for i, line in enumerate(lines) if line.startswith('【'))
    block_lines = len(lines) - block_start
    block_top_on_screen = (H - block_lines * LH) // 2  # 整数にして、止まった文字をにじませない
    gap = 0
    while lines[block_start - 1 - gap] == '':
        gap += 1
    need = -(-int(block_top_on_screen) // LH)  # 前の行が画面外に出る空行数
    if gap < need:
        lines[block_start:block_start] = [''] * (need - gap)
        print(f'最後のブロックの前の空行を {gap} → {need} 行に広げました（止まった画面に前の行を残さないため）')
        block_start += need - gap

    sheet = render_sheet(lines, font, W, LH)
    pad = np.zeros((H + 2, W), dtype=np.float32)
    canvas = np.vstack([pad, sheet, pad])  # 上下に画面1枚分以上の黒

    num, den = (int(x) for x in args.fps.split('/')) if '/' in args.fps else (int(args.fps), 1)
    fps = num / den
    frames = int(round(args.end * fps))
    # canvas 上の位置: pad(H+2) の後に sheet。最後のブロックの上端を画面の block_top_on_screen に置く
    stop_top = H + 2 + block_start * LH - block_top_on_screen
    start_top = 1.0  # 画面全体が上の黒余白
    speed = (stop_top - start_top) / (args.stop_at - args.lead)  # px/秒
    print(f'{len(lines)}行  シート高さ {sheet.shape[0]}px  {speed:.1f}px/秒  '
          f'{args.stop_at:.2f}秒で停止  {args.fade_start:.2f}〜{args.fade_start + args.fade:.2f}秒でフェード')

    ff = subprocess.Popen([
        'ffmpeg', '-y', '-loglevel', 'error',
        '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', f'{W}x{H}', '-r', args.fps, '-i', '-',
        '-i', args.audio,
        '-map', '0:v', '-map', '1:a',
        '-af', f'afade=t=out:st={args.fade_start}:d={args.fade},apad', '-t', f'{args.end}',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
        '-tune', 'animation', '-movflags', '+faststart',
        '-c:a', 'aac', '-b:a', '320k', args.out,
    ], stdin=subprocess.PIPE)

    for f in range(frames):
        t = f / fps
        top = min(start_top + max(t - args.lead, 0.0) * speed, stop_top)
        i = int(top)
        frac = top - i
        view = canvas[i:i + H] * (1 - frac) + canvas[i + 1:i + 1 + H] * frac
        view *= min(max((args.fade_start + args.fade - t) / args.fade, 0.0), 1.0)
        ff.stdin.write(np.clip(view + 0.5, 0, 255).astype(np.uint8).tobytes())
    ff.stdin.close()
    if ff.wait() != 0:
        raise SystemExit('ffmpeg が失敗しました')
    print(f'書き出し完了: {args.out}')


if __name__ == '__main__':
    main()
