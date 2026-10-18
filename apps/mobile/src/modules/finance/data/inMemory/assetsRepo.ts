import { assetInputSchema } from '../../domain/schemas/asset';
import type { Asset, AssetInput } from '../../domain/types';
import { getEntity, insert, patch, softDelete } from './store';
import { validate } from './validate';

export async function createAsset(input: AssetInput): Promise<Asset> {
  return insert('assets', validate(assetInputSchema, input) as AssetInput);
}

export async function updateAsset(id: string, changes: Partial<AssetInput>): Promise<Asset> {
  const { name, value, validUntil } = getEntity('assets', id);
  return patch('assets', id, validate(assetInputSchema, { name, value, validUntil, ...changes }) as AssetInput);
}

export async function deleteAsset(id: string): Promise<void> {
  softDelete('assets', id);
}
