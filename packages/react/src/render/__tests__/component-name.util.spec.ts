import { describe, expect, it } from 'vitest';
import {
  getComponentName,
  getLayoutName,
  isValidComponentName,
  LAYOUT_NAME_FALLBACK,
  serializeLayoutMetadata,
} from '../component-name.util';

describe('component-name.util', () => {
  it('prefers displayName over function name for public component identity', () => {
    function MinifiedName() {
      return null;
    }
    MinifiedName.displayName = 'PublicName';

    expect(getComponentName(MinifiedName)).toBe('PublicName');
  });

  it('uses distinct fallbacks for pages and layouts', () => {
    expect(getComponentName({ displayName: undefined, name: '' })).toBe(
      'Component',
    );
    expect(getLayoutName({ displayName: undefined, name: '' })).toBe(
      LAYOUT_NAME_FALLBACK,
    );
  });

  it('serializes only layout names and props, never component functions', () => {
    function RootLayout() {
      return null;
    }
    RootLayout.displayName = 'RootLayout';

    const result = serializeLayoutMetadata([
      { layout: RootLayout, props: { theme: 'dark' } },
      { layout: { displayName: undefined, name: '' }, props: undefined },
    ]);

    expect(result).toEqual([
      { name: 'RootLayout', props: { theme: 'dark' } },
      { name: 'Layout', props: undefined },
    ]);
    expect(JSON.stringify(result)).not.toContain('function');
  });

  it('accepts plausible generated names from files, identifiers, and unicode components', () => {
    expect(isValidComponentName('RootLayout')).toBe(true);
    expect(isValidComponentName('products.index-page')).toBe(true);
    expect(isValidComponentName('Price$Card_2')).toBe(true);
    expect(isValidComponentName('ÉtéLayout')).toBe(true);
  });

  it('rejects empty, invisible, whitespace, markup, and oversized names', () => {
    expect(isValidComponentName('')).toBe(false);
    expect(isValidComponentName('Root Layout')).toBe(false);
    expect(isValidComponentName('Root\u200BLayout')).toBe(false);
    expect(isValidComponentName('<script>alert(1)</script>')).toBe(false);
    expect(isValidComponentName('A'.repeat(129))).toBe(false);
  });
});
