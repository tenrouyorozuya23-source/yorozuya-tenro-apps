"""credits.txt と音源から、黒地に白文字が下から上へ流れるエンドロール動画を作る。

- 1行 = 1行、空行 = 1行分の余白。すべて中央揃え・明朝体（太字）。
- 音源の長さに合わせ、最初の行が画面下から現れ、最後の行が画面上に消えた所で終わる。
- 1/2ピクセル未満の位置も補間するので、スクロールがガタつかない。

使い方:
  python3 make_endroll.py --audio 音源.wav --font NotoSerifJP-Bold.ttf --out endroll.mp4
"""
import argparse
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent


def audio_duration(path):
    out = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
        check=True, capture_output=True, text=True).stdout
    return float(out)


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
    ap.add_argument('--font-size', type=int, default=40)
    ap.add_argument('--line-height', type=int, default=62)
    ap.add_argument('--lead', type=float, default=0.5, help='最初の行が出始めるまでの秒数')
    ap.add_argument('--tail', type=float, default=0.5, help='最後の行が消えてから終わるまでの秒数')
    args = ap.parse_args()

    lines = Path(args.credits).read_text(encoding='utf-8').splitlines()
    font = ImageFont.truetype(args.font, args.font_size)
    widest = max(font.getlength(line) for line in lines)
    if widest > args.width * 0.92:
        raise SystemExit(f'一番長い行が画面幅に収まりません（{widest:.0f}px）。--font-size を下げてください')

    W, H = args.width, args.height
    sheet = render_sheet(lines, font, W, args.line_height)
    pad = np.zeros((H + 2, W), dtype=np.float32)
    canvas = np.vstack([pad, sheet, pad])  # 上下に画面1枚分以上の黒

    duration = audio_duration(args.audio)
    num, den = (int(x) for x in args.fps.split('/')) if '/' in args.fps else (int(args.fps), 1)
    fps = num / den
    frames = int(round(duration * fps))
    travel = sheet.shape[0] + H + 1      # 画面下端から上端の外まで
    scroll_time = duration - args.lead - args.tail
    speed = travel / scroll_time         # px/秒
    print(f'{len(lines)}行  シート高さ {sheet.shape[0]}px  {duration:.2f}秒  {speed:.1f}px/秒')

    ff = subprocess.Popen([
        'ffmpeg', '-y', '-loglevel', 'error',
        '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', f'{W}x{H}', '-r', args.fps, '-i', '-',
        '-i', args.audio,
        '-map', '0:v', '-map', '1:a',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
        '-tune', 'animation', '-movflags', '+faststart',
        '-c:a', 'aac', '-b:a', '320k', '-shortest', args.out,
    ], stdin=subprocess.PIPE)

    for f in range(frames):
        t = f / fps
        # top = canvas 上で画面上端に来る行（float）。0 のとき画面は上の黒余白だけ
        progress = min(max(t - args.lead, 0.0), scroll_time) * speed
        top = progress + 1  # +1: pad の先頭1行は補間用
        i = int(top)
        frac = top - i
        view = canvas[i:i + H] * (1 - frac) + canvas[i + 1:i + 1 + H] * frac
        ff.stdin.write(np.clip(view + 0.5, 0, 255).astype(np.uint8).tobytes())
    ff.stdin.close()
    if ff.wait() != 0:
        raise SystemExit('ffmpeg が失敗しました')
    print(f'書き出し完了: {args.out}')


if __name__ == '__main__':
    main()
