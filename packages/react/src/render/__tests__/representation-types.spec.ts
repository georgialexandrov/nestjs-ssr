import { describe, it, expect } from 'vitest';
import {
  api,
  isApiRepresentation,
  isExplicitRepresentation,
  isPageRepresentation,
  isRepresentationResult,
  page,
  representations,
  type ApiRepresentation,
  type PageRepresentation,
  type RepresentationResult,
} from '../../interfaces/representation.interface';

/**
 * These assertions are checked by `tsc --noEmit` as much as by vitest: the
 * annotations below only compile if `page()` and `api()` really do keep
 * independent static types, which is the whole point of the envelope.
 */

interface ProductViewModel {
  title: string;
  priceLabel: string;
}

interface ProductApiDto {
  id: string;
  cents: number;
}

describe('representation types', () => {
  it('keeps the HTML and JSON types independent', async () => {
    const result: RepresentationResult<ProductViewModel, ProductApiDto> =
      representations({
        html: page<ProductViewModel>({
          props: { title: 'Chair', priceLabel: '£40' },
        }),
        json: api<ProductApiDto>({ id: 'p1', cents: 4000 }),
      });

    const html: PageRepresentation<ProductViewModel> | undefined = result.html;
    const json: ApiRepresentation<ProductApiDto> | undefined = result.json;

    const pageValue = await html!.resolve();
    const title: string = pageValue.props.title;
    const dto = await json!.resolve();
    const cents: number = dto.cents;

    expect(title).toBe('Chair');
    expect(cents).toBe(4000);
  });

  it('infers the page type from the value', async () => {
    const representation = page({ props: { count: 1 } });
    const resolved = await representation.resolve();
    const count: number = resolved.props.count;
    expect(count).toBe(1);
  });

  it('accepts a lazy producer for either representation', async () => {
    const result = representations({
      html: page(() => ({ props: { title: 'Lazy' } })),
      json: api(async () => ({ id: 'p1' })),
    });

    expect((await result.html!.resolve()).props.title).toBe('Lazy');
    expect(await result.json!.resolve()).toEqual({ id: 'p1' });
  });

  it('wraps a bare props object passed to page()', async () => {
    const representation = page({ title: 'Bare' } as { title: string });
    expect(await representation.resolve()).toEqual({
      props: { title: 'Bare' },
    });
  });

  it('lets api() declare its own media type', () => {
    expect(api({ ok: true }).mediaType).toBe('application/json');
    expect(
      api({ ok: true }, { mediaType: 'application/vnd.acme+json' }).mediaType,
    ).toBe('application/vnd.acme+json');
  });

  it('recognises its own results and nothing else', () => {
    expect(isPageRepresentation(page({ props: {} }))).toBe(true);
    expect(isApiRepresentation(api({}))).toBe(true);
    expect(isRepresentationResult(representations({}))).toBe(true);

    // A domain object that happens to use these key names is application data.
    const lookalike = { html: '<p>cms</p>', json: { a: 1 } };
    expect(isRepresentationResult(lookalike)).toBe(false);
    expect(isExplicitRepresentation(lookalike)).toBe(false);
    expect(isExplicitRepresentation(null)).toBe(false);
    expect(isExplicitRepresentation('page')).toBe(false);
  });
});
