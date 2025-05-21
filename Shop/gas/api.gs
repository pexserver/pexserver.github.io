// シート操作のためのユーティリティクラス
class SheetManager {
  constructor(spreadsheet) {
    this.spreadsheet = spreadsheet;
  }

  // シートの取得（存在しない場合は作成）
  getOrCreateSheet(sheetName) {
    let sheet = this.spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = this.spreadsheet.insertSheet(sheetName);
      // ヘッダーの設定
      sheet.getRange(1, 1, 1, 3).setValues([['id', 'type', 'data']]);
    }
  return sheet;
  }
}
  
// URLエンコード形式のデータをパース
function parseUrlEncoded_(encodedString) {
  const params = {};
  if (!encodedString) return params;
  try {
    const pairs = encodedString.split('&');
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i].split('=');
      if (pair.length >= 1) {
        const key = decodeURIComponent(pair[0].replace(/\+/g, ' '));
        const value = pair.length === 2 ? decodeURIComponent(pair[1].replace(/\+/g, ' ')) : '';
        try {
          // オブジェクトや配列の文字列をパース
          if (value.startsWith('{') || value.startsWith('[')) {
            params[key] = JSON.parse(value);
          } else {
            params[key] = value;
          }
        } catch (e) {
          params[key] = value; // パースに失敗した場合は文字列のまま
        }
      }
    }
  } catch (e) {
    Logger.log(`[ERROR] Failed to parse url encoded string: ${e.message}`);
    throw new Error(`URLエンコードされたデータの解析に失敗しました: ${e.message}`);
  }
  return params;
}

// メイン関数：POSTリクエストを処理
function doPost(e) {
  
  if (e && e.postData && e.postData.type === 'OPTIONS') {
    return ContentService.createTextOutput('')
      .setMimeType(ContentService.MimeType.TEXT)
      
  }

  let params;
  try {
    // JSON形式とURLエンコード形式の両方に対応
    if (e.postData && e.postData.type === 'application/json') {
      params = JSON.parse(e.postData.contents);
    } else {
      params = parseUrlEncoded_(e.postData.contents);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: "POSTデータの解析に失敗しました" 
    }))
      .setMimeType(ContentService.MimeType.JSON)
      
  }

  // actionとtypeの対応を統一
  const type = params.action || params.type;
  let response = { status: 'error', message: '不明なタイプです' };

  try {
    switch (type) {
      case 'findItems':
        response = { status: 'success', data: findItems(params) };
        break;
      case 'insertItem':
        response = { status: 'success', data: insertItem(params) };
        break;
      case 'updateItem':
      case 'updateItemById':
        response = { status: 'success', data: updateItem(params) };
        break;
      case 'deleteItem':
      case 'deleteItemById':
        response = { status: 'success', data: deleteItem(params) };
        break;
      case 'getItemById':
        response = { status: 'success', data: getItemById(params) };
        break;
      case 'verifyPrice':
        response = verifyPrice(params);
        break;
      case 'processPurchase':
        response = processPurchase(params);
        break;
      case 'getBalance':
        response = getBalance(params);
        break;
      case 'saveTransaction':
        response = saveTransaction(params);
        break;
      default:
        response = { 
          status: 'error', 
          message: `不明なタイプです: ${type}` 
        };
    }
  } catch (error) {
    Logger.log(`[ERROR] API Error: ${error.toString()}`);
    response = { 
      status: 'error', 
      message: error.toString() 
    };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    
}

// 価格検証
function verifyPrice(params) {
  const cache = getCache();
  const cacheKey = `price_${params.itemId}`;
  let cachedPrice = cache.get(cacheKey);
  
  if (!cachedPrice) {
    const sheet = getSheet();
    const prices = sheet.getRange('Prices').getValues();
    // プライスデータの検索と検証
    cachedPrice = findPrice(prices, params.itemId);
    cache.put(cacheKey, cachedPrice, 3600); // 1時間キャッシュ
  }
  
  return {
    status: 'success',
    message: 'verified',
    price: parseFloat(cachedPrice),
    isValid: parseFloat(cachedPrice) === parseFloat(params.price)
  };
}

// 購入処理
function processPurchase(params) {
  const cache = getCache();
  const purchaseHash = Utilities.getUuid();
  
  // 購入データの保存
  const sheet = getSheet();
  sheet.appendRow([
    new Date(),
    purchaseHash,
    params.itemId,
    params.price,
    params.userId
  ]);
  
  return {
    status: 'success',
    message: 'purchased',
    hash: purchaseHash
  };
}

// 残高取得
function getBalance(params) {
  const cache = getCache();
  const cacheKey = `balance_${params.userId}`;
  let balance = cache.get(cacheKey);
  
  if (!balance) {
    const sheet = getSheet();
    balance = calculateBalance(sheet, params.userId);
    cache.put(cacheKey, balance, 1800); // 30分キャッシュ
  }
  
  return {
    status: 'success',
    message: 'balance retrieved',
    balance: parseFloat(balance)
  };
}

// トランザクション保存
function saveTransaction(params) {
  const sheet = getSheet();
  sheet.appendRow([
    new Date(),
    params.transactionId,
    params.type,
    params.amount,
    params.userId
  ]);
  
  // キャッシュをクリア
  const cache = getCache();
  cache.remove(`balance_${params.userId}`);
  
  return {
    status: 'success',
    message: 'transaction saved'
  };
}

// キャッシュとスプレッドシートの取得
function getCache() {
  return CacheService.getScriptCache();
}

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ShopData');
}

// ユーティリティ関数
function findPrice(prices, itemId) {
  // プライスの検索ロジック
  return prices.find(row => row[0] === itemId)[1];
}

function calculateBalance(sheet, userId) {
  // 残高計算ロジック
  const transactions = sheet.getRange('Transactions').getValues();
  return transactions
    .filter(row => row[4] === userId)
    .reduce((sum, row) => sum + row[3], 0);
}

// GETリクエストのハンドリング（無効化）
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: 'GETメソッドはサポートされていません。POSTのみ利用してください。'
  }))
    .setMimeType(ContentService.MimeType.JSON)
    
}