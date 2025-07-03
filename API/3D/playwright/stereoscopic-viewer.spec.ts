import { test, expect } from '@playwright/test';
import path from 'path';

const TEST_URL = 'http://localhost/API/3D/src/test.html';
const TEST_IMAGE = path.resolve(__dirname, '../src/test-image.jpg'); // テスト用画像をsrcに配置してください

test.describe('3DS風立体視ビューアー', () => {
  test('画像アップロード→交互表示→フルスクリーン', async ({ page }) => {
    await page.goto(TEST_URL);
    // 画像アップロード
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('#imageInput');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(TEST_IMAGE);
    // 交互表示ボタンをクリック
    await page.click('#showAlternatingBtn');
    // 交互表示canvasが描画されているか確認
    const canvas = await page.$('#parallaxBarrierCanvas');
    expect(canvas).not.toBeNull();
    // フルスクリーンボタンがあればクリック
    const fullscreenBtn = await page.$('#fullscreenBtn');
    if (fullscreenBtn) {
      await fullscreenBtn.click();
      // フルスクリーン状態を確認（APIサポート時）
      const isFullscreen = await page.evaluate(() => !!document.fullscreenElement);
      expect(isFullscreen).toBeTruthy();
    }
  });
});
