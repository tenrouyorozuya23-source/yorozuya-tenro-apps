# Web 作品の公開先（Artifact）

raw.githack はブラウザで開くと広告付きの「External Content Notice」の中間ページになり、作品が表示されない（2026-11-07 判明）。そのため、Web 作品はすべて Artifact で公開する。Artifact は非公開なので、他の人に見せるときはページの共有メニューから共有する。

公開の手順:

1. 公開用のコピーを作る: `python3 studio/tools/to_artifact.py <site> --out <スクラッチ>/<ID>`
2. `Artifact` の publish に次を渡す。同じ file_path で出し直すと URL は変わらない
   - file_path: `<build>/artifact.html`
   - root: `<build>`
   - files: files.json の中身

| 作品 | Artifact |
|---|---|
| P002 夜光 Acoustic Night | https://claude.ai/artifact/FUxAmoEp6wXq35J52SYAob |
| S02-01 硝子の庭 チケット LP | https://claude.ai/artifact/VTB5YKN86DQboPnpoUZC1Y |
| S02-05 朔夜舎 解禁カウントダウン | https://claude.ai/artifact/TffvTczBPV55jyv6EBchyV |
| S02-06 冬の灯 公演パンフレット | https://claude.ai/artifact/1pAtGFPvtya2jFepRxf6qy |
| S02-07 冬の灯 アーカイブ配信 | https://claude.ai/artifact/QX3FFP6e5ERVsVxyjRcJED |
| S02-09 月の舞 日英 LP | https://claude.ai/artifact/9eRky8jFossD3jyqfwcgqB |
| S10-03 宵待ルカ 配信オーバーレイ | https://claude.ai/artifact/VXE3GPj296phB6AgKYpLcb |
| S05-01 柊木 透 ポートフォリオ | https://claude.ai/artifact/1QuxgXXxk34DzvSD4N1zuk |
| S05-04 灯野 慧 照明デザイン | https://claude.ai/artifact/AjJaprY4UbWXitWzpNJUsm |
| S05-06 音無 響 作曲・劇伴 | https://claude.ai/artifact/EKs2mU9cXM6MuyEai1jyLi |
| S08-07 天狼 BGM ライブラリ | https://claude.ai/artifact/Steg1z3rqUjzaUUNtbc8WL |

Artifact の制約（変換の道具で吸収している）:

- `index.html` は公開ページ自身を指す予約名で、files には入れられない。サブページから index.html へのリンクは、そのまま公開ページに届く
- `.m4a` は配信されない（contentType を付けても不可）。中身は同じまま `.mp4` に名前を変え、参照も書き換える
- 外部の読み込みは cdn.jsdelivr.net/npm・cdnjs・unpkg のスクリプトと Google Fonts だけ
- S05-10 作品集（ショーケース）: https://claude.ai/artifact/9h7ASYzCEmKLFq2jmsGzh7
- S05-05 劇作家サイト: https://claude.ai/artifact/T1WT7AD3sdoZ9imKS6FrKV
- S05-09 室内楽団サイト: https://claude.ai/artifact/BP5Moxpu9eQtQFc2tJGL1W
- S05-07 ライバー公式サイト: https://claude.ai/artifact/VmfnpdDwdrh5nmq8msktwN
