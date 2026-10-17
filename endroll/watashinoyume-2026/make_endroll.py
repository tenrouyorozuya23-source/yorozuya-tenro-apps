"""テキスト（credits_*.txt）と音源から、黒地に白文字が下から上へ流れるエンドロール動画を作る。

- 1行 = 1行、空行 = 余白（--blank-height px）。すべて中央揃え・太字。
- 最初の行が --lead 秒（BGM の「テー」）で画面下から見え始め、
  最後の見出し（【事務局】）から末尾までのブロックが --stop-at 秒（BGM 最後の「デン！」）で
  画面中央に来てピタッと止まるよう、一定速度でスクロールする。
- 止まった画面に前の行が残らないよう、必要なら最後のブロックの前の余白を広げる。
- --fade-start から --fade 秒かけて文字と音を同時に指数フェードアウトし（はじめ速く、最後はゆっくり消える）、
  そのあと --thanks の一文を フェードイン → キープ → フェードアウト で出し、黒画面のまま終わる。
- 1ピクセル未満の位置も補間するので、スクロールがガタつかない。

使い方:
  python3 make_endroll.py --credits credits_matinee.txt --audio 音源.wav --font BIZUDPGothic-Bold.ttf --out endroll.mp4
"""
import argparse
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def line_tops(lines, line_height, blank_height):
    """各行の上端の y と、全体の高さ。文字のある行は line_height、空行は blank_height。"""
    tops, y = [], 0
    for line in lines:
        tops.append(y)
        y += line_height if line else blank_height
    return tops, y


def render_sheet(lines, font, width, line_height, blank_height):
    """全行を縦長の1枚に描く。"""
    tops, total = line_tops(lines, line_height, blank_height)
    sheet = Image.new('L', (width, total), 0)
    draw = ImageDraw.Draw(sheet)
    for y, line in zip(tops, lines):
        if line:
            # anchor='mm' で行の中心に揃える（中央揃え）
            draw.text((width / 2, y + line_height / 2), line, font=font, fill=255, anchor='mm')
    return np.asarray(sheet, dtype=np.float32), tops


def render_card(text, font, width, height):
    """画面中央に1行だけ置いた1枚。"""
    card = Image.new('L', (width, height), 0)
    ImageDraw.Draw(card).text((width / 2, height / 2), text, font=font, fill=255, anchor='mm')
    return np.asarray(card, dtype=np.float32)


def exp_fade(x, k):
    """x: 0→1 の進み具合。指数で 1→0 に落ちる（終点でちょうど 0）。"""
    x = np.clip(x, 0.0, 1.0)
    return (np.exp(-k * x) - np.exp(-k)) / (1 - np.exp(-k))


def write_faded_audio(src, dst, start, length, k, fade_in):
    """音源の頭に fade_in 秒のフェードイン、最後に指数フェードアウトをかけ、フェード後は無音にした WAV を書く。"""
    with wave.open(src) as w:
        params = w.getparams()
        assert params.sampwidth == 2, '16bit PCM のみ対応'
        pcm = np.frombuffer(w.readframes(params.nframes), np.int16).reshape(-1, params.nchannels)
    t = np.arange(len(pcm)) / params.framerate
    gain = exp_fade((t - start) / length, k)
    if fade_in > 0:
        gain = gain * np.clip(t / fade_in, 0.0, 1.0)
    gain = gain[:, None]
    out = np.round(pcm * gain).astype(np.int16)
    with wave.open(dst, 'wb') as w:
        w.setparams(params)
        w.writeframes(out.tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--audio', required=True)
    ap.add_argument('--font', required=True)
    ap.add_argument('--out', default='endroll.mp4')
    ap.add_argument('--credits', required=True, help='credits_matinee.txt / credits_soiree.txt')
    ap.add_argument('--width', type=int, default=1920)
    ap.add_argument('--height', type=int, default=1080)
    ap.add_argument('--fps', default='30000/1001')
    ap.add_argument('--font-size', type=int, default=34)
    ap.add_argument('--line-height', type=int, default=48, help='文字のある行の高さ（px）')
    ap.add_argument('--blank-height', type=int, default=32, help='空行（余白）1行分の高さ（px）')
    ap.add_argument('--lead', type=float, default=2.80,
                    help='最初の行が画面下から見え始める秒数（マチネ音源 0:02.80 の「テー」）')
    ap.add_argument('--fade-in', type=float, default=0.0, help='始まりのフェードイン（秒）。文字と音の両方')
    ap.add_argument('--stop-at', type=float, default=140.32,
                    help='スクロールが止まる秒数（マチネ音源 2:20.32。最後の「デー・デー・デー・デン！」4打目。'
                         '2:23 の大きな音は拍手）')
    ap.add_argument('--fade-start', type=float, default=146.0, help='文字と音のフェードアウト開始秒')
    ap.add_argument('--fade', type=float, default=2.0, help='フェードアウトの長さ（秒）')
    ap.add_argument('--fade-curve', type=float, default=4.0,
                    help='指数フェードのカーブの強さ（大きいほど最初に速く落ち、最後が長く残る）')
    ap.add_argument('--thanks', default='ありがとう！松永　春さん', help='ロールのあとに出す一文（空なら出さない）')
    ap.add_argument('--thanks-size', type=int, default=56)
    ap.add_argument('--thanks-gap', type=float, default=0.5, help='ロールが消えてから一文が出始めるまで（秒）')
    ap.add_argument('--thanks-in', type=float, default=0.5, help='一文のフェードイン（秒）')
    ap.add_argument('--thanks-hold', type=float, default=5.0, help='一文のキープ（秒）')
    ap.add_argument('--thanks-out', type=float, default=1.0, help='一文のフェードアウト（秒）')
    ap.add_argument('--tail', type=float, default=1.0, help='最後の黒画面（秒）')
    args = ap.parse_args()

    lines = Path(args.credits).read_text(encoding='utf-8').splitlines()
    font = ImageFont.truetype(args.font, args.font_size)
    widest = max(font.getlength(line) for line in lines)
    if widest > args.width * 0.92:
        raise SystemExit(f'一番長い行が画面幅に収まりません（{widest:.0f}px）。--font-size を下げてください')

    W, H, LH, BH = args.width, args.height, args.line_height, args.blank_height
    # 最後のブロック = 最後の【見出し】から末尾まで
    block_start = max(i for i, line in enumerate(lines) if line.startswith('【'))
    block_h = sum(LH if line else BH for line in lines[block_start:])
    block_top_on_screen = (H - block_h) // 2  # 整数にして、止まった文字をにじませない
    gap = 0
    while lines[block_start - 1 - gap] == '':
        gap += 1
    need = -(-block_top_on_screen // BH)  # 前の行が画面外に出る空行数
    if gap < need:
        lines[block_start:block_start] = [''] * (need - gap)
        print(f'最後のブロックの前の空行を {gap} → {need} 行に広げました（止まった画面に前の行を残さないため）')
        block_start += need - gap

    sheet, tops = render_sheet(lines, font, W, LH, BH)
    pad = np.zeros((H + 2, W), dtype=np.float32)
    canvas = np.vstack([pad, sheet, pad])  # 上下に画面1枚分以上の黒

    num, den = (int(x) for x in args.fps.split('/')) if '/' in args.fps else (int(args.fps), 1)
    fps = num / den
    thanks_start = args.fade_start + args.fade + args.thanks_gap
    thanks_end = thanks_start + args.thanks_in + args.thanks_hold + args.thanks_out
    end = (thanks_end if args.thanks else args.fade_start + args.fade) + args.tail
    frames = int(round(end * fps))
    card = render_card(args.thanks, ImageFont.truetype(args.font, args.thanks_size), W, H) if args.thanks else None

    # canvas 上の位置: pad(H+2) の後に sheet。
    # 始まり: 最初の行の文字の上端が、ちょうど画面の下端に来る位置
    first = next(i for i, line in enumerate(lines) if line)
    ink_top = tops[first] + LH / 2 + font.getbbox(lines[first], anchor='mm')[1]
    start_top = 2 + ink_top
    # 止まる位置: 最後のブロックの上端を画面の block_top_on_screen に置く
    stop_top = H + 2 + tops[block_start] - block_top_on_screen
    speed = (stop_top - start_top) / (args.stop_at - args.lead)  # px/秒
    print(f'{len(lines)}行  シート高さ {sheet.shape[0]}px  {speed:.1f}px/秒  '
          f'{args.lead:.2f}秒で見え始め  {args.stop_at:.2f}秒で停止  '
          f'{args.fade_start:.2f}〜{args.fade_start + args.fade:.2f}秒でフェード  '
          f'一文 {thanks_start:.2f}〜{thanks_end:.2f}秒  終わり {end:.2f}秒')

    def card_gain(t):
        x = t - thanks_start
        if x <= 0 or x >= args.thanks_in + args.thanks_hold + args.thanks_out:
            return 0.0
        if x < args.thanks_in:
            return x / args.thanks_in
        x -= args.thanks_in + args.thanks_hold
        return 1.0 if x < 0 else 1.0 - x / args.thanks_out

    def fade_gain(t):
        gain = float(exp_fade((t - args.fade_start) / args.fade, args.fade_curve))
        if args.fade_in > 0:
            gain *= min(t / args.fade_in, 1.0)
        return gain

    faded_audio = tempfile.NamedTemporaryFile(suffix='.wav', delete=False).name
    write_faded_audio(args.audio, faded_audio, args.fade_start, args.fade, args.fade_curve, args.fade_in)

    ff = subprocess.Popen([
        'ffmpeg', '-y', '-loglevel', 'error',
        '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', f'{W}x{H}', '-r', args.fps, '-i', '-',
        '-i', faded_audio,
        '-map', '0:v', '-map', '1:a',
        '-af', 'apad', '-t', f'{end}',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
        '-tune', 'animation', '-movflags', '+faststart',
        '-c:a', 'aac', '-b:a', '320k', args.out,
    ], stdin=subprocess.PIPE)

    for f in range(frames):
        t = f / fps
        top = min(start_top + max(t - args.lead, 0.0) * speed, stop_top)  # lead までは真っ黒のまま
        i = int(top)
        frac = top - i
        view = canvas[i:i + H] * (1 - frac) + canvas[i + 1:i + 1 + H] * frac
        view *= fade_gain(t)
        if card is not None and (g := card_gain(t)) > 0:
            view = view + card * g
        ff.stdin.write(np.clip(view + 0.5, 0, 255).astype(np.uint8).tobytes())
    ff.stdin.close()
    code = ff.wait()
    Path(faded_audio).unlink()
    if code != 0:
        raise SystemExit('ffmpeg が失敗しました')
    print(f'書き出し完了: {args.out}')


if __name__ == '__main__':
    main()
