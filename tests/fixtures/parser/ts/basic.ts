// fixture: TypeScript 函数与接口
import { readFile } from 'fs/promises';

interface User {
  id: number;
  name: string;
  email: string;
}

function createUser(id: number, name: string, email: string): User {
  return { id, name, email };
}

async function fetchUser(id: number): Promise<User | null> {
  return null;
}

interface Repository<T> {
  findById(id: number): Promise<T | null>;
  save(entity: T): Promise<T>;
}
