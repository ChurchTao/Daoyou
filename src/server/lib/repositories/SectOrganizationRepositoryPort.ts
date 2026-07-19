import type * as postgresRepository from './sectOrganizationRepository';
import * as repository from './sectOrganizationRepository';

export type SectOrganizationRepositoryPort = typeof postgresRepository;

export const postgresSectOrganizationRepository: SectOrganizationRepositoryPort = repository;
