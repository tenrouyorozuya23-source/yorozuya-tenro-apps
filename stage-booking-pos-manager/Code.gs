// ============================================================
// 天狼祭2026 自動セットアップGAS  -  コード.gs
// 使い方：
//   1. このファイル（コード.gs）と index.html を
//      同じGASプロジェクトに貼り付ける
//   2. CONFIG の lineToken を再発行したトークンに変更
//   3. 3ステップで実行
// ============================================================

var CONFIG = {
  title:     "天狼祭2026",
  organizer: "萬屋天狼",
  venue:     "高島平バルスタジオ",
  creditRate: 0.0326,

  // 席種設定（販売有無はスプシの公演マスタで変更可）
  seatTypes: [
    { name: "S席",    price: 6000, enabled: true  },
    { name: "A席",    price: 5000, enabled: false },
    { name: "B席",    price: 4000, enabled: false },
    { name: "自由席",  price: 4500, enabled: true  }
  ],

  // 特別チケット（全通券は全公演S席として自動計算）
  specialTickets: [
    { name: "全通券",                price: 22500, enabled: true  },
    { name: "学割",                  price: 2500,  enabled: true  },
    { name: "来場特典配信半額クーポン", price: 2250,  enabled: true  }
  ],

  shows: [
    { dt: "10/23(金) 19:00", cap: 85 },
    { dt: "10/24(土) 13:00", cap: 85 },
    { dt: "10/24(土) 18:00", cap: 85 },
    { dt: "10/25(日) 11:30", cap: 85 },
    { dt: "10/25(日) 16:00", cap: 85 }
  ],

  groups: [
    {
      name: "天狼殺陣会",
      casts: [
        { name: "高嶺瀧",     mail: "" },
        { name: "嶺浜壮丞",   mail: "" },
        { name: "モン吉",     mail: "" },
        { name: "市川隆之介", mail: "" }
      ]
    },
    {
      name: "ちーむ☆三本刀",
      casts: [
        { name: "多那咖藤吉郎", mail: "" }
      ]
    }
  ],

  notify: {
    line: true,
    mail: false,
    hour: 22,
    lineToken:  "YOUR_LINE_TOKEN_HERE",
    lineSecret: "YOUR_LINE_SECRET_HERE",
  },

  goods: [
    { id: "A-001", name: "ツーショットチェキ", price: 1000 },
    { id: "A-002", name: "限定Tシャツ",        price: 3000 }
  ]
};

// ============================================================
// セットアップは3ステップに分けて実行してください
//   手順1: setup_1_sheets()   → シート作成
//   手順2: setup_2_form()     → フォーム作成
//   手順3: setup_3_triggers() → トリガー設定
// ============================================================

function setup_1_sheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  createSheets(ss);
  Logger.log("✅ STEP 1 完了：シートを作成しました。次は setup_2_form() を実行してください。");
}

function setup_2_form() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var form = createForm(ss);
  PropertiesService.getScriptProperties().setProperty("FORM_ID", form.getId());
  Logger.log("✅ STEP 2 完了：フォームを作成しました。");
  Logger.log("予約フォームURL: " + form.getPublishedUrl());
  Logger.log("次は setup_3_reservationSheet() を実行してください。");
}

function setup_3_reservationSheet() {
  // フォーム作成後に予約一覧シートを正しい列順で再構築
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("予約一覧");
  if (!sheet) {
    Logger.log("エラー：予約一覧シートが見つかりません。先に setup_1_sheets() を実行してください。");
    return;
  }
  // ヘッダーを正しい順番で上書き（フォームの質問順に合わせる）
  var headers = [
    "タイムスタンプ","取り扱いキャスト","お名前","ふりがな",
    "メールアドレス","公演日時","席種","枚数","備考",
    "予約番号","ステータス","取り置きフラグ","決済方法","キャンセル"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader(sheet.getRange(1, 1, 1, headers.length));
  Logger.log("✅ STEP 3 完了：予約一覧シートのヘッダーを更新しました。");
  Logger.log("次は setup_4_triggers() を実行してください。");
}

function setup_4_triggers() {
  var formId = PropertiesService.getScriptProperties().getProperty("FORM_ID");
  if (!formId) {
    Logger.log("エラー：先に setup_2_form() を実行してください。");
    return;
  }
  var form = FormApp.openById(formId);
  setTriggers(form);
  Logger.log("✅ STEP 4 完了：セットアップ完了！");
}

// ============================================================
// STEP 1: シート作成
// ============================================================
function createSheets(ss) {
  var defaultSheet = ss.getSheets()[0];
  if (defaultSheet.getName() !== "予約一覧") defaultSheet.setName("予約一覧");
  setupReservationSheet(ss, defaultSheet);
  setupMasterSheet(ss);
  setupCastSheet(ss);
  setupControlPanel(ss);
  setupSalesInput(ss);
  setupSalesLog(ss);
  setupGoodsSheet(ss);
  setupGoodsMasterSheet(ss);
  setupReceiptSheet(ss);
  for (var i = 0; i < CONFIG.shows.length; i++) {
    setupAttendanceSheet(ss, CONFIG.shows[i]);
  }
  setupLineUsersSheet(ss);
  setupSalesManagementSheet(ss);
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clearContents();
  return sheet;
}

function styleHeader(range) {
  range.setBackground("#1a1a2e").setFontColor("#ffffff")
    .setFontWeight("bold").setHorizontalAlignment("center");
}

// --- 予約一覧 ---
function setupReservationSheet(ss, sheet) {
  sheet.clearContents();
  var headers = [
    "タイムスタンプ","取り扱いキャスト","お名前","ふりがな",
    "メールアドレス","公演日時","席種","枚数","備考",
    "予約番号","ステータス","取り置きフラグ","決済方法","キャンセル"
  ];
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  styleHeader(sheet.getRange(1,1,1,headers.length));
  sheet.setFrozenRows(1);
  var widths = [160,150,120,120,200,130,80,60,200,100,100,110,80,80];
  for (var i=0; i<widths.length; i++) sheet.setColumnWidth(i+1, widths[i]);

  // キャンセル列（N列）の設定のみ（チェックボックスは予約追加時に動的に設定）
  // 初期状態では設定しない（空行にチェックボックスがあるとlastRowがずれるため）
}

// --- 公演マスタ ---
function setupMasterSheet(ss) {
  var sheet = getOrCreateSheet(ss, "公演マスタ");
  var _r0 = sheet.getRange("A1");
  _r0.setValue("公演タイトル");
  _r0.setFontWeight("bold");
  sheet.getRange("B1").setValue(CONFIG.title);
  var _r1 = sheet.getRange("A2");
  _r1.setValue("主催団体");
  _r1.setFontWeight("bold");
  sheet.getRange("B2").setValue(CONFIG.organizer);
  var _r2 = sheet.getRange("A3");
  _r2.setValue("会場");
  _r2.setFontWeight("bold");
  sheet.getRange("B3").setValue(CONFIG.venue);

  // 席種テーブル（スプシで販売有無を切り替え可能）
  var _r3 = sheet.getRange("A5");
  _r3.setValue("🎫 席種設定");
  _r3.setFontWeight("bold");
  _r3.setFontSize(12);
  sheet.getRange("A6:D6").setValues([["席種","単価","販売する","備考"]]);
  styleHeader(sheet.getRange("A6:D6"));
  for (var i=0; i<CONFIG.seatTypes.length; i++) {
    var st = CONFIG.seatTypes[i];
    var r = 7 + i;
    sheet.getRange(r,1).setValue(st.name);
    var _r4 = sheet.getRange(r,2);
    _r4.setValue(st.price);
    _r4.setNumberFormat("¥#,##0");
    sheet.getRange(r,3).insertCheckboxes().setValue(st.enabled);
    sheet.getRange(r,4).setValue("");
  }

  // 特別チケットテーブル
  var stRow = 7 + CONFIG.seatTypes.length + 1;
  var _r5 = sheet.getRange(stRow,1);
  _r5.setValue("🎟 特別チケット設定");
  _r5.setFontWeight("bold");
  _r5.setFontSize(12);
  var stHead = stRow + 1;
  sheet.getRange(stHead,1,1,4).setValues([["チケット種別","単価","販売する","備考"]]);
  styleHeader(sheet.getRange(stHead,1,1,4));
  for (var i=0; i<CONFIG.specialTickets.length; i++) {
    var sp = CONFIG.specialTickets[i];
    var r = stHead + 1 + i;
    sheet.getRange(r,1).setValue(sp.name);
    var _r6 = sheet.getRange(r,2);
    _r6.setValue(sp.price);
    _r6.setNumberFormat("¥#,##0");
    sheet.getRange(r,3).insertCheckboxes().setValue(sp.enabled);
    if (sp.name === "全通券") {
      sheet.getRange(r,4).setValue("全" + CONFIG.shows.length + "公演分のS席として計算");
    }
  }

  // 公演リスト
  var showTitleRow = stHead + CONFIG.specialTickets.length + 2;
  var _r7 = sheet.getRange(showTitleRow,1);
  _r7.setValue("📅 公演一覧");
  _r7.setFontWeight("bold");
  _r7.setFontSize(12);
  var showHeadRow = showTitleRow + 1;
  sheet.getRange(showHeadRow,1,1,6).setValues([["公演ID","公演日時","定員","予約数","残席","ステータス"]]);
  styleHeader(sheet.getRange(showHeadRow,1,1,6));
  for (var i=0; i<CONFIG.shows.length; i++) {
    var show = CONFIG.shows[i];
    var row = showHeadRow + 1 + i;
    var showId = "S" + (i<9?"0":"") + (i+1);
    sheet.getRange(row,1).setValue(showId);
    sheet.getRange(row,2).setValue(show.dt);
    sheet.getRange(row,3).setValue(show.cap);
    sheet.getRange(row,4).setFormula('=COUNTIF(予約一覧!F:F,"' + show.dt + '")');
    sheet.getRange(row,5).setFormula("=C"+row+"-D"+row);
    sheet.getRange(row,6).setFormula(
      '=IF(E'+row+'<=0,"満席",IF(E'+row+'<=10,"△ わずか",IF(E'+row+'<=30,"○ 少なめ","◎ 余裕あり")))'
    );
  }

  sheet.setColumnWidth(1,160); sheet.setColumnWidth(2,140);
  sheet.setColumnWidth(3,80);  sheet.setColumnWidth(4,200);
}

// --- キャスト設定 ---
function setupCastSheet(ss) {
  var sheet = getOrCreateSheet(ss, "キャスト設定");
  var headers = ["キャスト名","団体名","メールアドレス","LINE UserID","通知方法","予約数","合計席数","個別URL"];
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  styleHeader(sheet.getRange(1,1,1,headers.length));
  sheet.setFrozenRows(1);
  var row = 2;
  for (var gi=0; gi<CONFIG.groups.length; gi++) {
    var group = CONFIG.groups[gi];
    for (var ci=0; ci<group.casts.length; ci++) {
      var cast = group.casts[ci];
      var label = cast.name + " 【" + group.name + "】";
      sheet.getRange(row,1).setValue(cast.name);
      sheet.getRange(row,2).setValue(group.name);
      sheet.getRange(row,3).setValue(cast.mail || "");
      sheet.getRange(row,4).setValue("");
      sheet.getRange(row,5).setValue("LINE");
      sheet.getRange(row,5).setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(["LINE","メール","両方","なし"])
          .setAllowInvalid(false)
          .build()
      );
      sheet.getRange(row,6).setFormula('=COUNTIF(予約一覧!B:B,"' + label + '")');
      sheet.getRange(row,7).setFormula('=SUMIF(予約一覧!B:B,"' + label + '",予約一覧!H:H)');  // H列=枚数
      sheet.getRange(row,8).setValue("");
      row++;
    }
  }
  var colWidths = [130,130,200,160,90,70,80,300];
  for (var i=0; i<colWidths.length; i++) sheet.setColumnWidth(i+1, colWidths[i]);
}

// --- 操作パネル ---
function setupControlPanel(ss) {
  var sheet = getOrCreateSheet(ss, "操作パネル");
  var _r8 = sheet.getRange("A1");
  _r8.setValue("🐺 " + CONFIG.title + " 操作パネル");
  _r8.setFontSize(16);
  _r8.setFontWeight("bold");
  var ops = ["残席を更新する","本予約メールを送信","キャスト別シートを更新","LINE通知を今すぐ送信","受付表を更新する"];
  for (var i=0; i<ops.length; i++) {
    sheet.getRange(3+i,1).setValue(ops[i]);
    sheet.getRange(3+i,1).setFontWeight("bold");
  }
  sheet.setColumnWidth(1, 220);
}

// --- 販売入力 ---
function setupSalesInput(ss) {
  var sheet = getOrCreateSheet(ss, "販売入力");
  var _r10 = sheet.getRange("A1");
  _r10.setValue("公演日時");
  _r10.setFontWeight("bold");
  var showOptions = CONFIG.shows.map(function(s){ return s.dt; });
  sheet.getRange("B1").setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(showOptions).build()
  );
  sheet.getRange("A3:E3").setValues([["商品ID","商品名","単価","数量","小計"]]);
  styleHeader(sheet.getRange("A3:E3"));
  for (var i=0; i<CONFIG.goods.length; i++) {
    var g = CONFIG.goods[i];
    var row = 4+i;
    sheet.getRange(row,1).setValue(g.id);
    sheet.getRange(row,2).setValue(g.name);
    sheet.getRange(row,3).setValue(g.price);
    sheet.getRange(row,4).setValue(0);
    sheet.getRange(row,5).setFormula("=C"+row+"*D"+row);
  }
}

// --- 売上ログ ---
function setupSalesLog(ss) {
  var sheet = getOrCreateSheet(ss, "売上ログ");
  var headers = ["タイムスタンプ","商品ID","商品名","単価","数量","小計","決済方法","会計ID"];
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  styleHeader(sheet.getRange(1,1,1,headers.length));
  sheet.setFrozenRows(1);
}

// --- 商品マスタ（商品の登録・管理用）---
function setupGoodsMasterSheet(ss) {
  var sheet = getOrCreateSheet(ss, "商品マスタ");

  var t1 = sheet.getRange("A1");
  t1.setValue("📦 " + CONFIG.title + "　商品マスタ");
  t1.setFontSize(14);
  t1.setFontWeight("bold");

  var t2 = sheet.getRange("A2");
  t2.setValue("商品を追加したら、在庫ログに初期在庫を記録してください。物販マスタに自動反映されます。");
  t2.setFontSize(11);
  t2.setFontColor("#6B6B67");

  var headers = ["商品ID","商品名","単価"];
  sheet.getRange(4,1,1,headers.length).setValues([headers]);
  styleHeader(sheet.getRange(4,1,1,headers.length));
  sheet.setFrozenRows(4);

  for (var i=0; i<CONFIG.goods.length; i++) {
    var g = CONFIG.goods[i];
    var r = 5 + i;
    sheet.getRange(r,1).setValue(g.id);
    sheet.getRange(r,2).setValue(g.name);
    sheet.getRange(r,3).setValue(g.price);
    sheet.getRange(r,3).setNumberFormat("¥#,##0");
  }

  // 商品追加用の空行（20行）
  var startR = 5 + CONFIG.goods.length;
  for (var i=0; i<20; i++) {
    sheet.getRange(startR+i, 3).setNumberFormat("¥#,##0");
  }

  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(3, 100);
}

// --- 物販マスタ ---
function setupGoodsSheet(ss) {
  var sheet = getOrCreateSheet(ss, "物販マスタ");

  // タイトル（チェーンを使わず別々に設定）
  var titleCell = sheet.getRange("A1");
  titleCell.setValue("🛍 " + CONFIG.title + "　物販マスタ");
  titleCell.setFontSize(14);
  titleCell.setFontWeight("bold");

  var descCell = sheet.getRange("A2");
  descCell.setValue("在庫数は「在庫ログ」シートへの記録で自動更新されます");
  descCell.setFontSize(11);
  descCell.setFontColor("#6B6B67");

  // ヘッダー
  var headers = ["商品ID","商品名","単価","累計入庫数","累計販売数","現在在庫","販売状況","備考"];
  sheet.getRange(4,1,1,headers.length).setValues([headers]);
  styleHeader(sheet.getRange(4,1,1,headers.length));
  sheet.setFrozenRows(4);

  // 商品データ
  for (var i=0; i<CONFIG.goods.length; i++) {
    var g = CONFIG.goods[i];
    var r = 5 + i;
    sheet.getRange(r,1).setValue(g.id);
    sheet.getRange(r,2).setValue(g.name);
    sheet.getRange(r,3).setValue(g.price);
    sheet.getRange(r,3).setNumberFormat("¥#,##0");
    sheet.getRange(r,4).setFormula('=SUMIF(在庫ログ!B:B,"' + g.id + '",在庫ログ!D:D)');
    sheet.getRange(r,5).setFormula('=SUMIF(売上ログ!B:B,"' + g.id + '",売上ログ!E:E)');
    sheet.getRange(r,6).setFormula("=D"+r+"-E"+r);
    sheet.getRange(r,7).setFormula(
      '=IF(F'+r+'<=0,"⚠️ 在庫なし",IF(F'+r+'<=5,"△ 残りわずか","◎ 在庫あり"))'
    );
    sheet.getRange(r,8).setValue("");
  }

  // 商品追加用の空行（10行）
  for (var i=0; i<10; i++) {
    var r = 5 + CONFIG.goods.length + i;
    sheet.getRange(r,3).setNumberFormat("¥#,##0");
    sheet.getRange(r,4).setFormula('=IF(A'+r+'="","",SUMIF(在庫ログ!B:B,A'+r+',在庫ログ!D:D))');
    sheet.getRange(r,5).setFormula('=IF(A'+r+'="","",SUMIF(売上ログ!B:B,A'+r+',売上ログ!E:E))');
    sheet.getRange(r,6).setFormula('=IF(A'+r+'="","",D'+r+'-E'+r+')');
    sheet.getRange(r,7).setFormula(
      '=IF(A'+r+'="","",IF(F'+r+'<=0,"⚠️ 在庫なし",IF(F'+r+'<=5,"△ 残りわずか","◎ 在庫あり")))'
    );
  }

  // 列幅
  var colWidths = [80,180,90,100,100,90,130,200];
  for (var i=0; i<colWidths.length; i++) sheet.setColumnWidth(i+1, colWidths[i]);

  setupStockLogSheet(ss);
}

// --- 在庫ログ ---
function setupStockLogSheet(ss) {
  var sheet = getOrCreateSheet(ss, "在庫ログ");

  var t1 = sheet.getRange("A1");
  t1.setValue("📦 在庫ログ");
  t1.setFontSize(14);
  t1.setFontWeight("bold");

  var t2 = sheet.getRange("A2");
  t2.setValue("在庫を追加するたびにこのシートに記録してください。物販マスタに自動反映されます。");
  t2.setFontSize(11);
  t2.setFontColor("#6B6B67");

  var headers = ["日付","商品ID","商品名","数量","メモ","記録者"];
  sheet.getRange(4,1,1,headers.length).setValues([headers]);
  styleHeader(sheet.getRange(4,1,1,headers.length));
  sheet.setFrozenRows(4);

  var goodsIds = CONFIG.goods.map(function(g){ return g.id; });
  var idValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(goodsIds).build();

  var today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd");
  for (var i=0; i<CONFIG.goods.length; i++) {
    var g = CONFIG.goods[i];
    var r = 5 + i;
    sheet.getRange(r,1).setValue(today);
    var _r11 = sheet.getRange(r,2);
    _r11.setValue(g.id);
    _r11.setDataValidation(idValidation);
    sheet.getRange(r,3).setValue(g.name);
    sheet.getRange(r,4).setValue(0);
    sheet.getRange(r,5).setValue("初期在庫");
    sheet.getRange(r,6).setValue("");
  }

  // 追加行（50行分）
  var startRow = 5 + CONFIG.goods.length;
  for (var i=0; i<50; i++) {
    var r = startRow + i;
    sheet.getRange(r,2).setDataValidation(idValidation);
    sheet.getRange(r,3).setFormula(
      '=IF(B'+r+'="","",VLOOKUP(B'+r+',物販マスタ!A:B,2,FALSE))'
    );
  }

  sheet.getRange(5,1,100,1).setNumberFormat("yyyy/MM/dd");
  sheet.getRange(5,4,100,1).setNumberFormat("0");

  var colWidths = [110,80,180,70,200,100];
  for (var i=0; i<colWidths.length; i++) sheet.setColumnWidth(i+1, colWidths[i]);
}

// --- レシート ---
function setupReceiptSheet(ss) {
  var sheet = getOrCreateSheet(ss, "レシート");
  var _r12 = sheet.getRange("A1");
  _r12.setValue(CONFIG.title + " レシート");
  _r12.setFontSize(14);
  _r12.setFontWeight("bold");
  sheet.getRange("A2").setValue(CONFIG.venue);
}

// --- 受付表（公演ごと）---
function setupAttendanceSheet(ss, show) {
  var name = "受付_" + show.dt.replace(/[\/:() ]/g,"").replace(/　/g,"");
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clearContents();
  var _r13 = sheet.getRange("A1");
  _r13.setValue(CONFIG.title + "　受付表");
  _r13.setFontSize(14);
  _r13.setFontWeight("bold");
  sheet.getRange("A2").setValue(show.dt + "　定員：" + show.cap + "名");

  // 集計行（2・3行目）はsetupAttendanceSheetの後半で設定するため省略

  // ===== 使い方ガイド（1行目）=====
  sheet.getRange("A1").setValue(CONFIG.title + "　受付表").setFontSize(14).setFontWeight("bold");
  sheet.getRange("A2").setValue(show.dt + "　定員：" + show.cap + "名");
  // 検索ガイド
  sheet.getRange("G1").setValue("🔍 検索方法").setFontWeight("bold").setFontColor("#185FA5");
  sheet.getRange("H1").setValue("Ctrl+F（⌘+F）でシート内検索 | 予約番号・名前で素早く検索できます").setFontColor("#6B6B67");
  sheet.getRange("G2").setValue("↕ 並び順").setFontWeight("bold").setFontColor("#0F6E56");
  sheet.getRange("H2").setValue("操作パネルから「予約番号順」または「ふりがな順」に並び替えできます").setFontColor("#6B6B67");

  // ===== 集計行（再設定）=====
  var sumRow = sheet.getRange("A3");
  sumRow.setValue("集計");
  sumRow.setFontWeight("bold");

  // 来場人数（現金またはクレカにチェックがある行の枚数合計）
  sheet.getRange("B3").setFormula('=SUMPRODUCT((H5:H1000=TRUE)+(I5:I1000=TRUE)>0,E5:E1000)');
  sheet.getRange("B2").setValue("来場枚数").setFontWeight("bold").setFontColor("#0F6E56");
  // 来場人数（チェックが入っている行数）
  sheet.getRange("C3").setFormula('=COUNTIF(H5:H1000,TRUE)+COUNTIF(I5:I1000,TRUE)-COUNTIFS(H5:H1000,TRUE,I5:I1000,TRUE)');
  sheet.getRange("C2").setValue("来場者数").setFontWeight("bold").setFontColor("#0F6E56");
  // 合計枚数
  sheet.getRange("D3").setFormula('=SUM(E5:E1000)');
  sheet.getRange("D2").setValue("合計枚数").setFontWeight("bold").setFontColor("#185FA5");
  // 未着枚数（合計 - 来場）
  sheet.getRange("E3").setFormula('=D3-B3');
  sheet.getRange("E2").setValue("未着枚数").setFontWeight("bold").setFontColor("#A32D2D");
  // 未着人数
  sheet.getRange("F3").setFormula('=COUNTA(B5:B1000)-C3');
  sheet.getRange("F2").setValue("未着者数").setFontWeight("bold").setFontColor("#A32D2D");

  sheet.getRange("A2:F3").setBackground("#F0EEE9");
  sheet.getRange("A3:F3").setFontWeight("bold");

  // 列構成：# | 予約番号 | お名前 | ふりがな | キャスト | 枚数 | 席種 | ステータス | 現金 | クレカ | 備考・要望
  var headers = ["#","予約番号","お名前","ふりがな","取り扱いキャスト","枚数","席種","ステータス","現金","クレカ","備考・要望"];
  sheet.getRange(4,1,1,headers.length).setValues([headers]);
  styleHeader(sheet.getRange(4,1,1,headers.length));
  sheet.setFrozenRows(4);

  // 現金(I列=9)・クレカ(J列=10)にチェックボックスを設定（200行分）
  sheet.getRange(5, 9,  200, 1).insertCheckboxes();  // I列：現金
  sheet.getRange(5, 10, 200, 1).insertCheckboxes();  // J列：クレカ

  // 列幅設定
  sheet.setColumnWidth(1,  40);  // #
  sheet.setColumnWidth(2,  90);  // 予約番号
  sheet.setColumnWidth(3, 120);  // お名前
  sheet.setColumnWidth(4, 100);  // ふりがな
  sheet.setColumnWidth(5, 130);  // キャスト
  sheet.setColumnWidth(6,  50);  // 枚数
  sheet.setColumnWidth(7,  80);  // 席種
  sheet.setColumnWidth(8, 120);  // ステータス
  sheet.setColumnWidth(9,  60);  // 現金
  sheet.setColumnWidth(10, 60);  // クレカ
  sheet.setColumnWidth(11,200);  // 備考・要望

  // 検索・ソート用に列を固定
  sheet.setFrozenColumns(1);
}


// --- LINEユーザー管理 ---
function setupLineUsersSheet(ss) {
  var sheet = getOrCreateSheet(ss, "LINEユーザー");
  var headers = ["LINE UserID","キャスト名","団体名","登録日時"];
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  styleHeader(sheet.getRange(1,1,1,headers.length));
  sheet.setFrozenRows(1);
}

// --- 売上管理シート ---
function setupSalesManagementSheet(ss) {
  var sheet = getOrCreateSheet(ss, "売上管理");
  var cr = CONFIG.creditRate;
  var showCount = CONFIG.shows.length;

  var sm1 = sheet.getRange("A1");
  sm1.setValue("💰 " + CONFIG.title + "　売上管理");
  sm1.setFontSize(14);
  sm1.setFontWeight("bold");

  var sm2 = sheet.getRange("A2");
  sm2.setValue("クレカ手数料：" + (cr*100).toFixed(2) + "%　／　全通券：全" + showCount + "公演S席");
  sm2.setFontSize(11);
  sm2.setFontColor("#6B6B67");

  // ===== 公演ごと集計テーブル =====
  var h1 = ["公演日時","定員","予約数（合計）","残席",
            "S席（現金）","S席（クレカ）","自由席（現金）","自由席（クレカ）",
            "全通券","学割","配信クーポン",
            "チケット売上（現金）","チケット売上（クレカ）","チケット売上合計",
            "物販（現金）","物販（クレカ）","物販合計","公演合計"];
  sheet.getRange(4,1,1,h1.length).setValues([h1]);
  styleHeader(sheet.getRange(4,1,1,h1.length));
  sheet.setFrozenRows(4);

  // 公演マスタの公演リスト開始行を計算
  var masterShowHeadRow = 7 + CONFIG.seatTypes.length + 1 + CONFIG.specialTickets.length + 2 + 1;

  for (var i=0; i<showCount; i++) {
    var show = CONFIG.shows[i];
    var r = 5 + i;
    var masterRow = masterShowHeadRow + 1 + i;

    sheet.getRange(r,1).setValue(show.dt);
    sheet.getRange(r,2).setFormula("=公演マスタ!C"+masterRow); // 定員
    sheet.getRange(r,3).setFormula("=公演マスタ!D"+masterRow); // 予約数
    sheet.getRange(r,4).setFormula("=公演マスタ!E"+masterRow); // 残席

    // 席種別・決済方法別カウント（予約一覧のL列=席種、M列=決済方法）
    var dt = show.dt;
    sheet.getRange(r,5).setFormula( // S席現金
      '=COUNTIFS(予約一覧!F:F,"'+dt+'",予約一覧!G:G,"S席",予約一覧!M:M,"現金",予約一覧!K:K,"<>キャンセル")'
    );
    sheet.getRange(r,6).setFormula( // S席クレカ
      '=COUNTIFS(予約一覧!F:F,"'+dt+'",予約一覧!G:G,"S席",予約一覧!M:M,"クレカ",予約一覧!K:K,"<>キャンセル")'
    );
    sheet.getRange(r,7).setFormula( // 自由席現金
      '=COUNTIFS(予約一覧!F:F,"'+dt+'",予約一覧!G:G,"自由席",予約一覧!M:M,"現金",予約一覧!K:K,"<>キャンセル")'
    );
    sheet.getRange(r,8).setFormula( // 自由席クレカ
      '=COUNTIFS(予約一覧!F:F,"'+dt+'",予約一覧!G:G,"自由席",予約一覧!M:M,"クレカ",予約一覧!K:K,"<>キャンセル")'
    );
    sheet.getRange(r,9).setFormula( // 全通券カウント（このdtに全通券が割り当たっている数）
      '=COUNTIFS(予約一覧!F:F,"'+dt+'",予約一覧!G:G,"全通券(S席)",予約一覧!K:K,"<>キャンセル")'
    );
    sheet.getRange(r,10).setFormula( // 学割
      '=COUNTIFS(予約一覧!F:F,"'+dt+'",予約一覧!G:G,"学割",予約一覧!K:K,"<>キャンセル")'
    );
    sheet.getRange(r,11).setFormula( // 配信クーポン
      '=COUNTIFS(予約一覧!F:F,"'+dt+'",予約一覧!G:G,"配信クーポン",予約一覧!K:K,"<>キャンセル")'
    );

    // チケット売上（現金）= S席現金×6000 + 自由席現金×4500 + 学割現金×2500 + 配信クーポン現金×2250
    // ※全通券は別途集計
    sheet.getRange(r,12).setFormula(
      "=E"+r+"*6000+G"+r+"*4500+"+
      'COUNTIFS(予約一覧!F:F,"'+dt+'",予約一覧!G:G,"学割",予約一覧!M:M,"現金",予約一覧!K:K,"<>キャンセル")*2500+'+
      'COUNTIFS(予約一覧!F:F,"'+dt+'",予約一覧!G:G,"配信クーポン",予約一覧!M:M,"現金",予約一覧!K:K,"<>キャンセル")*2250'
    ).setNumberFormat("¥#,##0");
    sheet.getRange(r,13).setFormula(
      "=F"+r+"*6000+H"+r+"*4500+"+
      'COUNTIFS(予約一覧!F:F,"'+dt+'",予約一覧!G:G,"学割",予約一覧!M:M,"クレカ",予約一覧!K:K,"<>キャンセル")*2500+'+
      'COUNTIFS(予約一覧!F:F,"'+dt+'",予約一覧!G:G,"配信クーポン",予約一覧!M:M,"クレカ",予約一覧!K:K,"<>キャンセル")*2250'
    ).setNumberFormat("¥#,##0");
    sheet.getRange(r,14).setFormula("=L"+r+"+M"+r).setNumberFormat("¥#,##0");

    // 物販
    sheet.getRange(r,15).setFormula(
      '=SUMIFS(売上ログ!G:G,売上ログ!B:B,"'+dt+'",売上ログ!H:H,"現金")'
    ).setNumberFormat("¥#,##0");
    sheet.getRange(r,16).setFormula(
      '=SUMIFS(売上ログ!G:G,売上ログ!B:B,"'+dt+'",売上ログ!H:H,"クレカ")'
    ).setNumberFormat("¥#,##0");
    sheet.getRange(r,17).setFormula("=O"+r+"+P"+r).setNumberFormat("¥#,##0");
    sheet.getRange(r,18).setFormula("=N"+r+"+Q"+r).setNumberFormat("¥#,##0");
  }

  // 合計行
  var totalRow = 5 + showCount;
  var _r15 = sheet.getRange(totalRow,1);
  _r15.setValue("合計");
  _r15.setFontWeight("bold");
  for (var c=2; c<=18; c++) {
    var col = String.fromCharCode(64+c);
    sheet.getRange(totalRow,c).setFormula("=SUM("+col+"5:"+col+(totalRow-1)+")")
      .setFontWeight("bold").setNumberFormat(c>=12?"¥#,##0":"0");
  }
  sheet.getRange(totalRow,1,1,18).setBackground("#E8E6F0");

  // 全通券別集計
  var ztRow = totalRow + 2;
  var _r16 = sheet.getRange(ztRow,1);
  _r16.setValue("🎫 全通券集計（" + showCount + "公演分）");
  _r16.setFontWeight("bold");
  _r16.setFontSize(12);
  sheet.getRange(ztRow+1,1,1,4).setValues([["全通券枚数","売上（現金）","売上（クレカ）","合計"]]);
  styleHeader(sheet.getRange(ztRow+1,1,1,4));
  // 全通券はどの公演でも同じ枚数のはず（1回だけカウント）
  sheet.getRange(ztRow+2,1).setFormula(
    '=COUNTIFS(予約一覧!G:G,"全通券(S席)",予約一覧!K:K,"<>キャンセル")/'+showCount
  );
  sheet.getRange(ztRow+2,2).setFormula(
    '=COUNTIFS(予約一覧!G:G,"全通券(S席)",予約一覧!M:M,"現金",予約一覧!K:K,"<>キャンセル")/'+showCount+'*22500'
  ).setNumberFormat("¥#,##0");
  sheet.getRange(ztRow+2,3).setFormula(
    '=COUNTIFS(予約一覧!G:G,"全通券(S席)",予約一覧!M:M,"クレカ",予約一覧!K:K,"<>キャンセル")/'+showCount+'*22500'
  ).setNumberFormat("¥#,##0");
  sheet.getRange(ztRow+2,4).setFormula("=B"+(ztRow+2)+"+C"+(ztRow+2)).setNumberFormat("¥#,##0");

  // ===== 決済別サマリー =====
  var sumRow = ztRow + 5;
  var _r17 = sheet.getRange(sumRow,1);
  _r17.setValue("💴 決済別サマリー");
  _r17.setFontSize(13);
  _r17.setFontWeight("bold");
  var sh = sumRow + 1;
  sheet.getRange(sh,1,1,4).setValues([["項目","現金","クレカ","合計"]]);
  styleHeader(sheet.getRange(sh,1,1,4));

  var tRow = sh+1; // チケット売上
  sheet.getRange(tRow,1).setValue("チケット売上（通常）");
  sheet.getRange(tRow,2).setFormula("=SUM(L5:L"+(totalRow-1)+")").setNumberFormat("¥#,##0");
  sheet.getRange(tRow,3).setFormula("=SUM(M5:M"+(totalRow-1)+")").setNumberFormat("¥#,##0");
  sheet.getRange(tRow,4).setFormula("=B"+tRow+"+C"+tRow).setNumberFormat("¥#,##0");

  var ztSumRow = sh+2; // 全通券売上
  sheet.getRange(ztSumRow,1).setValue("チケット売上（全通券）");
  sheet.getRange(ztSumRow,2).setFormula("=B"+(ztRow+2)).setNumberFormat("¥#,##0");
  sheet.getRange(ztSumRow,3).setFormula("=C"+(ztRow+2)).setNumberFormat("¥#,##0");
  sheet.getRange(ztSumRow,4).setFormula("=B"+ztSumRow+"+C"+ztSumRow).setNumberFormat("¥#,##0");

  var gRow = sh+3; // 物販
  sheet.getRange(gRow,1).setValue("物販売上");
  sheet.getRange(gRow,2).setFormula('=SUMIF(売上ログ!H:H,"現金",売上ログ!G:G)').setNumberFormat("¥#,##0");
  sheet.getRange(gRow,3).setFormula('=SUMIF(売上ログ!H:H,"クレカ",売上ログ!G:G)').setNumberFormat("¥#,##0");
  sheet.getRange(gRow,4).setFormula("=B"+gRow+"+C"+gRow).setNumberFormat("¥#,##0");

  var subR = sh+4; // 小計
  var _r18 = sheet.getRange(subR,1);
  _r18.setValue("小計");
  _r18.setFontWeight("bold");
  sheet.getRange(subR,2).setFormula("=B"+tRow+"+B"+ztSumRow+"+B"+gRow).setNumberFormat("¥#,##0").setFontWeight("bold");
  sheet.getRange(subR,3).setFormula("=C"+tRow+"+C"+ztSumRow+"+C"+gRow).setNumberFormat("¥#,##0").setFontWeight("bold");
  sheet.getRange(subR,4).setFormula("=B"+subR+"+C"+subR).setNumberFormat("¥#,##0").setFontWeight("bold");
  sheet.getRange(subR,1,1,4).setBackground("#F0EEE9");

  var feeR = sh+5; // クレカ手数料
  var _feeCell = sheet.getRange(feeR,1);
  _feeCell.setValue("クレカ手数料（"+(cr*100).toFixed(2)+"%）");
  _feeCell.setFontColor("#A32D2D");
  var _r19 = sheet.getRange(feeR,2);
  _r19.setValue(0);
  _r19.setNumberFormat("¥#,##0");
  sheet.getRange(feeR,3).setFormula("=ROUND(C"+subR+"*"+cr+",0)").setNumberFormat("¥#,##0").setFontColor("#A32D2D");
  sheet.getRange(feeR,4).setFormula("=C"+feeR).setNumberFormat("¥#,##0").setFontColor("#A32D2D");

  var bankR = sh+6; // 口座入金
  var _r20 = sheet.getRange(bankR,1);
  _r20.setValue("口座入金額（手数料差引後）");
  _r20.setFontColor("#0F6E56");
  sheet.getRange(bankR,2).setValue("—");
  sheet.getRange(bankR,3).setFormula("=C"+subR+"-C"+feeR).setNumberFormat("¥#,##0").setFontColor("#0F6E56").setFontWeight("bold");
  sheet.getRange(bankR,4).setFormula("=C"+bankR).setNumberFormat("¥#,##0");

  var cashTR = sh+8;
  var _r21 = sheet.getRange(cashTR,1);
  _r21.setValue("💵 現金手元合計");
  _r21.setFontWeight("bold");
  _r21.setFontSize(12);
  sheet.getRange(cashTR,2).setFormula("=B"+subR).setNumberFormat("¥#,##0").setFontWeight("bold").setFontSize(12);
  sheet.getRange(cashTR,1,1,4).setBackground("#EAF3DE");

  var bankTR = sh+9;
  var _r22 = sheet.getRange(bankTR,1);
  _r22.setValue("🏦 口座入金合計");
  _r22.setFontWeight("bold");
  _r22.setFontSize(12);
  sheet.getRange(bankTR,2).setFormula("=C"+bankR).setNumberFormat("¥#,##0").setFontWeight("bold").setFontSize(12);
  sheet.getRange(bankTR,1,1,4).setBackground("#E6F1FB");

  var grandR = sh+10;
  var _r23 = sheet.getRange(grandR,1);
  _r23.setValue("📊 総合売上");
  _r23.setFontWeight("bold");
  _r23.setFontSize(12);
  sheet.getRange(grandR,2).setFormula("=D"+subR).setNumberFormat("¥#,##0").setFontWeight("bold").setFontSize(12);
  sheet.getRange(grandR,1,1,4).setBackground("#EEEDFE");

  sheet.setColumnWidth(1,200);
  for (var c=2; c<=18; c++) sheet.setColumnWidth(c, 120);
}

// ============================================================
// STEP 2: Googleフォーム作成
// ============================================================
function createForm(ss) {
  // 販売中の席種と特別チケットを取得（公演マスタのチェックボックスに従う）
  var masterSheet = ss.getSheetByName("公演マスタ");
  var seatChoices = getSeatChoicesFromMaster(masterSheet);

  var form = FormApp.create(CONFIG.title + " 予約フォーム");
  form.setDescription(CONFIG.venue + "\n\nご予約後、取り扱いキャストより確認の連絡をお待ちください。");
  form.setCollectEmail(false);
  form.setConfirmationMessage("ご予約ありがとうございます！取り扱いキャストよりご連絡をお待ちください。");

  // 質問1：取り扱いキャスト
  var castChoices = [];
  for (var gi=0; gi<CONFIG.groups.length; gi++) {
    var group = CONFIG.groups[gi];
    for (var ci=0; ci<group.casts.length; ci++) {
      castChoices.push(group.casts[ci].name + " 【" + group.name + "】");
    }
  }
  form.addListItem().setTitle("取り扱いキャスト").setChoiceValues(castChoices).setRequired(true);

  // 質問2〜4
  form.addTextItem().setTitle("お名前").setHelpText("例：山田 太郎").setRequired(true);
  form.addTextItem().setTitle("ふりがな").setHelpText("例：やまだ たろう").setRequired(true);
  form.addTextItem().setTitle("メールアドレス").setRequired(true);

  // 質問5：公演日時
  var showChoices = CONFIG.shows.map(function(s){ return s.dt; });
  form.addListItem().setTitle("ご希望の公演日時").setChoiceValues(showChoices).setRequired(true);

  // 質問6：席種（販売中のもののみ）
  form.addListItem().setTitle("席種").setChoiceValues(seatChoices).setRequired(true);

  // 質問7：枚数
  form.addListItem().setTitle("枚数").setChoiceValues(["1枚","2枚","3枚","4枚","5枚"]).setRequired(true);

  // 質問8：備考
  form.addParagraphTextItem().setTitle("備考・ご要望").setRequired(false);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // キャスト別URL記録
  var castSheet = ss.getSheetByName("キャスト設定");
  var baseUrl = form.getPublishedUrl();
  var row = 2;
  for (var gi=0; gi<CONFIG.groups.length; gi++) {
    var group = CONFIG.groups[gi];
    for (var ci=0; ci<group.casts.length; ci++) {
      castSheet.getRange(row,8).setValue(baseUrl + " (entry IDは後で追加)");
      row++;
    }
  }
  return form;
}

// 公演マスタから販売中の席種選択肢を取得
function getSeatChoicesFromMaster(masterSheet) {
  var choices = [];
  // 席種は7行目〜（seatTypes.length分）
  for (var i=0; i<CONFIG.seatTypes.length; i++) {
    var r = 7 + i;
    var enabled = masterSheet.getRange(r,3).getValue();
    if (enabled) choices.push(CONFIG.seatTypes[i].name);
  }
  // 特別チケット
  var spStart = 7 + CONFIG.seatTypes.length + 1 + 1 + 1;
  for (var i=0; i<CONFIG.specialTickets.length; i++) {
    var r = spStart + i;
    var enabled = masterSheet.getRange(r,3).getValue();
    if (enabled) choices.push(CONFIG.specialTickets[i].name);
  }
  if (choices.length === 0) choices = ["自由席"]; // フォールバック
  return choices;
}

// ============================================================
// STEP 3: トリガー設定
// ============================================================
function setTriggers(form) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i=0; i<triggers.length; i++) ScriptApp.deleteTrigger(triggers[i]);

  // フォーム送信トリガー
  ScriptApp.newTrigger("onFormSubmit").forForm(form).onFormSubmit().create();

  // 毎日22時：LINE通知
  ScriptApp.newTrigger("sendDailyLineNotification")
    .timeBased().atHour(CONFIG.notify.hour).everyDays(1).create();

  // 毎日0時：受付表・サマリー更新
  ScriptApp.newTrigger("updateAttendanceSheets")
    .timeBased().atHour(0).everyDays(1).create();

  // スプシ編集時：操作パネルのチェックボックスで関数を実行
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger("onEdit")
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log("✅ トリガーを設定しました（フォーム送信・毎日22時・毎日0時・onEdit）");
}

// ============================================================
// フォーム送信時の処理
// ============================================================
function onFormSubmit(e) {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sheet   = ss.getSheetByName("予約一覧");
  var answers = e.response.getItemResponses();

  // 質問タイトルで値を取得
  var seatType = "", seatCount = "", showDt = "";
  for (var i = 0; i < answers.length; i++) {
    var title = answers[i].getItem().getTitle();
    var val   = answers[i].getResponse();
    if (title.indexOf("席種") !== -1)                                     seatType  = val;
    if (title.indexOf("枚数") !== -1)                                     seatCount = val;
    if (title.indexOf("公演日時") !== -1 || title.indexOf("公演") !== -1) showDt    = val;
  }

  // ヘッダーで列番号を特定
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colMap  = {};
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]);
    if (h === "タイムスタンプ")             colMap.ts          = i + 1;
    if (h === "席種")                       colMap.seatType    = i + 1;
    if (h === "枚数")                       colMap.seatCount   = i + 1;
    if (h === "予約番号")                   colMap.resNo       = i + 1;
    if (h === "ステータス")                 colMap.status      = i + 1;
    if (h.indexOf("取り置きフラグ") !== -1) colMap.torioki     = i + 1;
    if (h === "キャンセル")                 colMap.cancel      = i + 1;
  }

  // フォームのタイムスタンプで該当行を特定（最も確実な方法）
  var responseTimestamp = e.response.getTimestamp();
  var data     = sheet.getDataRange().getValues();
  var targetRow = -1;

  for (var r = data.length - 1; r >= 1; r--) {
    var rowTs = data[r][colMap.ts - 1];
    if (!rowTs) continue;
    var rowDate = new Date(rowTs);
    var diff    = Math.abs(rowDate.getTime() - responseTimestamp.getTime());
    // 30秒以内のタイムスタンプかつ予約番号が空の行
    if (diff < 30000 && !data[r][colMap.resNo - 1]) {
      targetRow = r + 1; // 1-indexed
      break;
    }
  }

  // 見つからない場合は予約番号列が空の最終行にフォールバック
  if (targetRow === -1) {
    var lastRow = sheet.getLastRow();
    for (var r = lastRow; r >= 2; r--) {
      if (!sheet.getRange(r, colMap.resNo).getValue()) {
        targetRow = r;
        break;
      }
    }
  }

  if (targetRow === -1) {
    Logger.log("onFormSubmit: 対象行が見つかりませんでした");
    return;
  }

  var reservationNo = generateReservationNo("R");

  if (colMap.resNo)    sheet.getRange(targetRow, colMap.resNo).setValue(reservationNo);
  if (colMap.status)   sheet.getRange(targetRow, colMap.status).setValue("仮予約済み");
  if (colMap.torioki)  sheet.getRange(targetRow, colMap.torioki).setValue("");
  if (colMap.seatType) sheet.getRange(targetRow, colMap.seatType).setValue(seatType);
  if (colMap.seatCount)sheet.getRange(targetRow, colMap.seatCount).setValue(seatCount);
  if (colMap.cancel)   sheet.getRange(targetRow, colMap.cancel).insertCheckboxes().setValue(false);

  // 全通券の場合：全公演に同じ予約を複製
  if (seatType === "全通券") {
    expandZentsuu(ss, sheet, targetRow, e.response, reservationNo);
  }

  // 該当公演の受付表を即時更新
  if (showDt) {
    try { updateSingleAttendanceSheet(ss, showDt); } catch(err) { Logger.log("受付表更新エラー: " + err.message); }
  }

  // 残席更新
  try { updateRemainingSeats(); } catch(err) {}

  addToDailyStack(e.response);
}


// 特定公演の受付表のみ更新（フォーム送信時に使用）
function updateSingleAttendanceSheet(ss, showDt) {
  var sheetName = "受付_" + showDt.replace(/[\/:() ]/g,"").replace(/\u3000/g,"");
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  var resSheet      = ss.getSheetByName("予約一覧");
  var reservations  = resSheet.getDataRange().getValues();
  var resSheetName  = resSheet.getName();

  // 既存データをクリア（ヘッダー4行は残す）
  var lastRow = sheet.getLastRow();
  if (lastRow > 4) sheet.getRange(5, 1, lastRow-4, 10).clearContent();

  // 予約一覧のヘッダーで列を特定
  var hdrs = reservations[0];
  var rCol = {};
  for (var ci = 0; ci < hdrs.length; ci++) {
    var h = String(hdrs[ci]);
    if (h.indexOf("キャスト") !== -1)    rCol.cast   = ci;
    if (h === "お名前")                  rCol.name   = ci;
    if (h === "ふりがな")                rCol.kana   = ci;
    if (h.indexOf("公演") !== -1)        rCol.show   = ci;
    if (h === "席種")                    rCol.seat   = ci;
    if (h === "枚数")                    rCol.count  = ci;
    if (h === "ステータス")              rCol.status = ci;
    if (h === "予約番号")                rCol.resNo  = ci;
  }

  // スプシ上の列番号（1-indexed）
  var statusColLetter = columnToLetter(rCol.status + 1);
  var resNoColLetter  = columnToLetter(rCol.resNo + 1);

  var row = 5; var num = 1;
  for (var i = 1; i < reservations.length; i++) {
    var r = reservations[i];
    var rowShowDt = String(r[rCol.show]||"").trim();
    // スペース等の揺れを吸収して照合
    if (rowShowDt !== showDt &&
        rowShowDt.replace(/\s/g,"") !== showDt.replace(/\s/g,"")) continue;
    if (String(r[rCol.status]) === "キャンセル") continue;

    var resNo = String(r[rCol.resNo] || "");

    // 新列順：1=#, 2=予約番号, 3=名前, 4=かな, 5=キャスト, 6=枚数, 7=席種, 8=ステータス, 9=現金, 10=クレカ, 11=備考
    sheet.getRange(row,1).setValue(num++);
    sheet.getRange(row,2).setValue(resNo);                 // 予約番号
    sheet.getRange(row,3).setValue(r[rCol.name]  || "");  // お名前
    sheet.getRange(row,4).setValue(r[rCol.kana]  || "");  // ふりがな
    sheet.getRange(row,5).setValue(r[rCol.cast]  || "");  // キャスト
    sheet.getRange(row,6).setValue(r[rCol.count] || 0);   // 枚数
    sheet.getRange(row,7).setValue(r[rCol.seat]  || "");  // 席種

    // H列(8)：ステータスをVLOOKUPでリアルタイム参照
    if (resNo) {
      sheet.getRange(row,8).setFormula(
        '=IFERROR(VLOOKUP("' + resNo + '",予約一覧!' + resNoColLetter + ':' + statusColLetter + ',' +
        (rCol.status - rCol.resNo + 1) + ',FALSE),"仮予約済み")'
      );
    } else {
      sheet.getRange(row,8).setValue(r[rCol.status] || "仮予約済み");
    }

    // I列(9)：現金チェックボックス
    sheet.getRange(row,9).insertCheckboxes().setValue(false);
    // J列(10)：クレカチェックボックス
    sheet.getRange(row,10).insertCheckboxes().setValue(false);

    // K列(11)：備考・要望
    var noteColIdx = -1;
    for (var ni = 0; ni < hdrs.length; ni++) {
      if (String(hdrs[ni]) === "備考") { noteColIdx = ni; break; }
    }
    if (noteColIdx >= 0) sheet.getRange(row,11).setValue(r[noteColIdx] || "");

    // ステータスに応じて行の背景色を設定
    var status = String(r[rCol.status] || "仮予約済み");
    var rowBg = status === "受付済み"  ? "#E8F5E9"
              : status === "本予約済み" ? "#E3F2FD"
              : status === "キャンセル" ? "#F5F5F5"
              : "#FFFDE7";
    sheet.getRange(row, 1, 1, 11).setBackground(rowBg);

    row++;
  }
}

// 列番号をアルファベットに変換（例：1→A, 27→AA）
function columnToLetter(col) {
  var letter = "";
  while (col > 0) {
    var rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}



// 全通券を全公演分に展開
function expandZentsuu(ss, sheet, originalRow, response, reservationNo) {
  var answers = response.getItemResponses();

  // タイトルで取得
  var castLabel = "", name = "", kana = "", mail = "", seats = "1枚", note = "";
  for (var i = 0; i < answers.length; i++) {
    var t = answers[i].getItem().getTitle();
    var v = answers[i].getResponse();
    if (t.indexOf("キャスト") !== -1)                                     castLabel = v;
    if (t === "お名前")                                                    name      = v;
    if (t === "ふりがな")                                                  kana      = v;
    if (t.indexOf("メール") !== -1)                                        mail      = v;
    if (t.indexOf("枚数") !== -1)                                         seats     = v;
    if (t.indexOf("備考") !== -1)                                         note      = v;
  }
  var now = new Date();

  // 元行の席種を全通券(S席)に更新（ヘッダーで列を特定）
  var hdrs = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  var seatCol = -1;
  for (var ci = 0; ci < hdrs.length; ci++) {
    if (String(hdrs[ci]) === "席種") { seatCol = ci + 1; break; }
  }
  if (seatCol > 0) sheet.getRange(originalRow, seatCol).setValue("全通券(S席)");

  // 残りの公演分を追加
  for (var i=0; i<CONFIG.shows.length; i++) {
    var showDt = CONFIG.shows[i].dt;
    // 元行と同じ公演はスキップ（タイトルで取得）
    var origShow = "";
    for (var ai = 0; ai < answers.length; ai++) {
      var at = answers[ai].getItem().getTitle();
      if (at.indexOf("公演日時") !== -1 || at.indexOf("公演") !== -1) {
        origShow = answers[ai].getResponse(); break;
      }
    }
    if (showDt === origShow ||
        showDt.replace(/\s/g,"") === origShow.replace(/\s/g,"")) {
      if (seatCol > 0) sheet.getRange(originalRow, seatCol).setValue("全通券(S席)");
      continue;
    }
    var newRow = sheet.getLastRow() + 1;
    var newNo  = reservationNo + "-" + (i+1);
    var hdrs = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    var cm = {};
    for (var ci=0; ci<hdrs.length; ci++) {
      var h = String(hdrs[ci]);
      if (h==="タイムスタンプ") cm.ts=ci+1;
      if (h.indexOf("キャスト")!==-1) cm.cast=ci+1;
      if (h==="お名前") cm.name=ci+1;
      if (h==="ふりがな") cm.kana=ci+1;
      if (h==="メールアドレス") cm.mail=ci+1;
      if (h.indexOf("公演")!==-1) cm.show=ci+1;
      if (h==="席種") cm.seat=ci+1;
      if (h==="枚数") cm.count=ci+1;
      if (h==="備考") cm.note=ci+1;
      if (h==="予約番号") cm.resNo=ci+1;
      if (h==="ステータス") cm.status=ci+1;
      if (h.indexOf("取り置き")!==-1) cm.torioki=ci+1;
    }
    if (cm.ts)      sheet.getRange(newRow, cm.ts).setValue(now);
    if (cm.cast)    sheet.getRange(newRow, cm.cast).setValue(castLabel);
    if (cm.name)    sheet.getRange(newRow, cm.name).setValue(name);
    if (cm.kana)    sheet.getRange(newRow, cm.kana).setValue(kana);
    if (cm.mail)    sheet.getRange(newRow, cm.mail).setValue(mail);
    if (cm.show)    sheet.getRange(newRow, cm.show).setValue(showDt);
    if (cm.seat)    sheet.getRange(newRow, cm.seat).setValue("全通券(S席)");
    if (cm.count)   sheet.getRange(newRow, cm.count).setValue(seats);
    if (cm.note)    sheet.getRange(newRow, cm.note).setValue(note);
    if (cm.resNo)   sheet.getRange(newRow, cm.resNo).setValue(newNo);
    if (cm.status)  sheet.getRange(newRow, cm.status).setValue("受付済み");
    if (cm.torioki) sheet.getRange(newRow, cm.torioki).setValue("全通券");
  }
}

function padZero(n, len) {
  var s = String(n);
  while (s.length < len) s = "0" + s;
  return s;
}

function addToDailyStack(response) {
  var props = PropertiesService.getScriptProperties();
  var today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
  var key = "daily_" + today;
  var stack = JSON.parse(props.getProperty(key) || "[]");
  var answers = response.getItemResponses();

  // タイトルで取得
  var cast = "", name = "", show = "", seats = "", seatType = "";
  for (var i = 0; i < answers.length; i++) {
    var title = answers[i].getItem().getTitle();
    var val   = answers[i].getResponse();
    if (title.indexOf("取り扱いキャスト") !== -1)                                cast     = val;
    if (title.indexOf("お名前") !== -1 || title === "名前")                  name     = val;
    if (title.indexOf("公演日時") !== -1 || title.indexOf("公演") !== -1)    show     = val;
    if (title.indexOf("枚数") !== -1)                                        seats    = val;
    if (title.indexOf("席種") !== -1)                                        seatType = val;
  }

  stack.push({ cast: cast, name: name, show: show, seats: seats, seat_type: seatType });
  props.setProperty(key, JSON.stringify(stack));
}

// ============================================================
// LINE通知（毎日定時）
// ============================================================
function sendDailyLineNotification() {
  var today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
  var key = "daily_" + today;
  var props = PropertiesService.getScriptProperties();
  var stack = JSON.parse(props.getProperty(key) || "[]");
  if (stack.length === 0) return;

  var byCast = {};
  for (var i=0; i<stack.length; i++) {
    var entry = stack[i];
    if (!byCast[entry.cast]) byCast[entry.cast] = [];
    byCast[entry.cast].push(entry);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var castData = ss.getSheetByName("キャスト設定").getDataRange().getValues();

  for (var castLabel in byCast) {
    var entries = byCast[castLabel];
    var castName = castLabel.replace(/\s*【.+】/, "");
    var lineUserId = "";
    for (var r=1; r<castData.length; r++) {
      var fullLabel = castData[r][0] + " 【" + castData[r][1] + "】";
      if (fullLabel === castLabel) { lineUserId = castData[r][3]; break; }
    }
    if (!lineUserId) continue;
    sendLineMessage(lineUserId, buildNotificationMessage(castName, entries));
  }
  props.deleteProperty(key);
}

function buildNotificationMessage(castName, entries) {
  var count = entries.length;
  var totalSeats = 0;
  for (var i=0; i<entries.length; i++) totalSeats += parseInt(entries[i].seats) || 0;
  var msg = "🐺 " + castName + "さん\n本日の予約通知です\n\n";
  msg += "📋 新規予約：" + count + "件 / " + totalSeats + "席\n\n";
  for (var i=0; i<entries.length; i++) {
    msg += "[" + (i+1) + "] " + entries[i].name + "\n　" +
      entries[i].show + " / " + entries[i].seats +
      (entries[i].seat_type ? " (" + entries[i].seat_type + ")" : "") + "\n";
  }
  msg += "\n最新の予約リストはこちら👇\n" + getWebAppUrl() + "?cast=" + encodeURIComponent(castName);
  return msg;
}

function sendLineMessage(userId, message) {
  var token = CONFIG.notify.lineToken;
  Logger.log("sendLineMessage 開始 userId=" + userId + " tokenLength=" + (token ? token.length : 0));

  var response = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    payload: JSON.stringify({ to: userId, messages: [{ type: "text", text: message }] }),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  var body = response.getContentText();
  Logger.log("LINE API response: " + code + " / " + body);
}

// ============================================================
// LINE Webhook（doPost）
// ============================================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({status:"ok"}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var json = JSON.parse(e.postData.contents);
    var events = json.events || [];

    if (events.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({status:"ok"}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var props = PropertiesService.getScriptProperties();

    for (var i=0; i<events.length; i++) {
      var event = events[i];

      // 重複処理防止：イベントIDをチェック
      var eventId = event.webhookEventId || (event.source.userId + "_" + event.timestamp);
      var processedKey = "processed_" + eventId;
      if (props.getProperty(processedKey)) {
        Logger.log("重複イベントをスキップ: " + eventId);
        continue;
      }
      props.setProperty(processedKey, "1");

      // 古いキーを削除（5分以上前のもの）
      var now = new Date().getTime();
      var allKeys = props.getKeys();
      for (var k=0; k<allKeys.length; k++) {
        if (allKeys[k].indexOf("processed_") === 0) {
          var ts = parseInt(allKeys[k].replace("processed_","").split("_").pop());
          if (!isNaN(ts) && (now - ts) > 300000) {
            props.deleteProperty(allKeys[k]);
          }
        }
      }

      if (event.type === "follow") {
        handleFollow(event.source.userId);
      } else if (event.type === "message" && event.message.type === "text") {
        handleMessage(event.source.userId, event.message.text);
      }
    }
  } catch(err) {
    Logger.log("doPost error: " + err.message);
  }

  return ContentService.createTextOutput(JSON.stringify({status:"ok"}))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleFollow(userId) {
  sendLineMessage(userId,
    "🐺 " + CONFIG.title + " 公式LINEへようこそ！\n\nキャスト名を送ってください。\n例：高嶺瀧"
  );
}

function handleMessage(userId, text) {
  Logger.log("handleMessage: userId=" + userId + " text=" + text);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var castSheet = ss.getSheetByName("キャスト設定");
  var lineSheet  = ss.getSheetByName("LINEユーザー");
  var castData = castSheet.getDataRange().getValues();
  var isRegistered = false;
  for (var i=1; i<castData.length; i++) {
    if (castData[i][3] === userId) { isRegistered = true; break; }
  }
  if (!isRegistered) {
    var matched = false;
    for (var i=1; i<castData.length; i++) {
      if (castData[i][0] === text.trim()) {
        castSheet.getRange(i+1,4).setValue(userId);
        castSheet.getRange(i+1,5).setValue("LINE");
        var nr = lineSheet.getLastRow()+1;
        lineSheet.getRange(nr,1,1,4).setValues([[
          userId, castData[i][0], castData[i][1],
          Utilities.formatDate(new Date(),"Asia/Tokyo","yyyy/MM/dd HH:mm")
        ]]);
        sendLineMessage(userId, "✅ " + text + "さんとして登録しました！\nメニューから予約確認・取り置き予約ができます。");
        matched = true; break;
      }
    }
    if (!matched) sendLineMessage(userId, "キャスト名が見つかりませんでした。\n正確なキャスト名を送ってください。\n例：高嶺瀧");
  } else {
    var castName  = getCastNameByUserId(userId, castData);
    var castLabel = getCastLabelByUserId(userId, castData); // 「名前 【団体名】」形式
    var webUrl    = getWebAppUrl() + "?cast=" + encodeURIComponent(castName);

    if (text.indexOf("予約") !== -1 || text.indexOf("確認") !== -1 || text.indexOf("リスト") !== -1) {
      sendLineMessage(userId, "📋 " + castName + "さんの最新予約リストはこちら👇\n\n" + webUrl);
    } else if (text.indexOf("【取り置き】") !== -1) {
      // 取り置きフォーマットをパースして予約登録
      var result = parseTorioki(text, castLabel, userId);
      if (result.success) {
        sendLineMessage(userId,
          "\u2705 取り置き予約を登録しました！\n\n" +
          "予約番号：" + result.reservationNo + "\n" +
          "お客様名：" + result.guestName + "\n" +
          "公演日時：" + result.showDt + "\n" +
          "席種：" + result.seatType + "\n" +
          "枚数：" + result.seats + "\n\n" +
          "\ud83d\udccb 予約リストで確認\ud83d\udc47\n" + webUrl
        );
      } else {
        sendLineMessage(userId,
          "\u274c 取り置き予約の登録に失敗しました\n\n" +
          "エラー：" + result.error + "\n\n" +
          "以下の形式で再送してください\ud83d\udc47\n\n" +
          "【取り置き】\n" +
          "お客様名：山田太郎\n" +
          "ふりがな：やまだたろう\n" +
          "公演日時：10/23(金) 19:00\n" +
          "席種：自由席\n" +
          "枚数：2\n" +
          "備考：（任意）"
        );
      }
    } else if (text.indexOf("取り置き") !== -1 || text.indexOf("とりおき") !== -1) {
      sendLineMessage(userId,
        "\ud83c\udfab 取り置き予約を追加するには以下の形式で送ってください\ud83d\udc47\n\n" +
        "【取り置き】\n" +
        "お客様名：山田太郎\n" +
        "ふりがな：やまだたろう\n" +
        "公演日時：10/23(金) 19:00\n" +
        "席種：自由席\n" +
        "枚数：2\n" +
        "備考：（任意）"
      );
    } else if (text.indexOf("キャンセル") !== -1 || text.indexOf("cancel") !== -1) {
      // キャンセル申請
      var cancelResult = processCancelRequest(userId, text, castLabel);
      sendLineMessage(userId, cancelResult.message);
    } else {
      // その他のメッセージ → 操作メニュー
      sendLineMessage(userId,
        "\ud83d\udc3a " + castName + "さん、こんにちは！\n\n" +
        "以下のキーワードで操作できます\ud83d\udc47\n\n" +
        "\ud83d\udccb「予約確認」→ 予約リストを表示\n" +
        "\ud83c\udfab「取り置き」→ 取り置き予約の追加\n" +
        "\ud83d\uddd1「キャンセル R0001」→ キャンセル申請"
      );
    }
  }
}


// ============================================================
// 取り置きメッセージをパースして予約登録
// ============================================================
function parseTorioki(text, castLabel, userId) {
  try {
    var lines = text.split("\n");
    var data = {};

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      // コロン（全角・半角）で分割
      var colonIdx = line.search(/[：:]/);
      if (colonIdx === -1) continue;
      var key   = line.substring(0, colonIdx).trim();
      var value = line.substring(colonIdx + 1).trim();

      if (key.indexOf("お客様名") !== -1 || key.indexOf("名前") !== -1)     data.guestName = value;
      if (key.indexOf("ふりがな") !== -1 || key.indexOf("フリガナ") !== -1) data.guestKana = value;
      if (key.indexOf("公演日時") !== -1 || key.indexOf("公演") !== -1)      data.showDt    = value;
      if (key.indexOf("席種") !== -1)                                        data.seatType  = value;
      if (key.indexOf("枚数") !== -1)                                        data.seats     = parseInt(value) || 1;
      if (key.indexOf("備考") !== -1)                                        data.note      = value;
    }

    // 必須項目チェック
    if (!data.guestName) return { success: false, error: "お客様名が見つかりません" };
    if (!data.showDt)    return { success: false, error: "公演日時が見つかりません" };

    // 公演日時の存在確認
    var validShows = CONFIG.shows.map(function(s){ return s.dt; });
    var matchedShow = "";
    for (var i = 0; i < validShows.length; i++) {
      if (validShows[i].indexOf(data.showDt) !== -1 || data.showDt.indexOf(validShows[i]) !== -1) {
        matchedShow = validShows[i];
        break;
      }
    }
    // 完全一致も試みる
    if (!matchedShow) {
      for (var i = 0; i < validShows.length; i++) {
        if (validShows[i] === data.showDt) { matchedShow = validShows[i]; break; }
      }
    }
    if (!matchedShow) matchedShow = data.showDt; // 一致しなくてもそのまま登録

    var reservationNo = addTorioki(
      castLabel,
      data.guestName,
      data.guestKana  || "",
      matchedShow,
      data.seats      || 1,
      data.seatType   || "自由席",
      data.note       || ""
    );

    return {
      success:       true,
      reservationNo: reservationNo,
      guestName:     data.guestName,
      showDt:        matchedShow,
      seatType:      data.seatType || "自由席",
      seats:         data.seats    || 1
    };

  } catch(e) {
    return { success: false, error: e.message };
  }
}

function getCastNameByUserId(userId, castData) {
  for (var i=1; i<castData.length; i++) if (castData[i][3] === userId) return castData[i][0];
  return "";
}

// 「キャスト名 【団体名】」形式で返す
function getCastLabelByUserId(userId, castData) {
  for (var i=1; i<castData.length; i++) {
    if (castData[i][3] === userId) {
      var name  = castData[i][0];
      var group = castData[i][1];
      return group ? name + " 【" + group + "】" : name;
    }
  }
  return "";
}

function getWebAppUrl() { return ScriptApp.getService().getUrl(); }

// ============================================================
// WebアプリURL出力（doGet）
// ============================================================
function doGet(e) {
  var page = e && e.parameter && e.parameter.page ? e.parameter.page : "";

  // レジ画面
  if (page === "register") {
    return HtmlService.createHtmlOutputFromFile("register")
      .setTitle(CONFIG.title + " レジ")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // 受付アプリ
  if (page === "checkin") {
    return HtmlService.createHtmlOutputFromFile("checkin")
      .setTitle(CONFIG.title + " 受付")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // 予約リスト（デフォルト）
  var castName = e && e.parameter && e.parameter.cast ? e.parameter.cast : "";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var reservations = getReservationsForCast(ss, castName);
  var template = HtmlService.createTemplateFromFile("index");
  template.castName = castName;
  template.reservations = reservations;
  template.config = { title: CONFIG.title, venue: CONFIG.venue, shows: CONFIG.shows };
  template.now = Utilities.formatDate(new Date(), "Asia/Tokyo", "M月d日 HH:mm");
  template.remainLabels = getRemainingLabels(ss);
  return template.evaluate()
    .setTitle(CONFIG.title + " 予約リスト")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getReservationsForCast(ss, castName) {
  var sheet = ss.getSheetByName("予約一覧");
  var data  = sheet.getDataRange().getValues();
  var hdrs  = data[0];

  // ヘッダーで列番号を特定
  var col = {};
  for (var i = 0; i < hdrs.length; i++) {
    var h = String(hdrs[i]);
    if (h.indexOf("キャスト") !== -1)    col.cast    = i;
    if (h === "お名前")                  col.name    = i;
    if (h === "ふりがな")                col.kana    = i;
    if (h.indexOf("公演") !== -1)        col.show    = i;
    if (h === "席種")                    col.seat    = i;
    if (h === "枚数")                    col.count   = i;
    if (h === "備考")                    col.note    = i;
    if (h === "予約番号")                col.resNo   = i;
    if (h === "ステータス")              col.status  = i;
    if (h.indexOf("取り置きフラグ") !== -1) col.torioki = i;
  }

  var result = {};
  for (var i=0; i<CONFIG.shows.length; i++) result[CONFIG.shows[i].dt] = [];

  for (var i=1; i<data.length; i++) {
    var row = data[i];
    var castLabel = String(row[col.cast]||"");
    if (castName && castLabel.indexOf(castName) === -1) continue;
    if (String(row[col.status]) === "キャンセル") continue;

    var showDt = String(row[col.show]||"").trim();

    // CONFIG.showsの公演日時と照合（スペース等の揺れを吸収）
    var matchedDt = "";
    for (var si = 0; si < CONFIG.shows.length; si++) {
      var configDt = CONFIG.shows[si].dt;
      // 完全一致 or スペース除去後一致
      if (showDt === configDt ||
          showDt.replace(/\s/g,"") === configDt.replace(/\s/g,"")) {
        matchedDt = configDt;
        break;
      }
    }
    if (!matchedDt) matchedDt = showDt; // 一致しなくてもそのまま使う

    if (result[matchedDt] !== undefined) {
      result[matchedDt].push({
        name:      row[col.name]   || "",
        kana:      row[col.kana]   || "",
        seats:     row[col.count]  || 0,
        status:    row[col.status] || "仮予約済み",
        note:      row[col.note]   || "",
        seatType:  row[col.seat]   || "",
        resNo:     row[col.resNo]  || "",
        castLabel: row[col.cast]   || ""
      });
    }
  }
  return result;
}

function getRemainingLabels(ss) {
  var sheet = ss.getSheetByName("公演マスタ");
  var data = sheet.getDataRange().getValues();
  var labels = {};
  for (var i=1; i<data.length; i++) if (data[i][1]) labels[data[i][1]] = String(data[i][5]||"");
  return labels;
}

// ============================================================
// ============================================================
// 受付表更新（毎日0時 + 手動実行）
// ============================================================
function updateAttendanceSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 全公演の受付表シートを更新
  for (var si=0; si<CONFIG.shows.length; si++) {
    updateSingleAttendanceSheet(ss, CONFIG.shows[si].dt);
  }

  // キャスト別予約サマリーをキャスト設定に反映
  updateCastSummary(ss);

  Logger.log("受付表・キャスト別サマリーを更新しました");
}

// キャスト別の予約数・合計席数をキャスト設定シートに反映
function updateCastSummary(ss) {
  var castSheet    = ss.getSheetByName("キャスト設定");
  var castData     = castSheet.getDataRange().getValues();
  var reservations = ss.getSheetByName("予約一覧").getDataRange().getValues();

  for (var i = 1; i < castData.length; i++) {
    var castName  = castData[i][0];
    var groupName = castData[i][1];
    if (!castName || !groupName) continue;

    var castLabel  = castName + " 【" + groupName + "】";
    var totalCount = 0;
    var totalSeats = 0;

    // ヘッダーで列を特定
    var hdrs = reservations[0];
    var castCol = 1, statusCol2 = 10, countCol = 7; // K列=ステータス(10), H列=枚数(7)
    for (var ci = 0; ci < hdrs.length; ci++) {
      var h = String(hdrs[ci]);
      if (h.indexOf("キャスト") !== -1) castCol   = ci;
      if (h === "ステータス")           statusCol2 = ci;
      if (h === "枚数")                 countCol   = ci;
    }
    for (var j = 1; j < reservations.length; j++) {
      var r = reservations[j];
      if (String(r[castCol]) !== castLabel) continue;
      if (String(r[statusCol2]) === "キャンセル") continue;
      totalCount++;
      totalSeats += Number(r[countCol]) || 0;
    }

    castSheet.getRange(i+1, 6).setValue(totalCount);
    castSheet.getRange(i+1, 7).setValue(totalSeats);
  }
}


// ============================================================
// 取り置き予約追加
// ============================================================
function addTorioki(castLabel, guestName, guestKana, showDt, seats, seatType, note) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("予約一覧");

  // タイムスタンプ列（A列）を基準に実際のデータ最終行を取得
  // チェックボックスのみの空行を除外する
  var allData = sheet.getDataRange().getValues();
  var lastDataRow = 1; // ヘッダー行
  // ヘッダーでタイムスタンプ列・予約番号列を特定
  var hdrsCheck = allData[0];
  var tsIdxC = 0, resNoIdxC = 9;
  for (var hi = 0; hi < hdrsCheck.length; hi++) {
    if (String(hdrsCheck[hi]) === "タイムスタンプ") tsIdxC = hi;
    if (String(hdrsCheck[hi]) === "予約番号")      resNoIdxC = hi;
  }
  for (var ri = 1; ri < allData.length; ri++) {
    if (allData[ri][tsIdxC] || allData[ri][resNoIdxC]) {
      lastDataRow = ri + 1;
    }
  }
  var lastRow = lastDataRow + 1; // 新規行
  var reservationNo = generateReservationNo("T");
  // ヘッダーで列番号を特定して正しく書き込む
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colMap = {};
  for (var ci = 0; ci < headers.length; ci++) {
    var h = String(headers[ci]);
    if (h === "タイムスタンプ")      colMap.ts       = ci + 1;
    if (h.indexOf("キャスト") !== -1) colMap.cast     = ci + 1;
    if (h === "お名前")              colMap.name     = ci + 1;
    if (h === "ふりがな")            colMap.kana     = ci + 1;
    if (h === "メールアドレス")       colMap.mail     = ci + 1;
    if (h.indexOf("公演") !== -1)    colMap.show     = ci + 1;
    if (h === "席種")                colMap.seat     = ci + 1;
    if (h === "枚数")                colMap.count    = ci + 1;
    if (h === "備考")                colMap.note     = ci + 1;
    if (h === "予約番号")            colMap.resNo    = ci + 1;
    if (h === "ステータス")          colMap.status   = ci + 1;
    if (h.indexOf("取り置き") !== -1) colMap.torioki  = ci + 1;
    if (h === "決済方法")            colMap.payment  = ci + 1;
  }
  if (colMap.ts)      sheet.getRange(lastRow, colMap.ts).setValue(new Date());
  if (colMap.cast)    sheet.getRange(lastRow, colMap.cast).setValue(castLabel);
  if (colMap.name)    sheet.getRange(lastRow, colMap.name).setValue(guestName);
  if (colMap.kana)    sheet.getRange(lastRow, colMap.kana).setValue(guestKana);
  if (colMap.show)    sheet.getRange(lastRow, colMap.show).setValue(showDt);
  if (colMap.seat)    sheet.getRange(lastRow, colMap.seat).setValue(seatType || "自由席");
  if (colMap.count)   sheet.getRange(lastRow, colMap.count).setValue(seats);
  if (colMap.note)    sheet.getRange(lastRow, colMap.note).setValue(note || "");
  if (colMap.resNo)   sheet.getRange(lastRow, colMap.resNo).setValue(reservationNo);
  if (colMap.status)  sheet.getRange(lastRow, colMap.status).setValue("本予約済み");
  if (colMap.torioki) sheet.getRange(lastRow, colMap.torioki).setValue("取り置き");

  // キャンセル列にチェックボックスを設定
  var cancelColIdx = -1;
  for (var ci = 0; ci < headers.length; ci++) {
    if (String(headers[ci]) === "キャンセル") { cancelColIdx = ci + 1; break; }
  }
  if (cancelColIdx > 0) sheet.getRange(lastRow, cancelColIdx).insertCheckboxes().setValue(false);

  // 全通券の場合は全公演に展開
  if (seatType === "全通券") {
    for (var i=0; i<CONFIG.shows.length; i++) {
      if (CONFIG.shows[i].dt === showDt) continue;
      var nr = sheet.getLastRow() + 1;
      var nrHdrs = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
      var nrCm = {};
      for (var ci=0; ci<nrHdrs.length; ci++) {
        var h = String(nrHdrs[ci]);
        if (h==="タイムスタンプ") nrCm.ts=ci+1;
        if (h.indexOf("キャスト")!==-1) nrCm.cast=ci+1;
        if (h==="お名前") nrCm.name=ci+1;
        if (h==="ふりがな") nrCm.kana=ci+1;
        if (h.indexOf("公演")!==-1) nrCm.show=ci+1;
        if (h==="席種") nrCm.seat=ci+1;
        if (h==="枚数") nrCm.count=ci+1;
        if (h==="備考") nrCm.note=ci+1;
        if (h==="予約番号") nrCm.resNo=ci+1;
        if (h==="ステータス") nrCm.status=ci+1;
        if (h.indexOf("取り置き")!==-1) nrCm.torioki=ci+1;
      }
      if (nrCm.ts)      sheet.getRange(nr, nrCm.ts).setValue(new Date());
      if (nrCm.cast)    sheet.getRange(nr, nrCm.cast).setValue(castLabel);
      if (nrCm.name)    sheet.getRange(nr, nrCm.name).setValue(guestName);
      if (nrCm.kana)    sheet.getRange(nr, nrCm.kana).setValue(guestKana);
      if (nrCm.show)    sheet.getRange(nr, nrCm.show).setValue(CONFIG.shows[i].dt);
      if (nrCm.seat)    sheet.getRange(nr, nrCm.seat).setValue("全通券(S席)");
      if (nrCm.count)   sheet.getRange(nr, nrCm.count).setValue(seats);
      if (nrCm.note)    sheet.getRange(nr, nrCm.note).setValue(note||"");
      if (nrCm.resNo)   sheet.getRange(nr, nrCm.resNo).setValue(reservationNo+"-"+(i+1));
      if (nrCm.status)  sheet.getRange(nr, nrCm.status).setValue("受付済み");
      if (nrCm.torioki) sheet.getRange(nr, nrCm.torioki).setValue("全通券");
    }
    // 全通券は全公演の受付表を更新
    for (var i=0; i<CONFIG.shows.length; i++) {
      try { updateSingleAttendanceSheet(ss, CONFIG.shows[i].dt); } catch(err) {}
    }
  } else {
    // 該当公演の受付表を即時更新
    if (showDt) {
      try { updateSingleAttendanceSheet(ss, showDt); } catch(err) {}
    }
  }

  // 残席も更新
  try { updateRemainingSeats(); } catch(err) {}

  return reservationNo;
}


// ============================================================
// 売上ログのヘッダーを修正する（1回だけ実行）
// ============================================================
function fixSalesLogHeader() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("売上ログ");

  // ヘッダーを正しい8列に上書き
  var headers = ["タイムスタンプ","商品ID","商品名","単価","数量","小計","決済方法","会計ID"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader(sheet.getRange(1, 1, 1, headers.length));

  // B列（公演日時）以降のデータがずれている場合は列を削除
  // まず現在のデータ構造を確認
  var data = sheet.getDataRange().getValues();
  Logger.log("現在のヘッダー: " + JSON.stringify(data[0]));
  Logger.log("行数: " + data.length);

  // B列が「公演日時」になっている場合はB列を削除してデータを詰める
  if (data[0][1] === "公演日時" || data.length > 1 && data[1][1] && !isNaN(data[1][1])) {
    Logger.log("B列（公演日時）を削除します");
    sheet.deleteColumn(2);
    Logger.log("削除完了");
  }

  Logger.log("✅ 売上ログヘッダー修正完了");
}

// ============================================================
// レジシステム用関数
// ============================================================

var RECEIPT_FOLDER_ID = "1NjVLt2GiFCAzATHvCR4c8CUiH7dgffmB";

// レジ画面を表示
function doGetRegister(e) {
  return HtmlService.createHtmlOutputFromFile("register")
    .setTitle("天狼祭2026 レジ")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// レジ画面用データ取得
function getRegisterData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 物販マスタから商品一覧取得（4行目がヘッダー、5行目以降がデータ）
  var goodsSheet = ss.getSheetByName("物販マスタ");
  var goodsData  = goodsSheet.getDataRange().getValues();
  var goods = [];
  Logger.log("物販マスタ行数: " + goodsData.length);
  for (var i = 4; i < goodsData.length; i++) {
    var row = goodsData[i];
    Logger.log("行" + (i+1) + ": " + JSON.stringify(row));
    if (!row[0] || !row[1] || !row[2]) continue;
    var rawPrice = row[2];
    // 書式付きの場合は数値に変換
    var price = typeof rawPrice === "number" ? rawPrice : Number(String(rawPrice).replace(/[¥,]/g, ""));
    if (isNaN(price) || price <= 0) continue;
    goods.push({ id: String(row[0]), name: String(row[1]), price: price });
  }
  Logger.log("goods: " + JSON.stringify(goods));

  // 公演マスタから公演一覧取得
  var masterSheet = ss.getSheetByName("公演マスタ");
  var masterData  = masterSheet.getDataRange().getValues();
  var shows = [];
  var inShowSection = false;
  for (var i = 0; i < masterData.length; i++) {
    var cell = String(masterData[i][0] || "");
    if (cell.indexOf("公演一覧") !== -1) { inShowSection = true; continue; }
    if (inShowSection && masterData[i][1]) {
      shows.push(String(masterData[i][1]));
    }
  }

  return { goods: goods, shows: shows };
}

// 会計処理
function processCheckout(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date();
  var dateStr = Utilities.formatDate(now, "Asia/Tokyo", "yyyy/MM/dd");
  var timeStr = Utilities.formatDate(now, "Asia/Tokyo", "HH:mm:ss");

  function yen(n) { return "\xa5" + Number(n).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  // ① 売上ログに記録
  try {
    var logSheet = ss.getSheetByName("売上ログ");
    if (!logSheet) return { success: false, error: "売上ログシートが見つかりません" };
    for (var i = 0; i < payload.cart.length; i++) {
      var item = payload.cart[i];
      var lastRow = logSheet.getLastRow() + 1;
      logSheet.getRange(lastRow, 1, 1, 8).setValues([[
        now, item.id, item.name, item.price,
        item.qty, item.price * item.qty,
        payload.payment === "cash" ? "現金" : "クレカ",
        payload.customerId
      ]]);
    }
  } catch(e) {
    return { success: false, error: "売上ログ記録エラー: " + e.message };
  }

  // ② レシートシートに書き込み
  try {
    var receiptSheet = ss.getSheetByName("レシート");
    if (!receiptSheet) return { success: false, error: "レシートシートが見つかりません" };
    receiptSheet.clearContents();
    receiptSheet.getRange("A1").setValue(CONFIG.title);
    receiptSheet.getRange("A2").setValue(CONFIG.venue);
    receiptSheet.getRange("A3").setValue("──────────────────");
    receiptSheet.getRange("A4").setValue("ID : " + payload.customerId);
    receiptSheet.getRange("A5").setValue("日時：" + dateStr + " " + timeStr);
    receiptSheet.getRange("A6").setValue("支払：" + (payload.payment === "cash" ? "現金" : "クレカ"));
    receiptSheet.getRange("A7").setValue("──────────────────");

    var row = 8;
    for (var i = 0; i < payload.cart.length; i++) {
      var item = payload.cart[i];
      receiptSheet.getRange(row, 1).setValue(item.name);
      receiptSheet.getRange(row, 2).setValue("x" + item.qty);
      receiptSheet.getRange(row, 3).setValue(yen(item.price * item.qty));
      row++;
    }

    receiptSheet.getRange(row,   1).setValue("──────────────────");
    receiptSheet.getRange(row+1, 1).setValue("税抜");
    receiptSheet.getRange(row+1, 3).setValue(yen(payload.taxEx));
    receiptSheet.getRange(row+2, 1).setValue("消費税(10%)");
    receiptSheet.getRange(row+2, 3).setValue(yen(payload.tax));
    receiptSheet.getRange(row+3, 1).setValue("合計");
    receiptSheet.getRange(row+3, 3).setValue(yen(payload.total));

    if (payload.payment === "cash") {
      receiptSheet.getRange(row+4, 1).setValue("お預かり");
      receiptSheet.getRange(row+4, 3).setValue(yen(payload.received));
      receiptSheet.getRange(row+5, 1).setValue("おつり");
      receiptSheet.getRange(row+5, 3).setValue(yen(payload.change));
    }
    receiptSheet.getRange(row+6, 1).setValue("ありがとうございました");
  } catch(e) {
    return { success: false, error: "レシート書き込みエラー: " + e.message };
  }

  // ③ PDFをGoogleDriveに保存
  if (payload.saveReceipt) {
    try {
      saveReceiptPDF(ss, payload.customerId, dateStr);
    } catch(e) {
      Logger.log("PDF保存エラー: " + e.message);
      return { success: true, warning: "PDF保存失敗: " + e.message };
    }
  }

  return { success: true };
}

// レシートPDFをDriveに保存
function saveReceiptPDF(ss, customerId, dateStr) {
  var ssId = ss.getId();
  var receiptSheet = ss.getSheetByName("レシート");
  var sheetId = receiptSheet.getSheetId();

  var url = "https://docs.google.com/spreadsheets/d/" + ssId +
    "/export?format=pdf" +
    "&gid=" + sheetId +
    "&size=A4" +
    "&portrait=true" +
    "&fitw=true" +
    "&sheetnames=false" +
    "&printtitle=false" +
    "&pagenumbers=false" +
    "&gridlines=false" +
    "&fzr=false";

  var token = ScriptApp.getOAuthToken();
  var response = UrlFetchApp.fetch(url, {
    headers: { "Authorization": "Bearer " + token }
  });

  var folder = DriveApp.getFolderById(RECEIPT_FOLDER_ID);
  var fileName = "レシート_" + dateStr.replace(/\//g,"-") + "_" + customerId + ".pdf";
  folder.createFile(response.getBlob().setName(fileName));
}

// ============================================================
// 操作パネルにレジURLボタンを追加（1回だけ実行）
// ============================================================
function addRegisterButton() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("操作パネル");

  var webAppUrl = ScriptApp.getService().getUrl();
  var registerUrl = webAppUrl + "?page=register";

  // レジURLを記載
  sheet.getRange("A10").setValue("🖥 レジシステム").setFontWeight("bold").setFontSize(13);
  sheet.getRange("A11").setValue("レジURL（クリックで開く）").setFontColor("#6B6B67");

  var urlCell = sheet.getRange("A12");
  urlCell.setValue(registerUrl);
  urlCell.setFontColor("#185FA5");

  // ハイパーリンクとして設定
  sheet.getRange("B12").setFormula('=HYPERLINK("' + registerUrl + '","🖥 レジを開く")');
  sheet.getRange("B12").setFontSize(13).setFontWeight("bold").setFontColor("#185FA5");

  // 予約リストURLも追加
  sheet.getRange("A14").setValue("📋 予約リスト").setFontWeight("bold").setFontSize(13);
  sheet.getRange("A15").setValue("キャスト別予約リスト（?cast=キャスト名 を末尾に追加）").setFontColor("#6B6B67");
  var listCell = sheet.getRange("A16");
  listCell.setValue(webAppUrl);
  listCell.setFontColor("#185FA5");

  sheet.getRange("B16").setFormula('=HYPERLINK("' + webAppUrl + '","📋 予約リストを開く")');
  sheet.getRange("B16").setFontSize(13).setFontWeight("bold").setFontColor("#0F6E56");

  sheet.setColumnWidth(1, 400);
  sheet.setColumnWidth(2, 160);

  Logger.log("✅ 完了！操作パネルシートを確認してください");
  Logger.log("レジURL: " + registerUrl);
}

// ============================================================
// 既存スプシの物販マスタSUMIF関数を修正（1回だけ実行）
// ============================================================
function fixBuhanMasterFormulas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("物販マスタ");
  if (!sheet) { Logger.log("物販マスタシートが見つかりません"); return; }

  var data = sheet.getDataRange().getValues();
  var fixed = 0;

  for (var i = 3; i < data.length; i++) {
    var r = i + 1;
    var id = data[i][0];
    if (!id) {
      // 空行：汎用数式
      sheet.getRange(r, 5).setFormula('=IF(A'+r+'="","",SUMIF(売上ログ!B:B,A'+r+',売上ログ!E:E))');
    } else {
      // データ行：商品ID固定
      sheet.getRange(r, 5).setFormula('=SUMIF(売上ログ!B:B,"' + id + '",売上ログ!E:E)');
      fixed++;
    }
  }
  Logger.log("✅ " + fixed + "件の商品のSUMIF関数を修正しました");
}


// ============================================================
// 残席更新（公演マスタのステータスをフォームに反映）
// ============================================================
function updateRemainingSeats() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var masterSheet = ss.getSheetByName("公演マスタ");
  var data = masterSheet.getDataRange().getValues();

  // 公演一覧の開始行を探す
  var showStartRow = -1;
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).indexOf("公演ID") !== -1) {
      showStartRow = i + 1;
      break;
    }
  }
  if (showStartRow === -1) {
    throw new Error("公演マスタの公演一覧が見つかりません");
  }

  // 予約一覧のヘッダーで列を特定
  var reservationSheet = ss.getSheetByName("予約一覧");
  var reservations = reservationSheet.getDataRange().getValues();
  var resHdrs = reservations[0];
  var resCol = {};
  for (var ci = 0; ci < resHdrs.length; ci++) {
    var h = String(resHdrs[ci]);
    if (h.indexOf("公演") !== -1)    resCol.show   = ci;
    if (h === "ステータス")          resCol.status = ci;
    if (h === "枚数")                resCol.count  = ci;
  }

  var updated = 0;
  for (var i = showStartRow; i < data.length; i++) {
    var showDt = data[i][1];
    if (!showDt) continue;

    var count = 0;
    for (var j = 1; j < reservations.length; j++) {
      var rowShow   = String(reservations[j][resCol.show]   || "").trim();
      var rowStatus = String(reservations[j][resCol.status] || "");
      // スペース揺れを吸収して公演日時を照合
      if ((rowShow === showDt || rowShow.replace(/\s/g,"") === showDt.replace(/\s/g,"")) &&
          rowStatus !== "キャンセル") {
        count += Number(reservations[j][resCol.count]) || 0;
      }
    }

    var cap = Number(data[i][2]) || 0;
    var remaining = cap - count;

    // 公演マスタのD列（予約数）・E列（残席）を更新
    masterSheet.getRange(i + 1, 4).setValue(count);
    masterSheet.getRange(i + 1, 5).setValue(remaining);

    // ステータス更新
    var status = "";
    if (remaining <= 0)  status = "満席";
    else if (remaining <= 10) status = "△ わずか";
    else if (remaining <= 30) status = "○ 少なめ";
    else                      status = "◎ 余裕あり";
    masterSheet.getRange(i + 1, 6).setValue(status);

    updated++;
  }

  return updated + "件の公演の残席を更新しました";
}


// ============================================================
// キャスト別予約表シートを自動作成
// ============================================================
function createCastSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var castSheet = ss.getSheetByName("キャスト設定");
  var castData = castSheet.getDataRange().getValues();
  var webAppUrl = ScriptApp.getService().getUrl();

  var created = 0;
  var skipped = 0;

  for (var i = 1; i < castData.length; i++) {
    var castName  = castData[i][0];
    var groupName = castData[i][1];
    var existingUrl = castData[i][7];

    if (!castName || !groupName) continue;
    if (existingUrl && existingUrl.toString().indexOf("http") !== -1) {
      skipped++;
      continue; // すでにURLがあるキャストはスキップ
    }

    var castLabel = castName + " 【" + groupName + "】";

    // キャスト別スプレッドシートを新規作成
    var newSs = SpreadsheetApp.create(CONFIG.title + "_" + castName + "_予約リスト");
    var newSheet = newSs.getActiveSheet();
    newSheet.setName("予約リスト");

    // ヘッダー設定
    var headers = ["#","お名前","ふりがな","公演日時","枚数","席種","ステータス","備考"];
    newSheet.getRange(1,1,1,headers.length).setValues([headers]);
    styleHeader(newSheet.getRange(1,1,1,headers.length));
    newSheet.setFrozenRows(1);

    // 予約一覧から該当キャストのデータをコピー
    var reservationSheet = ss.getSheetByName("予約一覧");
    var reservations = reservationSheet.getDataRange().getValues();
    var row = 2;
    var num = 1;
    for (var j = 1; j < reservations.length; j++) {
      var r = reservations[j];
      if (String(r[1]) !== castLabel) continue;
      newSheet.getRange(row,1,1,8).setValues([[
        num++, r[2], r[3], r[5], r[6], r[11]||"", r[9]||"受付済み", r[7]||""
      ]]);
      row++;
    }

    // URLをキャスト設定シートに記録
    var castUrl = newSs.getUrl();
    castSheet.getRange(i+1, 8).setValue(castUrl);

    // 個別予約リストURL（GAS Webアプリ）も記録
    var webUrl = webAppUrl + "?cast=" + encodeURIComponent(castName);
    castSheet.getRange(i+1, 8).setValue(webUrl);

    created++;
  }

  return created + "件のキャスト別シートを作成しました（スキップ：" + skipped + "件）";
}

// ============================================================
// 操作パネルを作り込む（1回だけ実行）
// ============================================================
function buildControlPanel() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("操作パネル");
  sheet.clearContents();
  sheet.clearFormats();

  // ===== タイトル =====
  var titleCell = sheet.getRange("A1");
  titleCell.setValue("🐺 " + CONFIG.title + " 操作パネル");
  titleCell.setFontSize(18);
  titleCell.setFontWeight("bold");
  sheet.getRange("A1:G1").merge().setBackground("#1a1a2e").setFontColor("#ffffff");

  // ===== ヘッダー行 =====
  var headerRow = 3;
  var headers = ["実行", "操作名", "説明", "最終実行日時", "ステータス", "メッセージ", ""];
  sheet.getRange(headerRow, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(headerRow, 1, 1, headers.length)
    .setBackground("#2a2845").setFontColor("#ffffff").setFontWeight("bold");

  // ===== 操作一覧 =====
  var ops = [
    {
      func: "updateRemainingSeats",
      name: "残席を更新する",
      desc: "公演マスタの予約数・残席を最新化します"
    },
    {
      func: "sendBookingEmails",
      name: "本予約メールを下書き作成",
      desc: "仮予約済みのお客様に本予約確認メールの下書きを作成します"
    },
    {
      func: "updateCastSheets",
      name: "キャスト別シートを更新",
      desc: "各キャストの予約リストを最新化します"
    },
    {
      func: "sendDailyLineNotification",
      name: "LINE通知を今すぐ送信",
      desc: "当日の予約をLINEでキャストに通知します"
    },
    {
      func: "updateAttendanceSheets",
      name: "受付表を更新する",
      desc: "各公演の受付表シートを最新化します"
    },
    {
      func: "sortAllAttendanceByResNo",
      name: "受付表を予約番号順に並べる",
      desc: "全公演の受付表を予約番号（R-001）の昇順に並び替えます"
    },
    {
      func: "sortAllAttendanceByKana",
      name: "受付表をふりがな順に並べる",
      desc: "全公演の受付表をふりがなのあいうえお順に並び替えます"
    },
    {
      func: "createCastSheets",
      name: "キャスト別シートを作成",
      desc: "個別URLが未設定のキャストの予約表シートを自動作成します"
    }
  ];

  for (var i = 0; i < ops.length; i++) {
    var row = headerRow + 1 + i;
    var op = ops[i];

    // チェックボックス
    sheet.getRange(row, 1).insertCheckboxes().setValue(false);

    // 操作名
    var nameCell = sheet.getRange(row, 2);
    nameCell.setValue(op.name);
    nameCell.setFontWeight("bold");

    // 説明
    sheet.getRange(row, 3).setValue(op.desc).setFontColor("#6B6B67");

    // 最終実行日時（空欄）
    sheet.getRange(row, 4).setValue("—").setFontColor("#9B9B97").setHorizontalAlignment("center");

    // ステータス（空欄）
    sheet.getRange(row, 5).setValue("待機中").setFontColor("#9B9B97").setHorizontalAlignment("center");

    // メッセージ（空欄）
    sheet.getRange(row, 6).setValue("").setFontColor("#6B6B67");

    // 行の背景色（交互）
    if (i % 2 === 0) {
      sheet.getRange(row, 1, 1, 6).setBackground("#F7F6F3");
    } else {
      sheet.getRange(row, 1, 1, 6).setBackground("#FFFFFF");
    }
  }

  // ===== リンクセクション =====
  var linkRow = headerRow + ops.length + 2;
  var webAppUrl = ScriptApp.getService().getUrl();
  var registerUrl = webAppUrl + "?page=register";

  var linkTitle = sheet.getRange(linkRow, 1);
  linkTitle.setValue("🔗 リンク");
  linkTitle.setFontSize(13);
  linkTitle.setFontWeight("bold");
  sheet.getRange(linkRow, 1, 1, 6).merge().setBackground("#1a1a2e").setFontColor("#ffffff");

  sheet.getRange(linkRow+1, 1).setValue("🖥 レジシステム").setFontWeight("bold");
  sheet.getRange(linkRow+1, 2).setFormula('=HYPERLINK("' + registerUrl + '","レジを開く →")');
  sheet.getRange(linkRow+1, 2).setFontColor("#185FA5");
  sheet.getRange(linkRow+1, 3).setValue(registerUrl).setFontColor("#9B9B97");

  sheet.getRange(linkRow+2, 1).setValue("📋 予約リスト").setFontWeight("bold");
  sheet.getRange(linkRow+2, 2).setFormula('=HYPERLINK("' + webAppUrl + '","予約リストを開く →")');
  sheet.getRange(linkRow+2, 2).setFontColor("#185FA5");
  sheet.getRange(linkRow+2, 3).setValue(webAppUrl + "?cast=キャスト名").setFontColor("#9B9B97");

  var checkinUrl = webAppUrl + "?page=checkin";
  sheet.getRange(linkRow+3, 1).setValue("📱 受付アプリ").setFontWeight("bold");
  sheet.getRange(linkRow+3, 2).setFormula('=HYPERLINK("' + checkinUrl + '","受付アプリを開く →")');
  sheet.getRange(linkRow+3, 2).setFontColor("#0F6E56");
  sheet.getRange(linkRow+3, 3).setValue(checkinUrl).setFontColor("#9B9B97");

  sheet.getRange(linkRow+1, 1, 3, 6).setBackground("#F0F7FC");

  // ===== 列幅 =====
  sheet.setColumnWidth(1, 60);   // チェックボックス
  sheet.setColumnWidth(2, 200);  // 操作名
  sheet.setColumnWidth(3, 280);  // 説明
  sheet.setColumnWidth(4, 150);  // 最終実行日時
  sheet.setColumnWidth(5, 100);  // ステータス
  sheet.setColumnWidth(6, 300);  // メッセージ

  sheet.setFrozenRows(3);

  Logger.log("✅ 操作パネルを作成しました");
}

// チェックボックスのONで対応する関数を実行するトリガー
function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  var row = e.range.getRow();
  var col = e.range.getColumn();

  // 予約一覧のキャンセルチェックボックス処理
  if (sheet.getName() === "予約一覧") {
    // キャンセル列を特定
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var cancelCol = -1;
    var statusCol = -1;
    var castCol   = -1;
    var resNoCol  = -1;
    var nameCol   = -1;
    var showCol   = -1;
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i]);
      if (h === "キャンセル")              cancelCol = i + 1;
      if (h === "ステータス")              statusCol = i + 1;
      if (h.indexOf("キャスト") !== -1)    castCol   = i + 1;
      if (h === "予約番号")                resNoCol  = i + 1;
      if (h === "お名前")                  nameCol   = i + 1;
      if (h.indexOf("公演") !== -1)        showCol   = i + 1;
    }

    if (col === cancelCol && row >= 2 && e.value === "TRUE") {
      // キャンセルチェックをONにした
      if (statusCol > 0) {
        var currentStatus = sheet.getRange(row, statusCol).getValue();
        if (currentStatus !== "キャンセル") {
          sheet.getRange(row, statusCol).setValue("キャンセル");

          // 行全体をグレーアウト
          sheet.getRange(row, 1, 1, sheet.getLastColumn())
            .setBackground("#E0E0E0").setFontColor("#888888");

          // 該当公演の受付表と残席を更新
          var showDt = showCol > 0 ? sheet.getRange(row, showCol).getValue() : "";
          if (showDt) {
            var ss = e.source;
            try { updateSingleAttendanceSheet(ss, showDt); } catch(err) {}
            try { updateRemainingSeats(); } catch(err) {}
          }

          // 担当キャストにキャンセル通知
          var castLabel = castCol > 0 ? sheet.getRange(row, castCol).getValue() : "";
          var guestName = nameCol  > 0 ? sheet.getRange(row, nameCol).getValue()  : "";
          var resNo     = resNoCol > 0 ? sheet.getRange(row, resNoCol).getValue() : "";
          if (castLabel) {
            notifyCancelTocast(castLabel, guestName, resNo, showDt);
          }
        }
      }
    } else if (col === cancelCol && row >= 2 && e.value === "FALSE") {
      // キャンセルチェックをOFFにした（キャンセル取り消し）
      if (statusCol > 0) {
        sheet.getRange(row, statusCol).setValue("仮予約済み");  // キャンセル取り消し→仮予約に戻す
        sheet.getRange(row, 1, 1, sheet.getLastColumn())
          .setBackground(null).setFontColor(null);
        var showDt = showCol > 0 ? sheet.getRange(row, showCol).getValue() : "";
        if (showDt) {
          var ss = e.source;
          try { updateSingleAttendanceSheet(ss, showDt); } catch(err) {}
          try { updateRemainingSeats(); } catch(err) {}
        }
      }
    }
    return;
  }

  // 受付表シートのチェックボックス処理
  if (sheet.getName().indexOf("受付_") === 0) {
    if (row < 5) return;
    // I列(現金=9) or J列(クレカ=10)のみ処理
    if (col !== 9 && col !== 10) return;

    // B列（2列目）に予約番号を格納
    var resNo = String(sheet.getRange(row, 2).getValue() || "").trim();
    if (!resNo) return;

    var reservationSheet = e.source.getSheetByName("予約一覧");
    var resData = reservationSheet.getDataRange().getValues();
    var resHdrs = resData[0];
    var resNoColR = -1, statusColR = -1;
    for (var ci = 0; ci < resHdrs.length; ci++) {
      var h = String(resHdrs[ci]);
      if (h === "予約番号")  resNoColR = ci;
      if (h === "ステータス") statusColR = ci;
    }

    // 予約一覧から予約番号で該当行を検索
    var targetResRow = -1;
    for (var ri = 1; ri < resData.length; ri++) {
      if (String(resData[ri][resNoColR]) === resNo) {
        targetResRow = ri + 1;
        break;
      }
    }
    if (targetResRow === -1 || statusColR === -1) return;

    // 現金(I=9)・クレカ(J=10)両方のチェック状態を確認
    var cashChecked   = sheet.getRange(row, 9).getValue()  === true;
    var creditChecked = sheet.getRange(row, 10).getValue() === true;
    var eitherChecked = cashChecked || creditChecked;

    if (eitherChecked) {
      // どちらかチェックあり → 受付済みに
      reservationSheet.getRange(targetResRow, statusColR+1).setValue("受付済み");
    } else {
      // 両方外れた → 本予約済みに戻す
      var curStatus = reservationSheet.getRange(targetResRow, statusColR+1).getValue();
      if (curStatus === "受付済み") {
        reservationSheet.getRange(targetResRow, statusColR+1).setValue("本予約済み");
      }
    }
    return;
  }

  // 操作パネルのチェックボックス処理
  if (sheet.getName() !== "操作パネル") return;
  if (col !== 1 || row < 4) return;
  if (e.value !== "TRUE") return;

  var ops = [
    "updateRemainingSeats",
    "sendBookingEmails",
    "updateCastSheets",
    "sendDailyLineNotification",
    "updateAttendanceSheets",
    "sortAllAttendanceByResNo",
    "sortAllAttendanceByKana",
    "createCastSheets"
  ];

  var opIndex = row - 4;
  if (opIndex < 0 || opIndex >= ops.length) return;

  var funcName = ops[opIndex];
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");

  // ステータスを「実行中」に更新
  sheet.getRange(row, 4).setValue(now);
  sheet.getRange(row, 5).setValue("⏳ 実行中").setFontColor("#e67e22");
  sheet.getRange(row, 6).setValue("");

  try {
    // 対応する関数を実行
    var result = "";
    if (funcName === "updateRemainingSeats")           { result = updateRemainingSeats(); }
    else if (funcName === "sendBookingEmails")          { result = sendBookingEmails(); }
    else if (funcName === "updateCastSheets")           { updateAttendanceSheets(); result = "キャスト別シートを更新しました"; }
    else if (funcName === "sendDailyLineNotification")  { sendDailyLineNotification(); result = "LINE通知を送信しました"; }
    else if (funcName === "updateAttendanceSheets")     { updateAttendanceSheets(); result = "受付表を更新しました"; }
    else if (funcName === "sortAllAttendanceByResNo")   { sortAllAttendanceByResNo(); result = "受付表を予約番号順に並べました"; }
    else if (funcName === "sortAllAttendanceByKana")    { sortAllAttendanceByKana(); result = "受付表をふりがな順に並べました"; }
    else if (funcName === "createCastSheets")           { result = createCastSheets(); }

    // 成功
    sheet.getRange(row, 5).setValue("✅ 完了").setFontColor("#0F6E56");
    sheet.getRange(row, 6).setValue(result).setFontColor("#0F6E56");

  } catch(e) {
    // エラー
    sheet.getRange(row, 5).setValue("❌ エラー").setFontColor("#A32D2D");
    sheet.getRange(row, 6).setValue(e.message).setFontColor("#A32D2D");
  }

  // チェックボックスを戻す
  sheet.getRange(row, 1).setValue(false);
}

// ============================================================
// キャスト設定のURLを現在のWebアプリURLに一括更新（1回だけ実行）
// ============================================================
function updateCastUrls() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var castSheet = ss.getSheetByName("キャスト設定");
  var castData = castSheet.getDataRange().getValues();
  var webAppUrl = ScriptApp.getService().getUrl();

  var updated = 0;
  for (var i = 1; i < castData.length; i++) {
    var castName = castData[i][0];
    if (!castName) continue;
    var newUrl = webAppUrl + "?cast=" + encodeURIComponent(castName);
    castSheet.getRange(i+1, 8).setValue(newUrl);
    updated++;
  }

  Logger.log("✅ " + updated + "件のURLを更新しました");
  Logger.log("新しいURL例: " + webAppUrl + "?cast=" + encodeURIComponent(castData[1][0]));
}

// ============================================================
// フォームを再作成して正しい列順でスプシに連携（1回だけ実行）
// ============================================================
function recreateForm() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 既存のフォーム連携シートを削除
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (name === "フォームの回答 1" || name === "Form Responses 1" || name === "Form_Responses") {
      ss.deleteSheet(sheets[i]);
      Logger.log("既存の回答シートを削除: " + name);
      break;
    }
  }

  // 既存トリガーを全削除
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  Logger.log("既存トリガーを削除しました");

  // フォームを新規作成
  var form = createForm(ss);
  PropertiesService.getScriptProperties().setProperty("FORM_ID", form.getId());
  Logger.log("新しいフォームを作成: " + form.getPublishedUrl());

  // トリガーを再設定
  setTriggers(form);
  Logger.log("トリガーを再設定しました");

  Logger.log("✅ フォーム再作成完了！");
  Logger.log("新しいフォームURL: " + form.getPublishedUrl());
  Logger.log("編集URL: " + form.getEditUrl());
}

// ============================================================
// キャストへのキャンセル通知
// ============================================================
function notifyCancelTocast(castLabel, guestName, resNo, showDt) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var castSheet = ss.getSheetByName("キャスト設定");
  var castData  = castSheet.getDataRange().getValues();

  // castLabelから名前部分を抽出（「高嶺瀧 【天狼殺陣会】」→「高嶺瀧」）
  var castName = String(castLabel || "").replace(/\s*\u3010[^\u3011]*\u3011/, "").trim();
  Logger.log("notifyCancelTocast: castLabel=" + castLabel + " castName=" + castName);

  var userId = "";
  for (var i = 1; i < castData.length; i++) {
    if (String(castData[i][0]).trim() === castName) {
      userId = String(castData[i][3] || "").trim();
      break;
    }
  }
  Logger.log("notifyCancelTocast: userId=" + userId);
  if (!userId) {
    Logger.log("\u30ad\u30e3\u30b9\u30c8\u306eUserID\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093: " + castName);
    return;
  }

  var msg =
    "\ud83d\uddd1 \u30ad\u30e3\u30f3\u30bb\u30eb\u306e\u304a\u77e5\u3089\u305b\n\n" +
    "\u4ee5\u4e0b\u306e\u4e88\u7d04\u3092\u30ad\u30e3\u30f3\u30bb\u30eb\u3057\u307e\u3057\u305f\u3002\n\n" +
    "\u4e88\u7d04\u756a\u53f7\uff1a" + resNo + "\n" +
    "\u304a\u5ba2\u69d8\u540d\uff1a" + guestName + "\n" +
    "\u516c\u6f14\u65e5\u6642\uff1a" + showDt + "\n\n" +
    "\u3054\u78ba\u8a8d\u304f\u3060\u3055\u3044\u3002";

  sendLineMessage(userId, msg);
}


// ============================================================
// LINEからのキャンセル申請処理
// ============================================================
function processCancelRequest(userId, text, castLabel) {
  // 「キャンセル R0001」の形式で予約番号を取得
  var match = text.match(/[RrTt]-?\d{3,4}/);
  if (!match) {
    return {
      success: false,
      message:
        "❌ 予約番号が見つかりませんでした。\n\n" +
        "以下の形式で送ってください👇\n" +
        "キャンセル R0001"
    };
  }

  var resNo = match[0].toUpperCase();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("予約一覧");
  var data  = sheet.getDataRange().getValues();
  var headers = data[0];

  // ヘッダーで列を特定
  var colMap = {};
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]);
    if (h === "予約番号")                colMap.resNo  = i;
    if (h === "ステータス")              colMap.status = i;
    if (h.indexOf("キャスト") !== -1)    colMap.cast   = i;
    if (h === "お名前")                  colMap.name   = i;
    if (h.indexOf("公演") !== -1)        colMap.show   = i;
    if (h === "キャンセル")              colMap.cancel = i;
  }

  // 予約番号で行を検索
  var targetRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colMap.resNo]) === resNo) {
      // 自分のキャストの予約かチェック
      var rowCast = String(data[i][colMap.cast] || "");
      var castName = castLabel.replace(/\s*【.+】/, "");
      if (rowCast.indexOf(castName) === -1) {
        return {
          success: false,
          message: "❌ 予約番号 " + resNo + " はあなたの取り扱い予約ではありません。"
        };
      }
      targetRow = i + 1; // 1-indexed
      break;
    }
  }

  if (targetRow === -1) {
    return {
      success: false,
      message: "❌ 予約番号 " + resNo + " が見つかりませんでした。\n予約番号を確認してください。"
    };
  }

  // ステータスをキャンセル申請に変更
  if (colMap.status >= 0) sheet.getRange(targetRow, colMap.status + 1).setValue("キャンセル申請");
  if (colMap.cancel >= 0) sheet.getRange(targetRow, colMap.cancel + 1).setValue(false);

  // 行を黄色でハイライト（申請中）
  sheet.getRange(targetRow, 1, 1, sheet.getLastColumn())
    .setBackground("#FFF9C4").setFontColor("#555");

  var guestName = String(data[targetRow-1][colMap.name] || "");
  var showDt    = String(data[targetRow-1][colMap.show] || "");

  return {
    success: true,
    message:
      "✅ キャンセル申請を受け付けました。\n\n" +
      "予約番号：" + resNo + "\n" +
      "お客様名：" + guestName + "\n" +
      "公演日時：" + showDt + "\n\n" +
      "運営が確認後、正式にキャンセルします。"
  };
}

// ============================================================
// 既存予約一覧のキャンセル列をチェックボックスに変換（1回だけ実行）
// ============================================================
function fixCancelCheckboxes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("予約一覧");
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log("データがありません"); return; }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var cancelCol = -1;
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]) === "キャンセル") { cancelCol = i + 1; break; }
  }
  if (cancelCol === -1) { Logger.log("キャンセル列が見つかりません"); return; }

  // データ行全体にチェックボックスを設定
  var range = sheet.getRange(2, cancelCol, lastRow - 1, 1);
  range.insertCheckboxes();

  // FALSEのままの行は未チェック状態を維持
  // TRUEになっている行はチェック済み状態を維持
  var values = range.getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] !== true) values[i][0] = false;
  }
  range.setValues(values);

  Logger.log("✅ " + (lastRow - 1) + "行のキャンセル列をチェックボックスに変換しました");
}

// ============================================================
// 本予約確認メール送信（仮予約済みの予約に対して送信）
// ============================================================
function sendBookingEmails() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("予約一覧");
  var data  = sheet.getDataRange().getValues();
  var hdrs  = data[0];

  // ヘッダーで列を特定
  var col = {};
  for (var i = 0; i < hdrs.length; i++) {
    var h = String(hdrs[i]);
    if (h === "お名前")                  col.name    = i;
    if (h === "メールアドレス")           col.mail    = i;
    if (h.indexOf("公演") !== -1)        col.show    = i;
    if (h === "席種")                    col.seat    = i;
    if (h === "枚数")                    col.count   = i;
    if (h === "予約番号")                col.resNo   = i;
    if (h === "ステータス")              col.status  = i;
  }

  var sent = 0;
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[col.status]) !== "仮予約済み") continue;
    var mail = String(row[col.mail] || "").trim();
    if (!mail || mail.indexOf("@") === -1) continue;

    var name   = row[col.name]  || "";
    var show   = row[col.show]  || "";
    var seat   = row[col.seat]  || "";
    var count  = row[col.count] || "";
    var resNo  = row[col.resNo] || "";

    var subject = "「" + CONFIG.title + "」本予約確認のご連絡";
    var body =
      name + " 様\n\n" +
      "この度は " + CONFIG.title + " にご予約いただきありがとうございます。\n" +
      "以下の内容で本予約を承りました。\n\n" +
      "━━━━━━━━━━━━━━━━━━━━\n" +
      "予約番号：" + resNo + "\n" +
      "公演日時：" + show  + "\n" +
      "席種　　：" + seat  + "\n" +
      "枚数　　：" + count + "\n" +
      "会場　　：" + CONFIG.venue + "\n" +
      "━━━━━━━━━━━━━━━━━━━━\n\n" +
      "当日は「予約番号」または「お名前」を受付スタッフにお伝えください。\n" +
      "予約番号：" + resNo + "\n\n" +
      "ご不明な点はお気軽にご連絡ください。\n\n" +
      CONFIG.organizer;
    try {
      // 下書きとして保存（送信はしない）
      GmailApp.createDraft(mail, subject, body);
      sheet.getRange(i+1, col.status+1).setValue("本予約済み");
      sent++;
    } catch(err) {
      Logger.log("下書き作成エラー: " + mail + " / " + err.message);
    }
  }
  Logger.log("✅ " + sent + "件の下書きメールを作成し、ステータスを本予約済みに更新しました");
  return sent + "件の下書きメールを作成しました";
}

// ============================================================
// SETUP3：既存データを壊さずシートのヘッダー・書式を更新
// ============================================================
function setup_3_reservationSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 予約一覧のヘッダーを更新（データ行は保持）
  var sheet = ss.getSheetByName("予約一覧");
  if (sheet) {
    var headers = [
      "タイムスタンプ","取り扱いキャスト","お名前","ふりがな",
      "メールアドレス","公演日時","席種","枚数","備考",
      "予約番号","ステータス","取り置きフラグ","決済方法","キャンセル"
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    styleHeader(sheet.getRange(1, 1, 1, headers.length));

    // タイムスタンプか予約番号がある行だけをデータ行とみなす
    var allData = sheet.getDataRange().getValues();
    var cancelCol = headers.indexOf("キャンセル") + 1;
    var dataRows = [];
    // ヘッダーで予約番号列とタイムスタンプ列を特定
    var hdrsForCheck = allData[0];
    var tsIdx = 0, resNoIdx = 9; // デフォルト
    for (var hi = 0; hi < hdrsForCheck.length; hi++) {
      if (String(hdrsForCheck[hi]) === "タイムスタンプ") tsIdx = hi;
      if (String(hdrsForCheck[hi]) === "予約番号")      resNoIdx = hi;
    }
    for (var ri = 1; ri < allData.length; ri++) {
      if (allData[ri][tsIdx] || allData[ri][resNoIdx]) {
        dataRows.push(ri + 1); // 1-indexed行番号
      }
    }

    // チェックボックスをデータ行にのみ設定
    for (var di = 0; di < dataRows.length; di++) {
      var cell = sheet.getRange(dataRows[di], cancelCol);
      var val  = cell.getValue();
      cell.insertCheckboxes();
      if (val === true) cell.setValue(true);
    }

    // 空行のチェックボックスを削除（クリア）
    var totalRows = sheet.getLastRow();
    for (var ri = 2; ri <= totalRows; ri++) {
      var tsVal  = sheet.getRange(ri, 1).getValue();
      var resVal = sheet.getRange(ri, 10).getValue();
      if (!tsVal && !resVal) {
        sheet.getRange(ri, cancelCol).clearContent().clearDataValidations();
      }
    }
    Logger.log("✅ 予約一覧ヘッダーを更新しました（データ行: " + dataRows.length + "件）");
  }

  // 全受付表シートのチェックボックスを更新
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (name.indexOf("受付_") === 0) {
      var s = sheets[i];
      var lr = s.getLastRow();
      if (lr >= 5) {
        s.getRange(5, 8, lr-4, 1).insertCheckboxes();  // H列：現金
        s.getRange(5, 9, lr-4, 1).insertCheckboxes();  // I列：クレカ
        // J列（予約番号）の幅を1にして非表示化
        s.setColumnWidth(10, 1);
      }
      Logger.log("✅ " + name + " のチェックボックスを更新しました");
    }
  }

  // 全受付表を最新データで更新
  for (var i = 0; i < CONFIG.shows.length; i++) {
    try {
      updateSingleAttendanceSheet(ss, CONFIG.shows[i].dt);
      Logger.log("✅ 受付表更新: " + CONFIG.shows[i].dt);
    } catch(err) {
      Logger.log("受付表更新エラー: " + CONFIG.shows[i].dt + " / " + err.message);
    }
  }

  Logger.log("✅ SETUP3 完了：既存データを保持したまま書式・受付表を更新しました");
  Logger.log("次は setup_4_triggers() を実行してください。");
}

// ============================================================
// 固定予約番号を生成（通し連番、行移動・削除しても変わらない）
// 例）R-001, R-002 / T-001, T-002
// ============================================================
function generateReservationNo(prefix) {
  var props   = PropertiesService.getScriptProperties();
  var key     = "resNo_" + prefix;
  var counter = parseInt(props.getProperty(key) || "0") + 1;
  props.setProperty(key, String(counter));

  var pad3 = function(n){ var s=String(n); while(s.length<3) s="0"+s; return s; };
  return prefix + "-" + pad3(counter);
  // 例）R-001, R-002, T-001
}

// ============================================================
// 受付表の検索機能（予約番号 or お名前で検索）
// ============================================================
function searchAttendance(showDt, query) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "受付_" + showDt.replace(/[\/:() ]/g,"").replace(/\u3000/g,"");
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 5) return;

  var data = sheet.getRange(5, 1, lastRow-4, 11).getValues();
  query = String(query || "").trim().toLowerCase();

  // 全行を表示
  if (!query) {
    sheet.showRows(5, lastRow-4);
    return;
  }

  // 検索：B列(予約番号) or C列(お名前) or D列(ふりがな)
  for (var i = 0; i < data.length; i++) {
    var resNo  = String(data[i][1] || "").toLowerCase();
    var name   = String(data[i][2] || "").toLowerCase();
    var kana   = String(data[i][3] || "").toLowerCase();
    var matched = resNo.indexOf(query) !== -1 || name.indexOf(query) !== -1 || kana.indexOf(query) !== -1;
    if (matched) {
      sheet.showRows(i + 5);
    } else {
      sheet.hideRows(i + 5);
    }
  }
}

// 受付表を予約番号順にソート（デフォルト）
function sortAttendanceByResNo(showDt) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "受付_" + showDt.replace(/[\/:() ]/g,"").replace(/\u3000/g,"");
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 6) return;

  // 5行目以降をB列(予約番号)で昇順ソート
  var range = sheet.getRange(5, 1, lastRow-4, 11);
  range.sort({column: 2, ascending: true});

  // 番号を振り直す
  for (var i = 0; i < lastRow-4; i++) {
    sheet.getRange(5+i, 1).setValue(i+1);
  }
  Logger.log("✅ 予約番号順にソートしました: " + sheetName);
}

// 受付表をふりがな順にソート
function sortAttendanceByKana(showDt) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "受付_" + showDt.replace(/[\/:() ]/g,"").replace(/\u3000/g,"");
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 6) return;

  // D列(ふりがな)で昇順ソート
  var range = sheet.getRange(5, 1, lastRow-4, 11);
  range.sort({column: 4, ascending: true});

  // 番号を振り直す
  for (var i = 0; i < lastRow-4; i++) {
    sheet.getRange(5+i, 1).setValue(i+1);
  }
  Logger.log("✅ ふりがな順にソートしました: " + sheetName);
}

// 全公演の受付表を予約番号順にソート（一括）
function sortAllAttendanceByResNo() {
  for (var i = 0; i < CONFIG.shows.length; i++) {
    sortAttendanceByResNo(CONFIG.shows[i].dt);
  }
  Logger.log("✅ 全公演の受付表を予約番号順にソートしました");
}

// 全公演の受付表をふりがな順にソート（一括）
function sortAllAttendanceByKana() {
  for (var i = 0; i < CONFIG.shows.length; i++) {
    sortAttendanceByKana(CONFIG.shows[i].dt);
  }
  Logger.log("✅ 全公演の受付表をふりがな順にソートしました");
}

// ============================================================
// 受付アプリ用関数
// ============================================================

// 公演一覧と予約件数を取得
function getCheckinData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var resSheet = ss.getSheetByName("予約一覧");
  var resData  = resSheet.getDataRange().getValues();
  var resHdrs  = resData[0];

  // ヘッダーで列を特定
  var col = {};
  for (var i = 0; i < resHdrs.length; i++) {
    var h = String(resHdrs[i]);
    if (h.indexOf("公演") !== -1)   col.show   = i;
    if (h === "ステータス")          col.status = i;
  }

  // 公演ごとの予約数を集計
  var countByShow = {};
  for (var i = 1; i < resData.length; i++) {
    var showDt = String(resData[i][col.show] || "").trim();
    var status = String(resData[i][col.status] || "");
    if (!showDt || status === "キャンセル") continue;
    countByShow[showDt] = (countByShow[showDt] || 0) + 1;
  }

  var shows = CONFIG.shows.map(function(s) {
    return {
      dt:       s.dt,
      cap:      s.cap,
      reserved: countByShow[s.dt] || 0
    };
  });

  return { shows: shows };
}

// 特定公演の予約一覧を取得（受付アプリ用）
function getReservationsForCheckin(showDt) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("予約一覧");
  var data  = sheet.getDataRange().getValues();
  var hdrs  = data[0];

  // ヘッダーで列を特定
  var col = {};
  for (var i = 0; i < hdrs.length; i++) {
    var h = String(hdrs[i]);
    if (h.indexOf("キャスト") !== -1)    col.cast    = i;
    if (h === "お名前")                  col.name    = i;
    if (h === "ふりがな")                col.kana    = i;
    if (h.indexOf("公演") !== -1)        col.show    = i;
    if (h === "席種")                    col.seat    = i;
    if (h === "枚数")                    col.count   = i;
    if (h === "備考")                    col.note    = i;
    if (h === "予約番号")                col.resNo   = i;
    if (h === "ステータス")              col.status  = i;
    if (h === "決済方法")                col.payment = i;
  }

  var reservations = [];
  for (var i = 1; i < data.length; i++) {
    var row    = data[i];
    var rowDt  = String(row[col.show] || "").trim();
    // スペース揺れを吸収
    if (rowDt !== showDt && rowDt.replace(/\s/g,"") !== showDt.replace(/\s/g,"")) continue;

    var status = String(row[col.status] || "仮予約済み");
    var resNo  = String(row[col.resNo]  || "");
    if (!resNo) continue;

    // 決済方法からpayMethodを推定
    var payMethod = null;
    var payment = String(row[col.payment] || "");
    if (status === "受付済み") {
      payMethod = payment.indexOf("クレカ") !== -1 ? "credit" : "cash";
    }

    reservations.push({
      resNo:    resNo,
      name:     row[col.name]   || "",
      kana:     row[col.kana]   || "",
      cast:     String(row[col.cast] || "").replace(/\s*【[^】]*】/, ""),
      seats:    row[col.count]  || 0,
      seatType: row[col.seat]   || "",
      note:     row[col.note]   || "",
      status:   status,
      payMethod: payMethod
    });
  }

  // 予約番号順にソート
  reservations.sort(function(a,b){ return String(a.resNo).localeCompare(String(b.resNo), "ja"); });

  return { reservations: reservations };
}

// 受付処理（受付アプリから呼び出し）
function processCheckin(resNo, payMethod, showDt) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("予約一覧");
    var data  = sheet.getDataRange().getValues();
    var hdrs  = data[0];

    // ヘッダーで列を特定
    var col = {};
    for (var i = 0; i < hdrs.length; i++) {
      var h = String(hdrs[i]);
      if (h === "予約番号") col.resNo   = i;
      if (h === "ステータス") col.status = i;
      if (h === "決済方法")   col.payment = i;
    }

    // 予約番号で行を検索
    var targetRow = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][col.resNo]) === String(resNo)) {
        targetRow = i + 1;
        break;
      }
    }
    if (targetRow === -1) return { success: false, error: "予約番号が見つかりません: " + resNo };

    // ステータスと決済方法を更新
    sheet.getRange(targetRow, col.status  + 1).setValue("受付済み");
    sheet.getRange(targetRow, col.payment + 1).setValue(payMethod === "cash" ? "現金" : "クレカ");

    // 受付表シートのチェックボックスも更新
    updateAttendanceCheckin(ss, showDt, resNo, payMethod);

    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// 受付取り消し（受付アプリから呼び出し）
function undoCheckin(resNo, showDt) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("予約一覧");
    var data  = sheet.getDataRange().getValues();
    var hdrs  = data[0];

    var col = {};
    for (var i = 0; i < hdrs.length; i++) {
      var h = String(hdrs[i]);
      if (h === "予約番号")  col.resNo   = i;
      if (h === "ステータス") col.status  = i;
      if (h === "決済方法")   col.payment = i;
    }

    var targetRow = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][col.resNo]) === String(resNo)) {
        targetRow = i + 1;
        break;
      }
    }
    if (targetRow === -1) return { success: false, error: "予約番号が見つかりません" };

    sheet.getRange(targetRow, col.status  + 1).setValue("本予約済み");
    sheet.getRange(targetRow, col.payment + 1).setValue("");

    // 受付表シートのチェックボックスをOFF
    updateAttendanceCheckin(ss, showDt, resNo, null);

    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// 受付表シートのチェックボックスを受付アプリと同期
function updateAttendanceCheckin(ss, showDt, resNo, payMethod) {
  if (!showDt) return;
  var sheetName = "受付_" + showDt.replace(/[\/:() ]/g,"").replace(/\u3000/g,"");
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 5) return;

  // B列（予約番号）で行を検索
  var data = sheet.getRange(5, 1, lastRow-4, 11).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][1]) === String(resNo)) {
      var row = i + 5;
      if (payMethod === "cash") {
        sheet.getRange(row, 9).setValue(true);   // I列:現金ON
        sheet.getRange(row, 10).setValue(false);  // J列:クレカOFF
      } else if (payMethod === "credit") {
        sheet.getRange(row, 9).setValue(false);  // I列:現金OFF
        sheet.getRange(row, 10).setValue(true);  // J列:クレカON
      } else {
        // 取り消し
        sheet.getRange(row, 9).setValue(false);
        sheet.getRange(row, 10).setValue(false);
      }
      // 行の背景色を更新
      var bg = payMethod ? "#E8F5E9" : "#E3F2FD";
      sheet.getRange(row, 1, 1, 11).setBackground(bg);
      break;
    }
  }
}
