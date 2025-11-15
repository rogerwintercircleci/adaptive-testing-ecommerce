import {
  Repository,
  FindOptionsWhere,
  FindManyOptions,
  DeepPartial,
  ObjectId,
} from 'typeorm';
import { NotFoundError } from '../errors';

/**
 * Base Repository with common CRUD operations
 * Extend this class for entity-specific repositories
 */
export abstract class BaseRepository<T> {
  constructor(protected repository: Repository<T>) {}

  /**
   * Find all entities matching criteria
   */
  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find(options);
  }

  /**
   * Find entity by ID
   * @throws NotFoundError if entity not found
   */
  async findById(id: string | number | ObjectId): Promise<T> {
    const entity = await this.repository.findOne({
      where: { id } as FindOptionsWhere<T>,
    });

    if (!entity) {
      throw new NotFoundError(`${this.getEntityName()} with ID ${String(id)} not found`);
    }

    return entity;
  }

  /**
   * Find entity by ID or return null
   */
  async findByIdOrNull(id: string | number | ObjectId): Promise<T | null> {
    return this.repository.findOne({
      where: { id } as FindOptionsWhere<T>,
    });
  }

  /**
   * Find one entity matching criteria
   */
  async findOne(where: FindOptionsWhere<T>): Promise<T | null> {
    return this.repository.findOne({ where });
  }

  /**
   * Find one entity or throw error
   * @throws NotFoundError if entity not found
   */
  async findOneOrFail(where: FindOptionsWhere<T>): Promise<T> {
    const entity = await this.repository.findOne({ where });

    if (!entity) {
      throw new NotFoundError(`${this.getEntityName()} not found`);
    }

    return entity;
  }

  /**
   * Create new entity
   */
  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  /**
   * Update entity by ID
   * @throws NotFoundError if entity not found
   */
  async update(id: string | number | ObjectId, data: DeepPartial<T>): Promise<T> {
    const entity = await this.findById(id);
    const updated = this.repository.merge(entity, data);
    return this.repository.save(updated);
  }

  /**
   * Delete entity by ID
   * @throws NotFoundError if entity not found
   */
  async delete(id: string | number | ObjectId): Promise<void> {
    const entity = await this.findById(id);
    await this.repository.remove(entity);
  }

  /**
   * Soft delete entity by ID (if entity has deletedAt column)
   */
  async softDelete(id: string | number | ObjectId): Promise<void> {
    await this.repository.softDelete(id);
  }

  /**
   * Count entities matching criteria
   */
  async count(where?: FindOptionsWhere<T>): Promise<number> {
    return this.repository.count({ where });
  }

  /**
   * Check if entity exists
   */
  async exists(where: FindOptionsWhere<T>): Promise<boolean> {
    const count = await this.repository.count({ where });
    return count > 0;
  }

  /**
   * Get entity name for error messages
   */
  protected getEntityName(): string {
    return this.repository.metadata.name;
  }

  /**
   * Get the underlying TypeORM repository
   */
  getRepository(): Repository<T> {
    return this.repository;
  }
}
