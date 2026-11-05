# 研究メモ: Apple 型の製品ページと製品映像の作り方（天狼スタジオ向け）

作成 2026-11-05。`../direction.md`（洗練・簡潔・三次元的・イラストにしない）を、手で書く HTML/CSS/JS と three.js、Blender（bpy）で再現するための技法と数値をまとめた。
- **Apple の素材（画像・映像・文章・ロゴ・書体ファイル）は一切使わない。** ここにあるのは技法の説明と、公開 CSS から読み取った数値（事実）だけ。言葉は当社の言葉で書いている。
- 印の意味: **［実測］** = 2026-11-05 に apple.com の公開 CSS/JS/HTML を読んで得た値。**［出典］** = 下のURLの記事に書かれていること。**［当社既定］** = 出典をもとに当社が決めた初期値（検証済みではない。制作で更新する）。
- 使い方: LP は §1 と §4.3、映像は §2 と §4.1〜4.2、3D の質感は §3。審査（rubric.md）の style_fidelity では §4.4 のチェックリストを使う。

---

## 1. Apple の製品ページのデザイン言語

### 1.1 文字の大きさ・行間・字間［実測: airpods-pro / macbook-pro の overview CSS］
見出しは SF Pro Display の 600、本文は SF Pro Text の 400。**大きい文字ほど字間を詰め、20〜32px の中見出しはわずかに開く**（光学サイズの考え方）。

| 役割（当社の呼び名） | サイズ | 行間 | 字間 | 太さ |
|---|---|---|---|---|
| 特大ヒーロー | 96px | 1.042 | -0.015em | 600 |
| ヒーロー見出し | 80px | 1.05 | -0.015em | 600 |
| 大見出し | 64px | 1.0625 | -0.009em | 600 |
| 章見出し | 56px | 1.071 | -0.005em | 600 |
| 見出し | 48px | 1.083 | -0.003em | 600 |
| 小見出し（タイル見出し） | 40px | 1.1 | 0 | 600 |
| アイブロウ（見出しの上の一言） | 32 / 28 / 24px | 1.125 / 1.143 / 1.167 | +0.004 / +0.007 / +0.009em | 600 |
| リード文・スクロール本文 | 21px | 1.381（短文は 1.19） | +0.011em | 400 / 600 |
| 補足文 | 19px | 1.21 | +0.012em | 400 / 600 |
| 本文 | 17px | 1.47 | -0.022em | 400 |
| 小さい本文 | 14px | 1.43 | -0.016em | 400 |
| 注記 | 12px | 1.33 | -0.01em | 400 |

- 画面幅で段を落とす: ヒーロー 80px → 1068px 以下で 64px → 734px 以下で 48px（1段ずつ下の役割の値を使う）。
- **日本語（:lang(ja)）は別の値**: 字間はすべて 0、行間を上げる（80px で 1.0875、64px で 1.109、48px で 1.146〜1.22）。96px の特大は和文だと 89px に下げる。和文は欧文より字面が大きく詰まって見えるので、詰めずに行間を足している。
- **当社への翻訳［当社既定］**: Noto Sans JP（見出し 500〜600、本文 300〜400）で、`font-feature-settings:"palt"` を入れて字間 0。64px 以上の見出しだけ -0.01em まで詰める（direction.md の「やや詰める」）。行間は和文見出し 1.1〜1.2、和文本文 1.7〜1.8（欧文の 1.47 より広げる）。欧文は Inter や同等の細身サンセリフに上表の字間をそのまま使う。

### 1.2 レイアウト・余白・色［実測］
- 区切り幅（ブレークポイント）: **1441 / 1069 / 735 / 480px**。画像も small・medium・large の3サイズ×1倍・2倍を用意し、幅で出し分ける（srcset が1ページ 355 個）。
- 本文の箱: 幅 87.5%、最大 1260px で中央寄せ。12 カラム（1カラム 8.333%）。
- **セクションの上下の余白: 160px（大画面）/ 128px / 96px（スマホ）**。文字の段の上下 56 / 48px。見出し→本文→ボタンの間は小さく、セクション間は大きく。「近いものは近く、違う話は遠く」の差がはっきりしている。
- 色（ほぼ無彩色）: 黒 #000、文字の黒 #1d1d1f、明るい地 #f5f5f7、白、灰 #6e6e73 / #86868b、境界線 #d2d2d7。アクセントはリンクの青だけ（明るい地 #0066cc、暗い地 #2997ff、ボタン #0071e3）。**製品の色以外に色を持ち込まない。**
- 角丸: タイル 18px、大きいカード 28px、ボタンは丸端（999px）。影はほぼ使わず、地色の差（#000 と #1d1d1f、#fff と #f5f5f7）で面を分ける。
- 暗い地と明るい地のセクションを交互にして呼吸を作る（セクション名に `background-alt` が多数）。

### 1.3 動き［実測: CSS の transition と main.js の tween］
- UI の反応（ホバー・色）: 100ms linear。出現・切り替え: 200〜400ms の opacity（ease-out か ease-in-out）。移動: 300ms `cubic-bezier(0,0,0.5,1)`。
- JS の演出 tween は 0.5s・0.63s・1s が多い。スクロール連動の tween は easeInOutQuad。回転には長い減速 `cubic-bezier(0.25,0.1,0,1)`（終わりがとても長く伸びる）。
- 時間差（スタッガー）は 50ms と 200ms の2段、内容の遅れは 100〜150ms。自動送りのギャラリーは1枚 6.25 秒。
- **弾む動きは小物の UI（ボタンが出る）にだけ**ばねを使っていて、見出し・製品は弾ませない。direction.md の「バウンス禁止」と一致する。
- スクロール範囲の書き方: 「要素の上端が画面の下端に来た所（t - 100vh）」から「要素の下端（b）」まで、などで開始・終了を指定。一度だけの出現は「上端が画面の下 70% に来たらクラスを付ける」（t - 70vh）。
- `prefers-reduced-motion` で装飾アニメを止める。

### 1.4 画像と映像の扱い［実測＋出典］
- 製品は**黒か白の地に、余白を広く取って1つだけ**。切り抜きの透過映像（アルファ付き動画）を地に直接置き、枠を見せない。
- 自動再生の映像は「画面に入ったら再生（AnimPlay）」「画面幅に合った素材を1回だけ選ぶ（ViewportSourceOnce）」「読み込みが遅ければ静止画に切り替え（LoadTimeout）」の3点セット。**自動再生には必ず一時停止ボタン**を付ける（アクセシビリティ）。長尺は HLS 配信。
- 遅延読み込み（data-lazy）で、画面に近づいてから重い画像を読む。
- スクロールで動かす連番は `<canvas>` に描く（下の §1.5）。回線が遅い端末では連番をやめて1枚の静止画にする［出典: CSS-Tricks］。

### 1.5 スクロール演出の型と実装［出典＋当社既定］
| 型 | 仕組み | 注意 |
|---|---|---|
| **固定して進める（スティッキー）** | 高さ 300〜500vh の外箱の中に `position:sticky; top:0; height:100vh` の舞台を置き、外箱の通過率 p（0→1）で中身を動かす | 外箱の長さ＝演出の尺。1画面ぶん（100vh）≒ 1 秒の感覚で設計［当社既定］ |
| **連番スクラブ** | p → `floor(p*N)` 番目の画像を canvas に drawImage。N=90〜150 枚［出典: 148 枚の例］ | 画像は配列に保持して再利用（src を毎回差し替えるとキャッシュを外れて再取得される）。先に 8 枚おきに読み、間を埋める［当社既定］ |
| **動画スクラブ** | `video.currentTime = p * duration`。再生はしない | **全フレームをキーフレームにして書き出す**（`-g 1`）。そうしないとシークが飛ぶ［出典: hontran.dev］ |
| **CSS だけのスクロール連動** | `animation-timeline: view()` と `animation-range`（例 `contain 0% contain 50%`） | Chrome/Edge 115+、Safari 26+。Firefox は遅れているので `@supports` で囲み、効かなくても正しく見える作りに［出典: ics.media］ |
| **3D の開示** | three.js で p → カメラ角度・ライト強度。描くのは p が変わった時だけ | DPR は最大 2、画面外では止める |
| **文字の段階開示** | 1行ずつ opacity 0.25→1（読んでいる行だけ明るい） | 行ごとに range をずらす。色を変えるのでなく明るさだけ |

動画スクラブの書き出し例（出典の値。幅は表示の最大幅に合わせる）:
```bash
ffmpeg -i in.mov -vf scale=1920:-2 -r 30 -c:v libx264 -crf 23 -g 1 -pix_fmt yuv420p -movflags faststart -an scrub.mp4
ffmpeg -i in.mov -vf scale=1920:-2 -r 30 -c:v libvpx-vp9 -crf 32 -b:v 0 -g 1 -row-mt 1 -an scrub.webm
```
- 全キーフレームは容量が大きい（1280px・30fps で約 8MB の例）。尺は 3〜5 秒に収め、`preload="auto"`、`muted playsinline`［出典］。
- 連番と動画の選び方［当社既定］: 透過が要る・逆再生が多い・フレーム単位で正確に止めたい → 連番（WebP 品質 75〜80、表示幅まで）。長い・容量を抑えたい → 動画スクラブ。どちらも p をそのまま使わず `p_s += (p - p_s) * 0.15` で毎フレーム追いかけて滑らかにする（スクロールの段差を消す）。

出典: [CSS-Tricks（AirPods 型の連番）](https://css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages/)、[hontran.dev（動画スクラブの -g 1）](https://www.hontran.dev/blog/scroll-scrubbed-video-stutters-fix)、[muffinman.io](https://muffinman.io/blog/scrubbing-videos-using-javascript/)、[ics.media（CSS スクロール駆動）](https://ics.media/en/entry/230718/)、[GSAP imageSequence helper](https://gsap.com/docs/v3/HelperFunctions/helpers/imageSequenceScrub)、[WWDC20 The details of UI typography（光学サイズと字間）](https://wwdcnotes.com/notes/wwdc20/10175)、実測元: apple.com/airpods-pro/ と /macbook-pro/ の overview.built.css・main.built.js（2026-11-05 取得。数値のみ参照）。

---

## 2. Apple 型・高級製品映像の言語

### 2.1 構成［出典］
- **3部構成: ①ヒーローの開示（ゆっくり光が入る）→ ②細部（機能を寄りで見せる）→ ③使われる場面（広い画、人の営み）**。ほぼすべての作品に「寄りのヒーローショット」がある［Manfrotto / Syrp］。
- **1ショット1アイデア**。画面は製品1つに絞り、余計な光・背景・効果を足さない。地は黒か白、色は製品（か画面の UI）だけが持つ。明るい色の上に明るい色を重ねない［youmind の分析］。
- 場面ショットは暖かい光・緑や橙を許し、次の製品ショットで黒/白の地に戻る（色の呼吸）［同上］。
- 最近の発表映像は、有名な映画の構図・カメラワークを下敷きにしている（ボンド映画のガンバレル型の開示など）［iThinkDifferent］。→ 当社なら**舞台の文法（緞帳・板付き・明転・ピンスポット）を下敷きにする**のが差別化になる。
- 実写へのこだわり: Apple TV のロゴ映像は CG でなく本物のガラス板と精密な照明で撮影。MacBook の発表映像も手作りの模型・本物の素材・正確なカメラワークに CG を混ぜている［iPhone in Canada / Famous Campaigns］。→ CG でも「本物の素材を照明で撮った」ように見せるのが目標。

### 2.2 カメラ［出典＋当社既定］
- **オービット（回り込み）**: カメラが横に移動しながら被写体へ向き続ける。角や面に光が流れて立体が出る。パンの速さを移動の速さと一致させる［PremiumBeat］。
- 寄り（マクロ）は被写界深度を深めにして製品をシャープに保つ（静止画はフォーカス合成で全面にピントを合わせている。iPod の例で 54 コマ合成）［Manfrotto / iMore］。→ CG では「浅いボケは背景と手前の床だけ、製品の面はほぼ全部ピント内」が基本。
- 動く台は速いほど揺れが見える。CG でも手ぶれは入れず、**完全に滑らかなゆっくりした動き**［fstoppers のプローブレンズ記事］。
- ［当社既定］動きの量: 1 ショット 3〜6 秒で、プッシュイン 3〜7%（playbook §3.3 と同じ）、オービット 15〜35°、上下のクレーン 5〜10°。速度は「動いていると分かるが、目で追わなくてよい」程度。カメラの動きはショットの頭と尻で速度ゼロにしない（カットで動きをつなぐ）。止めるのはヒーローの最後の 1 回だけ。
- ［当社既定］レンズ: ヒーロー 85mm、細部 100mm マクロ相当、場面 35〜50mm。広角の歪みは製品に使わない（85〜135mm が歪みが少ない［CGAxis］）。

### 2.3 照明［出典］
- **逆光を製品の輪郭に沿わせ、縁を光らせる**（黒地で形を立たせる要）［Manfrotto］。硬めの逆光が出発点［PremiumBeat］。
- 細長い光源（ストリップ、チューブ）を製品の 45° 上・45° 前に置くと、形に沿った長いハイライトが出る。補助光は下前方 45°、または透明物は下から透かす［PremiumBeat］。
- 背景に小さな点光源を置くと、カメラが動くたびに反射が流れる（オービットと相性が良い）［PremiumBeat］。
- ソフトボックスに黒い板を入れて細い帯にし、帯の幅で反射のグラデーションを作る。格子（グリッド）は反射に映るので製品撮影では外す［PictureCorrect / dpreview］。
- **開示は「輪郭が先、全体は最後」**: 製品がゆっくり入り、光が変わり、最後に補助光をフェードインして全体を見せる［Manfrotto］。→ 舞台の「板付き→明転」と同じ発想。当社の強み。

### 2.4 編集のリズム［出典＋当社既定］
- 一般の TV 広告は 1 ショット平均約 1.4 秒（車 0.9 秒、医薬 3 秒。制作会社の推計）［Animatic Media］。1991 年時点で既に 2 秒未満［WARC］。
- 高級製品映像は「1 ショット 1 アイデア」で一般広告より長い。［当社既定］ヒーロー 4〜6 秒、細部 1.5〜3 秒（小節に合わせて 2 拍〜1 小節）、場面 2〜3 秒、ロゴ・締め 0.8〜1.2 秒＋余韻。15 秒なら 5〜7 カット、30 秒なら 9〜13 カット。
- 転換は気づかれないほど控えめ（動きでつなぐ・同じ形でつなぐ）。派手なトランジションは使わない［youmind］。暗転は「1拍の間」として使う（direction.md）。

### 2.5 文字［出典＋当社既定］
- 書体は1系統、白文字×黒地。字幕・UI・注記まで同じ規則で組む［youmind］。
- 最初に一言で主張し、残りの尺でそれを製品で証明する構成（iPhone Air の例の分析）［youmind］。
- ［当社既定］文字は製品と別のショット（黒地）か、製品の暗い余白に置く。和文 1 行 12 字以内、1 画面 2 行まで。出現は opacity 0→1 と 12〜16px の上昇を 0.6〜1.0 秒、`cubic-bezier(0.25,0.1,0,1)`。消えるのは 0.3〜0.4 秒で速く。1 文字ずつ跳ねる出し方はしない。

### 2.6 音［出典＋当社既定］
- 音楽は編集に合わせて切り、テンポを映像と一致させる。効果音は要所だけ、静かに［youmind］。
- 素材の手触りを伝える小さな音（フォーリー）が「本物らしさ」を作る。寄りの重要な音は作る/録る［Krotos / sfxengine］。
- 効果音は**カットの 2〜4 フレーム前から入れ、衝撃音は絵の 1〜3 フレーム後**。ウーシュは動きの頂点に合わせる。低音（サブ）は小音量で聴いて確認し、次の場面が変わるなら前で切る［sonilo / ocularsounds］。
- Apple TV の音のロゴは 1 秒・5 秒・12 秒の3つの長さで作られている［iPhone in Canada］。→ 当社のエンドの音も **1 秒（SNS）・5 秒（通常）・12 秒（映画的）**の3種を作り置く。
- ［当社既定］開示の直前に 0.5〜1 拍の無音（間）。明転と同時に残響の長い音（ピアノの単音・弦のハーモニクス）。ウーシュの多用は安っぽくなるので 1 本に 2 回まで。

出典: [Manfrotto（Apple 型の撮り方）](https://www.manfrotto.com/global-en/stories/how-to-shoot-cinematic-tech-videos-like-apple/)、[SLR Lounge（Syrp の解説: ヒーロー・細部・場面）](https://slrlounge.com/recreating-a-cinematic-tech-commercial-like-apple)、[PremiumBeat（逆光・オービット・ストリップ）](https://www.premiumbeat.com/blog/lighting-and-shooting-product-shots/)、[PictureCorrect（グラデーション反射）](https://picturecorrect.com/?p=43017)、[dpreview（ストリップの作り方）](https://www.dpreview.com/forums/thread/3573920)、[iMore（フォーカス合成）](https://www.imore.com/54-frames-photo-apple-produces-product-shots)、[fstoppers（プローブレンズ）](https://fstoppers.com/reviews/behind-scenes-new-laowa-15-35mm-periscope-probe-lens-900729)、[youmind（Apple 製品映像の分析）](https://youmind.com/landing/x-viral-articles/apple-product-video-design-secrets)、[iThinkDifferent（発表映像の引用構図）](https://www.ithinkdiff.com/apple-iphone-18-pro-event-film-james-bond-influence/)、[iPhone in Canada（Apple TV のガラスと音のロゴ）](https://www.iphoneincanada.ca/2025/11/06/how-apple-tvs-new-intro-video-was-made-will-surprise-you/)、[Famous Campaigns（MacBook 発表映像の手作り）](https://www.famouscampaigns.com/?p=45530)、[Animatic Media（ショット長）](https://www.animaticmedia.com/story-fitting-into-30-seconds)、[WARC（ショット長の推移）](https://www.warc.com/content/article/fast_editing_speed_and_commercial_performance/86058)、[sonilo（ブームの扱い）](https://sonilo.com/sound-effects/boom)、[ocularsounds（ウーシュ）](https://ocularsounds.com/blogs/sound-design-tips-tricks/whoosh-audio-effect-adding-motion-and-energy-to-your-edits)、[sfxengine（SE の置き方）](https://sfxengine.com/blog/video-editor-sound-effects)、[Krotos（音響設計の流れ）](https://krotos.studio/blog/what-is-sound-design-in-film)。

---

## 3. three.js / Blender で再現する

### 3.1 照明: HDRI か、面光源か、光の板か
| 方法 | 向き | 当社の使い方 |
|---|---|---|
| 屋外・部屋の HDRI | 現実の反射が一度に入る | **製品の黒地ショットには使わない**（関係ない景色が金属に映る）。場面ショットだけ |
| **自作のスタジオ環境（光の板）** | 黒い空間に白い長方形・帯・輪を浮かべ、それを環境マップにする | **主力**。three.js は板を並べたシーンを `PMREMGenerator.fromScene()` で環境マップ化（RoomEnvironment と同じ仕組み）。drei の Lightformer と同じ発想。板は影を落とさない（反射専用）ので、影は別に作る |
| 面光源（Area / RectAreaLight） | 直接光と柔らかい影 | Blender は Area Light（長方形 1:4〜1:8 のストリップ）が主力。three.js の RectAreaLight は影なしなので、影は焼き込みか蓄積影で |
- 金属は「映る物」がないと黒くなる。環境光（ambient）を足しても金属の反射は戻らない。**金属を光らせたいなら映る板を置く**［出典: drei Lightformer の解説］。
- 影: 単純な床には接地影（contact shadow）、質を上げるなら蓄積影（AccumulativeShadows＋位置を揺らした光）。蓄積が終われば描画コストはない［drei docs / three.js forum］。当社は `renderAt(t)` で 1 コマずつ撮るので、**毎フレーム蓄積しきってから撮る**のが一番きれい。
- Blender の黒地スタジオの始め方: ワールドを黒（強さ 0 か 0.02）、既定のライトを消し、キー（製品の約 2 倍の面光源）、補助（キーの約半分）、細い逆光（後ろ）を足す［BlenderNation / efbmedia 系の解説］。

### 3.2 素材（three.js MeshPhysicalMaterial ≒ Blender Principled BSDF）
プロパティの意味は three.js 公式ドキュメントのとおり。値は［当社既定］の初期値。
| 素材 | 設定の初期値 | 見せ方 |
|---|---|---|
| アルマイトのアルミ（機材の筐体） | metalness 1, roughness 0.28〜0.4, 色は少しだけ色味 | 長いストリップの反射を面に流す |
| ヘアライン（研磨の筋）金属 | 上＋anisotropy 0.4〜0.7（anisotropyRotation で筋の向き。接線が必要） | 光が筋と直角に伸びる。回すと光が走る |
| 鏡面ステンレス・クローム（マイク・金具） | metalness 1, roughness 0.04〜0.1 | 黒い板と白い板を交互に映して形を描く |
| 真鍮・金管楽器 | metalness 1, roughness 0.15〜0.3, 色 #c9a24a 付近, clearcoat 0.5〜1（ラッカー） | 暖色の逆光（ハロゲン 3200K 相当）が似合う |
| ガラス・アクリル | transmission 1, opacity 1, ior 1.5, thickness 0.5〜2, roughness 0〜0.05, attenuationColor を薄い緑/青、dispersion 0.1〜0.3（プリズムだけ） | 後ろに明るい帯を置かないと見えない。透かして縁を光らせる |
| ピアノブラック・艶塗装 | 色 #0a0a0a, roughness 0.35〜0.5, clearcoat 1, clearcoatRoughness 0.03〜0.08 | 黒地で、反射の帯だけで形が浮く |
| マットの樹脂・ゴム | roughness 0.6〜0.85, specularIntensity 0.3〜0.5 | 縁の柔らかいハイライトで素材差を出す |
| 布（衣装・緞帳・ベルベット） | sheen 1, sheenRoughness 0.3〜0.6, sheenColor は布より明るく | 逆光で縁が光る。緞帳は皺の法線マップ必須 |
| 木（楽器・舞台床） | 木目テクスチャ＋roughness 0.3〜0.5、塗装なら clearcoat 1 | 木目の大きさを実寸に（間違えると模型に見える） |
- MeshPhysicalMaterial は重い。使わない機能は 0 のまま。必ず環境マップを設定する［three.js docs］。
- **部品ごとに別の仕上げ**（ヘアラインの胴、マットの持ち手、艶の縁）を割り当てると本物に見える［blender-agentic の教材］。

### 3.3 色の管理（トーンマッピング）
- Blender 5.2 の表示変換: **AgX**（16.5 段のダイナミックレンジ。強い光の色を自然に脱色する。Filmic の後継）、**Khronos PBR Neutral**（材質の色を正確に出す。製品写真向け、ハイライトが小さい場面向け）、ACES 1.3 / 2.0、Filmic（非推奨）、False Color（露出確認）［Blender マニュアル］。
- three.js: `renderer.toneMapping = THREE.AgXToneMapping` または `THREE.NeutralToneMapping`、`renderer.outputColorSpace = THREE.SRGBColorSpace`。
- **当社の使い分け［当社既定］**:
  - 舞台照明の色（ホリゾントの青、ハロゲンの橙、スポット）を見せる → **AgX**（色光が飽和して変な色にならない）。
  - クライアントの製品色・ロゴ色・衣装の色を正確に → **Khronos PBR Neutral**（AgX は色相が数度ずれる報告あり［blenderartists］）。
  - 迷ったら False Color で露出を確認: 製品の主な面が灰〜黄緑（中間）、ハイライトだけ橙〜赤、背景は黒〜青。
- 書き出しは sRGB/BT.709（playbook §6）。Blender から ffmpeg へは 16bit PNG か EXR 連番で渡してから 709 タグ付きで圧縮。

### 3.4 被写界深度・モーションブラー
- Blender のシャッターは「フレーム単位の時間」。**0.5 = 180° シャッター**（映画の標準）。位置は Center on Frame［Blender マニュアル］。物理シミュはベイクしてから。
- 被写界深度: 実寸のモデル（mm 単位で正しく）＋35mm 判相当のセンサーで、ヒーロー f/2.8〜4、細部 f/4〜8［当社既定。CGAxis は f/1.4〜2.8 を推すが、製品の面までボケるので当社は絞る］。**ピントは製品の一番手前の稜線**に置く。
- three.js では BokehPass か pmndrs の DepthOfFieldEffect。ただし後処理の DoF は縁が汚れやすいので、［当社既定］1コマ撮りでは「カメラを絞りの円内で揺らして 16〜64 回描いて平均」（蓄積 DoF）を本番に使う。モーションブラーも同じ平均（playbook §4.4 のサブフレーム）と一緒にやる。
- AO は N8AO（法線パス不要、半解像度も可）。アンチエイリアスは SMAA を最後に（MSAA は 0 に）［pmndrs docs］。

### 3.5 CG が安っぽく見える原因と直し方［出典＋当社既定］
1. **角が鋭すぎる** → すべての角に 0.5〜2mm の面取り（2〜3 分割）。反射の細い線が角を描く［blender-agentic / packt］。
2. **粗さが一様** → roughness に 2〜5% のゆらぎ（ノイズ・指紋・ごく薄い傷）。「きれいすぎる」が最大の偽物感［proedu / ufo3d］。
3. **映る物がない** → 金属が黒い・のっぺり。光の板を置く（§3.1）。
4. **正面から全部照らす** → 形が消える。光は横・後ろから、正面は弱く。
5. **黒が浮く・つぶれる** → 背景は RGB 0〜3 の黒、製品の最暗部は 6〜12 を残す（細部が見える黒）［当社既定］。
6. **トーンマッピングなし（Standard）** → ハイライトが白く飛び、色が不自然。AgX か PBR Neutral に。
7. **ボケが強すぎる** → ミニチュア（模型）に見える。実寸と f 値を正しく。
8. **動きが等速・同時** → 機械的。長いイーズ、1 ショットに主な動きは 1 つ。
9. **モーションブラーなし** → 速い動きがパラパラ。180°。
10. **接地していない** → 浮いて見える。接地影か、床への映り込み（暗い床 roughness 0.15〜0.3）。
11. **ブルームを全体に** → 眠い画。光源とハイライト（線形で 1.0 超）だけ。
12. **細いハイライトのちらつき・暗部の縞（バンディング）** → サンプル増・ノイズ除去の時間方向の安定化、±1/255 のディザ（playbook §6）。
13. **テクスチャの実寸違い** → 木目・布目が大きすぎると模型に見える［ufo3d］。
14. **カメラ由来の要素がない** → 被写界深度・ブラー・わずかな周辺減光とレンズの収差（ごく弱く）［proedu］。

出典: [three.js MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html)、[three.js RoomEnvironment](https://threejs.org/docs/pages/RoomEnvironment.html)、[drei AccumulativeShadows](https://drei.docs.pmnd.rs/staging/accumulative-shadows)、[three.js forum（接地影と蓄積影）](https://discourse.threejs.org/t/three-js-scene-like-in-airbnb-ad/68281)、[three.js forum（Lightformer を素の three.js で）](https://discourse.threejs.org/t/r3f-lightformers-in-vanilla-three-js/48495)、[pmndrs N8AO](https://react-postprocessing.docs.pmnd.rs/effects/n8ao)、[Blender マニュアル Displays and Views](https://docs.blender.org/manual/en/latest/render/color_management/displays_views.html)、[Blender マニュアル Motion Blur](https://docs.blender.org/manual/en/latest/render/cycles/render_settings/motion_blur.html)、[BlenderNation（AgX の導入）](https://www.blendernation.com/2023/09/05/filmics-successor-new-agx-view-transform-in-blender-4-0/)、[blenderartists（AgX の色相ずれ）](https://blenderartists.org/t/agx-changes-hue/1527123)、[Blender devtalk（PBR Neutral）](https://devtalk.blender.org/t/adding-pbr-neutral-tone-mapper/33602/39)、[CGAxis（Blender の写実設定）](https://cgaxis.com/complete-blender-render-setup-guide-for-photorealistic-results-2026/)、[blender-agentic（面取りと部品ごとの素材）](https://blender-agentic.pages.dev/modules/product_materials_and_detail/)、[proedu](https://proedu.com/blogs/news/how-to-make-3d-renders-look-real)、[ufo3d](https://ufo3d.com/photorealistic-rendering/)、[BlenderNation（Apple 風の製品アニメ）](https://www.blendernation.com/2022/06/11/product-animation-tutorial-suitable-for-beginners/)、[efbmedia（スタジオ照明の基本）](https://efbmedia.vercel.app/blog/mastering-studio-lighting-blender-product-renders)。

---

## 4. プリセットとチェックリスト（実装用）

### 4.1 「製品の開示」ショット・プリセット［当社既定。§2.3 と舞台の明転を合成］
```yaml
reveal_shot:            # 尺 5.0 秒（4/4・BPM 96 なら 2 小節）
  background: "#000"    # ワールド強度 0、床は暗い艶（roughness 0.2、映り込みは距離で消す）
  camera: {lens_mm: 85, sensor_mm: 36, fstop: 4.0, focus: 製品の手前の稜線}
  move:  {push: 1.00→1.05, orbit_deg: -12→+12, crane_deg: 4→2, ease: "inOutSine（端の速度を残す）"}
  lights:                    # 「輪郭が先、全体は最後」
    - rim_L: {type: 帯 1:6, pos: 後ろ左 135°・上 20°, temp: 5600K, on: 0.0→1.2s}
    - rim_R: {type: 帯 1:6, pos: 後ろ右 135°・上 20°, on: 0.4→1.6s}   # 左右で 0.4 秒ずらす（同時に点けない）
    - key_sweep: {type: 帯 1:8, pos: 上前 45°, 製品の面を左→右へ流れる, 1.6→3.4s}
    - fill: {type: 大きい面 2×製品, pos: 前下 30°, 強さ キーの 0.3, fade_in: 3.0→4.5s}
    - accent: {任意: ハロゲン 3200K のピンスポット 1 灯 or ホリゾント色 1 色}
  tone: AgX（製品色が重要なら Khronos PBR Neutral）
  motion_blur: {shutter: 0.5}
  post: {bloom: 光源だけ, vignette: 弱, grain: "ffmpeg noise c0s=2"}
  sound: {0.0: 無音 or ルームトーン, 1.2: 低い持続音, 3.4: 単音＋長い残響, 5.0: 次のカットの 2〜4f 前から次の音}
  text: なし（文字は次の黒地ショットで）
```
派生プリセット［当社既定］:
- **細部（マクロ）**: 100mm、f/5.6、1.5〜3 秒、横スライド 2〜4% か ラックフォーカス 0.8 秒。光の帯を素材の上に1本だけ走らせる。
- **オービット**: 85mm、f/4、4〜6 秒で 25〜35°。背景に小さな点光源 3〜5 個を遠くに置き、反射が流れるのを見せる。
- **ガラス・透明物**: 背後に縦長の白い帯（画面外）＋黒の板で縁を描く。正面光はほぼ 0。
- **人（役者・演奏者）の開示**: 逆光（ハゼの中のバックライト）でシルエット→ 顔にキー（45°）を 1.5 秒でフェード→ 目に小さなキャッチライト。肌には PBR Neutral。
- **エンド**: 黒地、ロゴは光の帯が通った所だけ見える（playbook §6 の「光で開示」）、音のロゴは 1 / 5 / 12 秒版。

### 4.2 Blender（bpy）の初期設定［当社既定。名前はバージョンで変わるので実行時に enum を確認］
```python
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'GPU'          # Mac は Metal
sc.cycles.samples = 512; sc.cycles.use_denoising = True          # OpenImageDenoise
sc.view_settings.view_transform = 'AgX'   # 製品色重視なら 'Khronos PBR Neutral'
# look は bpy.types.ColorManagedViewSettings.bl_rna.properties['look'].enum_items から選ぶ
sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = 0.5
sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0
cam = sc.camera.data; cam.lens = 85; cam.dof.use_dof = True; cam.dof.aperture_fstop = 4.0
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_depth = '16'
```
- 下見は EEVEE か Cycles 64 サンプル・半解像度、本番だけ上げる（playbook の下書き規則と同じ）。
- 面取りは Bevel モディファイア（幅 0.001〜0.002m、2〜3 分割、Harden Normals）。

### 4.3 LP のセクション型 ×10（HTML/CSS/JS）
共通［実測値を当社用に］: セクション上下余白 `clamp(96px, 11vw, 160px)`、本文幅 `min(87.5%, 1260px)`、地は #000 / #0b0b0c / #f5f5f7 を交互、アクセント 1 色、出現は `opacity .6s cubic-bezier(.25,.1,0,1)` と `translateY(16px→0)`、一度だけ（上端が画面の下 70% に来たら）。`prefers-reduced-motion` では動きを止め最終状態を出す。
1. **板付きヒーロー（暗転→明転）**: 100svh の黒。製品映像（透過 WebM/HEVC か連番）が 1.5 秒で明転し、0.4 秒遅れて 80px 見出し（和文 64〜72px）。下に小さく 21px の一言。ボタンは 1 つ。最初の 1 枚は静止画（poster）で即表示、映像は後から。
2. **固定して進める連番**: 外箱 400vh、中に sticky 100vh の canvas。p→フレーム、`p_s` で追従。画像は `createImageBitmap` で前もってデコード。DPR は `min(devicePixelRatio,2)`。遅い回線（`navigator.connection.saveData` 等）や reduced-motion では 1 枚に。
3. **動画スクラブ**: `-g 1` の 3〜5 秒動画。sticky の中で `currentTime = p_s*duration`。WebM を先、MP4 を後に `<source>`。
4. **一行ずつ明るくなる文**: 32〜48px の短い3〜4行。各行 `animation-timeline: view(); animation-range: entry 40% cover 50%` で opacity .25→1。非対応ブラウザは全行 1。
5. **3D モデルの回り込み**: three.js、黒地＋光の板の環境。p で orbit 0→40°、光の帯が面を流れる。描画は p が変わった時だけ、画面外で停止。モデルは glTF＋Draco/KTX2、初回は静止画を先に出す。
6. **大きな数字（スペック）**: 80〜96px の数字（tabular-nums）＋19〜21px の説明。3つまで横並び。数字は画面に入ったら 1.2 秒 easeOutCubic で数える（一度だけ）。偽の数値は書かない。
7. **自動再生ハイライト**: 角丸 28px のカード 3〜5 枚、1 枚 6 秒前後で自動送り、点ナビ＋一時停止ボタン必須。画面外では止める（IntersectionObserver）。
8. **縮んで額に収まる映像**: 全面の映像がスクロールで `clip-path: inset(0 round 0) → inset(6% 8% round 28px)` と縮み、余白に文字が現れる。「客席から舞台を見る」距離感の演出に使える。
9. **素材の寄りと固定の文章（2 カラム）**: 左に sticky の短文（48px 見出し＋17〜21px 本文）、右に寄りの画像が 3〜4 枚流れる。画像は loading="lazy"、srcset で 3 サイズ×2 倍。
10. **静かな締め（CTA）**: #f5f5f7 か黒の地で、56px の一文＋ボタン 1 つ＋問い合わせ。ロゴは光で開示（1 回だけ）。フッターの注記は 12px。
- 性能の目安［当社既定］: 最初の画面の読み込み 1.5MB 以下、連番 1 本 6MB 以下、ページ全体 25MB 以下、Lighthouse の CLS 0.05 未満。画像・映像はすべて width/height か aspect-ratio を指定して場所を先に確保。
- 宣伝映像にページを使うとき: スクロール位置を `p = f(t)` にして `renderAt(t)` で 1 コマずつ撮れば、LP の動きをそのまま映像化できる（決定性の規則は playbook §4.1）。

### 4.4 品質チェックリスト（審査で使う）
**ページ**
- [ ] 1 画面に主役は 1 つ。見出しは 1 行〜2 行、和文 20 字以内
- [ ] 文字サイズの段は 5 段以内（例 80 / 48 / 28 / 21 / 17）。字間は大きいほど詰める、和文は palt＋0
- [ ] セクション間の余白 ≥ 96px（スマホ）、見出し→本文は ≤ 24px
- [ ] 色は無彩色＋アクセント 1 色。製品と照明以外に色がない
- [ ] 動きは 1 種類のイーズ（長い減速）。弾まない。reduced-motion で止まる
- [ ] 自動再生には一時停止。遅い回線では静止画。CLS なし
- [ ] スクロールを戻しても破綻しない（連番・動画スクラブは逆方向も確認）

**映像・3D**
- [ ] 黒は 0〜3、製品の最暗部は細部が見える（6〜12）。白は飛ばない（AgX/Neutral）
- [ ] 逆光で輪郭が立っている。正面光は弱い
- [ ] 金属・ガラスに映る物（光の板）がある。のっぺりしていない
- [ ] 角に面取りの細いハイライトがある。粗さが一様でない
- [ ] カメラは 1 ショット 1 動き、ゆっくり、等速でない。速い所はブラー（180°）
- [ ] ボケで模型に見えない（実寸・f 値）。ピントは製品の手前の稜線
- [ ] 開示は「輪郭→面→全体」の順。開示の前に間（無音か暗転 1 拍）
- [ ] ブルームは光源だけ。フレア・虹色・パーティクルの爆発なし（direction.md）
- [ ] 文字は製品と重ならない場所に、白×黒、1 系統の書体、読める時間（playbook §5.2）
- [ ] 音: SE は要所だけ、2〜4f 先行。サブを小音量で確認。エンドは音のロゴ
- [ ] 「Apple の製品ページに並べて見劣りしないか」「照明家が美しいと言うか」

出典（§4 全体）: §1〜§3 に挙げたもの。LP の型の数値は §1 の実測、性能の考え方は [CSS-Tricks](https://css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages/) と [hontran.dev](https://www.hontran.dev/blog/scroll-scrubbed-video-stutters-fix)、[GSAP の ScrollTrigger 連番の議論](https://gsap.com/community/forums/topic/34938-png-sequence-within-pinned-section/)。

---

## 5. まだ分からないこと（次に調べる）
- Apple の製品映像そのもののショット長・カメラ速度の実測（公式の解説はない）。手持ちの参考映像を当社で計測して §2.4 を更新する。
- Blender 5.x の AgX の Look 名と、Mac mini（M6・32GB）での Cycles の 1 コマあたりの時間。導入時に計測。
- Firefox の `animation-timeline` 対応状況（資料によって食い違い）。使う前に MDN / caniuse で確認。
- SF Pro の字間表（Apple Design Resources が一次資料。当社は SF を使わないので参考扱い）。
