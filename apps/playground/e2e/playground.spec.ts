import { test, expect } from '@playwright/test';

test.describe('SkillBridge Playground', () => {
  test('1. Playground loads with all controls', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SkillBridge Playground/);
    await expect(page.getByRole('heading', { name: /Playground/ })).toBeVisible();
    await expect(page.getByText(/Alpha/)).toBeVisible();
    await expect(page.locator('#source-editor')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Load Example' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analyze' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Convert' })).toBeVisible();
  });

  test('2. Adapter discovery shows 4 adapters', async ({ page }) => {
    await page.goto('/');
    const sourceSelect = page.getByLabel('Source adapter');
    const targetSelect = page.getByLabel('Target adapter');
    await expect(sourceSelect.locator('option')).toHaveCount(4);
    await expect(targetSelect.locator('option')).toHaveCount(4);
    await expect(sourceSelect).toContainText('0.1.0-alpha');
  });

  test('3. Load example populates editor and clears results', async ({ page }) => {
    await page.goto('/');
    const editor = page.locator('#source-editor');
    // App auto-loads the example on mount; Reset clears it.
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(editor).toHaveValue('');
    await page.getByRole('button', { name: 'Load Example' }).click();
    await expect(editor).not.toHaveValue('');
    await expect(editor).toContainText('hello-world');
    // Load Example resets results -> Summary placeholder confirms no stale output.
    await expect(page.getByText(/Run Analyze or Convert to see results/)).toBeVisible();
  });

  test('4. Successful analysis', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Load Example' }).click();
    await page.getByRole('button', { name: 'Analyze' }).click();
    // Analyze switches to the Diagnostics tab; assert the diagnostics table renders.
    await expect(page.locator('.diag-table tbody tr').first()).toBeVisible({ timeout: 10000 });
  });

  test('5. Successful portable → Claude conversion', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Load Example' }).click();
    await page.getByLabel('Policy').selectOption('permissive');
    await page.getByRole('button', { name: 'Convert' }).click();
    await expect(page.getByText(/Conversion/)).toBeVisible({ timeout: 10000 });
    const output = page.locator('[data-testid="generated-output"]');
    await expect(output).toBeVisible({ timeout: 5000 });
    const text = await output.textContent();
    expect(text?.length).toBeGreaterThan(0);
  });

  test('6. Portable → Codex conversion', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Load Example' }).click();
    await page.getByLabel('Target adapter').selectOption('adapter-codex');
    await page.getByLabel('Policy').selectOption('permissive');
    await page.getByRole('button', { name: 'Convert' }).click();
    await expect(page.getByText(/Conversion/)).toBeVisible({ timeout: 10000 });
    const output = page.locator('[data-testid="generated-output"]');
    await expect(output).toBeVisible({ timeout: 5000 });
    await expect(output).not.toBeEmpty();
  });

  test('7. Portable → OpenCode conversion', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Load Example' }).click();
    await page.getByLabel('Target adapter').selectOption('adapter-opencode');
    await page.getByLabel('Policy').selectOption('permissive');
    await page.getByRole('button', { name: 'Convert' }).click();
    await expect(page.getByText(/Conversion/)).toBeVisible({ timeout: 10000 });
    const output = page.locator('[data-testid="generated-output"]');
    await expect(output).toBeVisible({ timeout: 5000 });
    await expect(output).not.toBeEmpty();
  });

  test('8. Determinism — repeated conversion identical', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Load Example' }).click();
    await page.getByLabel('Policy').selectOption('permissive');

    await page.getByRole('button', { name: 'Convert' }).click();
    await expect(page.locator('[data-testid="generated-output"]')).toBeVisible({ timeout: 10000 });
    const text1 = await page.locator('[data-testid="generated-output"]').textContent();

    await page.getByRole('button', { name: 'Convert' }).click();
    await expect(page.locator('[data-testid="generated-output"]')).toBeVisible({ timeout: 10000 });
    const text2 = await page.locator('[data-testid="generated-output"]').textContent();

    expect(text1).toBe(text2);
  });

  test('9. Invalid source shows error', async ({ page }) => {
    await page.goto('/');
    const editor = page.locator('#source-editor');
    // Strict policy blocks the file-read capability gap -> deterministic CONV-010.
    await editor.fill('---\nname: bad\ncapabilities:\n  - file-read\n---\n\nBody content.');
    await page.getByLabel('Policy').selectOption('strict');
    await page.getByRole('button', { name: 'Convert' }).click();
    await expect(page.getByRole('cell', { name: 'CONV-010' })).toBeVisible({ timeout: 10000 });
    // App remains usable.
    await expect(page.getByRole('button', { name: 'Load Example' })).toBeEnabled();
  });

  test('10. Empty input shows validation', async ({ page }) => {
    await page.goto('/');
    // Client-side validation: Convert and Analyze are disabled when input is empty.
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByRole('button', { name: 'Convert' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Analyze' })).toBeDisabled();
  });

  test('11. Policy-blocked conversion', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Load Example' }).click();
    await page.getByLabel('Policy').selectOption('safe');
    await page.getByRole('button', { name: 'Convert' }).click();
    // Safe policy blocks the hello-world fs permission change -> CONV-010.
    await expect(page.getByRole('cell', { name: 'CONV-010' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/conversion blocked by policy/)).toBeVisible();
  });

  test('12. Copy output button', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Load Example' }).click();
    await page.getByLabel('Policy').selectOption('permissive');
    await page.getByRole('button', { name: 'Convert' }).click();
    await expect(page.locator('[data-testid="generated-output"]')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Copy Output' }).click();
    await expect(page.getByText('Copied!')).toBeVisible();
  });

  test('13. Download output', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Load Example' }).click();
    await page.getByLabel('Policy').selectOption('permissive');
    await page.getByRole('button', { name: 'Convert' }).click();
    await expect(page.locator('[data-testid="generated-output"]')).toBeVisible({ timeout: 10000 });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download Output' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('converted-skill.md');
  });

  test('14. Input change invalidates result', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Load Example' }).click();
    await page.getByLabel('Policy').selectOption('permissive');
    await page.getByRole('button', { name: 'Convert' }).click();
    await expect(page.locator('[data-testid="generated-output"]')).toBeVisible({ timeout: 10000 });

    const editor = page.locator('#source-editor');
    await editor.fill('modified content');

    await page.getByRole('button', { name: 'Convert' }).click();
    await expect(page.locator('[data-testid="generated-output"]')).toBeVisible({ timeout: 10000 });
    const text = await page.locator('[data-testid="generated-output"]').textContent();
    expect(text).not.toContain('hello-world');
  });

  test('15. Keyboard accessibility', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.locator('#source-editor')).toBeFocused();
  });
});
