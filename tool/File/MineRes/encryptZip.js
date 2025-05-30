// encryptZip.js
// ユーザーがアップロードしたzipを解凍→各ファイルを暗号化（パスワード任意）→再zip化してダウンロード

document.getElementById('downloadBtn').onclick = async function() {
  const fileInput = document.getElementById('zipFile');
  const password = document.getElementById('password').value;
  const status = document.getElementById('status');
  status.textContent = '';
  if (!fileInput.files.length) {
    status.textContent = 'ZIPファイルを選択してください';
    return;
  }
  status.textContent = '処理中...';
  try {
    const file = fileInput.files[0];
    const arrayBuffer = await file.arrayBuffer();
    // ZIP解凍
    const zip = await JSZip.loadAsync(arrayBuffer);
    const newZip = new JSZip();
    const fileNames = Object.keys(zip.files);
    const EXCLUDED_FILES = ["manifest.json", "pack_icon.png", "bug_pack_icon.png"];
    let uuid = null;
    let manifestPrefix = "";
    let contentEntries = [];
    // manifest.jsonからuuid抽出
    for (const name of fileNames) {
      if (name.endsWith("manifest.json")) {
        manifestPrefix = name.slice(0, name.lastIndexOf("manifest.json"));
        const manifestText = await zip.files[name].async("text");
        try {
          uuid = JSON.parse(manifestText).header.uuid;
        } catch {}
      }
    }
    if (!uuid) {
      status.textContent = 'manifest.jsonが見つからないかUUID抽出失敗';
      return;
    }
    for (const name of fileNames) {
      const file = zip.files[name];
      if (file.dir) {
        newZip.folder(name);
        continue;
      }
      if (EXCLUDED_FILES.some(ex => name.endsWith(ex))) {
        const content = await file.async('uint8array');
        newZip.file(name, content);
      } else {
        // ファイルごとに32文字ランダムキー
        const key = Array.from({length:32},()=>"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"[Math.floor(Math.random()*62)]).join("");
        const iv = key.slice(0,16);
        const content = await file.async('uint8array');
        // CFB8未対応のためCFB(128)で代用
        const wordArray = CryptoJS.lib.WordArray.create(content);
        const encrypted = CryptoJS.AES.encrypt(wordArray, CryptoJS.enc.Utf8.parse(key), { iv: CryptoJS.enc.Utf8.parse(iv), mode: CryptoJS.mode.CFB, padding: CryptoJS.pad.NoPadding }).ciphertext;
        // JSZipのfile()はUint8Array, ArrayBuffer, String, Blobのみ対応
        // 暗号化データはWordArray→Uint8Arrayに変換して格納
        const encryptedBytes = new Uint8Array(encrypted.words.length * 4);
        for (let i = 0; i < encrypted.words.length; ++i) {
          const word = encrypted.words[i];
          encryptedBytes[i * 4] = (word >> 24) & 0xff;
          encryptedBytes[i * 4 + 1] = (word >> 16) & 0xff;
          encryptedBytes[i * 4 + 2] = (word >> 8) & 0xff;
          encryptedBytes[i * 4 + 3] = word & 0xff;
        }
        newZip.file(name, encryptedBytes);
        contentEntries.push({ path: name.slice(manifestPrefix.length), key });
      }
    }
    // contents.json生成
    const contentsJson = JSON.stringify({ content: contentEntries });
    newZip.file(manifestPrefix + "contents.json", contentsJson);
    // 新しいZIP作成
    const encryptedZipBlob = await newZip.generateAsync({type: 'blob'});
    // ダウンロード
    const a = document.createElement('a');
    a.href = URL.createObjectURL(encryptedZipBlob);
    a.download = 'encrypted_files.zip';
    a.click();
    status.textContent = '完了！';
  } catch (e) {
    status.textContent = 'エラー: ' + e.message;
  }
};
