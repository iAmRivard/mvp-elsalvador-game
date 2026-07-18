import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('configuración de aceptación E2E', () => {
  it('no oculta flakes mediante retries en CI', () => {
    const config = readFileSync(resolve('playwright.config.ts'), 'utf8');
    expect(config).toMatch(/retries:\s*0,/);
    expect(config).not.toMatch(/retries:\s*process\.env\.CI/);
  });

  it('conserva la traza y los artefactos del primer fallo', () => {
    const config = readFileSync(resolve('playwright.config.ts'), 'utf8');
    const workflow = readFileSync(
      resolve('.github/workflows/docker.yml'),
      'utf8',
    );
    expect(config).toMatch(/trace:\s*'retain-on-failure'/);
    expect(workflow).toMatch(
      /uses:\s*actions\/upload-artifact@v4[\s\S]*?if-no-files-found:\s*warn/,
    );
    expect(workflow).toMatch(/path:\s*test-results/);
    expect(workflow).toMatch(/if:\s*failure\(\)/);
    expect(workflow).toMatch(/retention-days:\s*7/);
  });
});
