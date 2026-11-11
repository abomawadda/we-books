// نقطة الدخول الوحيدة للبيانات. لاستبدال IndexedDB بـ Firestore يُغيَّر المحوّل هنا فقط.
import { createIdbAdapter } from './idb/adapter.js';
import { createRepository } from './repository.js';

export { C } from './collections.js';
export { PermissionError, ForbiddenDeleteError } from './repository.js';
export { membersSource } from './members.js';

export const repo = createRepository(createIdbAdapter());
