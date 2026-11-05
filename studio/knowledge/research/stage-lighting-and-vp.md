# 研究メモ: 舞台・ライブ照明を CG に移す／少人数グリーンバック VP（Mac）

調査日 2026-11-05（Web 調査。インストール・購入・実行はしていない）。前提: `../direction.md`、`../virtual-production-pipeline.md`。
- 表記: **[未確認]** = 一次情報で裏が取れていない。**[経験則]** = 業界の慣習・当社の初期値で、テストで詰める値。
- 価格は USD（税別）。購入前に公式ページで再確認する。文章は要約・言い換えで、他者の文章は転載していない。

## 0. 先に結論（パイプラインの前提が変わった点）

| 項目 | 以前の前提 | 調査結果（2026-11 時点） | 影響 |
|---|---|---|---|
| Autoshot（Jetset の後処理） | Mac 版は「予定」だった | **Apple Silicon 版 v1.1.44（.pkg）が公開済み**。Windows 版は v1.1.45。Mac は Autoshot Tools の別インストール不要。AI ロト「SAM 3 Matte」も **Core ML 版（Neural Engine）** が Mac 用にある。Blender アドオン v1.0.150 | 方式 B を Mac だけで完結できる。Windows 機は不要 |
| Jetset の料金 | 未調査 | App Store の課金: **Pro $20/月・$200/年、Cine $80/月・$800/年**。無料版あり（1080p・透かし付きとの報道 [未確認]）。iOS 18 以上・A12 以上 | まず **Jetset Pro（iPhone 自体で撮る）** で始め、シネマカメラ連動（Cine）は後回し |
| Lightcraft Spark | なし | 新製品。台本→3D プレビズ→ショットリスト→iOS で簡易合成。$29.95/月（3席）。シネマカメラ連動は Jetset のみ | 企画・絵コンテ段階の選択肢。今は不要 |
| Rokoko Vision | 2台カメラで精度を上げる想定 | **Vision 3.0（2026-07-16）でブラウザ版（Rokoko Create 内）に統合。2台カメラとウェブカメラ撮影は 2026-08-16 に廃止**。1台・1人・指なし。Free 30秒/月、Basic $10/月（年払い）で 600 秒/月・BVH・リターゲット | 「単眼1人」前提に変更。録画→アップロード方式 |
| Move AI | 未調査 | Move One（iPhone 1台・1人）はクレジット制。**公式ページ同士で料金表が食い違う**（下記 B1）。Move Pro（複数カメラ）は個別見積 | 1人なら Rokoko Basic が安い。比較テストしてから契約 |
| OBS（Mac） | 未調査 | OBS 32 で **Apple Silicon 向け Metal レンダラー（実験的）**、ProRes / HEVC は VideoToolbox でハード収録、既定コンテナは Hybrid MOV/MP4 | 本番は従来の描画（OpenGL）で安定運用。Metal はテストのみ [経験則] |
| three.js | 当社は r170・ACES | r170 に **AgX トーンマップ、IESSpotLight（WebGPU）、VolumeNodeMaterial（WebGPU）** が入っている。最新は r187 | Blender（AgX）と見た目を揃えるため AgX へ寄せる案。WebGPU 化はテストから |
| Blender | 4.x 想定 | 現行マニュアルは **5.2 LTS**。ライトに **Temperature（K）** 欄、色管理に **ACES 2.0・Khronos PBR Neutral・AgX**、ホワイトバランス | ライトの色はケルビンで指定できる。照明設計図と同じ言葉で書ける |
| 日本の電源 | — | 東日本 50Hz／西日本 60Hz。50Hz 地域では 1/50・1/100 秒のシャッターがちらつきに強い | 関東で撮るなら 24p でも 1/50（172.8°）を既定にする |

---

# A. 舞台・ライブ照明 → シネマティック CG

## A1. 用語（現場の言葉 ↔ 英語 ↔ CG での意味）

| 現場 | 英語 | 意味 | CG での置き換え |
|---|---|---|---|
| 地明かり（ベース） | area / general wash | 舞台全体を均一に照らす基本の明かり | 広角スポット数灯＋弱い環境光 |
| サス（サスペンション） | top / down light | 舞台上部のバトンから。単独サスで1人を浮かせる | 真上〜やや前のスポット |
| シーリング | FOH / ceiling spot | 客席天井から。見やすいが平板になりやすい | 正面高所のスポット（弱め） |
| フロントサイド | front side / box boom | 客席前方の両袖から。シーリングより立体的。片側だけで劇的 | 方位 ±30〜50°・仰角 20〜35° |
| ステージサイド／斜め上 | side / high side | 袖や斜め上から。体を彫刻し背景から浮かせる。顔は苦手 | 方位 ±90°・仰角 30〜60° |
| バック（逆光） | back light | 奥から。髪と肩の輪郭、ハゼで光の筋 | 方位 180°・仰角 45〜70° |
| エッジ | rim / edge | 輪郭だけ光らせる | 細いスポット＋ライトリンク |
| シンバスター／フットスポット | shin buster / low side | 床近くから。体が浮く、幻想的・不穏 | 仰角 0〜10° の側面スポット |
| フット | footlight | 舞台前端の床から。下からの面明かり | 弱い低い面光源 |
| ホリゾント（ホリ）、アッパー／ロアー | cyc, top/bottom cyc | 奥の幕を上下から染める。空、夕景、シルエット | 発光する奥の面（グラデーション） |
| ピンスポット（センターピン） | follow spot | 客席最後部から特定の人物を追う。縁がはっきり | 遠方・狭角のスポット。目標を遅れて追う |
| ゴボ | gobo / pattern | 楕円スポットに型を入れて模様を投影 | テクスチャ（クッキー）付きスポット |
| ハゼ／スモーク | haze / fog | 空気に粒子を入れて光の筋を見せる。ハゼは薄く均一、スモークは濃く塊 | ボリューム（散乱） |
| パーライト | PAR can | 強い楕円ビーム。ライブの定番 | 狭角・高輝度スポット |
| ブラインダー | audience blinder | 客席に向けて一瞬焚く強い光 | 画面に向く高輝度の点光源群 |
| 板付き | — | 幕開き・明転の時点で役者がすでに舞台にいること | 0 フレーム目に被写体が位置にいる |

時間の言葉（キュー）:
- **暗転** = 照明を消して場面転換。**明転** = 明かりを点けたまま転換（客前で転換を見せる）。お笑い等では「明るくなる」の意味でも使われるので、指示書では「明転（転換を見せる）」「明かりが入る（F.I.）」と書き分ける。
- **溶暗 F.O.** = ゆっくり暗くなる、**溶明 F.I.** = ゆっくり明るくなる、**カットアウト C.O. / カットイン C.I.** = 瞬時に消す・点ける、**クロスフェード** = 次の明かりへ入れ替え。

## A2. 角度で何が起きるか（設計の原則）

- **マッキャンドレス法**: 1つの演技エリアに、前方 2 灯を仰角約 45°・左右に約 45° ずつ（互いに約 90°）。片方を暖色、片方を寒色にして、互いの影を埋めながら顔に立体感を出す。バック・サイド・トップは追加で形を作る。45° は目安で「角度と色の分離」が本質。
- 正面（真正面）: 顔は見えるが平板。**高い斜め前（45°）**: 顔が最も美しいが片側が影 → 反対から色違いを足す。**真横**: 体を彫刻、背景から浮く、顔は弱い。**床すれすれの横**: 浮遊感・不穏。**逆光だけ**: 輪郭は出るが顔が見えず、単独では成立しにくい。
- 前・横・後ろを場面ごとに配分する（Howard Bay の「宝石」のような照明）。
- パナソニックの照明設計資料（写真比較）の要点: ボーダー＋フットだけだと影は少ないが**ハイライトがなく見せ場がない**。そこに単独サスを足すと**観客の目が止まる位置**ができる。前明かりを敢えて使わず単独サスの調光で陰影を強くする。背景をロアーホリだけにして落とすと抑えた表現になる。ゴボは質感とタッチを加え、ピンの照射面積が小さいほどゴボの印象が強い。
- 当社の翻訳: **1画面1主役 = 単独サス or ピン**。地明かりは 0.05〜0.15 程度に抑え、黒を残す（`direction.md` の「光そのものが色を持つ」）。

## A3. 色温度とゲル（カメラは目と違って順応しない）

| 光源 | 目安の色温度 | 近い sRGB（白=6500K 基準の近似） | メモ |
|---|---|---|---|
| ろうそく | 約 1900K | #FF8400 | |
| ハロゲン（調光で絞った） | 約 2000〜2700K | #FF9B3D〜#FFA757 | 調光で赤〜茶に寄る（アンバードリフト）。Osram は「伝統的なアンバーシフト」と表記 |
| ハロゲン舞台球 HPL 575W（全開） | 3250K（公称）。実測 CCT 3082K の資料あり | #FFB87B | 舞台の「暖かい白」の基準 |
| 白色 LED（可変） | 2700〜6500K | — | 調光しても色は変わらない。瞬時に点滅。低照度で段がつくことがある [未確認] |
| HMI・昼光 LED・ピンスポット（放電灯） | 約 5600K | #FFEFE1 | ハロゲンの舞台に置くと青白く見える |
| 月明かり表現 | 7000〜9000K 相当＋青ゲル | #DDE6FF〜 | 実際は暗い暖色を青く「見せる」約束事 |

- 色の近似は Tanner Helland の黒体近似式で計算（当社計算）。**Blender 5.x はライトの Temperature 欄に K を直接入れる**ので、そちらを優先。
- **カメラのホワイトバランスを先に決める**: 3200K に合わせるとハロゲンは白、LED 5600K は青。5600K に合わせるとハロゲンはオレンジ。舞台らしさ（暖色のスポット＋寒色の空気）を出すなら **WB 4300K 前後**を既定にする [経験則]。Blender は色管理のホワイトバランス、three.js は全ライトの色を同じ係数で補正。
- よく使われるゲル（Rosco の人気色キットより）: R02 Bastard Amber（肌が自然に見える薄い琥珀、暖色の地明かり定番）、R16 Light Amber、R33 No Color Pink、R60 No Color Blue（寒色の地明かり）、R65 Daylight Blue、R80 Primary Blue。色温度補正: **LEE 201 Full CT Blue = 3200K→5700K**、**LEE 204 Full CTO = 6500K→3200K**。メーカー間で同名でも色が違う（番号で指定する）。Lee の番号対応表には食い違いあり [未確認]。
- 当社の「アクセント1色まで」と両立させる: 暖色（R02 相当）＋寒色（R60 相当）を**明度差で**使い、彩度の高い色（R80 等）はアクセント1色に限定する。

## A4. キューの時間（間＝呼吸で切る）

| キュー | 時間の目安 [経験則] | CG での実装 |
|---|---|---|
| C.I./C.O.（スナップ） | 0 秒。ハロゲンは点灯 0.1〜0.2 秒の立ち上がり、消灯時に 0.15〜0.3 秒の残光（暖色に寄りながら） | LED 風は 1 フレームで切替。ハロゲン風は強度を指数減衰させ、同時に色温度を 3200K→2000K へ |
| 音楽の拍に乗るヒット | 拍の頭に光が「着く」。立ち上がりを拍の 1 フレーム前から始める（playbook の SE 前倒しと同じ考え） | 拍グリッドから cue 時刻を作る |
| 場面の F.I./F.O. | 2〜5 秒 | 長いイーズアウト（`direction.md`）。F.O. は終盤ほどゆっくり |
| 暗転 | 溶暗 1.5〜3 秒 → 闇で 1〜2 拍止める → 溶明 2〜3 秒 | 闇は**完全な黒（0）**にせず 0.5〜1% を残すか、意図した黒なら master.py の黒味検出に「意図」と記録 |
| 夜明け・夕暮れのクロス | 20〜60 秒 | ホリの色をゆっくり、人物の明かりは遅れて追従 |
| 終演の溶暗 | 5〜10 秒 | 最後の 1 秒は主役のピンだけ残す |

- ハロゲンの調光カーブは直線ではない（低いレベルで急に暗く・赤くなる）。CG では「強度 = レベル^2 前後、色温度 = 2000K + 1200K×レベル」程度から始める [未確認の近似]。

## A5. 芝居とライブの組み立ての違い

| | 芝居（ドラマ・企業の物語系） | ライブ（音楽・ライバー・MV） |
|---|---|---|
| 主目的 | 顔と表情が見える、場所と時間を伝える（窓・月・夕景に理由がある光） | 音楽の形（拍・展開・サビ）を見せる。顔は二次的なことも多い |
| 主な角度 | 斜め前 45°（色違い 2 灯）＋単独サス＋弱いバック | **逆光・ビーム・サイド**が主役。前明かりは弱め |
| 色 | 淡い暖色・寒色の差で時間帯を描く | 1 曲 1〜2 色を大胆に。サビで白や琥珀に開く |
| キュー | 観客に気づかれない数秒のフェード | 拍に乗るスナップ、ブラインダーの一撃、ビームの動き |
| ハゼ | なし〜薄（筋は窓光・月光の演出だけ） | 中〜濃（ハゼがないと床の当たりしか見えない） |
| 当社の型 | P02・P03・P05・P06 | P08・P09・P10 |

ライブ照明の要点（業界ブログ・メーカー記事の要約、権威ある規格ではない）: ビームは扇・トンネル・直線など単純な幾何形の方が強い。逆光とシルエットの多用。ブラインダーは明るさより「いつ来るか」が効く。客席に向ける光は観客の負担を見て加減する。

## A6. Blender での再現（5.2 LTS マニュアル準拠）

| 狙い | Cycles | EEVEE | 注意 |
|---|---|---|---|
| スポットの広さ | Spot の **Angle = 円錐の全角**（1〜180°） | 同じ | three.js の `angle` は**半角**。Blender 30° = three.js 15°（0.262 rad） |
| 縁のぼかし | **Blend**（0〜1。0 で鋭い縁） | 同じ | Blend は光の輪の縁だけ。物の影の硬さは別（Radius） |
| 影の硬さ | **Radius**（大きいほど柔らかい影・ハイライト） | Radius ＋影の Jitter（重い）/ Filter | 舞台機材の口径に合わせる: 楕円スポット 0.05〜0.1m、PAR 0.1m、ソフトボックス 0.5m〜 |
| 色 | **Temperature（K）**＋Color（ゲル） | 同じ | ゲルは Color に、球の色は Temperature に分けると照明家の言葉と一致 |
| IES 配光 | **IES Texture ノード** → Emission の Strength | **非対応**（EEVEE はライトのノードを無視） | 実在器具の配光を使うなら Cycles |
| ゴボ | ライトのノードに Image Texture（座標は Normal か Generated→Mapping、外側は Clip）。白黒反転に注意 | ノードは無視されるので、**ライトの前に穴あき板（アルファ付き平面）を置いて影で抜く** [未確認：マニュアル外の一般手法] | ゴボのピントは Radius で甘くなる（小さいほど鋭い） |
| ハゼ（全体） | World に Volume Scatter / Principled Volume | World Volume も可 | Cycles の World ボリュームは重い。範囲が無限なので床奥まで白く煙る |
| ハゼ（局所・推奨） | 舞台を囲む**箱に Principled Volume**（Density・Anisotropy） | 同じ。Render › Volumes の Resolution・Steps・Custom Range で精度 | 箱にすると密度の場所ムラ（床付近を濃く）が作れ、速い |
| 筋の見え方 | **Anisotropy 0.3〜0.6（前方散乱）** → 光源の方を向くほど筋が明るい | 同じ（Henyey-Greenstein） | ライブの逆光ビームはカメラを光源側へ向けると最も出る |
| 被写体だけにリム | **Light Linking**（受ける物・影を落とす物を指定） | EEVEE も対応 | エッジ光が床や背景を汚さない |
| トーン | **AgX**（16.5 段、明部を脱色して自然に飽和） | 同じ | 濃い青ゲルのホットスポットは白に寄る＝リアル。彩度を残すなら露出を下げる。製品の色を正確に出すなら **Khronos PBR Neutral** |
| 書き出し | Rec.709 SDR（当社の既定） | 同じ | HDR は H.265/AV1・10bit・Rec.2100 PQ が条件（今は使わない） |

- ライトの単位は「放射の W」で電球の W ではない。マニュアルの目安: 1000lm 電球 ≈ 2.9W、PAR38 ≈ 4W。舞台を作るときは**相対比**（キー=1.0）で組み、最後に Film の露出で合わせる。
- 速度: Cycles の Volume は Biased（レイマーチ）にして Step Rate を上げると速い。M6 では夜間バッチ（パイプライン方針どおり）。

## A7. three.js での再現（当社 r170・`tools/cine/cine.js`）

- 現状: `createStage` は ACESFilmic、`spot()` は SpotLight、`beam()` は加算の円錐シェーダーで光の筋を描く、`FogExp2` で奥を黒に溶かす。
- **トーンを AgX に**: r170 に `THREE.AgXToneMapping` がある。Blender と同じ見え方の基準にするため、`createStage({toneMapping})` で切り替えられるようにし、作品ごとに比較する（ACES は彩度が強く出る、AgX は明部が自然に白へ）。
- **ゴボ**: `SpotLight.map` にテクスチャを入れる。**`castShadow = true` でないと map は無効**。色はテクスチャの RGB と混ざる。
- **単位**: `intensity` はカンデラ、`decay = 2` のまま（物理的に正しい）。距離が倍で 1/4。角度は**半角**、`penumbra`（0〜1）は Blender の Blend とほぼ同じ感覚 [近似]。
- **IES**: `IESSpotLight` は **WebGPU レンダラーのみ**（r170 に同梱）。WebGL のままなら不可。
- **本物のボリューム**: r170 に `VolumeNodeMaterial`（WebGPU）。公式例（最新版）は「箱のボリューム＋1/4 解像度でレイマーチ（12 ステップ、ベイヤーでディザ）＋ガウスぼかしで加算」。影付きスポットの影がハゼの中に**筋の影**として出る（現行の円錐シェーダーにはできない）。ただし例の API 名（RenderPipeline 等）は新しい版のもので、r170 では名前が違う可能性 [未確認]。→ まず 1 作でテストし、決定論レンダー（renderAt(t)・Math.random 不使用）が保てるか確認。
- 現行 `beam()` の改善案（WebGL のまま）: ①カメラが光源を向くほど明るく（前方散乱の近似: 視線と光軸の内積で強度を上げる）②床との交差を深度で柔らかく ③ t の決定論ノイズで密度に揺らぎ ④主役の位置に「影の帯」を 1 本だけ手で入れる（遮蔽の嘘）。
- ブルームは光源だけ（`direction.md`）。ビーム自体にブルームをかけない。

## A8. 照明プリセット表

座標: 被写体＝原点、**方位 0° = 客席（カメラ）側、+90° = 上手（客席から見て右）、−90° = 下手、180° = 奥**。仰角 0° = 水平、90° = 真上。強度はキー＝1.0 の相対値。Angle/Blend は Blender（three.js は角度を半分）。
ハゼ: 0 なし／1 薄（Blender 局所箱 Density 0.005〜0.01、Anisotropy 0.4、cine.beam density 0.10）／2 中（0.015〜0.03、0.5、0.22）／3 濃（0.04〜0.08、0.6、0.35）。**数値はすべて初期値 [経験則]、テストで詰める。**

| ID・名前 | 用途 | ライト（方位/仰角・色・相対強度・Angle/Blend/Radius） | ハゼ | カメラ |
|---|---|---|---|---|
| P01 板付きピン | 製品・人物の登場、ロゴ前の一拍 | ①トップピン 0°/75°・3200K・1.0・20°/0.15/0.02m ②リム 180°/45°・4300K・0.6・30°/0.3 ③環境 0.02 | 1 | 50〜85mm。闇から C.I. か 1.5 秒 F.I.。ゆっくりドリーイン。床の光の輪を構図に入れる |
| P02 芝居の地明かり（マッキャンドレス） | 人物の芝居、インタビュー、企業の語り | ①前下手 −45°/45°・R02 相当 3000K・1.0・40°/0.4/0.1m ②前上手 +45°/45°・R60 相当（淡青 #E8EEFF）・0.7・同 ③バック 180°/60°・3200K・0.8・50°/0.3 ④環境 0.05 | 0〜1 | 35〜50mm、目の高さ 1.2〜1.5m（客席の目線）。影側（寒色側）から撮ると立体的 |
| P03 斜め上のエッジ | 独白・緊張・決意 | ①ステージサイド +90°/30°・3200K・1.0・30°/0.2/0.05m ②バック 180°/60°・8000K 相当・0.5 ③前は顔の芯だけ 0°/20°・0.08 | 1 | 3/4 アングルで影側から。顔の半分が闇でよい。ラックフォーカス |
| P04 夕景ホリ・シルエット | 物語の始まり・終わり、MV の引き | ①ロアーホリ（奥の発光面）下 2000K 琥珀→上 深い青のグラデーション・1.0 ②トップ 0°/85°・寒色・0.15 ③前明かり 0 | 1 | 低い位置から 24〜35mm。人物はシルエット、ホリを地平線に。20〜60 秒のクロスで時間経過 |
| P05 青の夜（月明かり） | 夜、孤独、余韻 | ①斜め上 −60°/50°・8000K＋青（#9DB4FF）・0.6・60°/0.6/0.3m（柔らかい） ②単独サス 0°/80°・3200K・0.35・15°/0.3（顔だけ拾う） ③ホリ 深い青・0.2 | 2（低い位置だけ濃く） | 露出を −1 段。黒はつぶさない（0.5〜1% 残す）。ゆっくりパン |
| P06 ゴボ（木漏れ日・窓） | 場所の説明（室内・森・牢）、質感 | ①ゴボ付き楕円スポット +70°/40°・4300K・1.0・35°/0.1/0.01m（型をくっきり） ②バック 180°/55°・0.4 ③環境 0.03 | 2（模様の筋が空中に見える） | Cycles はノードのゴボ、EEVEE は穴あき板、three.js は map＋castShadow。模様が床と顔に乗る位置で止める |
| P07 フォロースポット | 主役を追う、歌い出し、受賞・登壇 | ①ピン 0°/25〜35°・5600K（放電灯・LED のピンは舞台より白い）・1.5・6〜10°/0.25 ②地明かり P02 を 0.3 に下げる | 1（客席側からの筋が見える） | 目標を 0.1〜0.2 秒遅れて追う（人の操作感）。全身→バストへ絞るとゴボ同様に印象が強まる |
| P08 ライブ: 逆光ビームの扇 | 曲のイントロ・サビ前の溜め | ①奥のトラスにムービング 5〜7 台 180°/60〜75°・方位を ±10〜35° に扇状・アクセント 1 色または 6500K・各 2.0・3〜5°/0.05 ②前明かり 0°/30°・3200K・0.3 | 2〜3 | 低い位置から光源側へ向ける（前方散乱で筋が最大）。24〜35mm。ゆっくりプッシュ。サビで扇を開く |
| P09 ライブ: ブラインダーの一撃 | サビ頭・決めの拍 | ①舞台前端の床にブラインダー 4〜8 灯（カメラ向き 0°/−5°）・2700K・3.0 を 2〜4 フレーム → 0.3〜0.6 秒で残光減衰 ②奥のウォッシュは継続 | 2 | 白飛びは意図どおり（AgX で自然に）。拍の 1 フレーム前から立ち上げる。多用しない（1 曲 1〜2 回） |
| P10 ライブ: 琥珀の PAR 逆光 | バンド・ロック・弾き語りの温度感 | ①PAR ウォッシュ 180°/50°・2200〜2700K（または赤のアクセント 1 色）・1.2・25°/0.3 ②シンバスター ±90°/5°・0.6 ③前 0°/30°・0.2 | 2 | 楽器の金属に逆光のハイライト。シルエット気味でよい。ネオン・虹色は使わない |
| P11 製品（Apple 風） | 企業の製品映像、黒地のヒーロー | ①真上やや前の大面光源 0°/70°・2×1m・5600K・1.0 ②細長いストリップ 2 本 ±120°/10°・0.2×1.5m・1.2（縁の反射線） ③黒い遮光板で余計な映り込みを消す | 0（奥行きが欲しければ 0.002） | 85〜100mm、5〜10° のゆっくりした周回。反射の線が面を滑る瞬間を主役に。Khronos PBR Neutral も比較 |

---

# B. 少人数グリーンバック・バーチャルプロダクション（Mac・Apple Silicon）

## B1. 道具の現況（2026-11-05）

| 道具 | 現況 | Mac / Blender | 当社での使い方 |
|---|---|---|---|
| **Lightcraft Jetset**（iPhone アプリ） | Pro $20/月・$200/年、Cine $80/月・$800/年。iOS 18+・A12+。LiDAR 付き iPhone Pro 推奨（15 Pro Max 以降は USB-C 有線で転送が速く、読み込める CG も大きい: 16 Pro Max で USDZ 400〜600MB） | 現場の簡易合成は iPhone 内。Blender → USDZ で CG を送る | 方式 B。まず Pro（iPhone のカメラ映像がそのまま素材）。原点マーカー（印刷 PDF、緑の床用あり）、3D ガベージマット（小さいグリーンでも広い画が撮れる） |
| **Autoshot**（Mac/PC） | Mac 版 v1.1.44（Apple Silicon）。テイク同期、カメラ素材から EXR（ACEScg）抽出、Blender 用のレンダー用 .blend 生成、SynthEyes 用スクリプト | **Mac 対応済み**。Blender アドオン v1.0.150 | 撮影後に Claude が実行。地面に接する画は追加でトラッキング精度を上げる（SynthEyes／KeenTools GeoTracker。Mac 版の有無は各社で確認 [未確認]） |
| Jetset Cine | シネマカメラに iPhone を載せ、レンズを較正（STMap で歪み補正）。Accsoon SeeMo（HDMI→iPhone）、Tentacle Sync（タイムコード）が必要。70〜85mm（S35 換算）を超える望遠は光学較正が効かず手入力 | Autoshot の Solve（COLMAP）を使う | シネマカメラ導入後。今は不要 |
| **Rokoko Vision 3.0** | ブラウザ（Rokoko Create）。単眼・1人・指なし。Free 30秒/月（FBX）、Basic $10/月（年払い。月払い $12）600秒/月・BVH・リターゲット。2台カメラとウェブカメラは 2026-08-16 廃止 | ブラウザなので Mac 可。書き出しは FBX/BVH。Blender 対応と明記。清書・書き出しは Rokoko Studio（デスクトップ。Mac 版の現況 [未確認]） | 1人の踊り・芝居を CG キャラ／アバターへ。全身が画面に入る・遮蔽が少ない映像で |
| **Move AI – Move One** | iPhone アプリ・1人。クレジット制（1 クレジット = 1人×1秒、Gen 2 は 2 倍）。料金表が公式ページ間で不一致: ①docs: Starter $18/60cr、Standard $48/180cr、Plus $225/240cr、Advanced $490/700cr、無料は 30cr（1回きり）・30秒まで、有料は 60 秒まで ②help: Starter $15/月（180cr）、Basic $35/月（480cr）、Teams $75/人 **[要確認]** | 書き出し FBX / USD（レビューでは .blend も）[未確認] | Rokoko と同じ動きで比較テストしてから決める |
| Move Pro | 複数カメラ・多人数。個別見積 | — | 当面不要 |
| OBS Studio 32.x | Chroma Key（既定: 類似度 400、滑らかさ 80、スピル低減 100）。VideoToolbox で HEVC・ProRes（4444 XQ まで）収録。Metal レンダラーは実験的 | Mac ネイティブ | 方式 A のリアルタイム合成と配信 |
| DaVinci Resolve（Fusion） | Delta Keyer（クリーンプレート、コアマット＋エッジマット、Fringe タブでスピル） | Mac ネイティブ | 本番の合成・色 |
| Blender 5.2 | Keying ノード（キー＋デスピル）、Keying Screen（ムラのあるグリーンを点で補正）、Movie Clip のカメラ解析、Cycles のシャドウキャッチャー | Mac ネイティブ（Metal） | CG・合成・解析 |

## B2. グリーンバックの照明（比率・距離）

- **距離**: 人物とグリーンの間は **2〜3m（6〜10ft）**。近いほど緑の照り返し（スピル）と影が乗る。狭い部屋なら、グリーンを人物の後ろだけに小さく張り、Jetset／Fusion のガベージマットで外側を CG にする。
- **明るさの比**: グリーンは**人物の顔より 1/2〜1 段暗く**（資料により幅あり）。波形で**平らな帯**になること（曲線ならムラ）。目安は 50〜60 IRE 前後（資料により 50% を超えない／60 IRE など幅あり）。
- **均一さ**: グリーンの端から端まで ±1/3 段以内 [経験則]。グリーン用ライトは柔らかく（拡散）、左右から斜めに当てて人物には当てない。
- **人物の光は CG の世界に合わせて別に作る**（ここが照明家の出番）。キー・リムの向き・色・硬さを、先に作った CG の照明設計図どおりに置く。
- **逆光（リム）**を必ず入れる: 髪と肩の縁を背景から分け、スピルを打ち消す。ただし CG 側にも同じ向きの光源（P02 のバック等）がある場合だけ。理由のないリムは合成が嘘になる。
- **色温度は全灯同じ**にする（バラバラだとキーが不安定）。ゲルの色は CG で後から足す方が安全 [経験則]。
- 床まで緑にするのは足元を見せるショットだけ。床の緑はスピルが最も強い。

## B3. スピル・エッジ・髪

| 問題 | 撮影でやること | 合成でやること |
|---|---|---|
| 肌や白い服が緑っぽい | 距離をとる、リム、グリーンを必要範囲だけ | デスピル（OBS の Spill Reduction、Fusion Delta Keyer の Fringe、Blender Keying の Despill）。元と見比べて肌が灰色にならない所で止める |
| 髪が欠ける・透ける | 髪の後ろのグリーンを明るすぎにしない、リム、背景からの距離 | **ソフトキー（髪用）＋ハードキーを縮めたコアマット（体用）**を重ねる。1つのキーを強く締めない。Delta Keyer の Restore Fringe |
| グリーンにムラ | ライトを均一に | クリーンプレート（人物なしで 5 秒撮る）。Blender は Keying Screen |
| 端にマーカーや機材 | 人物の後ろのテープは外す（髪がテープを横切るとキーが難しい） | ガベージマット（Planar Tracker で追わせる） |
| エッジの浮き | — | ライトラップ（背景の光を人物の縁に少し回す）、エッジの軽いぼかし、粒子（グレイン）を合成後に全体へ |
| AI で抜く | 衣装が緑っぽい・グリーンが小さいとき | Autoshot の SAM 3 Matte（Mac は Core ML）。Jetset の Person/AR キー。キーと AI マットの組み合わせも可 |

衣装・小物: 緑・反射する金属・透ける布・細かい網は避ける（必要なら青バック）。

## B4. CG の光を実写に合わせる

1. **向き**: 撮影前に CG の照明設計図（キー・リムの方位/仰角）を作り、現場はそれに合わせて立てる。撮影時にライト位置を iPhone で撮って記録。
2. **色**: 実際のライトの色温度（ライト本体の表示値）を記録。CG 側は Temperature に同じ K、カメラの WB も同じ値で揃える。
3. **硬さ**: 実物のソフトボックスの**大きさと距離**を記録し、CG の Area/Radius を同じに。
4. **基準の記録**（毎セットアップ 5 秒）: グレーカード、可能ならグレー球とクローム球。これで CG の明るさ・反射を合わせる。
5. **影**: Cycles の **Shadow Catcher**（床だけ影を受ける。Shadow Catcher パスを有効にすると間接光も拾う）。EEVEE で同等ができるかは [未確認] → 影が要るショットは Cycles。
6. **黒の一致**: 実写の黒レベルと CG の黒をスコープで揃え、最後に共通のグレイン・ビネットをかける（`direction.md` の仕上げ）。

## B5. カメラを合わせる

| 項目 | やること | 落とし穴 |
|---|---|---|
| センサー幅 | **記録モードで実際に使っている幅**を入れる（4K クロップ・手ぶれ補正で狭くなる） | カタログ値をそのまま入れると解析が崩れる。分からなければ 35mm 換算の焦点距離＋幅 36mm |
| 焦点距離 | 単焦点を使う。ズームは撮影中に動かさない。値を記録 | 解析の誤差が小さくても実際とずれることがある（誤差 0.5 px 未満が目安、3 超は不可。誤差だけで判断しない） |
| レンズ歪み | Blender の解析で焦点距離と K1 を推定（Refine）。Jetset Cine は STMap | 広角ほど歪み大。CG は歪みを付けて合成するか、実写を歪み補正してから |
| フレームレート | 撮影・Jetset・Blender・書き出しを**完全に一致**（23.976 と 24 を混ぜない） | Jetset Pro の例は 30p。どの fps で記録されるかは事前に確認 [未確認] |
| シャッター | 180°（24p なら 1/48）。**東日本 50Hz では 1/50（172.8°）**、60Hz では 1/60 がちらつきに強い。Blender のモーションブラー Shutter = 角度/360（172.8° → 0.48） | 速いシャッターは髪の縁が鋭くなりキーは楽だが、CG と動きの質感がずれる |
| ローリングシャッター | 速いパンを避ける | iPhone・ミラーレスは縦のゆがみ。解析が合わない原因 |
| 手ぶれ補正 | **電子手ぶれ補正は切る**（解析と Jetset の記録がずれる）[経験則] | — |

## B6. OBS（Mac）でリアルタイムにキーを抜く（方式 A）

1. 映像入力: カメラの**クリーン HDMI**（表示なし）→ UVC 対応キャプチャ機器（ドライバ不要の機種が楽）→ Mac。iPhone は連係カメラでも入る。キャプチャ機器の型番と価格は購入前に確認 [未確認]。
2. ソース順: 下に CG 背景（Blender の連番を動画にしたもの、または静止画）、上にカメラ。カメラにフィルター: **クロップ（ガベージ）→ Chroma Key → 色補正**。
3. Chroma Key の調整順: キー色（緑）を確認 → **類似度**を、背景が消えて体が欠けない所まで → **滑らかさ**で縁 → **スピル低減**。体が欠けるなら類似度を下げる前に照明のムラを直す。
4. 収録: OBS の合成はプレビュー／撮って出し。**本番用にカメラ本体（または外部レコーダー）で無加工の素材を必ず同時収録**する（後で Resolve/Blender で抜き直す）。
5. 安定運用: Metal レンダラーは実験的なので本番は使わない。収録は ProRes 422（VideoToolbox）か HEVC 10bit。

## B7. 収録形式とデータ量

Apple ProRes 白書（目標値。実際は 5〜10% 少なめ）:

| 形式 | 1080p24 | 1080p30 | UHD 24p | UHD 30p |
|---|---|---|---|---|
| ProRes 422 LT | 82 Mb/s・37 GB/時 | 102・46 | 328・148 | 410・185 |
| ProRes 422 | 117・53 | 147・66 | 471・212 | 589・265 |
| ProRes 422 HQ | 176・79 | 220・99 | 707・318 | 884・398 |
| ProRes 4444 | 264・119 | 330・148 | 1061・477 | 1326・597 |

- **キー抜きの素材は 4:2:2 以上・10bit**（ProRes 422 以上）。H.265 の 4:2:0 8bit は色の解像度が半分で、髪の縁がブロック状になる。カメラが 4:2:2 10bit の H.265 を出せるならデータは小さく済むが、編集は重め（M 系の 4:2:2 HEVC ハード復号の対応範囲は [未確認]）。
- H.265 は 100 Mb/s で約 45 GB/時。
- **4TB SSD の目安**: UHD24p の ProRes 422 HQ で約 12 時間、422 で約 18 時間。1 日の撮影（実収録 2 時間）なら HQ で約 640GB → 当日 2 部コピー（SSD＋Drive/HDD）。
- iPhone 17 Pro: ProRes RAW・Apple Log 2 は外付け SSD に直接記録（exFAT・10Gbps 以上のケーブル、書き込み 4K60 で 220MB/s 以上という資料あり [未確認]）。Jetset 使用時の記録形式は Jetset 側の設定に従う。

## B8. よくある失敗と対策

| 失敗 | 原因 | 対策 |
|---|---|---|
| 縁が緑・肌が緑 | 近すぎ、グリーン明るすぎ | 距離 2m 以上、グリーンを 1/2〜1 段落とす、リム、デスピル |
| 人物が CG から浮く | 光の向き・色・硬さが不一致、影がない | 照明設計図を先に、色温度記録、Shadow Catcher、ライトラップ、共通グレイン |
| 足が滑る | トラッキングのずれ、焦点距離・センサー値の誤り | 床にテープ（グリーンに近い色）、レンズ値記録、地面接地ショットは精度を上げる処理 |
| 画面がちらつく | 電源周波数とシャッター | 50Hz 地域は 1/50・1/100 |
| 髪が溶ける | キーを強く締めた | コア＋エッジの二重キー、クリーンプレート、AI マット |
| CG と動きの質感が違う | シャッター・fps 不一致 | Blender の Shutter を実写と同じ角度に |
| Jetset が途中で重くなる | iPhone の発熱 | 冷却ファン付きクリップ、外部電源、重い CG は軽量化（テクスチャ縮小） |
| 素材が見つからない・上書き | 命名と取り込みのルールなし | 下のチェックリストの命名ルール、カードの中身を丸ごとコピー |

## B9. 撮影当日チェックリスト（監督用・スマホで上から順に）

**前日まで（Claude が用意したものを見るだけ）**
- [ ] 香盤（何時に何のカット）と、CG の背景の静止画を見た
- [ ] 照明設計図（どこから・何色の光）を見て「この雰囲気で OK」と返事した
- [ ] 役者に「緑・光る素材・細かい網の服は避けて」と伝えた
- [ ] SSD・カメラのカード・バッテリーを充電・空にした

**会場に着いたら**
- [ ] グリーンにシワがない（アイロン・引っぱり）
- [ ] 立ち位置からグリーンまで **大人の歩幅 3 歩（約 2〜3m）** ある
- [ ] グリーンを照らすライトは人物に当たっていない
- [ ] 全部のライトの色温度表示が同じ数字（例 4300K）

**照明（いちばん大事）**
- [ ] 人物のキーとリムの向きが、照明設計図の矢印と同じ
- [ ] 人物の顔よりグリーンが少し暗い（モニターで顔の方が明るい）
- [ ] 髪と肩の縁に細い光（リム）がある
- [ ] 足元に変な影がグリーンに落ちていない
- [ ] ライトの位置をスマホで 1 枚撮った

**カメラ（スタッフに読み上げてもらう）**
- [ ] フレームレートとシャッター: 指定どおり（例 24p・1/50）
- [ ] 手ぶれ補正: 切
- [ ] ズーム: 動かさない（使うレンズの mm を紙に書いた）
- [ ] 収録形式: ProRes 422 以上（または指定のもの）
- [ ] （方式 B）iPhone の Jetset で原点マーカーを読んだ・グリーンの範囲を設定した

**テイクごと**
- [ ] カチンコ（または手を叩く）を映した
- [ ] 最初のテイクの前に、人物なしでグリーンだけを 5 秒撮った（クリーンプレート）
- [ ] 照明を変えたら、グレーカード（ある日はグレー球も）を 5 秒撮った
- [ ] 演技に集中。画が気になったら「何カット目の何が」とメモだけ残す

**撤収**
- [ ] カードの中身を**フォルダごと**外付け SSD に入れた（中身を選ばない・名前を変えない）
- [ ] 素材フォルダに入れたと Claude に一言送った

## B10. ポストプロダクション・チェックリスト（Claude 用）

**取り込み**
1. カードを丸ごと `案件ID/raw/日付_カメラ名/` にコピー → チェックサム照合 → 2 部目（Drive か HDD）。空き容量を管理アプリへ。
2. ffprobe で fps・解像度・コーデック・色空間・タイムコードを一覧化。fps 混在・可変フレームレートを検出したら止めて報告。
3. Jetset のテイクを Autoshot（Mac）で同期。テイク名・タイムコード・レンズ情報を対応表に。

**カメラ**
4. センサー幅（記録モードの実幅）・焦点距離・歪みを決める。固定カメラは 1 フレームで消失点から合わせる。
5. 動くカメラ: Jetset の記録 → Autoshot で .blend 生成。接地するショットは Blender の解析（または SynthEyes/GeoTracker）で精度を上げる。解析誤差 0.5px 未満を目安、CG の床と実写の足が合っているかを目で確認。

**キー**
6. クリーンプレートで差分、Keying（Blender）または Delta Keyer（Resolve）。コアマット＋エッジマットの二重、ガベージマット。
7. 必要なら SAM 3 Matte（Core ML）で人物マットを作り、キーと合成。
8. デスピルは元と比較して肌色が灰色にならない所で止める。髪の 200% 拡大でチェック。

**CG と光**
9. 照明設計図どおりに CG ライトを配置（方位/仰角・K・大きさ・距離）。撮影時の写真とグレーカードで強さを合わせる。
10. 影が必要なら Cycles の Shadow Catcher。被写体リムは Light Linking。ハゼは局所ボリューム。
11. シャッター角を実写と同じに（モーションブラー Shutter = 角度/360）、被写界深度も実写のボケ量に合わせる。
12. プレビュー（低サンプル）で全尺確認 → 本番は夜間バッチ。連番 EXR は内蔵に一時書き出し、完成品だけ外付けへ。

**合成と仕上げ**
13. ライトラップ、エッジの軽いぼかし、黒レベル合わせ、全体に共通のグレインとビネット。
14. 色: AgX（CG）と実写の Log/Rec.709 を Resolve で揃える。BT.709 タグ付きで書き出し（playbook の数値ゲート）。
15. QC: 縁の緑・髪・足の滑り・ちらつき・光の向き・影の有無・色温度差を 1 項目ずつチェック表に記入 → 別エージェントで審査 → 修正は 1 回にまとめる。
16. 学んだこと（照明比・キー設定・失敗）を `playbook.md` に追記。

---

## 出典

**A. 照明**
- マッキャンドレス法: https://en.wikipedia.org/wiki/Stanley_McCandless ／ https://www.controlbooth.com/wiki/Collaborative+Articles:McCandless+Method ／ https://illuminated-integration.com/blog/mccandless-method-stage-lighting/
- 角度の効果: https://stagelightingprimer.com/slfs-angles.html
- 日本の照明位置と写真比較（パナソニック 舞台照明設計資料）: https://www2.panasonic.biz/jp/lighting/control/stage/lighting-design-data/pdf/light-shadow.pdf ／ https://www2.panasonic.biz/jp/lighting/control/stage/lighting-design-data/pdf/role.pdf
- 暗転・明転: https://www.weblio.jp/content/暗転 ／ ホリゾント: https://event21.co.jp/lit161_horizon.htm
- ゲル: https://www.fullcompass.com/common/files/47058-ColorEffectsKitDatasheet.pdf ／ https://en.wikipedia.org/wiki/Color_gel ／ https://leefiltersdirect.com/products/201-full-c-t-blue ／ https://www.controlbooth.com/goto/post?id=70223
- HPL 色温度・調光: https://www.adorama.com/hpl-575w-120v-tungsten-halogen-lamp-g95-base-3250k/p/lmhpl575 ／ https://osram.com/ecat/Halogen%20(%3e%20130%20V)%20Single%20End-Halogen%20(%3e%20130%20V)-Entertainment%20Lighting-Entertainment%20&%20Industry/us/en/GPS01_265578/ZMP_55977 ／ https://hstech.org/how-to-tech/electrics/lamp-life-color-temperature/
- ライブ照明（業界ブログ・メーカー記事。参考程度）: https://www.nlfxpro.com/blog2/the-ultimate-guide-to-stage-lighting-effects-beyond-basic-washes ／ https://shehds.com/blogs/news/rock-concert-lighting-design ／ https://www.uking-online.com/blogs/stage-lighting-dmx-knowledge-hub/using-blinder-lights-to-build-hype ／ https://www.ticketfairy.com/blog/lighting-for-faces-not-flash-warm-festival-looks-that-read
- Blender 5.2 マニュアル: https://docs.blender.org/manual/en/latest/render/lights/light_object.html ／ https://docs.blender.org/manual/en/latest/render/cycles/light_settings.html ／ https://docs.blender.org/manual/en/latest/render/shader_nodes/textures/ies.html ／ https://docs.blender.org/manual/en/latest/render/eevee/render_settings/volumes.html ／ https://docs.blender.org/manual/en/latest/render/shader_nodes/shader/volume_scatter.html ／ https://docs.blender.org/manual/en/latest/render/cycles/render_settings/volumes.html ／ https://docs.blender.org/manual/en/latest/render/lights/light_linking.html ／ https://docs.blender.org/manual/en/latest/render/eevee/light_settings.html ／ https://docs.blender.org/manual/en/latest/render/color_management/displays_views.html
- Blender のゴボ: https://help.greyscalegorilla.com/en/articles/12771313-how-to-use-gobos-in-blender ／ https://bazaar.blendernation.com/?p=12009
- three.js: https://threejs.org/docs/pages/SpotLight.html ／ https://threejs.org/examples/webgpu_volume_lighting ／ https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_volume_lighting.html ／ https://github.com/mrdoob/three.js/blob/dev/src/constants.js（r170 の同梱ファイルも確認: `studio/node_modules/three/src/`）

**B. VP**
- Lightcraft: https://lightcraft.pro/downloads ／ https://docs.lightcraft.pro/llms-full.txt（機材・iPhone 世代・キー・Fusion 手順・Spark との比較）／ https://lightcraft.pro/pricing ／ https://apps.apple.com/us/app/lightcraft-jetset/id1634621836 ／ https://www.provideocoalition.com/jetset/ ／ https://www.newsshooter.com/2025/04/02/lightcraft-technology-jetset-iphone-virtual-production-tool-gets-new-features/
- Rokoko: https://www.rokoko.com/products/video ／ https://www.rokoko.com/insights/introducing-rokoko-vision-3-0 ／ https://support.rokoko.com/hc/en-us/articles/48823033216017-Rokoko-Vision-and-Rokoko-Create-What-you-need-to-know（本文は 403 で未読、検索要約のみ）
- Move AI: https://docs.move.ai/knowledge/move-one-pricing ／ https://help.move.ai/en/articles/8851451-move-one-pricing（docs へ転送。旧版の要約は検索結果より）／ https://docs.move.ai/knowledge/how-does-pricing-work-for-move-pro ／ https://www.cgchannel.com/?p=151616 ／ https://www.move.ai/move-one
- OBS: https://obsproject.com/kb/chroma-key-filter ／ https://news.lavx.hu/article/obs-studio-32-0-lands-major-upgrades-metal-for-apple-silicon-nvidia-ai-enhancements-and-prores-support ／ https://betanews.com/article/obs-studio-29/ ／ https://newreleases.io/project/github/obsproject/obs-studio/release/32.0.0
- グリーンバック照明: https://nofilmschool.com/2016/05/heres-what-you-need-remember-when-lighting-green-screen ／ https://neiloseman.com/?p=7964 ／ https://mediagear.ee/how-to-light-a-green-screen/ ／ https://www.seanet.com/~bradford/blue_green_screen_visual_effects_2.html
- キー・スピル・髪: https://mixinglight.com/color-grading-tutorials/clean-plate-creation-chroma-keying-part-7-davinci-resolve-fusion ／ https://creativevideotips.com/tutorials/advanced-green-screen-despill-masterclass ／ https://docs.blender.org/manual/en/latest/compositing/types/keying/keying.html ／ https://docs.blender.org/manual/en/latest/compositing/types/keying/keying_screen.html
- シャドウキャッチャー: https://docs.blender.org/manual/en/latest/render/cycles/object_settings/object_data.html
- カメラ解析: https://docs.blender.org/manual/en/latest/movie_clip/tracking/clip/sidebar/track/camera.html ／ https://blenderartists.org/t/camera-tracking-not-working/549824 ／ https://blenderartists.org/t/tracker-positions-differ-from-real-position/619114 ／ https://scrapbox.io/lecture-nakayasu/Blender_%E5%AE%9F%E5%86%99%E5%90%88%E6%88%90_Part_1
- ちらつき: https://onlinemanual.nikonimglib.com/z9/en/15_menu_guide_03_21.html ／ https://cinematography.net/edited-pages/50-60_htz_Flicker.htm
- ProRes: https://www.apple.com/euro/final-cut-pro/f/generic/docs/Apple_ProRes_White_Paper.pdf（2017 年版の目標データレート表）／ https://support.apple.com/109041 ／ https://americas.lexar.com/?p=9838 ／ https://fstoppers.com/news/raw-genlock-and-open-gate-apple-brings-pro-features-iphone-final-cut-camera-20-711174
