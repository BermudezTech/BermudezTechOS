import { CDT_ID_NAMESPACE, uuidV5 } from './ids';

const NAMESPACE_DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const NAMESPACE_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

// Vectores generados con `uuid.uuid5` de Python (mismo algoritmo que debit_ids.py del backend).
describe('uuidV5', () => {
  it.each([
    [NAMESPACE_DNS, 'python.org', '886313e1-3b8a-5372-9b90-0c9aee199e5d'],
    [NAMESPACE_URL, 'https://bermudeztech.os/cdt', 'f0d5e336-6fab-55d2-8f0e-0dc488ef5977'],
    [CDT_ID_NAMESPACE, 'prev-1:renewal', '0957dc88-6f54-5092-b970-0a4ed4712ff0'],
    [NAMESPACE_DNS, 'ñandú 💰', '9cff3e67-4d24-5fe7-95ff-793f439e6c68'],
    [NAMESPACE_URL, 'a'.repeat(100), '864949eb-2508-5b93-a1e7-0fe6ca888495'],
  ])('uuid5(%s, %s) = %s', (namespace, name, expected) => {
    expect(uuidV5(namespace, name)).toBe(expected);
  });

  it('el namespace de CDT es el documentado', () => {
    expect(CDT_ID_NAMESPACE).toBe(uuidV5(NAMESPACE_URL, 'https://bermudeztech.os/cdt'));
  });

  it('produce versión 5 y variante RFC 4122, y es determinista', () => {
    const id = uuidV5(CDT_ID_NAMESPACE, 'x');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuidV5(CDT_ID_NAMESPACE, 'x')).toBe(id);
  });
});
