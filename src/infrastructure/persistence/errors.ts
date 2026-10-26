export class PersistenceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PersistenceError";
  }
}

export class UnsupportedSchemaVersionError extends PersistenceError {
  constructor(version: unknown) {
    super(`Stored data uses unsupported schema version ${String(version)}. No data was changed.`);
    this.name = "UnsupportedSchemaVersionError";
  }
}

export class ProjectNotFoundError extends PersistenceError {
  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "ProjectNotFoundError";
  }
}
