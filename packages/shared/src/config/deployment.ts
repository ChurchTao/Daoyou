export function allowsLocalDevTools(
  environment: string | undefined,
  nodeEnvironment: string | undefined,
) {
  return environment === 'local' && nodeEnvironment !== 'production';
}
