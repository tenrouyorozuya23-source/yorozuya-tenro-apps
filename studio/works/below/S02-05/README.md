# S02-05 情報解禁カウントダウン LP（架空の演劇ユニット・朔夜舎）— 合格未満（5.33）

- 等級: 合格未満
  - 1回目の審査は 4.50。facts.json にない「三年ぶり」を書いていて、critical になった。
  - 2回目は新しい審査員が 5.33 をつけ、数値ゲートは合格した。ただし、あらすじの「三時間」「二人」も facts にない数字で、critical が残った。
- 本体: `studio/projects/S02-05-countdown-lp/site/index.html`（1ページ）
- 公開: https://raw.githack.com/tenrouyorozuya23-source/yorozuya-tenro-apps/studio-autopilot/studio/projects/S02-05-countdown-lp/site/index.html
- 見せ場:
  - 公開日から解禁日までの経過に合わせて、緞帳が上がる（0〜85%）。
  - 解禁の瞬間は、暗転 → 緞帳が上がる → 明転、の順に進み、作品名が現れる。
  - デモボタンを押すと、緞帳が3秒で上がってから解禁の4秒前に進む。
  - 時刻は +09:00 で固定しているので、どのタイムゾーンでも正しく数える。
- 次に直すなら:
  - あらすじを含め、本文の数字はすべて facts.json に入れる。
  - 解禁前に上げる上限を60%にし、解禁で40%上がるのが見えるようにする。暗転では緞帳ごと落とす。
  - 6em の dl を上書きする media query の順番、reduced-motion、フォーカスの白枠、グレインの粗さを直す。
