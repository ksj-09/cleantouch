export type Hotspot = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ProductMapping = {
  productName: string;
  price: string;
  productUrl: string;
  startTime: number;
  endTime: number;
  duration: number;
  hotspot: Hotspot;
  published: boolean;
};

export type StoredVideo = {
  blob: Blob;
  name: string;
  type: string;
  updatedAt: number;
};

export const defaultMapping: ProductMapping = {
  productName: '미니멀 숄더백',
  price: '89,000',
  productUrl: 'https://shop.example.com/products/bag-014',
  startTime: 4,
  endTime: 13,
  duration: 15,
  hotspot: { x: 54, y: 39, width: 36, height: 33 },
  published: true,
};

const MAPPING_KEY = 'cleantouch.mapping.v1';
const DATABASE_NAME = 'cleantouch-local';
const DATABASE_VERSION = 1;
const ASSET_STORE = 'assets';
const ACTIVE_VIDEO_KEY = 'active-video';

export function loadMapping(): ProductMapping {
  try {
    const stored = window.localStorage.getItem(MAPPING_KEY);
    if (!stored) return defaultMapping;
    const value = JSON.parse(stored) as Partial<ProductMapping>;
    return {
      ...defaultMapping,
      ...value,
      hotspot: { ...defaultMapping.hotspot, ...value.hotspot },
    };
  } catch {
    return defaultMapping;
  }
}

export function saveMapping(mapping: ProductMapping) {
  window.localStorage.setItem(MAPPING_KEY, JSON.stringify(mapping));
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(ASSET_STORE)) {
        request.result.createObjectStore(ASSET_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadStoredVideo(): Promise<StoredVideo | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE, 'readonly');
    const request = transaction.objectStore(ASSET_STORE).get(ACTIVE_VIDEO_KEY);
    request.onsuccess = () => resolve((request.result as StoredVideo | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function storeVideo(file: File): Promise<StoredVideo> {
  const asset: StoredVideo = {
    blob: file,
    name: file.name,
    type: file.type,
    updatedAt: Date.now(),
  };
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE, 'readwrite');
    transaction.objectStore(ASSET_STORE).put(asset, ACTIVE_VIDEO_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  return asset;
}

export async function removeStoredVideo() {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE, 'readwrite');
    transaction.objectStore(ASSET_STORE).delete(ACTIVE_VIDEO_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}
